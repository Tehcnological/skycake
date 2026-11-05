import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AirspaceFile } from "./airspace.js";
import { SceneError, firstScene, framedOnly, freeRoamScene, resolve, shorthand } from "./scene.js";

const data: AirspaceFile = JSON.parse(readFileSync(new URL("../data/phoenix/area.json", import.meta.url), "utf8"));

test("free roam starts with every type in the area raised, framed on the whole chart", () => {
  const r = resolve(freeRoamScene(data), data);
  assert.equal(r.camera, "fit");
  assert.equal(r.raised.size, data.areas.length);
  assert.deepEqual([r.diagram, r.height, r.tags, r.procedures], [null, 1, true, []]);
});

test("raise takes kinds and single areas; an unknown area, diagram or procedure throws", () => {
  const r = resolve({ raise: ["D", { area: "b-phoenix-class-b-sfc-90" }] }, data);
  assert.ok(r.raised.has("d-chandler-municipal-airport-class-d") && r.raised.has("b-phoenix-class-b-sfc-90"));
  assert.ok(![...r.raised].some((id) => id.startsWith("e700-") || id.startsWith("r-")));
  assert.throws(() => resolve({ raise: [{ area: "nope" }] }, data), SceneError);
  assert.throws(() => resolve({ diagram: "KDVT" }, data), SceneError);
  assert.throws(() => resolve({ procedures: [{ airport: "KPHX", name: "NOPE 1" }] }, data), SceneError);
  assert.deepEqual(resolve({ procedures: [{ airport: "KPHX", name: "EAGUL6", draw: true }] }, data).procedures, [{ airport: "KPHX", name: "EAGUL6" }]);
});

test("the old options still work as a first scene", () => {
  assert.equal(shorthand({}, data), undefined);
  const s = shorthand({ types: ["B"], airport: "KSDL", approach: "RNAV (RNP) Z RWY 03" }, data)!;
  assert.deepEqual(s.raise, ["B"]);
  assert.deepEqual(s.procedures, [{ airport: "KSDL", name: "RNAV (RNP) Z RWY 03" }]);
});

test("the approach shorthand frames the approach", () => {
  const s = shorthand({ approach: "ILS RWY 25L" }, data)!;
  assert.deepEqual(s.camera, { frame: [{ procedure: { airport: "KPHX", name: "ILS RWY 25L" } }] });
});

test("a first scene with a name the data no longer has falls back to free roam and says why", () => {
  const said: string[] = [];
  const s = firstScene({ approach: "ILS OR LOC RWY 25L" }, data, (m) => said.push(m));
  assert.deepEqual(s, freeRoamScene(data));
  assert.match(said[0], /ILS OR LOC RWY 25L/);
  assert.deepEqual(firstScene({ types: ["D"] }, data, () => assert.fail("no warning")).raise, ["D"]);
  assert.equal(resolve({ camera: null }, data).camera, null);
});

test("camera targets are checked like every other name", () => {
  assert.throws(() => resolve({ camera: { frame: [{ area: "nope" }] } }, data), SceneError);
  assert.throws(() => resolve({ camera: { frame: [{ diagram: "KDVT" }] } }, data), SceneError);
  assert.throws(() => resolve({ camera: { frame: [{ procedure: { airport: "KPHX", name: "NOPE 1" } }] } }, data), SceneError);
  assert.doesNotThrow(() => resolve({ camera: { frame: [{ area: "b-phoenix-class-b-sfc-90" }, { diagram: "KPHX" }, { point: [33.4, -112] }] } }, data));
  const said: string[] = [];
  assert.deepEqual(firstScene({ scene: { camera: { frame: [{ area: "gone" }] } } }, data, (m) => said.push(m)), freeRoamScene(data));
  assert.match(said[0], /gone/);
});

test("procedures the camera frames but the scene does not show are listed for loading", () => {
  const ils = { airport: "KPHX", name: "ILS RWY 25L" }, eagul = { airport: "KPHX", name: "EAGUL6" };
  assert.deepEqual(framedOnly({ camera: { frame: [{ procedure: ils }] } }), [ils]);
  assert.deepEqual(framedOnly({ procedures: [ils], camera: { frame: [{ procedure: ils }, { procedure: eagul }, { diagram: "KPHX" }] } }), [eagul]);
  assert.deepEqual(framedOnly({ camera: "fit" }), []);
  assert.deepEqual(framedOnly({}), []);
});

test("the chart: the TAC (sectional outside it) unless a scene asks for the sectional, or the area has no TAC", () => {
  assert.equal(resolve({}, data).chart, "tac");
  assert.equal(resolve({ chart: "sectional" }, data).chart, "sectional");
  assert.equal(resolve({ chart: "tac" }, { ...data, charts: { sectional: "s.webp" } }).chart, "sectional");
});
