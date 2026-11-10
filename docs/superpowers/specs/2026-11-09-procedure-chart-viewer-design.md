# Procedure chart viewer: design

Status: spec for Chris to review. Builds on the empty plate panel in PR #23 (`ui-polish`): `src/plate.ts`, free roam's `.sc-plate` panel.

## What Chris asked for

A viewer for the procedure charts of the selected procedure(s), side by side with the 3D view (Chris, 2026-11-08).

## Decisions (Chris, 2026-11-08 and 09)

- Side by side with the 3D view, not an overlay and not a separate page.
- Charts are committed images, built with the data, not links to the FAA's PDFs and not PDFs rendered in the browser.
- Layout: the plate panel beside the map (#23). It never opens on its own; the Plate button or tab opens it.
- Panel controls: both the mockup's Map / Plate / Split switch and #23's Full screen and Close.
- In v1 also: a scene can open a chart, saved areas in SkyCake Viewer include the charts, and the current airport's chart list.

## What the student sees

1. In free roam at KPHX the student taps Plate beside the search box (on a phone, the Plate tab). The panel opens beside the map.
2. The panel's title is a picker: the charts of the procedures drawn in 3D first, then every other chart at the airport, in the FAA's order. Picking one shows it, and if skycake knows its procedure, draws that in 3D too, as a search pick does.
3. A chart with continuation pages (BUCKEYE FOUR, CONT.1) shows page arrows next to the title.
4. Top right of the panel: Map / Plate / Split (map only, chart only, both), then Full screen and Close. The switch drives the panel's three states that #23 already has (closed, full, split).
5. Drag to pan, pinch or scroll to zoom, double-tap or double-click to fit. A chart opens fitted to the panel.
6. With the panel open, showing a procedure in 3D switches the panel to that procedure's chart. With it closed, nothing opens.
7. A chart image that fails to load shows a short message in the panel instead of a blank.

Accessibility mode: zoom in, zoom out and fit are visible buttons, each chart image has the chart's name as its alt text, and every control works from the keyboard (no single-key shortcuts).

## Data

### Build (`scripts/build-area.ts`)

The build already reads the d-TPP metafile of the cycle for airport diagrams. It also:

1. Takes every record with `chart_code` IAP, DP or STR for the area's airports, continuation pages included (`, CONT.1`, `, CONT.2`).
2. Renders each page with pdf.js and `@napi-rs/canvas`, as diagrams are, at 200 dpi, greyscale, as an 8-shade palette PNG (about 90 KB; KPHX ILS OR LOC RWY 07R is 110 KB). A page several airports share (most STARs) is rendered and stored once, by its `pdf_name`.
3. Matches each chart to the area's procedures:
   - IAP: by approach type and runway. The chart name's types (`ILS OR LOC`, `RNAV (GPS) Y`, `LOC/DME`) and runway match the procedure names skycake builds (`ILS RWY 07R` and `LOC RWY 07R` both open `ILS OR LOC RWY 07R`).
   - DP and STR: by the computer code printed on the chart's first page, read from its text (`(BXK4.BXK)` is skycake's `BXK4`).
   - A chart with no match (a charted visual, a procedure the build left out) is still listed and opens on its own. A procedure with no chart is named in the log.
4. Writes `data/<area>/charts/<pdf_name>.png` (lower case, no `.PDF`) and `data/<area>/charts/<airport>.json`:

```ts
type ChartEntry = { name: string; kind: "IAP" | "DP" | "STR"; pages: string[]; procedures: string[] };
// charts/KPHX.json: ChartEntry[] in the metafile's order. pages: file names, first page first.
// procedures: skycake procedure names at this airport that the chart draws (may be empty).
```

The Data cycle PR body lists unmatched charts and procedures with no chart, as it lists diagrams left out today.

Size (cycle 2612): Phoenix 187 unique pages, about 16 MB; Miami 333, about 29 MB. Git stores only the pages the FAA amended in later cycles, since an unchanged chart renders to the same bytes. Every file stays far under Cloudflare's 25 MiB.

### SkyCake Viewer offline

`scripts/app.mjs` already lists every file under `data/<area>/` for the manifest, so saving an area saves its charts and the Download size includes them. No change to `app/main.ts` beyond checking it.

## Code

- **`src/plate.ts`:** fills #23's stub. `plateView(c, { title, body }, { show })` returns `{ has, procedures(refs, airport), destroy }` as #23 defined it. `has` is true when the area has a `charts/` index (`area.json` gains `charts: true` from the build, so no extra request). It loads `charts/<airport>.json` on first open and caches it, builds the picker, the page arrows (`title.after()`), the image with pan and zoom, and the accessibility buttons. A picked chart calls `show` for each of its `procedures`.
- **Pan and zoom:** CSS transform on the image, pointer events for drag and pinch, wheel for zoom. Reuse `src/gesture.ts` where it fits.
- **Map / Plate / Split switch:** three buttons in `.sc-plate-head`, before Full screen, setting free roam's existing `setPlate(null | "full" | "split")`. Added in free roam alongside #23's controls.
- **`src/scene.ts`:** `Scene` gains `plate?: { airport: string; chart: string; page?: number } | null`. `chart` is the FAA's chart name as in `charts/<airport>.json` (`ILS OR LOC RWY 07R`); `page` is 1-based. A scene with `plate` opens the panel to that chart in split; `null` closes it.
- **`src/validate.ts`:** checks `plate` against the airport's `charts/<airport>.json`; a wrong name lists the valid ones.
- **Labels (`src/ui.ts`):** `plateChart` (the picker's name), `platePage(n, of)`, `plateMap`, `platePlate`, `plateSplit`, `zoomIn`, `zoomOut`, `zoomFit`, `plateMissing`. Free roam labels, so real defaults; Chris may override any.

## Testing

- Matching: unit tests on real KPHX names, every IAP type, a SID and a STAR by computer code, a charted visual with no procedure, and a procedure with no chart.
- `plate.ts`: the picker's order (shown procedures first), page arrows only when there are several pages, `show` called for a picked chart's procedures, `has` false for an area without charts.
- Scenes and validation: a good `plate`, a wrong chart name, a page out of range.
- By hand: desktop and phone emulation at 390 px with touch, upright and sideways, accessibility mode on.

## Docs

README (Scene format, data list, sizes) and the student how-to page get the viewer once it is built. The docs update running now leaves it out.

## Not in scope

Georeferencing the chart onto the map, linking a tap on the chart to a fix in 3D, airport diagrams in the panel (they are on the map already), takeoff and alternate minimums, hot spot pages, charts for areas beyond Phoenix and Miami.
