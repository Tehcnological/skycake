import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { boundsOf, fitLabels, frame, labelValue, latLon, northUp, type Label } from "./diagram.js";
import type { AirspaceFile } from "./airspace.js";
import { nm } from "./cifp.js";

// Tick label centers on the KPHX airport diagram (d-TPP 2611), which is printed with north to the left.
const PHX: Label[] = [
  { x: 108.0, y: 532.8, text: "33°26.5'N" },
  { x: 208.9, y: 532.8, text: "33°26.0'N" },
  { x: 309.7, y: 532.8, text: "33°25.5'N" },
  { x: 364.4, y: 105.1, text: "111°59.5'W" },
  { x: 364.4, y: 189.7, text: "112°00.0'W" },
  { x: 364.4, y: 274.2, text: "112°00.5'W" },
  { x: 364.4, y: 358.8, text: "112°01.0'W" },
  { x: 364.4, y: 443.3, text: "112°01.5'W" },
  { x: 364.4, y: 527.9, text: "112°02.0'W" },
  { x: 230, y: 160, text: "258°" },
];

test("tick labels read as degrees; other text doesn't", () => {
  assert.deepEqual(labelValue("33°26.5'N"), { kind: "lat", value: 33 + 26.5 / 60 });
  assert.deepEqual(labelValue("112°02.0'W"), { kind: "lon", value: -(112 + 2 / 60) });
  assert.deepEqual(labelValue("33°26'N"), { kind: "lat", value: 33 + 26 / 60 });
  assert.equal(labelValue("258°"), null);
  assert.equal(labelValue("0.1° W"), null);
});

test("KPHX: the fit puts runway 7L's threshold where the diagram draws it, and turns the page north up", () => {
  const f = fitLabels(PHX)!;
  assert.ok(f && f.error < 30, `worst label ${f?.error} ft off`);
  assert.equal(northUp(f), 90);
  // Runway 7L threshold from the CIFP; on the 200 dpi render its runway end sits at pixel (655, 1290), page point (235.8, 464.4).
  const [lat, lon] = latLon(f, 235.8, 464.4);
  assert.ok(nm(lat, lon, 33.43106, -112.0271) * 6076 < 60, `${Math.round(nm(lat, lon, 33.43106, -112.0271) * 6076)} ft off`);
  const b = boundsOf(f, 50, 40, 360, 550);
  assert.ok(b.s < 33.43 && b.n > 33.44 && b.w < -112.03 && b.e > -111.99);
});

test("labels that don't make a true-north, true-scale map are refused", () => {
  assert.equal(fitLabels(PHX.filter((l) => l.text.endsWith("W"))), null);
  // One latitude label moved 10 points: about 300 ft.
  assert.equal(fitLabels(PHX.map((l) => (l.text === "33°26.0'N" ? { ...l, x: l.x + 10 } : l))), null);
  // Longitude labels squeezed together: the two scales disagree.
  assert.equal(fitLabels(PHX.map((l) => (l.text.endsWith("W") ? { ...l, y: 300 + (l.y - 300) * 0.8 } : l))), null);
});

test("the frame is the outermost long dark lines", () => {
  const w = 100, h = 80, px = new Uint8Array(w * h * 4).fill(255);
  const ink = (x: number, y: number) => px.set([0, 0, 0, 255], (y * w + x) * 4);
  for (let x = 5; x < 95; x++) [10, 70].forEach((y) => ink(x, y));
  for (let y = 10; y <= 70; y++) [5, 94].forEach((x) => ink(x, y));
  for (let x = 20; x < 30; x++) ink(x, 40); // a short line inside doesn't count
  assert.deepEqual(frame(px, w, h), [8, 13, 91, 67]);
});

test("built diagrams: each file exists and its area holds its airport", () => {
  const f: AirspaceFile = JSON.parse(readFileSync(new URL("../data/phoenix/area.json", import.meta.url), "utf8"));
  const withDiagram = f.airports.filter((a) => a.diagram);
  assert.ok(withDiagram.some((a) => a.id === "KPHX"));
  for (const a of withDiagram) {
    assert.ok(existsSync(new URL(`../data/phoenix/${a.diagram!.url}`, import.meta.url)), a.id);
    const b = a.diagram!.bounds;
    assert.ok(a.lat > b.s && a.lat < b.n && a.lon > b.w && a.lon < b.e, a.id);
    assert.ok(nm(b.s, b.w, b.n, b.e) < 5, `${a.id} diagram spans ${nm(b.s, b.w, b.n, b.e)} NM`);
  }
});
