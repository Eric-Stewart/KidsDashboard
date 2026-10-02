# KidsDashboard Classroom Sync

Chrome Manifest V3 extension for explicit, local collection of rendered Classroom pages. It never reads Google cookies, credentials, OAuth tokens, session storage, hidden application state, script payloads, or network responses. It uses no Classroom API and performs no Google login or security-control automation. If the district blocks installing or running extensions, stop and ask the administrator; this extension does not override those policies.

## Install and configure

1. In KidsDashboard, run `npm install`, `npm run db:generate`, `npm run db:migrate`, and `npm run extension:build`. Start the local PostgreSQL container and `npm run dev` as usual.
2. Set `CLASSROOM_SOURCE=browser` and `KIDS_DASHBOARD_INGEST_KEY` in `.env.local`. Browser mode and a random key have been configured in this workspace. Do not replace an existing key unless rotating it. Generate a new one, if needed, with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Never commit the key or use a `NEXT_PUBLIC_` variable.
3. In the child's Chrome profile, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `C:\Projects\KidsDashboard\classroom-extension\dist`. Pin **KidsDashboard Classroom Sync**. Reload any Classroom tabs that were open before installation.
4. Open the extension popup. Set the dashboard base URL (`http://localhost:3000` for Chrome on the same computer), select Eric/E or Ada/A, and enter the child's exact school Google email. Copy only `KIDS_DASHBOARD_INGEST_KEY` from your local configuration into the ingestion-key field. Save and grant permission for that dashboard address.
5. Sign into Classroom normally in that Chrome profile. Open a class or assignment page. The Google account button must expose the signed-in email in its visible accessibility label. The extension stops if that email differs from the configured child email or cannot be identified.
6. Open the popup while the Classroom tab is active and choose **Sync Classroom**. Optionally enable **Follow visible class and assignment links** first, then Save. This navigates the same tab through actual rendered links, up to 100 pages/four minutes. Keep the tab open and avoid navigating or changing accounts during collection. It never constructs hidden URLs or submits assignments.
7. Check the counts, warnings, and last successful sync in the popup, then reload the existing KidsDashboard dashboard/calendar. Repeat in Ada's Chrome profile with her settings. Changing the child clears the expected email to avoid accidental reuse.

The base URL must be HTTPS except for localhost/127.0.0.1. On a different computer, `localhost` means that computer, not the parent's computer. Use an appropriately secured reachable HTTPS deployment for multi-device use; this change does not deploy or expose the local server to the network.

## Scope and limitations

- This is a **partial observation import**, not a complete school inventory. It reads rendered links, headings, accessibility labels, semantic `time` elements, explicit labels, and visible work status. It does not crawl Google APIs or hidden data. Course/assignment identity comes from Classroom URLs, never title matching.
- Readable English labels and America/New_York date/time interpretation are supported. An explicit date with a year, ISO date/time, or Today/Tomorrow/Yesterday can be normalized. A yearless label such as “Oct 5” is ambiguous and is omitted with a warning unless a visible semantic date provides the year. Existing stored dates are preserved. Date-only values remain date-only in the UI.
- Only loaded, rendered work is collected. Expand or scroll Classroom normally and sync again to include additional work. Course cards with no recognized assignments are reported honestly. Unsupported assignment layouts fail clearly instead of producing invented records.
- Account matching reads the Google account control's accessibility label; it is not cryptographic Google identity verification. The ingestion key authorizes writes for either child, so only give it to trusted family browser profiles. Changing the selected child requires entering that child's email.
- Unknown/unseen fields are omitted and preserve saved values. Explicit “No due date” or “Ungraded” clears that field. Missing records never delete or hide saved work. Older/replayed observations do not overwrite newer observations.
- Numeric grades, percentages, fractions, and explicitly labeled letter grades are retained when visible. Classroom scores never create official course-average snapshots. Genesis remains authoritative.
- Browser course IDs that are base64-encoded numeric IDs are normalized to their exact numeric identity. Existing API assignments can be reused only on exact child/course/assignment ID matches. No title-based reconciliation occurs.
- The API integration remains in the repository. Set `CLASSROOM_SOURCE=api` and restart the server to restore OAuth/manual API refresh; browser imports return 409 in API mode. Browser mode suppresses automatic/manual Classroom API calls and displays extension instructions in Settings.

## Ingestion contract

`POST /api/classroom/import` with `Authorization: Bearer <KIDS_DASHBOARD_INGEST_KEY>` and `Content-Type: application/json`:

```json
{
  "child": "E",
  "courses": [
    {
      "externalCourseId": "123",
      "name": "Math",
      "sourceUrl": "https://classroom.google.com/c/123",
      "teacherName": "Ms Example"
    }
  ],
  "assignments": [
    {
      "externalCourseId": "123",
      "externalAssignmentId": "456",
      "title": "Worksheet",
      "sourceUrl": "https://classroom.google.com/c/123/a/456/details",
      "dueAt": "2026-10-05",
      "assignedAt": "2026-10-01",
      "status": "assigned",
      "pointsPossible": 10,
      "currentGrade": null
    }
  ],
  "extractedAt": "2026-10-01T20:22:00.000Z"
}
```

Optional fields must be omitted when not visible. `dueAt`/`assignedAt` accept an ISO timestamp with timezone or `YYYY-MM-DD`. Status is `assigned`, `missing`, `turned_in`, or `returned`; missing status means unknown/unobserved, not “assigned.” `currentGrade` is the visible score text. Up to 300 courses/3,000 assignments/2 MiB per request; extraction times must be within seven days and no more than five minutes ahead. Link IDs and parent course membership are validated. Unknown properties are rejected. Successful responses include `ok`, `retrieved`, `created`, `updated`, `snapshots`, and `ignored` counts.

No dashboard login cookie or Google credential is accepted as import authentication. The endpoint exposes no read API or permissive CORS policy. The extension worker makes the request using its narrowly granted dashboard host permission, with credentials omitted and redirects rejected. Content scripts cannot start imports or choose destinations. Keys/settings are stored only in `chrome.storage.local` restricted to trusted extension contexts, never synced to Google Chrome cloud storage. School records are held in memory for the collection; only counts/timestamps/errors are retained in extension storage.

## Storage mapping

Existing Course/Assignment models remain canonical. Course.externalId maps externalCourseId; AssignmentSource.externalId combines course/assignment IDs; dueDate/assignedDate map dueAt/assignedAt; pointsPossible already exists. Browser AssignmentSource.source is `GOOGLE_CLASSROOM_BROWSER`, mapped to PostgreSQL value `google_classroom_browser`. Course source stays the shared Classroom identity so switching transport need not duplicate courses. Course/source lastExtractedAt, source lastSeenAt, assignment firstSeenAt, source URLs, and textual currentGrade supplement existing fields. AssignmentHistory retains every significant transition, including a return to a prior state; SourceRevision preserves changed normalized observations. Imports are atomic and serialized per child.

## Verification status

No new automated test cases were added at the user's request. Local checks passed for extension compilation, production compilation, schema/migration agreement, ingestion-key rejection, protected dashboard pages, and secret exclusion from bundles. Disposable records in an isolated PostgreSQL schema verified deduplication, changed-only and returning-state history, zero grades, partial-field preservation, child isolation, and concurrent/stale imports. A synthetic semantic DOM check verified the extraction path and hidden-content exclusion. Temporary check artifacts were removed.

**The child's actual Classroom DOM and an installed Chrome extension still require live verification.** Browser inspection tooling was unavailable during implementation. Do not assume the illustrative supported semantic layouts cover every current Classroom view. An unsupported view should return a clear error; obtain a sanitized rendered layout before extending extraction rules.

References: [Chrome permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [extension storage access levels](https://developer.chrome.com/docs/extensions/reference/api/storage), [cross-origin extension requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).
