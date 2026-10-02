import { test } from "node:test";
import assert from "node:assert/strict";
import { demoEnabled, allowedParent } from "../lib/auth-policy";
import { dayDistance, overdue, urgency, dayKey } from "../lib/dates";
import { makeDemo } from "../lib/demo";
import {
  assignmentFingerprint,
  shouldSnapshot,
  type TrackedAssignment,
} from "../lib/history";
test("demo authentication cannot be enabled in production or Vercel", () => {
  assert.equal(
    demoEnabled({ NODE_ENV: "production", DEMO_MODE: "true" }),
    false,
  );
  assert.equal(
    demoEnabled({ NODE_ENV: "development", DEMO_MODE: "true", VERCEL: "1" }),
    false,
  );
  assert.equal(
    demoEnabled({ NODE_ENV: "development", DEMO_MODE: "true" }),
    true,
  );
});
test("parent access requires explicit allowlist and verified identity", () => {
  assert.equal(
    allowedParent("parent@example.test", true, "Parent@example.test"),
    true,
  );
  assert.equal(
    allowedParent("parent@example.test", false, "parent@example.test"),
    false,
  );
  assert.equal(
    allowedParent("stranger@example.test", true, "parent@example.test"),
    false,
  );
  assert.equal(allowedParent("parent@example.test", true, ""), false);
});
test("dates use school timezone over midnight and DST", () => {
  assert.equal(dayKey("2026-09-29T01:00:00Z"), "2026-09-28");
  assert.equal(dayDistance("2026-03-09T12:00:00Z", "2026-03-08T12:00:00Z"), 1);
  assert.equal(dayDistance("2026-11-02T12:00:00Z", "2026-11-01T12:00:00Z"), 1);
});
test("date-only work is due all day; submitted work is never urgent", () => {
  const now = "2026-09-28T23:00:00Z";
  const a = makeDemo(now).assignments[2];
  assert.equal(overdue(a, now), false);
  assert.equal(urgency(a, now), 2);
  assert.equal(overdue({ ...a, dueDateOnly: false }, now), true);
  assert.equal(urgency({ ...a, status: "SUBMITTED" }, now), 9);
  assert.equal(urgency({ ...a, status: "MISSING", dueDate: null }, now), 0);
});
test("history records changed values only, including transitions back to a prior state", () => {
  const initial: TrackedAssignment = {
    title: "Worksheet",
    description: null,
    status: "UPCOMING",
    dueDate: null,
    dueDateOnly: true,
    assignedDate: null,
    type: "ASSIGNMENT",
    pointsEarned: null,
    pointsPossible: 10,
    grade: null,
  };
  const fingerprint = assignmentFingerprint(initial);
  assert.equal(shouldSnapshot(null, initial), true);
  assert.equal(shouldSnapshot(fingerprint, { ...initial }), false);
  const missing = { ...initial, status: "MISSING" };
  assert.equal(shouldSnapshot(fingerprint, missing), true);
  assert.equal(shouldSnapshot(assignmentFingerprint(missing), initial), true);
  assert.equal(
    shouldSnapshot(fingerprint, { ...initial, pointsEarned: 0 }),
    true,
  );
  assert.equal(
    shouldSnapshot(fingerprint, {
      ...initial,
      dueDate: "2026-10-01T19:00:00Z",
    }),
    true,
  );
});
