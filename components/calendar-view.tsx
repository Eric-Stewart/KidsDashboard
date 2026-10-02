"use client";
import { childName } from "@/lib/children";
import { useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Assignment, DashboardData } from "@/lib/types";
import { dayKey, schoolDay } from "@/lib/dates";
import { formatInTimeZone } from "date-fns-tz";
import { SCHOOL_TIMEZONE } from "@/lib/dates";
import {
  AssignmentDetail,
  DataWarning,
  FilterBar,
  filtered,
  initialFilters,
  PageHeading,
  statusLabels,
} from "./shared";
export function CalendarView({ data }: { data: DashboardData }) {
  const [filters, setFilters] = useState(initialFilters);
  const [view, setView] = useState("month");
  const [anchor, setAnchor] = useState(schoolDay(data.now));
  const [selected, setSelected] = useState<Assignment | null>(null);
  const start = startOfWeek(view === "month" ? startOfMonth(anchor) : anchor, {
    weekStartsOn: 1,
  });
  const end = endOfWeek(view === "month" ? endOfMonth(anchor) : anchor, {
    weekStartsOn: 1,
  });
  const days = eachDayOfInterval({ start, end });
  const items = filtered(data.assignments, filters);
  function move(amount: number) {
    setAnchor(
      view === "month" ? addMonths(anchor, amount) : addWeeks(anchor, amount),
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="THE DAYS AHEAD"
        title="One calendar. Both children."
        description="Assignments, tests, and projects — all on the same page."
      />
      <DataWarning data={data} />
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div className="calendar-period">
            <h2>
              {view === "month"
                ? format(anchor, "MMMM yyyy")
                : `${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d, yyyy")}`}
            </h2>
            <div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous period"
                onClick={() => move(-1)}
              >
                <ChevronLeft size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next period"
                onClick={() => move(1)}
              >
                <ChevronRight size={18} />
              </Button>
              <Button
                variant="outline"
                onClick={() => setAnchor(schoolDay(data.now))}
              >
                Today
              </Button>
            </div>
          </div>
          <Tabs value={view} onValueChange={setView}>
            <TabsList aria-label="Calendar view">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <FilterBar data={data} value={filters} onChange={setFilters} calendar />
        <div className="calendar-scroll">
          <div className={`calendar-grid ${view}`}>
            <div className="weekday-row">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="calendar-days">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const events = items
                  .filter((a) => a.dueDate && dayKey(a.dueDate) === key)
                  .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
                return (
                  <div
                    className={`calendar-day ${!isSameMonth(day, anchor) && view === "month" ? "outside" : ""} ${key === dayKey(data.now) ? "today" : ""}`}
                    key={key}
                  >
                    <span className="day-number">{format(day, "d")}</span>
                    <div className="day-events">
                      {events.map((a) => (
                        <button
                          key={a.id}
                          className={`calendar-event event-${a.child.toLowerCase()}`}
                          onClick={() => setSelected(a)}
                        >
                          <span className="event-top">
                            <strong>{childName(a.child)}</strong>
                            <span>{a.course}</span>
                          </span>
                          <span className="event-title">{a.title}</span>
                          {a.type !== "ASSIGNMENT" && (
                            <span className="event-status">
                              {a.type === "TEST" ? "Test" : "Project"}
                            </span>
                          )}
                          <span className="event-status">
                            {statusLabels[a.status]}
                            {!a.dueDateOnly &&
                              ` · ${formatInTimeZone(a.dueDate!, SCHOOL_TIMEZONE, "h:mm a zzz")}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="calendar-legend">
          <span>
            <i className="filter-dot e" /> Eric
          </span>
          <span>
            <i className="filter-dot a" /> Ada
          </span>
          <span>Select an assignment to see details</span>
        </div>
      </section>
      {items.some((a) => !a.dueDate) && (
        <p className="muted undated-note">
          {items.filter((a) => !a.dueDate).length} assignments have no due date
          and are not shown on the calendar.
        </p>
      )}
      <AssignmentDetail
        assignment={selected}
        now={data.now}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
