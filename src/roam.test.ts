import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Procedure } from "./procedure.js";
import type { Scene } from "./scene.js";
import { add, fixTags, pickAirport, remove, sceneOf, start, toggleDiagram } from "./roam.js";

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
