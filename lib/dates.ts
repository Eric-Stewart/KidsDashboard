import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import type { Assignment } from "./types";
export const SCHOOL_TIMEZONE = "America/New_York";
export function dayKey(value: string | Date) {
  return formatInTimeZone(value, SCHOOL_TIMEZONE, "yyyy-MM-dd");
}
export function schoolDay(value: string | Date) {
  return parseISO(dayKey(value));
}
export function dayDistance(date: string, now: string) {
  return differenceInCalendarDays(schoolDay(date), schoolDay(now));
}
export function atSchoolTime(day: string, time = "15:00:00") {
  return fromZonedTime(`${day}T${time}`, SCHOOL_TIMEZONE).toISOString();
}
export function dateLabel(date: string | null, now: string) {
  if (!date) return "No due date";
  const diff = dayDistance(date, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatInTimeZone(date, SCHOOL_TIMEZONE, "EEE, MMM d");
}
export function openAssignment(a: Assignment) {
  return a.status !== "GRADED" && a.status !== "SUBMITTED";
}
export function overdue(a: Assignment, now: string) {
  return (
    openAssignment(a) &&
    !!a.dueDate &&
    (a.dueDateOnly
      ? dayDistance(a.dueDate, now) < 0
      : new Date(a.dueDate) < new Date(now))
  );
}
export function urgency(a: Assignment, now: string) {
  if (!openAssignment(a)) return 9;
  if (a.status === "MISSING") return 0;
  if (a.status === "LATE" || overdue(a, now)) return 1;
  if (a.dueDate && dayDistance(a.dueDate, now) === 0) return 2;
  if (a.dueDate && dayDistance(a.dueDate, now) === 1) return 3;
  return 9;
}
export function nextSchoolDate(now: string, offset: number) {
  return atSchoolTime(
    formatInTimeZone(addDays(schoolDay(now), offset), "UTC", "yyyy-MM-dd"),
  );
}
