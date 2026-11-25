# skycake

`skycake` is a TypeScript library and web app that draws 3D airspace and instrument procedures over FAA charts, with USGS terrain and FAA airport diagrams. It supports free roam, guided walkthroughs, and quizzes for teaching VFR and IFR airspace and procedures. The name comes from the upside-down wedding cake shape of Class B airspace.

**Not for navigation.**

It also ships as [SkyCake Viewer](#skycake-viewer), a free web app at [skycake.app](https://skycake.app) that can be installed from the browser and used offline.

## Areas covered

Sixteen US areas are included under `data/`. Every area also has USGS terrain, airspace, airways and the FAA's instrument procedures.

| Area | Folder | Sectional | TAC | IFR low | IFR area chart | Procedure charts | Airport diagrams |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Atlanta | `atlanta` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Boston | `boston` | ✓ | ✓ | ✓ |  | ✓ | ✓ |
| Chicago | `chicago` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dallas-Fort Worth | `dallas-fort-worth` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Denver | `denver` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Grand Forks | `grand-forks` | ✓ |  | ✓ |  | ✓ | ✓ |
| Houston | `houston` | ✓ | ✓ | ✓ |  | ✓ | ✓ |
| Las Vegas | `las-vegas` | ✓ | ✓ | ✓ |  | ✓ | ✓ |
| Los Angeles | `los-angeles` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Miami, Key West to Palm Beach | `miami` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| New York | `new-york` | ✓ | ✓ | ✓ |  | ✓ | ✓ |
| Phoenix, to Tucson | `phoenix` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| San Diego | `san-diego` | ✓ | ✓ | ✓ |  | ✓ | ✓ |
| San Francisco | `san-francisco` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Seattle | `seattle` | ✓ | ✓ | ✓ |  | ✓ | ✓ |
| Washington | `washington` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## What it shows

- **Terrain:** USGS 3DEP 1 arc-second elevation data sits under every chart.
- **VFR charts and airspace:** Displays either the TAC inside its map bounds (with the sectional outside it) or the sectional across the whole area. Airspace volumes and boundaries draw in chart colors: Class B, C, D, and surface E; Class E 700 ft floors and nonstandard floors; Mode C veils; TRSAs; special use airspace (Restricted, Prohibited, Warning, MOA, Alert); special air traffic rule areas (SATR); the DC SFRA (shown in orange so it stands out from Class B); permanent national defense TFRs and the Disneyland TFR; national security areas (NSA); the ADIZ; and the 60 NM ring around the DCA VOR/DME. Only US airspace is drawn.
- **IFR charts and airspace:** Displays either the IFR area chart inside its map bounds (with the IFR low chart outside it) or the IFR low chart across the whole area. Low-altitude airways below 18,000 ft MSL draw at their minimum enroute altitude (MEA) with their fixes. Special use airspace, the SFRA, permanent TFRs, and the ADIZ also display under IFR rules.
- **Instrument procedures:** Approaches (IAP), departures (SID), and arrivals (STAR) from the FAA CIFP for every airport inside the area bounds. Several procedures can be displayed at once from the search box. Departures and approaches are mutually exclusive, so picking one clears the other kind. Picking an approach for the first time in a view switches `Rules` to IFR once per view.
- **Airport diagrams:** FAA d-TPP airport diagrams laid over the airport using their latitude and longitude ticks.
- **Procedure charts (plates):** FAA approach, departure, and arrival charts (including continuation pages) in a panel beside or over the map, matched to the procedures shown in 3D.
- **Walkthroughs and quizzes:** Plays scripted lessons and runs written or data-generated quizzes. Lesson and quiz content lives on the sites that embed `skycake`, not in this repository.

## Controls

### Camera and map gestures

| Action | Mouse | Pen | Touch | Keyboard (map focused) |
|---|---|---|---|---|
| Move (pan) | Drag | Drag | One-finger drag | `Shift` + Arrow keys |
| Turn and tilt | Right-drag, or `Ctrl`, `Shift`, or `Cmd` + drag | Side button + drag | Twist two fingers to turn; move two fingers up or down to tilt | Arrow keys |
| Zoom | Scroll wheel | Double-tap and drag (down zooms in, up zooms out) | Pinch | `+` / `=` and `-` |
| Inspect or select | Hover for label; click a flat area to display it in 3D; click an airport tag to list its procedures | Tap a flat area to display it in 3D; tap an airport tag | Tap a flat area to display it in 3D; tap an airport tag | Use `In view` in accessibility mode |

Clicking or tapping an active 3D area shows its label. A second tap on the same area hides the label. Turn airspace types off from the `Airspace` list.

### Desktop and phone layout

- **Desktop (wider than 860 px):** Controls float over the 3D view. Top left holds the optional area header (with `Close` to its left in standalone apps) and the `Airspace` list below it. Top right holds the search box, the `Plate` button, and chips for active procedures. Bottom right holds the tool rail (`Diagram`, `Tags`, `Height`, `Rules`, `Chart`, and `Full screen` or `Close`), where each row shows its current value.
- **Phone (860 px or narrower):** An embedded map starts as a preview so the page can scroll past it. Tapping opens it full screen. A header bar sits above the view with the area name, a search button, and `Close` on the left (plus a full-screen button on embedded non-fullscreen views). A tab bar sits along the bottom (`Airspace`, `Procedure`, `Diagram`, `View`, `Plate`). The `View` tab opens a sheet with switches and segmented buttons for `Tags`, `Height`, `Rules`, and `Chart`.
- **Procedure plate panel:** Opens beside the map on desktop and landscape phones, or above the map on portrait phones. It opens only from its button or from a scene's `plate` field, and stays hidden if an area was built without charts (`plates` absent from `area.json`). A divider resizes the split by dragging or with arrow keys. The header holds the chart picker, page arrows for continuation pages, a `Map` / `Plate` / `Split` switch, and `Close`. Drag pans the chart, scroll or pinch zooms, and double-click or double-tap fits the page. Accessibility mode adds `Zoom in`, `Zoom out`, and `Fit` buttons. Each chart image uses the chart's name as its `alt` text.

## Using skycake on a site

### Install

```sh
npm install github:Tehcnological/skycake#<commit> three@0.180.0
```

Pin a commit hash so `package.json` records it and `npm update` cannot move it. To update later, run the same command with the new commit hash.

### Serve data and styles

1. Copy one or more area folders from `node_modules/skycake/data/*/` (for example `data/phoenix/`) into your site's public directory, such as `/skycake/phoenix/`. Each area folder is 7 to 59 MB (more than half is procedure chart PNGs).
2. Load `skycake/style.css`.

### Mount API

```ts
import { mount } from "skycake";

mount(document.querySelector("#airspace")!, {
  base: "/skycake/phoenix/",
  // Initial scene. Default: every airspace type active, whole chart in view.
  scene: {
    raise: ["B", { area: "d-chandler-municipal-airport-class-d" }],
    procedures: [{ airport: "KPHX", name: "EAGUL6" }, { airport: "KPHX", name: "ILS RWY 25L" }],
    camera: "fit",          // or "top", { frame: [...] }, or a placed camera
    plate: { airport: "KPHX", chart: "ILS OR LOC RWY 25L" }, // opens this chart beside the map
  },
  airport: "KPHX",          // initial airport for the search box and diagram
  labels: { tags: "Tags" }, // override any on-screen text
});
```

Options accepted by `mount(host, options)`:

- `base`: URL of the area's data folder. Area IDs live in `data/<area>/area.json`.
- `scene`: Initial scene object (`camera`, `raise`, `procedures`, `highlight`, `airplane`, `diagram`, `height`, `tags`, `chart`, `plate`).
- `types`, `approach`: Shorthand options for a first scene (`approach` uses `airport`, defaulting to `KPHX`).
- `airport`: Initial airport for search and airport diagrams.
- `title`: `{ name, note? }` puts a header over the view with the area's name and a second line such as its current-through date.
- `close`: `() => void` for standalone apps. The view fills the window from the start, loads immediately without waiting to scroll into view, and calls this function when `Close` is pressed.
- `labels`: Partial overrides for any string or formatter in `LABELS` (including nested `ask` and `camera` objects).
- `mode`: `"explore"` (default), `{ walkthrough, next? }`, or `{ quiz, types?, kinds?, airports? }`.
- `onResult`: Callback invoked after each scored quiz answer and at quiz completion.
- `a11y`: Boolean driven by the host site's accessibility toggle. If omitted, `skycake` shows its own toggle in free roam.

### Loading, camera, and styling

- Embedded views (without `close`) defer loading `three.js` and chart textures until the element scrolls into view, and render a built-in loading screen with an inline retry button on failure.
- During startup, `skycake` dispatches bubbling `skycake-loading` events with `detail.step` set to `terrain`, `chart`, `airspace`, and `prepare` (initial GPU upload and shader compile).
- The promise returned by `mount()` resolves once the first scene is ready.
- Turning an airport diagram on while no procedure is shown moves the camera to frame the airport. Turning the diagram off, or toggling it while a procedure is shown, leaves the camera where it is.
- Colors and fonts follow the `--sc-*` custom properties in `style.css`, which fall back to host site tokens (`--side`, `--panel`, `--ink`, and others) and then to a flat dark theme. The accent color is blue (`#52a4ff`) unless the site sets `--sc-accent` or `--red` (`instrumentready.com` sets `--red`). Selected and pressed shades derive from `--sc-accent`.

### Accessibility mode

Pass `a11y` from your site's own toggle, or omit it so `skycake` renders its own accessibility button and saves the setting in `localStorage` under `skycake-a11y`. Accessibility mode increases contrast, enlarges controls and tags, disables motion, adds an on-screen camera button pad, adds a numbered `In view` picker, and avoids single-key shortcuts outside focused regions.

Every change and host-site requirement is documented in [docs/accessibility.md](docs/accessibility.md).

### Walkthroughs

Pass `mode: { walkthrough, next? }` to play a scripted lesson step by step. It starts paused on step 1 with a play button over the view. Each step runs for `seconds` (default `Math.ceil(4 + 0.06 * caption.length)`). Dragging the view pauses playback. A step's `check` pauses playback until answered and is not scored. `Explore` switches to free roam from the current scene. When `next` is given, its link appears at the end of the walkthrough.

```ts
import { mount, type Walkthrough } from "skycake";

const walkthrough: Walkthrough = {
  id: "class-b",
  title: "The Phoenix Class B",
  area: "phoenix",
  steps: [
    { caption: "The Class B from above.", scene: { camera: "top", highlight: [{ area: "b-phoenix-class-b-sfc-90" }] } },
    {
      caption: "An arrival, drawn leg by leg, with an airplane flying it.",
      seconds: 10,
      scene: {
        raise: ["B"],
        procedures: [{ airport: "KPHX", name: "EAGUL6", draw: true }],
        airplane: { along: { airport: "KPHX", name: "EAGUL6" }, seconds: 10 },
      },
      check: { type: "find", prompt: "Tap the surface area.", answer: { area: "b-phoenix-class-b-sfc-90" } },
    },
  ],
};
mount(element, { base: "/skycake/phoenix/", mode: { walkthrough, next: { label: "Take the quiz", href: "/quiz/class-b" } } });
```

Scene details in walkthroughs:

- `plate` takes `{ airport, chart, page? }` matching `charts/<airport>.json`, with `page` 1-based (default 1). It opens the plate panel to that page in Split mode. Passing `null` closes the panel; omitting `plate` keeps the current panel state.
- Step scenes support `highlight` (highlighted airspace areas also display in 3D), `airplane`, and `draw`.
- A scene that displays or flies a procedure without naming a `chart` uses an IFR chart, and keeps any explicitly listed airspace visible even if IFR rules would normally hide its type.
- An airplane flying a procedure with `draw: true` draws its route behind it by distance, and off-route transitions draw at the end.
- If a name is missing from the data, that part of the step is skipped with a console warning.
- Sample walkthrough: `demo/class-b.json` (run `npm run demo`, then open `/demo/?walkthrough=class-b`).

#### Validating walkthroughs

`validateWalkthrough` runs in Node with no DOM and returns problems formatted as `"<id> step <n>: <problem>"` (empty array when valid). It checks the area name, step list, every referenced name (area, airport, procedure, fix, diagram), captions, `seconds`, and each `check` question. Unknown fields are ignored.

Pass an optional `charts` loader to validate `plate` entries against each airport's chart index (`no charts for <airport>`, `no chart <name> at <airport>; charts there: ...`, `chart <name> has <n> pages, not <page>`). Without `charts`, only the airport ID and page number are checked.

```ts
import { readFileSync } from "node:fs";
import { validateWalkthrough } from "skycake";

const data = JSON.parse(readFileSync("data/phoenix/area.json", "utf8"));
const files = async (airport) => JSON.parse(readFileSync(`data/phoenix/procedures/${airport}.json`, "utf8"));
const charts = async (airport) => JSON.parse(readFileSync(`data/phoenix/charts/${airport}.json`, "utf8"));
const problems = await validateWalkthrough(walkthrough, data, files, "phoenix", charts);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
```

### Quizzes

Pass `mode: { quiz }` to ask written or generated questions on the question card. The layout places the progress count top left, the height scale toggle (`1×` or `4×`, persisted across questions once changed) and `Explore` top right, and the question card at the bottom (below the map on phones).

```ts
import { mount, type Quiz } from "skycake";

const quiz: Quiz = {
  id: "class-b",
  title: "The Phoenix Class B",
  area: "phoenix",
  shuffle: false, // true asks items in random order
  items: [
    { id: "find-zinga", type: "find", prompt: "Tap ZINGA.", answer: { fix: "ZINGA" }, scene: { procedures: [{ airport: "KPHX", name: "ILS RWY 07L" }] } },
    { id: "floor", type: "read", prompt: "The floor of the highlighted shelf?", choices: ["40", "50", "60"], answer: 1, scene: { highlight: [{ area: "b-phoenix-class-b-50-90-4" }] }, explanation: "The bottom number, in hundreds of feet MSL." },
    { id: "ceiling", type: "read", prompt: "Its ceiling, in feet MSL?", number: { answer: 2999, tolerance: 0, unit: "ft MSL" }, scene: { highlight: [{ area: "d-chandler-municipal-airport-class-d" }] } }, // charted -30: up to but not including 3,000
    { id: "plane", type: "airplane", prompt: "What airspace is the airplane in?", choices: ["B", "C", "D", "E"], answer: 0, scene: { airplane: { at: [33.4, -111.95, 4500] } } },
    { id: "faf", type: "procedure", prompt: "Which fix is the FAF?", choices: ["FOWLE", "ZINGA", "AVONA"], answer: 1, scene: { procedures: [{ airport: "KPHX", name: "ILS RWY 07L" }] } },
    { generate: "airplane", count: 2 }, // drawn from data each attempt; supports kinds and airports filters
  ],
};
mount(element, { base: "/skycake/phoenix/", mode: { quiz }, onResult: (r) => console.log(r) });
```

How questions work:

- **Question types and scenes:** Each question dims everything outside its scene and keeps the camera free. `find` questions start top-down (a fix is framed on its procedure over an IFR chart). `read` questions display the target area at 4× height from an angle. `airplane` questions show the airplane from an angle with a dashed line down to a ring on the ground.
- **Hidden hints:** While a question is open, hover tooltips are off, and fix altitudes and roles (`FAF`, `MAP`) stay hidden. Tags stay hidden except on procedure questions and generated fix questions (which show fix names only), and the airplane keeps its altitude tag.
- **Answering:** `find` questions are answered by tapping the map (fixes and airports match within 1.5 NM) or by tabbing through the on-screen list and pressing `Enter`. `read`, `airplane`, and `procedure` questions take 2 to 4 choices. With a `plate` in the scene, they can also take `plateRegions` (one `[left, top, right, bottom]` rectangle per choice in 0 to 1 image coordinates) so tapping the chart selects that choice while keyboard users keep the choice buttons. `read` questions can instead take a `number` answer with a `tolerance` (commas and spaces are ignored, so `"3,000"` parses as `3000`).
- **TNI ceilings:** Class B, C, or D ceilings charted as "to but not including" are stored 1 ft lower. For example, Chandler Municipal Class D charted `-30` under a 3,000 ft Class B floor is stored as `2999` and tagged `-30`.
- **Scoring and retries:** Only the first answer scores. A wrong first answer gives a second try: the card displays `tryAgain`, strikes out the wrong choice, and shows `hint` if provided. Getting the second try right displays `rightSecondTry`. The reveal shows an icon and word for right or wrong, names and marks the right choice if missed, and displays area facts and any explanation. It also shows the answer airspace in 3D: the tapped or highlighted area, `answerArea`, or the Class B, C, D, or surface E area around the airplane.
- **Multi-area answers and generators:** `find` questions on airspace can list `also` with extra accepted area IDs. Any question can set `answerArea` to highlight an area on reveal without naming it in the prompt. Generated questions (`find`, `read`, `airplane`, `procedure`) pull answers and distractors from `area.json`, terrain, and procedure files, and display area facts instead of written explanations. Generated `find` questions also ask for a procedure's FAF or MAP by role (`ask.findFaf`, `ask.findMap`) and use `also` for multi-piece airspace (either any piece or a specific floor-to-ceiling shelf).
- **End and free roam:** The end screen shows the score, `Again` (which redraws generated questions), and `Explore`. Leaving for `Explore` mid-quiz adds a `Back to quiz` button (using `backToQuiz`) that returns to the same question, or the next one if it was already answered.

**Labels:** `skycake` is the engine; sites write their own walkthroughs, quiz banks, and copy. All walkthrough and quiz strings in `LABELS` (card, player, and `labels.ask`) default to `"Placeholder: ..."` so missing site overrides stand out on screen. The exception is `facts`, which is shared with free roam. All free-roam and accessibility-mode labels have real defaults.

**Practice mode:** Pass `mode: { quiz: "practice", types?, kinds?, airports? }` for endless generated questions with a `right / answered` score. Passing `kinds` alone limits questions to airspace; passing `airports` alone limits questions to procedures. If the filters leave nothing to ask, the card says so and offers `Explore`.

**Results:** `onResult` is called after each first answer with `{ quiz, item, right, ms }` (plus `skipped: true` if skipped in accessibility mode), where `item` is the question's `id`, `item:<n>`, or `generate:<type>:<n>`, and `ms` is the elapsed time from showing the question to answering it. At the end of a quiz, `onResult` is called with `{ quiz, end: true, right, total }`. `skycake` stores nothing itself.

Sample quiz: `demo/class-b-quiz.json` (`/demo/?quiz=class-b`, or `/demo/?quiz=practice&kinds=B,D`).

#### Validating quizzes

`validateQuiz(quiz, data, files, area, charts?)` runs in Node with no DOM and returns problems formatted as `"<quiz id> item <n>: <problem>"`. Unknown fields are ignored.

- Written items are checked for valid names, non-empty prompts, 2 to 4 distinct choices (or a valid numeric answer and non-negative tolerance), valid `answerArea` and `also` IDs, valid `plateRegions`, and unique item IDs.
- A `find` answer must be tappable: `E700`, `EFLOOR`, `MODEC`, `ADIZ`, and `DC60` areas are rejected because they cannot be tapped, and fix answers must exist on the question's procedures or the area's waypoints.
- `generate` items require `count >= 1`, valid airport IDs, and one successful trial draw with a fixed seed (`seeded(0)`) at sea-level terrain; otherwise validation reports `"nothing to ask with these filters"`.

```ts
import { validateQuiz } from "skycake";
const problems = await validateQuiz(quiz, data, files, "phoenix", charts);
```

## SkyCake Viewer

`app/` is SkyCake Viewer, a free standalone web app around `mount()`, hosted at [skycake.app](https://skycake.app). Users can install it directly from the browser (`manifest.webmanifest`) and save areas for offline use.

### Pages and URL parameters

- **Start screen (`index.html`):** Lists all 16 areas as cards with chart previews, current-through dates, an Open link, and Save / Update / Remove offline buttons. Also includes a link to an interactive tutorial (`?tutorial=1`, which runs on Phoenix), an accessibility mode switch (sharing `skycake-a11y`), and links to `help.html`, `accessibility.html`, `privacy.html`, and `terms.html`.
- **Direct area links:** `?area=phoenix` opens an area full screen. Adding `&scene={...}` sets the initial scene.
- **Showcase (`demo.html`):** Screenshots from `app/shots/` linking to specific scenes (`skycake.app/demo`). Screenshots stay out of the offline cache and load online only.
- **User guide (`help.html`):** Instructions for desktop and phone controls, walkthroughs, quizzes, and accessibility mode (`skycake.app/help`). Cached in the offline shell.
- On-screen copy in `app/main.ts`, `demo.html`, and `help.html` is currently draft copy.

### Building and offline caching

```sh
npm run app && npm run demo
```

Then open `http://localhost:5179/www/`.

`npm run app` (`scripts/app.mjs`) bundles `app/main.ts` and `three.js` with esbuild into `www/`. It copies `style.css`, `data/`, and the app icons, and generates four contour SVGs (`scripts/contours.mjs`). It then writes `www/data/manifest.json` (edition, current-through date, SHA-256 revision hash, file list, and byte size per area) and builds `www/sw.js`. `www/` is git-ignored and excluded from `package.json` `files`, so sites installing `skycake` never download it.

- **Service worker (`sw.js`):** Caches the app shell on first load and serves shell files network-first, with a fallback to the cache after 2 seconds or when offline. Saved areas are stored in separate per-area, per-revision caches in Cache Storage and served cache-first. An area counts as saved only after all of its files finish downloading and its marker is written. `Update` fetches fresh copies with `cache: "reload"`.
- **Current-through date:** Computed as the last day of the area's 28-day procedure cycle (falling back to the chart edition if `cycle` is absent).
- **Privacy and headers:** SkyCake Viewer sets no cookies of its own, runs no analytics, and loads nothing from third-party origins. Leave Cloudflare Web Analytics and Bot Fight Mode (which sets a `__cf_bm` cookie) turned off so `privacy.html` remains accurate. While the pre-launch Cloudflare Access gate is enabled, `privacy.html` documents its sign-in cookie and that paragraph comes off when the site opens publicly. `app/_headers` sets strict CSP (`script-src 'self'`, `style-src 'self'`, no inline scripts or styles) and framing headers (`X-Frame-Options: DENY`, `frame-ancestors 'none'`).

### Hosting on Cloudflare Pages

SkyCake Viewer deploys to the `skycake-site` Cloudflare Pages project via direct upload (not connected to Git) on Cloudflare's free tier.

- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs automatically after `CI` passes on a push to `main` (including merged data cycle PRs), and supports manual dispatch on `main`.
- A `build` job runs with no secrets. It checks that `HEAD` is the newest commit on `main` so an old CI re-run cannot roll the site back. It then runs `npm run app` and uploads `www/` as an artifact.
- A `deploy` job in the `production` environment (restricted to `main`) installs `wrangler` from `.github/deploy/` and uploads `www/` using secret `CLOUDFLARE_API_TOKEN` (Account > Cloudflare Pages > Edit) and repository variable `CLOUDFLARE_ACCOUNT_ID`.
- Manual deploy from a local machine:

```sh
npm run app
npx wrangler pages deploy www --project-name skycake-site --branch main
```

- Only `demo.html`'s Open Graph tags (`og:image`, `og:url`) reference `skycake.app`. Hosting under another domain requires changing only those tags.
- For the `skycake.app` custom domain: open the Pages project, go to Custom domains > Set up a custom domain, enter `skycake.app`, and activate it. An apex domain must be a zone on the same Cloudflare account (automatic if registered through Cloudflare; otherwise add the domain on the Free plan and point its nameservers to Cloudflare first). `.app` requires HTTPS, which Pages provisions automatically. Add `www.skycake.app` the same way if needed.

## Data updates

`npm run data` (`scripts/build-area.ts`) rebuilds `data/` from public-domain FAA and USGS sources: VFR sectionals and TACs, IFR area and low enroute charts, ADDS airspace, CIFP procedures and airways, d-TPP airport diagrams and procedure charts, and USGS 3DEP terrain. Full source list and notes: [NOTICE.md](NOTICE.md).

FAA charts update every 56 days and procedures update every 28 days. Each `area.json` records its chart `edition` and procedure `cycle`.

Useful flags:

```sh
npm run data -- miami          # build one area (see AREAS in scripts/build-area.ts)
npm run data -- 2026-10-29     # build for a specific effective date
npm run data -- --cycle        # print the active 28-day cycle date without building
npm run data -- --no-chart     # skip raster chart builds
npm run data -- --terrain-only # rebuild terrain only
```

Airports with an approach that leaves the area's bounds are omitted and named in the build log.

### Procedure charts (d-TPP)

Procedure charts come from the same d-TPP cycle as the airport diagrams: every approach, departure (including graphic obstacle departures), and arrival chart for the area's airports, including continuation pages.

- Each page is rendered at 200 dpi to an 8-shade greyscale PNG (about 90 KB), rotated upright if printed sideways, and stored once in `charts/` under its d-TPP filename even when shared by multiple airports.
- `charts/<airport>.json` lists the airport's charts in d-TPP order with `name`, `kind` (`IAP`, `DP`, or `STR`), `pages`, and matched `procedures`, and sets `plates: true` in `area.json`.
- Approaches match by type and runway (`ILS RWY 07R` and `LOC RWY 07R` both open `ILS OR LOC RWY 07R`). Departures and arrivals match by the computer code printed on the first page (`(BXK4.BXK)` opens `BXK4`). Unmatched charts (such as departures without a printed computer code) remain listed and can be opened directly.
- The build log prints `charts with no procedure`, `procedures with no chart`, and total page count and size (for cycle 2611: Phoenix has 196 pages / 16.4 MB; Miami has 333 pages / 27.2 MB).

### Automated data cycle workflow

[`.github/workflows/data.yml`](.github/workflows/data.yml) runs daily at 10:30 UTC (cycles take effect at 0901Z) and can also be started manually from the Actions tab.

- When a new 28-day cycle is in effect and no `data/<cycle>` branch exists yet, a `build` job with a read-only token runs `npm run data`, verifies that no file exceeds 24 MiB, and uploads `data/` and `data.log`.
- A second `open-pr` job with write permissions copies only `data/` and `data.log`, pushes `data/<cycle>`, opens a PR summarizing omitted airports/diagrams and unmatched charts/procedures, and triggers `ci.yml` on the branch via `workflow_dispatch` (because PRs opened by a workflow token do not automatically start other workflows).
- Merging the PR updates `main` and triggers SkyCake Viewer deployment once CI passes. Saved offline areas in the app then offer `Update`. The app switches to new data when the PR is merged, on or after the effective date.
- Required repository setting: Settings > Actions > General > Workflow permissions > tick "Allow GitHub Actions to create and approve pull requests". Without this, the branch is pushed without opening a PR.

## Building and CI

### Local development

Requires Node 22 or newer.

```sh
npm install
npm test
npm run typecheck
npm run build   # writes dist/, committed so sites can install directly from GitHub
npm run demo    # http://localhost:5179/demo/ (also serves /www/ after npm run app)
```

Demo query parameters: `?scene={...}`, `?walkthrough=class-b`, `?quiz=class-b`, `?quiz=vfr`, `?quiz=ifr`, `?quiz=practice`. Open `/demo/all.html` for links to every mode and quiz type.

Historical design notes live under `docs/superpowers/specs/`. The code and this README are the current reference.

### CI workflow

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs one job (`build-and-test`) on every pull request to `main`, push to `main`, and `workflow_dispatch`. It runs on a standard GitHub-hosted Ubuntu runner with Node 22, a read-only token, and no secrets. New pushes to a PR cancel older runs for that PR. There are no path filters so required checks always report.

Steps:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. Deletes `dist/`, runs `npm run build`, and fails if `dist/` differs from what is committed
5. Fails if any file in `data/` is over 24 MiB
6. Runs `npm run app` and checks key files in `www/`
7. Installs the commit from git in a temporary directory and checks `mount`, `style.css`, `three`, and `data/phoenix`

Not covered by CI:

- Linting (no linter is configured; strict `tsc` is the static check)
- Real browsers or touch devices (`viewer.ts`, `ui.ts`, `freeroam.ts`, touch gestures)
- `npm run data` (downloads from FAA and USGS; CI only checks committed data presence and file sizes)
- Node versions other than 22
- Downstream site builds in private repositories

Fork PRs run on `pull_request` with no secrets, and first-time contributors require maintainer approval to run workflows. External review apps (Cursor Bugbot, Codex) are independent of CI and should stay out of required checks so a skipped review cannot block a merge.

All GitHub Actions in `.github/workflows/` are pinned to full commit SHAs. [`.github/dependabot.yml`](.github/dependabot.yml) opens monthly PRs to update those action pins and `.github/deploy/` (`wrangler`). npm security updates are enabled in repository settings.

To enforce `build-and-test` as a required check while allowing admins to push directly to `main`:

```sh
gh api -X PUT repos/Tehcnological/skycake/branches/main/protection --input - <<'EOF'
{"required_status_checks":{"strict":false,"contexts":["build-and-test"]},"enforce_admins":false,"required_pull_request_reviews":null,"restrictions":null}
EOF
```

## License

AGPL-3.0-only ([LICENSE](LICENSE)). Copyright Christopher DeFoe. If you build `skycake` into your own site or product, the AGPL requires you to publish that source code under the same license.

See [CONTRIBUTING.md](CONTRIBUTING.md) before sending changes, [SECURITY.md](SECURITY.md) to report a vulnerability, [NOTICE.md](NOTICE.md) for data and model credits, and [CHANGELOG.md](CHANGELOG.md) for release history.
