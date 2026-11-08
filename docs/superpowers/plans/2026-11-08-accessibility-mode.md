# Accessibility Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One switch (`mount({ a11y })`, or skycake's own row when a site leaves it out) that raises contrast, shows focus, stops motion and timers, gives every tap and gesture a keyboard and single-tap path, and makes quiz answers chosen then checked, across free roam, walkthroughs and quizzes.

**Architecture:** The mode is a flag on the figure (`data-a11y`), on the `Context` the modes read, and on the viewer (`View.setA11y`). Most visual changes are CSS under `.skycake[data-a11y]`; free roam's new controls (In view, camera pad, the row) are always built and shown by that CSS, so the standalone row switches the mode live with no rebuild. Pure logic (walkthrough hold, tap thresholds, quiz skip, the map summary) stays in Node-testable modules; two new DOM modules hold the shared pieces: `picker.ts` (the numbered list) and `pad.ts` (the camera pad).

**Tech Stack:** TypeScript 5.9, three.js (peer, existing `LineMaterial`), node:test via tsx, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-08-accessibility-mode-design.md`. Branch from `walkthroughs-quizzes` (PR #16), or from `main` once #16 is merged.

## Global Constraints

- No em dashes anywhere, in code, comments or docs. No Garmin or G1000 names.
- Every new on-screen word is a placeholder in `Labels` (`src/ui.ts`), prefixed `"Placeholder: "` as the walkthrough and quiz words are. Chris writes the copy.
- Commit as `git -c user.name="Chris DeFoe" -c user.email="chris@defoe.me"`; run `npm run build` and commit `dist/` with each task that changes `src/` (CI fails on a stale `dist/`).
- Every control 44 px or taller; number badges 24 px.
- Mode tokens, exact: `--sc-soft: var(--soft, #c5c8cc)`, `--sc-muted: var(--muted, #b0b4b9)`, `--sc-dim: var(--dim, #969ba1)`, `--sc-frame: var(--frame, #767c83)`, `--sc-accent: var(--red, #6aa6e8)`. Host tokens still win. Keep `var(--red, ...)`.
- Storage key `skycake-a11y`, value `"1"` when on; every read and write in try/catch.
- "Not for navigation" stays on screen in every layout, including with the camera pad.
- Check phone layouts with real device emulation (headless Chromium will not lay out under 500 px).

## Review Focus

1. **A host passes `a11y: false` explicitly.** Expected: the host drives it, no row shows, stored `skycake-a11y` is ignored. Only `undefined` shows the row. Test in Task 3.
2. **localStorage throws** (private window, blocked storage). Expected: mount still works, mode off, the row still flips the mode for the session. Test in Task 3.
3. **Skip on the last item of a fixed quiz, or skipping every item.** Expected: the end shows `right of total` with the skips taken out, never a negative or a divide by zero; all skipped ends with `0 of 0`. Test in Task 2.
4. **The find question's number field gets a number with no badge** (0, 99, "3.5", empty). Expected: nothing is chosen, Check stays disabled, nothing is scored. Test in Task 6 (`pickByNumber`).
5. **A walkthrough step with a check, in hold mode.** Expected: the check still opens at the step's end (hold never swallows a check), and Continue goes on as today. Test in Task 1.

---

### Task 1: Walkthrough hold and forgiving taps

**Files:**
- Modify: `src/walkthrough.ts` (`tick`)
- Modify: `src/gesture.ts` (`isTap`)
- Test: `src/walkthrough.test.ts`, `src/gesture.test.ts`

**Interfaces:**
- Produces: `tick(p: Play, w: Walkthrough, dt: number, hold = false): Play`; `isTap(t: { fingers: number; moved: number; ms: number }, loose = false): boolean` (loose: up to 16 px, no time limit).

- [ ] **Step 1: Write the failing tests**

```ts
test("hold stops at the step's end and Next goes on", () => {
  let p = play(begin());
  p = tick(p, w, 100, true);
  assert.equal(p.step, 0);
  assert.equal(p.playing, false);
  assert.equal(p.t, stepSeconds(w.steps[0]));
  assert.equal(next(p, w).step, 1);
  assert.equal(play(p).playing, true); // Play from a held end moves on with the next tick
  assert.equal(tick(play(p), w, 0.01, true).step, 1);
});
test("hold never swallows a check", () => {
  const p = tick({ ...play(begin()), step: 1 }, w, 100, true);
  assert.equal(p.checking, true);
});
test("loose taps", () => {
  assert.equal(isTap({ fingers: 1, moved: 12, ms: 100 }), false);
  assert.equal(isTap({ fingers: 1, moved: 12, ms: 100 }, true), true);
  assert.equal(isTap({ fingers: 1, moved: 4, ms: 2000 }, true), true);
  assert.equal(isTap({ fingers: 1, moved: 17, ms: 100 }, true), false);
  assert.equal(isTap({ fingers: 2, moved: 0, ms: 100 }, true), false);
});
```

- [ ] **Step 2: Run `npm test`.** Expected: the three new tests fail.
- [ ] **Step 3: Implement.** In `tick`, under `hold`, a step with no check that crosses its end this tick (`p.t < len && t >= len`) returns `{ ...p, t: len, playing: false }`; a tick that starts at `p.t >= len` (Play after a hold; `play` already keeps `t`) goes on to the next step as today. `isTap` loose: `TAP_PX_LOOSE = 16`, no `TAP_MS`.
- [ ] **Step 4: Run `npm test` and `npm run typecheck`.** Expected: all pass.
- [ ] **Step 5: Commit** (`src/walkthrough.ts src/gesture.ts` and tests): "Walkthrough hold and loose taps for accessibility mode".

### Task 2: Quiz skip

**Files:**
- Modify: `src/quiz.ts` (`Attempt`, `QuizResult`, new `skip`, new `progress`)
- Test: `src/quiz.test.ts`

**Interfaces:**
- Produces: `Attempt` gains `skipped: number` (0 from `attempt()` and `practice()`); `QuizResult` item form gains `skipped?: true`; `skip(a: Attempt): Attempt` (adds one to `skipped`, does not touch `right` or `answered`); `progress(a: Attempt): { n: number; total: number }` where `n = a.answered + 1` and `total = a.items.length - a.skipped` (fixed quizzes; practice callers keep `practiceCount`).

- [ ] **Step 1: Write the failing tests**

```ts
test("skip drops the total by one and scores nothing", () => {
  let a = attempt(quiz5, make, rng); // quiz5: five written items, built from the file's existing fixtures
  a = skip(a);
  assert.deepEqual(progress(a), { n: 1, total: 4 });
  assert.equal(a.right, 0);
  a = advance(a, make, rng);
  a = answer(a, true);
  assert.deepEqual(progress(a), { n: 2, total: 4 });
});
test("skipping the last item ends with the skips taken out", () => {
  let a = attempt(quiz5, make, rng);
  for (let i = 0; i < 5; i++) a = advance(skip(a), make, rng);
  assert.equal(a.done, true);
  assert.deepEqual(progress(a), { n: 1, total: 0 });
});
```

- [ ] **Step 2: Run `npm test`.** Expected: fail, `skip` not exported.
- [ ] **Step 3: Implement `skip` and `progress` in `src/quiz.ts`;** add `skipped: 0` where attempts are made.
- [ ] **Step 4: Run `npm test` and `npm run typecheck`.** Expected: pass.
- [ ] **Step 5: Commit:** "Quiz skip".

### Task 3: The switch, contrast, focus ring and the row

**Files:**
- Modify: `src/ui.ts` (`Options.a11y`, `Labels.a11y`, mount), `src/freeroam.ts` (`Context`, the row), `src/viewer.ts` (`build`, `View.setA11y`), `style.css`, `demo/index.html`
- Create: `src/a11y.ts`, `src/a11y.test.ts`

**Interfaces:**
- Produces:
  - `src/a11y.ts`: `export const A11Y_KEY = "skycake-a11y"`; `stored(s: Pick<Storage, "getItem"> | null): boolean`; `store(s: Pick<Storage, "setItem" | "removeItem"> | null, on: boolean): void` (both swallow throws); `initial(option: boolean | undefined, s: Pick<Storage, "getItem"> | null): { on: boolean; row: boolean }` (`row` is true only when `option === undefined`).
  - `Options.a11y?: boolean`. `Labels.a11y: string` (`"Placeholder: Accessibility mode"`).
  - `Context` gains `a11y: boolean` (mutable; cards read it when they open) and `setA11y?: (on: boolean) => void` (present only when the row shows).
  - `build(host, data, label, raised, airport, a11y = false)`; `View.setA11y(on: boolean): void`: sets `still = reducedMotion || on`, loose taps (`isTap(.., on)`), rim `linewidth` 2.4 (from 1.6) and rib 1.5 (from 1), airport tags `tabindex="-1"` when on.

- [ ] **Step 1: Write the failing tests** (`src/a11y.test.ts`)

```ts
const mem = (v: string | null) => ({ getItem: () => v });
const throws = { getItem: () => { throw new Error("blocked"); } };
test("a host's value wins and hides the row", () => {
  assert.deepEqual(initial(false, mem("1")), { on: false, row: false });
  assert.deepEqual(initial(true, mem(null)), { on: true, row: false });
});
test("no host value: the stored one, and the row", () => {
  assert.deepEqual(initial(undefined, mem("1")), { on: true, row: true });
  assert.deepEqual(initial(undefined, mem(null)), { on: false, row: true });
});
test("blocked storage is off, never a throw", () => {
  assert.deepEqual(initial(undefined, throws), { on: false, row: true });
  assert.doesNotThrow(() => store({ setItem: () => { throw new Error(); }, removeItem: () => {} }, true));
});
```

- [ ] **Step 2: Run `npm test`.** Expected: fail, no `src/a11y.ts`.
- [ ] **Step 3: Implement `src/a11y.ts`.**
- [ ] **Step 4: Wire it.** `mount` reads `initial(o.a11y, safeLocalStorage)`, sets `fig.dataset.a11y = ""` when on, passes `a11y` to `build` and into `Context`; when `row`, `Context.setA11y` toggles `fig.dataset.a11y`, calls `v.setA11y`, sets `context.a11y`, and `store()`s. Free roam: when `c.setA11y` exists, a labeled row (`<label class="sc-row sc-a11y-row">` with the label and a `checkbox` `role="switch"`, the Airspace rows' style) at the end of `.sc-br` (desktop bottom right; phone: the foot of the View sheet). Walkthroughs and quizzes have no View controls and no row: sites drive the mode there.
- [ ] **Step 5: CSS in `style.css`.** The Global Constraints tokens under `.skycake[data-a11y]` and `@media (prefers-contrast: more) { .skycake { ... } }`. Focus ring under `.skycake[data-a11y]`: `:focus-visible { outline: 3px solid var(--sc-ink); outline-offset: 2px; box-shadow: 0 0 0 7px var(--sc-side); }` (dark gap, light ring, dark halo); the view's ring stays inside (negative offset, inset halo). Tags: `.tag` 13px, `.fix` and `.tag.apt` and `.tag.plane` backgrounds opaque `#14171c`, `.fix` border `#fff`. Tooltip `transition: none`.
- [ ] **Step 6: Demo.** `?a11y=1` passes `a11y: true`, `?a11y=0` passes `false`, absent leaves it out.
- [ ] **Step 7: Verify in the browser** (`npm run build`, demo): free roam with no param shows the row; flipping it changes contrast, rims and tag size at once and survives a reload; `?a11y=1` shows no row; Tab shows the ring over light and dark chart; airport tags are skipped by Tab in the mode. Phone emulation: the row at the foot of the View sheet.
- [ ] **Step 8: `npm test`, `npm run typecheck`, `npm run build`; commit** with `dist/`: "Accessibility mode switch, contrast and focus ring".

### Task 4: Pan and the camera pad

**Files:**
- Modify: `src/viewer.ts` (`View.pan`), `src/ui.ts` (keys, labels), `src/freeroam.ts`, `src/quizui.ts`, `style.css`
- Create: `src/pad.ts`

**Interfaces:**
- Consumes: `View.orbit`, `View.zoom`, `Context`.
- Produces: `View.pan(right: number, forward: number): void`: moves camera and target along the camera's ground-projected right and forward by that fraction of the camera's distance to the target, then `keepOnChart()`, `takeOver()`. `pad(c: Context): HTMLElement` in `src/pad.ts`. `Labels.camera: { left: string; right: string; up: string; down: string; zoomIn: string; zoomOut: string; pan: string }` (placeholders).

- [ ] **Step 1: Implement `View.pan`** reusing the step `slide()` makes (shift camera and target together).
- [ ] **Step 2: Keys.** In `mount`'s view keydown: Shift+arrows pan by 0.15 (both modes). In the mode set `aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown + -"` on the view.
- [ ] **Step 3: `pad(c)`.** A `role="group"` with four arrow `sc-round` buttons in a ring, `+` and `-`, and a Pan toggle (`aria-pressed`). Arrows call `orbit(±Math.PI / 24, 0)` / `orbit(0, ±Math.PI / 24)`, or `pan(±0.15, 0)` / `pan(0, ±0.15)` when Pan is pressed; zoom 0.85 and 1 / 0.85 (the keyboard's steps). Labels from `L.camera`; the arrows' labels change with Pan.
- [ ] **Step 4: Place it.** Free roam appends it after the view; the quiz too. Not the walkthrough player. CSS shows `.sc-pad` only under `.skycake[data-a11y]`: desktop bottom left above the caption line; phone over the map, bottom left, above the 76 px bar, the caption still visible. 44 px buttons.
- [ ] **Step 5: Verify in the browser:** every pad button moves the camera as its gesture does, at the chart's edges `keepOnChart` holds; the pad is hidden with the mode off; on a phone it clears the tab bar and the quiz card; "Not for navigation" stays visible.
- [ ] **Step 6: `npm test`, `npm run typecheck`, `npm run build`; commit:** "Camera pad and pan".

### Task 5: Number badges, the In view panel and the map summary

**Files:**
- Modify: `src/viewer.ts` (`View.numbers`), `src/freeroam.ts`, `src/ui.ts` (labels), `style.css`
- Create: `src/picker.ts`, `src/summary.ts`, `src/summary.test.ts`

**Interfaces:**
- Consumes: `View.onScreen(): Candidate[]`, `View.focus`, `deepest()` (already in `viewer.ts`).
- Produces:
  - `View.numbers(list: Candidate[] | null): void`: a badge `1..n` on each, in list order, in its own layer over every tag, never hidden by tag collisions, `aria-hidden`. Areas at `deepest(widest ring)` at the ceiling (as their chart tag), fixes at their altitude, airports on the ground. `null` clears.
  - `picker(view: View, o: { label: (c: Candidate, n: number) => string; onPick: (c: Candidate, n: number) => void }): { el: HTMLElement; list(): Candidate[]; refill(): void; stop(): void }`: numbered buttons from `view.onScreen()`, calls `view.numbers` with the same list, focus or hover runs `view.focus(c)`, refills on `skycake-moved` settling (debounce 300 ms) and on `refill()`; `stop()` clears badges and listeners.
  - `describe(o: { chart: string; areas: { name: string; floor: string; ceiling: string }[]; procedures: string[] }, L: Labels): string` in `src/summary.ts`.
  - Labels: `inView: string`, `summary: (chart: string, areas: string[], procedures: string[]) => string` (placeholders; the areas are `L.facts` strings).

- [ ] **Step 1: Write the failing test** (`src/summary.test.ts`)

```ts
test("the summary names the chart, raised areas with altitudes, and procedures", () => {
  const s = describe({ chart: "TAC 2026-10-02", areas: [{ name: "Phoenix Class B", floor: "SFC", ceiling: "9,000" }], procedures: ["KPHX RNAV (GPS) Y RWY 08"] }, LABELS);
  assert.match(s, /TAC 2026-10-02/);
  assert.match(s, /Phoenix Class B/);
  assert.match(s, /9,000/);
  assert.match(s, /RWY 08/);
});
test("nothing raised, nothing shown", () => {
  assert.match(describe({ chart: "SEC", areas: [], procedures: [] }, LABELS), /SEC/);
});
```

- [ ] **Step 2: Run `npm test`.** Expected: fail.
- [ ] **Step 3: Implement `describe` and the placeholder `summary` label.**
- [ ] **Step 4: Implement `View.numbers` and `picker`.**
- [ ] **Step 5: In view in free roam.** Desktop: an `sc-pill` "In view" (`aria-expanded`, `aria-controls`) under Airspace in `.sc-tl`, opening an `sc-panel` with the picker (labels: `n` then `L.facts(...)` for areas, `n` then the name for fixes and airports). Phone: an In view tab in the tab bar opening it as a sheet, as Airspace's. Picking an area calls `view.raiseArea(id, !raised)`; an airport calls `showAirport(id)`; a fix focuses it. Badges show only while the panel is open. Pill, tab and panel shown only under `[data-a11y]`.
- [ ] **Step 6: Escape** closes the Airspace list, In view, the View sheet and the search results, and returns focus to the button or tab that opened it (both modes).
- [ ] **Step 7: The summary.** A visually hidden `p` (`.sc-hidden`) inside the figure, `aria-describedby` on the view while the mode is on, rewritten after each free roam `refresh` from the raised areas, the chart caption text and the shown procedures.
- [ ] **Step 8: Verify in the browser:** badges match list numbers after orbit, pan and zoom; a nested Class B shelf's badge is inside the shelf, not its core; overlapping tags never hide a badge; picking raises and lowers; NVDA reads the summary on reaching the view.
- [ ] **Step 9: `npm test`, `npm run typecheck`, `npm run build`; commit:** "In view panel, number badges and map summary".

### Task 6: Questions in the mode

**Files:**
- Modify: `src/card.ts`, `src/quizui.ts`, `src/player.ts`, `src/ui.ts` (labels), `style.css`
- Test: `src/card.test.ts` (create, pure helper only)

**Interfaces:**
- Consumes: `picker` (Task 5), `skip`, `progress`, `QuizResult.skipped` (Task 2), `tick(.., hold)` (Task 1), `Context.a11y` (Task 3).
- Produces:
  - `card(q, L, view, say, onAnswer, o: { a11y: boolean; onSkip?: () => void } = { a11y: false })`.
  - `pickByNumber(text: string, count: number): number | null` exported from `src/card.ts`: the 0-based index for a whole number 1 to `count`, else null.
  - Labels: `skip: string`, `number: string` (the field's name) (placeholders).

- [ ] **Step 1: Write the failing test**

```ts
test("only a listed whole number picks", () => {
  assert.equal(pickByNumber("3", 5), 2);
  assert.equal(pickByNumber(" 1 ", 5), 0);
  for (const bad of ["0", "6", "99", "3.5", "", "x", "-1"]) assert.equal(pickByNumber(bad, 5), null);
});
```

- [ ] **Step 2: Run `npm test`.** Expected: fail.
- [ ] **Step 3: Implement `pickByNumber`.**
- [ ] **Step 4: Chosen then Check (`o.a11y` only).** Choices set `aria-pressed` on one button (changeable) and enable a full-width Check (`L.submit`, class `sc-choice sc-submit`, the walkthrough Continue's style) under them; Check calls `answer({ choice })`. Number questions unchanged. Off the mode, everything is as today.
- [ ] **Step 5: Find questions in the mode.** Replace the hidden list with `picker` labelled by number only (`String(n)`), a number field (`L.number`, `inputmode="numeric"`) that chooses through `pickByNumber`, and map taps choose instead of answer (`view.tap` sets the choice). Check answers the choice (`{ area, at: null }` or `{ area: null, at }`, as the hidden buttons do now). When `o.onSkip`, a Skip button (`L.skip`) calls it. `stop()` the picker in `done()`.
- [ ] **Step 6: Quiz wiring.** `quizui.ts` passes `{ a11y: c.a11y, onSkip }` to `card`; `onSkip` (find questions only) applies `skip`, reports `{ quiz, item, right: false, ms, skipped: true }`, and goes to `next()`. The count uses `progress(a)` for fixed quizzes; the end shows `L.result(a.right, progress(a).total)` and reports `total` the same. In the mode a new question focuses the card's first control even when focus was elsewhere, except the first question.
- [ ] **Step 7: Walkthrough wiring.** `player.ts` passes `hold = c.a11y` to `tick`, `{ a11y: c.a11y }` to `card` (no Skip: checks are not scored), and in the mode focuses a check's first control when it opens.
- [ ] **Step 8: Verify in the browser** (demo `?quiz=class-b&a11y=1`, `?quiz=practice&a11y=1`, `?walkthrough=class-b&a11y=1`): a stray choice tap scores nothing until Check; a typed `7` with six badges chooses nothing; Skip on the last item ends with the right total; a walkthrough stops at each step's end and a check still opens; NVDA reads each prompt and result; the same URLs without `a11y` behave as before.
- [ ] **Step 9: `npm test`, `npm run typecheck`, `npm run build`; commit:** "Quiz and walkthrough questions in accessibility mode".

### Task 7: SkyCake Viewer and the docs

**Files:**
- Modify: `app/main.ts`, `app/app.css`, `scripts/app.mjs` (copy and assert the new page), `README.md`, `CHANGELOG.md`
- Create: `app/accessibility.html`, `docs/accessibility.md`

**Interfaces:**
- Consumes: `A11Y_KEY`, `stored`, `store` from `src/a11y.ts` (export them from `src/index.ts`).

- [ ] **Step 1: Start screen row.** In `app/main.ts`, a labeled switch row under the area list (`TEXT.a11y`, placeholder), the area rows' style, reading and writing `A11Y_KEY` with `stored` and `store`; it sets `data-a11y` on `<html>` at load and on change. A link beside it to `accessibility.html` (`TEXT.a11yHelp`, placeholder). The app does not pass `a11y` to `mount`, so the map's own row shows and both rows share the key.
- [ ] **Step 2: `app/app.css`.** `:root[data-a11y]` and `@media (prefers-contrast: more)` raise the start screen's grays and borders to the Global Constraints values (`#3a3f45` borders to `#767c83`, muted text to `#b0b4b9`, `--accent` to `#6aa6e8`), plus the Task 3 focus ring.
- [ ] **Step 3: `app/accessibility.html`.** A plain page in `privacy.html`'s form: what the mode changes and how to use the camera pad, In view, numbers, Check and Skip. Every sentence `Placeholder:` for Chris's copy. `scripts/app.mjs` copies it and asserts it in the shell.
- [ ] **Step 4: `docs/accessibility.md`.** For sites: turning it on (`a11y`, or the row, `skycake-a11y`); every change per mode (free roam, walkthroughs, quizzes, the chart reading hunt once built) with its WCAG 2.2 point (1.4.3, 1.4.11, 2.1.1, 2.1.4, 2.2.1, 2.2.2, 2.3.3, 2.4.3, 2.4.7, 2.5.1, 2.5.7, 2.5.8, 4.1.2); what a site must do (pass `a11y` from its toggle, never turn `ms` into a limit, treat `skipped` as not asked). Link it from `README.md`. A `CHANGELOG.md` Unreleased line.
- [ ] **Step 5: Verify:** `npm run app`, open `www/`: the row flips the start screen's contrast, opening an area shows the map in the mode, the map's row and the start screen's agree after a flip, `accessibility.html` loads offline after install.
- [ ] **Step 6: `npm test`, `npm run typecheck`, `npm run build`; commit:** "SkyCake Viewer accessibility row and accessibility docs".

### After this plan (other repos, Chris's call)

- instrumentready.com: `Airspace3D.astro` passes `a11y: a11yOn()` (import from `src/lib/a11y.ts`) once a skycake version with this ships.
- The chart reading hunt (PR #17) uses `picker` and the quiz's Skip when it is built.
