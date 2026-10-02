import {
  classroomLink,
  type BrowserCourse,
  type BrowserAssignment,
} from "../../lib/classroom-browser-schema";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
export type Observation = {
  email: string;
  courses: BrowserCourse[];
  assignments: BrowserAssignment[];
  links: string[];
  warnings: string[];
  pageUrl: string;
};
export function visible(element: Element): boolean {
  const win = element.ownerDocument.defaultView;
  if (element.closest('[hidden],[aria-hidden="true"]')) return false;
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    const style = win?.getComputedStyle(current);
    if (
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.opacity === "0" ||
      style?.contentVisibility === "hidden"
    )
      return false;
  }
  return true;
}
const text = (element: Element | null): string => {
  if (
    !element ||
    !visible(element) ||
    ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(element.tagName)
  )
    return "";
  if (typeof (element as HTMLElement).innerText === "string")
    return (element as HTMLElement).innerText.trim();
  // Semantic fallback for non-HTMLElement nodes; never include hidden descendants.
  return [...element.childNodes]
    .map((n) =>
      n.nodeType === 3
        ? n.textContent || ""
        : n.nodeType === 1
          ? text(n as Element)
          : "",
    )
    .join("\n")
    .trim();
};
const lines = (element: Element) =>
  text(element)
    .split(/\n/)
    .map((t) => t.trim())
    .filter(Boolean);
export function visibleDate(value: string, now: Date): string | undefined {
  const v = value.trim().replace(/^(?:Due|Posted|Assigned)\s*:?[ ]*/i, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(v) &&
    Number.isFinite(Date.parse(v))
  )
    return new Date(v).toISOString();
  // Locale is deliberately explicit. Never infer a year from an abbreviated calendar label.
  const m = v.match(
    /^(?:(Today|Tomorrow|Yesterday)|(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4}))(?:,?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(AM|PM)?)?$/i,
  );
  if (!m) return;
  let day: string;
  if (m[1]) {
    const d = new Date(
      `${formatInTimeZone(now, "America/New_York", "yyyy-MM-dd")}T12:00:00Z`,
    );
    d.setUTCDate(
      d.getUTCDate() +
        { today: 0, tomorrow: 1, yesterday: -1 }[m[1].toLowerCase()]!,
    );
    day = d.toISOString().slice(0, 10);
  } else {
    const month =
      [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ].indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    day = `${m[4]}-${String(month).padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    if (new Date(day).toISOString().slice(0, 10) !== day) return;
  }
  if (!m[5]) return day;
  let hour = Number(m[5]);
  const minute = Number(m[6]);
  if (minute > 59 || (m[7] ? hour < 1 || hour > 12 : hour > 23)) return;
  if (m[7]) hour = (hour % 12) + (m[7].toUpperCase() === "PM" ? 12 : 0);
  const local = `${day}T${String(hour).padStart(2, "0")}:${m[6]}:00`;
  const result = fromZonedTime(local, "America/New_York");
  if (
    formatInTimeZone(result, "America/New_York", "yyyy-MM-dd'T'HH:mm:ss") !==
    local
  )
    return;
  return result.toISOString();
}
function fields(
  scope: Element,
  now: Date,
  warnings: string[],
  detail = false,
): Partial<BrowserAssignment> {
  const result: Partial<BrowserAssignment> = {};
  // Read rendered text and semantic time elements only. No scripts, hidden JSON, or app state.
  let rows = lines(scope).slice(0, 150);
  const comments = rows.findIndex((s) =>
    /^(?:Class comments|Private comments)$/i.test(s),
  );
  if (comments >= 0) rows = rows.slice(0, comments);
  const workIndex = rows.findIndex((s) => /^Your work$/i.test(s));
  const work = workIndex >= 0 ? rows.slice(workIndex + 1) : detail ? [] : rows;
  const states: Record<string, BrowserAssignment["status"]> = {
    assigned: "assigned",
    missing: "missing",
    "turned in": "turned_in",
    returned: "returned",
  };
  const statuses = [
    ...new Set(
      work
        .filter((s) => Object.hasOwn(states, s.toLowerCase()))
        .map((s) => states[s.toLowerCase()]),
    ),
  ];
  if (statuses.length === 1) result.status = statuses[0];
  for (const [label, key] of [
    ["Due", "dueAt"],
    ["Assigned|Posted", "assignedAt"],
  ] as const) {
    const row = rows.find((s) =>
      new RegExp(`^(?:${label})[: ]+\\S`, "i").test(s),
    );
    if (row) {
      const parsed = visibleDate(row, now);
      if (parsed) result[key] = parsed;
      else
        warnings.push(
          `A ${key} label was ambiguous; the stored value will be preserved.`,
        );
    }
    for (const time of scope.querySelectorAll("time[datetime]")) {
      if (!visible(time)) continue;
      const labelText =
        time.getAttribute("aria-label") || text(time.parentElement);
      if (new RegExp(`^(?:${label})\\b`, "i").test(labelText.trim())) {
        const parsed = visibleDate(time.getAttribute("datetime") || "", now);
        if (parsed) result[key] = parsed;
      }
    }
  }
  if (rows.some((s) => /^No due date$/i.test(s))) result.dueAt = null;
  const points = rows
    .map((s) => s.match(/^(\d+(?:\.\d+)?)\s+points?$/i))
    .find(Boolean);
  if (points) result.pointsPossible = Number(points[1]);
  const grade = work
    .map(
      (s) =>
        s.match(
          /^(?:Grade:\s*)?(\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?(?:\s+points?)?|\d+(?:\.\d+)?%)$/i,
        ) || s.match(/^Grade:\s*([A-F][+-]?|Ungraded)$/i),
    )
    .find(Boolean);
  if (grade) {
    result.currentGrade = /^Ungraded$/i.test(grade[1])
      ? null
      : grade[1].replace(/\s+points?$/i, "");
    const total = grade[1].match(/\/\s*(\d+(?:\.\d+)?)/);
    if (total) result.pointsPossible = Number(total[1]);
  }
  return result;
}
export function extractPage(
  doc: Document,
  pageUrl: string,
  now = new Date(),
): Observation {
  if (new URL(pageUrl).origin !== "https://classroom.google.com")
    throw new Error("NOT_LOGGED_IN");
  const accountElements = [
    ...doc.querySelectorAll("[aria-label],[title]"),
  ].filter(
    (e) =>
      visible(e) &&
      /Google Account:/i.test(
        `${e.getAttribute("aria-label") || ""} ${e.getAttribute("title") || ""}`,
      ),
  );
  const emails = [
    ...new Set(
      accountElements
        .flatMap(
          (e) =>
            `${e.getAttribute("aria-label") || ""} ${e.getAttribute("title") || ""}`.match(
              /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
            ) || [],
        )
        .map((e) => e.toLowerCase()),
    ),
  ];
  if (emails.length !== 1) throw new Error("ACCOUNT_NOT_VISIBLE");
  const result: Observation = {
    email: emails[0],
    courses: [],
    assignments: [],
    links: [],
    warnings: [],
    pageUrl,
  };
  const anchors = [
    ...doc.querySelectorAll<HTMLAnchorElement>("a[href]"),
  ].filter(visible);
  const courses = new Map<string, BrowserCourse>();
  for (const anchor of anchors) {
    const parsed = classroomLink(anchor.href);
    if (!parsed || parsed.assignmentId) continue;
    const name = lines(anchor)[0];
    if (
      !name ||
      /^(Home|Stream|Classwork|People|Grades|View class)$/i.test(name)
    )
      continue;
    courses.set(parsed.courseId, {
      externalCourseId: parsed.courseId,
      name,
      sourceUrl: parsed.url,
    });
  }
  const current = classroomLink(pageUrl);
  if (current && courses.has(current.courseId)) {
    const main = doc.querySelector('main,[role="main"]') || doc.body;
    const teacher = main
      ? lines(main)
          .map((line) => line.match(/^Teacher:\s*(.{1,200})$/i)?.[1])
          .find(Boolean)
      : undefined;
    const visibleAuthor = main
      ? [...main.querySelectorAll('[itemprop="author"] [itemprop="name"]')]
          .filter(visible)
          .map(text)
      : [];
    const name =
      teacher || (visibleAuthor.length === 1 ? visibleAuthor[0] : undefined);
    if (name) courses.get(current.courseId)!.teacherName = name;
  }
  for (const anchor of anchors) {
    const parsed = classroomLink(anchor.href);
    if (!parsed?.assignmentId || !courses.has(parsed.courseId)) continue;
    const title = lines(anchor)[0];
    if (!title || /^(View assignment|View instructions|Open)$/i.test(title))
      continue;
    const container = anchor.closest('article,[role="listitem"],li');
    const scoped =
      container &&
      [...container.querySelectorAll("a[href]")].filter(
        (a) => classroomLink((a as HTMLAnchorElement).href)?.assignmentId,
      ).length === 1
        ? fields(container, now, result.warnings)
        : {};
    result.assignments.push({
      externalCourseId: parsed.courseId,
      externalAssignmentId: parsed.assignmentId,
      title,
      sourceUrl: parsed.url,
      ...scoped,
    });
  }
  if (current?.assignmentId && courses.has(current.courseId)) {
    const main = doc.querySelector('main,[role="main"]') || doc.body;
    const headings = main
      ? [
          ...main.querySelectorAll('h1,[role="heading"][aria-level="1"]'),
        ].filter(visible)
      : [];
    if (main && headings.length === 1) {
      const title = text(headings[0]);
      if (title) {
        result.assignments = result.assignments.filter(
          (a) =>
            a.externalAssignmentId !== current.assignmentId ||
            a.externalCourseId !== current.courseId,
        );
        result.assignments.push({
          externalCourseId: current.courseId,
          externalAssignmentId: current.assignmentId,
          title,
          sourceUrl: current.url,
          ...fields(main, now, result.warnings, true),
        });
      }
    }
  }
  for (const anchor of anchors) {
    let url: URL;
    try {
      url = new URL(anchor.href);
    } catch {
      continue;
    }
    if (url.origin !== "https://classroom.google.com") continue;
    // Navigate only links actually rendered, restricted to class/work pages. Never submit forms.
    if (
      /^\/(?:u\/\d+\/)?(?:c|w)\/[\w-]+(?:\/(?:a|sa)\/[\w-]+\/details|\/t\/all)?\/?$/.test(
        url.pathname,
      )
    ) {
      url.hash = "";
      url.search = "";
      result.links.push(url.href);
    }
  }
  result.courses = [...courses.values()];
  result.links = [...new Set(result.links)];
  if (
    current?.assignmentId &&
    !result.assignments.some(
      (a) =>
        a.externalAssignmentId === current.assignmentId &&
        a.externalCourseId === current.courseId,
    )
  )
    result.warnings.push("An assignment page was not recognized; its saved fields were preserved.");
  if (!result.assignments.length)
    result.warnings.push(
      "No assignment details were recognized on this page. Open a class or assignment, expand/scroll visible work, and sync again.",
    );
  if (!result.courses.length && !result.assignments.length)
    throw new Error("STRUCTURE_NOT_RECOGNIZED");
  result.warnings = [...new Set(result.warnings)];
  return result;
}
