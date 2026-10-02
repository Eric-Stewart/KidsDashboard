// Public constants only. Safe diagnostic text contains no upstream response bodies.
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
] as const;
export const GOOGLE_METHODS = [
  "oauth.authorize",
  "oauth.token",
  "openid.verify",
  "courses.list",
  "courses.courseWork.list",
  "courses.courseWork.studentSubmissions.list",
] as const;
export type GoogleMethod = (typeof GOOGLE_METHODS)[number];
export const ERROR_REASONS = [
  "BROWSER_SYNC_REQUIRED",
  "BROWSER_SYNC_FAILED",
  "NOT_CONFIGURED",
  "NOT_CONNECTED",
  "ACCESS_DENIED",
  "API_DISABLED",
  "SCOPE_MISSING",
  "PERMISSION_DENIED",
  "ACCOUNT_RESTRICTED",
  "RECONNECT_REQUIRED",
  "ACCOUNT_IN_USE",
  "ACCOUNT_CHANGED",
  "USE_STUDENT_ACCOUNT",
  "INVALID_STATE",
  "INVALID_IDENTITY",
  "INVALID_RESPONSE",
  "RATE_LIMITED",
  "NOT_FOUND",
  "UNAVAILABLE",
  "TIMEOUT",
  "DATABASE_ERROR",
  "BUSY",
  "INTERRUPTED",
  "LEASE_EXPIRED",
  "GENESIS_PENDING",
  "LOCAL_COLLECTOR_REQUIRED",
] as const;
export type ErrorReason = (typeof ERROR_REASONS)[number];
export class IntegrationError extends Error {
  constructor(
    public reason: ErrorReason,
    public method?: GoogleMethod,
  ) {
    super(method ? `${reason}:${method}` : reason);
    this.name = "IntegrationError";
  }
}
export function errorCode(error: unknown) {
  return error instanceof IntegrationError ? error.message : "DATABASE_ERROR";
}
export function errorDescription(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  const [reason, method] = code.split(":");
  const descriptions: Record<ErrorReason, string> = {
    BROWSER_SYNC_FAILED: "The school browser refresh did not complete. Try Refresh for details; saved data is preserved.",
    BROWSER_SYNC_REQUIRED:
      "Open Google Classroom in the child’s Chrome profile and use Sync Classroom in the KidsDashboard extension.",
    NOT_CONFIGURED:
      "The connection needs its Google settings, callback URL, and encryption key configured.",
    NOT_CONNECTED:
      "Connect this child’s school Google account before refreshing.",
    ACCESS_DENIED:
      "Google authorization was cancelled or denied. No account was connected.",
    API_DISABLED:
      "Enable Google Classroom API in the Google Cloud project, then refresh again.",
    SCOPE_MISSING:
      "Google did not grant the required read-only permission. Reconnect and allow the requested Classroom permissions.",
    PERMISSION_DENIED:
      "Google denied this API request. The app cannot determine whether the cause is a school policy or account access; ask the school administrator to check this app and permission.",
    ACCOUNT_RESTRICTED:
      "Google reported an account or administrator policy restriction. The school administrator must review access.",
    RECONNECT_REQUIRED:
      "Google authorization expired or was revoked. Reconnect the same school account.",
    ACCOUNT_IN_USE:
      "That Google account is already connected to the other child. Select this child’s own account.",
    ACCOUNT_CHANGED:
      "Reconnect using the original school account. Switching accounts is blocked to protect existing assignment history.",
    USE_STUDENT_ACCOUNT:
      "Select the child’s school account, rather than your parent sign-in account.",
    INVALID_STATE:
      "This connection request expired or belongs to another browser or parent session. Start again from Settings.",
    INVALID_IDENTITY:
      "Google’s identity response could not be verified. No account was connected.",
    INVALID_RESPONSE:
      "Google returned an incomplete or unexpected response. Previously saved data was preserved.",
    RATE_LIMITED:
      "Google temporarily limited requests. Wait a few minutes and try again.",
    NOT_FOUND:
      "Google could not find a requested course or assignment. Previously saved data was preserved.",
    UNAVAILABLE:
      "Google is temporarily unavailable. Previously saved data was preserved.",
    TIMEOUT:
      "The sync took too long. Previously saved data was preserved; try again.",
    DATABASE_ERROR:
      "The connection or sync could not be saved. Check the database and try again.",
    BUSY: "A refresh is already running for this child. Try again after it finishes.",
    INTERRUPTED:
      "The previous sync was interrupted. Previously saved data was preserved.",
    LEASE_EXPIRED:
      "This sync expired before saving. Previously saved data was preserved.",
    GENESIS_PENDING:
      "Run the local collector to refresh Genesis.",
    LOCAL_COLLECTOR_REQUIRED:
      "Run the local collector on your computer to refresh grades, assignments and lunch balances.",
  };
  if (!Object.hasOwn(descriptions, reason))
    return "The operation failed. Please try again.";
  const validMethod = GOOGLE_METHODS.find((m) => m === method);
  const scope =
    validMethod === "courses.list"
      ? GOOGLE_SCOPES[2]
      : validMethod?.startsWith("courses.courseWork")
        ? GOOGLE_SCOPES[3]
        : null;
  return `${descriptions[reason as ErrorReason]}${validMethod ? ` API: ${validMethod}.` : ""}${scope ? ` Required scope: ${scope}.` : ""}`;
}
