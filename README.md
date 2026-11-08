# skycake

Interactive 3D airspace and instrument procedures over real FAA charts, with terrain and airport diagrams. Free roam, guided walkthroughs and a quiz engine for teaching airspace and IFR. **Not for navigation.**

Named for the upside-down wedding cake every student pilot learns Class B as.

Today it is the free-roam view of two areas, Phoenix to Tucson and Key West to Palm Beach: the area's charts, picked by a VFR or IFR button and a map button (VFR: TAC or sectional, the sectional outside the TAC's map; IFR: area chart or low, the low outside the area chart's), over USGS terrain with every airspace type raised in the chart's own colors (in IFR only special use, plus low altitude airways at their MEA and the fixes on them), approaches, departures and arrivals for every airport on the chart (several at once, from one search box), and FAA airport diagrams laid over the field. On desktop the controls float over the view. On phones the map in the page opens full screen with a tap, with a tab bar under it; there one finger moves the map, a pinch zooms, a twist turns and two fingers up or down tilt. Walkthroughs and quizzes come next; their content lives on the sites that use skycake, not here.

It is also its own app, SkyCake Viewer, a free web app for skycake.app with offline areas: see [below](#skycake-viewer-the-app).

## Use it on a site

```sh
npm install github:Tehcnological/skycake three@0.180.0
```

1. Serve an area's data folder: copy `node_modules/skycake/data/phoenix/` or `data/miami/` into the site's public files (about 12 MB each), for example at `/skycake/phoenix/`.
2. Load `skycake/style.css`.
3. Mount it:

```ts
import { mount } from "skycake";

mount(document.querySelector("#airspace")!, {
  base: "/skycake/phoenix/",
  // The first scene. Default: every airspace type raised, the whole chart in view.
  scene: {
    raise: ["B", { area: "d-chandler-municipal-airport-class-d" }],
    procedures: [{ airport: "KPHX", name: "EAGUL6" }, { airport: "KPHX", name: "ILS RWY 25L" }],
    camera: "fit",          // or "top", { frame: [...] }, or a placed camera
  },
  airport: "KPHX",          // current at first, for the search box and diagram
  labels: { tags: "Tags" }, // any on-screen words to replace
});
```

`types` and `approach` still work as shorthand for a first scene. `close: () => ...` is for a standalone app: the view fills the window from the start, and its close button calls the function. Area ids are in `data/phoenix/area.json`. three.js and the chart load only when the view scrolls into sight. Colors and fonts follow the `--sc-*` variables in `style.css`, which fall back to the host site's own tokens. The accent is blue unless the site sets `--sc-accent` and `--sc-accent-bg`, or `--red` and `--redbg` (instrumentready.com does, so it stays red).

### Walkthroughs

`mode` gives the view one job: `"explore"` (free roam, the default) or a walkthrough that plays like a video. It starts paused on step 1 with a play button over the view; each step runs for `seconds` (default 4 + 0.06 per caption character, rounded up), dragging the view pauses, and a quick check pauses until it is answered (not scored). Explore leaves into free roam from the scene on screen; `next`, when given, is a link at the end.

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

A step's `scene` takes everything a first scene does, plus `highlight`, `airplane` and `draw`. A name the data no longer has leaves that part out of the step, with a warning in the console. `demo/class-b.json` is a sample (`npm run demo`, then `/demo/?walkthrough=class-b`).

#### Validating walkthroughs

`validateWalkthrough` runs in Node with no DOM and returns problems as `"<id> step <n>: <problem>"` (empty when fine). It checks the area, every name a scene or check uses (area, airport, procedure, fix, diagram), step captions and `seconds`, and each check's prompt, choices (2 to 4, distinct), answer and tolerance. Unknown fields are ignored. `area` is the folder name the site loaded.

```ts
import { readFileSync } from "node:fs";
import { validateWalkthrough } from "skycake";

const data = JSON.parse(readFileSync("data/phoenix/area.json", "utf8"));
const files = async (airport) => JSON.parse(readFileSync(`data/phoenix/procedures/${airport}.json`, "utf8"));
const problems = await validateWalkthrough(walkthrough, data, files, "phoenix");
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
```

## Data

`npm run data` rebuilds each area under `data/` from public domain sources: the FAA TAC, sectional, IFR area chart and IFR low, ADDS airspace, CIFP procedures and airways, d-TPP airport diagrams, and USGS 3DEP terrain. Charts change every 56 days and procedures every 28; the Data cycle workflow below reruns it then. `npm run data -- miami` builds one area, `--cycle` prints the 28-day cycle in effect and builds nothing, `--no-chart` skips the charts, `--terrain-only` rebuilds just the terrain. An airport with an approach that leaves its area's bounds is left out and named in the log. Sources and their notes: [NOTICE.md](NOTICE.md). Each `area.json` records its chart `edition` and its procedure `cycle`.

### Data cycle workflow

[`.github/workflows/data.yml`](.github/workflows/data.yml) runs daily at 10:30 UTC (cycles take effect at 0901Z) and can be started by hand under Actions. When a new 28-day cycle is in effect and no `data/<cycle>` branch exists yet, it runs `npm run data`, checks file sizes, pushes `data/<cycle>` and opens a PR whose body lists airports and diagrams the build left out. A PR opened with a workflow's token starts no workflows, so it starts `build-and-test` on the branch itself (`ci.yml` takes `workflow_dispatch` for this). Merge the PR to ship the data: sites get it from git, SkyCake Viewer from Cloudflare's rebuild of main. Saved areas in the app then offer Update. It uses no secrets and only free hosted runners.

It needs one repo setting: Settings, Actions, General, Workflow permissions, tick "Allow GitHub Actions to create and approve pull requests". Without it the PR step fails, and the branch is pushed with no PR.

The app switches to new data when the PR is merged, on or after the effective date, not ahead of it.

## Develop

```sh
npm install
npm test
npm run typecheck
npm run build   # dist/, committed, so sites can install straight from GitHub
npm run demo    # http://localhost:5179/demo/ with the built dist/ and data; ?scene={...} to try a scene, ?walkthrough=class-b to play one
```

Design notes: [the 3D view](docs/superpowers/specs/2026-11-03-3d-airspace-design.md), [its controls](docs/superpowers/specs/2026-11-04-skycake-ux-design.md) and [SkyCake Viewer](docs/superpowers/specs/2026-11-07-skycake-viewer-design.md), with the plan for F-Droid and iOS.

## SkyCake Viewer (the app)

`app/` is a standalone web app around `mount()`: a start screen lists the areas, each with a button that saves it for offline use and the date its data is current through, and `?area=phoenix` opens one full screen (`&scene={...}` sets a first scene, as in the demo). On-screen words in `app/main.ts` are placeholders.

`npm run app` bundles it with three.js (esbuild) into `www/`, with the library's `style.css`, a copy of `data/`, `data/manifest.json` (per area: edition, current-through date, a revision hash of its files, files and size) and a service worker. The service worker caches the app itself on first load; saved areas go in their own caches, one per area and revision, and count as saved only once every file arrived. Update fetches past the service worker. To try it: `npm run app && npm run demo`, then http://localhost:5179/www/.

`www/` is ignored by git and is not in `files`, so sites that install skycake never get it, and nothing here builds on install.

The current-through date is the last day of the area's procedure cycle. Data built before `cycle` was recorded falls back to the chart edition, the earliest cycle it can be from.

The start screen links to `privacy.html`. The app sets no cookies, stores nothing about anyone and loads nothing from other sites. Saved areas stay on the device, in Cache Storage. Two Cloudflare settings would make the notice untrue, so leave them off: Web Analytics on the Pages project, and Bot Fight Mode on the skycake.app zone, which sets a `__cf_bm` cookie.

### Hosting on Cloudflare Pages

Free, no payment method needed. In the Cloudflare dashboard: Workers & Pages, Create, Pages, Connect to Git, pick `Tehcnological/skycake`, then:

| Setting | Value |
| --- | --- |
| Project name | `skycake` (skycake.pages.dev is taken by an unrelated site, so Pages adds a suffix) |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run app` |
| Build output directory | `www` |
| Root directory | (blank) |
| Environment variable | `NODE_VERSION` = `22` |

Pages runs `npm ci` itself before the build command. Each PR also gets a preview URL. The app has no host name in its code, so a custom domain needs no change here.

### skycake.app

Once the Pages project is up: open it, Custom domains, Set up a custom domain, enter `skycake.app`, then Activate domain. An apex domain like this one has to be a zone on the same Cloudflare account:

- Bought through Cloudflare Registrar: it already is, and Cloudflare adds the DNS record itself.
- Bought elsewhere: first add it as a domain (`skycake.app`, Free plan) and change the nameservers at the registrar to the two Cloudflare gives you, then add the custom domain.

`.app` is HTTPS only for every browser, which Pages handles with its own certificate. Add `www.skycake.app` the same way if you want it too.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs one job, `build-and-test`, on every pull request to main and every push to main. It uses a standard GitHub-hosted runner, which is free for public repos, and no secrets. It stops at the first failure, which shows as a failed check on the PR with the step named:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. Deletes `dist/`, runs `npm run build` and fails if the result differs from what is committed
5. Fails if a file in `data/` is over 24 MiB
6. `npm run app`: builds SkyCake Viewer into `www/` (see below)
7. Installs the commit from git, as a site does, then imports `mount` and checks for `style.css`, `three` and `data/phoenix`

A new push to a PR cancels that PR's older run. There are no path filters on purpose: a required check whose workflow is filtered out never reports, and its PR waits forever.

The workflow token is read-only. Fork PRs run on `pull_request`, so they get no secrets, and first-time contributors need approval before they run. Cursor Bugbot and Codex are separate GitHub apps that CI neither touches nor depends on. Leave them out of required checks, so a skipped review can't block a merge.

Not covered:

- Linting: no linter is configured, so strict `tsc` is the only static check.
- A browser: `viewer.ts`, `ui.ts`, `freeroam.ts` and touch gestures on real devices are not exercised.
- `npm run data`: it downloads from the FAA and USGS, so only the committed data's size and presence are checked.
- Node versions other than 22, the `engines` floor.
- instrumentready.com's own build, which is in a private repo.

The actions are pinned to a major version (`@v7`), which picks up fixes on its own. Dependabot (`.github/dependabot.yml`) opens a monthly PR when a new major comes out; npm security updates are on in the repo settings.

A red check blocks merging only if branch protection requires it. These settings do that, and `enforce_admins: false` lets admins still push to main directly, in which case CI reports after the push:

```sh
gh api -X PUT repos/Tehcnological/skycake/branches/main/protection --input - <<'EOF'
{"required_status_checks":{"strict":false,"contexts":["build-and-test"]},"enforce_admins":false,"required_pull_request_reviews":null,"restrictions":null}
EOF
```

## License

AGPL-3.0-only ([LICENSE](LICENSE)). Copyright Christopher DeFoe. If you build skycake into your own site or product, the AGPL asks you to publish that code too. See [CONTRIBUTING.md](CONTRIBUTING.md) before sending changes, [SECURITY.md](SECURITY.md) to report a vulnerability, and [CHANGELOG.md](CHANGELOG.md) for what changed. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
