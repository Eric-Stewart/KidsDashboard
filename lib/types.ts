export type Child = "E" | "A";
export type Status =
  | "UPCOMING"
  | "DUE_SOON"
  | "SUBMITTED"
  | "GRADED"
  | "MISSING"
  | "LATE"
  | "UNKNOWN";
export type AssignmentType = "ASSIGNMENT" | "TEST" | "PROJECT";
export type Source =
  | "GENESIS"
  | "GOOGLE_CLASSROOM"
  | "GOOGLE_CLASSROOM_BROWSER";
export interface Assignment {
  id: string;
  child: Child;
  courseId: string;
  course: string;
  title: string;
  description: string;
  dueDate: string | null;
  dueDateOnly: boolean;
  assignedDate: string | null;
  status: Status;
  type: AssignmentType;
  pointsEarned: number | null;
  pointsPossible: number | null;
  grade: number | null;
  currentGrade?: string | null;
  sources: { source: Source; url: string | null }[];
}
export interface GradePoint {
  date: string;
  percentage: number | null;
  grade: string | null;
}
export interface Course {
  id: string;
  child: Child;
  name: string;
  teacher: string;
  source: Source;
  period: string;
  history: GradePoint[];
}
export interface Integration {
  mode?: "browser" | "api";
  id: string;
  label: string;
  status: "NOT_CONNECTED" | "CONNECTED" | "SUCCESS" | "FAILED" | "RUNNING";
  lastAttempt: string | null;
  lastSuccess: string | null;
  connected?: boolean;
  accountEmail?: string | null;
  canConnect?: boolean;
  error?: string | null;
  counts?: {
    retrieved: number;
    created: number;
    updated: number;
    snapshots: number;
  };
}
export interface Change {
  id: string;
  child: Child;
  text: string;
  date: string;
  kind: "assignment" | "missing" | "grade";
}
export interface DashboardData {
  classroomSource?: "browser" | "api";
  schoolSyncMode?: "cloud" | "local";
  demo: boolean;
  now: string;
  assignments: Assignment[];
  courses: Course[];
  lunch: { child: Child; balance: number | null; observedAt: string | null }[];
  integrations: Integration[];
  changes: Change[];
  unavailable?: boolean;
}
