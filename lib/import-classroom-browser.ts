import "server-only";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { assignmentFingerprint } from "./history";
import { hash } from "./token-crypto";
import {
  browserImportSchema,
  deduplicateImport,
  browserDate,
  gradeNumbers,
  mergeObserved,
  type BrowserAssignment,
} from "./classroom-browser-schema";

export async function importClassroomBrowser(db: PrismaClient, input: unknown) {
  const body = deduplicateImport(browserImportSchema.parse(input));
  const extractedAt = new Date(body.extractedAt);
  if (
    extractedAt.getTime() > Date.now() + 300000 ||
    extractedAt.getTime() < Date.now() - 7 * 86400000
  )
    throw new Error("INVALID_EXTRACTION_TIME");
  const id = `google-browser-${body.child.toLowerCase()}`;
  try {
    return await db.$transaction(
      async (tx) => {
        const now = new Date();
        // UPDATE holds the source row lock through commit, serializing imports for this child.
        await tx.dataSource.upsert({
          where: { id },
          create: {
            id,
            source: "GOOGLE_CLASSROOM_BROWSER",
            childId: body.child,
          },
          update: { lastAttemptAt: now },
        });
        await tx.dataSource.update({
          where: { id },
          data: { lastAttemptAt: now },
        });
        const run = await tx.syncRun.create({
          data: { dataSourceId: id, startedAt: now },
        });
        let created = 0,
          updated = 0,
          snapshots = 0,
          ignored = 0;
        const courseIds = new Map<string, string>();
        for (const c of body.courses) {
          // Same canonical Classroom course identity across API and browser transport.
          const identity = {
            childId: body.child,
            source: "GOOGLE_CLASSROOM" as const,
            externalId: c.externalCourseId,
            schoolYear: "UNSPECIFIED",
          };
          const before = await tx.course.findUnique({
            where: { childId_source_externalId_schoolYear: identity },
          });
          if (
            before?.lastExtractedAt &&
            before.lastExtractedAt >= extractedAt
          ) {
            courseIds.set(c.externalCourseId, before.id);
            continue;
          }
          const course = await tx.course.upsert({
            where: { childId_source_externalId_schoolYear: identity },
            create: {
              ...identity,
              name: c.name,
              teacherName: c.teacherName,
              sourceUrl: c.sourceUrl,
              lastExtractedAt: extractedAt,
            },
            update: {
              name: c.name,
              teacherName: c.teacherName,
              sourceUrl: c.sourceUrl,
              lastExtractedAt: extractedAt,
              active: true,
            },
          });
          courseIds.set(c.externalCourseId, course.id);
          if (!before) created++;
          else if (
            before.name !== course.name ||
            before.teacherName !== course.teacherName
          )
            updated++;
        }
        for (const a of body.assignments) {
          const externalId = `${a.externalCourseId}/${a.externalAssignmentId}`;
          const identity = {
            childId: body.child,
            source: "GOOGLE_CLASSROOM_BROWSER" as const,
            externalId,
          };
          const source = await tx.assignmentSource.findUnique({
            where: { childId_source_externalId: identity },
            include: {
              assignment: {
                include: {
                  sources: true,
                  history: { orderBy: { observedAt: "desc" }, take: 1 },
                },
              },
            },
          });
          if (
            source?.lastExtractedAt &&
            source.lastExtractedAt >= extractedAt
          ) {
            ignored++;
            continue;
          }
          // Exact IDs may reuse an API assignment; never match on title alone.
          const api = !source
            ? await tx.assignmentSource.findUnique({
                where: {
                  childId_source_externalId: {
                    ...identity,
                    source: "GOOGLE_CLASSROOM",
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
              })
            : null;
          const existing = source?.assignment || api?.assignment;
          const observed = mergeObserved(
            (source?.raw || {}) as unknown as BrowserAssignment,
            a,
          );
          const baseline = existing;
          const dueDate =
            a.dueAt === undefined
              ? baseline?.dueDate?.toISOString() || null
              : browserDate(a.dueAt);
          const assignedDate =
            a.assignedAt === undefined
              ? baseline?.assignedDate?.toISOString() || null
              : browserDate(a.assignedAt);
          const currentGrade =
            a.currentGrade === undefined
              ? baseline?.currentGrade || null
              : a.currentGrade;
          const pointsPossible =
            a.pointsPossible === undefined
              ? baseline?.pointsPossible == null
                ? null
                : Number(baseline.pointsPossible)
              : a.pointsPossible;
          const numbers =
            a.currentGrade === undefined &&
            (a.pointsPossible === undefined || currentGrade === null)
              ? {
                  pointsEarned:
                    baseline?.pointsEarned == null
                      ? null
                      : Number(baseline.pointsEarned),
                  grade:
                    baseline?.grade == null ? null : Number(baseline.grade),
                }
              : gradeNumbers(currentGrade, pointsPossible);
          const status =
            a.status === "missing"
              ? "MISSING"
              : a.status === "assigned"
                ? "UPCOMING"
                : a.status === "turned_in"
                  ? "SUBMITTED"
                  : a.status === "returned"
                    ? currentGrade
                      ? "GRADED"
                      : "SUBMITTED"
                    : baseline?.status || "UNKNOWN";
          const state = {
            title: a.title,
            description: baseline?.description || null,
            status,
            dueDate,
            dueDateOnly:
              a.dueAt === undefined
                ? baseline?.dueDateOnly || false
                : !!a.dueAt && a.dueAt.length === 10,
            assignedDate,
            type: baseline?.type || "ASSIGNMENT",
            pointsPossible,
            ...numbers,
            currentGrade,
            sourceState:
              observed.status || baseline?.history[0]?.sourceState || null,
            sourceLate: false,
          } as const;
          const fingerprint = assignmentFingerprint(state);
          const { sourceState, sourceLate, ...values } = state;
          const canonical = {
            ...values,
            dueDate: dueDate ? new Date(dueDate) : null,
            assignedDate: assignedDate ? new Date(assignedDate) : null,
          };
          const protectedByGenesis = existing?.sources.some(
            (s) => s.source === "GENESIS",
          );
          const changed =
            !existing || existing.history[0]?.fingerprint !== fingerprint;
          const assignment =
            existing ||
            (await tx.assignment.create({
              data: {
                childId: body.child,
                courseId: courseIds.get(a.externalCourseId)!,
                ...canonical,
              },
            }));
          if (existing && changed && !protectedByGenesis)
            await tx.assignment.update({
              where: { id: assignment.id },
              data: canonical,
            });
          if (changed && !protectedByGenesis) {
            await tx.assignmentHistory.create({
              data: {
                assignmentId: assignment.id,
                syncRunId: run.id,
                ...canonical,
                sourceState,
                sourceLate,
                fingerprint,
                observedAt: now,
              },
            });
            snapshots++;
          }
          const raw = JSON.parse(
            JSON.stringify(observed),
          ) as Prisma.InputJsonValue;
          const sourceFingerprint = hash(
            JSON.stringify(
              Object.entries(observed).sort(([a], [b]) => a.localeCompare(b)),
            ),
          );
          const saved = await tx.assignmentSource.upsert({
            where: { childId_source_externalId: identity },
            create: {
              ...identity,
              assignmentId: assignment.id,
              raw,
              fingerprint: sourceFingerprint,
              sourceUrl: a.sourceUrl,
              lastSeenAt: now,
              lastExtractedAt: extractedAt,
            },
            update: {
              raw,
              fingerprint: sourceFingerprint,
              sourceUrl: a.sourceUrl,
              lastSeenAt: now,
              lastExtractedAt: extractedAt,
              available: true,
            },
          });
          if (source?.fingerprint !== sourceFingerprint)
            await tx.sourceRevision.create({
              data: {
                assignmentSourceId: saved.id,
                raw,
                fingerprint: sourceFingerprint,
                observedAt: now,
              },
            });
          if (!existing) created++;
          else if (changed || source?.fingerprint !== sourceFingerprint)
            updated++;
        }
        // Partial DOM observations never hide records absent from this import.
        const counts = {
          retrieved: body.courses.length + body.assignments.length,
          created,
          updated,
          snapshots,
          ignored,
        };
        await tx.syncRun.update({
          where: { id: run.id },
          data: {
            status: "SUCCESS",
            finishedAt: new Date(),
            recordsRetrieved: counts.retrieved,
            recordsCreated: created,
            recordsUpdated: updated,
            snapshotChanges: snapshots,
          },
        });
        await tx.dataSource.update({
          where: { id },
          data: { lastSuccessAt: new Date() },
        });
        return counts;
      },
      { timeout: 60000, maxWait: 10000 },
    );
  } catch (error) {
    try {
      await db.$transaction(async (tx) => {
        await tx.dataSource.upsert({
          where: { id },
          create: {
            id,
            source: "GOOGLE_CLASSROOM_BROWSER",
            childId: body.child,
            lastAttemptAt: new Date(),
          },
          update: { lastAttemptAt: new Date() },
        });
        await tx.syncRun.create({
          data: {
            dataSourceId: id,
            status: "FAILED",
            finishedAt: new Date(),
            errorCode: "DATABASE_ERROR",
          },
        });
      });
    } catch {
      /* An unavailable database cannot record its own failure. */
    }
    throw error;
  }
}
