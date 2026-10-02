import { createHash } from "node:crypto";
export interface TrackedAssignment {
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  dueDateOnly: boolean;
  assignedDate: string | null;
  type: string;
  pointsEarned: number | null;
  pointsPossible: number | null;
  grade: number | null;
  sourceState?: string | null;
  sourceLate?: boolean;
  currentGrade?: string | null;
}
export function assignmentFingerprint(value: TrackedAssignment) {
  // Explicit order and fields: no raw payload ordering or sync timestamps in equality.
  return createHash("sha256")
    .update(
      JSON.stringify([
        value.title,
        value.description,
        value.status,
        value.dueDate,
        value.dueDateOnly,
        value.assignedDate,
        value.type,
        value.pointsEarned,
        value.pointsPossible,
        value.grade,
        value.sourceState ?? null,
        value.sourceLate ?? false,
        value.currentGrade ?? null,
      ]),
    )
    .digest("hex");
}
export function shouldSnapshot(
  previousFingerprint: string | null,
  value: TrackedAssignment,
) {
  return previousFingerprint !== assignmentFingerprint(value);
}
