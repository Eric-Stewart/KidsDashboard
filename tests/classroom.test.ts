import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encryptToken, decryptToken, tokenContext } from "../lib/token-crypto";
import {
  normalizeWork,
  fetchClassroomSnapshot,
  type Fetcher,
} from "../lib/integrations/google-classroom";
import { errorCode, errorDescription } from "../lib/integrations/google-policy";
import { assignmentFingerprint } from "../lib/history";

test("encrypted tokens reject tampering and account or child swaps", () => {
  const key = randomBytes(32).toString("base64");
  const context = tokenContext("E", "student");
  const ciphertext = encryptToken("private-refresh-token", context, key);
  assert.notEqual(
    ciphertext,
    encryptToken("private-refresh-token", context, key),
  );
  assert.equal(decryptToken(ciphertext, context, key), "private-refresh-token");
  assert.throws(() =>
    decryptToken(ciphertext, tokenContext("A", "student"), key),
  );
  assert.throws(() =>
    decryptToken(ciphertext, tokenContext("E", "other"), key),
  );
  const parts = ciphertext.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => decryptToken(parts.join("."), context, key));
  assert.throws(() =>
    decryptToken(ciphertext, context, randomBytes(32).toString("base64")),
  );
});

const work = {
  id: "w",
  courseId: "c",
  title: "Project review test",
  maxPoints: 10,
};
const submission = {
  id: "s",
  courseId: "c",
  courseWorkId: "w",
  userId: "student",
  state: "RETURNED",
  assignedGrade: 0,
};
test("normalization preserves zero grades, UTC midnight, and source state without guessing types", () => {
  const normalized = normalizeWork(
    { ...work, dueDate: { year: 2026, month: 11, day: 1 }, dueTime: {} },
    submission,
  );
  assert.equal(normalized.dueDate, "2026-11-01T00:00:00.000Z");
  assert.equal(normalized.pointsEarned, 0);
  assert.equal(normalized.grade, 0);
  assert.equal(normalized.status, "GRADED");
  assert.equal(normalized.type, "ASSIGNMENT");
  assert.equal(normalizeWork(work).status, "UNKNOWN");
  assert.equal(
    normalizeWork(work, { ...submission, state: "TURNED_IN", late: true })
      .status,
    "SUBMITTED",
  );
  assert.equal(
    normalizeWork(work, {
      ...submission,
      state: "RECLAIMED_BY_STUDENT",
      late: true,
    }).status,
    "LATE",
  );
  assert.equal(
    normalizeWork(work, {
      ...submission,
      assignedGrade: undefined,
      draftGrade: 9,
    }).pointsEarned,
    null,
  );
  assert.throws(() =>
    normalizeWork({
      ...work,
      dueDate: { year: 2026, month: 2, day: 30 },
      dueTime: {},
    }),
  );
  assert.throws(() =>
    normalizeWork({ ...work, dueDate: { year: 2026, month: 2, day: 1 } }),
  );
  assert.notEqual(
    assignmentFingerprint(normalized),
    assignmentFingerprint({ ...normalized, sourceLate: true }),
  );
});

test("Classroom paginates courses, coursework and own submissions", async () => {
  const calls: URL[] = [];
  const fetcher: Fetcher = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url);
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer secret",
    );
    let body: unknown;
    if (url.pathname === "/v1/courses") {
      assert.equal(url.searchParams.get("studentId"), "me");
      assert.equal(url.searchParams.get("courseStates"), "ACTIVE");
      body = url.searchParams.has("pageToken")
        ? {}
        : { courses: [{ id: "c", name: "Math" }], nextPageToken: "next" };
    } else if (url.pathname.endsWith("/studentSubmissions")) {
      assert.equal(url.searchParams.get("userId"), "me");
      body = url.searchParams.has("pageToken")
        ? {}
        : { studentSubmissions: [submission], nextPageToken: "next" };
    } else
      body = url.searchParams.has("pageToken")
        ? {}
        : { courseWork: [work], nextPageToken: "next" };
    return Response.json(body);
  };
  const result = await fetchClassroomSnapshot(
    "secret",
    "student",
    new AbortController().signal,
    fetcher,
  );
  assert.equal(calls.length, 6);
  assert.equal(result.retrieved, 3);
  assert.equal(result.courses[0].submissions[0].assignedGrade, 0);
});

test("partial responses and cross-account submissions fail with safe, precise diagnostics", async () => {
  for (const reason of [
    "SERVICE_DISABLED",
    "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
  ]) {
    const fetcher: Fetcher = async () =>
      Response.json(
        {
          error: {
            message: "secret-token-and-private-data",
            details: [{ reason }],
          },
        },
        { status: 403 },
      );
    await assert.rejects(
      fetchClassroomSnapshot(
        "secret",
        "student",
        new AbortController().signal,
        fetcher,
      ),
      (error) => {
        const code = errorCode(error);
        assert.ok(code);
        const description = errorDescription(code);
        assert.ok(description);
        assert.match(code, /courses.list/);
        assert.match(description, /courses.readonly/);
        assert.doesNotMatch(description, /secret-token|private-data/);
        return true;
      },
    );
  }
  const fetcher: Fetcher = async (input) => {
    const path = new URL(String(input)).pathname;
    return Response.json(
      path === "/v1/courses"
        ? { courses: [{ id: "c", name: "Math" }] }
        : path.endsWith("studentSubmissions")
          ? { studentSubmissions: [{ ...submission, userId: "other-student" }] }
          : { courseWork: [work] },
    );
  };
  await assert.rejects(
    fetchClassroomSnapshot(
      "secret",
      "student",
      new AbortController().signal,
      fetcher,
    ),
    /INVALID_RESPONSE/,
  );
});
