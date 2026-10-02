# Vercel deployment

Project: `eric-stewart/kidsdashboard`  
Assigned production domain: `https://kidsdashboard-eight.vercel.app`

## Account setup

The project is deployed. Production migrations have been applied, and the existing school records and history were transferred with per-table count verification. The local database remains intact.

1. Neon marketplace terms have been accepted. The project uses `kidsdashboard-db` on the `free_v3` plan in `iad1`, with Neon Auth disabled and the production environment connected. Use `--no-env-pull` to avoid changing the local database settings.
2. The user approved uploading the parent OAuth credentials, parent allowlist, dashboard session secret, and ingestion key; these are configured as Vercel production secrets. The prepared `scripts/configure-vercel-production.mjs` supplies values over stdin and prints only names. It does not read `.config` or upload school passwords.
3. Add `https://kidsdashboard-eight.vercel.app/api/auth/callback/google` to the Google web client's Authorized redirect URIs. Retain localhost for local use.

## Publish and verify

Pull production database settings to a separate ignored `.env.vercel.production.local`, never over `.env.local`. Apply Prisma migrations and seed E/A against the hosted database with explicit production environment values; verify the target is hosted first. Preserve the existing local database and its historical records. Transfer school records and snapshots only to this project database, without local credentials or session material.

Publish with `vercel --prod` after production settings and database are ready. Verify signed-out pages redirect to login, both import endpoints return 401 without an ingestion key, and the approved parent can sign in. No demo login is allowed in production.

The user requested cloud login. Production now uses `SCHOOL_SYNC_MODE=cloud` with school credentials in sensitive Vercel environment variables. The website Refresh button runs the cloud collector; see [cloud refresh](cloud-refresh.md). The local collector and Chrome extension remain optional fallbacks, pointed at the production origin.

`.vercelignore` explicitly excludes `.config*`, `.env*`, temporary school discovery files, local collector code, generated files, and local artifacts. Required database migrations remain part of the application source.

## Verified production behavior

The login page responds successfully; protected dashboard pages redirect signed-out visitors to login; both ingestion routes reject anonymous requests with HTTP 401. Production compiled successfully. The local collector now targets the production origin. Parent Google sign-in must be completed by the user to confirm the external OAuth callback configuration.
