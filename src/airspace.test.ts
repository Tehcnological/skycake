import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { KINDS, areaIds, boundaryKind, circle, classKind, clipRing, deepest, feet, hundreds, inRing, suaKind, type AirspaceFile, type Ring } from "./airspace.js";

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
  assert.equal(boundaryKind("TRSA", "TRSA"), "TRSA");
  assert.equal(boundaryKind("SATA", "SFRA"), "SFRA");
  assert.equal(boundaryKind("SATA", "SPEC_AT_RULES"), "SATR");
  assert.equal(boundaryKind("ARTCC", "ARTCC_L"), null);
  assert.equal(boundaryKind("CLASS", "CLASS_E7"), "EFLOOR");
  assert.equal(boundaryKind("CLASS", "CLASS_A_OFFSHORE"), null);
  assert.equal(boundaryKind("DEF", "NDA_TFR"), "TFR");
  assert.equal(boundaryKind("NSA", "NAT_SEC_AREA"), "NSA");
  assert.equal(boundaryKind("ADIZ", "ADIZ"), "ADIZ");
  // Class E from a floor other than 700 or 1,200 AGL is charted; the 14,500 MSL floor everywhere is not.
  assert.equal(classKind("E", "CLASS_E5", 9500, "MSL"), "EFLOOR");
  assert.equal(classKind("E", "CLASS_E5", 1200, "SFC"), null);
  assert.equal(classKind("E", "CLASS_E", 14500, "MSL"), null);
});

test("altitudes: SFC is above the ground, FL is hundreds", () => {
  assert.equal(feet(500, "FT", "SFC", 1135), 1635);
  assert.equal(feet(180, "FL", "STD", 1135), 18000);
  assert.equal(feet(10000, "FT", "MSL", 1135), 10000);
  assert.equal(feet(-9998, null, "UNLTD", 1135), Infinity);
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
  assert.equal(hundreds(2999, 1135), "-30"); // up to but not including 3,000
});

test("a ceiling up to but not including keeps its whole hundreds in the id", () => {
  const ring = [[[33, -112], [33.1, -112], [33.1, -111.9]]] as Ring[];
  const d = (ceiling: number) => ({ kind: "D" as const, name: "X CLASS D", floor: 1135, ceiling, rings: ring });
  assert.deepEqual(areaIds([d(2999), d(4000)], 1135), ["d-x-class-d-sfc-30", "d-x-class-d-sfc-40"]);
});

test("the Chandler Municipal Class D under the Class B's 3,000 ft floor tops out at 2,999, charted -30", () => {
  const a = (JSON.parse(readFileSync(new URL("../data/phoenix/area.json", import.meta.url), "utf8")) as AirspaceFile).areas.find((x) => x.id === "d-chandler-municipal-airport-class-d")!;
  assert.equal(a.ceiling, 2999);
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

for (const name of readdirSync(new URL("../data/", import.meta.url))) {
  test(`built ${name} data: its charts exist, the TAC and area chart inside the area, and unique area ids`, () => {
    const dir = new URL(`../data/${name}/`, import.meta.url);
    const f: AirspaceFile = JSON.parse(readFileSync(new URL("area.json", dir), "utf8"));
    const { sectional, tac, low, area } = f.charts;
    for (const url of [sectional, tac?.url, low, area?.url]) if (url) assert.ok(existsSync(new URL(url, dir)), `${name}: ${url}`);
    for (const b of [tac?.bounds, area?.bounds]) if (b) assert.ok(b.s >= f.bounds.s && b.n <= f.bounds.n && b.w >= f.bounds.w && b.e <= f.bounds.e && b.s < b.n && b.w < b.e, `${name}: ${JSON.stringify(b)}`);
    assert.ok(f.areas.some((a) => a.kind === "B" || a.kind === "C" || a.kind === "D"), `${name}: no towered airspace`);
    // The 700 ft sheet and the DCA ring (a line on the ground) have no height; every other volume's ceiling is above its floor.
    for (const v of f.areas) assert.ok(v.kind === "E700" || v.kind === "DC60" ? v.ceiling === v.floor : v.ceiling > v.floor, `${name}: ${v.name} ${v.floor} to ${v.ceiling}`);
    const ids = f.areas.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
  });
}

test("built data: DC's SFRA and FRZ, R-4001A to the top, Luke's SATR, and Dahlonega's alert area clear of the hills", () => {
  const f = (name: string): AirspaceFile => JSON.parse(readFileSync(new URL(`../data/${name}/area.json`, import.meta.url), "utf8"));
  const dc = f("washington"), phx = f("phoenix"), atl = f("atlanta");
  assert.deepEqual(dc.areas.filter((a) => a.kind === "SFRA").map((a) => a.name.match(/\((.+)\)/)?.[1]).sort(), ["DC FRZ", "DC SFRA"]);
  assert.equal(dc.areas.find((a) => a.name === "R-4001A")?.ceiling, 18000);
  assert.ok(phx.areas.some((a) => a.kind === "SATR" && a.name.includes("LUKE")));
  // 700 AGL over ground that reaches past 2,000 ft: drawn over the highest ground under it, not the area's 1,026.
  assert.ok(atl.areas.find((a) => a.name === "A-685")!.ceiling > 2700);
});

test("a 60 NM circle is 60 NM from its centre all round", () => {
  const c = circle(38.86, -77.04, 60);
  assert.equal(c.length, 120);
  for (const [lat, lon] of c) {
    const nm = Math.hypot((lat - 38.86) * 60, (lon + 77.04) * 60 * Math.cos((38.86 * Math.PI) / 180));
    assert.ok(Math.abs(nm - 60) < 0.05, String(nm));
  }
});

test("built data: only US airspace, no park outlines, and the DCA 60 NM ring around Washington", () => {
  const f = (name: string): AirspaceFile => JSON.parse(readFileSync(new URL(`../data/${name}/area.json`, import.meta.url), "utf8"));
  for (const name of readdirSync(new URL("../data/", import.meta.url))) {
    if (!existsSync(new URL(`../data/${name}/area.json`, import.meta.url))) continue;
    assert.ok(!f(name).areas.some((a) => /TIJUANA|TCA|CTLZ/.test(a.name)), name);
    assert.ok(!f(name).areas.some((a) => (a.kind as string) === "PARK"), name);
  }
  const ring = f("washington").areas.filter((a) => a.kind === "DC60");
  assert.equal(ring.length, 1);
});
