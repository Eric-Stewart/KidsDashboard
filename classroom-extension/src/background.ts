import {
  browserImportSchema,
  mergeObserved,
  type BrowserCourse,
  type BrowserAssignment,
} from "../../lib/classroom-browser-schema";
import { validateSettings, settingsId, type Settings } from "./settings";
import type { Observation } from "./extractor";
const secureStorage = () =>
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
chrome.runtime.onInstalled.addListener(() => {
  void secureStorage();
});
chrome.runtime.onStartup.addListener(() => {
  void secureStorage();
});
let running = false;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messages: Record<string, string> = {
  NOT_LOGGED_IN:
    "Open Google Classroom and sign in normally with this child’s school account.",
  ACCOUNT_NOT_VISIBLE:
    "The signed-in Google email is not visible. Open Classroom in English and ensure the Google account button shows the school account. Nothing was imported.",
  WRONG_ACCOUNT:
    "Wrong Google account. Switch Classroom to the school email saved for this child, then retry.",
  STRUCTURE_NOT_RECOGNIZED:
    "Classroom page structure not recognized. Open a class or assignment page and retry. Nothing was imported.",
  INVALID_KEY:
    "Invalid ingestion key. Check the extension key against KIDS_DASHBOARD_INGEST_KEY.",
  API_UNAVAILABLE:
    "KidsDashboard API unavailable. Check its URL, server, database, and extension site permission.",
  IMPORT_REJECTED:
    "KidsDashboard rejected the import. Check browser source mode and update the extension; saved data is unchanged.",
  BUSY: "A sync is already running.",
  NAVIGATION_CHANGED:
    "Classroom changed unexpectedly. Keep this tab on the selected child’s Classroom pages during sync.",
};
async function read(tabId: number): Promise<Observation> {
  let last = "STRUCTURE_NOT_RECOGNIZED";
  let previous = "";
  for (let n = 0; n < 24; n++) {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url?.startsWith("https://classroom.google.com/"))
      throw new Error("NOT_LOGGED_IN");
    if (tab.status !== "complete") {
      await pause(500);
      continue;
    }
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "READ_VISIBLE_CLASSROOM",
      });
      if (response?.ok) {
        const signature = JSON.stringify(response.data);
        if (signature === previous) return response.data;
        previous = signature;
      } else last = response?.error || last;
    } catch {
      last = "STRUCTURE_NOT_RECOGNIZED";
    }
    await pause(500);
  }
  throw new Error(last);
}
async function sync(tabId: number) {
  if (running) throw new Error("BUSY");
  running = true;
  let configurationId = "";
  try {
    await secureStorage();
    const settings = validateSettings(
      (await chrome.storage.local.get("settings")).settings as Settings,
    );
    configurationId = settingsId(settings);
    const courses = new Map<string, BrowserCourse>();
    const assignments = new Map<string, BrowserAssignment>();
    const visited = new Set<string>();
    const queue: string[] = [];
    const warnings = new Set<string>();
    const started = Date.now();
    let expectedUrl: string | undefined;
    while (true) {
      if (Date.now() - started > 240000) {
        warnings.add(
          "Stopped after four minutes. Only the pages visited were imported; run again from another class.",
        );
        break;
      }
      const page = await read(tabId);
      if (page.email !== settings.expectedEmail)
        throw new Error("WRONG_ACCOUNT");
      if (
        expectedUrl &&
        new URL(page.pageUrl).pathname !== new URL(expectedUrl).pathname
      )
        throw new Error("NAVIGATION_CHANGED");
      visited.add(page.pageUrl);
      for (const c of page.courses)
        courses.set(
          c.externalCourseId,
          mergeObserved(courses.get(c.externalCourseId) || c, c),
        );
      for (const a of page.assignments) {
        const key = `${a.externalCourseId}/${a.externalAssignmentId}`;
        assignments.set(key, mergeObserved(assignments.get(key) || a, a));
      }
      page.warnings.forEach((w) => warnings.add(w));
      await chrome.storage.session.set({
        progress: {
          configurationId,
          running: true,
          courses: courses.size,
          assignments: assignments.size,
          pages: visited.size,
        },
      });
      if (!settings.followLinks) break;
      for (const link of page.links)
        if (!visited.has(link) && !queue.includes(link)) queue.push(link);
      if (visited.size >= 100) {
        warnings.add(
          "Reached the 100-page limit. Only visited pages were imported.",
        );
        break;
      }
      const next = queue.shift();
      if (!next) break;
      // URLs came from rendered anchors; apply a second fixed-origin/path check before navigation.
      const target = new URL(next);
      if (
        target.origin !== "https://classroom.google.com" ||
        !/^\/(?:u\/\d+\/)?(?:c|w)\/[\w-]+(?:\/(?:a|sa)\/[\w-]+\/details|\/t\/all)?\/?$/.test(
          target.pathname,
        )
      )
        throw new Error("NAVIGATION_CHANGED");
      await chrome.tabs.update(tabId, { url: target.href });
      expectedUrl = target.href;
    }
    if (!courses.size) throw new Error("STRUCTURE_NOT_RECOGNIZED");
    // Recheck identity immediately before import, including after user navigation.
    if ((await read(tabId)).email !== settings.expectedEmail)
      throw new Error("WRONG_ACCOUNT");
    const body = browserImportSchema.parse({
      child: settings.child,
      courses: [...courses.values()],
      assignments: [...assignments.values()],
      // A multi-page scan is only as fresh as its earliest observation.
      extractedAt: new Date(started).toISOString(),
    });
    let response: Response;
    try {
      response = await fetch(`${settings.apiUrl}/api/classroom/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.key}`,
        },
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(80000),
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("API_UNAVAILABLE");
    }
    if (response.status === 401) throw new Error("INVALID_KEY");
    if (!response.ok)
      throw new Error(
        response.status >= 500 ? "API_UNAVAILABLE" : "IMPORT_REJECTED",
      );
    const answer = await response.json();
    if (answer?.ok !== true) throw new Error("IMPORT_REJECTED");
    const summary = {
      configurationId,
      running: false,
      courses: courses.size,
      assignments: assignments.size,
      missing: body.assignments.filter((a) => a.status === "missing").length,
      pages: visited.size,
      lastSuccess: new Date().toISOString(),
      warnings: [...warnings],
    };
    const history = (await chrome.storage.local.get("history")).history || {};
    await chrome.storage.local.set({
      history: { ...history, [configurationId]: summary },
    });
    await chrome.storage.session.set({ progress: summary });
    return summary;
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "STRUCTURE_NOT_RECOGNIZED";
    const message =
      messages[code] ||
      "Page data could not be recognized safely. Nothing was imported; update the extension or try an assignment detail page.";
    await chrome.storage.session.set({
      progress: { configurationId, running: false, error: message },
    });
    throw new Error(message);
  } finally {
    running = false;
  }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  // Content scripts cannot start a sync or choose a destination. Only our popup can.
  if (
    sender.id !== chrome.runtime.id ||
    sender.tab ||
    sender.url !== chrome.runtime.getURL("popup.html")
  )
    return;
  if (message?.type !== "SYNC" || !Number.isInteger(message.tabId)) return;
  void sync(message.tabId)
    .then((data) => reply({ ok: true, data }))
    .catch((error) => reply({ ok: false, error: error.message }));
  return true;
});
