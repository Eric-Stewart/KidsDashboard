import { createHash, timingSafeEqual } from "node:crypto";
export function validIngestKey(
  header: string | null,
  secret = process.env.KIDS_DASHBOARD_INGEST_KEY,
): boolean {
  if (
    !secret ||
    secret.length < 32 ||
    !header ||
    header.length > 512 ||
    !header.startsWith("Bearer ")
  )
    return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}
