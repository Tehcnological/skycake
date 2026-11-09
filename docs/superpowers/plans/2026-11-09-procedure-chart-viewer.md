# Procedure Chart Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The FAA charts of an area's approaches, departures and arrivals, rendered at build time into committed images, shown in free roam's plate panel beside the 3D view with a picker, page arrows, pan and zoom, a Map / Plate / Split switch, and opened by walkthrough and quiz scenes.

**Architecture:** Build side: pure matching and metafile reading in a new `src/tpp.ts` (Node-tested, imported by `scripts/build-area.ts`), which renders each d-TPP page to a palette PNG and writes `charts/<airport>.json` per airport. View side: `src/plate.ts` owns the whole panel (the shell #23 built in `freeroam.ts` moves there, so walkthroughs and quizzes get the same panel), with its pure pieces (picker order, pan and zoom math) exported and Node-tested. Scenes gain `plate`, checked by `resolve()` for shape and by `validate.ts` against the chart index.

**Tech Stack:** TypeScript 5.9, pdfjs-dist 6.4.299 and @napi-rs/canvas 1.0.13 (already used for diagrams), sharp 0.35.5, node:test via tsx. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-09-procedure-chart-viewer-design.md`. Branch `chart-viewer` (off `ui-polish`, PR #23).

## Global Constraints

- No em dashes anywhere: code, comments, docs, commit messages. No Garmin or G1000 names.
- Public domain FAA and USGS data only. Charts are rendered from the d-TPP PDFs at build time and committed; the browser never fetches from the FAA.
- Pages: 200 dpi (`scale = 200 / 72`), greyscale, 8-shade palette PNG, about 90 KB (KPHX ILS OR LOC RWY 07R about 110 KB). One file per `pdf_name`, shared by every airport that lists it: `data/<area>/charts/<pdf_name lower case, no .PDF>.png`.
- Expected size: Phoenix about 187 unique pages (about 16 MB), Miami about 333 (about 29 MB). Every file far under 25 MiB.
- The panel never opens on its own: only the Plate button or tab, the Map / Plate / Split switch, or a scene's `plate`.
- The panel's words are real defaults in `Labels` (Chris may override any), in free roam, walkthroughs and quizzes alike. No other new walkthrough or quiz words; if one is needed it reads `"Placeholder: ..."`.
- Controls 44 px or taller (48 px in accessibility mode, as `style.css` already does for `.sc-x`, `.sc-round`, `.sc-seg button`); neighbouring controls match in height and style. "Not for navigation" stays on screen in every layout. Keep `var(--red, ...)` in `style.css`.
- Grep before naming any new helper or field. Known traps: `feet` (`src/airspace.ts`), `chartsIn`/`chartsOf`, and `AirspaceFile.charts` (the map charts). The spec's `area.json` `charts: true` is therefore named `plates: true`. `Pick` is a TypeScript builtin.
- npm is broken in this shell; call node directly:
  - tests: `node node_modules/tsx/dist/cli.mjs --test src/*.test.ts` (or one file)
  - typecheck: `node node_modules/typescript/bin/tsc -p tsconfig.json`
  - build: `node node_modules/typescript/bin/tsc -p tsconfig.build.json` (commit `dist/` with every `src/` change; CI fails on a stale `dist/`)
  - data: `node node_modules/tsx/dist/cli.mjs scripts/build-area.ts <area> --no-chart`
  - app: `node scripts/app.mjs`
- Commit as `git -c user.name="Chris DeFoe" -c user.email="chris@defoe.me" commit ...`.
- Phone checks use CDP device emulation (390x844, mobile, touch), upright and sideways; headless Chromium will not lay out under 500 px.
- Out of scope: georeferencing, tapping a chart to find a fix in 3D, airport diagrams in the panel, takeoff and alternate minimums, hot spot pages, areas beyond Phoenix and Miami.

## Review Focus

1. **Picking a chart re-enters `procedures()`.** Picking "ILS OR LOC RWY 07R" adds `ILS RWY 07R` and `LOC RWY 07R`, and each new ref asks for its chart. Expected: the panel stays on the chart the student picked. Test in Task 3 (`chartFor` keeps a current chart that draws the ref).
2. **A scene names a chart the index no longer has** (the FAA renamed it in a new cycle and the site did not revalidate). Expected: a console warning, the panel stays as it was, the rest of the scene still shows, nothing throws. Test in Task 7 (validation lists the valid names); hand check in Task 8.
3. **Scenes faster than chart loads** (Next pressed three times in a second). Expected: only the newest scene's chart shows; an older index or image arriving late never replaces it. Hand check in Task 8 with network throttling.
4. **An area without charts** (data built before this, or a site serving older data). Expected: no Plate button or tab, no panel, a scene's `plate` warns once and nothing opens. Test in Task 4 (`has` false).
5. **The metafile lists a continuation page before its first page, or a deleted chart.** Expected: pages first page first (`, CONT.1` then `, CONT.2`), deleted records (`useraction` D) left out. Test in Task 1.

---

### Task 1: Chart index and matching (`src/tpp.ts`)

**Files:**
- Create: `src/tpp.ts`, `src/tpp.test.ts`

**Interfaces:**
- Produces (all pure, no I/O):
  - `export type ChartEntry = { name: string; kind: "IAP" | "DP" | "STR"; pages: string[]; procedures: string[] }` (verbatim from the spec).
  - `export type ChartRecord = { code: string; name: string; pdf: string; action: string }`.
  - `airportBlock(meta: string, id: string): string | undefined`: the airport's block of the metafile, matched by `icao_ident` or `apt_ident` (the lookup `diagrams()` does inline today).
  - `chartRecords(block: string): ChartRecord[]`: every `<record>` in metafile order (`chart_code`, `chart_name`, `pdf_name`, `useraction`).
  - `chartGroups(recs: ChartRecord[]): { kind: ChartEntry["kind"]; name: string; pdfs: string[] }[]`: codes `IAP`, `DP` and `STR` (the metafile never uses `STAR`); `useraction` `D` left out; `"<name>, CONT.<n>"` folded into `<name>` in page order; groups in metafile order of their first page.
  - `pageFile(pdf: string): string`: `"00322IL7R.PDF"` to `"00322il7r.png"`.
  - `approachMatches(chart: string, procedure: string): boolean`.
  - `codesIn(text: string): string[]`: both names of every `(A.B)` computer code, in order, spaces inside the parentheses allowed. The code is in pdf.js's text layer: page 1 of 2611's `00322BUCKEYE.PDF` gives `(BXK4.BXK)` and `00322EAGUL.PDF` gives `(EAGUL.EAGUL6)`, `(ZUN.EAGUL6)`, `(INW.EAGUL6)`, `(GUP.EAGUL6)` from `getTextContent()` (checked 2026-11-09), so no outline reading is needed.
  - `proceduresOn(kind: ChartEntry["kind"], name: string, firstPageText: string, procedures: { type: "IAP" | "SID" | "STAR"; name: string }[]): string[]`: IAP by `approachMatches`; DP by SID names in `codesIn`; STR by STAR names in `codesIn`; deduped, in the airport's procedure order.
  - `noChart(entries: ChartEntry[], procedures: { name: string }[]): string[]`: procedure names no entry draws.

- [ ] **Step 1: Get the metafile.** If `.cache/dtpp/2611/d-tpp_Metafile.xml` is missing in this worktree, copy it from the main checkout (`C:/Users/Chris/Documents/Claude/CFI Projects/skycake/.cache/dtpp/2611/d-tpp_Metafile.xml`) to the same path. Check the fixture below against the KPHX block's opening tag and records (an IAP, a DP, its `, CONT.1`, an STR) and fix any tag that differs.

- [ ] **Step 2: Write the failing tests** (`src/tpp.test.ts`)

```ts
const rec = (code: string, name: string, pdf: string, action = "") => `<record><chart_code>${code}</chart_code><chart_name>${name}</chart_name><useraction>${action}</useraction><pdf_name>${pdf}</pdf_name></record>`;
const META = `<airport_name ID="PHOENIX SKY HARBOR INTL" apt_ident="PHX" icao_ident="KPHX">` +
  rec("APD", "AIRPORT DIAGRAM", "00322AD.PDF") + rec("IAP", "ILS OR LOC RWY 07R", "00322IL7R.PDF") +
  rec("DP", "BUCKEYE FOUR, CONT.1", "00322BUCKEYE_C.PDF") + rec("DP", "BUCKEYE FOUR", "00322BUCKEYE.PDF") +
  rec("STR", "EAGUL SIX", "00322EAGUL.PDF") + rec("IAP", "VOR RWY 26", "DELETED_JOB.PDF", "D") +
  `<airport_name ID="SCOTTSDALE" apt_ident="SDL" icao_ident="KSDL">` + rec("IAP", "VOR/DME-A", "00860VDA.PDF");
const KPHX = JSON.parse(readFileSync("data/phoenix/area.json", "utf8")).airports.find((a: { id: string }) => a.id === "KPHX").procedures;

test("records by airport; continuation pages fold in, first page first; deleted and other charts left out", () => {
  assert.equal(chartRecords(airportBlock(META, "KPHX")!).length, 6);
  assert.deepEqual(chartGroups(chartRecords(airportBlock(META, "KPHX")!)), [
    { kind: "IAP", name: "ILS OR LOC RWY 07R", pdfs: ["00322IL7R.PDF"] },
    { kind: "DP", name: "BUCKEYE FOUR", pdfs: ["00322BUCKEYE.PDF", "00322BUCKEYE_C.PDF"] },
    { kind: "STR", name: "EAGUL SIX", pdfs: ["00322EAGUL.PDF"] },
  ]);
  assert.equal(airportBlock(META, "SDL")?.includes("00860VDA.PDF"), true);
  assert.equal(pageFile("00322IL7R.PDF"), "00322il7r.png");
});
test("approaches match on type and runway", () => {
  assert.deepEqual(proceduresOn("IAP", "ILS OR LOC RWY 07R", "", KPHX), ["ILS RWY 07R", "LOC RWY 07R"]);
  assert.deepEqual(proceduresOn("IAP", "RNAV (GPS) Y RWY 08", "", KPHX), ["RNAV (GPS) Y RWY 08"]);
  assert.deepEqual(proceduresOn("IAP", "ILS OR LOC/DME RWY 07L", "", KPHX), ["ILS RWY 07L", "LOC RWY 07L"]);
  assert.equal(approachMatches("LOC/DME RWY 21", "LOC RWY 21"), true);
  assert.equal(approachMatches("RNAV (GPS) RWY 3", "RNAV (GPS) RWY 03"), true);
  assert.equal(approachMatches("ILS Z OR LOC Z RWY 09", "LOC Z RWY 09"), true);
  assert.equal(approachMatches("VOR/DME-A", "VOR/DME-A"), true);
  assert.equal(approachMatches("RNAV (GPS)-B", "RNAV (GPS)-E"), false);
  assert.equal(approachMatches("RNAV (GPS) Y RWY 08", "RNAV (GPS) Z RWY 08"), false);
  assert.equal(approachMatches("LOC RWY 25", "LOC BC RWY 25"), false);
  for (const t of ["ILS", "LOC", "LOC BC", "RNAV (GPS)", "RNAV (RNP)", "GPS", "VOR", "VOR/DME", "NDB", "NDB/DME", "LDA", "SDF", "TACAN"])
    assert.equal(approachMatches(`${t} RWY 12`, `${t} RWY 12`), true, t); // every type src/cifp.ts names
});
test("departures and arrivals match on the computer code", () => {
  assert.deepEqual(codesIn("BUCKEYE FOUR DEPARTURE ( BXK4 . BXK ) ... (BLH.EAGUL6)"), ["BXK4", "BXK", "BLH", "EAGUL6"]);
  assert.deepEqual(proceduresOn("DP", "BUCKEYE FOUR", "TAKEOFF ... (BXK4.BXK)", KPHX), ["BXK4"]);
  assert.deepEqual(proceduresOn("STR", "EAGUL SIX", "(EAGUL6.EAGUL) BLYTHE TRANSITION (BLH.EAGUL6)", KPHX), ["EAGUL6"]);
});
test("a chart with no procedure (a charted visual, synthetic: 2611 has none here) matches nothing; a procedure with no chart is named", () => {
  assert.deepEqual(proceduresOn("IAP", "RIVER VISUAL RWY 19", "", KPHX), []);
  const entries = [{ name: "BUCKEYE FOUR", kind: "DP" as const, pages: [], procedures: ["BXK4"] }];
  assert.deepEqual(noChart(entries, [{ name: "BXK4" }, { name: "TFD4" }]), ["TFD4"]);
});
```

- [ ] **Step 3: Run** `node node_modules/tsx/dist/cli.mjs --test src/tpp.test.ts`. Expected: fail, no `src/tpp.ts`.
- [ ] **Step 4: Implement `src/tpp.ts`.** `approachMatches` rules, in order:
  1. Split each name into its types and its tail: ` RWY <n>` (runway padded to two digits) or `-<letter>` (circling). Tails must be equal.
  2. Split the chart's types on ` OR `. Normalize every type, the procedure's too, by removing `/DME` (so `LOC/DME` and `LOC` match, and `VOR/DME` and `VOR`). Match when the procedure's type is one of the chart's.
- [ ] **Step 5: Run the tests and the typecheck.** Expected: all pass.
- [ ] **Step 6: Commit** `src/tpp.ts src/tpp.test.ts` and `dist/` after the build: "Chart index: d-TPP records and matching charts to procedures".

### Task 2: Render and write the charts (`scripts/build-area.ts`)

**Files:**
- Modify: `scripts/build-area.ts` (header comment, `diagrams()`, new `plates()`, the area loop), `src/airspace.ts` (`AirspaceFile.plates?: true`), `.github/workflows/data.yml` (PR body grep)
- Data: `data/phoenix/charts/`, `data/miami/charts/`, both `area.json`

**Interfaces:**
- Consumes: Task 1's `airportBlock`, `chartRecords`, `chartGroups`, `pageFile`, `proceduresOn`, `noChart`, `ChartEntry`.
- Produces: `data/<area>/charts/<page>.png`, `data/<area>/charts/<airport>.json` (`ChartEntry[]` in metafile order), `area.json` `plates: true` when any chart was written. `AirspaceFile` gains `plates?: true`.

- [ ] **Step 1: Share the metafile.** Hoist the cycle code, base URL, cache dir and metafile download out of `diagrams()` into `async function dtpp(): Promise<{ base: string; dir: string; meta: string }>`, called once per area; `diagrams()` takes it and uses `airportBlock`. No behavior change.
- [ ] **Step 2: Write `async function plates(airports: Airport[], t: { base: string; dir: string; meta: string }): Promise<boolean>`.** Clears and recreates `OUT/charts`. Per airport: `chartGroups(chartRecords(airportBlock(...)))`; for each group, each pdf downloaded with `download(\`${t.base}/${pdf}\`, t.dir)`, rendered once per area (a `Set` of written pdfs; an arrival shared by several airports is one file) with pdf.js at `scale = 200 / 72` onto `createCanvas` as `diagrams()` does, then `sharp(rgba, { raw }).greyscale().png({ palette: true, colours: 8, effort: 10 })` to `charts/${pageFile(pdf)}`. The first page's `getTextContent()` strings joined with spaces feed `proceduresOn`. Writes `charts/<airport>.json` for each airport with entries. Returns whether anything was written.
- [ ] **Step 3: Log for the Data cycle PR.** Per area: `charts: <n> pages, <MB> MB`. Per airport with any: `charts with no procedure: <airport> <name>, <name>` and `procedures with no chart: <airport> <name>, <name>`. In `data.yml`'s PR body grep add `charts|with no` to the `-E` pattern.
- [ ] **Step 4: Wire it.** In the area loop, after `diagrams()`: `const hasPlates = await plates(airports, t)`; `area.json` gets `...(hasPlates && { plates: true })`. Add `charts/*.png` and `charts/*.json` to the header comment's file list.
- [ ] **Step 5: Phoenix only, then check the matching.** Run `node node_modules/tsx/dist/cli.mjs scripts/build-area.ts phoenix --no-chart`. Expected: about 187 pages, about 16 MB; `charts/00322il7r.png` (or whatever KPHX's ILS OR LOC RWY 07R `pdf_name` is) about 110 KB; `procedures with no chart` lists nothing at KPHX; `charts with no procedure` holds only charts skycake has no procedure for. Graphic obstacle departures are `chart_code` `ODP`, so they are left out, as the spec says. Open three PNGs and confirm they are crisp greyscale. Run `git diff --stat data/phoenix` and note any change outside `charts/` and `area.json` (the rebuild also refreshes airspace and procedures for the current cycle); stop and report if a matching rule is wrong before Miami.
- [ ] **Step 6: Miami.** Same command with `miami`. Expected: about 333 pages, about 29 MB.
- [ ] **Step 7: Sizes.** `find data -type f -size +1M` lists only the map charts and terrain it listed before; no PNG over 300 KB.
- [ ] **Step 8: Tests, typecheck, build. Commit** `scripts/build-area.ts src/airspace.ts .github/workflows/data.yml data dist`: "Procedure charts: render d-TPP pages and match them to procedures".

### Task 3: The viewer's pure pieces (`src/plate.ts`)

**Files:**
- Modify: `src/plate.ts` (new exports only; `plateView` unchanged)
- Create: `src/plate.test.ts`

**Interfaces:**
- Consumes: `ChartEntry` (Task 1), `ProcedureRef` (`src/scene.ts`).
- Produces:
  - `export type PlatePick = { airport: string; entry: ChartEntry }`.
  - `pickOrder(indexes: Map<string, ChartEntry[]>, refs: ProcedureRef[], airport: string | null): PlatePick[]`: for each ref in order, the first chart of its airport's index that draws it (each chart once; a ref whose index is not loaded is skipped); then every other chart of `airport` in index order.
  - `chartFor(entries: ChartEntry[], name: string, current: ChartEntry | null): ChartEntry | null`: `current` when it draws `name`, else the first entry that does, else null.
  - `pickRefs(p: PlatePick): ProcedureRef[]`.
  - `pageArrows(pages: number, page: number): { back: boolean; next: boolean } | null`: null for one page.
  - `export type PanZoom = { x: number; y: number; s: number }` (`Fit` is taken by `src/diagram.ts`) (CSS `translate(x px, y px) scale(s)`, origin top left).
  - `fitChart(img: { w: number; h: number }, box: { w: number; h: number }): PanZoom`: contained and centred.
  - `zoomAbout(t: PanZoom, factor: number, at: [x: number, y: number], min: number, max: number): PanZoom`: `s` clamped, the point under `at` stays put.

- [ ] **Step 1: Write the failing tests** (`src/plate.test.ts`)

```ts
const e = (name: string, procedures: string[], pages = 1): ChartEntry => ({ name, kind: "IAP", pages: Array.from({ length: pages }, (_, i) => `${i}.png`), procedures });
const ils07L = e("ILS OR LOC/DME RWY 07L", ["ILS RWY 07L", "LOC RWY 07L"]);
const ils07R = e("ILS OR LOC RWY 07R", ["ILS RWY 07R", "LOC RWY 07R"]), bxk = e("BUCKEYE FOUR", ["BXK4"], 2), visual = e("RIVER VISUAL RWY 19", []);
const sdl = e("RNAV (RNP) Z RWY 03", ["RNAV (RNP) Z RWY 03"]);
const idx = new Map([["KPHX", [ils07L, ils07R, bxk, visual]], ["KSDL", [sdl]]]);

test("the picker: charts of what is shown first, then the airport's others in FAA order", () => {
  const names = (refs: ProcedureRef[], at: string | null) => pickOrder(idx, refs, at).map((p) => `${p.airport} ${p.entry.name}`);
  assert.deepEqual(names([{ airport: "KPHX", name: "BXK4" }, { airport: "KPHX", name: "ILS RWY 07R" }, { airport: "KPHX", name: "LOC RWY 07R" }], "KPHX"),
    ["KPHX BUCKEYE FOUR", "KPHX ILS OR LOC RWY 07R", "KPHX ILS OR LOC/DME RWY 07L", "KPHX RIVER VISUAL RWY 19"]);
  assert.deepEqual(names([{ airport: "KSDL", name: "RNAV (RNP) Z RWY 03" }], "KPHX")[0], "KSDL RNAV (RNP) Z RWY 03");
  assert.deepEqual(names([{ airport: "KFFZ", name: "X" }], null), []);
});
test("a shown procedure's chart, keeping the one picked when it draws it", () => {
  assert.equal(chartFor(idx.get("KPHX")!, "LOC RWY 07R", ils07R), ils07R); // picking ILS OR LOC RWY 07R re-enters with its refs
  assert.equal(chartFor(idx.get("KPHX")!, "ILS RWY 07L", null), ils07L);
  assert.equal(chartFor(idx.get("KPHX")!, "ILS RWY 07L", bxk), ils07L);
  assert.equal(chartFor(idx.get("KPHX")!, "TFD4", null), null);
});
test("picking shows the chart's procedures; arrows only for several pages", () => {
  assert.deepEqual(pickRefs({ airport: "KPHX", entry: ils07R }), [{ airport: "KPHX", name: "ILS RWY 07R" }, { airport: "KPHX", name: "LOC RWY 07R" }]);
  assert.deepEqual(pickRefs({ airport: "KPHX", entry: visual }), []);
  assert.equal(pageArrows(1, 1), null);
  assert.deepEqual(pageArrows(2, 1), { back: false, next: true });
  assert.deepEqual(pageArrows(2, 2), { back: true, next: false });
});
test("fit and zoom", () => {
  const f = fitChart({ w: 1700, h: 2200 }, { w: 400, h: 600 });
  assert.ok(Math.abs(f.s - 400 / 1700) < 1e-9 && Math.abs(f.x) < 1e-9 && Math.abs(f.y - (600 - 2200 * f.s) / 2) < 1e-9);
  assert.deepEqual(zoomAbout({ x: 0, y: 0, s: 1 }, 2, [100, 50], 0.5, 3), { x: -100, y: -50, s: 2 });
  assert.deepEqual(zoomAbout({ x: 0, y: 0, s: 2 }, 4, [0, 0], 0.5, 3), { x: 0, y: 0, s: 3 });
  assert.equal(zoomAbout({ x: 0, y: 0, s: 1 }, 0.1, [0, 0], 0.5, 3).s, 0.5);
});
```

- [ ] **Step 2: Run** the file. Expected: fail, exports missing.
- [ ] **Step 3: Implement the six functions and two types.**
- [ ] **Step 4: Run tests and typecheck.** Expected: pass.
- [ ] **Step 5: Build; commit** `src/plate.ts src/plate.test.ts dist`: "Plate viewer: picker order, page arrows, fit and zoom".

### Task 4: The panel shell moves into `src/plate.ts`

A refactor so walkthroughs and quizzes (Task 8) can show the same panel. Nothing changes on screen.

**Files:**
- Modify: `src/plate.ts`, `src/freeroam.ts` (lines 178-185 and 290-345 today: panel elements, `setPlate`, `togglePlate`, full screen, close, divider, `setShare`, `upright`), `src/plate.test.ts`

**Interfaces:**
- Consumes: `h`, `icon`, `ICONS`, `Context` from `src/freeroam.ts`.
- Produces (replaces #23's stub signature; `plateView` is not exported from `src/index.ts`):

```ts
export type PlateMode = "split" | "full" | null;
export type Plates = {
  has: boolean;
  /** The panel (aside.sc-plate) for the caller to place; null when the area has no charts. */
  el: HTMLElement | null;
  mode: () => PlateMode;
  set: (mode: PlateMode) => void;
  procedures: (refs: ProcedureRef[], airport: string | null) => void;
  destroy: () => void;
};
export function plateView(c: Context, on: {
  show: (ref: ProcedureRef) => void;
  /** Every mode change, from inside the panel or set(). */
  mode?: (m: PlateMode) => void;
  /** Where focus goes when the panel closes with focus inside it. Default: the view. */
  back?: () => HTMLElement;
  /** The map's room on an upright phone, for the divider. Default: the figure's box. */
  room?: () => { top: number; bottom: number };
}): Plates;
```

- [ ] **Step 1: Write the failing test** (in `src/plate.test.ts`)

```ts
// data: data/phoenix/area.json read as the other tests do (it has plates: true since Task 2).
test("an area without charts has no panel", () => {
  const p = plateView({ data: { ...data, plates: undefined } } as unknown as Context, { show: () => {} });
  assert.equal(p.has, false);
  assert.equal(p.el, null);
  assert.equal(p.mode(), null);
});
```

- [ ] **Step 2: Run** it. Expected: fail (the stub's signature).
- [ ] **Step 3: Move the shell.** `has = !!c.data.plates`; without plates, return before touching the DOM. Otherwise build the aside, head (title, full, close), body and divider as free roam does now, with `set` doing `setPlate`'s work and calling `on.mode`, and the divider, `setShare` (25% to 75%, 5% per arrow key, start 0.38) and `upright` media query inside. Escape inside the panel closes it, moves focus to `on.back?.() ?? view` and stops propagation. `destroy` removes the aside and its listeners.
- [ ] **Step 4: Free roam keeps** the Plate button, the Plate tab and its fig-level Escape branch; it places `plates.el` where the aside is today, hides button and tab when `!plates.has`, passes `mode` (button `aria-expanded`, tab `aria-pressed`), `back: () => opener(plateButton, tabs.plate)` and `room` (header bottom to tab bar top).
- [ ] **Step 5: Run tests and typecheck.** Expected: pass.
- [ ] **Step 6: Hand check** (build, `node scripts/demo.mjs`, `/demo/`): the panel opens, goes full screen, closes, Escape closes and returns focus, the divider drags and steps with arrows, on desktop and at 390x844 upright and sideways, exactly as before the change.
- [ ] **Step 7: Build; commit** `src/plate.ts src/freeroam.ts src/plate.test.ts dist`: "Plate panel: move the shell into plate.ts".

### Task 5: The chart viewer

**Files:**
- Modify: `src/plate.ts`, `src/freeroam.ts` (`Context.url`), `src/ui.ts` (`Labels`, `LABELS`, `context.url`), `style.css`

**Interfaces:**
- Consumes: Task 3's helpers, Task 4's `plateView`, `twoFingers` and `isTap` (`src/gesture.ts`).
- Produces:
  - `Context.url: (path: string) => string`: a path in the area's data folder to an absolute URL (`mount`'s `url`).
  - `Labels` gains, with these defaults: `plateChart: "Chart"`, `platePage: (n, of) => \`Page ${n} of ${of}\``, `plateMap: "Map"`, `platePlate: "Plate"`, `plateSplit: "Split"`, `zoomIn: "Zoom in"`, `zoomOut: "Zoom out"`, `zoomFit: "Fit"`, `plateMissing: "This chart did not load."`.

- [ ] **Step 1: The index.** `charts/<airport>.json` through `c.url`, fetched the first time the open panel (or Task 8's `open`) needs that airport, never while the panel is closed, and cached per airport for the panel's life; a failed fetch counts as `[]`. Every load is ticketed: a result for an older request is dropped.
- [ ] **Step 2: The picker.** The title slot holds a `<select>` (`aria-label` `L.plateChart`) of `pickOrder(...)`; an option for another airport reads `"<airport> <name>"`. With nothing to list, the title stays `L.plate` and the body is empty. Picking shows page 1 and calls `on.show` for each of `pickRefs(pick)`.
- [ ] **Step 3: Page arrows.** Two `sc-x` buttons placed with `title.after()`, hidden when `pageArrows` is null, disabled at the ends, each labelled with the page it goes to (`L.platePage(n - 1, of)`, `L.platePage(n + 1, of)`).
- [ ] **Step 4: The image.** `<img class="sc-plate-img" draggable="false">` with `alt` the chart's name and `src` `c.url(\`charts/${page}\`)`, `transform-origin: 0 0`, positioned at the body's top left. On load: `fitChart` to the body. On error: the body shows `<p class="sc-plate-missing">` with `L.plateMissing`.
- [ ] **Step 5: Pan and zoom.** On `.sc-plate-body` (`touch-action: none`, `overflow: hidden`; drop it from `style.css`'s `touch-action: pan-y` list): one pointer drags; two feed `twoFingers` (`shape` zooms by `zoom` about `mid` and follows the midpoint; `tilt` pans by `dy`); wheel zooms by `Math.exp(-deltaY * 0.002)` about the cursor; two `isTap(.., c.a11y)` taps within 300 ms fit. `zoomAbout` limits: `min` the fit's `s`, `max` 3. A body `ResizeObserver` refits only while the transform still equals the last fit. Leave a `shortcut: no pan limit, Fit brings the chart back; clamp if students lose it` comment.
- [ ] **Step 6: Keyboard and accessibility mode.** The body is focusable (`tabindex="0"`, `aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + -"`): arrows pan 15% of the body, `+`/`=` and `-` zoom by 1.25 about the centre, only while it has focus. These keys act only while the chart has focus (as the view's own arrows and plus and minus do), which is why they sit alongside the spec's "no single-key shortcuts". Three `sc-round` buttons (`L.zoomIn`, `L.zoomOut`, `L.zoomFit`) in a `role="group"` in the body's corner, shown only under `.skycake[data-a11y]`.
- [ ] **Step 7: Following the 3D view.** `procedures(refs, airport)` keeps refs and airport; with the panel open it loads the indexes the picker needs and redraws it. A ref not in the previous list is the newest: with the panel open, show `chartFor(index, ref.name, current)` (no change when null); with it closed, only remember it. Opening the panel shows the remembered one, else the current chart, else the first pick.
- [ ] **Step 8: Labels and context.** Add the labels to `Labels` and `LABELS` (real defaults, no `Placeholder:`, wherever the panel shows), and `url` to the `Context` `mount` builds.
- [ ] **Step 9: Run tests and typecheck.** Expected: pass.
- [ ] **Step 10: Hand check** (build, demo): at KPHX, Plate opens the panel; the picker lists shown procedures' charts first; picking ILS OR LOC RWY 07R draws it in 3D; BUCKEYE FOUR shows arrows and its CONT.1; adding EAGUL6 from search with the panel open switches to EAGUL SIX, with it closed does not open it; picking "ILS OR LOC RWY 07R" adds both its procedures and the panel stays on that chart; drag, wheel, double-click fit; a blocked PNG (DevTools request blocking) shows the message. Phone 390x844 upright and sideways: pinch, drag, double tap. Accessibility mode: the three buttons show, Tab reaches picker, arrows, body and buttons; arrows and plus and minus work on the focused chart.
- [ ] **Step 11: Build; commit** `src/plate.ts src/freeroam.ts src/ui.ts style.css dist`: "Plate viewer: picker, page arrows, pan and zoom".

### Task 6: Map / Plate / Split switch

**Files:**
- Modify: `src/plate.ts`, `style.css` (only if the head needs it)

**Interfaces:**
- Consumes: Task 4's `set`, Task 5's labels.

- [ ] **Step 1: The switch.** In `.sc-plate-head`, before the full screen button: `<div class="sc-seg sc-plate-switch" role="group" aria-label={L.plate}>` with three buttons `L.plateMap` (`set(null)`), `L.platePlate` (`set("full")`), `L.plateSplit` (`set("split")`), each `aria-pressed` kept in step by `set`. Full screen and Close stay as they are.
- [ ] **Step 2: Fit the head.** At 390 px upright the head holds the picker (shrinks, ellipsis), arrows, switch, full screen and close in one row at the controls' height; if it cannot, the switch wraps to a second row under the title (CSS only).
- [ ] **Step 3: Hand check:** each button gives its state, the pressed one matches after full screen, Close, Escape and the free roam Plate button; Map with focus on it moves focus to the Plate button or tab. Desktop, 390x844 upright and sideways, accessibility mode (48 px).
- [ ] **Step 4: Tests, typecheck, build; commit** `src/plate.ts style.css dist`: "Plate panel: Map, Plate and Split switch".

### Task 7: The `plate` scene field and its validation

**Files:**
- Modify: `src/scene.ts` (`PlateRef`, `Scene.plate`, `resolve`), `src/validate.ts`, `src/index.ts`
- Test: `src/scene.test.ts`, `src/validate.test.ts`

**Interfaces:**
- Consumes: `ChartEntry` (Task 1).
- Produces:
  - `export type PlateRef = { airport: string; chart: string; page?: number }`; `Scene.plate?: PlateRef | null` (`chart`: the FAA name as in `charts/<airport>.json`; `page` 1-based; `null` closes the panel; left out, the panel stays as it is).
  - `resolve` throws `SceneError` for `no airport <id>` and `plate page <p> is not a page number` (not a whole number from 1). `Resolved` is unchanged.
  - `validateWalkthrough(w, data, procedures, area, charts?: (airport: string) => Promise<ChartEntry[]>)` and `validateQuiz(q, data, procedures, area, charts?)`. Every scene with a `plate` (a step's, a check's, a written item's) is checked against `charts(airport)`; with no `charts` given the plate check is skipped silently.
  - `src/index.ts` exports `type ChartEntry` and `type PlateRef`.

- [ ] **Step 1: Write the failing tests**

```ts
// scene.test.ts
test("plate: an airport the area has, a whole page from 1, or null", () => {
  assert.doesNotThrow(() => resolve({ plate: { airport: "KPHX", chart: "ILS OR LOC RWY 07R" } }, data));
  assert.doesNotThrow(() => resolve({ plate: null }, data));
  assert.throws(() => resolve({ plate: { airport: "KZZZ", chart: "X" } }, data), /no airport KZZZ/);
  assert.throws(() => resolve({ plate: { airport: "KPHX", chart: "X", page: 0 } }, data), /plate page 0 is not a page number/);
  assert.throws(() => resolve({ plate: { airport: "KPHX", chart: "X", page: 1.5 } }, data), /plate page 1.5/);
});

// validate.test.ts
const index: ChartEntry[] = [
  { name: "ILS OR LOC RWY 07R", kind: "IAP", pages: ["00322il7r.png"], procedures: ["ILS RWY 07R", "LOC RWY 07R"] },
  { name: "BUCKEYE FOUR", kind: "DP", pages: ["00322buckeye.png", "00322buckeye_c.png"], procedures: ["BXK4"] },
];
const charts = async (airport: string) => { if (airport !== "KPHX") throw new Error("404"); return index; };
const at = (plate: PlateRef) => ({ ...good, steps: [{ caption: "a", scene: { plate } }] });
test("a good plate", async () => assert.deepEqual(await validateWalkthrough(at({ airport: "KPHX", chart: "BUCKEYE FOUR", page: 2 }), data, files, "phoenix", charts), []));
test("plate problems", async () => {
  assert.deepEqual(await validateWalkthrough(at({ airport: "KPHX", chart: "ILS RWY 07R" }), data, files, "phoenix", charts), ["t step 1: no chart ILS RWY 07R at KPHX; charts there: ILS OR LOC RWY 07R, BUCKEYE FOUR"]);
  assert.deepEqual(await validateWalkthrough(at({ airport: "KPHX", chart: "BUCKEYE FOUR", page: 3 }), data, files, "phoenix", charts), ["t step 1: chart BUCKEYE FOUR has 2 pages, not 3"]);
  assert.deepEqual(await validateWalkthrough(at({ airport: "KSDL", chart: "X" }), data, files, "phoenix", charts), ["t step 1: no charts for KSDL"]);
});
test("with no charts loader the plate is not checked", async () =>
  assert.deepEqual(await validateWalkthrough(at({ airport: "KPHX", chart: "NOPE" }), data, files, "phoenix"), []));
test("a quiz item's plate is checked too", async () => {
  const q: Quiz = { id: "q", title: "Q", area: "phoenix", items: [{ type: "read", prompt: "?", choices: ["a", "b"], answer: 0, scene: { plate: { airport: "KPHX", chart: "NOPE" } } }] };
  assert.match((await validateQuiz(q, data, files, "phoenix", charts))[0], /^q item 1: no chart NOPE at KPHX/);
});
```

- [ ] **Step 2: Run** both files. Expected: the new tests fail.
- [ ] **Step 3: Implement** the type and `resolve` checks, then an async `plateProblems(scene: Scene | undefined, charts?: ...)` in `validate.ts` returning the messages above, called for each step scene, check scene and written quiz item. Both loops (`w.steps.forEach` in `validateWalkthrough`, `q.items.forEach` in `validateQuiz`) become `for ... of` so it can be awaited. A resolve problem with the plate (bad airport or page) is already reported by `sceneProblems`; `plateProblems` skips such a plate.
- [ ] **Step 4: Run tests and typecheck.** Expected: pass.
- [ ] **Step 5: Build; commit** `src/scene.ts src/validate.ts src/index.ts` and tests, `dist`: "Scenes: plate field and its validation".

### Task 8: Scenes open a chart

**Files:**
- Modify: `src/plate.ts` (`open`), `src/scene.ts` (`stripPlayback`), `src/scene.test.ts`, `src/scenes.ts`, `src/player.ts`, `src/quizui.ts`, `src/freeroam.ts`, `style.css`

**Interfaces:**
- Consumes: `PlateRef` (Task 7), `plateView` (Tasks 4 and 5).
- Produces:
  - `Plates.open(p: PlateRef | null): Promise<void>`: `null` closes; otherwise loads the airport's index, shows that chart at `page` (a page past the end shows page 1 with a warning) and sets `"split"`. A name not in the index: `console.warn("skycake: no chart <chart> at <airport>; leaving the plate panel as it was")`, no change. No plates in the area: warns once, nothing opens. Ticketed with the panel's other loads; the newest wins.
  - `scenes(c, timeline?, plate?: (p: PlateRef | null) => void)`: after a scene resolves, calls `plate(ok.plate)` when the scene has the field (left out: not called).

- [ ] **Step 1: `open` in `plate.ts`.**
- [ ] **Step 2: `scenes.ts`:** the third parameter, called before `v.apply`. `usable` already drops a `plate` that fails `resolve`.
- [ ] **Step 3: Walkthroughs and quizzes.** `player.ts` and `quizui.ts` build `plateView(c, { show: () => {} })` (picking a chart does not change the authored scene), append `el` to the fig when present, pass `plates.open` to `scenes`, and in `leave()` call `plates.destroy()`. Explore stays as today: `stripPlayback` also drops `plate`, so free roam starts with the panel closed (add `assert.equal("plate" in stripPlayback({ plate: { airport: "KPHX", chart: "X" } }), false)` to its test in `src/scene.test.ts`). Panel labels are the free roam defaults here too, with no `Placeholder:` (Chris's decision, 2026-11-09).
- [ ] **Step 4: Free roam's first scene.** After building `plates`, `if (c.first.plate) void plates.open(c.first.plate)` (a site's `scene.plate` opens it).
- [ ] **Step 5: Layout.** With the panel open beside the map, `.sc-wtop`, `.sc-big-play`, `.sc-player` and `.sc-quiz` stay inside the map's room (`right: calc(var(--sc-share) * 100% + var(--sc-gap))` as `.sc-tr` does); on an upright phone the panel sits over the map under `.sc-wtop`, the player bar and quiz card below it. CSS only.
- [ ] **Step 6: Hand check.** Add to `demo/class-b.json` a step with `plate: { airport: "KPHX", chart: "ILS OR LOC RWY 07R" }`, a later one with `plate: null`, and one with a misspelt chart; in `demo/class-b-quiz.json` one item with a plate. `?walkthrough=class-b`: the panel opens in split on its step, stays through steps without `plate`, closes on `null`, the misspelt one warns and leaves it; Next three times fast under DevTools Slow 3G shows only the last step's chart; Explore opens free roam with the panel closed. `?quiz=class-b`: the item's chart opens. Desktop and 390x844 upright and sideways; the caption and "Not for navigation" stay visible.
- [ ] **Step 7: Tests, typecheck, build; commit** `src/plate.ts src/scene.ts src/scene.test.ts src/scenes.ts src/player.ts src/quizui.ts src/freeroam.ts style.css demo dist`: "Walkthrough and quiz scenes open a chart".

### Task 9: Offline and docs

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `NOTICE.md` (d-TPP line, if it names only diagrams)
- Check only: `scripts/app.mjs`, `app/main.ts`

- [ ] **Step 1: Offline check.** `node scripts/app.mjs`, serve `www/`: the manifest lists `charts/` files for both areas and each area's Save size includes them (Phoenix about 28 MB); Save Phoenix, go offline in DevTools, reload, open free roam, open three charts. No change to `app/main.ts` or `scripts/app.mjs` unless this fails.
- [ ] **Step 2: README.** Scene format: `plate` (fields, `null`, left out, split on open). Validating: the optional `charts` loader (`async (airport) => JSON.parse(readFileSync(\`data/phoenix/charts/${airport}.json\`, "utf8"))`) and the plate messages. Data: d-TPP procedure charts in `charts/`, how they match procedures, the `charts with no procedure` and `procedures with no chart` log lines in the Data cycle PR. Sizes: replace "about 12 MB each" with the measured totals. The `#23` sentence about the panel's hidden buttons: say what the panel now does.
- [ ] **Step 3: Student how-to.** If the docs update has landed a student how-to page in `app/`, add a short charts section with every sentence `Placeholder:` for Chris's copy; if not, say so in the PR body.
- [ ] **Step 4: CHANGELOG** Unreleased line. Commit `README.md CHANGELOG.md NOTICE.md` (and the how-to page): "Docs: procedure chart viewer".
