import { formatInTimeZone } from "date-fns-tz";
import { SCHOOL_TIMEZONE } from "./dates";

export function lunchBalanceLabel(
  observedAt: string | null,
  demo: boolean,
): string {
  if (demo) return "Sample data";
  if (!observedAt) return "Waiting for school data";
  return `Balance last changed ${formatInTimeZone(observedAt, SCHOOL_TIMEZONE, "MMM d, h:mm a")}`;
}
