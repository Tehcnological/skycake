// Chart comparison (one B, one E under a shelf, the G point against the Phoenix TAC, edition 2026-10-29): NOT yet done by eye; to do in the demo before release.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deepest, inRing, type AirspaceFile } from "./airspace.js";
import { classAt, groundFt, nearBoundary, needs, type Class } from "./airclass.js";

const data: AirspaceFile = JSON.parse(readFileSync("data/phoenix/area.json", "utf8"));
const grid = new Int16Array(readFileSync("data/phoenix/dem.bin").buffer);
const inside = (id: string) => { const a = data.areas.find((x) => x.id === id)!; return deepest(a.rings[0]) as [number, number]; };

test("ground comes from the grid, row 0 north; flat without it", () => {
  assert.equal(groundFt(data, null, 33, -112), data.ground);
  const { n, w, s, e } = data.bounds;
  assert.equal(groundFt(data, grid, n, w), grid[0]);
  assert.equal(groundFt(data, grid, s, e), grid[grid.length - 1]);
});
test("inside a Class B shelf, between its floor and ceiling", () => {
  const [lat, lon] = inside("b-phoenix-class-b-50-90-4");
  assert.equal(classAt(data, grid, lat, lon, 7000).kind, "B");
});
test("a shelf is half-open: floor in, ceiling out", () => {
  const a = data.areas.find((x) => x.id === "b-phoenix-class-b-50-90-4")!;
  const [lat, lon] = inside(a.id);
  assert.equal(classAt(data, grid, lat, lon, a.floor).area, a.id);
  assert.notEqual(classAt(data, grid, lat, lon, a.ceiling).area, a.id);
});
test("under a Class B shelf: Class E above 700 AGL inside the E700 area, G below", () => {
  const [lat, lon] = inside("b-phoenix-class-b-50-90-4");
  const g = groundFt(data, grid, lat, lon);
  assert.equal(classAt(data, grid, lat, lon, 4500).kind, "E"); // 5,000 floor, ground near 1,100
  assert.equal(classAt(data, grid, lat, lon, g + 500).kind, "G"); // below both the 700 and the 1,200 AGL floor
});
test("Class E from 1,200 AGL outside E700, and above 14,500 MSL", () => {
  const [lat, lon] = [data.bounds.s + 0.02, data.bounds.w + 0.02];
  const g = groundFt(data, grid, lat, lon);
  assert.equal(classAt(data, grid, lat, lon, g + 1100).kind, "G");
  assert.equal(classAt(data, grid, lat, lon, g + 1300).kind, "E");
  assert.equal(classAt(data, grid, lat, lon, 14500).kind, "E");
  // "At and above": the floors themselves are Class E.
  assert.equal(classAt(data, grid, lat, lon, g + 1200).kind, "E");
});
test("Class A from 18,000 MSL: clearance, radio and transponder", () => {
  const [lat, lon] = [data.bounds.s + 0.02, data.bounds.w + 0.02];
  assert.equal(classAt(data, grid, lat, lon, 17900).kind, "E");
  const a = classAt(data, grid, lat, lon, 18000);
  assert.equal(a.kind, "A");
  assert.deepEqual(needs(a, 18000), { clearance: true, radio: true, transponder: true });
});
test("Class G near the chart's edge at 500 AGL", () => {
  const [lat, lon] = [data.bounds.s + 0.02, data.bounds.w + 0.02];
  assert.ok(!data.areas.some((a) => a.kind === "E700" && a.rings.some((r) => inRing([lat, lon], r))), "corner is in an E700 outline: pick another");
  assert.equal(classAt(data, grid, lat, lon, groundFt(data, grid, lat, lon) + 500).kind, "G");
});
test("inside the Mode C veil: transponder below 10,000, and above it too when more than 2,500 AGL", () => {
  const veil = data.areas.find((a) => a.kind === "MODEC")!;
  const [lat, lon] = deepest(veil.rings[0]) as [number, number];
  assert.equal(needs(classAt(data, grid, lat, lon, 9000), 9000).transponder, true);
  assert.equal(needs(classAt(data, grid, lat, lon, 11000), 11000).transponder, true); // 91.215(b)(5)(i)
});
const at = (c: Partial<Class>): Class => ({ kind: "G", area: null, veil: false, overBC: false, agl: 3000, ...c });
test("what a point needs", () => {
  assert.deepEqual(needs(at({ kind: "B", area: "x", veil: true, overBC: true }), 5000), { clearance: true, radio: true, transponder: true });
  assert.deepEqual(needs(at({ kind: "C", area: "x", overBC: true }), 3000), { clearance: false, radio: true, transponder: true });
  assert.deepEqual(needs(at({ kind: "D", area: "x" }), 3000), { clearance: false, radio: true, transponder: false });
  assert.deepEqual(needs(at({ agl: 1500 }), 1500), { clearance: false, radio: false, transponder: false });
  assert.equal(needs(at({ kind: "E", overBC: true }), 9500).transponder, true); // above a B or C, within its outline: (b)(4)
  assert.equal(needs(at({ kind: "E", overBC: true }), 10500).transponder, true); // (b)(5)(i) from here
  assert.equal(needs(at({ kind: "E", agl: 5000 }), 11000).transponder, true); // (b)(5)(i)
  assert.equal(needs(at({ kind: "E", agl: 2000 }), 11000).transponder, false); // at or below 2,500 AGL: excepted
  assert.equal(needs(at({ kind: "E", agl: 2500 }), 10000).transponder, false); // 2,500 AGL exactly is excepted
  assert.equal(needs(at({ kind: "E", agl: 9000 }), 9999).transponder, false); // below 10,000, no veil, not over B or C
  assert.equal(needs(at({ kind: "E", veil: true, agl: 2000 }), 10000).transponder, false); // the veil stops below 10,000
});
test("over a B or C: inside any piece's outline (shelves too), at or above that piece's ceiling", () => {
  const c = data.areas.find((a) => a.id === "c-tucson-international-airport-class-c-sfc-66")!;
  const [lat, lon] = deepest(c.rings[0]) as [number, number];
  assert.equal(classAt(data, grid, lat, lon, c.ceiling - 100).overBC, false);
  assert.equal(classAt(data, grid, lat, lon, c.ceiling + 100).overBC, true);
});
test("Tucson Class C outer shelf, outside the core and the veil: 7,500 MSL needs a transponder, 3,500 does not", () => {
  const core = data.areas.find((a) => a.id === "c-tucson-international-airport-class-c-sfc-66")!;
  const shelf = data.areas.find((a) => a.id === "c-tucson-international-airport-class-c-42-66")!;
  const veils = data.areas.filter((a) => a.kind === "MODEC");
  const [s, n, w, e] = [Math.min(...shelf.rings[0].map((p) => p[0])), Math.max(...shelf.rings[0].map((p) => p[0])), Math.min(...shelf.rings[0].map((p) => p[1])), Math.max(...shelf.rings[0].map((p) => p[1]))];
  let pt: [number, number] | null = null;
  for (let i = 0; i <= 40 && !pt; i++) for (let j = 0; j <= 40 && !pt; j++) {
    const p: [number, number] = [s + ((n - s) * i) / 40, w + ((e - w) * j) / 40];
    if (inRing(p, shelf.rings[0]) && !inRing(p, core.rings[0]) && !veils.some((v) => inRing(p, v.rings[0])) && !nearBoundary(data, grid, p[0], p[1], 7500) && !nearBoundary(data, grid, p[0], p[1], 3500)) pt = p;
  }
  assert.ok(pt, "no clear point in the shelf");
  const hi = classAt(data, grid, pt![0], pt![1], 7500); // above the 6,600 ceiling, below 10,000
  assert.equal(hi.overBC, true);
  assert.equal(needs(hi, 7500).transponder, true);
  const lo = classAt(data, grid, pt![0], pt![1], 3500); // below the 4,200 floor
  assert.notEqual(lo.kind, "C");
  assert.equal(lo.overBC, false);
  assert.equal(needs(lo, 3500).transponder, false);
});
test("near a shelf's floor or edge counts as near a boundary", () => {
  const [lat, lon] = inside("b-phoenix-class-b-50-90-4");
  assert.equal(nearBoundary(data, grid, lat, lon, 5100), true);
  assert.equal(nearBoundary(data, grid, lat, lon, 7000), false);
});
test("near an outline edge, and near 14,500 and 10,000 MSL", () => {
  const a = data.areas.find((x) => x.id === "b-phoenix-class-b-50-90-4")!;
  const [p, q] = [a.rings[0][0], a.rings[0][1]];
  assert.equal(nearBoundary(data, grid, p[0], p[1], 7000), true); // on a vertex
  assert.equal(nearBoundary(data, grid, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 7000), true); // on an edge
  const [lat, lon] = [data.bounds.s + 0.02, data.bounds.w + 0.02];
  assert.equal(nearBoundary(data, grid, lat, lon, 14300), true);
  assert.equal(nearBoundary(data, grid, lat, lon, 12500), false);
  assert.equal(nearBoundary(data, grid, lat, lon, 10200), true);
  assert.equal(nearBoundary(data, grid, lat, lon, 9500), false);
});
test("near the E floor and 2,500 AGL", () => {
  const [lat, lon] = [data.bounds.s + 0.02, data.bounds.w + 0.02];
  const g = groundFt(data, grid, lat, lon);
  assert.equal(nearBoundary(data, grid, lat, lon, g + 1200 + 250), true);
  assert.equal(nearBoundary(data, grid, lat, lon, g + 1200 + 400), false);
  const { n, w, s, e } = data.bounds; // the highest grid point (column 443, row 433, 9,032 ft): 2,500 AGL is above 10,000 MSL there
  const [hl, ho] = [n - (433 / (data.dem.ny - 1)) * (n - s), w + (443 / (data.dem.nx - 1)) * (e - w)];
  const [bare, top] = [{ ...data, areas: [] }, groundFt(data, grid, hl, ho) + 2500]; // no areas, so only the levels count
  assert.equal(nearBoundary(bare, grid, hl, ho, top + 250), true);
  assert.equal(nearBoundary(bare, grid, hl, ho, top + 700), false);
});
