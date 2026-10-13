import test from "node:test";
import assert from "node:assert/strict";
import {
  genesisImportSummary,
  parseGenesisLunchBalance,
} from "../lib/school-browser/genesis";

test("a changed or missing lunch balance does not block Genesis grades and assignments", () => {
  assert.equal(parseGenesisLunchBalance(["$12.34"]), 12.34);
  assert.equal(parseGenesisLunchBalance(["($12.34)"]), -12.34);
  assert.equal(parseGenesisLunchBalance(["($-12.34)"]), undefined);
  assert.equal(parseGenesisLunchBalance(["($12.34"]), undefined);
  assert.equal(parseGenesisLunchBalance(["$12.34)"]), undefined);
  assert.equal(parseGenesisLunchBalance(["$1,2.34"]), undefined);
  assert.equal(parseGenesisLunchBalance(["$1,234.56"]), 1234.56);
  assert.equal(parseGenesisLunchBalance([]), undefined);
  assert.equal(parseGenesisLunchBalance(["Unavailable"]), undefined);
  assert.equal(parseGenesisLunchBalance(["$12.34", "$56.78"]), undefined);
});

test("Genesis import summary identifies skipped lunch balances", () => {
  assert.equal(
    genesisImportSummary([
      { child: "E", lunchBalance: undefined },
      { child: "A", lunchBalance: 12.34 },
    ]),
    "Genesis: grades and assignments imported for both children; lunch balance skipped for E and refreshed for A.",
  );
});
