"use client";
import {
  ShieldCheck,
  BookOpen,
  GraduationCap,
  LockKeyhole,
  Database,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { SCHOOL_TIMEZONE } from "@/lib/dates";
import type { DashboardData } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataWarning, PageHeading, RefreshButton } from "./shared";
import { errorDescription } from "@/lib/integrations/google-policy";
export function Settings({
  data,
  connectedChild,
  connectionError,
}: {
  data: DashboardData;
  connectedChild?: string;
  connectionError?: string;
}) {
  const date = (value: string | null) =>
    value
      ? formatInTimeZone(value, SCHOOL_TIMEZONE, "MMM d, yyyy · h:mm a")
      : "Not yet";
  return (
    <>
      <PageHeading
        eyebrow="YOUR FAMILY WORKSPACE"
        title="Connections & settings"
        description="Know where your data comes from and when it was last checked."
        action={<RefreshButton />}
      />
      <DataWarning data={data} />
      <p className="connection-notice">Using the iMac collector? Double-click Refresh Now.command to collect school data manually, or enable its hourly schedule. Then select Reload dashboard here to see the imported results. The website cannot start a collector on your Mac.</p>
      {data.schoolSyncMode === "cloud" ? <p className="connection-notice">Refresh signs into the school websites on the server. Keep this page open while each connection runs. Extra verification or blocked sign-ins stop the refresh; saved data is preserved. Genesis remains the source for official grades and lunch balances.</p> : data.classroomSource === "browser" && (
        <p className="connection-notice">
          Classroom uses the Chrome extension. Open Classroom in the child’s
          browser and select Sync Classroom. Refresh data here cannot read
          another browser. Only observed work is imported; official course
          grades and lunch balances still come from Genesis.
        </p>
      )}
      {connectedChild && (
        <p role="status" className="connection-notice">
          {connectedChild}’s account is connected. Select Refresh to verify
          courses, assignments, and submissions.
        </p>
      )}
      {connectionError && (
        <p role="alert" className="error-note">
          {errorDescription(connectionError)}
        </p>
      )}
      <div className="settings-layout">
        <section>
          <h2 className="settings-label">School connections</h2>
          <p className="muted settings-description">
            Classroom for daily work. Genesis for official grades and lunch
            balances.
          </p>
          <div className="integration-cards">
            {data.integrations.map((i) => (
              <section className="panel integration-card" key={i.id}>
                <div className="integration-title">
                  <span
                    className={`integration-icon ${i.id === "genesis" ? "genesis-icon" : ""}`}
                  >
                    {i.id === "genesis" ? (
                      <GraduationCap size={23} />
                    ) : (
                      <BookOpen size={23} />
                    )}
                  </span>
                  <div>
                    <h3>{i.label}</h3>
                    <p>
                      {i.id === "genesis"
                        ? "Grades, missing work & lunch balances"
                        : "Courses, assignments & submission status"}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {i.status === "NOT_CONNECTED"
                      ? i.mode === "browser"
                        ? "Awaiting import"
                        : "Not connected"
                      : i.status === "SUCCESS" || i.status === "CONNECTED"
                        ? i.mode === "browser"
                          ? "Imported"
                          : "Connected"
                        : i.status === "FAILED"
                          ? "Needs attention"
                          : "Syncing"}
                  </Badge>
                </div>
                {i.accountEmail && (
                  <p className="connected-account">
                    School account: {i.accountEmail}
                  </p>
                )}
                <div className="integration-times">
                  <div>
                    <span>Last attempt</span>
                    <strong>{date(i.lastAttempt)}</strong>
                  </div>
                  <div>
                    <span>Last successful sync</span>
                    <strong>{date(i.lastSuccess)}</strong>
                  </div>
                </div>
                {i.error && (
                  <p role="alert" className="integration-error">
                    {i.error}
                  </p>
                )}
                {i.counts && (
                  <p className="sync-counts">
                    Last run: {i.counts.retrieved} records retrieved ·{" "}
                    {i.counts.created} added · {i.counts.updated} updated ·{" "}
                    {i.counts.snapshots} history changes
                  </p>
                )}
                <div className="integration-footer">
                  <p>
                    {data.schoolSyncMode === "cloud" ? "Refresh from this website; your computer does not need to run a collector." : i.id === "genesis"
                      ? "Synced by the local collector on your computer."
                      : i.mode === "browser"
                        ? "Sync visible Classroom pages using the KidsDashboard Chrome extension."
                        : i.connected
                          ? "Use the same school account when reconnecting."
                          : "Choose this child’s school Google account."}
                  </p>
                  <div className="integration-actions">
                    {data.schoolSyncMode === "cloud" && (i.id === "genesis" || i.mode === "browser") ? <RefreshButton source={i.id === "genesis" ? "genesis" : `google/${i.id === "google-e" ? "e" : "a"}`} label="Refresh" /> : i.id === "genesis" ? (
                      <Button variant="outline" disabled>
                        Local collector sync
                      </Button>
                    ) : i.mode === "browser" ? (
                      <span className="muted">Local or extension sync</span>
                    ) : (
                      <>
                        {i.connected && (
                          <RefreshButton
                            source={`google/${i.id === "google-e" ? "e" : "a"}`}
                            label="Refresh"
                          />
                        )}
                        <form
                          action={`/api/integrations/google/${i.id === "google-e" ? "e" : "a"}/connect`}
                          method="post"
                        >
                          <Button
                            variant="outline"
                            type="submit"
                            disabled={!i.canConnect || data.demo}
                          >
                            {i.connected
                              ? "Reconnect"
                              : `Connect ${i.id === "google-e" ? "Eric" : "Ada"}`}
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>
        <aside>
          <section className="panel privacy-panel">
            <ShieldCheck size={25} />
            <h2>Private by design</h2>
            <p>
              School information is visible only after an approved parent signs
              in.
            </p>
            <div className="privacy-item">
              <LockKeyhole size={17} />
              <span>Read-only school connections</span>
            </div>
            <div className="privacy-item">
              <Database size={17} />
              <span>History stays in your database</span>
            </div>
            <div className="privacy-item">
              <ShieldCheck size={17} />
              <span>{data.schoolSyncMode === "cloud" ? "School credentials stay in server-side secrets" : "School credentials stay on your computer"}</span>
            </div>
          </section>
          <section className="panel phase-panel">
            <p className="eyebrow">BUILD STATUS</p>
            <h3>
              {data.schoolSyncMode === "cloud" ? "Cloud refresh" : data.classroomSource === "browser"
                ? "Classroom browser imports"
                : "Google Classroom is ready to connect"}
            </h3>
            <p>
              {data.schoolSyncMode === "cloud" ? "Select Refresh to collect school data from the server. If Google requires a manual sign-in check, the Chrome extension remains available to import visible Classroom work." : data.classroomSource === "browser"
                ? "Choose the child and their expected school email in the extension, then sync from their signed-in Classroom tab. Missing or unrecognized fields preserve saved values. Set CLASSROOM_SOURCE=api on the server to restore OAuth when available."
                : "Start with Eric, then refresh to verify his courses and work. Connect Ada after that. Official course averages and lunch balances will come from Genesis."}
            </p>
            {data.demo && (
              <p className="sample-note">
                You’re viewing fictional data. No school account has been
                accessed.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
