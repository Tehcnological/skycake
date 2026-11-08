# Security

## Supported versions

Only the latest commit on `main` is supported, and the SkyCake Viewer deployed from it at skycake.app. Fixes are not backported.

## Reporting a vulnerability

Do not open a public issue. Use [Report a vulnerability](https://github.com/Tehcnological/skycake/security/advisories/new) on the repo's Security tab, or email Chris DeFoe at chris@defoe.me. Include:

- what the problem is and where (file, function or input),
- how to reproduce it,
- what an attacker could do with it.

You will get a reply within 7 days. Once a fix is on `main`, you are credited in the commit unless you ask not to be.

## Scope

In scope:

- **The library.** It runs in the browser, loads an area's files from the `base` folder a site gives `mount()`, and puts text from the site (`labels`, scenes) and from the area data into the page. Problems in how that text or data reaches the page are in scope.
- **SkyCake Viewer** (`app/`). Its service worker caches the app and the areas a person saves; it reads `?area=` and `?scene=` from the URL. A way to make it load or cache something from another site, or run script from a URL, is in scope.
- **The workflows** in `.github/workflows/`. A way for a pull request or an issue to get a write token or push to the repo is in scope.

Out of scope: problems in a site that uses skycake (they belong to that site), and the accuracy of the FAA data. skycake is not for navigation.
