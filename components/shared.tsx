"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { childName } from "@/lib/children";
import {
  RefreshCw,
  ExternalLink,
  CalendarDays,
  BookOpen,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateLabel, overdue, SCHOOL_TIMEZONE } from "@/lib/dates";
import { formatInTimeZone } from "date-fns-tz";
import type { Assignment, Child, DashboardData, Status } from "@/lib/types";
export const statusLabels: Record<Status, string> = {
  UPCOMING: "Upcoming",
  DUE_SOON: "Due soon",
  SUBMITTED: "Submitted",
  GRADED: "Graded",
  MISSING: "Missing",
  LATE: "Late",
  UNKNOWN: "Unknown",
};
export function ChildAvatar({
  child,
  small = false,
}: {
  child: Child;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar ${child.toLowerCase()} ${small ? "small-avatar" : ""}`}
      aria-label={childName(child)}
    >
      {childName(child)}
    </span>
  );
}
export function StatusBadge({
  assignment,
  now,
}: {
  assignment: Assignment;
  now: string;
}) {
  const label =
    assignment.status === "MISSING"
      ? "Missing"
      : overdue(assignment, now)
        ? "Overdue"
        : statusLabels[assignment.status];
  return (
    <Badge
      variant="outline"
      className={`status-badge status-${label.toLowerCase().replace(" ", "-")}`}
    >
      {label}
    </Badge>
  );
}
export function RefreshButton({
  source,
  label = "Refresh schools",
  disabled = false,
}: {
  source?: string;
  label?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [reloading, startReload] = useTransition();
  async function refresh() {
    setPending(true);
    setMessage("");
    try {
      const sources=source?[source]:["genesis","google/e","google/a"];
      const names:Record<string,string>={genesis:"Genesis","google/e":"Eric’s Classroom","google/a":"Ada’s Classroom"};
      const messages:string[]=[];
      for(const connection of sources){
        setMessage(`Refreshing ${names[connection]||connection}… This can take a few minutes. Keep this page open.`);
        try {
          const response=await fetch(`/api/sync/${connection}`,{method:"POST"});
          const result=await response.json();
          messages.push(`${names[connection]||connection}: ${result.message||result.error||"Refresh unavailable."}`);
          router.refresh();
          if(response.status===401||response.status===403)break;
        }catch{messages.push(`${names[connection]||connection}: Could not reach the server. Try again later.`);}
      }
      setMessage(messages.join(" "));
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="refresh-wrap">
      {!source && <Button variant="outline" disabled={reloading || pending} onClick={()=>startReload(()=>router.refresh())}>
        <RefreshCw size={15} className={reloading ? "spin" : ""} />
        {reloading ? "Reloading…" : "Reload dashboard"}
      </Button>}
      <Button
        variant="outline"
        onClick={refresh}
        disabled={pending || disabled}
      >
        <RefreshCw size={15} className={pending ? "spin" : ""} />
        {pending ? "Refreshing…" : label}
      </Button>
      {message && (
        <p role="status" className="refresh-message">
          {message}
        </p>
      )}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function DataWarning({ data }: { data: DashboardData }) {
  return data.unavailable ? (
    <div className="error-note" role="alert">
      <AlertCircle size={18} /> School data is unavailable. Check your database
      connection in Settings; no sample data is being substituted.
    </div>
  ) : null;
}
export function Empty({
  title = "Nothing here yet",
  text = "Connected school data will appear here.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <CheckCheck size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export type Filters = {
  child: string;
  course: string;
  status: string;
  type: string;
};
export const initialFilters: Filters = {
  child: "both",
  course: "all",
  status: "all",
  type: "all",
};
export function filtered(items: Assignment[], filters: Filters) {
  return items.filter(
    (a) =>
      (filters.child === "both" || a.child === filters.child) &&
      (filters.course === "all" || a.courseId === filters.course) &&
      (filters.status === "all" || a.status === filters.status) &&
      (filters.type === "all" || a.type === filters.type),
  );
}
export function FilterBar({
  data,
  value,
  onChange,
  calendar = false,
}: {
  data: DashboardData;
  value: Filters;
  onChange: (value: Filters) => void;
  calendar?: boolean;
}) {
  const courses = data.courses
    .filter((c, i, all) => all.findIndex((other) => other.id === c.id) === i)
    .filter((c) => value.child === "both" || c.child === value.child);
  return (
    <div className="filter-bar">
      <div className="child-filter" role="group" aria-label="Filter by child">
        {["both", "E", "A"].map((child) => (
          <button
            key={child}
            aria-pressed={value.child === child}
            className={value.child === child ? "selected" : ""}
            onClick={() => onChange({ ...value, child, course: "all" })}
          >
            {child === "both" ? (
              "Both children"
            ) : (
              <>
                <span className={`filter-dot ${child.toLowerCase()}`} />
                {childName(child)}
              </>
            )}
          </button>
        ))}
      </div>
      <div className="filter-selects">
        <Select
          value={value.course}
          onValueChange={(course) => onChange({ ...value, course })}
        >
          <SelectTrigger
            aria-label="Filter by course"
            className="course-select"
          >
            <SelectValue placeholder="All courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {childName(c.child)} · {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {calendar ? (
          <Select
            value={value.type}
            onValueChange={(type) => onChange({ ...value, type })}
          >
            <SelectTrigger aria-label="Filter by assignment type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="ASSIGNMENT">Assignments</SelectItem>
              <SelectItem value="TEST">Tests</SelectItem>
              <SelectItem value="PROJECT">Projects</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={value.status}
            onValueChange={(status) => onChange({ ...value, status })}
          >
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(statusLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
export function AssignmentDetail({
  assignment: a,
  now,
  onClose,
}: {
  assignment: Assignment | null;
  now: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!a}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="assignment-dialog">
        {a && (
          <>
            <DialogHeader>
              <div className="detail-course">
                <ChildAvatar child={a.child} small />
                {a.course}
              </div>
              <DialogTitle>{a.title}</DialogTitle>
              <DialogDescription>
                Assignment details ·{" "}
                {a.sources
                  .map((s) =>
                    s.source === "GENESIS" ? "Genesis" : "Google Classroom",
                  )
                  .join(" & ")}
              </DialogDescription>
            </DialogHeader>
            <div className="detail-meta">
              <StatusBadge assignment={a} now={now} />
              <span>
                <CalendarDays size={16} />
                {a.dueDate
                  ? formatInTimeZone(
                      a.dueDate,
                      SCHOOL_TIMEZONE,
                      a.dueDateOnly
                        ? "EEEE, MMMM d, yyyy"
                        : "EEEE, MMMM d, yyyy · h:mm a zzz",
                    )
                  : "No due date"}
              </span>
            </div>
            <p className="detail-description">
              {a.description || "No description provided by the school."}
            </p>
            <dl className="detail-grid">
              <div>
                <dt>Assignment type</dt>
                <dd>
                  {a.type === "TEST"
                    ? "Test / quiz"
                    : a.type === "PROJECT"
                      ? "Project"
                      : "Assignment"}
                </dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>
                  {a.currentGrade ??
                    `${a.pointsEarned ?? "—"} / ${a.pointsPossible ?? "—"}`}
                </dd>
              </div>
            </dl>
            {a.sources
              .filter((s) => s.url)
              .map((s) => (
                <Button asChild key={s.source} variant="outline">
                  <a href={s.url!} target="_blank" rel="noopener noreferrer">
                    Open in {s.source === "GENESIS" ? "Genesis" : "Classroom"}
                    <ExternalLink size={15} />
                  </a>
                </Button>
              ))}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function AssignmentList({
  items,
  now,
  onSelect,
  compact = false,
}: {
  items: Assignment[];
  now: string;
  onSelect: (a: Assignment) => void;
  compact?: boolean;
}) {
  return (
    <div className={`assignment-list ${compact ? "compact" : ""}`}>
      {items.map((a) => (
        <button
          key={a.id}
          className="assignment-row"
          onClick={() => onSelect(a)}
        >
          <ChildAvatar child={a.child} small />
          <div className="assignment-main">
            <span className="assignment-course">
              {a.course}
              {a.type !== "ASSIGNMENT" && (
                <span className="type-label">
                  {a.type === "TEST" ? "Test" : "Project"}
                </span>
              )}
            </span>
            <strong>{a.title}</strong>
            <span className="source-label">
              <BookOpen size={12} />
              {a.sources
                .map((s) => (s.source === "GENESIS" ? "Genesis" : "Classroom"))
                .join(" + ")}
            </span>
          </div>
          <div className="assignment-end">
            {a.pointsEarned != null && (
              <span className="score-label">
                {a.pointsEarned} / {a.pointsPossible ?? "—"}
              </span>
            )}
            <StatusBadge assignment={a} now={now} />
            <span className="due-label">{dateLabel(a.dueDate, now)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
