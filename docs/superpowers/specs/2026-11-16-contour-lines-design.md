# Contour lines on the start screen: design

Status: approved by Chris, 2026-11-16. Spec only, no code. No on-screen words are added.

## Why

Chris, 2026-11-16, asked for a texture on SkyCake Viewer's UI so it is "not flat". Six throwaway samples took it from dither to this, in his words: "i like the contour lines actually, lets just make them straight up lines instead of dots, with some animation", and of the two motions shown he chose "1, ripple". Earlier samples set the limits: "still too much", "dont apply it to buttons", and not over the map.

Success: the start screen shows faint map contour lines that slowly ripple, nobody finds them busy, and no control or text is harder to read.

## Goals

- Faint solid contour lines, one pixel wide, at the top right of the start screen's column and in the top right corner of each area card.
- Ripple: each of the seven heights brightens in turn (opacity .4 to 1), one pass every 10 seconds.
- The same picture on every build.

## Not in this change

- The map and everything in the library (`style.css`, `src/`, `dist/`). The map's panels stay plain, so nothing changes on instrumentready.com.
- The help, privacy and accessibility pages: lines behind running text would hurt reading.
- Any setting or switch for the lines.

## Would make it a failure

- Lines behind a button, a switch or its label.
- Motion under the reduced-motion setting or in accessibility mode.
- Lines strong enough to compete with the text or the cards.

## Constraints

- Free and offline: the pictures are part of the app's shell, so they must be top-level files in `www/` (the service worker caches only those).
- No new dependency.
- A picture used as a CSS background cannot read the page's colour variables, so the two line colours are written into the generator, next to a note naming the tokens they sit between (`--canvas`/`--divider` for the page, `--surface`/`--divider` for a card). Text over the strongest line keeps about 10:1.

## Approaches

1. **Pictures made at build time, used as CSS backgrounds (chosen).** `scripts/app.mjs` already makes the icons this way. Least code, and it is what the samples did. Its one risk was whether Safari animates a picture used as a background: Chris opened a test file on his phone on 2026-11-16 and both boxes moved.
2. **Lines drawn into the page as elements.** Works everywhere and follows the colour variables, but more code and an extra element behind every card. Not needed now that approach 1 moves on his phone.
3. **Pictures drawn once and committed.** Same result as 1, with about 90 KB of generated files in the repo that go stale when the look changes.

## Design

- **Generator:** a new `scripts/contours.mjs`, about 60 lines, taken from the sample's generator with the second motion removed. A smooth field (five fixed-seed sine waves), the lines where it crosses seven heights (marching squares on a 3px grid, pieces joined into lines), drawn 1px wide with a radial fade from the top right corner so the lines die out before the picture's edges. It exports one function that returns the SVG text for a surface, moving or still. It checks itself: more than three lines, and every point inside the picture.
- **Build:** `scripts/app.mjs` writes four files into `www/`: `contours-page.svg`, `contours-page-still.svg`, `contours-card.svg`, `contours-card-still.svg` (about 37 KB, 37 KB, 9 KB, 9 KB before compression), and asserts they are in the shell list.
- **Styles, `app/app.css`:** `#app .areas` (the start screen only; the other pages use `main.areas`) gets the page picture, top right, 480 by 360 px, no repeat. `#app .areas li` gets the card picture, top right, 200 by 90 px. The moving files are used only inside `@media (prefers-reduced-motion: no-preference)` and only when `:root` has no `data-a11y`; otherwise the still files (opacity .65).
- **My calls, not Chris's words:**
  - The card's fade radius is 68 px, not the sample's 85, so the lines end above the button row (it starts 70 px down). The patch is slightly smaller than in the sample.
  - With `prefers-contrast: more` or `forced-colors: active` there are no lines at all.
  - On a wide screen the page picture sits at the top right of the 480 px column, not of the window.

## Left to the builder

- Checking by screenshot at 375 px and at desktop width that no line shows behind a button, in both normal and accessibility mode (larger text moves the button row down, which is the safe direction).
- Whether the files compress well enough as they are or the grid should be coarsened.

## Not checked

Battery cost of the animation on a phone; Firefox; the installed (home screen) app.
