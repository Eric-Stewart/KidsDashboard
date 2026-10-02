"use client";
import { childName } from "@/lib/children";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { Assignment, Course, DashboardData } from "@/lib/types";
import { SCHOOL_TIMEZONE } from "@/lib/dates";
import {
  AssignmentDetail,
  AssignmentList,
  ChildAvatar,
  DataWarning,
  Empty,
  PageHeading,
} from "./shared";
function Trend({ course }: { course: Course }) {
  const points = course.history.filter(
    (p): p is typeof p & { percentage: number } => p.percentage != null,
  );
  if (points.length < 2)
    return (
      <p className="trend-empty">A trend appears after two grade changes.</p>
    );
  const min = Math.max(0, Math.min(...points.map((p) => p.percentage)) - 3);
  const max = Math.max(...points.map((p) => p.percentage)) + 3;
  const start = new Date(points[0].date).getTime();
  const span = Math.max(1, new Date(points.at(-1)!.date).getTime() - start);
  const coords = points.map((p) => ({
    x: 10 + ((new Date(p.date).getTime() - start) / span) * 300,
    y: 73 - ((p.percentage - min) / (max - min)) * 58,
    ...p,
  }));
  return (
    <div className="trend">
      <svg
        viewBox="0 0 320 88"
        role="img"
        aria-label={`${course.name} grade history: ${points.map((p) => `${formatInTimeZone(p.date, SCHOOL_TIMEZONE, "MMM d")}: ${p.percentage}%`).join(", ")}`}
      >
        <path d="M10 73H310 M10 44H310 M10 15H310" className="chart-grid" />
        <polyline
          points={coords.map((p) => `${p.x},${p.y}`).join(" ")}
          className={`chart-line chart-${course.child.toLowerCase()}`}
        />
        {coords.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3.5"
            className={`chart-point chart-${course.child.toLowerCase()}`}
          >
            <title>
              {formatInTimeZone(p.date, SCHOOL_TIMEZONE, "MMM d")}:{" "}
              {p.percentage}%
            </title>
          </circle>
        ))}
      </svg>
      <div className="trend-dates">
        <span>
          {formatInTimeZone(points[0].date, SCHOOL_TIMEZONE, "MMM d")}
        </span>
        <span>
          {formatInTimeZone(points.at(-1)!.date, SCHOOL_TIMEZONE, "MMM d")}
        </span>
      </div>
    </div>
  );
}
export function Grades({ data }: { data: DashboardData }) {
  const params = useSearchParams();
  const [child, setChild] = useState(
    params.get("child") === "A"
      ? "A"
      : params.get("child") === "E"
        ? "E"
        : "both",
  );
  const [selected, setSelected] = useState<Assignment | null>(null);
  const courses = data.courses.filter(
    (c) => child === "both" || c.child === child,
  );
  return (
    <>
      <PageHeading
        eyebrow="PROGRESS, OVER TIME"
        title="More than a single grade."
        description="Current course grades, recent work, and the direction things are moving."
      />
      <DataWarning data={data} />
      <div className="grades-topline">
        <div
          className="child-filter"
          role="group"
          aria-label="Filter grades by child"
        >
          {["both", "E", "A"].map((value) => (
            <button
              key={value}
              aria-pressed={child === value}
              className={child === value ? "selected" : ""}
              onClick={() => setChild(value)}
            >
              {value === "both" ? "Both children" : childName(value)}
            </button>
          ))}
        </div>
        <span className="muted small">
          {data.demo
            ? "Sample grade history"
            : "Stored grade history · Changes only"}
        </span>
      </div>
      {courses.length ? (
        <div className="grades-grid">
          {courses.map((course) => {
            const last = course.history.at(-1);
            const previous = course.history.at(-2);
            const delta =
              last?.percentage != null && previous?.percentage != null
                ? last.percentage - previous.percentage
                : null;
            const recent = data.assignments
              .filter((a) => a.courseId === course.id && a.status === "GRADED")
              .sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""))
              .slice(0, 3);
            return (
              <section
                key={`${course.id}-${course.period}`}
                className="panel grade-card"
              >
                <div className="grade-card-heading">
                  <div>
                    <p className="eyebrow">{course.period}</p>
                    <h2>{course.name}</h2>
                    <p className="muted small">
                      {course.teacher || "Teacher not provided"}
                    </p>
                  </div>
                  <ChildAvatar child={course.child} />
                </div>
                <div className="grade-number">
                  <strong>
                    {last?.percentage != null
                      ? `${last.percentage}%`
                      : last?.grade || "—"}
                  </strong>
                  {last?.percentage != null && last.grade && (
                    <span className="letter-grade">{last.grade}</span>
                  )}
                  {delta !== null && (
                    <span
                      className={`grade-delta ${delta < 0 ? "down" : "up"}`}
                    >
                      {delta > 0 ? (
                        <TrendingUp size={16} />
                      ) : delta < 0 ? (
                        <TrendingDown size={16} />
                      ) : (
                        <Minus size={16} />
                      )}{" "}
                      {delta > 0 ? "+" : ""}
                      {Number(delta.toFixed(2))} pts
                    </span>
                  )}
                </div>
                <Trend course={course} />
                <details className="history-details">
                  <summary>
                    View grade snapshots ({course.history.length})
                  </summary>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Grade</th>
                        <th>Percent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.history.map((p, i) => (
                        <tr key={i}>
                          <td>
                            {formatInTimeZone(
                              p.date,
                              SCHOOL_TIMEZONE,
                              "MMM d, yyyy",
                            )}
                          </td>
                          <td>{p.grade || "—"}</td>
                          <td>
                            {p.percentage ?? "—"}
                            {p.percentage != null ? "%" : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
                <div className="recent-work">
                  <h3>Recent graded work</h3>
                  {recent.length ? (
                    <AssignmentList
                      items={recent}
                      now={data.now}
                      onSelect={setSelected}
                      compact
                    />
                  ) : (
                    <p className="muted small">
                      No graded assignments available yet.
                    </p>
                  )}
                </div>
                <div className="grade-source">
                  {course.source === "GENESIS"
                    ? "Genesis · Official course grade"
                    : "Classroom · Available course grade"}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Your grade history starts here"
          text="Course grades and trends will appear after connecting your school accounts."
        />
      )}
      <AssignmentDetail
        assignment={selected}
        now={data.now}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
