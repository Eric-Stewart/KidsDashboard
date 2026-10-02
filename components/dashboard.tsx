"use client";
import { childName } from "@/lib/children";
import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  Wallet,
  Sparkles,
  CircleCheck,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { Card, CardContent } from "@/components/ui/card";
import type { Assignment, DashboardData } from "@/lib/types";
import {
  dayDistance,
  openAssignment,
  urgency,
  SCHOOL_TIMEZONE,
  schoolDay,
} from "@/lib/dates";
import { endOfWeek, differenceInCalendarDays } from "date-fns";
import {
  AssignmentDetail,
  AssignmentList,
  ChildAvatar,
  DataWarning,
  Empty,
  FilterBar,
  filtered,
  initialFilters,
  PageHeading,
  RefreshButton,
} from "./shared";
export function Dashboard({ data }: { data: DashboardData }) {
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const attention = data.assignments
    .filter((a) => urgency(a, data.now) < 9)
    .sort(
      (a, b) =>
        urgency(a, data.now) - urgency(b, data.now) ||
        (a.dueDate || "").localeCompare(b.dueDate || ""),
    );
  const upcoming = filtered(data.assignments, filters)
    .filter(
      (a) =>
        a.dueDate &&
        dayDistance(a.dueDate, data.now) >= 0 &&
        dayDistance(a.dueDate, data.now) < 14,
    )
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const weekDaysLeft = differenceInCalendarDays(
    endOfWeek(schoolDay(data.now), { weekStartsOn: 1 }),
    schoolDay(data.now),
  );
  return (
    <>
      <PageHeading
        eyebrow={formatInTimeZone(data.now, SCHOOL_TIMEZONE, "EEEE, MMMM d")}
        title="The school day, at a glance."
        description="A clear view of what matters for Eric and Ada."
        action={<RefreshButton />}
      />
      <DataWarning data={data} />
      <div className="summary-grid">
        {(["E", "A"] as const).map((child) => {
          const known =
            data.demo ||
            data.integrations.some(
              (i) =>
                i.lastSuccess &&
                (i.id === "genesis" ||
                  i.id === `google-${child.toLowerCase()}`),
            );
          const items = data.assignments.filter(
            (a) => a.child === child && openAssignment(a),
          );
          const missing = items.filter((a) => a.status === "MISSING").length;
          const today = items.filter(
            (a) => a.dueDate && dayDistance(a.dueDate, data.now) === 0,
          ).length;
          const week = items.filter(
            (a) =>
              a.dueDate &&
              dayDistance(a.dueDate, data.now) >= 0 &&
              dayDistance(a.dueDate, data.now) <= weekDaysLeft,
          ).length;
          const lunch = data.lunch.find((l) => l.child === child);
          return (
            <Card
              key={child}
              className={`summary-card child-${child.toLowerCase()}`}
            >
              <CardContent>
                <div className="summary-top">
                  <div className="summary-name">
                    <ChildAvatar child={child} />
                    <div>
                      <h2>{childName(child)}’s overview</h2>
                      <p>
                        {!known
                          ? "Waiting for school data"
                          : missing
                            ? `${missing} assignments need a follow-up`
                            : "No missing assignments reported"}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/grades?child=${child}`}
                    aria-label={`View ${childName(child)}'s grades`}
                    className="icon-link"
                  >
                    <ArrowUpRight size={20} />
                  </Link>
                </div>
                <div className="summary-stats">
                  <div>
                    <span className={missing ? "attention-number" : ""}>
                      {known ? missing : "—"}
                    </span>
                    <span>Missing</span>
                  </div>
                  <div>
                    <span>{known ? today : "—"}</span>
                    <span>Due today</span>
                  </div>
                  <div>
                    <span>{known ? week : "—"}</span>
                    <span>Rest of week</span>
                  </div>
                  <div className="lunch-stat">
                    <span>
                      {lunch?.balance == null
                        ? "—"
                        : new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                          }).format(lunch.balance)}
                    </span>
                    <span>
                      <Wallet size={13} /> Lunch balance
                    </span>
                  </div>
                </div>
                <div className="summary-foot">
                  <span>
                    {data.demo
                      ? "Sample data"
                      : lunch?.observedAt
                        ? `Lunch updated ${formatInTimeZone(lunch.observedAt, SCHOOL_TIMEZONE, "MMM d, h:mm a")}`
                        : "Waiting for school data"}
                  </span>
                  <span>{childName(child)} · School overview</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section className="panel attention-panel">
            <div className="section-heading">
              <div>
                <span className="section-icon attention-icon">
                  <AlertCircle size={19} />
                </span>
                <h2>Needs attention</h2>
                <span className="count-pill">{attention.length}</span>
              </div>
              <span className="section-hint">A good place to start</span>
            </div>
            {attention.length ? (
              <AssignmentList
                items={attention}
                now={data.now}
                onSelect={setSelected}
              />
            ) : (
              <Empty
                title="All caught up"
                text="No missing or urgent assignments are currently reported."
              />
            )}
          </section>
          <section className="panel coming-up">
            <div className="section-heading">
              <div>
                <span className="section-icon">
                  <CalendarDays size={19} />
                </span>
                <h2>Coming up</h2>
              </div>
              <Link href="/calendar" className="text-link">
                Open calendar <ArrowUpRight size={14} />
              </Link>
            </div>
            <p className="section-description">
              The next 14 days, together in one place.
            </p>
            <FilterBar data={data} value={filters} onChange={setFilters} />
            {upcoming.length ? (
              <AssignmentList
                items={upcoming}
                now={data.now}
                onSelect={setSelected}
                compact
              />
            ) : (
              <Empty
                title="No assignments in this view"
                text="Try another filter, or check back after the next sync."
              />
            )}
          </section>
        </div>
        <aside className="dashboard-secondary">
          <section className="panel changes-panel">
            <div className="section-heading">
              <div>
                <span className="section-icon">
                  <Sparkles size={18} />
                </span>
                <h2>Since last sync</h2>
              </div>
            </div>
            <p className="section-description">
              The little changes worth knowing.
            </p>
            {data.changes.length ? (
              <div className="change-list">
                {data.changes.map((change) => (
                  <div className="change" key={change.id}>
                    <ChildAvatar child={change.child} small />
                    <div>
                      <p>{change.text}</p>
                      <span>
                        {data.demo
                          ? "Sample change"
                          : formatInTimeZone(
                              change.date,
                              SCHOOL_TIMEZONE,
                              "MMM d, h:mm a",
                            )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No changes yet"
                text="Updates will appear after your first successful sync."
              />
            )}
            <div className="panel-foot">
              {data.demo
                ? "Preview of your change history"
                : "From each source’s latest successful sync"}
            </div>
          </section>
          <section className="panel sources-panel">
            <div className="section-heading">
              <div>
                <CircleCheck size={18} />
                <h2>Data connections</h2>
              </div>
            </div>
            {data.integrations.map((i) => (
              <div className="source-row" key={i.id}>
                <span>{i.label}</span>
                <span
                  className={`connection-state ${i.status === "SUCCESS" ? "connected" : ""}`}
                >
                  {i.status === "SUCCESS" || i.status === "CONNECTED"
                    ? "Connected"
                    : i.status === "FAILED"
                      ? "Needs attention"
                      : i.status === "RUNNING"
                        ? "Syncing"
                        : "Not connected"}
                </span>
              </div>
            ))}
            <Link href="/settings" className="sources-link">
              Manage connections <ArrowUpRight size={15} />
            </Link>
          </section>
          <div className="quiet-note">
            <BookNote />{" "}
            <p>A missing assignment is a place to start a conversation.</p>
          </div>
        </aside>
      </div>
      <AssignmentDetail
        assignment={selected}
        now={data.now}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
function BookNote() {
  return <span className="note-line" />;
}
