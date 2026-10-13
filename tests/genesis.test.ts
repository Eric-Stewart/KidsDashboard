import test from "node:test";
import assert from "node:assert/strict";
import { parseGenesisLunchBalance } from "../lib/school-browser/genesis";

test("a changed or missing lunch balance does not block Genesis grades and assignments", () => {
  assert.equal(parseGenesisLunchBalance([]), undefined);
  assert.equal(parseGenesisLunchBalance(["Unavailable"]), undefined);
  assert.equal(parseGenesisLunchBalance(["$12.34", "$56.78"]), undefined);
  assert.equal(parseGenesisLunchBalance(["$12.34"]), 12.34);
  assert.equal(parseGenesisLunchBalance(["($5.00)"]), -5);
});
