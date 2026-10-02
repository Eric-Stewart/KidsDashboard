import "server-only";
import { requireParent } from "./require-auth";
import { demoEnabled } from "./auth-policy";
import { makeDemo } from "./demo";
import { getDb } from "./db";
import type { DashboardData, Change } from "./types";
import { googleReady } from "./integrations/google-config";
import { errorDescription } from "./integrations/google-policy";
import { classroomSource } from "./classroom-source";
const blankIntegrations: DashboardData["integrations"] = [
  {
    id: "google-e",
    label: "Google Classroom · Eric",
    status: "NOT_CONNECTED",
    lastAttempt: null,
    lastSuccess: null,
  },
  {
    id: "google-a",
    label: "Google Classroom · Ada",
    status: "NOT_CONNECTED",
    lastAttempt: null,
    lastSuccess: null,
  },
  {
    id: "genesis",
    label: "Genesis Parent Portal",
    status: "NOT_CONNECTED",
    lastAttempt: null,
    lastSuccess: null,
  },
];
export async function getDashboardData(): Promise<DashboardData> {
  await requireParent();
  if (demoEnabled()) return makeDemo();
  const mode = classroomSource();
  const visibleSources: (
    | "GENESIS"
    | "GOOGLE_CLASSROOM"
    | "GOOGLE_CLASSROOM_BROWSER"
  )[] = [
    "GENESIS",
    mode === "browser" ? "GOOGLE_CLASSROOM_BROWSER" : "GOOGLE_CLASSROOM",
  ];
  const empty: DashboardData = {
    demo: false,
    classroomSource: mode,
    schoolSyncMode: process.env.SCHOOL_SYNC_MODE === "cloud" ? "cloud" : "local",
    now: new Date().toISOString(),
    assignments: [],
    courses: [],
    lunch: ["E", "A"].map((child) => ({
      child: child as "E" | "A",
      balance: null,
      observedAt: null,
    })),
    integrations: blankIntegrations.map((i) => ({
      ...i,
      mode: i.id !== "genesis" ? mode : undefined,
      canConnect: i.id !== "genesis" && mode === "api" && googleReady(),
    })),
    changes: [],
  };
  if (!process.env.DATABASE_URL) return { ...empty, unavailable: true };
  try {
    const db = getDb();
    const [assignments, courses, children, sources, connections] =
      await Promise.all([
        db.assignment.findMany({
          where: {
            course: { active: true },
            sources: {
              some: { available: true, source: { in: visibleSources } },
            },
          },
          include: {
            course: true,
            sources: {
              where: { available: true, source: { in: visibleSources } },
              select: { source: true, sourceUrl: true },
            },
          },
          orderBy: { dueDate: "asc" },
        }),
        db.course.findMany({
          where: {
            active: true,
            ...(mode === "browser"
              ? {
                  OR: [
                    { source: "GENESIS" as const },
                    { lastExtractedAt: { not: null } },
                  ],
                }
              : {}),
          },
          include: {
            grades: {
              include: { snapshots: { orderBy: { observedAt: "asc" } } },
            },
          },
        }),
        db.child.findMany({
          include: {
            lunchSnapshots: { orderBy: { observedAt: "desc" }, take: 1 },
          },
        }),
        db.dataSource.findMany({
          include: { syncRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
        }),
        db.oAuthConnection.findMany({
          where: { provider: "google" },
          select: { childId: true, accountEmail: true },
        }),
      ]);
    const changes: Change[] = [];
    // The latest successful run per source remains visible after a failed attempt.
    for (const source of sources) {
      if (!visibleSources.includes(source.source)) continue;
      const run = await db.syncRun.findFirst({
        where: { dataSourceId: source.id, status: "SUCCESS" },
        orderBy: { startedAt: "desc" },
        include: {
          assignments: { include: { assignment: true } },
          grades: { include: { courseGrade: { include: { course: true } } } },
        },
      });
      if (!run) continue;
      for (const h of run.assignments) {
        const previous = await db.assignmentHistory.findFirst({
          where: {
            assignmentId: h.assignmentId,
            observedAt: { lt: h.observedAt },
          },
          orderBy: { observedAt: "desc" },
        });
        const text = !previous
          ? `New assignment: ${h.title}`
          : h.status === "MISSING" && previous.status !== "MISSING"
            ? `${h.title} marked missing`
            : h.status === "GRADED" &&
                (previous.status !== "GRADED" ||
                  String(previous.pointsEarned) !== String(h.pointsEarned) ||
                  String(previous.pointsPossible) !==
                    String(h.pointsPossible) ||
                  String(previous.grade) !== String(h.grade) ||
                  previous.currentGrade !== h.currentGrade)
              ? `Grade updated: ${h.title}`
              : null;
        if (text)
          changes.push({
            id: h.id,
            child: h.assignment.childId,
            text,
            date: h.observedAt.toISOString(),
            kind:
              h.status === "MISSING"
                ? "missing"
                : h.status === "GRADED"
                  ? "grade"
                  : "assignment",
          });
      }
      for (const h of run.grades) {
        const previous = await db.courseGradeSnapshot.findFirst({
          where: {
            courseGradeId: h.courseGradeId,
            observedAt: { lt: h.observedAt },
          },
          orderBy: { observedAt: "desc" },
        });
        const label = (v: { percentage: unknown; grade: string | null }) =>
          v.percentage != null ? `${v.percentage}%` : v.grade || "unavailable";
        changes.push({
          id: h.id,
          child: h.courseGrade.course.childId,
          text: `${h.courseGrade.course.name}: ${previous ? `${label(previous)} → ` : ""}${label(h)}`,
          date: h.observedAt.toISOString(),
          kind: "grade",
        });
      }
    }
    return {
      ...empty,
      assignments: assignments.map((a) => ({
        id: a.id,
        child: a.childId,
        courseId: a.courseId,
        course: a.course.name,
        title: a.title,
        description: a.description || "",
        dueDate: a.dueDate?.toISOString() || null,
        dueDateOnly: a.dueDateOnly,
        assignedDate: a.assignedDate?.toISOString() || null,
        status: a.status,
        type: a.type,
        pointsEarned: a.pointsEarned == null ? null : Number(a.pointsEarned),
        pointsPossible:
          a.pointsPossible == null ? null : Number(a.pointsPossible),
        grade: a.grade == null ? null : Number(a.grade),
        currentGrade: a.currentGrade,
        sources: a.sources.map((s) => ({
          source: s.source,
          url: safeSourceUrl(s.sourceUrl),
        })),
      })),
      courses: courses.flatMap((c) =>
        c.grades.length
          ? c.grades.map((g) => ({
              id: c.id,
              child: c.childId,
              name: c.name,
              teacher: c.teacherName || "",
              source: c.source,
              period: g.period,
              history: g.snapshots.map((s) => ({
                date: s.observedAt.toISOString(),
                percentage: s.percentage == null ? null : Number(s.percentage),
                grade: s.grade,
              })),
            }))
          : [
              {
                id: c.id,
                child: c.childId,
                name: c.name,
                teacher: c.teacherName || "",
                source: c.source,
                period: "Current",
                history: [],
              },
            ],
      ),
      lunch: empty.lunch.map((l) => {
        const s = children.find((c) => c.id === l.child)?.lunchSnapshots[0];
        return {
          ...l,
          balance: s ? Number(s.balance) : null,
          observedAt: s?.observedAt.toISOString() || null,
        };
      }),
      integrations: empty.integrations.map((i) => {
        const source = sources.find(
          (s) =>
            s.id ===
            (mode === "browser" && i.id.startsWith("google-")
              ? i.id.replace("google-", "google-browser-")
              : i.id),
        );
        const connection = connections.find(
          (c) => mode === "api" && `google-${c.childId.toLowerCase()}` === i.id,
        );
        const run = source?.syncRuns[0];
        const interrupted =
          run?.status === "RUNNING" &&
          source?.leaseExpiresAt &&
          source.leaseExpiresAt < new Date();
        return {
          ...i,
          status: interrupted
            ? ("FAILED" as const)
            : run?.status ||
              (connection
                ? ("CONNECTED" as const)
                : ("NOT_CONNECTED" as const)),
          lastAttempt: source?.lastAttemptAt?.toISOString() || null,
          lastSuccess: source?.lastSuccessAt?.toISOString() || null,
          connected: !!connection,
          accountEmail: connection?.accountEmail || null,
          error: errorDescription(interrupted ? "INTERRUPTED" : run?.errorCode),
          counts: run
            ? {
                retrieved: run.recordsRetrieved,
                created: run.recordsCreated,
                updated: run.recordsUpdated,
                snapshots: run.snapshotChanges,
              }
            : undefined,
        };
      }),
      changes: changes.sort((a, b) => b.date.localeCompare(a.date)),
    };
  } catch {
    console.error("DASHBOARD_DATA_UNAVAILABLE");
    return { ...empty, unavailable: true };
  }
}
export function safeSourceUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "classroom.google.com") return url.toString();
    if (url.hostname === "parents.c3.genesisedu.net")
      return "https://parents.c3.genesisedu.net/leonia/parents";
  } catch {}
  return null;
}
