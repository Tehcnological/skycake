# CLAUDE.md (skycake)

Standing instructions for Claude Code in this repo.

## Project

3D airspace and instrument procedures over FAA charts, embedded by Chris DeFoe's sites (first instrumentready.com, repo `Tehcnological/instrumentready.com`). Modes, all built: free roam, walkthroughs, and quizzes (written, generated from the FAA data, and endless practice), plus accessibility mode across all three (`docs/accessibility.md`). The engine lives here, public; Chris's walkthroughs, question banks and their wording stay private on the sites. Source of truth: Projects HQ in Notion, project row "skycake".

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
- Chris writes on-screen copy. Free roam's labels are real defaults; walkthrough and quiz labels default to "Placeholder: ..." because the sites supply them. Every one can be overridden through `labels`. SkyCake Viewer's words (`app/main.ts`, the `app/*.html` pages) are drafts until Chris rewrites them.
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
npm run demo           # http://localhost:5179/demo/ (and /www/ after npm run app)
```

GitHub Actions runs on every PR to main and every push to main, on standard hosted runners, free because this repo is public. Use it. It fails if `dist/` is stale, and main requires its `build-and-test` check. See "CI" in README.md.

Commit as `git -c user.name="Chris DeFoe" -c user.email="chris@defoe.me"`. Headless Chromium will not lay out narrower than 500 px; check phones with real device emulation.
