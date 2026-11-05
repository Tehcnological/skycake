import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { boundsOf, fitLabels, frame, labelValue, latLon, northUp, readOutlines, type Glyph, type Label } from "./diagram.js";
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
  const expected = { phoenix: ["KPHX", "KTUS", "KDVT", "KGYR", "KIWA"], miami: ["KMIA", "KFLL", "KOPF", "KHWO"] };
  for (const [area, ids] of Object.entries(expected)) {
    const f: AirspaceFile = JSON.parse(readFileSync(new URL(`../data/${area}/area.json`, import.meta.url), "utf8"));
    const withDiagram = f.airports.filter((a) => a.diagram);
    for (const id of ids) assert.ok(withDiagram.some((a) => a.id === id), `${id} has no diagram`);
    for (const a of withDiagram) {
      assert.ok(existsSync(new URL(`../data/${area}/${a.diagram!.url}`, import.meta.url)), a.id);
      const b = a.diagram!.bounds;
      assert.ok(a.lat > b.s && a.lat < b.n && a.lon > b.w && a.lon < b.e, a.id);
      assert.ok(nm(b.s, b.w, b.n, b.e) < 5, `${a.id} diagram spans ${nm(b.s, b.w, b.n, b.e)} NM`);
    }
  }
});

// The 80°17'W label on the KMIA airport diagram (d-TPP 2611), each character an outline, reading up the page.
const glyph = (segs: number, subs: number, x0: number, x1: number, y0: number, y1: number): Glyph => ({ segs, subs, x0, x1, y0, y1 });
const MIA: Glyph[] = [
  glyph(124, 3, 23.11, 27.96, 340.21, 343.02),
  glyph(96, 2, 23.11, 27.96, 343.58, 346.73),
  glyph(32, 2, 23.27, 25.34, 347.23, 349.3),
  glyph(6, 1, 23.28, 27.87, 350.3, 351.61),
  glyph(6, 1, 23.28, 27.96, 353.37, 356.69),
  glyph(4, 1, 23.11, 24.9, 356.83, 358.02),
  glyph(10, 1, 23.11, 28.05, 358.27, 364.74),
];

test("a tick label drawn as outlines reads as text, centered on its tick, 1 and 7 told apart by width", () => {
  assert.deepEqual(readOutlines(MIA), [{ x: 25.58, y: 352.475, text: "80°17'W" }]);
});

test("a 6 and a 9 are the same outline, told apart by where the hole sits as the label reads", () => {
  // 25°49'N and 25°46'N, reading left to right, then the same turned to read up the page (y runs down).
  const label = (hole: "top" | "bottom"): Glyph[] => [
    glyph(46, 1, 0, 3, 0, 5), glyph(66, 1, 3.5, 6.5, 0, 5), glyph(32, 2, 7, 9, 0, 2), glyph(13, 2, 9.5, 12.5, 0, 5),
    { ...glyph(68, 2, 13, 16, 0, 5), hole: [14.5, hole === "top" ? 1.5 : 3.5] },
    glyph(4, 1, 16.5, 17.5, 0, 2), glyph(8, 1, 18, 22, 0, 5),
  ];
  assert.equal(readOutlines(label("top"))[0].text, "25°49'N");
  assert.equal(readOutlines(label("bottom"))[0].text, "25°46'N");
  // Turned a quarter left: page x = text y, page y = 100 - text x, so the top of the text points left.
  const turned = (l: Glyph[]): Glyph[] => l.map((g) => ({ ...g, x0: g.y0, x1: g.y1, y0: 100 - g.x1, y1: 100 - g.x0, hole: g.hole && [g.hole[1], 100 - g.hole[0]] }));
  assert.equal(readOutlines(turned(label("top")))[0].text, "25°49'N");
  assert.equal(readOutlines(turned(label("bottom")))[0].text, "25°46'N");
});

test("outlines read as a tick label only when they are one run of known characters", () => {
  const moved = MIA.map((g) => ({ ...g, x0: g.x0 + 100, x1: g.x1 + 100 }));
  // Two labels one after the other in the drawing order stay two labels.
  assert.equal(readOutlines([...MIA, ...moved]).length, 2);
  // A gap wider than the characters splits a label, so neither part reads.
  assert.deepEqual(readOutlines([...MIA.slice(0, 3), ...moved.slice(3)]), []);
  // An outline that isn't in the font's table.
  assert.deepEqual(readOutlines(MIA.map((g, i) => (i === 1 ? { ...g, segs: 95 } : g))), []);
  // Runway heading 272°: no minutes, not a label.
  assert.deepEqual(readOutlines([glyph(46, 1, 0, 2, 0, 3), glyph(6, 1, 0, 2, 3.5, 6), glyph(46, 1, 0, 2, 6.5, 9), glyph(32, 2, 0, 2, 9.5, 11)]), []);
});
