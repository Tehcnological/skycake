# 3D airspace: design

Status: approved by Chris 2026-11-03 (TAC only). Upgrades approved 2026-11-04 after studying AviatorPro's ProTools (ideas only, nothing copied): terrain, glass fills, shelf tags, soft chart edge, raise on tap, approaches in 3D. Chris asked 2026-11-04 for departures and arrivals, procedures for every airport in the view, and the airport diagram overlaid where practical. Built: `npm run data`, `src/ui.ts` and `src/viewer.ts`. Moved from the instrumentready.com repo into skycake 2026-11-04.

## Goal

An interactive 3D view of the airspace over a real FAA chart: the chart lies flat as the ground, airspace rises off it in the same colors and line styles the chart uses, and every airspace type can be switched on or off. First area: Phoenix. Not for navigation.

## What the viewer sees

- **Ground:** the FAA Phoenix TAC, cropped to the view area, draped over real terrain and lit from the northwest. Its edge fades out instead of ending in a hard rectangle.
- **Airspace:** flat until raised. The chart already prints every boundary. Class B starts raised; tapping any printed boundary raises that area, it rises out of the ground, and tapping it again lowers it. Raised areas are glass: only the nearest surface is tinted, so stacked shelves don't turn to mud.
- **Toggles:** one chip per airspace type, each with its chart swatch. A chip raises or lowers every area of that type. It reads on while any area of that type is raised.
- **Tags:** each raised shelf carries its ceiling and floor as the chart writes them (90/50). A tag that would overlap another hides. A Tags chip turns them all off.
- **Hover or tap:** shows the name and floor/ceiling.
- **Height:** stretched 4× by default so shelves read; a 1×/4× switch shows true scale.
- **Full screen:** a button fills the screen, using the browser's full screen where it exists and filling the window on iPhone. The view re-frames when its shape changes.
- **Controls:** drag to orbit, scroll or pinch to zoom. The camera starts framed on what is raised, at any screen width.
- **Footer line:** chart edition date and "Not for navigation" (placeholder copy; Chris writes the final).

## Procedures

Approaches, departures (SIDs) and arrivals (STARs) for every airport on the chart that has them in the CIFP (13 today: 50 approaches, 81 departures, 42 arrivals). An airport picker (KPHX first) and a procedure picker grouped Approaches, Arrivals, Departures. Picking one lowers the airspace and frames the procedure; clearing it brings the first view back. Each airport's procedures load from their own file when it is picked.

- **Path:** transitions white, final or common route green, missed approach yellow and black dashes, vectors white and black dashes. Every path has a black outline and holds a constant width on screen at any zoom.
- **Height:** a translucent curtain drops from the path to the terrain so altitude reads from any angle.
- **Fixes:** a tag with name, altitude constraint and role (IAF, IF, FAF, MAP on approaches). A window reads "13000 to 14000", flight levels as FL240.
- **Info strip:** collapsed under the view, approaches only: final course, glidepath, FAF to MAP. Rows with no data don't show.
- **Altitudes:** constraints from the CIFP. Between two constraints the path runs straight by distance flown, so a climb or descent spreads over the legs between them. Before the first it holds the first; after the last it holds the last. A procedure with no altitudes at all is drawn 3,000 ft above the field. This is not a flown profile.
- **Legs:** built from the real legs. Course and heading to altitude assume 300 ft per NM. Heading legs run to the intercept or to the DME distance from the named navaid. Radius-to-fix legs are arcs around their center fix. Holds use the published course, turn direction and leg length; a timed leg counts 2.5 NM per minute. Procedure turns go 2 NM outbound, 2 NM on the 45 degree leg, turn back to the record's side and rejoin the inbound course. Vectors (VM, FM) are drawn 2.5 NM, then the next leg goes direct. Other turns are drawn as corners.
- **Departures:** each runway transition starts at its runway's departure end (the opposite threshold); RW07B means both 7L and 7R.
- **Vectors:** many departures from the satellite fields begin with radar vectors to their first fix, which the CIFP doesn't code, and most arrivals end at a fix or in vectors miles out. A white and black dashed line joins the field to where the coded route starts (climbing from the field) and each place an arrival ends to the field (down to the field). A departure whose coded route lies wholly off the chart shows only its vectors, toward the edge.
- **Chart edge:** every path is cut exactly where it crosses the chart's edge.

## Airport diagrams

A Diagram chip lays the FAA airport diagram over the airport and frames it. It shows only for airports whose diagram can be placed (5 of 9 today: KPHX, KSDL, KCHD, KFFZ, KGEU).

- **Source:** the d-TPP of the same cycle (chart code APD), rendered with pdf.js at build time. The PDFs carry no georeference. Every diagram is drawn to true north and prints latitude and longitude ticks with labels such as 33°26.5'N, so a straight fit of label position against value places the page (`src/diagram.ts`). A fit is refused if any label misses by more than 100 ft or the two scales differ by more than 3%. On the five that fit, the worst label is within 8 ft, and the CIFP runway thresholds land on the drawn runway ends.
- **Left out:** KDVT, KGYR, KIWA and KLUF draw their tick labels as shapes, not text, so there is nothing to read. Placing those would need another way in (runway ends, or a hand-entered fit); not built.
- **Look:** cropped to the diagram's frame, turned north up, the paper a 60% white veil so it reads over the chart, draped 40 ft above the terrain.

## Airspace types and colors

Colors and line styles follow the FAA chart legend (Aeronautical Chart User's Guide).

| Type | Chart style | 3D style | At first |
|---|---|---|---|
| Class B | solid blue | blue glass, solid outline | raised |
| Class C | solid magenta | magenta glass, solid outline | flat |
| Class D | dashed blue | blue glass, dashed outline | flat |
| Class E surface | dashed magenta | magenta glass, dashed outline, drawn up to 700 AGL where the 700 ft floor takes over | flat |
| Class E 700 ft AGL floor | magenta vignette | faint magenta floor sheet 700 ft above the terrain, no walls. Chip only, tapping the chart doesn't raise it | flat |
| Mode C veil | thin magenta circle | magenta rings at SFC and 10,000 MSL. Chip only | flat |
| Restricted, Prohibited, Warning | blue hatched edge | blue walls with hatch texture | flat |
| MOA, Alert | magenta hatched edge | magenta walls with hatch texture | flat |

Walls stop at 18,000 MSL. A lesson on one type starts with only that type raised: `<Airspace3D types={["D"]} />`. A lesson on an approach starts on it: `<Airspace3D approach="ILS RWY 25L" />`, or at another airport `<Airspace3D airport="KSDL" approach="RNAV (RNP) Z RWY 03" />`.

Class E with a 1,200 ft AGL floor is the default everywhere and is not drawn, the same as on the chart.

## Data

- **Airspace:** the FAA's ADDS open data service (`Class_Airspace` and `Special_Use_Airspace` layers): the same NASR data, already in lat/lon, queried for the view's bounds and clipped to them.
- **Chart:** the Phoenix TAC GeoTIFF from aeronav.faa.gov (free, public domain). `scripts/build-area.ts` crops it to the bounds, reprojects it from Lambert conformal conic to plain lat/lon with geotiff.js and proj4 (no GDAL), and writes `data/phoenix/tac.webp` (4096 px, about 2.6 MB).
- **Terrain:** USGS 3DEP 1 arc-second tiles (public domain, credited on /credits) from the USGS bucket on S3, read in place by `scripts/build-area.ts` and sampled at the view's grid points, whose corners are the chart's corners. Written as `data/phoenix/dem.bin` (352x320, 16-bit feet, about 225 KB). `npm run data -- --terrain-only` rebuilds just this. (The 3DEP exportImage service was dropped: it keeps pixels square and grows the box, which squeezed the terrain north-south against the chart.)
- **Procedures:** the FAA CIFP, read by `scripts/build-area.ts` (`src/procedure.ts`) for every leg, and written one file per airport to `data/phoenix/procedures/<id>.json`. `data/phoenix/area.json` lists the airports and their procedure names.
- **Airport diagrams:** the FAA d-TPP, placed by `src/diagram.ts`, written to `data/phoenix/diagrams/<id>.webp` (150 to 310 KB each).
- **Updates:** charts change every 56 days, procedures and diagrams every 28. Rerun `npm run data`; the chart edition date shows under the view.

## Altitudes

All values are MSL. "SFC" walls run down into the terrain, which hides them. Heights written AGL use a single ground elevation for the area (Phoenix Sky Harbor, about 1,100 ft). The 700 AGL sheet is the exception: it follows the terrain, 700 ft above the highest ground within about 0.4 NM, so no ridge pokes through it.

## Where it lives

- `mount(element, { base })` from skycake; on instrumentready.com the `<Airspace3D />` component wraps it and is usable in any topic's MDX.
- First real use: an airspace topic once Chris writes one. Until then it stays on /test/.
- three.js and the chart texture load only when the view scrolls into sight.

## Constraints

- Static assets only (chart textures ship with the site). Cloudflare free tier; no R2 needed at this size.
- One Workers asset must stay under 25 MiB; target well under 5 MB per chart.
- TypeScript. No new paid services.

## Tests

- Build script: each NASR type maps to the right chart style; Phoenix Class B surface area is present; every record has a known type.
- Procedures: real CIFP lines for ILS 25L give the published fixes, the heading leg's intercept, and the hold's side and length; FYRBD1 starts at both 7s' departure ends; SJN9 runs to 4 DME from PXR; SUNSS8 comes in across the chart edge and ends in vectors; the KIWA RNP arc keeps its radius and the ILS 30C procedure turn has its shape; paths are cut exactly at the chart edge; built data has a file for every airport, all inside the chart, with all 16 KPHX approaches.
- Diagrams: the KPHX tick labels place runway 7L's threshold on its drawn end and turn the page north up; bad labels are refused; the frame is found; every built diagram holds its airport.
- Terrain: the built grid has the expected size and a sane elevation range, and known summits (Camelback, Four Peaks) and Sky Harbor sit at their own grid points.
- Chart script: the output is cropped to the bounds and under the size limit.
- Page test: the component renders a host element with its data and no inline handlers.
