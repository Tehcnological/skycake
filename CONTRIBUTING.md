# Contributing

Issues are welcome. Pull requests are welcome too, with one condition on copyright below.

## Copyright

skycake is published under the AGPL-3.0, and Christopher DeFoe keeps sole copyright so he can use it on his own sites and in app stores under other terms.

That means outside pull requests can only be accepted from authors who first assign the copyright in their change to Christopher DeFoe. Without that, please open an issue describing the change instead of a pull request.

## Before you start

- Bugs and feature requests: open an issue with the template. For airspace or a procedure drawn wrong, say which area, airport or procedure, and what the FAA chart shows.
- Security problems: see [SECURITY.md](SECURITY.md). Do not open a public issue.
- Larger changes: open an issue first, so we can agree on the approach before you write it.

## Making a change

Needs Node 22 or newer.

```sh
npm install
npm run typecheck
npm test
npm run build   # dist/, committed
npm run app     # SkyCake Viewer into www/, not committed
npm run demo    # http://localhost:5179/demo/, and /www/ after npm run app
```

- Commit `dist/` with every change to `src/`. Sites install skycake straight from GitHub without building, and CI fails if `dist/` is stale. Do not add a `prepare` script.
- Data: public domain FAA and USGS sources only, built by `scripts/build-area.ts`. Never copy code, shaders, assets, data or text from other airspace products, never scrape, never spoof a User-Agent. Each data file stays well under 25 MiB.
- `data/` is rebuilt every 28 days by the Data cycle workflow; don't hand-edit it.
- On-screen words are short, and sites can replace any of them through `labels`. Free roam's are real defaults; walkthrough and quiz words default to "Placeholder: ...", since the sites write them.
- Add or update a test in `src/*.test.ts` for logic that can run outside a browser (scenes, search, procedures, gestures).
- If you change the public API (`mount`, `Options`, `Labels`, `Scene` or exports), update the README.
- Never use Garmin or G1000 names.

## Pull requests

One change per pull request, against `main`. CI (`build-and-test`) must pass; a first-time contributor's run starts after a maintainer approves it. The PR template lists the checks.

## Code of Conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
