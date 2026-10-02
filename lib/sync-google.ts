import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Child } from "./types";
import { assignmentFingerprint } from "./history";
import { decryptToken, encryptToken, hash, tokenContext } from "./token-crypto";
import {
  fetchClassroomSnapshot,
  normalizeWork,
  type GoogleSnapshot,
} from "./integrations/google-classroom";
import { requestTokens, validateScopes } from "./integrations/google-tokens";
import { IntegrationError, errorCode } from "./integrations/google-policy";
import { classroomSource } from "./classroom-source";

export interface SyncResult {
  source: string;
  ok: boolean;
  code?: string;
  retrieved?: number;
  created?: number;
  updated?: number;
  snapshots?: number;
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function acquireSync(db: PrismaClient, child: Child) {
  const id = `google-${child.toLowerCase()}`;
  const lease = randomUUID();
  const now = new Date();
  return db.$transaction(async (tx) => {
    await tx.dataSource.upsert({
      where: { id },
      create: { id, source: "GOOGLE_CLASSROOM", childId: child },
      update: {},
    });
    const lock = await tx.dataSource.updateMany({
      where: {
        id,
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
      },
      data: {
        leaseToken: lease,
        leaseExpiresAt: new Date(now.getTime() + 300000),
        lastAttemptAt: now,
      },
    });
    if (!lock.count) throw new IntegrationError("BUSY");
    await tx.syncRun.updateMany({
      where: { dataSourceId: id, status: "RUNNING" },
      data: { status: "FAILED", finishedAt: now, errorCode: "INTERRUPTED" },
    });
    const run = await tx.syncRun.create({
      data: { dataSourceId: id, startedAt: now },
    });
    return { id, lease, runId: run.id };
  });
}
export async function persistSnapshot(
  db: PrismaClient,
  child: Child,
  lock: { id: string; lease: string; runId: string },
  snapshot: GoogleSnapshot,
) {
  // Validate every assignment before the write transaction; a partial response never replaces stored data.
  const courses = snapshot.courses.map((bundle) => ({
    ...bundle,
    normalized: bundle.work.map((work) => ({
      work,
      submission: bundle.submissions.find((s) => s.courseWorkId === work.id),
      state: normalizeWork(
        work,
        bundle.submissions.find((s) => s.courseWorkId === work.id),
      ),
    })),
  }));
  return db.$transaction(
    async (tx) => {
      const observedAt = new Date();
      // Conditional UPDATE both verifies ownership and holds the row lock until commit.
      if (
        !(
          await tx.dataSource.updateMany({
            where: {
              id: lock.id,
              leaseToken: lock.lease,
              leaseExpiresAt: { gt: observedAt },
            },
            data: { leaseExpiresAt: new Date(observedAt.getTime() + 120000) },
          })
        ).count
      )
        throw new IntegrationError("LEASE_EXPIRED");
      let created = 0,
        updated = 0,
        snapshots = 0;
      const externalIds: string[] = [];
      for (const bundle of courses) {
        const identity = {
          childId: child,
          source: "GOOGLE_CLASSROOM" as const,
          externalId: bundle.course.id,
          schoolYear: "UNSPECIFIED",
        };
        const beforeCourse = await tx.course.findUnique({
          where: { childId_source_externalId_schoolYear: identity },
        });
        const course = await tx.course.upsert({
          where: { childId_source_externalId_schoolYear: identity },
          create: { ...identity, name: bundle.course.name },
          update: { name: bundle.course.name, active: true },
        });
        if (!beforeCourse) created++;
        else if (beforeCourse.name !== course.name || !beforeCourse.active)
          updated++;
        for (const { work, submission, state } of bundle.normalized) {
          const externalId = `${bundle.course.id}/${work.id}`;
          externalIds.push(externalId);
          const raw = JSON.parse(
            JSON.stringify({
              course: bundle.course,
              work,
              submission: submission || null,
            }),
          ) as Prisma.InputJsonValue;
          const sourceFingerprint = hash(stableJson(raw));
          const fingerprint = assignmentFingerprint(state);
          const existing = await tx.assignmentSource.findUnique({
            where: {
              childId_source_externalId: {
                childId: child,
                source: "GOOGLE_CLASSROOM",
                externalId,
              },
            },
            include: {
              assignment: {
                include: {
                  sources: { select: { source: true } },
                  history: { orderBy: { observedAt: "desc" }, take: 1 },
                },
              },
            },
          });
          const { sourceState, sourceLate, ...values } = state;
          const canonical = {
            ...values,
            currentGrade: null,
            dueDate: values.dueDate ? new Date(values.dueDate) : null,
            assignedDate: values.assignedDate
              ? new Date(values.assignedDate)
              : null,
          };
          const sourceUrl =
            submission?.alternateLink || work.alternateLink || null;
          if (!existing) {
            const browserRecord = await tx.assignmentSource.findUnique({
              where: {
                childId_source_externalId: {
                  childId: child,
                  source: "GOOGLE_CLASSROOM_BROWSER",
                  externalId,
                },
              },
              include: {
                assignment: {
                  include: {
                    sources: true,
                    history: { orderBy: { observedAt: "desc" }, take: 1 },
                  },
                },
              },
            });
            const genesisOwnsCanonical = browserRecord?.assignment.sources.some(
              (s) => s.source === "GENESIS",
            );
            const stateChanged =
              !browserRecord ||
              browserRecord.assignment.history[0]?.fingerprint !== fingerprint;
            const assignment =
              browserRecord?.assignment ||
              (await tx.assignment.create({
                data: {
                  childId: child,
                  courseId: course.id,
                  ...canonical,
                  firstSeenAt: observedAt,
                },
              }));
            if (browserRecord && stateChanged && !genesisOwnsCanonical)
              await tx.assignment.update({
                where: { id: assignment.id },
                data: canonical,
              });
            const source = await tx.assignmentSource.create({
              data: {
                assignmentId: assignment.id,
                childId: child,
                source: "GOOGLE_CLASSROOM",
                externalId,
                raw,
                fingerprint: sourceFingerprint,
                sourceUrl,
                lastSeenAt: observedAt,
              },
            });
            await tx.sourceRevision.create({
              data: {
                assignmentSourceId: source.id,
                raw,
                fingerprint: sourceFingerprint,
                observedAt,
              },
            });
            if (stateChanged && !genesisOwnsCanonical) {
              await tx.assignmentHistory.create({
                data: {
                  assignmentId: assignment.id,
                  syncRunId: lock.runId,
                  ...canonical,
                  sourceState,
                  sourceLate,
                  fingerprint,
                  observedAt,
                },
              });
              snapshots++;
            }
            if (browserRecord) updated++;
            else created++;
          } else {
            const sourceChanged = existing.fingerprint !== sourceFingerprint;
            const stateChanged =
              existing.assignment.history[0]?.fingerprint !== fingerprint;
            const genesisOwnsCanonical = existing.assignment.sources.some(
              (s) => s.source === "GENESIS",
            );
            if (sourceChanged)
              await tx.sourceRevision.create({
                data: {
                  assignmentSourceId: existing.id,
                  raw,
                  fingerprint: sourceFingerprint,
                  observedAt,
                },
              });
            await tx.assignmentSource.update({
              where: { id: existing.id },
              data: {
                raw,
                fingerprint: sourceFingerprint,
                sourceUrl,
                lastSeenAt: observedAt,
                available: true,
              },
            });
            if (stateChanged && !genesisOwnsCanonical) {
              await tx.assignment.update({
                where: { id: existing.assignmentId },
                data: canonical,
              });
              await tx.assignmentHistory.create({
                data: {
                  assignmentId: existing.assignmentId,
                  syncRunId: lock.runId,
                  ...canonical,
                  sourceState,
                  sourceLate,
                  fingerprint,
                  observedAt,
                },
              });
              snapshots++;
            }
            if (sourceChanged || stateChanged || !existing.available) updated++;
          }
        }
      }
      // A complete active-course snapshot can hide inaccessible records without deleting history.
      updated += (
        await tx.assignmentSource.updateMany({
          where: {
            childId: child,
            source: "GOOGLE_CLASSROOM",
            available: true,
            externalId: { notIn: externalIds },
          },
          data: { available: false },
        })
      ).count;
      updated += (
        await tx.course.updateMany({
          where: {
            childId: child,
            source: "GOOGLE_CLASSROOM",
            active: true,
            externalId: { notIn: courses.map((c) => c.course.id) },
          },
          data: { active: false },
        })
      ).count;
      await tx.syncRun.update({
        where: { id: lock.runId },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          recordsRetrieved: snapshot.retrieved,
          recordsCreated: created,
          recordsUpdated: updated,
          snapshotChanges: snapshots,
        },
      });
      await tx.dataSource.update({
        where: { id: lock.id },
        data: {
          lastSuccessAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      return { retrieved: snapshot.retrieved, created, updated, snapshots };
    },
    { timeout: 60000, maxWait: 10000 },
  );
}
export async function syncGoogle(child: Child): Promise<SyncResult> {
  const source = `google-${child.toLowerCase()}`;
  if (classroomSource() !== "api")
    return { source, ok: false, code: "BROWSER_SYNC_REQUIRED" };
  let lock: Awaited<ReturnType<typeof acquireSync>> | undefined;
  let retrieved = 0;
  try {
    const db = getDb();
    lock = await acquireSync(db, child);
    const connection = await db.oAuthConnection.findUnique({
      where: { childId_provider: { childId: child, provider: "google" } },
    });
    if (!connection) throw new IntegrationError("NOT_CONNECTED");
    validateScopes(connection.scopes.join(" "));
    const signal = AbortSignal.timeout(110000);
    const tokens = await requestTokens(
      {
        grant_type: "refresh_token",
        refresh_token: decryptToken(
          connection.encryptedRefreshToken,
          tokenContext(child, connection.accountId),
        ),
      },
      signal,
    );
    if (tokens.scope) validateScopes(tokens.scope);
    if (tokens.refresh_token)
      await db.oAuthConnection.updateMany({
        where: { id: connection.id, updatedAt: connection.updatedAt },
        data: {
          encryptedRefreshToken: encryptToken(
            tokens.refresh_token,
            tokenContext(child, connection.accountId),
          ),
        },
      });
    const snapshot = await fetchClassroomSnapshot(
      tokens.access_token,
      connection.accountId,
      signal,
    );
    retrieved = snapshot.retrieved;
    const result = await persistSnapshot(db, child, lock, snapshot);
    return { source, ok: true, ...result };
  } catch (error) {
    const code = errorCode(error);
    if (lock) {
      try {
        const ownedLock = lock;
        await getDb().$transaction(async (tx) => {
          // An expired worker must never clear another worker's lease.
          if (
            !(
              await tx.dataSource.updateMany({
                where: { id: ownedLock.id, leaseToken: ownedLock.lease },
                data: { leaseToken: null, leaseExpiresAt: null },
              })
            ).count
          )
            return;
          await tx.syncRun.update({
            where: { id: ownedLock.runId },
            data: {
              status: "FAILED",
              finishedAt: new Date(),
              recordsRetrieved: retrieved,
              errorCode: code,
            },
          });
        });
      } catch {
        /* Return a safe code; abandoned leases expire and are recovered on the next run. */
      }
    }
    return { source, ok: false, code };
  }
}
