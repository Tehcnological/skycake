import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Point, Procedure } from "./procedure.js";
import { along, flightLine } from "./fly.js";

const missed: Point[] = [[33, -111.8, 1500], [33, -111.7, 5000]];
const proc: Procedure = {
  airport: "KTST", type: "IAP", name: "TEST", fixes: [], course: null, glidepath: null, fafToMap: null,
  paths: [
    { seg: "transition", pts: [[33, -112, 6000], [33, -111.95, 5000]] },
    { seg: "common", pts: [[33, -111.95, 5000], [33, -111.9, 4000]] },
    { seg: "final", pts: [[33, -111.9, 4000], [33, -111.85, 3000], [33, -111.8, 1500]] },
    { seg: "missed", pts: missed },
  ],
};
const missedOnly: Procedure = { ...proc, paths: [{ seg: "missed", pts: missed }] };

test("the flight line is transition, common, final; the missed approach is left out", () => {
  assert.deepEqual(flightLine(proc).map((p) => p[2]), [6000, 5000, 4000, 3000, 1500]);
});
test("along goes by distance and clamps", () => {
  const line: Point[] = [[33, -112, 1000], [33, -111.9, 2000], [33, -111.7, 4000]];
  assert.deepEqual(along(line, 0), line[0]);
  assert.deepEqual(along(line, 1), line[2]);
  assert.ok(Math.abs(along(line, 1 / 3)[1] - -111.9) < 1e-9);
  assert.deepEqual(along(line, 2), line[2]);
});
test("a procedure with only a missed approach flies from its first point", () => {
  assert.deepEqual(flightLine(missedOnly), [missedOnly.paths[0].pts[0]]);
});
test("a real SID flies runway leg, common route, then its enroute transition", () => {
  // data/phoenix/procedures/KSDL.json, BNYRD6: in the file, vectors, then common, then the transition.
  const bnyrd = JSON.parse(readFileSync(new URL("../data/phoenix/procedures/KSDL.json", import.meta.url), "utf8")).find((p: Procedure) => p.name.startsWith("BNYRD"));
  const line = flightLine(bnyrd);
  assert.deepEqual(line[0].slice(0, 2), [33.62288, -111.91053]);
  assert.deepEqual(line.at(-1), [32.0952, -110.91486, 4510]);
  assert.ok(line.findIndex((p) => p[0] === 32.88586) < line.length - 1); // the common route's end comes before the transition's end
});
