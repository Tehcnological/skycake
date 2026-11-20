import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Procedure } from "./procedure.js";
import type { Scene } from "./scene.js";
import { add, fixTags, pickAirport, raiseNow, remove, sceneOf, start, toggleDiagram } from "./roam.js";

const phx: Procedure[] = JSON.parse(readFileSync(new URL("../data/phoenix/procedures/KPHX.json", import.meta.url), "utf8"));
const first: Scene = { raise: ["B", "C", "D"], camera: "fit" };
const eagul = { airport: "KPHX", name: "EAGUL6" }, ils = { airport: "KPHX", name: "ILS RWY 25L" }, rnp = { airport: "KSDL", name: "RNAV (RNP) Z RWY 03" };

test("procedures add up, from any airport, without repeats", () => {
  let r = add(add(add(start(first), eagul), ils), eagul);
  assert.deepEqual(r.procedures, [eagul, ils]);
  r = add(r, rnp);
  assert.deepEqual(r.procedures.map((p) => p.airport), ["KPHX", "KPHX", "KSDL"]);
  assert.equal(r.airport, "KSDL");
  assert.deepEqual(sceneOf(r).procedures, [eagul, ils, rnp]);
  assert.deepEqual(sceneOf(r).camera, { frame: [{ procedure: eagul }, { procedure: ils }, { procedure: rnp }] });
});

test("removing the last one goes back to the first scene", () => {
  const r = remove(add(start(first), ils), ils);
  assert.deepEqual(sceneOf(r), first);
});

test("the diagram follows the current airport and turns off where there is none", () => {
  const has = (a: string) => a === "KPHX";
  let r = toggleDiagram(pickAirport(start(first), "KPHX", has), has);
  assert.equal(sceneOf(r).diagram, "KPHX");
  r = pickAirport(r, "KDVT", has);
  assert.equal(sceneOf(r).diagram, undefined);
  assert.equal(r.diagram, false);
});

test("a fix on two shown procedures gets one tag, the final's role and altitude winning", () => {
  // EAGUL6's runway 25L transition ends at GIPSE, which is on the ILS RWY 25L final
  const tags = fixTags([phx.find((p) => p.name === "EAGUL6")!, phx.find((p) => p.name === "ILS RWY 25L")!]);
  assert.equal(tags.filter((f) => f.name === "GIPSE").length, 1);
  assert.equal(tags.find((f) => f.name === "GIPSE")!.seg, "final");
});

test("the first scene's procedures and diagram are part of the state, with their own camera until something changes", () => {
  const withIls: Scene = { raise: ["B"], camera: { frame: [{ procedure: ils }] }, procedures: [ils], diagram: "KPHX" };
  let r = start(withIls);
  assert.deepEqual(r.procedures, [ils]);
  assert.equal(r.diagram, true);
  assert.equal(r.airport, "KPHX");
  assert.deepEqual(sceneOf(r).camera, withIls.camera);
  r = add(r, eagul);
  assert.deepEqual(sceneOf(r).procedures, [ils, eagul]);
  r = remove(r, ils);
  assert.deepEqual(sceneOf(r).procedures, [eagul]);
  r = toggleDiagram(r, () => true);
  assert.equal(sceneOf(r).diagram, undefined);
});

test("camera: an airport pick keeps it, the diagram keeps it, removing the last procedure goes back to the first view", () => {
  const has = (a: string) => a === "KPHX";
  let r = pickAirport(start(first), "KSDL", has);
  assert.equal(sceneOf(r).camera, null);
  r = toggleDiagram(pickAirport(r, "KPHX", has), has);
  assert.equal(sceneOf(r).camera, null);
  r = remove(add(r, ils), ils);
  assert.deepEqual(sceneOf(r).camera, "fit");
});

test("fix tags: the same runway fix name at two airports keeps both", () => {
  const sdl: Procedure[] = JSON.parse(readFileSync(new URL("../data/phoenix/procedures/KSDL.json", import.meta.url), "utf8"));
  const gyr: Procedure[] = JSON.parse(readFileSync(new URL("../data/phoenix/procedures/KGYR.json", import.meta.url), "utf8"));
  const a = sdl.find((p) => p.fixes.some((f) => f.name === "RW03"))!, b = gyr.find((p) => p.fixes.some((f) => f.name === "RW03"))!;
  assert.equal(fixTags([a, b]).filter((f) => f.name === "RW03").length, 2);
});

test("adding a procedure frames it, and turns off a diagram its airport does not have", () => {
  const has = (a: string) => a === "KPHX";
  let r = toggleDiagram(pickAirport(start(first), "KPHX", has), has);
  r = add(r, rnp, has);
  assert.deepEqual(sceneOf(r).camera, { frame: [{ procedure: rnp }] });
  assert.equal(r.airport, "KSDL");
  assert.equal(r.diagram, false);
});

test("turning the diagram on or off leaves the camera, even with procedures shown, while adding one still frames it", () => {
  let r = toggleDiagram(add(start(first), ils), () => true);
  assert.equal(r.diagram, true);
  assert.equal(sceneOf(r).camera, null);
  r = toggleDiagram(r, () => true);
  assert.equal(sceneOf(r).camera, null);
  assert.deepEqual(sceneOf(add(r, rnp)).camera, { frame: [{ procedure: ils }, { procedure: rnp }] });
});

test("a departure and an approach are never shown together; arrivals go with either", () => {
  const types: Record<string, "IAP" | "SID" | "STAR"> = { EAGUL6: "STAR", "ILS RWY 25L": "IAP", "RNAV (RNP) Z RWY 03": "IAP", BXK4: "SID" };
  const typeOf = (p: { name: string }) => types[p.name];
  const bxk = { airport: "KPHX", name: "BXK4" };
  let r = add(add(add(start(first), eagul, undefined, typeOf), ils, undefined, typeOf), rnp, undefined, typeOf);
  assert.deepEqual(r.procedures, [eagul, ils, rnp]);
  r = add(r, bxk, undefined, typeOf);
  assert.deepEqual(r.procedures, [eagul, bxk]);
  r = add(r, ils, undefined, typeOf);
  assert.deepEqual(r.procedures, [eagul, ils]);
  // Without types (a site's own scene), nothing is taken away.
  assert.deepEqual(add(r, bxk).procedures, [eagul, ils, bxk]);
});

test("the raise to use: the first scene's at first, then whatever is raised on screen", () => {
  assert.deepEqual(raiseNow(first, null), ["B", "C", "D"]);
  assert.deepEqual(raiseNow(first, ["d-chandler-class-d"]), [{ area: "d-chandler-class-d" }]);
  assert.deepEqual(raiseNow(first, []), []);
});
