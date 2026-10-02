import type { Assignment, Course, DashboardData } from "./types";
import { addDays, format } from "date-fns";
import { atSchoolTime, dayKey } from "./dates";
export function makeDemo(now = new Date().toISOString()): DashboardData {
  const base = new Date(`${dayKey(now)}T12:00:00Z`);
  const date = (offset: number) =>
    atSchoolTime(format(addDays(base, offset), "yyyy-MM-dd"));
  const courseRows = [
    ["e-math", "E", "Mathematics", "Ms. Rivera", [91, 89, 87, 90]],
    ["e-english", "E", "English Language Arts", "Mr. Chen", [88, 90, 91, 93]],
    ["e-science", "E", "Science", "Ms. Patel", [94, 94, 92, 94]],
    ["a-math", "A", "Mathematics", "Mr. Wilson", [92, 93, 95, 95]],
    ["a-science", "A", "Science", "Ms. Brooks", [87, 88, 87, 90]],
    ["a-history", "A", "Social Studies", "Ms. Garcia", [90, 91, 92, 92]],
  ] as const;
  const courses: Course[] = courseRows.map(
    ([id, child, name, teacher, points]) => ({
      id,
      child,
      name,
      teacher,
      source: "GENESIS",
      period: "Marking period 1",
      history: points.map((percentage, i) => ({
        date: date(-21 + i * 7),
        percentage,
        grade: percentage >= 90 ? "A−" : "B+",
      })),
    }),
  );
  const rows: [
    string,
    string,
    number,
    Assignment["status"],
    Assignment["type"],
    number | null,
    number | null,
  ][] = [
    [
      "e-math",
      "Solving two-step equations",
      -3,
      "MISSING",
      "ASSIGNMENT",
      null,
      20,
    ],
    [
      "e-english",
      "Reading journal · Chapter 4",
      -1,
      "MISSING",
      "ASSIGNMENT",
      null,
      10,
    ],
    [
      "a-science",
      "Ecosystems field notes",
      0,
      "DUE_SOON",
      "ASSIGNMENT",
      null,
      20,
    ],
    ["e-science", "The water cycle", 0, "DUE_SOON", "ASSIGNMENT", null, 15],
    ["a-math", "Fractions practice", 0, "DUE_SOON", "ASSIGNMENT", null, 10],
    ["e-math", "Unit 2 assessment", 1, "UPCOMING", "TEST", null, 100],
    ["a-history", "Community map", 2, "UPCOMING", "PROJECT", null, 50],
    [
      "e-english",
      "Personal narrative · First draft",
      3,
      "UPCOMING",
      "PROJECT",
      null,
      50,
    ],
    ["a-science", "Food webs quiz", 4, "UPCOMING", "TEST", null, 25],
    ["e-science", "Lab reflection", 6, "UPCOMING", "ASSIGNMENT", null, 20],
    ["a-math", "Equivalent fractions", 8, "UPCOMING", "ASSIGNMENT", null, 20],
    [
      "e-english",
      "Independent reading response",
      10,
      "UPCOMING",
      "ASSIGNMENT",
      null,
      10,
    ],
    ["e-math", "Expressions exit ticket", -4, "GRADED", "ASSIGNMENT", 18, 20],
    ["e-english", "Character analysis", -4, "GRADED", "ASSIGNMENT", 28, 30],
    ["a-science", "Habitats investigation", -2, "GRADED", "ASSIGNMENT", 27, 30],
    ["a-math", "Number patterns", -2, "GRADED", "ASSIGNMENT", 19, 20],
    ["a-history", "Our neighborhood", -1, "SUBMITTED", "ASSIGNMENT", null, 20],
  ];
  const assignments: Assignment[] = rows.map(
    (
      [courseId, title, offset, status, type, pointsEarned, pointsPossible],
      i,
    ) => {
      const course = courses.find((c) => c.id === courseId)!;
      return {
        id: `demo-${i}`,
        child: course.child,
        courseId,
        course: course.name,
        title,
        description:
          type === "TEST"
            ? "Review class notes and the study guide before the assessment."
            : type === "PROJECT"
              ? "Complete the draft and check the assignment rubric before submitting."
              : "Complete the assigned work and submit it to your teacher. This is sample content for the dashboard preview.",
        dueDate: date(offset),
        dueDateOnly: true,
        assignedDate: date(offset - 7),
        status,
        type,
        pointsEarned,
        pointsPossible,
        grade:
          pointsEarned != null && pointsPossible
            ? (pointsEarned / pointsPossible) * 100
            : null,
        sources: [
          {
            source:
              status === "MISSING" || status === "GRADED"
                ? "GENESIS"
                : "GOOGLE_CLASSROOM",
            url: null,
          },
        ],
      };
    },
  );
  return {
    demo: true,
    now,
    courses,
    assignments,
    lunch: [
      { child: "E", balance: 18.42, observedAt: now },
      { child: "A", balance: 9.75, observedAt: now },
    ],
    integrations: [
      {
        id: "google-e",
        label: "Google Classroom · Eric",
        status: "NOT_CONNECTED",
        lastAttempt: null,
        lastSuccess: null,
      },
      {
        id: "google-a",
        label: "Google Classroom · Ada",
        status: "NOT_CONNECTED",
        lastAttempt: null,
        lastSuccess: null,
      },
      {
        id: "genesis",
        label: "Genesis Parent Portal",
        status: "NOT_CONNECTED",
        lastAttempt: null,
        lastSuccess: null,
      },
    ],
    changes: [
      {
        id: "1",
        child: "E",
        text: "Mathematics changed from 87% to 90%",
        date: now,
        kind: "grade",
      },
      {
        id: "2",
        child: "A",
        text: "Science changed from 87% to 90%",
        date: now,
        kind: "grade",
      },
      {
        id: "3",
        child: "E",
        text: "Reading journal marked missing",
        date: now,
        kind: "missing",
      },
    ],
  };
}
