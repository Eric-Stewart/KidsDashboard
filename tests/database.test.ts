import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("PostgreSQL migration enforces identity boundaries and retains returning snapshots", async () => {
  const db = new PGlite();
  try {
    for (const migration of readdirSync("prisma/migrations")
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await db.exec(
        readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
    }
    await db.exec(`INSERT INTO "Child" (id) VALUES ('E'), ('A');
      INSERT INTO "Course" (id,"childId",name,source,"externalId","schoolYear") VALUES ('math-e','E','Math','GENESIS','math','2026');
      INSERT INTO "Assignment" (id,"childId","courseId",title,"updatedAt") VALUES ('work-e','E','math-e','Worksheet',NOW());
      INSERT INTO "AssignmentSource" (id,"assignmentId","childId",source,"externalId",raw,fingerprint) VALUES ('source-e','work-e','E','GENESIS','1','{}','initial');
      INSERT INTO "DataSource" (id,source) VALUES ('genesis','GENESIS');
      INSERT INTO "SyncRun" (id,"dataSourceId") VALUES ('sync-1','genesis'),('sync-2','genesis'),('sync-3','genesis');`);
    await assert.rejects(
      db.exec(
        `INSERT INTO "Assignment" (id,"childId","courseId",title,"updatedAt") VALUES ('bad','A','math-e','Wrong child',NOW())`,
      ),
    );
    await assert.rejects(
      db.exec(
        `INSERT INTO "AssignmentSource" (id,"assignmentId","childId",source,"externalId",raw,fingerprint) VALUES ('wrong','work-e','A','GENESIS','1','{}','x')`,
      ),
    );
    await assert.rejects(
      db.exec(
        `INSERT INTO "AssignmentSource" (id,"assignmentId","childId",source,"externalId",raw,fingerprint) VALUES ('duplicate','work-e','E','GENESIS','1','{}','x')`,
      ),
    );
    for (const [run, status, fingerprint] of [
      ["sync-1", "UPCOMING", "a"],
      ["sync-2", "MISSING", "b"],
      ["sync-3", "UPCOMING", "a"],
    ]) {
      await db.query(
        `INSERT INTO "AssignmentHistory" (id,"assignmentId","syncRunId",title,status,type,fingerprint) VALUES ($1,'work-e',$1,'Worksheet',$2,'ASSIGNMENT',$3)`,
        [run, status, fingerprint],
      );
    }
    const result = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM "AssignmentHistory"`,
    );
    assert.equal(result.rows[0].count, 3);
    await assert.rejects(
      db.exec(
        `INSERT INTO "AssignmentHistory" (id,"assignmentId","syncRunId",title,status,type,fingerprint) VALUES ('dup','work-e','sync-3','Worksheet','UPCOMING','ASSIGNMENT','a')`,
      ),
    );
    const columns = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'OAuthConnection'`,
    );
    assert.ok(
      columns.rows.some((c) => c.column_name === "encryptedRefreshToken"),
    );
    assert.ok(!columns.rows.some((c) => c.column_name === "refreshToken"));
  } finally {
    await db.close();
  }
});
