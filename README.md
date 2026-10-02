# Family School Dashboard

Private school overview for Eric and Ada (internal IDs E/A), built with Next.js App Router, TypeScript, Tailwind, shadcn/ui, Auth.js, Prisma, and PostgreSQL.

**Installing on an iMac?** Follow [iMac setup](docs/imac-setup.md). It includes a double-click manual refresh launcher and an optional hourly schedule that uploads to the existing hosted dashboard.

## Current scope

**Classroom browser collection is now the default.** The Chrome extension and `POST /api/classroom/import` feed the existing dashboard/calendar/history. Setup and the precise collection limits are in [classroom-extension/README.md](classroom-extension/README.md). The prior Google API flow remains available with `CLASSROOM_SOURCE=api`; no school OAuth request is made in browser mode. Both children's Classroom accounts have completed live imports. Coverage is partial where work is collapsed or its page layout is not recognized.

- Dashboard with urgency ordering, child summaries, lunch balances, 14-day filters, and change history.
- Month/week calendar with child, course, and type filters and assignment dialogs.
- Course grades, accessible trend charts, snapshot tables, and recent graded assignments.
- Protected routes and server-side data access. Google parent sign-in uses an explicit verified-email allowlist.
- PostgreSQL schema, initial migration, idempotent E/A seed, and history comparison rules.
- Clearly labeled **local-only fictional data**. It is never used as a production fallback.

The foundation has been reviewed. Local PostgreSQL is configured, migrated, and seeded. Classroom OAuth and manual refresh are implemented, including encrypted refresh tokens, complete pagination, per-child sync locks, atomic saves, and changed-only history. The API path still requires school approval. Genesis collection now imports official course grades, assignments and lunch balances through the local collector. Collection is manual; no background schedule is installed.

## Local school collection

Run `npm run collector:run` on this computer to sign in normally and import visible school data using the private `.config` file. See [collector/README.md](collector/README.md) for setup, limits, and recovery. School passwords never go to the dashboard server or extension.

## Local preview

Requires Node.js 22.12+ (tested on 24) and npm.

```sh
npm install
npm run db:generate
npm run dev
```

Open http://localhost:3000. `.env.local` must contain a random `AUTH_SECRET`, `AUTH_URL=http://localhost:3000`, and `DEMO_MODE=true` to show the local preview sign-in button. A local file has already been generated for this workspace. It is ignored by Git. On a fresh checkout, copy `.env.example` and generate a secret:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Never reuse a published/example secret. The preview server binds to loopback. `DEMO_MODE` only works with `NODE_ENV=development` and when `VERCEL` is absent. A production build cannot use the preview identity or sample data.

## PostgreSQL / Neon

For local development, start Docker Desktop and run:

```sh
npm run db:local:setup
npm run db:local:start
npm run db:migrate
npm run db:seed
```

The setup creates a random password in ignored `.env.local` and preserves any existing database settings. PostgreSQL 17 binds only to `127.0.0.1:5433`; the Docker volume retains data across container restarts. Use `npm run db:local:status` to check it and `npm run db:local:stop` to stop it without deleting records. Do not delete its volume unless you intend to erase the local database.

Local migration and E/A seeding have been verified. `DEMO_MODE=false` now selects this database and disables sample sign-in. School data remains empty until integrations are connected.

For hosted PostgreSQL, set `DATABASE_URL` to a connection string with TLS. Use Neon's pooled URL for runtime and `DIRECT_URL` for migrations if needed. Then:

```sh
npm run db:migrate
npm run db:seed
```

The seed inserts only E, A, and three source definitions. It never inserts fictional school records into the live database. The production Neon database is connected to Vercel, migrated, and populated from the verified local records. The SQL migration is tested against embedded PostgreSQL using PGlite.

## Parent authentication

Configure an OAuth web application in Google Cloud. Set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `AUTH_URL`, and comma-separated `PARENT_EMAILS`. Register the callback:

```text
http://localhost:3000/api/auth/callback/google
https://YOUR_DOMAIN/api/auth/callback/google
```

Only verified Google identities explicitly listed in `PARENT_EMAILS` are authorized. The allowlist is rechecked on protected requests. Parent login requests only identity scopes. Child Classroom authorization is a **separate Phase 2 flow** using the `GOOGLE_*` environment variables, never a side effect of parent sign-in.

Auth.js v5 is currently a prerelease dependency; it is pinned to the tested version. Parent credentials and the allowlist are configured in `.env.local`; complete Google sign-in at `/login` to verify the callback and account permissions. No live Google account has been accessed by the agent.

## Validation

```sh
npm test
npm run typecheck
npm run build
npm audit
```

Tests cover authentication boundaries, timezone/DST handling, changed-only history, encryption tampering, Classroom pagination and safe errors, and database constraints. To additionally test sync transactions, rollback, concurrent refresh prevention, and one-use OAuth state against local PostgreSQL, run `$env:RUN_POSTGRES_TESTS='1'; npm test` in PowerShell. This creates and drops only a randomly named test schema; it never changes the application's tables or calls school APIs.

## Connect Classroom locally

1. Keep Docker Desktop and `npm run dev` running, with `DEMO_MODE=false`.
2. In the Google Cloud project used by `GOOGLE_CLIENT_ID`, enable Google Classroom API. Add `http://localhost:3000/api/integrations/google/callback` to the web client's authorized redirect URIs, alongside the existing parent login callback.
3. If the OAuth app is in testing mode, add each child's school Google account as a test user. School administrator policies may still restrict authorization.
4. Confirm `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and a random 32-byte base64 `TOKEN_ENCRYPTION_KEY` exist in `.env.local`. The callback and key have been configured locally. Back up the encryption key securely; replacing it makes stored tokens unreadable.
5. Sign in as the approved parent, open `/settings`, select **Connect Eric**, and choose Eric's school account. On return, select **Refresh** and compare courses, assignments, and submission states with Classroom. Repeat for Ada after Eric's data is verified.

The app requests only identity and read-only course/coursework permissions. Settings reports the failed API method and required scope when available. It does not infer an administrator restriction from a generic permission error. Reconnecting must use the original child's account, protecting existing history from accidental account swaps.

## Vercel deployment

The website Refresh button supports server-side school login with `SCHOOL_SYNC_MODE=cloud`. No local collector command is needed in this mode. See [cloud refresh setup](docs/cloud-refresh.md) for secrets, runtime limits, and manual-verification handling.

1. Import this repository as a Next.js Vercel project; use `npm run build`.
2. Set production secrets in Vercel's environment settings. Do not upload `.env.local`. Use a stable `AUTH_SECRET`, correct HTTPS `AUTH_URL`, approved `PARENT_EMAILS`, Google parent OAuth settings, and Neon URLs. Keep `DEMO_MODE=false`.
3. Apply reviewed migrations against the production database with `npm run db:migrate`, then run the idempotent seed. Do not run schema-push against production.
4. Register the production Google callback. Verify an approved parent can sign in, an unapproved account is denied, and unauthenticated page/API requests cannot access data.
5. Complete Phases 2–4 and validate real school access before enabling a schedule. No Cron schedule is activated by this foundation.

See `docs/architecture.md` for storage/sync invariants and `docs/integrations.md` for the remaining integration work. The site is deployed at https://kidsdashboard-eight.vercel.app. Production database migrations and the initial school-data/history transfer are complete. See `docs/vercel-deployment.md` for configuration and verification details.

Implementation references: [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [Next.js data security](https://nextjs.org/docs/app/guides/data-security), [Prisma PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [shadcn/ui](https://ui.shadcn.com/docs/installation).
