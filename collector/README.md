# Local school collector

For iMac installation, double-click manual refresh, and the optional hourly schedule, see [iMac setup](../docs/imac-setup.md). The Mac sends records to the hosted website; no local website or database is required. Website **Reload dashboard** loads the most recent imports.

From the repository directory:

```powershell
npm run collector:setup
npm run collector:check
npm run collector:run
```

Use installed Google Chrome. The configured destination is now https://kidsdashboard-eight.vercel.app; the local web server and Docker database are not required for hosted imports. If you switch the destination back to localhost, start both locally. The collector reads `.config`; copy `.config.example` on a new computer. Keep the `username` and `password` field names and place credentials in their values. JSON passwords containing backslashes or double quotes must be escaped. Never paste this file into chat or commit it. Setup preserves existing values and restricts the file to the current Windows user and SYSTEM. `.config` is plaintext protected by file permissions, not encrypted. The separate dashboard ingestion key is read from `.env.local`.

```powershell
npm run collector:run -- classroom --child E
npm run collector:run -- classroom --child A
npm run collector:run -- genesis
```

Each Classroom account uses a separate temporary Chrome context. Genesis signs in once and reads both configured student IDs. No Google or Genesis cookies, session tokens, profiles, screenshots or passwords are exported. CAPTCHA, MFA and unknown identity providers stop collection. There is one credential submission per account per run. Google may disallow automated sign-in; use the extension with a normally signed-in Classroom tab in that case. Do not work around an access restriction.

## Data and history

Classroom imports go to `/api/classroom/import`. Genesis imports go to `/api/genesis/import`. Both require the private ingestion bearer key and validate bounded JSON. The existing dashboard, calendar, grades and history show the imported records. Genesis remains authoritative for official course grades. The collector reads only the labeled Lunch Balance cell on Summary, not the surrounding personal-information fields.

Genesis uses the verified grade-summary tables, Course filter option IDs, and assignment description-control IDs for identity. Repeated runs update those same records. Changed assignment states and course grades append history; unchanged states do not append duplicate history. Both children's Genesis observations commit together, or neither does. Missing records in a partial collection are not deleted. School years run August through July; yearless Genesis due dates are interpreted within the current school year. No Grade is ungraded, not missing; only an explicit Missing label sets missing status. Grade labels, percentages and zero scores are retained.

Classroom observes rendered pages only and preserves unrecognized fields. Collapsed or unloaded work may be absent; imports are partial, not a guarantee of every assignment. It follows observed class/work links with a 100-page/four-minute limit. Use the extension after opening or expanding work to supplement coverage. Unknown account identity stops the import. Old Google API code remains available with `CLASSROOM_SOURCE=api`; local Classroom ingestion requires `browser`.

Genesis source links open the portal without exposing student IDs. School login details are never sent to the ingestion endpoints. The optional Chrome extension stores only its dashboard key and expected school email, not school passwords.

## Recovery

If the collector fails, previous database records remain. Read its safe error message, resolve the login or page-layout issue, and run the specific source again. A crashed run can leave `.collector.lock`; remove that exact file only after confirming no collector remains running. The optional iMac schedule must be enabled on that Mac. Website controls cannot launch Chrome on another computer; use the Mac launcher or schedule, then select Reload dashboard.
