# External integration checkpoints

## Current Classroom source: browser

`CLASSROOM_SOURCE=browser` is the default and is configured locally. The Manifest V3 package in `classroom-extension` sends visible-page observations to the bearer-key-protected `/api/classroom/import` endpoint. See [extension setup and limits](../classroom-extension/README.md). The district's OAuth restriction is still in place; this feature does not grant Google API access or alter school policies. Extension installation and normal Classroom access must already be permitted.

The local migration and isolated import checks have been verified. Partial observations preserve previously stored fields, stale observations cannot overwrite newer ones, and absent records are retained. Browser-source records use existing dashboard/calendar/history views and never create official course-grade snapshots. Set `CLASSROOM_SOURCE=api` to enable the retained API route; browser ingestion then refuses imports. Live extraction on the child's actual Classroom pages remains unverified because the browser inspection tool failed to initialize. No undocumented Google endpoints are used.

The prompt explicitly requires a Phase 1 UI/database review before connecting external systems. No school system was accessed during foundation work.

## Phase 2: Google Classroom

Implemented a separate child OAuth authorization-code flow with PKCE, verified Google ID-token nonce/audience/issuer, parent and browser binding, ten-minute one-use state, and an exact configured callback. Refresh tokens use authenticated AES-256-GCM encryption with a 32-byte key, random nonce, and child/account-bound associated data. Same-account reconnects preserve an existing refresh token when Google omits one. Access tokens remain server-side. Selecting the parent account, switching an existing child's account, or assigning one account to both children is rejected.

Scopes are `openid`, `email`, `classroom.courses.readonly`, and `classroom.coursework.me.readonly` (the Classroom names have the `https://www.googleapis.com/auth/` prefix). The latter authorizes both coursework and the student's own submissions. Every list response is fully paginated. The request sequence is active courses with `studentId=me`, published coursework per course, and `courseWork/-/studentSubmissions` with `userId=me`. No roster/teacher/write scopes are requested.

Documented methods: [courses.list](https://developers.google.com/workspace/classroom/reference/rest/v1/courses/list), [courseWork.list](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/list), [studentSubmissions.list](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork.studentSubmissions/list).

Due dates and times are interpreted together in UTC, including empty midnight time objects. Published assigned grades are used; draft grades are ignored. RETURNED with an assigned grade maps to GRADED; RETURNED without one remains SUBMITTED. Reclaimed late work maps to LATE, never inferred MISSING. Missing submissions remain UNKNOWN. Titles never imply test/project type. Classroom course averages, school year, and teacher names are not invented. Raw payload revisions preserve upstream details, including submission history, server-side.

Local callback: `http://localhost:3000/api/integrations/google/callback`. Enable Classroom API, register this callback, and complete Eric's consent and first refresh before Ada's. Live courses/coursework/submissions have not yet been verified. Generic permission failures do not establish which school policy caused the denial. Safe diagnostics identify the method and scope; explicit policy reason codes are reported as restrictions. No guessed requests are substituted.

Parent Google login is separate and already scaffolded with only identity scopes. It does not authorize Classroom access.

## Phase 3: Genesis discovery before implementation

The supplied weekly-summary URLs are navigation references, not evidence of API endpoints. Student IDs are intentionally excluded from the client and checked-in configuration templates.

With an authorized parent session:

1. Inspect network requests for weekly summaries, course detail, assignment pages, and cafeteria balances. Identify whether responses are JSON, HTML, or an export.
2. Document the actual login form/action, CSRF fields, session cookies, expiration/renewal, redirects, required headers, and shared parent-session behavior.
3. Confirm one parent session can access both children. Use only the two configured IDs.
4. Test authenticated server HTTP requests and compare them with the portal. Prefer these over HTML parsing. If HTML is necessary, capture sanitized fixtures and confirm exact field semantics before writing selectors.
5. Only use Playwright if direct requests cannot reproduce documented authorized behavior. Do not bypass MFA/CAPTCHA or security controls. Require a user-completed login if those controls intervene.

Do not save raw HAR files with credentials, cookies, or children's data into this repository. Record redacted endpoint/field descriptions instead. `lib/integrations/genesis.ts` is intentionally inactive until this evidence exists.

## Phase 4: Sync and Cron

Manual Classroom refresh is implemented on all requested POST route shapes. Source runs are independent. Complete snapshots are saved atomically with changed-only history and raw revisions. Concurrent refreshes are prevented with expiring per-child database leases; interrupted runs recover on the next attempt. Partial fetch or persistence failures preserve saved data and last-success time. Records absent from a complete active-course snapshot are hidden without deleting history. Genesis reports pending rather than pretending to refresh. Cron is still inactive.

Vercel Cron uses GET requests, so add a dedicated `/api/cron/sync` GET endpoint with constant-time verification of `Authorization: Bearer <CRON_SECRET>`. Reject missing configuration and malformed credentials before any source call. Do not expose a public GET alias for manual sync. Choose a supported schedule after checking the Vercel plan and timezone behavior. Keep schedule inactive until live integrations pass.

## Phase 5

Review token/key handling, session authorization, rejected-user access, source failures, stale-data indicators, mobile behavior, secrets in generated client assets, database constraints, cron authorization, and deployment configuration. Deploy to Vercel only with the required private access and runtime configuration in place.
