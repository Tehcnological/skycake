# Accessibility mode

This document lists every change `skycake` makes in accessibility mode, for sites that embed it. The mode targets WCAG 2.2 AA. End users can read the short version in SkyCake Viewer's `accessibility.html` and the controls guide in `help.html`.

## Turning it on

- **A site with its own toggle** passes `mount(host, { a11y: true | false })`. `skycake` then hides its own toggle. To apply a change, reload the page: `mount` has no teardown, so mounting again leaves the old 3D view running.
- **A site that passes nothing** (including SkyCake Viewer) gets an accessibility toggle button in free roam (`aria-pressed`, named by the `a11y` label). It sits under the tool rail on desktop and in the header on phones. Pressing it switches the map in place and saves the choice per browser in `localStorage` under `skycake-a11y` (`"1"` is on). If storage is blocked, the mode starts off and changes last for the current page only.
- The mode sets `data-a11y` on the `.skycake` figure, and its CSS rules target that attribute. `A11Y_KEY`, `stored`, `store`, and `browserStorage` are exported for sites that read or write the same key.
- Even with accessibility mode off, `@media (prefers-contrast: more)` increases contrast and `prefers-reduced-motion` stops motion. In Windows contrast themes (`forced-colors: active`), switches keep their thumb and checked state, and selected or pressed controls keep an outline in system colors.

## Everywhere

| Change | WCAG 2.2 |
|---|---|
| Higher-contrast text and border defaults: `--sc-soft` `#dedede`, `--sc-muted` `#c0c0c0`, `--sc-dim` `#ababab`, `--sc-frame` `#8a8a8a`, `--sc-edge` `var(--sc-frame)`, and `--sc-accent` `#6aa6e8` (each uses the host site's matching token first if defined) | 1.4.3, 1.4.11 |
| Focus ring: 3 px in the text color with a dark halo, drawn inside the map's frame | 2.4.7 |
| Map tags increase to 13 px on opaque dark backgrounds (`#14171c`), fixes get solid borders, and airspace rims and ribs draw 1.5× wider | 1.4.3, 1.4.11 |
| No motion: camera moves jump and tooltips appear immediately (loading spinner slows to 3 s) | 2.2.2, 2.3.3 |
| Controls are at least 48 px (44 px with the mode off), most control text is at least 16 px, and the phone header (56 px) and tab bar (64 px) are taller | 2.5.8, 1.4.4 |
| Phone tabs always show full names (even with the mode off) and scroll horizontally when they do not fit | 1.4.10 |
| On/off settings use switches (`role="switch"`, `aria-checked`); single-choice groups use segmented buttons with `aria-pressed` | 4.1.2 |
| Touch taps allow looser movement (16 px of travel, no time limit) so unsteady taps still register | 2.5.1 |
| Airport tags leave the tab order; `In view` reaches them instead | 2.4.3 |
| Keyboard controls: arrow keys turn and tilt, `Shift` + arrows pan, and `+` / `-` zoom only while the map has focus, never as global single-key shortcuts (`aria-keyshortcuts` lists them) | 2.1.1, 2.1.4 |
| Toggle buttons expose `aria-pressed`; groups and inputs have accessible names | 4.1.2 |

## Free roam

| Change | WCAG 2.2 |
|---|---|
| Camera pad over the map (bottom left): arrows turn and tilt, `+` and `-` zoom, and `Pan` switches the arrows to move the map. On phones it folds behind a `Camera` button (`aria-expanded`) | 2.5.1, 2.5.7 |
| `In view` (a pill under `Airspace` on desktop, a tab on phones) lists visible items with numbers matching white badges on the map. Focusing an entry outlines it; picking an area toggles its 3D volume; picking an airport opens its procedures. `Escape` closes the list and returns focus | 2.1.1, 2.5.7, 2.4.3 |
| The procedure plate panel's divider is a `separator` with `aria-valuenow` from 25 to 75 (the plate's share). Arrow keys move it in steps of 5, and `Map`, `Plate`, `Split`, and `Close` are buttons so dragging is never required | 2.1.1, 2.5.7 |
| Inside the procedure plate panel, focused charts pan with arrow keys and zoom with `+` and `-` (`aria-keyshortcuts` lists them). Accessibility mode adds `Zoom in`, `Zoom out`, and `Fit` buttons, and double-click or double-tap fits the page. The chart region and image use the chart's name, and page arrows name the target page. `Escape` closes the panel only from inside it, and not from the chart picker | 2.1.1, 2.1.4, 2.5.1, 4.1.2 |
| A text summary of the active scene (chart, active areas, procedures) serves as the map's screen reader description | 1.1.1 |

## Walkthroughs

| Change | WCAG 2.2 |
|---|---|
| Playback pauses at the end of every step; pressing `Play` continues | 2.2.1, 2.2.2 |
| Quick checks require selecting an answer and then pressing `Check` | 3.2.2 |

## Quizzes

| Change | WCAG 2.2 |
|---|---|
| Multiple-choice questions require choosing an option and then pressing `Check` (full width below the choices). Nothing scores until `Check` is pressed | 3.2.2 |
| `find` questions show numbered map badges, a grid of matching number buttons, and a number input field, then `Check` | 2.1.1, 2.5.7 |
| `Skip` appears on `find` questions before the first answer; skipping moves on and reduces the quiz total by 1 | 2.1.1 |
| After a wrong first answer, the card announces `Try again` and any hint through the live region. The wrong choice is disabled and struck out with a cross (never color alone), and focus moves to the first remaining choice or the number field | 4.1.3, 1.4.1, 2.4.3 |
| Plate questions keep their choice buttons visible so they can be answered without tapping the chart image | 2.1.1, 2.5.7 |
| The height scale toggle and `Back to quiz` are standard buttons; the height button's accessible label states the current scale | 2.1.1, 4.1.2 |
| The camera pad works as in free roam. It sits inside the map container, so `Tab` reaches it with the map before the top bar controls and question card | 2.5.1, 2.5.7, 2.4.3 |
| No time limit: `ms` is reported to `onResult` but never enforced | 2.2.1 |

## What a site must do

- Pass `a11y` from your site's own toggle if you have one, so the site and the map never disagree.
- Never turn `onResult`'s `ms` value into a time limit or score penalty.
- Count a question right only when `onResult` reports `right: true`. It fires on the first answer only; a correct second try is not reported again.
- Treat a result with `skipped: true` as not asked. It is not wrong, and the end summary's `total` already excludes skipped questions. A quiz where every question is skipped ends with `total: 0`, so guard against dividing by zero.
- Keep your site's own focus ring and contrast at least as strong around the map.
