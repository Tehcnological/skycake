# skycake

Interactive 3D airspace and instrument procedures over real FAA charts, with terrain and airport diagrams. Free roam, guided walkthroughs and a quiz engine for teaching airspace and IFR. **Not for navigation.**

Named for the upside-down wedding cake every student pilot learns Class B as.

Today it is the free-roam view of two areas, Phoenix to Tucson and Key West to Palm Beach: the area's TAC (or, by a button, its sectional; the sectional always outside the TAC's map area) over USGS terrain with every airspace type raised in the chart's own colors, approaches, departures and arrivals for every airport on the chart (several at once, from one search box), and FAA airport diagrams laid over the field. On desktop the controls float over the view; on phones a tab bar sits under it. Walkthroughs and quizzes come next; their content lives on the sites that use skycake, not here.

## Use it on a site

```sh
npm install github:Tehcnological/skycake three@0.180.0
```

1. Serve an area's data folder: copy `node_modules/skycake/data/phoenix/` or `data/miami/` into the site's public files (about 8 MB each), for example at `/skycake/phoenix/`.
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

`types` and `approach` still work as shorthand for a first scene. Area ids are in `data/phoenix/area.json`. three.js and the chart load only when the view scrolls into sight. Colors and fonts follow the `--sc-*` variables in `style.css`, which fall back to the host site's own tokens.

## Data

`npm run data` rebuilds each area under `data/` from public domain sources: the FAA TAC and sectional, ADDS airspace, CIFP procedures, d-TPP airport diagrams, and USGS 3DEP terrain. Charts change every 56 days and procedures every 28; rerun it then and commit the result. `npm run data -- miami` builds one area, `--no-chart` skips the charts, `--terrain-only` rebuilds just the terrain. An airport with an approach that leaves its area's bounds is left out and named in the log. Sources and their notes: [NOTICE.md](NOTICE.md).

## Develop

```sh
npm install
npm test
npm run typecheck
npm run build   # dist/, committed, so sites can install straight from GitHub
npm run demo    # http://localhost:5179/demo/ with the built dist/ and data; ?scene={...} to try a scene
```

Design notes: [docs/superpowers/specs/2026-11-03-3d-airspace-design.md](docs/superpowers/specs/2026-11-03-3d-airspace-design.md).

## License

AGPL-3.0-only ([LICENSE](LICENSE)). Copyright Christopher DeFoe. If you build skycake into your own site or product, the AGPL asks you to publish that code too. See [CONTRIBUTING.md](CONTRIBUTING.md) before sending changes.
