# Walkthroughs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A site hands `mount()` a walkthrough and the view plays it like a video: captions, play/pause/back/next, camera moves, highlighted targets, procedures drawn leg by leg, a flying airplane and quick-check questions, ending on Explore or the site's Next.

**Architecture:** The scene gains the three fields free roam never used (`highlight`, `airplane`, `draw`), resolved and checked in `scene.ts` and drawn by `viewer.ts`, which also takes a step timeline `t` (0 to 1) for drawing and flying. Questions and their shared card come first (`question.ts`, `card.ts`) because quick checks use them; the quiz plan reuses both. The player's timing is a pure state machine (`walkthrough.ts`); `player.ts` builds its DOM and drives the viewer. `validate.ts` checks a walkthrough against the area data in Node, for instrumentready.com's `npm run validate`.

**Tech Stack:** TypeScript 5.9, three.js 0.180.0 (peer), node:test via tsx, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-04-skycake-ux-design.md` (sections "Shared: the scene", "Layout (all modes)", "Walkthroughs", "Quizzes / Question types" for the card, "Embedding", "Accessibility", "Testing").

This is plan 2 of 3 (plan 1: `2026-11-04-scene-and-free-roam.md`, done). Plan 3, quizzes (`2026-11-07-quizzes.md`), builds on `question.ts`, `card.ts` and the viewer's tap hook from this one.

## Global Constraints

- No em dashes anywhere, in code, comments, copy or commits.
- Every on-screen word comes from `Labels` and can be overridden through `mount({ labels })`; new words are placeholders for Chris.
- Every control at least 44 px; neighbouring controls match in height and style. Desktop above 860 px wide; phone at or below: the player is the 76 px bar along the bottom, in place of the tab bar.
- The caption line "FAA ... <edition> · Not for navigation" stays on screen in every mode. No acceptance gate.
- Camera change animates 0.7 s, raising and lowering 0.35 s; neither with `prefers-reduced-motion: reduce`. Walkthroughs still advance by time with reduced motion.
- A step lasts `seconds`, default `4 + 0.06` per caption character, rounded up.
- It starts paused on step 1 with a play button over the view; nothing moves until play.
- Keyboard keys only while the view or the player has focus; no page-wide keys.
- skycake stores nothing; walkthrough content and ACS/PTS tags stay on the site. The format has no tag fields and the validator ignores unknown fields, so a site can keep its own.
- Commit as `git -c user.name="Chris DeFoe" -c user.email="chris@defoe.me"`; run `npm run build` and commit `dist/` with each task that changes `src/`.

## Review Focus

- A step whose scene names an area, procedure or fix the data no longer has (an FAA cycle renamed it): the validator reports the step number and the name; in the browser the player shows the step without the missing part and warns once in the console, it does not stop. Pinned in Tasks 1 and 6.
- Pressing next or back many times quickly while procedure files load: the step shown is the last one asked for. Pinned in Task 5.
- Dragging the view mid-step pauses; play resumes from that step's scene, not from where the camera was dragged. Pinned in Task 4.
- A one-step walkthrough, and one whose last step has a quick check: both end paused on Explore/Next after the check is answered. Pinned in Task 4.
- An `airplane.along` procedure whose paths are all missed approach or vectors: the airplane sits at the procedure's first point instead of failing. Pinned in Task 2.

---

### Task 1: Scene fields for highlight, airplane and draw

**Files:**
- Modify: `src/scene.ts`
- Test: `src/scene.test.ts`

**Interfaces:**
- Produces:
  - `Target` gains `{ airport: string }` (an airport by id, for "tap the airport" questions).
  - `Scene` gains `highlight?: Target[]` and `airplane?: { at: [lat: number, lon: number, ft: number] } | { along: ProcedureRef; seconds: number }`.
  - `Resolved` gains `highlight: Target[]` and `airplane: Scene["airplane"] | null`, and `procedures` becomes `(ProcedureRef & { draw: boolean })[]`.
  - `export function stripPlayback(scene: Scene): Scene` returns the scene without `highlight`, `airplane` and every `draw` flag (Explore uses it to hand free roam a still scene).

- [ ] **Step 1: Write the failing tests** in `src/scene.test.ts`:

```ts
test("highlight and airplane resolve; unknown names in them throw", () => {
  const r = resolve({ highlight: [{ area: "b-phoenix-class-b-sfc-90" }, { airport: "KPHX" }], airplane: { at: [33.43, -112.01, 4500] } }, data);
  assert.deepEqual(r.highlight, [{ area: "b-phoenix-class-b-sfc-90" }, { airport: "KPHX" }]);
  assert.deepEqual(r.airplane, { at: [33.43, -112.01, 4500] });
  assert.throws(() => resolve({ highlight: [{ area: "nope" }] }, data), SceneError);
  assert.throws(() => resolve({ highlight: [{ airport: "KZZZ" }] }, data), SceneError);
  assert.throws(() => resolve({ airplane: { along: { airport: "KPHX", name: "NOPE" }, seconds: 10 } }, data), SceneError);
  assert.throws(() => resolve({ airplane: { at: [0, 0, 4500] } }, data), SceneError); // outside the area's bounds
});

test("draw is kept per procedure and stripPlayback removes playback", () => {
  const name = data.airports.find((a) => a.id === "KPHX")!.procedures[0].name;
  const scene = { procedures: [{ airport: "KPHX", name, draw: true }], highlight: [{ airport: "KPHX" }], airplane: { at: [33.43, -112.01, 4500] as [number, number, number] } };
  assert.equal(resolve(scene, data).procedures[0].draw, true);
  assert.deepEqual(stripPlayback(scene), { procedures: [{ airport: "KPHX", name }] });
  assert.equal(resolve({}, data).airplane, null);
});
```

- [ ] **Step 2: Run** `npx tsx --test src/scene.test.ts`. Expected: FAIL (`stripPlayback` not exported, `highlight` undefined).

- [ ] **Step 3: Implement.** `target()` also checks `{ airport }` against `data.airports`, and `resolve()` runs every `highlight` target through it. `airplane.at` must lie inside `data.bounds`; `airplane.along` uses the same procedure check as `procedures`. Fix targets are not checked here: fix names live in the procedure files, which the validator (Task 6) reads.

- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS. `freeroam.ts` still compiles because it only reads `Resolved` through `v.apply`.

- [ ] **Step 5: Commit** `src/scene.ts src/scene.test.ts dist`: "Scene: highlight, airplane, draw".

### Task 2: The viewer draws highlight, the airplane and procedures leg by leg

**Files:**
- Create: `src/fly.ts`, `src/fly.test.ts`, `src/plane.ts`
- Modify: `src/viewer.ts` (`View`, `apply`, the render loop), `style.css` (`.tag.hl`, `.tag.plane`), `NOTICE.md` (the model's credit)

**Interfaces:**
- Consumes: `Resolved` from Task 1.
- Produces:
  - `fly.ts`: `export function flightLine(p: Procedure): Point[]`, the connected route as published. Every path except `missed` is an edge from its first point to its last.
    - Start with the first path, in file order, whose first point is not the last point of another such path.
    - Keep appending the first path whose first point equals the current last point, until none does.
    - Points count as equal within 1e-6 degrees. Consecutive duplicate points are dropped, and no path is used twice.
    - This puts a SID's runway leg, common route and enroute transition in order, and a STAR's or approach's transition before its common route and final.
    - With no path but missed, the result is the first point of the first path.
  - `fly.ts`: `export function along(line: Point[], f: number): Point`, the point a fraction `f` of the way along by ground distance (`nm()` from `cifp.ts`), with `f` clamped to 0..1.
  - `src/plane.ts`: `export const PLANE_GLB: string`, the airplane model as base64 (see the Airplane step).
  - `View.apply(scene, procedures, now?, framing?, t = 1)`: `t` is the step timeline, 0 to 1.
  - `View.timeline(t: number): void`: moves the timeline without reapplying the scene.
  - `View.camera(): Camera`: the camera now, as `{ azimuth, tilt, distance, target }` in the same units `apply` takes.
  - `View.tap(fn: ((hit: { area: string | null; at: [lat: number, lon: number] }) => void) | null): void`: while set, a tap calls `fn` with the smallest area under the pointer (raised first, else flat, as the hover tip picks) and the ground point, instead of raising or lowering anything.
  - `export type Candidate = { area: string; name: string } | { fix: string; name: string; at: [lat: number, lon: number] } | { airport: string; name: string; at: [lat: number, lon: number] }`.
  - `View.onScreen(): Candidate[]`: what can be tapped and is at least partly in view. Areas come first, smallest first, then the fixes of the shown procedures, then airports with a tag. These are the keyboard's "tap to find" choices.
  - `View.focus(c: Candidate | null): void`: outlines the area, or rings the fix or airport, as focused.
  - `View.hints(on: boolean): void`. Off hides the hover and tap tip, which shows an area's floor and ceiling, and the altitudes in fix tags; it keeps their names. While a question is open these would show the answer. On by default; the card turns it off for the question and back on at the reveal.
  - The viewer dispatches `skycake-moved` (bubbles) on its host when the person drags, pinches or uses the keys.

- [ ] **Step 1: Write the failing tests** in `src/fly.test.ts` with a hand-made `proc` whose paths are, in file order: transition `[[33,-112,6000],[33,-111.95,5000]]`, common `[[33,-111.95,5000],[33,-111.9,4000]]`, final `[[33,-111.9,4000],[33,-111.85,3000],[33,-111.8,1500]]`, missed `[[33,-111.8,1500],[33,-111.7,5000]]`; and `missedOnly`, with only that missed path:

```ts
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
```

- [ ] **Step 2: Run** `npx tsx --test src/fly.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement `fly.ts`**, then the viewer:
  - **Highlight.** With a non-empty `highlight`, every area, procedure path and fix tag not named in it draws at 30% of its opacity; highlighted areas keep full opacity and get a 2 px brighter outline; a highlighted fix's tag gets class `hl`; a highlighted airport's tag gets class `hl`; a `point` gets a ground ring 0.5 NM across in the accent white. An empty list dims nothing.
  - **Airplane.** Use "Small Airplane" by Vojtěch Balák, chosen by Chris on 2026-11-07.
    - **Source:** https://poly.pizza/m/7cvx6ex-xfL, file `https://static.poly.pizza/077afae1-24b7-4bac-a31d-53d367002a04.glb`. It is 36,200 bytes, sha256 `020086413ab6cdd26662bafe564ca55cd3d8de8d1b5411c0109e2136be9c3f39`. It has 584 triangles, no textures and four plain materials (White, Red, Gray, Black). Download it into an empty folder and check the hash before using it.
    - **License:** CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/). In `NOTICE.md`, under a new "Models" heading, add: "Small Airplane" by Vojtěch Balák, from poly.pizza, CC-BY 3.0, unchanged apart from scale and placement.
    - **Packaging.** Commit it as `src/plane.ts` holding `export const PLANE_GLB = "<base64 of the file>";`, made once with `node -e` reading the file. It then ships inside the lazily loaded viewer chunk. Sites copy nothing new, and `data/` and the app's offline saves do not change.
    - **Loading.** Use `GLTFLoader.parse()` from `three/examples/jsm/loaders/GLTFLoader.js`, on first use only. If it fails, warn once and show no airplane; never fail the scene.
    - **The model's axes:**
      - The span runs along x, from -5.56 to 5.51, so about 11.07 units.
      - Up is +y.
      - The nose points to -z, where the propeller is, at z ≈ -2.4. The tail is at +z.
      - The propeller is its own node, `Propeller_Cone`, centred near (0, -0.05, -2.38).
    - **Size and scale.** Scale it so the span is 0.6 NM. Keep it outside the world's height scale, so 4× height raises its position but does not stretch it.
    - **Heading.** It points along the line (`along`), or north for `at`.
    - **Propeller.** It turns about z while the walkthrough plays. It stops when paused, and with reduced motion.
    - **Tag.** The altitude as a number, `ft.toLocaleString("en-US")` ("4,500"), like the fix tags; a number, so no label.
    - **Placement.** `along` puts it at `along(flightLine(p), t)`; `at` puts it at the point.
  - **Draw.** For a procedure with `draw: true`, its paths reveal in order over the timeline: with `n` paths, path `i` grows from `t = i/n` to `(i+1)/n` (the line's draw range, the curtain to match); fix tags show once their point is drawn. At `t = 1` everything is drawn.
  - `apply` calls `timeline(t)` after building; `timeline` only updates draw ranges, the airplane and visibility, and marks the frame dirty.
  - `takeOver()` (already called on every manual camera move) dispatches `skycake-moved`.

- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run build`, then `npm run demo` and open `http://localhost:5179/demo/?scene=` with `{"procedures":[{"airport":"KPHX","name":"<an ILS at KPHX>","draw":true}],"highlight":[{"area":"b-phoenix-class-b-sfc-90"}],"airplane":{"at":[33.43,-112.01,4500]}}`. Expected: Class B surface area bright, everything else dim, the approach fully drawn (t = 1), an airplane with "4,500". In the browser console, `v.timeline(0.5)` (expose `v` on `window` in `demo/index.html` only) shows half the legs.

- [ ] **Step 5: Commit** `src/fly.ts src/fly.test.ts src/plane.ts src/viewer.ts style.css NOTICE.md demo/index.html dist`: "Viewer: highlight, airplane, draw by timeline, tap hook".

### Task 3: Questions and the shared question card

**Files:**
- Create: `src/question.ts`, `src/question.test.ts`, `src/card.ts`
- Modify: `src/ui.ts` (`Labels`, `LABELS`), `style.css` (`.sc-card`)

**Interfaces:**
- Consumes: `Target`, `Scene`, `Resolved` (Task 1); `View.tap`, `View.onScreen`, `View.focus`, `View.hints`, `Candidate` (Task 2); `nm()` from `cifp.ts`.
- Produces (`question.ts`, pure):
  - `export type Question = { id?: string; prompt: string; scene?: Scene; explanation?: string } & ({ type: "find"; answer: Target } | { type: "read" | "airplane" | "procedure"; choices: string[]; answer: number } | { type: "read"; number: { answer: number; tolerance: number; unit?: string } })`
  - `export type Answer = { choice: number } | { number: number } | { area: string | null; at: [lat: number, lon: number] | null }`
  - `export type Locate = (t: Target) => [lat: number, lon: number] | null` (fix or airport position; the caller builds it from `data.airports`, `data.waypoints` and loaded procedure fixes).
  - `export function score(q: Question, a: Answer, locate: Locate): boolean`: a choice matches `answer`; a number is right when `|n - answer| <= tolerance`; a find answer is right when its `area` equals an `area` target, or its `at` is within 1.5 NM of a fix or airport target's position.
  - `export function questionScene(q: Question): Scene`: the type's default scene, with `q.scene` laid over it field by field.
    - **Chart-reading questions start top-down** (Chris, 2026-11-07), so the chart can be read: find, read and airplane. The camera flies there as the question starts, but nothing locks it. The student can turn and tilt as in free roam.
    - **Defaults:**
      - `find`: `{ camera: "top", raise: [], tags: false }`.
      - `read`: `{ camera: { frame: <q.scene.highlight>, tilt: 90 }, raise: [], tags: false }`. The highlighted area stands out flat on the chart.
      - `airplane` (when `q.scene.airplane` is `at`): `{ camera: { frame: <four points 5 NM north, south, east and west of the airplane>, tilt: 90 }, raise: [], tags: false }`.
      - `procedure`: `{ camera: { frame: <q.scene.procedures as targets> } }`, oblique as it is drawn in 3D.
  - `export function revealScene(q: Question): Scene`: after the answer, the question scene with the answer raised (an `area` answer, or the highlighted areas), tags on, and the camera tilted to 32 on the same frame.
- Produces (`card.ts`, DOM):
  - `export function card(q: Question, L: Labels, view: View, onAnswer: (a: Answer) => void): { el: HTMLElement; reveal(right: boolean, facts: string | null, button: string, onNext: () => void): void; remove(): void }`. Choices are buttons; a number question is an input (`inputmode="decimal"`) with its unit and a submit button; a find question shows only the prompt, calls `view.tap(...)` and lists `view.onScreen()` as visually hidden buttons named after each candidate. Tab moves through them and calls `view.focus`. Enter answers: an area candidate with `{ area, at: null }`, a fix or airport with `{ area: null, at: c.at }`, so keyboard answers score exactly like taps. `reveal` disables the answers, shows an icon plus the word right or wrong (never color alone), `facts`, the explanation if any, and one button labelled `button`. The prompt and result are in an `aria-live="polite"` region. The card calls `view.hints(false)` while the question is open, and `view.hints(true)` at the reveal and on `remove`.
  - New `Labels`: `right: "Right"`, `wrong: "Wrong"`, `submit: "Check"`, `continue: "Continue"`, `facts: (name, floor, ceiling) => `${name} · ${floor} to ${ceiling}``.

- [ ] **Step 1: Write the failing tests** in `src/question.test.ts`:

```ts
const at: Locate = (t) => ("fix" in t && t.fix === "SCADE" ? [33.4, -112.2] : "airport" in t && t.airport === "KCHD" ? [33.27, -111.81] : null);
test("each type scores right and wrong", () => {
  const read = { type: "read", prompt: "", choices: ["A", "B"], answer: 1 } as const;
  assert.equal(score(read, { choice: 1 }, at), true);
  assert.equal(score(read, { choice: 0 }, at), false);
  const num = { type: "read", prompt: "", number: { answer: 5000, tolerance: 100, unit: "ft" } } as const;
  assert.equal(score(num, { number: 5099 }, at), true);
  assert.equal(score(num, { number: 5101 }, at), false);
  const area = { type: "find", prompt: "", answer: { area: "d-chandler-municipal-airport-class-d" } } as const;
  assert.equal(score(area, { area: "d-chandler-municipal-airport-class-d", at: null }, at), true);
  assert.equal(score(area, { area: "b-phoenix-class-b-sfc-90", at: null }, at), false);
  const fix = { type: "find", prompt: "", answer: { fix: "SCADE" } } as const;
  assert.equal(score(fix, { area: null, at: [33.4, -112.2 + 1.4 / 60 / Math.cos((33.4 * Math.PI) / 180)] }, at), true); // 1.4 NM east
  assert.equal(score(fix, { area: null, at: [33.4, -112.2 + 1.6 / 60 / Math.cos((33.4 * Math.PI) / 180)] }, at), false);
});
test("default scenes per type, with the question's own fields winning", () => {
  assert.deepEqual(questionScene({ type: "find", prompt: "", answer: { airport: "KCHD" } }), { camera: "top", raise: [], tags: false });
  assert.deepEqual(questionScene({ type: "find", prompt: "", answer: { airport: "KCHD" }, scene: { raise: ["D"] } }).raise, ["D"]);
  const read = questionScene({ type: "read", prompt: "", choices: ["a", "b"], answer: 0, scene: { highlight: [{ area: "x" }] } });
  assert.deepEqual([read.raise, read.camera], [[], { frame: [{ area: "x" }], tilt: 90 }]); // top-down, flat, to read the chart
  const plane = questionScene({ type: "airplane", prompt: "", choices: ["a", "b"], answer: 0, scene: { airplane: { at: [33.4, -112, 4500] } } });
  assert.equal((plane.camera as { tilt: number }).tilt, 90);
});
test("the reveal raises the answer and tilts to 3D", () => {
  const q = { type: "read", prompt: "", choices: ["a", "b"], answer: 0, scene: { highlight: [{ area: "x" }] } } as const;
  assert.deepEqual([revealScene(q).raise, revealScene(q).camera, revealScene(q).tags], [[{ area: "x" }], { frame: [{ area: "x" }], tilt: 32 }, true]);
});
```

- [ ] **Step 2: Run** `npx tsx --test src/question.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement `question.ts`, then `card.ts`** and the `.sc-card` styles: desktop, a panel centered along the bottom, at most 560 px wide; phone, the panel fills the 76 px bar's place and grows upward. Choice buttons are pills at least 44 px.

- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS. The card is checked in a browser in Task 5, where the player shows it.

- [ ] **Step 5: Commit** `src/question.ts src/question.test.ts src/card.ts src/ui.ts style.css dist`: "Questions, scoring and the shared card".

### Task 4: Player timing (pure)

**Files:**
- Create: `src/walkthrough.ts`, `src/walkthrough.test.ts`

**Interfaces:**
- Consumes: `Scene` (Task 1), `Question` (Task 3).
- Produces:
  - `export type Step = { caption: string; scene: Scene; seconds?: number; check?: Question }` and `export type Walkthrough = { id: string; title: string; area: string; steps: Step[] }`.
  - `export function stepSeconds(s: Step): number` = `s.seconds ?? Math.ceil(4 + 0.06 * s.caption.length)`.
  - `export type Play = { step: number; t: number; playing: boolean; started: boolean; checking: boolean; moved: boolean; done: boolean }` (`t` in seconds into the step).
  - Pure transitions, each returning a new `Play`: `begin(): Play` (step 0, paused, not started); `play(p)`, `pause(p)`, `tick(p, w, dt)`, `next(p, w)`, `back(p, w)`, `moved(p)`, `answered(p, w)`.

- [ ] **Step 1: Write the failing tests** in `src/walkthrough.test.ts`, with `w` of three steps (captions 10, 50 and 0 characters; step 2 has a `check`):

```ts
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
test("dragging pauses; play resumes from the step's start", () => {
  let p = moved(tick(play(begin()), w, 2));
  assert.deepEqual([p.playing, p.moved], [false, true]);
  p = play(p);
  assert.deepEqual([p.playing, p.moved, p.t], [true, false, 0]);
});
```

- [ ] **Step 2: Run** `npx tsx --test src/walkthrough.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `walkthrough.ts`. `play` on a `done` walkthrough restarts at step 0. `next` past the last step, or `answered` on the last step, sets `done`. A step's check opens when `t` reaches its length, so `next` on a step with a check skips the check (the person chose to move on).

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

- [ ] **Step 5: Commit** `src/walkthrough.ts src/walkthrough.test.ts dist`: "Walkthrough timing".

### Task 5: The player in the view, and `mount({ mode })`

**Files:**
- Create: `src/player.ts`
- Modify: `src/ui.ts` (`Options.mode`, `mount`), `src/index.ts` (exports), `style.css` (`.sc-player`, `.sc-step`, `.sc-big-play`), `demo/index.html` (`?walkthrough=` loads `demo/class-b.json`), `demo/class-b.json` (a four-step sample with placeholder captions, one check, one drawn procedure, one airplane along it), `README.md` (API section)

**Interfaces:**
- Consumes: everything above; `freeRoam(c)` and `Context` from `freeroam.ts`.
- Produces:
  - `Options.mode?: "explore" | { walkthrough: Walkthrough; next?: { label: string; href: string } }` (the quiz plan adds its own member). Default `"explore"`.
  - `export function player(c: Context, w: Walkthrough, next: { label: string; href: string } | undefined, explore: (from: Scene) => void): Promise<void>`: resolves once step 1 shows.
  - `index.ts` exports `type Walkthrough, type Step, type Question, type Target, type Scene`.
  - New `Labels`: `play`, `pause`, `back`, `next`, `explore`, `stepOf: (n, total) => `${n}/${total}``.

- [ ] **Step 1: Build `player.ts`** to the spec's "What the student sees":
  - Top left: the title. Top right: **Explore**. A caption card (`aria-live="polite"`) above the player.
  - The player row: back, play/pause, next, a progress bar with one segment per step (a check's segment outlined, the current one filled to `t / stepSeconds`), `stepOf`, and full screen (or the site's close, as in free roam). Phone: the row is the 76 px bar.
  - A big play button over the view until the first play.
  - A `requestAnimationFrame` loop calls `tick` with the real `dt`, then `view.timeline(p.t / stepSeconds(step))`.
  - On a step change it resolves the step's scene (catching `SceneError`: warn once, show the scene without the missing part by dropping that field), loads the procedure files as `freeroam.ts` does, and calls `view.apply(resolved, files, false, framing, 0)`. A ticket counter, as in `freeroam.ts`, keeps only the newest step.
  - `skycake-moved` calls `moved(p)`. On `play` after a move, the step's scene is reapplied.
  - When `p.checking`, it shows `card(step.check, ...)` with `questionScene`. On answer it scores (the `Locate` built from `data.airports`, `data.waypoints` and the loaded procedures' fixes), reveals with `revealScene`, and the card's button is `continue`, calling `answered`. Not scored anywhere else.
  - When `p.done`, the player shows **Explore** and, with `next`, a link button to `next.href` labelled `next.label`.
  - Explore removes the player's DOM, then calls `explore(stripPlayback({ ...step.scene, camera: view.camera() }))`.

- [ ] **Step 2: Wire `mount`.** For a walkthrough mode, call `player(...)` with an `explore` that runs `freeRoam({ ...context, first: from })`. Free roam stays as it is for `"explore"`.

- [ ] **Step 3: Check in a browser.** `npm run build && npm run demo`, open `http://localhost:5179/demo/?walkthrough=class-b`.
  - Expected: paused on 1/4 with the big play.
  - Play runs the steps by time, the drawn procedure grows leg by leg, the airplane flies it, the check pauses with the card, Continue plays on, and the end shows Explore.
  - Dragging pauses.
  - Next and back pressed five times quickly land on the last one asked for.
  - Repeat with phone emulation (Chrome DevTools device toolbar, iPhone 12, not a narrow window). Headless Chromium will not lay out narrower than 500 px.
  - Repeat with reduced motion emulated: no flights, steps still advance.

- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** `src/player.ts src/ui.ts src/index.ts style.css demo README.md dist`: "Walkthrough player and mount mode".

### Task 6: Validator

**Files:**
- Create: `src/validate.ts`, `src/validate.test.ts`
- Modify: `src/index.ts` (export), `README.md` (how a site runs it)

**Interfaces:**
- Consumes: `resolve`, `SceneError` (Task 1); `Question` (Task 3); `Walkthrough` (Task 4).
- Produces: `export async function validateWalkthrough(w: Walkthrough, data: AirspaceFile, procedures: (airport: string) => Promise<Procedure[]>, area: string): Promise<string[]>`. It returns problems as `"<walkthrough id> step <n>: <problem>"`, empty when fine, and runs in Node with no DOM. The quiz plan adds `validateQuiz` beside it.

- [ ] **Step 1: Write the failing tests** in `src/validate.test.ts`, reading `data/phoenix/area.json` and `data/phoenix/procedures/<id>.json` from disk:

```ts
test("a good walkthrough has no problems", async () => assert.deepEqual(await validateWalkthrough(good, data, files, "phoenix"), []));
test("catches a missing area, airport, procedure and fix, with the step number", async () => {
  const bad = { ...good, steps: [
    { caption: "a", scene: { raise: [{ area: "nope" }] } },
    { caption: "b", scene: { highlight: [{ airport: "KZZZ" }] } },
    { caption: "c", scene: { procedures: [{ airport: "KPHX", name: "NOPE" }] } },
    { caption: "d", scene: { highlight: [{ fix: "ZZZZZ" }] } },
  ] };
  assert.deepEqual(await validateWalkthrough(bad, data, files, "phoenix"), ["t step 1: no area nope", "t step 2: no airport KZZZ", "t step 3: no procedure NOPE at KPHX", "t step 4: no fix ZZZZZ"]);
});
test("catches a check whose answer is out of range or a walkthrough for another area", async () => {
  const bad = { ...good, area: "miami", steps: [{ caption: "a", scene: {}, check: { type: "read", prompt: "?", choices: ["x", "x"], answer: 2 } }] };
  assert.deepEqual(await validateWalkthrough(bad, data, files, "phoenix"), ["t: area miami, data is phoenix", "t step 1: answer 2 is not a choice", "t step 1: choices repeat"]);
});
```

`files(airport)` reads the JSON from disk. `data` carries no area name, so `area` is the folder name the site loaded (`"phoenix"` here).

- [ ] **Step 2: Run** `npx tsx --test src/validate.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement.** A fix is known when any loaded procedure at any airport in `data.airports` has a fix of that name, or `data.waypoints` has it. Each check's question goes through the same checks as its targets, plus: choices 2 to 4 and distinct, `answer` an index into them, tolerance at least 0, a non-empty prompt. Steps need a caption string and `seconds`, when given, above 0. Unknown extra fields are ignored.

- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** `src/validate.ts src/validate.test.ts src/index.ts README.md dist`: "Walkthrough validator".

---

## Done when

`npm test`, `npm run typecheck`, CI and the browser checks in Task 5 pass. `README.md` documents `mode`, the `Walkthrough` format and `validateWalkthrough`. The CHANGELOG `Unreleased` section lists walkthroughs. instrumentready.com's wiring is its own spec there, not part of this plan.
