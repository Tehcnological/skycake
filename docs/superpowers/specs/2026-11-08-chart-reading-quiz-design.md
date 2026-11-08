# Chart reading quizzes: design

Status: spec for Chris to review. No code. Builds on walkthroughs and quizzes (PR #16): `src/generate.ts`, `src/quiz.ts`, `src/question.ts`, `src/quizui.ts`.

## What Chris asked for

> should have special use airspace in there too, since there will be more areas than phx and miami, perhaps the whole country. maybe both, since its sectional questions it should be also reading the blurb underneath, and chart symbology as well. get creative with this one, maybe a question where its tap an abandoned airport on this map, and it randomizes a tiny section of a sectional with a bunch of symbols on it, and they have to tap the right one in like 30 seconds or something that would be cool.

## Understanding

Students practise reading a VFR sectional the way they will on a checkride: find things, read what the chart prints next to them, and look things up in the chart's margin. Four new question families, all generated from FAA data like the ones in #16:

1. **Airport data blocks.** "The blurb underneath" (Chris, 2026-11-08): the name, identifier, tower or CTAF frequency, elevation, runway length and the rest printed under each airport symbol.
2. **Special use airspace.** Reading a MOA or restricted area's altitudes and times. On the sectional these are mostly not printed on the map (a MOA shows only its name, a restricted area only its number): they are in the special use airspace table in the chart's margin, so those questions show that table too.
3. **Chart symbology.** What a symbol is, and what the chart prints beside other symbols (an obstacle's heights, a navaid's box).
4. **Symbol hunt.** A small random patch of the sectional, crowded with symbols; tap the one named ("the private airport") within about 30 seconds.

Success: every answer comes from public domain FAA or USGS data and matches what the chart prints; a question that cannot be checked is never asked; Phoenix and Miami work first. More areas, up to the whole country, come later, each served on its own when opened.

Assumptions (not said by Chris, please correct): sectional only for v1 (not the TAC); the hunt is a practice game inside a quiz, not a separate mode. Times in questions and answers are UTC (Chris).

## What the data holds (checked 2026-11-08)

- **The sectional GeoTIFF carries its whole collar.** `Phoenix SEC.tif` (17,908 x 12,299 px) includes the legend panel and, across the top, the "Special use airspace on Phoenix sectional chart" table: both the P, R, W, A section and the MOA section, about 13,000 x 620 native px, 645 KB as webp. Legible at native scale.
- **The area texture is sharp enough for symbols.** `data/phoenix/sectional.webp` (3,827 x 4,096 over the area, about 1,670 px per degree, roughly 0.75 of native) shows private airports, data blocks, obstacles and abandoned airports clearly. The hunt and symbol questions can use the existing 3D view and texture; no new imagery is needed for Phoenix and Miami.
- **Special use airspace times are in ADDS.** The `Special_Use_Airspace` layer `build-area.ts` already queries has `TIMESOFUSE` ("0600 - 1900, MON - FRI; OTHER TIMES BY NOTAM"), `CONT_AGENT` ("FAA, ALBUQUERQUE ARTCC"), `UPPER_DESC` ("TNI", to but not including) and the altitudes. The build drops these today. Frequencies are not in the layer.
- **NASR 28-day CSVs** (public, `nfdc.faa.gov/webContent/28DaySub/extra/<date>_<SUBJECT>_CSV.zip`) hold:
  - `APT_BASE`: site type (A airport, H heliport, C seaplane, U ultralight, G glider, B balloon), public or private (`FACILITY_USE_CODE`), tower (`TWR_TYPE_CODE`: ATCT or NON-ATCT), elevation, beacon schedule, ownership (military), status (O, CI closed indefinitely, CP closed permanently), fuel types. `APT_RWY` has runway lengths; `APT_RWY_END` has `RIGHT_HAND_TRAFFIC_PAT_FLAG`. Runway lighting is not usable: `LGT_SKED` reads "SEE RMK" for the Phoenix airports checked.
  - `FRQ`: per airport, the tower frequency (`FREQ_USE` "LCL/P") and `TOWER_HRS` ("0600-0000", so part-time), CTAF, UNICOM, ATIS, ASOS or AWOS. Checked on DVT, E60 and P08.
  - `NAV`: VOR, VORTAC, VOR/DME, NDB, TACAN with frequencies.
  - `FIX`: 673 VFR waypoints nationwide (`FIX_USE_CODE` VFR); `CHARTS` says SECTIONAL or VFR TERMINAL AREA.
  - `PJA` (parachute jumping), `MAA` (glider, hang glider, ultralight, aerobatic areas), `MTR`, `FRQ` (CTAF, tower).
- **DOF** (daily CSV at `aeronav.faa.gov/Obst_Data/`, also an ADDS layer): obstacle type, AGL, MSL, lighting, quantity (a group).

### What public data cannot do

- **Abandoned airports are not in any public FAA data set.** NASR lists 3 airports closed permanently and 285 closed indefinitely nationwide, none in Arizona; the abandoned airports the sectional prints (paved, landmark value, 3,000 ft or longer) are not there, and ADDS lists only operational airports. Their positions can only come from the chart image itself.
- **No data says which symbols are printed.** The legend says heliports and ultralight parks are "selected" and private airports are shown when "having landmark value". NASR's `CHART_NAME` is only the sectional an airport falls on: Big Chino Airstrip is printed with a blank `CHART_NAME`. DOF lists far more obstacles than the chart shows. A data point alone does not prove a symbol is on the chart.
- **Printed positions are not data.** Labels and grouped obstacles are drawn offset; tolerances have to allow for it.
- **Maximum elevation figures, landmarks (drag strips, towns, roads, power lines), parks and wildlife areas** are drawn from the FAA's own cartographic database, which is not published. Not asked.
- **Special use airspace frequencies and contact facilities** are in the table image but not in ADDS. Not asked in v1.

## Approaches

**A. Reuse the 3D view (recommended for v1).** Symbol and hunt questions are `read` and `find` questions over the existing chart texture, framed top-down on a small window. New data is one small `chart.json` per area (symbol positions and facts) and one webp of the margin table. Smallest change; works for Phoenix and Miami now.

**B. Flat native crops.** A new 2D card showing pre-cut native-resolution crops. Sharper, and runs without a 3D area, but needs new UI, a new data set of tiles, and its own tap handling.

**C. Detect every symbol from the image.** Image matching over the whole chart, no data. Covers anything printed, but answers would rest on detection alone.

Recommendation: A, plus a narrow use of C: image matching only to confirm that a data point's symbol is printed, and later, if wanted, to find abandoned airports (no data at all) with Chris confirming each one once. B stays the path for chart-only areas nationwide (see Scaling).

## Question families

Each family is a new generator name in `QuestionType` (the Practice "types" filter). Each produces an existing question `type` (`read` or `find`), so scoring and the card mostly stay as they are.

### 1. `block`: the airport data block

Shows the sectional top-down, framed on one airport so its whole data block is in view, the airport highlighted (`highlight: [{ airport }]`). The prompt names nothing the block prints. Airports filter: when `airports` is set, only those.

| Sub | Asks | Answer from | Asked only when |
|---|---|---|---|
| identifier | "What is this airport's identifier?" | `ARPT_ID` (ICAO id where the chart prints it) | always |
| towered | "Does this airport have a control tower?" (blue or magenta) | `TWR_TYPE_CODE` | always |
| tower frequency | "What is the tower frequency?" | `FRQ` "LCL/P" | the airport has exactly one LCL/P frequency |
| part-time tower | "Is the tower open all the time?" (the star) | `TOWER_HRS` | the hours are given |
| CTAF | "What is the CTAF?" | `FRQ` "CTAF" | non-towered, one CTAF |
| UNICOM / ATIS / AWOS | "What is the ATIS frequency?", and so on | `FRQ` | one frequency of that kind |
| elevation | "What is the field elevation?" | `ELEV`, rounded to feet | always; wrong choices from nearby airports |
| longest runway | "How long is the longest runway?" (hundreds of feet, as printed) | `APT_RWY` | always |
| right traffic | "Which runways have right traffic?" (RP) | `APT_RWY_END` | at least one runway end flagged |
| beacon | "Does this airport have a rotating beacon?" (the star by the symbol) | `BCN_LGT_SKED` | always |
| fuel | "Is fuel available?" (the ticks) | `FUEL_TYPES` | always |

Not asked: runway lighting (L, *L), FAR 93, NO SVFR, weather cameras; the data does not say them reliably.

Where the chart and NASR could disagree (the chart's cutoff is weeks before its edition), the build uses the NASR cycle of the chart's edition (see Edition alignment). Chris checks the first build's answers against the chart by eye for a handful of airports.

### 2. `sua`: special use airspace

| Sub | Shows | Asks | Answer from | Wrong choices from |
|---|---|---|---|---|
| table floor / ceiling | the area raised, the margin table beside the card | "What is the floor of QUAIL MOA?" | `LOWER_*`, `UPPER_*` (with TNI as the table writes it) | the same field of other SUA in the table |
| table agency | same | "Who controls R-2301 E?" | `CONT_AGENT` | other agencies in the table |
| kind | an area highlighted, no name | "What kind of special use airspace is this?" | area kind | other SUA kinds |
| airplane in it | airplane at a lat, lon, altitude inside the footprint | "Is the airplane inside QUAIL MOA?" | floor and ceiling (TNI: the ceiling itself is outside) | Yes / No |
| in use at | a date and a UTC time | "Is GLADDEN 1 MOA scheduled in use Saturday 14 November at 2100Z?" | `TIMESOFUSE` (local, as the table prints it) turned to UTC with the record's `GMTOFFSET` and `DST_CODE` for that date; only when the times parse with a strict grammar ("HHMM - HHMM, DAY - DAY" with "OTHER TIMES BY NOTAM"); anything else is skipped | Yes / No / By NOTAM |
| times in UTC | the table | "When is BAGDAD 1 MOA in use, in UTC?" | as above, for a named date (daylight saving changes the answer outside Arizona) | other areas' times, and the same times left in local |
| rules | an area highlighted | "What must you do before entering this restricted area when it is active?" | a rules table per kind in a new module like `airclass.ts`, written or approved by Chris | the other kinds' rules |

The `find` generator already asks for SUA by name (kinds R, P, W, MOA, A); nothing changes there. Kinds filter: `sua` asks only about SUA kinds in `kinds`. The rules sub is in (Chris, 2026-11-08); its wording is Chris's.

### 3. `symbol`: what is it, and what does it say

Shows the sectional top-down, framed on one symbol, with that point highlighted (`highlight: [{ point }]` already exists in `Scene`).

| Sub | Asks | Answer from |
|---|---|---|
| what is this | "What does this symbol show?" | the symbol's kind; wrong choices from other kinds in the same group (airports with airports, navaids with navaids, obstacles with obstacles) |
| obstacle | "How high is this obstacle above sea level?" / "...above the ground?" | DOF `AMSL` / `AGL`; wrong choices at least 100 ft apart |
| navaid | "What is this VOR's frequency?" | `NAV` |

### 4. `hunt`: find it in 30 seconds

1. Pick a symbol kind the area has (respecting the `symbols` filter).
2. Start the camera on a random window the size of a normal top-down map view (Chris: same size as normal; pan and zoom work as on the normal map) that holds at least one printed instance at least 1 NM inside the edges and at least 6 symbols of at least 4 kinds, from `chart.json`. Up to 200 tries, then give up (null, as the other generators do).
3. Ask "Tap the private airport" (`ask.hunt(kindLabel)`), top-down, sectional, nothing raised, tags off.
4. Any instance of that kind in `chart.json` is right, unmatched ones included (the student can only tap what is drawn), and one the student pans to as well. A tap counts within `nm` (about 0.4 NM, a symbol's radius at the starting zoom) or 24 px on screen, whichever is larger, as fix taps do, so it still works zoomed out. A tap elsewhere is wrong.
5. A countdown of `seconds` (default 30), shown as a number with a draining line or circle, something obvious (Chris). At 0 the question scores wrong and the reveal rings every instance.
6. In accessibility mode (see below): a number on every symbol in view, chosen by typing or picking the number, and no countdown.

Kinds for the hunt and "what is this", by how sure we are the symbol is printed:

| Tier | Kinds | Source | Printed? |
|---|---|---|---|
| A | public airport towered / non-towered, seaplane base, military airport, VOR, VORTAC, VOR/DME, NDB, VFR waypoint (`CHARTS` has SECTIONAL) | NASR | always, by charting rules |
| B | private airport, heliport, ultralight park, gliderport, obstacle, group obstacle, obstacle 1,000 ft AGL or higher, parachute area | NASR, DOF | only some: asked only where the image match confirms a symbol at the data point |
| C, later | abandoned airport | none | found by image matching, confirmed once by Chris; Chris named it as an example, so not in v1 |

## Accessibility mode

Chris, 2026-11-08: skycake gets an accessibility mode, as instrumentready.com has (its toggle sets `data-a11y` on the page and is kept as `ir-a11y`; it raises contrast, swaps instant changes for explicit buttons and drops single-key shortcuts).

- **Turning it on:** a new `mount` option `a11y?: boolean`, which instrumentready.com sets from its own toggle (and updates when the toggle changes); SkyCake Viewer gets its own toggle. Skycake already follows the system's reduced motion setting.
- **For these questions:** the hunt shows a number on every symbol in view and is answered by the number, with no countdown (time limits must be adjustable for accessibility); the table sheet and the ring highlight follow the mode's higher contrast; every multiple choice question already works from the keyboard.
- **The rest of skycake** (the map, walkthroughs, other quiz types) in accessibility mode is a design of its own, in a separate spec, as it "changes a lot of things".

## Data

### Per area: `chart.json`

```ts
type SymbolKind = "towered" | "nontowered" | "private" | "military" | "heliport" | "seaplane" | "ultralight" | "glider"
  | "abandoned" | "vor" | "vortac" | "vordme" | "ndb" | "obstacle" | "obstacleTall" | "obstacleGroup" | "vfrWaypoint" | "parachute";
/** printed: how we know it is on the chart: charting rules (tier A), an image match at the data point (B), Chris's confirmation (C); unmatched: a tier B data point with no match, never asked about, but a hunt tap on it counts. */
type Sym = { kind: SymbolKind; lat: number; lon: number; id?: string; name?: string; printed: "rule" | "matched" | "confirmed" | "unmatched";
  elev?: number; rwy?: number; freq?: string; agl?: number; msl?: number;
  /** Airports: what the data block prints. */
  block?: { ident: string; towered: boolean; tower?: string; towerHrs?: string; ctaf?: string; unicom?: string; atis?: string; awos?: string; rp?: string[]; beacon: boolean; fuel: boolean } };
type ChartFile = { edition: string; nasr: string; dof: string; symbols: Sym[]; table?: { url: string; w: number; h: number } };
```

Only symbols inside the area's bounds. Estimated under 300 KB for Phoenix (obstacles are most of it); the existing size check covers it.

### Special use airspace extras in `area.json`

SUA areas gain `times?: string`, `agency?: string`, `tni?: boolean` from the fields the build already downloads. A few KB.

### The margin table: `sua-table.webp`

Cropped from the native GeoTIFF by a pixel box per chart in `AREAS` (as the IFR sheets' `panel` is today), webp, native scale, about 650 KB. The Data cycle PR shows the crop so a moved table is caught when the PR is reviewed. On screen: a Table button on the card opens it full screen with pan and zoom (Chris, 2026-11-08).

### Image matching (`scripts/symbols.ts`, build time only)

- Glyphs cut once from the sectional legend (FAA, public domain), committed as small PNGs under `scripts/glyphs/`.
- On the area texture: a colour mask (magenta, blue, black) and normalized cross-correlation at the texture's known scale, in plain TypeScript over `sharp` pixels. No new dependency.
- Tier B: a match within a few pixels of the data point marks the symbol `matched`; no match, it is kept as `unmatched`: never asked about or hunted for, but a hunt tap on it is right, since a matcher miss must not mark a correct tap wrong.
- Tier C (later): scan the texture for the abandoned airport glyph. Positions Chris has confirmed live in `data/<area>/marks.json` (committed). New candidates, and confirmed ones no longer found, go into the Data cycle PR as a contact sheet; nothing new is asked until Chris confirms it.

### Edition alignment

The sectional is built from NASR and DOF at its own cutoff. The build uses the NASR cycle in effect on the chart's edition date (every chart edition starts on a NASR cycle), not today's, and records `nasr` and `dof` dates in `chart.json`. DOF changes daily: obstacle heights are asked only as choices at least 100 ft apart.

## Fit with the quiz model

- **`src/question.ts`:** `Question` gains `seconds?: number` (any type). Find gains `near?: [lat, lon][]` (other right answers) and `nm?: number` (tolerance, default today's 1.5). `score` checks `near` too. The card's elapsed time is already reported in `QuizResult.ms`.
- **`src/scene.ts`:** add `table?: boolean` (show the margin table). The hunt needs a way to show the chart with nothing over it; if flat airspace draws over the chart, a scene field to hide it.
- **`src/generate.ts`:** four generators, `block`, `sua`, `symbol`, `hunt`. `Gen` gains `chart: ChartFile | null` and `symbols?: SymbolKind[]`. A null `chart` (an area built before this) makes `block`, `symbol` and `hunt` return null, so practice skips them.
- **`src/quiz.ts`:** `Generate` and Practice filters gain `symbols?: SymbolKind[]` and `seconds?: number`. One filter alone keeps to its side, as today: `symbols` alone asks only `symbol` and `hunt`; `kinds` naming only SUA kinds asks `find` and `sua`; `airports` alone also asks `block` about those airports.
- **`src/quizui.ts`:** the countdown, the Table button and its full-screen sheet, time up, the hunt's numbered markers in accessibility mode.
- **`src/ui.ts` `Options`:** `a11y?: boolean`.
- **Labels (`src/ui.ts`), all placeholders, Chris writes the copy:** `symbols: Record<SymbolKind, string>`, `timeUp`, `ask.hunt(kind)`, `ask.whatSymbol`, `ask.suaFloor(name)`, `ask.suaCeiling(name)`, `ask.suaAgency(name)`, `ask.suaKind`, `ask.inSua(name)`, `ask.suaInUse(name, date, utc)`, `ask.suaUtc(name, date)`, `ask.suaRules`, `ask.byNotam`, `ask.identifier`, `ask.towered`, `ask.towerFreq`, `ask.towerHours`, `ask.ctaf`, `ask.unicom`, `ask.atis`, `ask.awos`, `ask.elevation`, `ask.runway`, `ask.rightTraffic`, `ask.beacon`, `ask.fuel`, `ask.obstacleMsl`, `ask.obstacleAgl`, `ask.navaidFreq`.
- **Validation (`src/validate.ts`):** authored questions may name a symbol by `id`; the validator checks it against `chart.json` as it does fixes and areas.

## Scaling

- **Phoenix and Miami (v1):** about 1 MB more per area (`chart.json`, `sua-table.webp`). Same git, npm and Pages path as today.
- **Later (Chris, 2026-11-08):** more areas, up to the whole country, each served on its own when a student opens it, never all at once. Worked out when that work starts. Notes for then: a 3D area is about 10 MB today, so dozens of them in git and the npm package every 56 days would be heavy; a lighter chart-only pack per sectional (tiles, `chart.json`, `sua-table.webp`, no terrain or procedures, roughly 15 to 20 MB) could be built in Actions and uploaded straight to Cloudflare Pages instead of committed. That is where approach B (flat crops, no 3D) would come in.
- **Rebuilt every 56 days with the chart** (Chris, 2026-11-08): the symbols sit on the area's chart image, so `chart.json` and `sua-table.webp` are rebuilt with it.

## Testing

- Generators: seeded tests on a fixture `chart.json` as `generate.test.ts` does today: every answer is in the data, wrong choices are distinct, filters hold, null when nothing fits.
- The `TIMESOFUSE` grammar: the strings it accepts and the ones it must skip, taken from the Phoenix and Miami records.
- Scoring: `near` and `nm`, time up.
- Image matching: a few committed texture crops with known symbols (private airports and obstacles near Wittmann) and known empty spots.
- By hand: phone emulation at 390 px with touch, a full hunt with the timer.

## Not in scope

Maximum elevation figures, landmarks, MTR routes, TFRs, the TAC, IFR chart symbols, special use airspace frequencies, abandoned airports (later, see tier C), more areas (later, see Scaling).

## Open questions for Chris

None. The accessibility mode for the rest of skycake gets its own spec.

Settled with Chris (2026-11-08):

- "The blurb underneath" is the airport data block; the SUA table questions stay as well.
- The abandoned airport was an example: not in v1.
- The whole country comes later, each area served on its own, never all at once.
- Countdown: a number with a draining line or circle, something obvious.
- Highlight: a ring.
- Hunt window: the same size as the normal map, with pan and zoom as usual.
- The SUA rules sub is in.
- All times in UTC, the table's times too: they are asked only by the "times in UTC" sub, never as the table prints them in local.
- The margin table: a Table button opening a full-screen sheet with pan and zoom.
- Accessibility mode: skycake gets one (host option and the Viewer's own toggle); in it the hunt uses numbered markers and no countdown.
- Symbol data is rebuilt every 56 days with the chart.
- Everything else in this spec is approved.
