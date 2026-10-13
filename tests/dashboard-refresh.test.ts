import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DASHBOARD_AUTO_REFRESH_MS,
  scheduleDashboardRefresh,
} from "../lib/dashboard-refresh";

test("an open dashboard refreshes itself every minute and cleans up its timer", () => {
  let callback: (() => void) | undefined;
  let interval = 0;
  let cleared: unknown;
  let refreshes = 0;
  const timer = { id: 42 };

  const cleanup = scheduleDashboardRefresh(
    () => {
      refreshes++;
    },
    (fn, ms) => {
      callback = fn;
      interval = ms;
      return timer as never;
    },
    (id) => {
      cleared = id;
    },
  );

  assert.equal(DASHBOARD_AUTO_REFRESH_MS, 60_000);
  assert.equal(interval, 60_000);
  callback?.();
  assert.equal(refreshes, 1);
  cleanup();
  assert.equal(cleared, timer);
});
