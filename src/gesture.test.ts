import { test } from "node:test";
import assert from "node:assert/strict";
import { isTap, twoFingers, type Pt } from "./gesture.js";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
/** Runs a gesture from its first two finger positions and returns what the last step did. */
const run = (...frames: [Pt, Pt][]) => {
  const step = twoFingers(frames[0][0], frames[0][1]);
  return frames.slice(1).map(([a, b]) => step(a, b));
};

test("spreading the fingers to twice the distance zooms in twice, about their midpoint", () => {
  const [first, m] = run([[100, 100], [200, 100]], [[80, 100], [220, 100]], [[50, 100], [250, 100]]);
  assert.ok(first && first.kind === "shape");
  assert.ok(m && m.kind === "shape");
  near(m.zoom, 200 / 140);
  near(m.twist, 0);
  assert.deepEqual(m.mid, [150, 100]);
});

test("a clockwise twist on screen is a positive turn, the same size as the fingers' turn", () => {
  // Past the threshold on the first step, then a quarter turn clockwise (screen y runs down).
  const [, m] = run([[100, 100], [200, 100]], [[100, 100], [200, 120]], [[150, 50], [150, 150]]);
  assert.ok(m && m.kind === "shape");
  near(m.twist, Math.PI / 2 - Math.atan2(20, 100));
});

test("a twist across the left of the circle stays small, not nearly a full turn", () => {
  const [, m] = run([[300, 100], [100, 100]], [[300, 100], [100, 84]], [[300, 100], [100, 116]]);
  assert.ok(m && m.kind === "shape");
  assert.ok(Math.abs(m.twist) < 0.3, `twist ${m.twist}`);
});

test("both fingers moving up together tilt, and stay a tilt through some drift", () => {
  const [a, b] = run([[100, 300], [200, 300]], [[100, 280], [200, 281]], [[100, 270], [215, 271]]);
  assert.deepEqual(a, { kind: "tilt", dy: -19.5 });
  assert.deepEqual(b, { kind: "tilt", dy: -10 });
});

test("a pinch moving a little with the hand stays a pinch", () => {
  const [a, b] = run([[100, 300], [200, 300]], [[80, 300], [220, 300]], [[78, 285], [222, 285]]);
  assert.equal(a?.kind, "shape");
  assert.equal(b?.kind, "shape");
});

test("a swipe misread as a pinch at a jerky start corrects itself to a tilt", () => {
  const [a, b] = run([[100, 300], [200, 300]], [[100, 270], [200, 295]], [[100, 240], [200, 262]]);
  assert.equal(a?.kind, "shape");
  assert.equal(b?.kind, "tilt");
});

test("a pinch that becomes a clear swipe becomes a tilt", () => {
  const [a, b, c] = run([[100, 300], [200, 300]], [[80, 300], [220, 300]], [[80, 260], [220, 260]], [[80, 220], [220, 220]]);
  assert.equal(a?.kind, "shape");
  assert.equal(b?.kind, "tilt");
  assert.deepEqual(c, { kind: "tilt", dy: -40 });
});

test("a tilt that spreads clearly apart becomes a pinch", () => {
  const [a, b] = run([[100, 300], [200, 300]], [[100, 280], [200, 280]], [[70, 275], [230, 275]]);
  assert.equal(a?.kind, "tilt");
  assert.ok(b && b.kind === "shape");
  near(b.zoom, 160 / 100);
});

test("reversing a tilt stays a tilt", () => {
  const [a, b, c] = run([[100, 300], [200, 300]], [[100, 270], [200, 270]], [[100, 285], [200, 285]], [[100, 300], [200, 300]]);
  assert.equal(a?.kind, "tilt");
  assert.equal(b?.kind, "tilt");
  assert.equal(c?.kind, "tilt");
});

test("fingers moving up at different ends of a pinch are a pinch, not a tilt", () => {
  const [a] = run([[100, 300], [100, 400]], [[100, 280], [100, 430]]);
  assert.equal(a?.kind, "shape");
});

test("a swipe with one finger starting late still tilts, carrying the movement so far", () => {
  const [a, b, c] = run([[100, 300], [200, 300]], [[100, 290], [200, 300]], [[100, 275], [200, 288]], [[100, 265], [200, 277]]);
  assert.equal(a, null);
  assert.equal(b, null);
  assert.deepEqual(c, { kind: "tilt", dy: -29 });
});

test("a pinch drifting up with the hand stays a pinch", () => {
  const [a, b] = run([[100, 300], [200, 300]], [[95, 288], [205, 288]], [[90, 278], [210, 278]]);
  assert.equal(a, null);
  assert.equal(b?.kind, "shape");
});

test("one finger moving alone, with the other held still, is a pinch", () => {
  const [a] = run([[100, 300], [200, 300]], [[100, 280], [200, 300]]);
  assert.equal(a?.kind, "shape");
});

test("two fingers sliding sideways together end the wait, as a move and not a tilt", () => {
  const [a] = run([[100, 300], [200, 300]], [[135, 300], [235, 300]]);
  assert.equal(a?.kind, "shape");
});

test("a few pixels of jitter do nothing until the gesture shows what it is", () => {
  const [a, b] = run([[100, 300], [200, 300]], [[101, 301], [199, 299]], [[100, 298], [201, 301]]);
  assert.equal(a, null);
  assert.equal(b, null);
});

test("the step that decides carries the movement so far", () => {
  const [a] = run([[100, 100], [200, 100]], [[90, 100], [210, 100]]);
  assert.ok(a && a.kind === "shape");
  near(a.zoom, 120 / 100);
});

test("a tap is one finger, barely moved, soon lifted", () => {
  assert.equal(isTap({ fingers: 1, moved: 3, ms: 120 }), true);
  assert.equal(isTap({ fingers: 1, moved: 20, ms: 120 }), false, "a drag");
  assert.equal(isTap({ fingers: 1, moved: 3, ms: 900 }), false, "a long press");
  assert.equal(isTap({ fingers: 2, moved: 0, ms: 120 }), false, "the end of a pinch");
});
