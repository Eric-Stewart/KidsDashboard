import test from "node:test";
import assert from "node:assert/strict";
import { lunchBalanceLabel } from "../lib/lunch-balance-label";

test("lunch balance timestamp says when the balance last changed", () => {
  assert.equal(
    lunchBalanceLabel("2026-10-13T03:32:45.052Z", false),
    "Balance last changed Oct 12, 11:32 PM",
  );
});

test("lunch balance timestamp retains fallback labels", () => {
  assert.equal(lunchBalanceLabel(null, false), "Waiting for school data");
  assert.equal(lunchBalanceLabel(null, true), "Sample data");
});
