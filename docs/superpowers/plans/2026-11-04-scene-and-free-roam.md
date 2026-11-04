# Scene model and free-roam layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace today's control row with the approved free-roam layout (floating panels on desktop, tab bar on phones), driven by a `Scene` that every later mode reuses, with everything raised by default and several procedures shown at once.

**Architecture:** Pure, Node-testable modules hold the logic: stable area ids (`airspace.ts`), the scene type and its resolution (`scene.ts`), search (`search.ts`) and free-roam state (`roam.ts`). `viewer.ts` gains `apply(scene)` and shows a list of procedures. `ui.ts` keeps `mount()` and hands free roam to a new `freeroam.ts` that builds the DOM; `style.css` lays it out for both widths. A demo page serves `dist/` and `data/` for checking in a browser.

**Tech Stack:** TypeScript 5.9, three.js 0.180.0 (peer), node:test via tsx, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-04-skycake-ux-design.md` (sections "Shared: the scene", "Layout (all modes)", "Free roam", "Embedding", "Accessibility").

This is plan 1 of 3. Walkthroughs (with `highlight`, `airplane` and `draw`) and quizzes get their own plans; this one implements only the scene fields free roam uses.

## Global Constraints

- No em dashes anywhere, in code, comments, copy or commits.
- Every on-screen word comes from `Labels` and can be overridden through `mount({ labels })`; new words are placeholders for Chris.
- Every control at least 44 px; neighbouring controls match in height and style.
- Desktop above 860 px wide; phone at or below: a 76 px bar along the bottom (the tab bar in free roam); menus open as sheets above it.
- "FAA TAC <edition> · Not for navigation" stays on screen.
- Camera change animates 0.7 s, raising and lowering 0.35 s; neither with `prefers-reduced-motion: reduce`.
- Keyboard: arrows turn the view and `+` / `-` zoom only while the view has focus; no page-wide keys.
- Free roam's first scene, unless the site gives one: every airspace type in the area raised, camera fit on the whole chart.
- Picking a procedure adds it; any number show at once; a fix shared by two shown procedures gets one tag.
- Commit as `git -c user.name="Chris DeFoe" -c user.email="chris@defoe.me"`, run `npm run build` and commit `dist/` with each task that changes `src/`.

## Review Focus

- Searching for something that matches nothing ("zzz", "  ") shows no results and changes nothing on screen. Pinned in Task 3.
- Picking a procedure that is already shown does not add a second chip or draw it twice. Pinned in Task 4.
- Showing procedures from two airports at once (KPHX's EAGUL6 with KSDL's RNAV (RNP) Z RWY 03) loads both airports' files and keeps both. Pinned in Task 4.
- Removing the last shown procedure goes back to the first scene's camera, not the last framing. Pinned in Task 4.
- Searching a lower-case or K-less airport ("kphx", "phx", "sdl") finds it. Pinned in Task 3.

---

### Task 1: Stable area ids

**Files:**
- Modify: `src/airspace.ts` (type `Area`, new `areaIds`)
- Modify: `scripts/build-area.ts` (assign ids before writing `area.json`)
- Modify: `data/phoenix/area.json` (regenerated)
- Test: `src/airspace.test.ts`

**Interfaces:**
- Produces: `Area` gains `id: string`. `areaIds(areas: Omit<Area, "id">[]): string[]` returns one id per area, same order.

- [ ] **Step 1: Write the failing tests** in `src/airspace.test.ts`

```ts
test("area ids: readable, unique, and the same for the same data", () => {
  const ring = (lon: number): Ring => [[33, lon], [33.1, lon], [33.1, lon + 0.1]];
  const a = [
    { kind: "D" as const, name: "CHANDLER MUNICIPAL AIRPORT CLASS D", floor: 1135, ceiling: 3000, rings: [ring(-111.8)] },
    { kind: "B" as const, name: "PHOENIX CLASS B", floor: 5000, ceiling: 9000, rings: [ring(-112.2)] },
    { kind: "B" as const, name: "PHOENIX CLASS B", floor: 5000, ceiling: 9000, rings: [ring(-111.9)] },
    { kind: "B" as const, name: "PHOENIX CLASS B", floor: 1135, ceiling: 9000, rings: [ring(-112)] },
  ];
  assert.deepEqual(areaIds(a), ["d-chandler-municipal-airport-class-d", "b-phoenix-class-b-50-90-1", "b-phoenix-class-b-50-90-2", "b-phoenix-class-b-sfc-90"]);
  assert.deepEqual(areaIds([...a].reverse()), [...areaIds(a)].reverse());
});

test("built Phoenix data: every area has a unique id", () => {
  const f: AirspaceFile = JSON.parse(readFileSync(new URL("../data/phoenix/area.json", import.meta.url), "utf8"));
  const ids = f.areas.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("d-chandler-municipal-airport-class-d"));
});
```

- [ ] **Step 2: Run** `npm test` and expect both new tests to FAIL (`areaIds` is not exported; built areas have no `id`).

- [ ] **Step 3: Implement `areaIds` in `src/airspace.ts`**

Slug = `kind` lower case + `-` + name lower case with every run of non-alphanumerics as one `-`. Where the slug repeats, append `-<floor>-<ceiling>` in hundreds as the chart writes them (`hundreds()`, so the surface reads `sfc`). Where that still repeats, append `-1`, `-2`... ordered by each area's first ring's mean longitude, west to east, then mean latitude, north to south. Ids never depend on input order.

- [ ] **Step 4: Assign ids in `scripts/build-area.ts`** right after `airspace()` returns, and rebuild the data:

Run: `npm run data -- --no-chart` (needs aeronav.faa.gov, services6.arcgis.com and prd-tnm.s3.amazonaws.com; downloads are cached in `.cache/`).
Expected: the usual summary lines, `area.json` now carries `"id"` on every area, nothing else in `data/` changes (`git status data/` lists only `area.json`).

- [ ] **Step 5: Run** `npm test` and `npm run typecheck`. Expected: all pass.

- [ ] **Step 6: Build and commit**

```bash
npm run build
git add src/airspace.ts src/airspace.test.ts scripts/build-area.ts data/phoenix/area.json dist
git commit -m "Stable ids for every area, so scenes and content can name one"
```

### Task 2: The scene

**Files:**
- Create: `src/scene.ts`
- Test: `src/scene.test.ts`

**Interfaces:**
- Consumes: `Area.id`, `KINDS`, `Kind`, `AirspaceFile` (Task 1, `airspace.ts`).
- Produces (all exported from `src/scene.ts`):

```ts
export type ProcedureRef = { airport: string; name: string };
export type AreaRef = { area: string };
export type Target = AreaRef | { fix: string } | { procedure: ProcedureRef } | { point: [lat: number, lon: number] };
export type Camera = "fit" | "top" | { frame: Target[]; tilt?: number } | { azimuth: number; tilt: number; distance: number; target: [lat: number, lon: number] };
export type Scene = {
  camera?: Camera;
  raise?: (Kind | AreaRef)[];
  procedures?: (ProcedureRef & { draw?: boolean })[];
  diagram?: string | null;
  height?: 1 | 4;
  tags?: boolean;
};
/** What the viewer applies: every field filled in, area refs checked. */
export type Resolved = { camera: Camera; raised: Set<string>; procedures: ProcedureRef[]; diagram: string | null; height: 1 | 4; tags: boolean };
export class SceneError extends Error {}
export function resolve(scene: Scene, data: AirspaceFile): Resolved;
export function freeRoamScene(data: AirspaceFile): Scene;
export function shorthand(o: { types?: Kind[]; airport?: string; approach?: string }, data: AirspaceFile): Scene | undefined;
```

`raised` holds area ids. `highlight`, `airplane` and `draw` playback belong to the walkthrough plan; `draw` is accepted and ignored here.

- [ ] **Step 1: Write the failing tests** in `src/scene.test.ts`, against `data/phoenix/area.json`:

```ts
test("free roam starts with every type in the area raised, framed on the whole chart", () => {
  const r = resolve(freeRoamScene(data), data);
  assert.equal(r.camera, "fit");
  assert.equal(r.raised.size, data.areas.length);
  assert.deepEqual([r.diagram, r.height, r.tags, r.procedures], [null, 4, true, []]);
});

test("raise takes kinds and single areas; an unknown area id throws", () => {
  const r = resolve({ raise: ["D", { area: "b-phoenix-class-b-sfc-90" }] }, data);
  assert.ok(r.raised.has("d-chandler-municipal-airport-class-d") && r.raised.has("b-phoenix-class-b-sfc-90"));
  assert.ok(![...r.raised].some((id) => id.startsWith("c-")));
  assert.throws(() => resolve({ raise: [{ area: "nope" }] }, data), SceneError);
  assert.throws(() => resolve({ diagram: "KDVT" }, data), SceneError); // no diagram for KDVT
  assert.throws(() => resolve({ procedures: [{ airport: "KPHX", name: "NOPE 1" }] }, data), SceneError);
});

test("the old options still work as a first scene", () => {
  assert.equal(shorthand({}, data), undefined);
  const s = shorthand({ types: ["B"], airport: "KSDL", approach: "RNAV (RNP) Z RWY 03" }, data)!;
  assert.deepEqual(s.raise, ["B"]);
  assert.deepEqual(s.procedures, [{ airport: "KSDL", name: "RNAV (RNP) Z RWY 03" }]);
});
```

`resolve` checks procedure names against `data.airports[].procedures`, so no procedure file is read.

- [ ] **Step 2: Run** `npm test` and expect FAIL (no `scene.ts`).

- [ ] **Step 3: Implement `src/scene.ts`** to the interface above. Defaults: camera `"fit"`, nothing raised, no procedures, diagram `null`, height `4`, tags `true`. `shorthand` returns `undefined` when none of the three options is given; `airport` with no `approach` sets nothing but is kept for the search box (Task 5 reads `o.airport` directly).

- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: pass.

- [ ] **Step 5: Commit**

```bash
npm run build
git add src/scene.ts src/scene.test.ts dist
git commit -m "Scene: one description of what the view shows, resolved against the area data"
```

### Task 3: Search

**Files:**
- Create: `src/search.ts`
- Test: `src/search.test.ts`

**Interfaces:**
- Consumes: `Airport`, `ProcType` (`procedure.ts`), `ProcedureRef` (Task 2).
- Produces:

```ts
export type Hit = { airport: string; procedure?: { type: ProcType; name: string } };
export type Group = { airport: string; type: ProcType | null; hits: Hit[] };  // type null: the airport itself
export function search(query: string, airports: Airport[], limit?: number): Group[];  // limit default 30 hits
```

- [ ] **Step 1: Write the failing tests** in `src/search.test.ts`, against the built `area.json`:

```ts
test("airports match with or without the K, in any case", () => {
  for (const q of ["KPHX", "kphx", "phx"]) assert.equal(search(q, airports)[0].airport, "KPHX");
  assert.equal(search("sdl", airports)[0].airport, "KSDL");
});

test("procedures match on any part of the name, grouped by airport and type in the spec's order", () => {
  const g = search("25L", airports);
  assert.ok(g.every((x) => x.hits.every((h) => h.procedure!.name.includes("25L"))));
  assert.deepEqual(g.filter((x) => x.airport === "KPHX").map((x) => x.type), ["IAP"]);
  const b = search("bnyrd", airports);
  assert.ok(b.length >= 5 && b.every((x) => x.type === "SID" && x.hits[0].procedure!.name === "BNYRD6"));
  const s = search("KSDL", airports);
  assert.deepEqual(s.map((x) => x.type), [null, "IAP", "STAR", "SID"]);
});

test("nothing matches nothing", () => {
  assert.deepEqual(search("zzz", airports), []);
  assert.deepEqual(search("   ", airports), []);
});
```

- [ ] **Step 2: Run** `npm test` and expect FAIL.

- [ ] **Step 3: Implement `search`.** Query trimmed and upper-cased; empty returns `[]`. An airport matches when its id equals the query, or the query plus a leading `K`; its group comes first, followed by all its procedures grouped Approaches (`IAP`), Arrivals (`STAR`), Departures (`SID`). Otherwise a procedure matches when its upper-cased name contains the query with spaces removed from both. Groups keep airports in `area.json` order; stop adding hits at `limit`.

- [ ] **Step 4: Run** `npm test`. Expected: pass.

- [ ] **Step 5: Commit**

```bash
npm run build
git add src/search.ts src/search.test.ts dist
git commit -m "Search across airports and procedures for the free-roam box"
```

### Task 4: Free-roam state

**Files:**
- Create: `src/roam.ts`
- Test: `src/roam.test.ts`

**Interfaces:**
- Consumes: `Scene`, `ProcedureRef` (Task 2).
- Produces:

```ts
export type Roam = { first: Scene; procedures: ProcedureRef[]; airport: string | null; diagram: boolean };
export function start(first: Scene, airport?: string): Roam;
export function add(r: Roam, p: ProcedureRef): Roam;          // also makes p.airport the current airport
export function remove(r: Roam, p: ProcedureRef): Roam;
export function pickAirport(r: Roam, airport: string, hasDiagram: (airport: string) => boolean): Roam;  // turns the diagram off where there is none
export function toggleDiagram(r: Roam, hasDiagram: (airport: string) => boolean): Roam;
export function sceneOf(r: Roam): Scene;                       // what the viewer should show now
export function fixTags(procedures: Procedure[]): Fix[];      // one tag per fix name across all shown procedures
```

- [ ] **Step 1: Write the failing tests** in `src/roam.test.ts`

```ts
const first: Scene = { raise: ["B", "C", "D"], camera: "fit" };
const eagul = { airport: "KPHX", name: "EAGUL6" }, ils = { airport: "KPHX", name: "ILS RWY 25L" }, rnp = { airport: "KSDL", name: "RNAV (RNP) Z RWY 03" };

test("procedures add up, from any airport, without repeats", () => {
  let r = add(add(add(start(first), eagul), ils), eagul);
  assert.deepEqual(r.procedures, [eagul, ils]);
  r = add(r, rnp);
  assert.deepEqual(r.procedures.map((p) => p.airport), ["KPHX", "KPHX", "KSDL"]);
  assert.equal(r.airport, "KSDL");
  assert.deepEqual(sceneOf(r).procedures, [eagul, ils, rnp]);
  assert.deepEqual(sceneOf(r).camera, { frame: [{ procedure: eagul }, { procedure: ils }, { procedure: rnp }] });
});

test("removing the last one goes back to the first scene", () => {
  const r = remove(add(start(first), ils), ils);
  assert.deepEqual(sceneOf(r), first);
});

test("the diagram follows the current airport and turns off where there is none", () => {
  const has = (a: string) => a === "KPHX";
  let r = toggleDiagram(pickAirport(start(first), "KPHX", has), has);
  assert.equal(sceneOf(r).diagram, "KPHX");
  r = pickAirport(r, "KDVT", has);
  assert.equal(sceneOf(r).diagram, null);
  assert.equal(r.diagram, false);
});

test("a fix on two shown procedures gets one tag, the final's role and altitude winning", () => {
  // EAGUL6's runway 25L transition ends at GIPSE, which is on the ILS RWY 25L final
  const tags = fixTags([eagul6, ils25l]);
  assert.equal(tags.filter((f) => f.name === "GIPSE").length, 1);
  assert.equal(tags.find((f) => f.name === "GIPSE")!.seg, "final");
});
```

(`eagul6` and `ils25l` are read from `data/phoenix/procedures/KPHX.json`.)

- [ ] **Step 2: Run** `npm test` and expect FAIL.

- [ ] **Step 3: Implement `src/roam.ts`.** All functions return new objects. `sceneOf`: start from `first`; add `diagram: r.airport` only while the diagram is on; with procedures, also `procedures` and `camera: { frame: [...] }` over them. So with no procedures and the diagram off it returns `first` unchanged. `fixTags` keeps one per name with the rank `final < common < transition < missed < vectors`, as `procedure.ts` already ranks within one procedure.

- [ ] **Step 4: Run** `npm test`. Expected: pass.

- [ ] **Step 5: Commit**

```bash
npm run build
git add src/roam.ts src/roam.test.ts dist
git commit -m "Free-roam state: several procedures at once, diagram follows the current airport"
```

### Task 5: Viewer applies a scene

**Files:**
- Modify: `src/viewer.ts`
- Create: `demo/index.html`, `scripts/demo.mjs`
- Modify: `package.json` (script `"demo": "node scripts/demo.mjs"`)

**Interfaces:**
- Consumes: `Resolved`, `Camera` (Task 2), `fixTags` (Task 4), `Procedure`.
- Produces: `build(host, data, label, raised)` (no `first` parameter; starts with nothing raised until `apply`) returning `View`:

```ts
export type View = {
  apply(scene: Resolved, procedures: Procedure[], now?: boolean): Promise<void>;  // procedures: the files' objects for scene.procedures, same order
  raise(kind: Kind, on: boolean): void;         // a type chip
  raiseArea(id: string, on: boolean): void;     // tapping a boundary still works as today
  exaggerate(n: 1 | 4): void;
  tags(on: boolean): void;
  orbit(azimuth: number, polar: number): void;
  zoom(factor: number): void;
};
```

`procedure()` and `diagram()` are removed; `apply` covers both.

- [ ] **Step 1: Add the demo server and page.** `scripts/demo.mjs`: a dependency-free `node:http` static server on port 5179 serving the repo root, with `.js` as `text/javascript`, `.json`, `.webp`, `.bin`, `.css`, `.html` types, and an import map in `demo/index.html` mapping `three` and `three/examples/jsm/` to `node_modules/three/build/three.module.js` and `node_modules/three/examples/jsm/`. The page loads `../style.css` and calls `mount(document.querySelector("#v"), { base: "/data/phoenix/" })` from `../dist/index.js`; `?scene=` with a JSON scene in the query string is passed as `scene` for checking.

- [ ] **Step 2: Implement `apply` in `src/viewer.ts`.**
  - Raising: every area's goal is 1 when its id is in `scene.raised`, else 0; the existing per-kind callback still reports chip state.
  - Camera: `"fit"` frames every area's outline (the whole chart when nothing is raised); `"top"` frames the same spots looking straight down with north up (polar angle 0.001); `{ frame, tilt }` frames the targets' points (area rings, a fix's lat/lon from the shown procedures, a procedure's paths, a point) at `tilt` degrees above the horizon, default 32; the explicit form places the camera directly. Today's `frame(spots, now)` becomes `frame(spots, tilt, now)`. `now` or reduced motion skips the flight.
  - Procedures: draw every given procedure's paths as today's `procedure()` did, then one tag per `fixTags(procedures)` entry.
  - Diagram: as today's `diagram()`, for `scene.diagram`'s airport, without reframing (the scene's camera decides).
  - Height and tags: as `exaggerate` and `tags` do.

- [ ] **Step 3: Check in a browser.** Run `npm run build && npm run demo`, open `http://localhost:5179/demo/` and check, at 1280 × 800 and in iPhone 13 emulation:
  - `?scene={"raise":["D"],"camera":"top"}`: only the Class D areas raised, looking straight down, north up.
  - `?scene={"procedures":[{"airport":"KPHX","name":"EAGUL6"},{"airport":"KPHX","name":"ILS RWY 25L"}],"camera":{"frame":[{"procedure":{"airport":"KPHX","name":"EAGUL6"}},{"procedure":{"airport":"KPHX","name":"ILS RWY 25L"}}]}}`: both drawn, GIPSE tagged once, both framed.
  The old control row may still be on screen until Task 6.

- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: pass.

- [ ] **Step 5: Commit**

```bash
npm run build
git add src/viewer.ts demo scripts/demo.mjs package.json dist
git commit -m "Viewer applies a scene: raising by type or area, fit, top-down or framed camera, several procedures"
```

### Task 6: Free-roam layout

**Files:**
- Create: `src/freeroam.ts`
- Modify: `src/ui.ts` (`mount`, `Labels`, `Options`)
- Modify: `style.css` (rewritten for the new layout)

**Interfaces:**
- Consumes: everything above. `search` (Task 3), `start`, `add`, `remove`, `pickAirport`, `toggleDiagram`, `sceneOf` (Task 4), `resolve`, `freeRoamScene`, `shorthand` (Task 2), `View.apply` (Task 5).
- Produces: `mount(element, { base, scene?, types?, airport?, approach?, labels? })`; `Options.scene` added. `freeRoam(fig: HTMLElement, view: View, data: AirspaceFile, o: Options, L: Labels): void` in `src/freeroam.ts`.
- New `Labels` keys (placeholders): `search: "Airport or procedure"`, `remove: (name: string) => \`Remove ${name}\``, `airspace: "Airspace"`, `viewTab: "View"`, `procedureTab: "Procedure"`, `noMatches: "No matches"`. Removed: `noProcedure`, `procedure`, `airport`.

- [ ] **Step 1: Build the DOM in `src/freeroam.ts`** (one tree for both widths; CSS decides what shows):
  - Top left (desktop): an Airspace pill button that opens the type list panel below it; each row is a `<label>` with the chart swatch, the type name and a checkbox, selected rows tinted like today's chips.
  - Top right: the search input (`type="search"`, `aria-label` = `L.search`) with a results list under it (`role="listbox"`, groups headed by airport and `L.groups`); picking a hit calls `add` or `pickAirport`. Under the box: one chip per shown procedure with a remove button (`aria-label` = `L.remove(name)`), and an approach's info card (final course, glidepath, FAF to MAP) under its chip.
  - Bottom right (desktop): round buttons for Diagram (hidden when the current airport has none), Tags, Height (`1×` / `4×`) and Full screen.
  - Bottom left: the caption line.
  - Phone (`max-width: 860px`): a 76 px `<nav>` bar along the bottom with four tabs, Airspace, Procedure, Diagram, View. Airspace and View open a sheet above the bar with the type list or the view buttons; Procedure focuses the search box (pinned at the top of the view) and shows the chips in the sheet; Diagram toggles. The desktop corner panels hide.
  - Every state change goes through `roam.ts`, then `view.apply(resolve(sceneOf(r), data), loadedProcedures)`; procedure files load per airport as `ui.ts` does today, the newest change winning.

- [ ] **Step 2: Wire `mount` in `src/ui.ts`:** first scene = `o.scene ?? shorthand(o, data) ?? freeRoamScene(data)`, applied with `now = true`; the search box starts with `o.airport` when given. Keep the lazy load (fetch `area.json` at once, viewer only when in sight), full screen, keyboard and tooltip behavior unchanged.

- [ ] **Step 3: Rewrite `style.css`** for the layout above, keeping the `--sc-*` variables and their fallbacks, 44 px minimum targets, chart swatches and tag styles as they are. Panels: `--sc-panel` at 94% opacity, 1px `--sc-frame`, 20px radius; buttons and chips pills.

- [ ] **Step 4: Check in a browser** with `npm run build && npm run demo`, at 1280 × 800 and iPhone 13 emulation, against the "Chosen", A and C rows of the mockup canvas:
  - First load: every type raised, whole chart framed.
  - Search "25L" then pick ILS RWY 25L, then search "EAGUL" and pick EAGUL6: two chips, both drawn, info card under the approach's chip, camera frames both; removing both returns to the first view.
  - Search "zzz": "No matches", nothing else changes.
  - KDVT picked: no Diagram button; KPHX: Diagram shows the overlay.
  - Phone: tab bar at the bottom, sheets open above it, nothing overlaps the caption line.

- [ ] **Step 5: Run** `npm test` and `npm run typecheck`. Expected: pass.

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/freeroam.ts src/ui.ts style.css dist
git commit -m "Free-roam layout: floating panels on desktop, tab bar on phones, search with several procedures"
```

### Task 7: Release and instrumentready.com

**Files:**
- Modify: `package.json` (version `0.2.0`), `README.md` (options: `scene`; first view now raises everything; demo)
- Modify (instrumentready.com repo): `package-lock.json`

**Interfaces:**
- Consumes: `mount` with the options from Task 6. instrumentready.com's `<Airspace3D />` passes `types`, `airport`, `approach` unchanged, so no code changes there.

- [ ] **Step 1: Update `README.md`** usage block with `scene` and a line on `npm run demo`; bump the version; build; commit; push `main`.

```bash
git add package.json README.md dist
git commit -m "skycake 0.2.0: scenes and the new free-roam layout"
git push origin main
```

- [ ] **Step 2: In instrumentready.com,** run `npm install github:Tehcnological/skycake`, then `npm test` and `npm run build`. Expected: both pass; `package-lock.json` points at the new skycake commit.

- [ ] **Step 3: Check `/test/` in the dev server** (temporary ungated page as before, deleted afterwards) at desktop and iPhone 13 emulation: same checks as Task 6 Step 4.

- [ ] **Step 4: Commit and push** instrumentready.com on its working branch, then fast-forward `main` if `main` has not moved (merge it in and re-run tests and build if it has).

```bash
git add package-lock.json
git commit -m "Use skycake 0.2.0: new free-roam layout, everything raised at first"
```
