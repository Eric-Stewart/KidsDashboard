import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileGenesisSnapshot } from "../lib/import-genesis-browser";

test("Genesis reconciliation hides assignments and courses absent from a complete snapshot", async () => {
  const calls: Array<{ kind: string; args: unknown }> = [];
  const tx = {
    assignmentSource: {
      updateMany: async (args: unknown) => {
        calls.push({ kind: "assignment", args });
        return { count: 2 };
      },
    },
    course: {
      updateMany: async (args: unknown) => {
        calls.push({ kind: "course", args });
        return { count: 1 };
      },
    },
  };

  const updated = await reconcileGenesisSnapshot(
    tx as never,
    "E",
    "2026-2027",
    ["2026-2027/math/a1"],
    ["math"],
  );

  assert.equal(updated, 3);
  assert.deepEqual(calls, [
    {
      kind: "assignment",
      args: {
        where: {
          childId: "E",
          source: "GENESIS",
          available: true,
          externalId: { notIn: ["2026-2027/math/a1"] },
        },
        data: { available: false },
      },
    },
    {
      kind: "course",
      args: {
        where: {
          childId: "E",
          source: "GENESIS",
          schoolYear: "2026-2027",
          active: true,
          externalId: { notIn: ["math"] },
        },
        data: { active: false },
      },
    },
  ]);
});
