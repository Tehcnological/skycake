# Changelog

Notable changes. Sites install skycake from GitHub, so a version here is the `version` in `package.json`, not an npm release.

## Unreleased

- New look, from Chris's mockups and token sheet: a cooler dark palette, a header with the area's name (`mount({ title })`), a tool rail with each setting's value (Diagram, Tags, Height, Rules, Chart), a phone View sheet with switches and segmented picks, a phone search behind the header's search button, and restyled cards, player and quiz. SkyCake Viewer's start screen has area cards with Open area and a Save button that counts its progress. Both sites get it, through `style.css`. Labels add `on`, `off`, `plate`, `plateOpen`, `split` and `resize`; `height` reads Height and `mode` reads Rules.
- The procedure plate panel (`src/plate.ts`): beside the map on desktop and in phone landscape, over it in portrait, with a divider (drag or arrow keys), Full screen and Close.
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
- Community docs: CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, issue and PR templates, Dependabot for the workflow actions.

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
