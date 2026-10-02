# Foundation architecture and review checkpoint

## Request boundary

All school pages live in the private route group. Its layout verifies the parent session, and the data-access layer independently verifies it before any database operation. This avoids relying solely on layout or proxy checks. API handlers independently authenticate and enforce same-origin POST requests. Auth.js supplies encrypted, HttpOnly session cookies, CSRF protection for authentication, and Google OAuth. No school token is returned in a session or UI data object.

`lib/data.ts` maps database records to explicit safe view models. Raw payloads, external IDs, OAuth connections, credentials, and cookies are not serialized. Genesis links are reduced to the portal entry URL so student IDs do not enter client data. Source links permit only known HTTPS school hosts. No student data is placed in browser storage, public metadata, or static output. Authenticated responses are private/no-store.

Production fails closed without authentication configuration. A missing database yields a visible unavailable state rather than sample records. The mock-data path exists only in local development. Secrets belong in ignored environment files or Vercel environment settings, never `NEXT_PUBLIC_*`.

## Storage model

- `Child`: E and A only. Student IDs remain server configuration for the later connector.
- `Course`: source-specific identity, child, external ID, and school year. A grade period is unique within each course.
- `Assignment`: canonical view; course/child consistency is enforced by a composite foreign key.
- `AssignmentSource`: unique child/source/external ID; preserved raw payload and source URL. Child/assignment consistency is enforced by another composite foreign key.
- `SourceRevision`: retain changed source payloads without overwriting their historical provenance.
- `AssignmentHistory`: full tracked state and score at a change, tied to its sync run.
- `CourseGrade` and `CourseGradeSnapshot`: latest grade per period and its append-only changes.
- `LunchBalanceSnapshot`: currency stored as Decimal, never a floating-point DB amount.
- `OAuthConnection`: only encrypted refresh-token storage; one account per child/provider and one child per provider/account. Encryption implementation and token writes are Phase 2 work.
- `DataSource` and `SyncRun`: individual source health, timing, counts, and allowlisted error codes.
- `ReconciliationDecision`: future manual link/split audit. Reconciliation is not automatically applied yet.

Changed-only history must compare against the **latest** snapshot, not global historical fingerprints. A → B → A produces three records. First appearance creates the first snapshot; unchanged re-syncs create none. `lib/history.ts` defines assignment comparison fields. One snapshot per entity/run is enforced in SQL. Ingestion that uses this comparison is Phase 2/4 work, not yet implemented.

## Required ingestion invariants for the next phase

1. Each source runs independently, so a failed Genesis run cannot prevent E or A Classroom runs.
2. Acquire a source-specific PostgreSQL advisory lock, or equivalent database lease, before ingestion. Do not rely on in-memory locks in Vercel functions.
3. Fetch external data without holding a database transaction. Fully paginate and validate it before publication. Never infer deletion from a failed/partial response.
4. Persist source revisions, canonical updates, changed-only snapshots, counters, and last-success timestamps atomically. Use a consistent observed timestamp per run. Failed runs retain previously successful data.
5. Store only safe error codes. Never log upstream responses that may contain school records, tokens, cookies, passwords, or session identifiers.
6. Course matching is child/source/year aware. Assignment matching requires child, course mapping, title, due/assigned dates, and points. Ambiguous matches remain separate; manual decisions are auditable and reversible.
7. Genesis is authoritative for official grades/missing work; Classroom supplies assignment detail and submission state. Conflicts must preserve both source payloads rather than silently discard evidence.

## Date and change semantics

Dates render in America/New_York. Date-only assignments become overdue after the school day ends, not at an invented midnight or arbitrary UTC time. Upcoming view covers today through the following 13 days. Week counts cover today through Sunday. Completed/submitted assignments are excluded from urgency calculations. Missing assignments with no due date remain urgent.

The UI can read historical changes from each source's latest successful sync. Failed attempts do not erase its last successful changes. Comparison uses stored snapshots; no AI-generated interpretations. Grade charts are time-spaced and also available as accessible snapshot tables. They use a focused vertical range and should be read alongside the percentage values.

## Verification limits

The initial SQL migration runs successfully in embedded PostgreSQL; constraints and history cases are tested. Live Neon connectivity, a real seed run, parent Google OAuth, classroom permissions, Genesis behavior, sync transactions/concurrency, token encryption, cron authentication, and production deployment still require their respective phases. No assertion of production readiness is made before those checks.
