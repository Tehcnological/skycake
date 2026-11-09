# SkyCake Viewer: design

Status: phase 1 (web app) merged 2026-11-08 (#12), phase 2 (data cycle) merged 2026-11-08 (#13). Phases 3 and 4 (F-Droid, iOS) not started; they wait for Chris's go-ahead. Chris chose the name, the blue, the start screen and skycake.app on 2026-11-07.

## Goal

skycake stays the library sites embed, and is also its own app: a free web app on Cloudflare first, then Capacitor wrappers for Android (F-Droid, not Google Play) and iOS. Offline FAA data that updates every cycle, like an EFB, with the date it is current through on screen. Not for navigation, said on screen.

## Decisions (Chris, 2026-11-07)

- **Name:** SkyCake Viewer (short name SkyCake). Icon: an upside-down cake. `app/icon.svg` is a placeholder until Chris supplies one.
- **Accent:** blue `#3d7bc2`, the default everywhere. instrumentready.com stays red: `style.css` reads `var(--red, #3d7bc2)`, and that site sets `--red` and `--redbg`. Keep that fallback, or instrumentready.com turns blue.
- **Area picker:** a start screen listing the areas, not a control on the map.
- **Host:** Cloudflare Pages, skycake.pages.dev, then skycake.app (registered 2026-11-07).
- **Copy:** every on-screen word in `app/main.ts` is a placeholder for Chris's copy.

## What the app does (phase 1)

- **Start screen:** one row per area: its name, "current through" date (amber once past), and a Save button with the area's size. The button reads Save, Saving, Saved, Update or Retry.
- **Map:** `?area=phoenix` mounts that area full screen with `mount(el, { close })`. `&scene={...}` sets the first scene (read only; moving the map does not write the URL). Close replaces the map in history, so Back goes to the list.
- **Library hook:** `close` on `mount()` fills the window from the start and turns the close control (phones: the Close tab; desktop: in place of Full screen) into a call to the site's function. It clears `html.skycake-full` first, so a page that stays can scroll.

## Offline

- `npm run app` writes `www/`: the app bundled with three.js by esbuild (three loads only when a map opens), `style.css`, icons, a copy of `data/`, `data/manifest.json` and `sw.js`.
- **Manifest:** per area: `edition` (charts, 56 days), `through` (last day of the area's 28-day procedure cycle), `rev` (hash of every file), `bytes`, `files`.
- **Service worker:** precaches the shell (every file outside `data/`, plus the manifest) per build; its version is a hash of those files. Every GET is answered cache first, except requests made with `cache: "reload"`.
- **Saved areas:** one Cache Storage cache per area and revision, `data:<area>:<rev>`. Save fetches every file with `cache: "reload"` (so Update never copies the old cache), then writes a marker; only a cache with the marker counts as saved. A new revision shows Update; saving it deletes the old cache. Save also asks for persistent storage.
- **Not done:** deleting a saved area, a Wi-Fi only setting, a total of storage used, downloading the next cycle before its effective date.

## Data cycle (phase 2)

- `.github/workflows/data.yml` runs daily at 10:30 UTC (cycles take effect 0901Z) and by hand. When any `area.json` is from an older cycle than `npm run data -- --cycle` and no `data/<cycle>` branch exists, it rebuilds, checks file sizes, opens "Data: <cycle> cycle" and starts `build-and-test` on the branch (a workflow's own PRs start no workflows).
- Chris merges the PR. Sites get the data from git; Cloudflare rebuilds the app; saved areas offer Update.
- `data/` stays committed because instrumentready.com copies `node_modules/skycake/data/`. Git grows by about 23 MB a cycle.
- A full rebuild took 5 minutes on a hosted Ubuntu runner and reproduced the committed data byte for byte (2026-11-08).
- **Open:** whether a `workflow_dispatch` run counts as the required `build-and-test` check on the bot's PR. The first run (by hand, or 2026-11-26) shows it.
- **Reviewing a data PR:** read the left-out airports and diagrams in its body, compare with the last cycle's PR, check CI, merge.

## Phase 3: Android on F-Droid (not started)

- Capacitor wrapper around `www/`. Areas stored on the device, passed to `mount()` as `base` with `Capacitor.convertFileSrc()`. Background update with WorkManager is best effort; always also check on open.
- F-Droid builds from source and signs. No Google Play Services, Firebase or analytics: check every plugin's dependencies (the official geolocation plugin uses Play Services).
- Needs a git tag per release, a rising `versionCode`, `fastlane/metadata/android/en-US/`, and a merge request to `fdroiddata` on GitLab.
- **Biggest risk:** whether F-Droid accepts a build that runs `npm ci` for three.js, esbuild and Capacitor. Check their current rules before building anything. Data from Chris's own site should not draw the NonFreeNet anti-feature, but that is F-Droid's call.

## Phase 4: iOS (not started)

- Same Capacitor wrapper. Needs Chris's Apple developer account.
- Build on GitHub's macOS runners (free for this public repo). Signing keys and an App Store Connect API key as repo secrets, used only by a manual or tag-triggered workflow, never on `pull_request`. TestFlight first.
- Offline data and the 3D view help with Apple's "just a website" rule (4.2). Chris holds sole copyright, so AGPL and App Store terms don't clash for him; keep the assignment rule in CONTRIBUTING.md.

## Constraints

- The library's install path doesn't change: `dist/` and `data/` committed, `www/` neither committed nor in `files`, no `prepare` script.
- Free tiers only; nothing that bills without Chris's say. Cloudflare static assets, no R2 unless Chris agrees.
- Each data file well under 25 MiB (Cloudflare's limit); CI fails at 24.
- Public domain FAA and USGS data only. three.js is MIT; its license comment stays in the bundle.

## Tests

- CI: `npm run app` with asserts on the manifest and shell list, plus file checks.
- By hand, in headless Chrome over DevTools (the Claude browser pane runs no service workers): save, reload offline, open an area with the server stopped, Close and Back, a new revision's Update, phone emulation at 390 px with touch.
- Not yet: a real phone, iOS Safari, a home screen install, Cloudflare itself.
