# Changelog

Notable changes. Sites install skycake from GitHub, so a version here is the `version` in `package.json`, not an npm release.

## Unreleased

- Walkthroughs: `mount({ mode: { walkthrough, next } })` plays steps like a video, with captions, highlights, procedures drawn leg by leg, an airplane flying them and quick checks; Explore leaves into free roam. Scenes take `highlight` and `airplane`.

- SkyCake Viewer (`app/`): a standalone web app for skycake.app. Start screen with the areas, offline saves with a current-through date, full screen maps.
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
