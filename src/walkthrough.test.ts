import assert from "node:assert/strict";
import { test } from "node:test";
import { answered, back, begin, moved, next, play, pause, stepSeconds, tick, type Walkthrough } from "./walkthrough.js";

const w: Walkthrough = {
  id: "w",
  title: "W",
  area: "KPHX",
  steps: [
    { caption: "x".repeat(10), scene: {} },
    { caption: "x".repeat(50), scene: {}, check: { type: "read", prompt: "?", choices: ["a", "b"], answer: 0 } },
    { caption: "", scene: {} },
  ],
};

test("step length from the caption", () => {
  assert.equal(stepSeconds({ caption: "x".repeat(50), scene: {} }), 7);
  assert.equal(stepSeconds({ caption: "", scene: {}, seconds: 2.5 }), 2.5);
});
test("starts paused on step 1 and nothing moves until play", () => {
  const p = tick(begin(), w, 10);
  assert.deepEqual([p.step, p.t, p.playing, p.started], [0, 0, false, false]);
});
test("playing runs each step for its length, then the next", () => {
  let p = play(begin());
  p = tick(p, w, 5);
  assert.deepEqual([p.step, p.t], [1, 0]);
});
test("a quick check pauses at the end of its step until answered, then plays on", () => {
  let p = tick(tick(play(begin()), w, 5), w, 7);
  assert.deepEqual([p.step, p.checking, p.playing], [1, true, false]);
  p = tick(p, w, 30);
  assert.equal(p.step, 1);
  p = answered(p, w);
  assert.deepEqual([p.step, p.checking, p.playing], [2, false, true]);
});
test("the last step ends paused and done; a one-step walkthrough too", () => {
  const p = tick(answered(tick(tick(play(begin()), w, 5), w, 7), w), w, 4);
  assert.deepEqual([p.done, p.playing], [true, false]);
  const one = { ...w, steps: [w.steps[0]] };
  assert.equal(tick(play(begin()), one, 5).done, true);
});
test("back and next jump whole steps and keep play or pause", () => {
  const p = next(play(begin()), w);
  assert.deepEqual([p.step, p.t, p.playing], [1, 0, true]);
  assert.equal(back(back(p, w), w).step, 0);
  assert.equal(next(next(next(p, w), w), w).done, true);
});
test("back from the end replays the last step", () => {
  const end = next(next(next(play(begin()), w), w), w);
  assert.equal(end.done, true);
  assert.deepEqual([back(end, w).step, back(end, w).done], [w.steps.length - 1, false]);
});
test("dragging pauses; play resumes from the step's start", () => {
  let p = moved(tick(play(begin()), w, 2));
  assert.deepEqual([p.playing, p.moved], [false, true]);
  p = play(p);
  assert.deepEqual([p.playing, p.moved, p.t], [true, false, 0]);
});
test("next skips a step's check; answering the last step is done; play after done restarts", () => {
  let p = next(play(begin()), w);
  p = next(p, w);
  assert.deepEqual([p.step, p.checking], [2, false]);
  const last = answered({ ...begin(), step: 2, checking: true }, w);
  assert.deepEqual([last.done, last.playing], [true, false]);
  p = play(last);
  assert.deepEqual([p.step, p.done, p.playing], [0, false, true]);
});
test("pause stops the clock and every transition returns a new Play", () => {
  const a = play(begin());
  const b = pause(a);
  assert.deepEqual([a.playing, b.playing], [true, false]);
  assert.notEqual(a, b);
  assert.notEqual(tick(b, w, 1), b);
  assert.deepEqual(tick(b, w, 1), b);
});
test("hold stops at the step's end and Next goes on", () => {
  let p = play(begin());
  p = tick(p, w, 100, true);
  assert.equal(p.step, 0);
  assert.equal(p.playing, false);
  assert.equal(p.t, stepSeconds(w.steps[0]));
  assert.equal(next(p, w).step, 1);
  // Play from a held end moves on with the next tick.
  assert.equal(play(p).playing, true);
  assert.equal(tick(play(p), w, 0.01, true).step, 1);
});
test("hold never swallows a check", () => {
  const p = tick({ ...play(begin()), step: 1 }, w, 100, true);
  assert.equal(p.checking, true);
});
