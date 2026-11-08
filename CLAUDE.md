# CLAUDE.md (skycake)

Standing instructions for Claude Code in this repo.

## Project

3D airspace and instrument procedures over FAA charts, embedded by Chris DeFoe's sites (first instrumentready.com, repo `Tehcnological/instrumentready.com`). Modes: free roam (built), walkthroughs and quizzes (next). The engine lives here, public; Chris's walkthroughs and quiz questions stay private on the sites. Source of truth: Projects HQ in Notion, project row "skycake".

Also its own app, SkyCake Viewer (`app/`, `npm run app`, hosted at skycake.app on Cloudflare Pages), and new FAA data every 28 days from `.github/workflows/data.yml`. Design, decisions and the F-Droid and iOS plan: `docs/superpowers/specs/2026-11-07-skycake-viewer-design.md`.

## Hard constraints

- TypeScript. AGPL-3.0-only. Chris keeps sole copyright: no outside code without a copyright assignment.
- Public domain FAA and USGS data only. Never copy code, shaders, assets, data or text from other airspace products (AviatorPro ProTools was studied as inspiration only), never scrape, never spoof a User-Agent.
- Sites run on Cloudflare's free tier: keep each data file well under 25 MiB and the whole area small.
- No secrets in the repo.
- Not for navigation, said on screen.
- Don't break the install path: `dist/` and `data/` stay committed, `www/` is never committed or in `files`, no `prepare` script.
- The accent is blue by default. Keep `var(--red, ...)` in `style.css`: it is how instrumentready.com stays red.
- Nothing that bills without Chris's say: free tiers, no R2 unless he agrees.

## How Chris works

- Concise and direct. Never use em dashes, in chat or in files.
- Chris writes on-screen copy; labels here are placeholders and every one can be overridden through `labels`.
- Keep on-screen text to the minimum. Neighbouring controls match in height and style. No Garmin or G1000 names.
- Get a visual direction from Chris before building new design.

## Commands

```sh
npm install
npm test
npm run typecheck
npm run build          # commit dist/ with the change
npm run data           # the Data cycle workflow does this every 28 days and opens a PR
npm run app            # SkyCake Viewer into www/ (not committed)
```

GitHub Actions runs on every PR and every push to main, on standard hosted runners, free because this repo is public. Use it. It fails if `dist/` is stale. See "CI" in README.md.

Commit as `git -c user.name="Chris DeFoe" -c user.email="chris@defoe.me"`. Headless Chromium will not lay out narrower than 500 px; check phones with real device emulation.
