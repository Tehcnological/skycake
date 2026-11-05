import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chartsIn, modeOf, shownIn, type AirspaceFile } from "./airspace.js";
import { parseAirways } from "./airway.js";

const dms = (v: number, pos: string, neg: string, deg: number) => {
  const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 6000);
  return (v < 0 ? neg : pos) + String(d).padStart(deg, "0") + String(m).padStart(2, "0") + String(s).padStart(4, "0");
};
/** A CIFP enroute waypoint record, at its ARINC 424 columns. */
const fix = (name: string, lat: number, lon: number) => `SUSAEAENRT   ${name.padEnd(5)} K2`.padEnd(32) + dms(lat, "N", "S", 2) + dms(lon, "E", "W", 3);
/** A CIFP airway record: description code at column 40 (its second character "E" ends the airway), level at 46, minimums at 84 and 89. */
const leg = (route: string, seq: number, name: string, min = "", min2 = "", opts: { desc?: string; level?: string; area?: string } = {}) =>
  `S${opts.area ?? "USA"}ER`.padEnd(13) + route.padEnd(5) + "".padEnd(7) + String(seq).padStart(4, "0") + name.padEnd(5) + "K2" + "EA" + "0" + (opts.desc ?? "E   ").padEnd(4) + " O" + (opts.level ?? "L") + "".padEnd(37) + min.padEnd(5) + min2.padEnd(5);

const b = { s: 30, w: -112, n: 34, e: -108 };
const parse = (...lines: string[]) => parseAirways(lines.join("\r\n"), b);

test("each leg stands at the minimum on its first fix's record; the last fix's blank adds no leg", () => {
  const { airways, waypoints } = parse(fix("ONEEE", 31, -111), fix("TWOOO", 32, -110), fix("THREE", 33, -109), leg("V1", 10, "ONEEE", "08000"), leg("V1", 20, "TWOOO", "12000"), leg("V1", 30, "THREE", "", "", { desc: "EE  " }));
  assert.deepEqual(airways.map((a) => a.name), ["V1"]);
  assert.deepEqual(airways[0].legs.map((l) => l.ft), [8000, 12000]);
  assert.deepEqual(airways[0].legs[0].pts, [[31, -111], [32, -110]]);
  // A fix stands at the highest minimum of the legs meeting it.
  assert.deepEqual(waypoints.map((w) => [w.name, w.ft]), [["ONEEE", 8000], ["TWOOO", 12000], ["THREE", 12000]]);
});

test("where the two directions have different minimums, the leg stands at the higher", () => {
  const { airways } = parse(fix("ONEEE", 31, -111), fix("TWOOO", 32, -110), fix("THREE", 33, -109), leg("V1", 10, "ONEEE", "02100", "04000"), leg("V1", 20, "TWOOO", "09000", "06000"), leg("V1", 30, "THREE", "", "", { desc: "EE  " }));
  assert.deepEqual(airways[0].legs.map((l) => l.ft), [4000, 9000]);
});

test("a flight level reads in feet; an unknown minimum is kept as unknown, never made up", () => {
  const { airways, waypoints } = parse(fix("ONEEE", 31, -111), fix("TWOOO", 32, -110), fix("THREE", 33, -109), leg("Y1", 10, "ONEEE", "FL190", "", { level: " " }), leg("Y1", 20, "TWOOO", "UNKNN", "", { level: " " }), leg("Y1", 30, "THREE", "", "", { desc: "EE  ", level: " " }));
  assert.deepEqual(airways[0].legs.map((l) => l.ft), [19000, null]);
  assert.equal(waypoints.find((w) => w.name === "THREE")!.ft, null);
});

test("no leg across a break: a record marked as the end of a stretch does not join the next", () => {
  const { airways } = parse(fix("ONEEE", 31, -111), fix("TWOOO", 32, -110), fix("THREE", 33, -109), fix("FOURR", 33.5, -108.5), leg("V1", 10, "ONEEE", "08000"), leg("V1", 20, "TWOOO", "", "", { desc: "EE  " }), leg("V1", 30, "THREE", "09000"), leg("V1", 40, "FOURR", "", "", { desc: "EE  " }));
  assert.equal(airways[0].legs.length, 2);
  assert.deepEqual(airways[0].legs.map((l) => l.ft), [8000, 9000]);
});

test("high altitude airways are left out, and their fixes with them", () => {
  const { airways, waypoints } = parse(fix("ONEEE", 31, -111), fix("TWOOO", 32, -110), leg("J1", 10, "ONEEE", "18000", "", { level: "H" }), leg("J1", 20, "TWOOO", "", "", { desc: "EE  ", level: "H" }));
  assert.deepEqual(airways, []);
  assert.deepEqual(waypoints, []);
});

test("a leg is cut at the map's edge at its own height; only fixes on the map get a waypoint", () => {
  const { airways, waypoints } = parse(fix("INSID", 32, -110), fix("OUTSD", 32, -106), leg("V1", 10, "INSID", "08000"), leg("V1", 20, "OUTSD", "", "", { desc: "EE  " }));
  const [l] = airways[0].legs;
  assert.deepEqual(l.pts, [[32, -110], [32, -108]]);
  assert.equal(l.ft, 8000);
  assert.deepEqual(waypoints.map((w) => w.name), ["INSID"]);
});

test("a leg crossing the map with both fixes off it stays, with no waypoints; legs wholly off it go", () => {
  const { airways, waypoints } = parse(fix("WESTT", 32, -114), fix("EASTT", 32, -106), fix("FARRR", 40, -106), leg("V1", 10, "WESTT", "08000"), leg("V1", 20, "EASTT", "09000"), leg("V1", 30, "FARRR", "", "", { desc: "EE  " }));
  assert.equal(airways[0].legs.length, 1);
  assert.deepEqual(airways[0].legs[0].pts, [[32, -112], [32, -108]]);
  assert.deepEqual(waypoints, []);
});

test("a leg with a fix that has no position, or that jumps the date line, draws nothing", () => {
  const { airways } = parse(fix("ONEEE", 31, -111), fix("PACIF", 32, 170), leg("V1", 10, "ONEEE", "08000"), leg("V1", 20, "GHOST", "09000"), leg("V1", 30, "ONEEE", "09000"), leg("V1", 40, "PACIF", "", "", { desc: "EE  " }));
  assert.deepEqual(airways, []);
});

test("the same name under two area codes is one airway, without a leg between the two lists", () => {
  const { airways } = parse(fix("ONEEE", 31, -111), fix("TWOOO", 32, -110), fix("THREE", 33, -109), fix("FOURR", 33.5, -108.5), leg("A1", 10, "ONEEE", "08000", "", { area: "CAN" }), leg("A1", 20, "TWOOO", "", "", { area: "CAN" }), leg("A1", 10, "THREE", "09000"), leg("A1", 20, "FOURR", ""));
  assert.equal(airways.length, 1);
  assert.deepEqual(airways[0].legs.map((l) => l.ft), [8000, 9000]);
});

test("VFR and IFR: which charts each has and which airspace each shows", () => {
  const all = { sectional: "s", tac: { url: "t", bounds: b }, low: "l", area: { url: "a", bounds: b } };
  assert.equal(modeOf("tac"), "vfr");
  assert.equal(modeOf("sectional"), "vfr");
  assert.equal(modeOf("area"), "ifr");
  assert.equal(modeOf("low"), "ifr");
  assert.deepEqual(chartsIn(all, "vfr"), ["tac", "sectional"]);
  assert.deepEqual(chartsIn(all, "ifr"), ["area", "low"]);
  assert.deepEqual(chartsIn({ sectional: "s" }, "ifr"), []);
  for (const k of ["R", "P", "W", "MOA", "A"] as const) assert.equal(shownIn("ifr", k), true);
  for (const k of ["B", "C", "D", "E", "E700", "MODEC"] as const) {
    assert.equal(shownIn("ifr", k), false);
    assert.equal(shownIn("vfr", k), true);
  }
});

const built = (name: string): AirspaceFile => JSON.parse(readFileSync(new URL(`../data/${name}/area.json`, import.meta.url), "utf8"));

for (const name of ["phoenix", "miami"]) {
  test(`built ${name} data: low airways and their fixes, all on the map`, () => {
    const f = built(name);
    const on = ([lat, lon]: number[]) => lat >= f.bounds.s - 1e-4 && lat <= f.bounds.n + 1e-4 && lon >= f.bounds.w - 1e-4 && lon <= f.bounds.e + 1e-4;
    assert.ok(f.airways.length > 10);
    assert.ok(f.waypoints.length > 30);
    for (const a of f.airways) {
      assert.doesNotMatch(a.name, /^[JQ]\d/, "high altitude routes are left out");
      assert.ok(a.legs.length > 0);
      for (const l of a.legs) {
        assert.ok(l.pts.every(on), `${a.name} ${JSON.stringify(l.pts)}`);
        assert.ok(l.ft === null || (l.ft >= 1000 && l.ft <= 30000), `${a.name} MEA ${l.ft}`);
      }
    }
    assert.ok(f.waypoints.every((w) => on([w.lat, w.lon])));
  });
}

test("built Phoenix data: V105 leaves TORTS at 8,000 and every leg in the area has an MEA", () => {
  const f = built("phoenix");
  const v105 = f.airways.find((a) => a.name === "V105")!;
  const torts = f.waypoints.find((w) => w.name === "TORTS")!;
  assert.ok(v105.legs.some((l) => l.ft === 8000 && l.pts[0][0] === torts.lat && l.pts[0][1] === torts.lon));
  assert.ok(f.airways.flatMap((a) => a.legs).every((l) => l.ft !== null));
});

test("built Miami data: V3 reaches the map, and over-water routes without an MEA stay flat", () => {
  const f = built("miami");
  assert.ok(f.airways.some((a) => a.name === "V3"));
  assert.ok(f.airways.find((a) => a.name === "Y280")!.legs.every((l) => l.ft === null));
});
