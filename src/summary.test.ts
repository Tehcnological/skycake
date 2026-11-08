import assert from "node:assert/strict";
import { test } from "node:test";
import { describe } from "./summary.js";
import { LABELS } from "./ui.js";

test("the summary names the chart, raised areas with altitudes, and procedures", () => {
  const s = describe({ chart: "TAC 2026-10-02", areas: [{ name: "Phoenix Class B", floor: "SFC", ceiling: "9,000" }], procedures: ["KPHX RNAV (GPS) Y RWY 08"] }, LABELS);
  assert.match(s, /TAC 2026-10-02/);
  assert.match(s, /Phoenix Class B/);
  assert.match(s, /9,000/);
  assert.match(s, /RWY 08/);
});
test("nothing raised, nothing shown", () => {
  assert.match(describe({ chart: "SEC", areas: [], procedures: [] }, LABELS), /SEC/);
});
