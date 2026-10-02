import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";

// Identity comes from Classroom links, never from titles. UI links may encode numeric API IDs.
export function classroomId(value: string): string {
  if (/^\d+$/.test(value)) return value;
  try {
    const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    if (/^\d+$/.test(decoded)) return decoded;
  } catch {}
  return value;
}
export function classroomLink(value: string) {
  try {
    const url = new URL(value);
    if (
      url.origin !== "https://classroom.google.com" ||
      url.username ||
      url.password
    )
      return null;
    const match = url.pathname.match(
      /^\/(?:u\/\d+\/)?c\/([\w-]+)(?:\/(a|sa)\/([\w-]+)(?:\/(?:details|submissions))?)?\/?$/,
    );
    if (!match) return null;
    return {
      courseId: classroomId(match[1]),
      assignmentId: match[3] ? classroomId(match[3]) : null,
      url: `https://classroom.google.com/c/${match[1]}${match[3] ? `/${match[2]}/${match[3]}/details` : ""}`,
    };
  } catch {
    return null;
  }
}
const id = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[\w-]+$/)
  .transform(classroomId);
const text = z.string().trim().min(1).max(1000);
const timestamp = z.string().datetime({ offset: true });
const date = z
  .union([timestamp, z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
  .refine((v) => {
    const d = new Date(v);
    return (
      Number.isFinite(d.getTime()) &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(v) || d.toISOString().slice(0, 10) === v)
    );
  });
const link = z
  .string()
  .max(1500)
  .refine(
    (v) => !!classroomLink(v),
    "Use a Classroom course or assignment link",
  )
  .transform((v) => classroomLink(v)?.url || v);
export const browserCourseSchema = z
  .object({
    externalCourseId: id,
    name: text,
    sourceUrl: link,
    teacherName: text.nullable().optional(),
  })
  .strict();
export const browserAssignmentSchema = z
  .object({
    externalCourseId: id,
    externalAssignmentId: id,
    title: text,
    sourceUrl: link,
    dueAt: date.nullable().optional(),
    assignedAt: date.nullable().optional(),
    status: z.enum(["assigned", "missing", "turned_in", "returned"]).optional(),
    pointsPossible: z
      .number()
      .finite()
      .min(0)
      .max(9999999)
      .nullable()
      .optional(),
    currentGrade: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .strict();
export const browserImportSchema = z
  .object({
    child: z.enum(["E", "A"]),
    courses: z.array(browserCourseSchema).min(1).max(300),
    assignments: z.array(browserAssignmentSchema).max(3000),
    extractedAt: timestamp,
  })
  .strict()
  .superRefine((body, ctx) => {
    const courses = new Set(body.courses.map((c) => c.externalCourseId));
    for (const c of body.courses) {
      const parsed = classroomLink(c.sourceUrl)!;
      if (
        !parsed ||
        parsed.courseId !== c.externalCourseId ||
        parsed.assignmentId
      )
        ctx.addIssue({
          code: "custom",
          message: "Course link does not match identity",
        });
    }
    for (const a of body.assignments) {
      const parsed = classroomLink(a.sourceUrl)!;
      if (
        !parsed ||
        !courses.has(a.externalCourseId) ||
        parsed.courseId !== a.externalCourseId ||
        parsed.assignmentId !== a.externalAssignmentId
      )
        ctx.addIssue({
          code: "custom",
          message: "Assignment link does not match course and identity",
        });
    }
  });
export type BrowserImport = z.infer<typeof browserImportSchema>;
export type BrowserCourse = z.infer<typeof browserCourseSchema>;
export type BrowserAssignment = z.infer<typeof browserAssignmentSchema>;
export function browserDate(value: string | null | undefined) {
  if (value == null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? fromZonedTime(`${value}T12:00:00`, "America/New_York").toISOString()
    : new Date(value).toISOString();
}
export function gradeNumbers(
  value: string | null | undefined,
  possible: number | null,
) {
  if (value == null) return { pointsEarned: null, grade: null };
  const match = value.match(
    /^(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?)|(%))?$/,
  );
  if (!match) return { pointsEarned: null, grade: null };
  const n = Number(match[1]);
  const total = match[2] ? Number(match[2]) : possible;
  const grade = match[3]
    ? n
    : total && total > 0
      ? Math.round((n / total) * 100000) / 1000
      : null;
  return {
    pointsEarned: !match[3] && n <= 9999999 ? n : null,
    grade: grade != null && grade <= 9999.999 ? grade : null,
  };
}
export function mergeObserved<T extends object>(
  before: T,
  after: Partial<T>,
): T {
  return {
    ...before,
    ...Object.fromEntries(
      Object.entries(after).filter(([, v]) => v !== undefined),
    ),
  };
}
export function deduplicateImport(body: BrowserImport): BrowserImport {
  function unique<T extends object>(values: T[], key: (v: T) => string) {
    const map = new Map<string, T>();
    for (const v of values) {
      const previous = map.get(key(v));
      if (previous)
        for (const [field, value] of Object.entries(v)) {
          const old = (previous as Record<string, unknown>)[field];
          if (value !== undefined && old !== undefined && value !== old)
            throw new Error("CONFLICTING_OBSERVATIONS");
        }
      map.set(key(v), mergeObserved(previous || v, v));
    }
    return [...map.values()];
  }
  return {
    ...body,
    courses: unique(body.courses, (c) => c.externalCourseId),
    assignments: unique(
      body.assignments,
      (a) => `${a.externalCourseId}/${a.externalAssignmentId}`,
    ),
  };
}
