# skycake

Interactive 3D airspace and instrument procedures over real FAA charts, with terrain and airport diagrams. Free roam, guided walkthroughs and a quiz engine for teaching airspace and IFR. **Not for navigation.**

Named for the upside-down wedding cake every student pilot learns Class B as.

Today it is the free-roam view: the Phoenix TAC over USGS terrain, every airspace type raised in the chart's own colors, approaches, departures and arrivals for every airport on the chart, and FAA airport diagrams laid over the field. Walkthroughs and quizzes come next; their content lives on the sites that use skycake, not here.

## Use it on a site

```sh
npm install github:Tehcnological/skycake three@0.180.0
```

1. Serve an area's data folder: copy `node_modules/skycake/data/phoenix/` into the site's public files (about 4 MB), for example at `/skycake/phoenix/`.
2. Load `skycake/style.css`.
3. Mount it:

```ts
import { mount } from "skycake";

mount(document.querySelector("#airspace")!, {
  base: "/skycake/phoenix/",
  types: ["B"],            // raised at first (default Class B)
  airport: "KPHX",         // picked at first
  approach: "ILS RWY 25L", // shown at first
  labels: { tags: "Tags" }, // any on-screen words to replace
});
```

three.js and the chart load only when the view scrolls into sight. Colors and fonts follow the `--sc-*` variables in `style.css`, which fall back to the host site's own tokens.

## Data

`npm run data` rebuilds `data/phoenix/` from public domain sources: the FAA TAC, ADDS airspace, CIFP procedures, d-TPP airport diagrams, and USGS 3DEP terrain. Charts change every 56 days and procedures every 28; rerun it then and commit the result. `npm run data -- --no-chart` skips the chart, `--terrain-only` rebuilds just the terrain. Sources and their notes: [NOTICE.md](NOTICE.md).

## Develop

```sh
npm install
npm test
npm run typecheck
npm run build   # dist/, committed, so sites can install straight from GitHub
```

Design notes: [docs/superpowers/specs/2026-11-03-3d-airspace-design.md](docs/superpowers/specs/2026-11-03-3d-airspace-design.md).

## License

AGPL-3.0-only ([LICENSE](LICENSE)). Copyright Christopher DeFoe. If you build skycake into your own site or product, the AGPL asks you to publish that code too. See [CONTRIBUTING.md](CONTRIBUTING.md) before sending changes.
