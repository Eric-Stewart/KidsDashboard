# Refresh on Vercel

Set `SCHOOL_SYNC_MODE=cloud` and `CLASSROOM_SOURCE=browser` on the Vercel production project. Refresh runs Genesis, Eric's Classroom, and Ada's Classroom as separate requests. Keep the page open until the progress message finishes. Each request has a five-minute function limit and closes its browser after at most 250 seconds. A database lease prevents duplicate runs for the same connection, with a one-minute retry cooldown.

Store these as sensitive **server-side** environment variables, never `NEXT_PUBLIC_` variables:

- `GENESIS_USERNAME`, `GENESIS_PASSWORD`
- `GENESIS_STUDENT_E`, `GENESIS_STUDENT_A`
- `CLASSROOM_E_USERNAME`, `CLASSROOM_E_PASSWORD`
- `CLASSROOM_A_USERNAME`, `CLASSROOM_A_PASSWORD`

Changing environment variables requires a new deployment. `scripts/configure-cloud-secrets.mjs` performs the initial upload from the private `.config` without printing values. The configuration file itself is excluded from deployment. Local collection remains available with `SCHOOL_SYNC_MODE=local`. `CLASSROOM_SOURCE=api` retains the original Classroom OAuth integration.

The server uses isolated, temporary browser contexts and normal visible login forms. It does not persist or export school cookies, tokens, browser profiles, screenshots, or page dumps. CAPTCHA, MFA, unknown identity providers, wrong accounts, and blocked sign-ins stop collection. No automatic credential retries or authentication workarounds are used. A successful Classroom run covers only observed pages; collapsed or unvisited work is not guaranteed complete. The extension remains a fallback for an already authenticated student browser.

Imports use the existing deduplication and historical snapshots; Genesis remains authoritative for official grades. Failed extraction preserves saved data. Lunch balances come from the Genesis Summary page.

The website uses the parent's authenticated session and same-origin POST protection. Optional service verification uses a separate random `SCHOOL_SYNC_KEY` bearer token, together with the website Origin header, against `/api/sync/genesis`, `/api/sync/google/e`, or `/api/sync/google/a`. This key is not the extension ingestion key and must never be put in the extension or browser settings.

## Production verification — October 2, 2026

Both Classroom accounts completed cloud refresh and their success timestamps were verified in the production database. Genesis returned HTTP 405 from its initial login page before any credentials were submitted. Its existing data is preserved, but cloud Genesis refresh requires the portal to permit normal access from the hosted browser. Do not use stealth flags, copied browser cookies, or CAPTCHA workarounds. Parent sign-in and the Refresh buttons use the same server collector verified by the separate service credential; the parent's actual OAuth sign-in remains a user verification step.
