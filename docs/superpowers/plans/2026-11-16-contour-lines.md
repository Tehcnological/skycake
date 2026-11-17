# Contour lines on the start screen: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SkyCake Viewer's start screen shows faint contour lines that slowly ripple, at the top right of the page column and of each area card.

**Architecture:** A new build-time generator, `scripts/contours.mjs`, returns SVG text. `scripts/app.mjs` writes four SVG files into `www/` (top level, so the service worker's shell list picks them up). `app/app.css` uses them as backgrounds on the start screen only. The ripple is a CSS animation inside the SVG files; the still files have none.

**Tech Stack:** Node (plain `.mjs`, no new dependency), CSS.

**Spec:** `docs/superpowers/specs/2026-11-16-contour-lines-design.md`

## Global Constraints

- Never use em dashes, in code, comments, docs or commit messages.
- No on-screen words are added.
- Do not touch `style.css`, `src/` or `dist/`. `www/` is never committed.
- No new dependency. Nothing that bills.
- The picture is the one Chris approved: keep every seed, size, colour and timing below exactly.
- Commit as `git -c user.name="Chris DeFoe" -c user.email="chris@defoe.me"`, messages ending with the `Co-Authored-By` line.
- Merging is Chris's call, after `/code-review` at level high.

## Review Focus

1. **Motion when it is unwelcome.** Under `prefers-reduced-motion: reduce` or with `data-a11y` on `<html>`, the still files must be used and must contain no animation. Task 1's build assert pins the files; Task 2's check pins the selectors.
2. **Offline.** A saved app with no network must still show the lines: all four files must be in the service worker's `SHELL`. Task 1's build assert.
3. **Lines behind a control.** At 375 px wide, in normal and accessibility mode, no line may show behind Open area, Save or the accessibility switch. Task 2's screenshot step.
4. **More contrast asked for.** With `prefers-contrast: more` or `forced-colors: active` there are no lines, even though the moving rule is more specific. Task 2's check.
5. **Other pages and the map.** `help.html`, `privacy.html`, `accessibility.html` and `index.html?area=phoenix` show no lines. Task 2's check.

---

### Task 1: The generator and the build

**Files:**
- Create: `scripts/contours.mjs`
- Modify: `scripts/app.mjs` (after the icons loop, before `cp("data", ...)`; and the shell assert)

**Interfaces:**
- Produces: `export function contours(surface, moving)` where `surface` is `"page"` or `"card"` and `moving` is a boolean; returns the SVG text. Files `www/contours-page.svg`, `www/contours-page-still.svg`, `www/contours-card.svg`, `www/contours-card-still.svg`.

- [ ] **Step 1: Run the check and see it fail**

Run:
```bash
node --input-type=module -e "import { contours } from './scripts/contours.mjs'; import assert from 'node:assert/strict'; for (const s of ['page', 'card']) for (const m of [true, false]) { const t = contours(s, m); assert.ok(t.startsWith('<svg')); assert.equal(t.includes('animation'), m); } assert.equal(contours('page', true), contours('page', true)); assert.throws(() => contours('map', true)); console.log('ok')"
```
Expected: fails with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 2: Write `scripts/contours.mjs`**

Fixed values:

| | page | card |
|---|---|---|
| width, height (px) | 480, 360 | 200, 90 |
| field seed | 111 | 112 |
| field scale | 0.08 | 0.2 |
| line colour | `#2c3b4c` | `#33445a` |
| fade centre, radius | (480, 0), 350 | (200, 0), 68 |

A comment beside the colours says they sit between `--canvas` and `--divider` (page) and `--surface` and `--divider` (card) in `app/app.css`, and why they are literal: a background picture cannot read the page's variables.

The field and the lines, exactly (this is what makes the picture the approved one):

```js
// mulberry32: the same picture on every build.
const rng = (seed) => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// A smooth field, about 0.2 to 0.8: five long waves added up. A bigger `scale` gives smaller features.
function field(seed, scale) {
  const r = rng(seed);
  const waves = Array.from({ length: 5 }, () => [(r() - 0.5) * scale, (r() - 0.5) * scale, r() * 6.28, 0.5 + r()]);
  const total = waves.reduce((s, w) => s + w[3], 0);
  return (x, y) => 0.5 + (0.5 * waves.reduce((s, [kx, ky, p, a]) => s + a * Math.sin(kx * x + ky * y + p), 0)) / total;
}

// The lines where f equals `level`, each a list of [x, y]: marching squares on a 3px grid, pieces joined end to end.
function lines(f, w, h, level, step = 3) {
  const val = (i, j) => f(i * step, j * step) - level;
  // A crossing sits on a grid edge: "h,i,j" runs right from corner (i, j), "v,i,j" runs down from it.
  const point = (id) => { const [d, i, j] = id.split(",").map((s, n) => (n ? +s : s)); const a = val(i, j), b = d === "h" ? val(i + 1, j) : val(i, j + 1), t = a / (a - b); return d === "h" ? [(i + t) * step, j * step] : [i * step, (j + t) * step]; };
  const links = new Map();
  const link = (a, b) => { for (const [p, q] of [[a, b], [b, a]]) links.set(p, [...(links.get(p) ?? []), q]); };
  for (let j = 0; j < Math.ceil(h / step); j++) for (let i = 0; i < Math.ceil(w / step); i++) {
    const tl = val(i, j), tr = val(i + 1, j), bl = val(i, j + 1), br = val(i + 1, j + 1);
    const crossed = [[`h,${i},${j}`, tl, tr], [`v,${i + 1},${j}`, tr, br], [`h,${i},${j + 1}`, bl, br], [`v,${i},${j}`, tl, bl]].filter(([, a, b]) => a > 0 !== b > 0).map(([id]) => id);
    if (crossed.length >= 2) link(crossed[0], crossed[1]);
    if (crossed.length === 4) link(crossed[2], crossed[3]); // a saddle: either pairing will do
  }
  const seen = new Set();
  const walk = (start) => { const line = [start]; seen.add(start); for (let at = start, next; (next = links.get(at).find((n) => !seen.has(n))); at = next) { seen.add(next); line.push(next); } return line; };
  const out = [];
  for (const [id, to] of links) if (to.length === 1 && !seen.has(id)) out.push(walk(id)); // open lines, from one end
  for (const id of links.keys()) if (!seen.has(id)) { const ring = walk(id); out.push([...ring, ring[0]]); } // closed rings
  return out.map((line) => line.map(point));
}
```

`contours(surface, moving)`:
- Throws on a surface that is not `page` or `card`.
- Seven heights, `k / 8` for k = 1 to 7, one `<g>` each, every line a `<path>` with coordinates to one decimal (`M x y L x y ...`).
- Root: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" fill="none" stroke="url(#c)" stroke-linecap="round" stroke-linejoin="round">`. Stroke width is the default, 1.
- `<defs>`: one `radialGradient id="c" gradientUnits="userSpaceOnUse"` at the fade centre and radius, from the line colour at offset 0 to the same colour with `stop-opacity="0"` at offset 1.
- `<style>`, still: `g{opacity:.65}`. Moving: `@keyframes t{50%{opacity:1}}g{opacity:.4;animation:t 10s ease-in-out infinite}`, and the `<g>` at index n (0 to 6) carries `style="animation-delay:-(n * 10 / 7)s"` to one decimal.
- Self-check with `node:assert/strict` before returning: more than three lines in all, and every coordinate finite, at least 0 and at most the width or height plus one grid step (3). Ruling: the spec says "inside the picture"; the grid's last cell overhangs the edge by up to one step and the viewBox clips it, and trimming the grid would leave a 2 px gap at a card's right edge.

- [ ] **Step 3: Run the Step 1 check**

Expected: `ok`.

- [ ] **Step 4: Write the files in `scripts/app.mjs`**

After the icons loop: for each surface and each of moving and still, `writeFile` to `www/contours-<surface>.svg` and `www/contours-<surface>-still.svg`, under a one-line comment (the start screen's contour lines, top level so they are in the shell and work offline). Extend the existing shell assert with the four file names, and add one assert that each still file's text has no `animation` and each moving file's has.

- [ ] **Step 5: Build**

Run: `npm run app`
Expected: the usual `www/: N shell files, ...` line with N four higher than before (run it once before Step 4 to read the old N), and the four files present: about 37 KB each for the page, about 9 KB each for the card.

- [ ] **Step 6: Commit**

```bash
git add scripts/contours.mjs scripts/app.mjs
git commit -m "Contour line pictures for the start screen, made by the Viewer's build"
```

### Task 2: The styles, the checks and the docs

**Files:**
- Modify: `app/app.css` (a new block after the `.areas p.notice` rule, before the accessibility mode block)
- Modify: `CHANGELOG.md` (one line under Unreleased), `README.md` (one sentence in "SkyCake Viewer (the app)", in the `npm run app` paragraph)

**Interfaces:**
- Consumes: the four files from Task 1, by name, relative to `app.css`.

- [ ] **Step 1: Add the block to `app/app.css`**

```css
/* Faint contour lines at the top right of the start screen and of each card, drawn by scripts/contours.mjs. Decoration
   only: they end before any button, hold still where motion is unwelcome, and go when more contrast is asked for.
   #app keeps them off the other pages, which use main.areas. */
#app .areas { background: url(contours-page-still.svg) top right / 480px 360px no-repeat; }
#app .areas li { background-image: url(contours-card-still.svg); background-position: top right; background-size: 200px 90px; background-repeat: no-repeat; }
@media (prefers-reduced-motion: no-preference) {
  :root:not([data-a11y]) #app .areas { background-image: url(contours-page.svg); }
  :root:not([data-a11y]) #app .areas li { background-image: url(contours-card.svg); }
}
/* !important: the moving rules above are more specific. */
@media (prefers-contrast: more), (forced-colors: active) {
  #app .areas, #app .areas li { background-image: none !important; }
}
```

- [ ] **Step 2: Build and serve**

Run: `npm run app`, then `npm run demo` in the background (serves http://localhost:5179/www/).

- [ ] **Step 3: Check the computed backgrounds**

In a browser that can emulate media features (headless Edge over its debugging port: `Emulation.setEmulatedMedia`), with a fresh profile, at 375 by 667, read `getComputedStyle(el).backgroundImage` for `#app .areas` and for the first `#app .areas li`. Expected:

| State | `#app .areas` | first card |
|---|---|---|
| default | ends `contours-page.svg")` | ends `contours-card.svg")` |
| `prefers-reduced-motion: reduce` | ends `contours-page-still.svg")` | ends `contours-card-still.svg")` |
| `data-a11y` set on `<html>` | still file | still file |
| `prefers-contrast: more` | `none` | `none` |
| `forced-colors: active` | `none` | `none` |

And on `help.html`, `privacy.html` and `accessibility.html`, `.areas` has `none`; on `index.html?area=phoenix` there is no `.areas` element.

- [ ] **Step 4: Look at it**

Screenshots at 375 by 667 (2x) and at 1280 by 800, start screen, normal and accessibility mode. Expected: lines at the top right of the column and of each card; none behind Open area, Save, the accessibility switch or its text; the card's own background colour unchanged. Two default-state screenshots five seconds apart differ (the ripple runs); two with reduced motion do not. If a line shows behind a control, lower that surface's fade radius in `scripts/contours.mjs` and rebuild.

- [ ] **Step 5: Docs**

`CHANGELOG.md`, under Unreleased: `- SkyCake Viewer's start screen has faint contour lines at the top right of the page and of each card, with a slow ripple. The build draws them (\`scripts/contours.mjs\`); they hold still under reduced motion and in accessibility mode, and are off when more contrast is asked for.`

`README.md`: one sentence in the `npm run app` paragraph saying the build also draws the start screen's contour line pictures, from `scripts/contours.mjs`.

- [ ] **Step 6: Typecheck, test, commit**

Run: `npm run typecheck` and `npm test`. Expected: both pass (neither covers the new files; they must not regress).

```bash
git add app/app.css CHANGELOG.md README.md
git commit -m "Contour lines on SkyCake Viewer's start screen"
```

## After the tasks

Push the branch and open a PR only on Chris's say. Then `/code-review` at level high, fix what it finds, and wait for Chris to say merge. Clean up the spike: the scratchpad's `dither-spike` folder and the `skycake-dither` entry in the project's `.claude/launch.json`.
