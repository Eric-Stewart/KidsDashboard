import { validateSettings, settingsId, type Settings } from "./settings";
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const status = document.getElementById("status")!;
const button = document.getElementById("sync") as HTMLButtonElement;
let saved: Settings | undefined;
interface Progress {
  configurationId: string;
  running?: boolean;
  courses?: number;
  assignments?: number;
  missing?: number;
  pages?: number;
  lastSuccess?: string;
  error?: string;
  warnings?: string[];
}
const initialized = chrome.storage.local
  .setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
  .then(async () => {
    saved = (await chrome.storage.local.get("settings")).settings as
      | Settings
      | undefined;
    for (const key of ["apiUrl", "child", "expectedEmail", "key"] as const)
      input(key).value =
        saved?.[key] ||
        (key === "apiUrl"
          ? "http://localhost:3000"
          : key === "child"
            ? "E"
            : "");
    input("followLinks").checked = saved?.followLinks || false;
    await refresh();
  });
input("child").addEventListener("change", () => {
  input("expectedEmail").value = "";
  status.textContent =
    "Enter this child’s school email and save before syncing.";
});
document
  .getElementById("settings")!
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const settings = validateSettings({
        apiUrl: input("apiUrl").value,
        child: input("child").value as "E" | "A",
        expectedEmail: input("expectedEmail").value,
        key: input("key").value,
        followLinks: input("followLinks").checked,
      });
      // Requested only after a user's Save click and only for their configured dashboard origin.
      if (
        !(await chrome.permissions.request({
          origins: [`${settings.apiUrl}/*`],
        }))
      )
        throw new Error(
          "Allow access to the KidsDashboard URL to save settings.",
        );
      await initialized;
      await chrome.storage.local.setAccessLevel({
        accessLevel: "TRUSTED_CONTEXTS",
      });
      await chrome.storage.local.set({ settings });
      saved = settings;
      status.textContent =
        "Settings saved. Open the child’s Classroom tab, then Sync Classroom.";
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Could not save settings.";
    }
  });
button.addEventListener("click", async () => {
  await initialized;
  if (!saved) {
    status.textContent = "Save settings first.";
    return;
  }
  if (
    ["apiUrl", "child", "expectedEmail", "key"].some(
      (key) =>
        input(key).value !== (saved as unknown as Record<string, string>)[key],
    ) ||
    input("followLinks").checked !== saved.followLinks
  ) {
    status.textContent = "Save your changed settings before syncing.";
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://classroom.google.com/")) {
    status.textContent =
      "Open Google Classroom in the active tab and sign in normally, then reopen this popup.";
    return;
  }
  button.disabled = true;
  status.textContent = "Reading visible Classroom pages…";
  try {
    const result = await chrome.runtime.sendMessage({
      type: "SYNC",
      tabId: tab.id,
    });
    status.textContent = result.ok ? "Import saved." : result.error;
  } catch {
    status.textContent =
      "Sync interrupted. Reopen this popup to check the last successful sync; retry if needed.";
  } finally {
    button.disabled = false;
    await refresh();
  }
});
async function refresh() {
  if (!saved) return;
  const id = settingsId(saved);
  const history = (await chrome.storage.local.get("history")).history as
    | Record<string, Progress>
    | undefined;
  const last = history?.[id];
  const progress = (await chrome.storage.session.get("progress")).progress as
    | Progress
    | undefined;
  const current = progress?.configurationId === id ? progress : last;
  document.getElementById("last")!.textContent =
    `Last successful sync: ${last?.lastSuccess ? new Date(last.lastSuccess).toLocaleString() : "Never"}`;
  if (current?.courses !== undefined)
    document.getElementById("counts")!.textContent =
      `Courses: ${current.courses} · Assignments: ${current.assignments} · Missing: ${current.missing ?? "—"} · Pages: ${current.pages}`;
  if (current?.error) status.textContent = current.error;
  else if (current?.warnings?.length)
    status.textContent = current.warnings.join(" ");
  else if (current?.running)
    status.textContent = "Syncing visible pages… Keep the Classroom tab open.";
}
chrome.storage.onChanged.addListener(() => {
  void refresh();
});
