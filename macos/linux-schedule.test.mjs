import { test } from "node:test";
import assert from "node:assert/strict";
import {
  label,
  cronSchedule,
  shellQuote,
  cronEntry,
  upsertCronEntry,
  removeCronEntries,
} from "./linux-schedule.mjs";

const entry = cronEntry({
  rootDir: "/home/user/KidsDashboard",
  nodeExe: "/home/user/.nvm/versions/node/v24.21.0/bin/node",
  logs: "/home/user/.local/share/KidsDashboard/logs",
  display: ":0",
});

test("entry runs the collector at 8am and 8pm with the schedule marker", () => {
  assert.equal(cronSchedule, "0 8,20 * * *");
  assert.match(entry, /^0 8,20 \* \* \* /);
  assert.ok(entry.includes("collector/run.ts"));
  assert.ok(entry.includes("--import tsx"));
  assert.ok(entry.includes("/home/user/KidsDashboard"));
  assert.ok(entry.includes("refresh.log"));
  assert.ok(entry.includes("refresh-error.log"));
  assert.ok(entry.includes(`# ${label}`));
  assert.ok(entry.includes("export DISPLAY=':0';"));
});

test("DISPLAY is exported so it reaches node, not just cd", () => {
  // Regression: a bare `DISPLAY=:0 cd ... && node ...` prefix only applies to
  // `cd`, so headed Chrome failed to start under cron with no display.
  assert.match(
    entry,
    /^0 8,20 \* \* \* export DISPLAY=':0'; cd .* && .*node.*collector\/run\.ts/,
  );
  assert.ok(!entry.match(/(^| )DISPLAY=[^ ;]* cd /));
});

test("shell quoting survives spaces and single quotes in paths", () => {
  assert.equal(shellQuote("/a b/c"), "'/a b/c'");
  const quoted = shellQuote("/home/o'brien/Dash board");
  assert.equal(quoted, `'/home/o'"'"'brien/Dash board'`);
  const spaced = cronEntry({
    rootDir: "/home/o'brien/Dash board",
    nodeExe: "/usr/bin/node",
    logs: "/tmp/logs",
    display: "",
  });
  assert.ok(spaced.includes(`cd ${quoted} &&`));
  assert.ok(!spaced.includes("DISPLAY"));
});

test("install into an empty crontab yields exactly the new entry", () => {
  assert.equal(upsertCronEntry("", entry, label), entry + "\n");
});

test("install preserves unrelated lines and replaces a stale entry", () => {
  const stale = entry.replace(":0", ":1");
  const result = upsertCronEntry(
    `PATH=/usr/bin\n${stale}\n0 2 * * * /usr/bin/backup\n`,
    entry,
    label,
  );
  assert.ok(result.includes("PATH=/usr/bin"));
  assert.ok(result.includes("/usr/bin/backup"));
  assert.equal(
    result.split("\n").filter((line) => line.includes(label)).length,
    1,
  );
  assert.ok(result.includes(entry));
  assert.ok(result.endsWith("\n"));
});

test("remove drops scheduled lines and keeps everything else", () => {
  const result = removeCronEntries(
    `PATH=/usr/bin\n${entry}\n0 2 * * * /usr/bin/backup\n`,
    label,
  );
  assert.ok(!result.includes(label));
  assert.ok(result.includes("PATH=/usr/bin"));
  assert.ok(result.includes("/usr/bin/backup"));
});

test("remove leaves an empty crontab when only the schedule existed", () => {
  assert.equal(removeCronEntries(entry + "\n", label), "");
  assert.equal(removeCronEntries("", label), "");
});
