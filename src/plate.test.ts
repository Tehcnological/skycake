import { test } from "node:test";
import assert from "node:assert/strict";
import { chartFor, fitChart, pageArrows, pickOrder, pickRefs, zoomAbout } from "./plate.js";
import type { ProcedureRef } from "./scene.js";
import type { ChartEntry } from "./tpp.js";

const e = (name: string, procedures: string[], pages = 1): ChartEntry => ({ name, kind: "IAP", pages: Array.from({ length: pages }, (_, i) => `${i}.png`), procedures });
const ils07L = e("ILS OR LOC/DME RWY 07L", ["ILS RWY 07L", "LOC RWY 07L"]);
const ils07R = e("ILS OR LOC RWY 07R", ["ILS RWY 07R", "LOC RWY 07R"]), bxk = e("BUCKEYE FOUR", ["BXK4"], 2), visual = e("RIVER VISUAL RWY 19", []);
const sdl = e("RNAV (RNP) Z RWY 03", ["RNAV (RNP) Z RWY 03"]);
const idx = new Map([["KPHX", [ils07L, ils07R, bxk, visual]], ["KSDL", [sdl]]]);

test("the picker: charts of what is shown first, then the airport's others in FAA order", () => {
  const names = (refs: ProcedureRef[], at: string | null) => pickOrder(idx, refs, at).map((p) => `${p.airport} ${p.entry.name}`);
  assert.deepEqual(names([{ airport: "KPHX", name: "BXK4" }, { airport: "KPHX", name: "ILS RWY 07R" }, { airport: "KPHX", name: "LOC RWY 07R" }], "KPHX"),
    ["KPHX BUCKEYE FOUR", "KPHX ILS OR LOC RWY 07R", "KPHX ILS OR LOC/DME RWY 07L", "KPHX RIVER VISUAL RWY 19"]);
  assert.deepEqual(names([{ airport: "KSDL", name: "RNAV (RNP) Z RWY 03" }], "KPHX")[0], "KSDL RNAV (RNP) Z RWY 03");
  assert.deepEqual(names([{ airport: "KFFZ", name: "X" }], null), []);
});
test("a shown procedure's chart, keeping the one picked when it draws it", () => {
  assert.equal(chartFor(idx.get("KPHX")!, "LOC RWY 07R", ils07R), ils07R); // picking ILS OR LOC RWY 07R re-enters with its refs
  assert.equal(chartFor(idx.get("KPHX")!, "ILS RWY 07L", null), ils07L);
  assert.equal(chartFor(idx.get("KPHX")!, "ILS RWY 07L", bxk), ils07L);
  assert.equal(chartFor(idx.get("KPHX")!, "TFD4", null), null);
});
test("picking shows the chart's procedures; arrows only for several pages", () => {
  assert.deepEqual(pickRefs({ airport: "KPHX", entry: ils07R }), [{ airport: "KPHX", name: "ILS RWY 07R" }, { airport: "KPHX", name: "LOC RWY 07R" }]);
  assert.deepEqual(pickRefs({ airport: "KPHX", entry: visual }), []);
  assert.equal(pageArrows(1, 1), null);
  assert.deepEqual(pageArrows(2, 1), { back: false, next: true });
  assert.deepEqual(pageArrows(2, 2), { back: true, next: false });
});
test("fit and zoom", () => {
  const f = fitChart({ w: 1700, h: 2200 }, { w: 400, h: 600 });
  assert.ok(Math.abs(f.s - 400 / 1700) < 1e-9 && Math.abs(f.x) < 1e-9 && Math.abs(f.y - (600 - 2200 * f.s) / 2) < 1e-9);
  assert.deepEqual(zoomAbout({ x: 0, y: 0, s: 1 }, 2, [100, 50], 0.5, 3), { x: -100, y: -50, s: 2 });
  assert.deepEqual(zoomAbout({ x: 0, y: 0, s: 2 }, 4, [0, 0], 0.5, 3), { x: 0, y: 0, s: 3 });
  assert.equal(zoomAbout({ x: 0, y: 0, s: 1 }, 0.1, [0, 0], 0.5, 3).s, 0.5);
});
