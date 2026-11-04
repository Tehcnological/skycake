import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KINDS, areaIds, classKind, clipRing, deepest, feet, hundreds, inRing, suaKind, type AirspaceFile, type Ring } from "./airspace.js";

test("FAA records map to chart kinds; default 1,200 ft Class E and Class A are left out", () => {
  assert.equal(classKind("B", "CLASS_B", 0, "SFC"), "B");
  assert.equal(classKind("D", "CLASS_D", 0, "SFC"), "D");
  assert.equal(classKind("E", "CLASS_E4", 0, "SFC"), "E");
  assert.equal(classKind("E", "CLASS_E5", 700, "SFC"), "E700");
  assert.equal(classKind("E", "CLASS_E5", 1200, "SFC"), null);
  assert.equal(classKind("E", "CLASS_E6", 1200, "SFC"), null);
  assert.equal(classKind("A", "CLASS_A", 18000, "MSL"), null);
  assert.equal(classKind(null, "MODE C", 0, "SFC"), "MODEC");
  assert.equal(suaKind("R"), "R");
  assert.equal(suaKind("MOA"), "MOA");
  assert.equal(suaKind("NSA"), null);
});

test("altitudes: SFC is above the ground, FL is hundreds", () => {
  assert.equal(feet(500, "FT", "SFC", 1135), 1635);
  assert.equal(feet(180, "FL", "STD", 1135), 18000);
  assert.equal(feet(10000, "FT", "MSL", 1135), 10000);
});

test("clipping keeps the inside part and drops rings outside", () => {
  const b = { s: 0, w: 0, n: 1, e: 1 };
  const square = clipRing([[-1, -1], [-1, 0.5], [0.5, 0.5], [0.5, -1]], b);
  assert.deepEqual(square.map(([a, c]) => [a, c].join()).sort(), ["0,0", "0,0.5", "0.5,0", "0.5,0.5"]);
  assert.deepEqual(clipRing([[2, 2], [2, 3], [3, 3]], b), []);
});

test("a tag's spot stays inside its ring, even on a curved shelf", () => {
  const square = [[0, 0], [4, 0], [4, 4], [0, 4]];
  assert.equal(inRing([2, 2], square), true);
  assert.equal(inRing([5, 2], square), false);
  // A C shape: the middle of its box is outside.
  const c = [[0, 0], [10, 0], [10, 2], [2, 2], [2, 8], [10, 8], [10, 10], [0, 10]];
  assert.equal(inRing([6, 5], c), false);
  assert.equal(inRing(deepest(c), c), true);
});

test("hundreds of feet as the chart writes them", () => {
  assert.equal(hundreds(9000, 1135), "90");
  assert.equal(hundreds(1135, 1135), "SFC");
});

test("built Phoenix data has the Class B surface area and only known kinds", () => {
  const f: AirspaceFile = JSON.parse(readFileSync(new URL("../data/phoenix/area.json", import.meta.url), "utf8"));
  assert.ok(f.areas.every((a) => KINDS.includes(a.kind) && a.ceiling >= a.floor && a.rings.every((r) => r.length >= 3)));
  // Phoenix Class B surface area: SFC to 9,000 MSL (90/SFC on the chart).
  assert.ok(f.areas.some((a) => a.kind === "B" && a.floor === f.ground && a.ceiling === 9000));
  assert.ok(f.areas.some((a) => a.kind === "MODEC" && a.ceiling === 10000));
  assert.ok(f.areas.every((a) => a.rings.flat().every(([lat, lon]) => lat >= f.bounds.s - 1e-9 && lat <= f.bounds.n + 1e-9 && lon >= f.bounds.w - 1e-9 && lon <= f.bounds.e + 1e-9)));
});

test("terrain lines up with the chart: known summits stand at their own spots", () => {
  const f: AirspaceFile = JSON.parse(readFileSync(new URL("../data/phoenix/area.json", import.meta.url), "utf8"));
  const raw = readFileSync(new URL(`../data/phoenix/${f.dem.url}`, import.meta.url));
  const ft = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2);
  const { nx, ny } = f.dem, b = f.bounds;
  // Highest of the grid points around a spot; the grid's corners are the chart's corners.
  const near = (lat: number, lon: number) => {
    const i = Math.round(((lon - b.w) / (b.e - b.w)) * (nx - 1)), j = Math.round(((b.n - lat) / (b.n - b.s)) * (ny - 1));
    let h = -Infinity;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) h = Math.max(h, ft[(j + dj) * nx + i + di]);
    return h;
  };
  // Summits from USGS GNIS. A grid squeezed north-south misses them by 1,000 ft or more.
  assert.ok(near(33.5151, -111.9618) > 2300, "Camelback Mountain, 2,704 ft");
  assert.ok(near(33.6834, -111.3254) > 6800, "Four Peaks, 7,657 ft");
  assert.ok(Math.abs(near(33.4343, -112.0116) - 1135) < 60, "Sky Harbor, 1,135 ft");
});

test("area ids: readable, unique, and the same for the same data", () => {
  const ring = (lon: number): Ring => [[33, lon], [33.1, lon], [33.1, lon + 0.1]];
  const a = [
    { kind: "D" as const, name: "CHANDLER MUNICIPAL AIRPORT CLASS D", floor: 1135, ceiling: 3000, rings: [ring(-111.8)] },
    { kind: "B" as const, name: "PHOENIX CLASS B", floor: 5000, ceiling: 9000, rings: [ring(-112.2)] },
    { kind: "B" as const, name: "PHOENIX CLASS B", floor: 5000, ceiling: 9000, rings: [ring(-111.9)] },
    { kind: "B" as const, name: "PHOENIX CLASS B", floor: 1135, ceiling: 9000, rings: [ring(-112)] },
  ];
  assert.deepEqual(areaIds(a, 1135), ["d-chandler-municipal-airport-class-d", "b-phoenix-class-b-50-90-1", "b-phoenix-class-b-50-90-2", "b-phoenix-class-b-sfc-90"]);
  assert.deepEqual(areaIds([...a].reverse(), 1135), [...areaIds(a, 1135)].reverse());
});

test("built Phoenix data: every area has a unique id", () => {
  const f: AirspaceFile = JSON.parse(readFileSync(new URL("../data/phoenix/area.json", import.meta.url), "utf8"));
  const ids = f.areas.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("d-chandler-municipal-airport-class-d"));
});
