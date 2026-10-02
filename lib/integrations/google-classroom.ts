import "server-only";
import { z } from "zod";
import { IntegrationError, type GoogleMethod } from "./google-policy";
import type { TrackedAssignment } from "../history";
import type { Status } from "../types";
const id = z.string().min(1).max(256);
const timestamp = z.string().datetime({ offset: true });
export const courseSchema = z
  .object({
    id,
    name: z.string().min(1),
    courseState: z.string().optional(),
    creationTime: timestamp.optional(),
  })
  .passthrough();
export const workSchema = z
  .object({
    id,
    courseId: id,
    title: z.string().min(1),
    description: z.string().optional(),
    creationTime: timestamp.optional(),
    updateTime: timestamp.optional(),
    state: z.string().optional(),
    alternateLink: z.string().optional(),
    maxPoints: z.number().nonnegative().max(9999999).optional(),
    dueDate: z
      .object({
        year: z.number().int().min(1).max(9999),
        month: z.number().int().min(1).max(12),
        day: z.number().int().min(1).max(31),
      })
      .optional(),
    dueTime: z
      .object({
        hours: z.number().int().min(0).max(23).optional(),
        minutes: z.number().int().min(0).max(59).optional(),
        seconds: z.number().int().min(0).max(59).optional(),
        nanos: z.number().int().min(0).max(999999999).optional(),
      })
      .optional(),
  })
  .passthrough();
export const submissionSchema = z
  .object({
    id,
    courseId: id,
    courseWorkId: id,
    userId: id,
    state: z.string(),
    late: z.boolean().optional(),
    assignedGrade: z.number().nonnegative().max(9999999).optional(),
    alternateLink: z.string().optional(),
  })
  .passthrough();
export type GoogleCourse = z.infer<typeof courseSchema>;
export type GoogleWork = z.infer<typeof workSchema>;
export type GoogleSubmission = z.infer<typeof submissionSchema>;
export interface GoogleSnapshot {
  courses: {
    course: GoogleCourse;
    work: GoogleWork[];
    submissions: GoogleSubmission[];
  }[];
  retrieved: number;
}
export type Fetcher = typeof fetch;
function failure(status: number, body: unknown, method: GoogleMethod) {
  // Only known reason codes leave this function, never upstream messages or metadata.
  const error = z
    .object({
      error: z
        .object({
          details: z
            .array(z.object({ reason: z.string().optional() }).passthrough())
            .optional(),
          errors: z
            .array(z.object({ reason: z.string().optional() }).passthrough())
            .optional(),
        })
        .passthrough(),
    })
    .safeParse(body);
  const reasons = error.success
    ? [
        ...(error.data.error.details || []),
        ...(error.data.error.errors || []),
      ].map((d) => d.reason)
    : [];
  if (
    reasons.some((r) => r === "SERVICE_DISABLED" || r === "accessNotConfigured")
  )
    return new IntegrationError("API_DISABLED", method);
  if (reasons.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT"))
    return new IntegrationError("SCOPE_MISSING", method);
  if (
    reasons.some((r) =>
      ["ORG_RESTRICTION_VIOLATION", "DOMAIN_POLICY", "domainPolicy"].includes(
        r || "",
      ),
    )
  )
    return new IntegrationError("ACCOUNT_RESTRICTED", method);
  return new IntegrationError(
    status === 401
      ? "RECONNECT_REQUIRED"
      : status === 403
        ? "PERMISSION_DENIED"
        : status === 429
          ? "RATE_LIMITED"
          : status === 404
            ? "NOT_FOUND"
            : status >= 500
              ? "UNAVAILABLE"
              : "INVALID_RESPONSE",
    method,
  );
}
export async function googleJson(
  url: URL,
  accessToken: string,
  method: GoogleMethod,
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
) {
  if (url.origin !== "https://classroom.googleapis.com")
    throw new IntegrationError("INVALID_RESPONSE", method);
  try {
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    });
    const body: unknown = await response.json();
    if (!response.ok) throw failure(response.status, body, method);
    return body;
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError(
      signal.aborted ||
      (error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name))
        ? "TIMEOUT"
        : "UNAVAILABLE",
      method,
    );
  }
}
export async function listPages<T>(
  path: string,
  field: string,
  schema: z.ZodType<T>,
  params: Record<string, string>,
  token: string,
  method: GoogleMethod,
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<T[]> {
  const result: T[] = [];
  const seen = new Set<string>();
  let pageToken = "";
  do {
    if (signal.aborted) throw new IntegrationError("TIMEOUT", method);
    const url = new URL(`https://classroom.googleapis.com/v1/${path}`);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const body = await googleJson(url, token, method, signal, fetcher);
    const page = z
      .object({
        [field]: z.array(schema).optional(),
        nextPageToken: z.string().optional(),
      })
      .safeParse(body);
    if (!page.success) throw new IntegrationError("INVALID_RESPONSE", method);
    result.push(...((page.data[field] || []) as T[]));
    pageToken =
      typeof page.data.nextPageToken === "string"
        ? page.data.nextPageToken
        : "";
    if (pageToken && seen.has(pageToken))
      throw new IntegrationError("INVALID_RESPONSE", method);
    if (pageToken) seen.add(pageToken);
    if (result.length > 50000)
      throw new IntegrationError("INVALID_RESPONSE", method);
  } while (pageToken);
  return result;
}
export async function fetchClassroomSnapshot(
  token: string,
  accountId: string,
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<GoogleSnapshot> {
  const courses = await listPages(
    "courses",
    "courses",
    courseSchema,
    { studentId: "me", courseStates: "ACTIVE" },
    token,
    "courses.list",
    signal,
    fetcher,
  );
  const result: GoogleSnapshot = { courses: [], retrieved: courses.length };
  const courseIds = new Set<string>();
  for (const course of courses) {
    if (courseIds.has(course.id))
      throw new IntegrationError("INVALID_RESPONSE", "courses.list");
    courseIds.add(course.id);
    const root = `courses/${encodeURIComponent(course.id)}/courseWork`;
    const work = await listPages(
      root,
      "courseWork",
      workSchema,
      { courseWorkStates: "PUBLISHED" },
      token,
      "courses.courseWork.list",
      signal,
      fetcher,
    );
    const submissions = await listPages(
      `${root}/-/studentSubmissions`,
      "studentSubmissions",
      submissionSchema,
      { userId: "me" },
      token,
      "courses.courseWork.studentSubmissions.list",
      signal,
      fetcher,
    );
    const workIds = new Set<string>();
    const submissionIds = new Set<string>();
    for (const w of work) {
      if (w.courseId !== course.id || workIds.has(w.id))
        throw new IntegrationError(
          "INVALID_RESPONSE",
          "courses.courseWork.list",
        );
      workIds.add(w.id);
    }
    for (const s of submissions) {
      if (
        s.courseId !== course.id ||
        s.userId !== accountId ||
        submissionIds.has(s.courseWorkId)
      )
        throw new IntegrationError(
          "INVALID_RESPONSE",
          "courses.courseWork.studentSubmissions.list",
        );
      submissionIds.add(s.courseWorkId);
    }
    result.retrieved += work.length + submissions.length;
    result.courses.push({ course, work, submissions });
  }
  return result;
}
export function normalizeWork(
  work: GoogleWork,
  submission?: GoogleSubmission,
): TrackedAssignment & { status: Status; type: "ASSIGNMENT" } {
  let dueDate: string | null = null;
  // Google specifies both dueDate and dueTime in UTC; empty time objects mean midnight.
  if (Boolean(work.dueDate) !== Boolean(work.dueTime))
    throw new IntegrationError("INVALID_RESPONSE", "courses.courseWork.list");
  if (work.dueDate && work.dueTime) {
    const d = work.dueDate;
    const t = work.dueTime;
    const value = new Date(0);
    value.setUTCFullYear(d.year, d.month - 1, d.day);
    value.setUTCHours(
      t.hours || 0,
      t.minutes || 0,
      t.seconds || 0,
      Math.floor((t.nanos || 0) / 1000000),
    );
    if (value.getUTCMonth() !== d.month - 1 || value.getUTCDate() !== d.day)
      throw new IntegrationError("INVALID_RESPONSE", "courses.courseWork.list");
    dueDate = value.toISOString();
  }
  const sourceState = submission?.state || null;
  let status: Status = "UNKNOWN";
  if (sourceState === "TURNED_IN") status = "SUBMITTED";
  else if (sourceState === "RETURNED")
    status = submission?.assignedGrade != null ? "GRADED" : "SUBMITTED";
  else if (
    ["NEW", "CREATED", "RECLAIMED_BY_STUDENT"].includes(sourceState || "")
  )
    status = submission?.late ? "LATE" : "UPCOMING";
  const pointsEarned = submission?.assignedGrade ?? null;
  const pointsPossible = work.maxPoints ?? null;
  return {
    title: work.title,
    description: work.description || null,
    status,
    dueDate,
    dueDateOnly: false,
    assignedDate: work.creationTime || null,
    type: "ASSIGNMENT",
    pointsEarned,
    pointsPossible,
    grade:
      pointsEarned != null && pointsPossible != null && pointsPossible > 0
        ? Math.round((pointsEarned / pointsPossible) * 100000) / 1000
        : null,
    sourceState,
    sourceLate: submission?.late || false,
  };
}
