import assert from "node:assert/strict";
import { test } from "node:test";
import { locator, questionScene, revealScene, score, typedNumber, type Locate, type Question } from "./question.js";

const at: Locate = (t) => ("fix" in t && t.fix === "SCADE" ? [33.4, -112.2] : "airport" in t && t.airport === "KCHD" ? [33.27, -111.81] : null);
test("each type scores right and wrong", () => {
  const read = { type: "read", prompt: "", choices: ["A", "B"], answer: 1 } satisfies Question;
  assert.equal(score(read, { choice: 1 }, at), true);
  assert.equal(score(read, { choice: 0 }, at), false);
  const num = { type: "read", prompt: "", number: { answer: 5000, tolerance: 100, unit: "ft" } } satisfies Question;
  assert.equal(score(num, { number: 5099 }, at), true);
  assert.equal(score(num, { number: 5101 }, at), false);
  const area = { type: "find", prompt: "", answer: { area: "d-chandler-municipal-airport-class-d" } } satisfies Question;
  assert.equal(score(area, { area: "d-chandler-municipal-airport-class-d", at: null }, at), true);
  assert.equal(score(area, { area: "b-phoenix-class-b-sfc-90", at: null }, at), false);
  const fix = { type: "find", prompt: "", answer: { fix: "SCADE" } } satisfies Question;
  assert.equal(score(fix, { area: null, at: [33.4, -112.2 + 1.4 / 60 / Math.cos((33.4 * Math.PI) / 180)] }, at), true); // 1.4 NM east
  assert.equal(score(fix, { area: null, at: [33.4, -112.2 + 1.6 / 60 / Math.cos((33.4 * Math.PI) / 180)] }, at), false);
  assert.equal(score(fix, { area: null, at: null }, at), false);
  assert.equal(score({ type: "find", prompt: "", answer: { airport: "KCHD" } }, { area: null, at: [33.27, -111.81] }, at), true);
});
test("default scenes per type, with the question's own fields winning", () => {
  assert.deepEqual(questionScene({ type: "find", prompt: "", answer: { airport: "KCHD" } }), { camera: "top", raise: [], tags: false });
  assert.deepEqual(questionScene({ type: "find", prompt: "", answer: { airport: "KCHD" }, scene: { raise: ["D"] } }).raise, ["D"]);
  const read = questionScene({ type: "read", prompt: "", choices: ["a", "b"], answer: 0, scene: { highlight: [{ area: "x" }] } });
  assert.deepEqual([read.raise, read.camera], [[], { frame: [{ area: "x" }], tilt: 90 }]); // top-down, flat, to read the chart
  const plane = questionScene({ type: "airplane", prompt: "", choices: ["a", "b"], answer: 0, scene: { airplane: { at: [33.4, -112, 4500] } } });
  assert.equal((plane.camera as { tilt: number }).tilt, 90);
  assert.equal((plane.camera as { frame: unknown[] }).frame.length, 4);
  const proc = questionScene({ type: "procedure", prompt: "", choices: ["a", "b"], answer: 0, scene: { procedures: [{ airport: "KCHD", name: "I04R" }] } });
  assert.deepEqual(proc.camera, { frame: [{ procedure: { airport: "KCHD", name: "I04R" } }] });
});
test("a find question's also areas score right too, and rise with the answer", () => {
  const q = { type: "find", prompt: "", answer: { area: "b-1" }, also: ["b-2"] } satisfies Question;
  const none: Locate = () => null;
  assert.deepEqual([score(q, { area: "b-1", at: null }, none), score(q, { area: "b-2", at: null }, none), score(q, { area: "b-3", at: null }, none)], [true, true, false]);
  assert.deepEqual(revealScene(q).raise, [{ area: "b-1" }, { area: "b-2" }]);
});
test("the reveal raises the answer and tilts to 3D", () => {
  const q = { type: "read", prompt: "", choices: ["a", "b"], answer: 0, scene: { highlight: [{ area: "x" }] } } satisfies Question;
  assert.deepEqual([revealScene(q).raise, revealScene(q).camera, revealScene(q).tags], [[{ area: "x" }], { frame: [{ area: "x" }], tilt: 32 }, true]);
  const f = revealScene({ type: "find", prompt: "", answer: { area: "y" } });
  assert.deepEqual([f.raise, f.camera], [[{ area: "y" }], { frame: [{ area: "y" }], tilt: 32 }]);
  // An airplane's class area rises, with the camera still on the airplane.
  const plane = { type: "airplane", prompt: "", choices: ["a", "b"], answer: 0, scene: { airplane: { at: [33.4, -112, 4500] } } } satisfies Question;
  const p = revealScene({ ...plane, answerArea: "b-1" });
  assert.deepEqual([p.raise, (p.camera as { frame: unknown[] }).frame.length, p.tags], [[{ area: "b-1" }], 4, true]);
  assert.deepEqual(revealScene(plane).raise, []);
  assert.equal(questionScene({ type: "find", prompt: "", answer: { fix: "ZINGA" } }).tags, true);
  assert.equal(questionScene({ type: "find", prompt: "", answer: { area: "y" } }).tags, false);
  // A malformed find question (no answer) still reveals, on the question's own scene.
  assert.deepEqual(revealScene({ type: "find", prompt: "" } as unknown as Question).raise, []);
});

test("locator finds loaded procedure fixes first, then waypoints, airports and points", () => {
  const data = { airports: [{ id: "KCHD", lat: 33.27, lon: -111.81 }], waypoints: [{ name: "BXK", lat: 33.45, lon: -112.82, ft: 6000 }, { name: "SCADE", lat: 1, lon: 1, ft: 0 }] } as never;
  const procs = [{ fixes: [{ name: "SCADE", lat: 33.4, lon: -112.2 }] }] as never;
  const at = locator(data, procs);
  assert.deepEqual(at({ fix: "SCADE" }), [33.4, -112.2]);
  assert.deepEqual(at({ fix: "BXK" }), [33.45, -112.82]);
  assert.deepEqual(at({ airport: "KCHD" }), [33.27, -111.81]);
  assert.deepEqual(at({ point: [33, -112] }), [33, -112]);
  assert.equal(at({ fix: "NOPE" }), null);
  assert.equal(at({ area: "x" }), null);
});
test("a malformed question scores false with a warning, never a throw", () => {
  const warn = console.warn, said: unknown[] = [];
  console.warn = (...a: unknown[]) => void said.push(a);
  try {
    assert.equal(score({ type: "find", prompt: "" } as never, { area: "x", at: null }, at), false);
    assert.equal(score({ type: "read", prompt: "", answer: 0 } as never, { area: "x", at: null }, at), false);
    assert.equal(score({ type: "read", prompt: "", number: null } as never, { number: 1 }, at), false);
  } finally {
    console.warn = warn;
  }
  assert.equal(said.length, 3);
});
test("a typed number drops commas and spaces; anything else is no number", () => {
  assert.deepEqual(["3,000", " 3 000 ", "4500", "-1.5", "12abc", "", "  ", "Infinity"].map(typedNumber), [3000, 3000, 4500, -1.5, null, null, null, null]);
});
