export function classroomSource(): "browser" | "api" {
  return process.env.CLASSROOM_SOURCE === "api" ? "api" : "browser";
}
