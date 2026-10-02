import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { acquireSync, persistSnapshot } from "../lib/sync-google";
import { consumeAttempt, parentHash } from "../lib/integrations/google-oauth";
import { hash } from "../lib/token-crypto";
import type { GoogleSnapshot } from "../lib/integrations/google-classroom";

test(
  "real PostgreSQL: atomic snapshots, leases, isolation and one-use OAuth state",
  { skip: process.env.RUN_POSTGRES_TESTS !== "1" },
  async () => {
    config({ path: ".env.local", quiet: true });
    const url = process.env.DATABASE_URL!;
    assert.ok(
      ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
      "Use a local database for this test",
    );
    const schema = `classroom_test_${randomBytes(8).toString("hex")}`;
    const admin = new Client({ connectionString: url });
    await admin.connect();
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }, { schema }),
    });
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await admin.query(`SET search_path TO "${schema}"`);
      for (const name of readdirSync("prisma/migrations")
        .filter((n) => /^\d/.test(n))
        .sort()) {
        await admin.query(
          readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"),
        );
      }
      await db.child.createMany({ data: [{ id: "E" }, { id: "A" }] });
      const sample = (
        state = "CREATED",
        title = "Worksheet",
      ): GoogleSnapshot => ({
        retrieved: 3,
        courses: [
          {
            course: { id: "course", name: "Math" },
            work: [{ id: "work", courseId: "course", title, maxPoints: 10 }],
            submissions: [
              {
                id: "submission",
                courseId: "course",
                courseWorkId: "work",
                userId: "student",
                state,
              },
            ],
          },
        ],
      });
      const first = await acquireSync(db, "E");
      await assert.rejects(acquireSync(db, "E"), /BUSY/);
      const firstResult = await persistSnapshot(db, "E", first, sample());
      assert.equal(firstResult.snapshots, 1);
      assert.equal(firstResult.created, 2);
      const unchanged = await persistSnapshot(
        db,
        "E",
        await acquireSync(db, "E"),
        sample(),
      );
      assert.equal(unchanged.snapshots, 0);
      assert.equal(unchanged.updated, 0);
      await persistSnapshot(
        db,
        "E",
        await acquireSync(db, "E"),
        sample("TURNED_IN"),
      );
      await persistSnapshot(db, "E", await acquireSync(db, "E"), sample());
      assert.equal(
        await db.assignmentHistory.count(),
        3,
        "A→B→A retains every transition",
      );
      assert.equal(await db.sourceRevision.count(), 3);
      await persistSnapshot(db, "A", await acquireSync(db, "A"), sample());
      assert.equal(
        await db.assignment.count(),
        2,
        "Same external IDs remain separate across children",
      );
      const beforeFailure = await db.dataSource.findUniqueOrThrow({
        where: { id: "google-e" },
      });
      const failedLock = await acquireSync(db, "E");
      const bad = sample("CREATED", "Must roll back");
      bad.courses.push({
        course: { id: "bad", name: "Bad" },
        work: [{ id: "bad", courseId: "bad", title: "Bad", maxPoints: 0.001 }],
        submissions: [
          {
            id: "bad",
            courseId: "bad",
            courseWorkId: "bad",
            userId: "student",
            state: "RETURNED",
            assignedGrade: 9999999,
          },
        ],
      });
      await assert.rejects(persistSnapshot(db, "E", failedLock, bad));
      assert.equal(
        (await db.assignment.findFirstOrThrow({ where: { childId: "E" } }))
          .title,
        "Worksheet",
      );
      assert.equal(
        (
          await db.dataSource.findUniqueOrThrow({ where: { id: "google-e" } })
        ).lastSuccessAt?.toISOString(),
        beforeFailure.lastSuccessAt?.toISOString(),
      );
      await db.dataSource.update({
        where: { id: "google-e" },
        data: { leaseExpiresAt: new Date(0) },
      });
      const recovered = await acquireSync(db, "E");
      assert.equal(
        (
          await db.syncRun.findUniqueOrThrow({
            where: { id: failedLock.runId },
          })
        ).errorCode,
        "INTERRUPTED",
      );
      await assert.rejects(
        persistSnapshot(db, "E", failedLock, sample()),
        /LEASE_EXPIRED/,
      );
      await persistSnapshot(db, "E", recovered, { courses: [], retrieved: 0 });
      assert.equal(
        await db.assignmentHistory.count(),
        4,
        "Hiding inaccessible work preserves history",
      );
      assert.equal(
        await db.assignmentSource.count({
          where: { childId: "E", available: true },
        }),
        0,
      );
      assert.equal(
        await db.assignmentSource.count({
          where: { childId: "A", available: true },
        }),
        1,
      );
      const state = randomBytes(32).toString("base64url"),
        browser = randomBytes(32).toString("base64url");
      await db.oAuthAttempt.create({
        data: {
          stateHash: hash(state),
          childId: "E",
          parentHash: parentHash("parent@example.test"),
          browserHash: hash(browser),
          encryptedVerifier: "fixture",
          nonce: "nonce",
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      await assert.rejects(
        consumeAttempt(state, browser, "other@example.test", db),
        /INVALID_STATE/,
      );
      await assert.rejects(
        consumeAttempt(
          state,
          randomBytes(32).toString("base64url"),
          "parent@example.test",
          db,
        ),
        /INVALID_STATE/,
      );
      const consumed = await Promise.allSettled([
        consumeAttempt(state, browser, "parent@example.test", db),
        consumeAttempt(state, browser, "parent@example.test", db),
      ]);
      assert.equal(
        consumed.filter((r) => r.status === "fulfilled").length,
        1,
        "Only one concurrent callback succeeds",
      );
      await assert.rejects(
        consumeAttempt(state, browser, "parent@example.test", db),
        /INVALID_STATE/,
      );
    } finally {
      await db.$disconnect();
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  },
);
