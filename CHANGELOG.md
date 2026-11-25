# Changelog

Notable changes. Sites install skycake from GitHub, so a version here is the `version` in `package.json`, not an npm release.

## 1.0.0 (2026-11-25)

First public release.

- Airspace: Mexican and Canadian airspace in the FAA data (Tijuana's TCA) is left out. The park, refuge, wilderness and marine sanctuary outlines are gone: they did not line up with the charts. New: the 60 NM ring around the DCA VOR/DME (`DC60`, a dashed line on the ground; its label `kinds.DC60`) and the Disneyland TFR, from FDC NOTAM 6/6925. Kind `PARK` is replaced by `DC60`.
- Drawing: areas from the surface no longer flicker over the sea (W-291, A-291D, W-107B), stacked sections such as R-2310A and B no longer tint their shared plane twice, and pointing at an airspace tag shows that area's tip even where another area is in front.
- SkyCake Viewer: an install button on the start screen. Chrome, Edge and Android open their install prompt; Safari and iOS show the steps (Share, then Add to Home Screen; File, then Add to Dock); Firefox, which cannot install, and an installed copy hide it. `?install` opens the steps. Its words are drafts.
- Procedure charts: a panned or zoomed chart stays on screen when the panel resizes (Plate to Split left it off screen), and picking a chart whose procedure is already on the map adds none of its others (ILS OR LOC RWY 11 with the ILS shown no longer adds the LOC).
- SkyCake Viewer: a terms of use page (`terms.html`), linked from the start screen, privacy page and demo page, and a privacy page that names Cloudflare's request logs and what the browser keeps on the device. Both reviewed by two models in place of a lawyer; the terms credit three.js and the airplane model. The help page no longer says a second tap lowers an area.
- Security review fixes. Workflows: the data build and the Cloudflare upload each run apart from the job holding their write token or secret, the token lives in a `production` environment only main can use, manual deploys run from main only and only main's newest commit ships, actions are pinned to commits (Dependabot keeps them current), and CODEOWNERS asks for Chris's review on main. App: a CSP and no-framing headers (`app/_headers`; the help pages' inline script and the demo page's style moved to files), a 404 page so a missing file is never saved as a page, and a saved area's card and map show the date its saved copy is current through. The data build refuses odd file names from FAA listings, a malformed `?scene=` falls back to free roam, a walkthrough's next link must be http(s), and `npm run demo` answers only requests addressed to localhost.

- Airspace: TRSAs, special air traffic rule areas (Luke, DCA), the DC SFRA with its flight restricted zone (orange, shown in IFR too), Class E from nonstandard floors (9,500 MSL in the mountains, offshore 2,000 MSL) as a sheet at that floor, permanent national defense TFRs, national security areas, the ADIZ, and national parks, wildlife refuges, wilderness and NOAA marine sanctuaries (outlines on the ground, from USGS PAD-US). Ceilings marked unlimited (R-4001A) reach the top. Heights above the ground (an alert area to 700 AGL, a MOA from 500 AGL) stand over the ground under the area, not the area's field elevation. Hatched areas and the SFRA no longer hide the airspace behind them, overlapping 700 ft Class E tints once, and overlapping Mode C veils draw only their outer edge.
- Airways at 18,000 and up are left out; no area has the high charts.
- Tapping a raised area no longer lowers it (the Airspace list does), removing a procedure leaves the camera where it is, and a standalone app's Close is also at the left of the header on desktop.
- 14 new areas, 16 in all: Atlanta, Boston, Chicago, Dallas-Fort Worth, Denver, Grand Forks, Houston, Las Vegas, Los Angeles, New York, San Diego, San Francisco, Seattle and Washington. The TAC and IFR area chart are optional; an area may span several sectionals or low sheets.
- Airport diagrams printed a quarter turn with only two latitude ticks now place (KATL, KJFK, KEWR, KDFW, KLAS, KHOU and others).
- Quizzes: a wrong first answer gets a second try with the question's optional `hint`, the wrong choice struck out; only the first answer scores and `onResult` reports it once. Labels add `tryAgain` and `rightSecondTry`.
- Quizzes: a 1x/4x height button in the top bar, kept for every question once picked. Explore before the end puts **Back to quiz** in free roam (label `backToQuiz`), back to the same question, or the next if it was answered.
- Quizzes: an area a question asks about stands up in 3D, four times as tall and seen at an angle; procedure scenes open on the IFR chart and keep raised areas; the airplane is drawn larger with a dashed line to a ring on the ground; a flown route grows in step with the airplane. Generated questions ask for the FAF or MAP by role.
- Plate questions: `plateRegions` on a choice question marks one box per choice on the plate, and a tap inside one picks it (the buttons stay for the keyboard). The plate can no longer be dragged off its panel.
- Class B, C and D ceilings charted "up to but not including" (the FAA's `TNI`) are stored one foot lower and shown as on the chart: 2,999 ft, charted -30.
- Pointer: the left mouse button pans and the right turns, as on a map app; a pen double-tap (or a pen button that sends a double-click) and drag zooms, and the pen keeps working after it.
- Demo: VFR and IFR example quizzes (`?quiz=vfr` on the TAC, `?quiz=ifr` on the IFR area chart, no airport diagram questions) and `demo/all.html`, a page of every mode and quiz type. Their words are drafts.
- The view loads under a progress screen, the first approach shown switches to IFR once, and the diagram button no longer zooms.

- SkyCake Viewer's start screen has faint contour lines at the top right of the window and of each card, with a slow ripple. The build draws them (`scripts/contours.mjs`); they hold still under reduced motion and in accessibility mode, and are off when more contrast is asked for.
- New look, from Chris's mockups and token sheet: a cooler dark palette, a header with the area's name (`mount({ title })`), a tool rail with each setting's value (Diagram, Tags, Height, Rules, Chart), a phone View sheet with switches and segmented picks, a phone search behind the header's search button, and restyled cards, player and quiz. SkyCake Viewer's start screen has area cards with Open area and a Save button that counts its progress. Both sites get it, through `style.css`. Labels add `on`, `off`, `plate`, `plateOpen`, `split` and `resize`; `height` reads Height and `mode` reads Rules.
- The procedure plate panel (`src/plate.ts`): beside the map on desktop and in phone landscape, over it in portrait, with a divider (drag or arrow keys), Full screen and Close.
- Fixes from the reviews of the new look and the chart viewer: Escape closes the plate panel only from inside it (and not from its chart picker); a phone's search closes after a pick; a failed chart list is tried again; switches and selected controls keep their state in Windows contrast themes; the search panel clears the taller tool rail in accessibility mode; panel ids are unique to each viewer on a page; SkyCake Viewer's Open area links name their area, and its pages open offline behind Cloudflare's redirects.
- Procedure chart viewer: the FAA's approach, departure and arrival charts in the plate panel, with a chart picker, continuation pages, pan, zoom and fit, and a Map / Plate / Split switch. `npm run data` renders every d-TPP page to `data/<area>/charts/` (cycle 2611: Phoenix 196 pages, 16.4 MB; Miami 333, 27.2 MB), writes `charts/<airport>.json` matched to the procedures, and sets `plates: true` in `area.json`. Scenes take `plate`; `validateWalkthrough` and `validateQuiz` take an optional `charts` loader. SkyCake Viewer saves an area's charts with it.
- SkyCake Viewer's how-to page, `help.html` (skycake.app/help): free roam on desktop and phone, the View settings, walkthroughs and practice, and accessibility mode. Linked from the start screen and the demo page; its words are drafts.
- Docs brought up to date with the new look: README, CLAUDE.md, CONTRIBUTING and `docs/accessibility.md`.
- Accessibility mode's own toggle on the map is a small button with the accessibility symbol, under the tool rail on desktop and in the header on a phone. It was a labeled switch row.
- Real words in place of "Placeholder: ..." wherever SkyCake Viewer shows them: accessibility mode's labels in free roam (`a11y`, `inView`, `summary`, `camera`, `facts`), `wake`, the start screen and `accessibility.html`. Walkthrough and quiz labels keep their Placeholder defaults.
- Accessibility mode: 48px controls, a taller header and tab bar, whole tab names, and the camera pad folds behind a Camera button on a phone.
- Accessibility mode: `mount({ a11y })`, or skycake's own switch in View when a site passes nothing. Higher contrast, a focus ring, a camera pad, In view with numbered badges, Check before scoring, Skip on find questions (`skipped: true` in `onResult`), walkthroughs that stop at each step, no motion. Every change: `docs/accessibility.md`. SkyCake Viewer has the switch on its start screen and an `accessibility.html` page.
- Walkthroughs: `mount({ mode: { walkthrough, next } })` plays steps like a video, with captions, highlights, procedures drawn leg by leg, an airplane flying them and quick checks; Explore leaves into free roam. Scenes take `highlight` and `airplane`.
- Quizzes: `mount({ mode: { quiz } })` asks written questions (find, read, airplane, procedure) and questions generated from the FAA data, with a running count, the answer revealed in 3D, and Again or Explore at the end. `quiz: "practice"` asks generated questions without end, filtered by `types`, `kinds` and `airports`. `onResult` reports each answer and the end; skycake stores nothing.
- SkyCake Viewer (`app/`): a standalone web app for skycake.app. Start screen with the areas, offline saves with a current-through date, full screen maps.
- SkyCake Viewer's demo page, `demo.html`: Phoenix and Miami in 3D, free roam, walkthroughs, quizzes and accessibility mode in screenshots, each opening its scene in the app.
- SkyCake Viewer's icon is the upside-down cake: Chris's art on the dark tile.
- Blue (`#3d7bc2`) is the default accent. Sites that set `--red` and `--redbg` keep their own, so instrumentready.com stays red.
- `mount()` takes `close`: the view fills the window from the start and its close button calls the site's function.
- `area.json` records its 28-day procedure `cycle`. `npm run data -- --cycle` prints the cycle in effect.
- Data cycle workflow: a PR with new FAA data every 28 days.
- GitHub Actions CI: type check, unit tests, stale `dist/` check, data file sizes, app build, install from git.
- Community docs: CONTRIBUTING, SECURITY, CHANGELOG, issue and PR templates, Dependabot for the workflow actions.

## 0.7.3 (2026-11-05)

- Two fingers never move the map, and a turn has to be clear.

## 0.7.2 (2026-11-05)

- Tilt and pinch correct themselves mid-gesture.

## 0.7.1 (2026-11-05)

- Tilt and pinch told apart by how the fingers move together.

## 0.7.0 (2026-11-05)

- Easier 3D navigation on phones; browser gestures blocked over the map.

## 0.6.0 (2026-11-05)

- IFR mode: VFR/IFR and map buttons, special use airspace only, low altitude airways at their MEA.

## 0.5.1 (2026-11-05)

- The height toggle keeps the camera; controls easier to see.

## 0.5.0 (2026-11-05)

- IFR area and low charts.

## 0.4.1 (2026-11-05)

- Airport diagram tick labels drawn as outlines are read.

## 0.4.0 (2026-11-05)

- Miami: Key West to Palm Beach.

## 0.3.1 (2026-11-04)

- Every approach fits on the map.

## 0.3.0 (2026-11-04)

- Phoenix to Tucson, chart toggle, airport tags and list, button names, 1x height.

## 0.2.0 (2026-11-04)

- Scenes and the new free-roam layout.

## 0.1.0 (2026-11-04)

- The 3D airspace viewer, moved in from instrumentready.com.
