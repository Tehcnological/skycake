# Accessibility mode

Every change skycake makes in accessibility mode, for sites that embed it. The mode targets WCAG 2.2 AA. Students read the short version in SkyCake Viewer's `accessibility.html`, and how to use the map in `help.html`.

## Turning it on

- **A site with its own toggle** passes `mount(host, { a11y: true | false })` from that toggle. skycake then shows no toggle of its own. To follow a change, reload the page: `mount` has no teardown, so mounting again leaves the old 3D view running.
- **A site that passes nothing** (and SkyCake Viewer) gets a small button with the accessibility symbol in free roam (a toggle with `aria-pressed`, named by the `a11y` label): under the tool rail on desktop, in the header on a phone. Pressing it switches the map in place and keeps the choice per browser in `localStorage` under `skycake-a11y` (`"1"` is on). Blocked storage means off, and the choice lasts for the page only.
- The mode sets `data-a11y` on the `.skycake` figure; all its styles hang off that attribute. The helpers `A11Y_KEY`, `stored`, `store` and `browserStorage` are exported for a site that wants to read or write the same key.
- With the mode off, `@media (prefers-contrast: more)` still raises the colors, and `prefers-reduced-motion` still stops motion. In Windows contrast themes (`forced-colors`) switches keep their thumb and state, and selected or pressed controls an outline, in the theme's colors.

## Everywhere

| Change | WCAG 2.2 |
|---|---|
| Text and line colors raised: `--sc-soft` `#c5d0dc`, `--sc-muted` `#b4c1cf`, `--sc-dim` `#96a5b6`, `--sc-frame` `#7d8fa5`, accent `#6aa6e8` (each falls back to the site's own token) | 1.4.3, 1.4.11 |
| Focus ring: 3px in the text color with a dark halo, inside the map's frame | 2.4.7 |
| Map tags 13px on opaque backgrounds, fixes with solid borders; airspace rims and ribs 1.5 times wider | 1.4.3, 1.4.11 |
| No motion: camera moves jump, tooltips appear at once (the mode implies reduced motion) | 2.2.2, 2.3.3 |
| Every control at least 48px (44px with the mode off); text at least 16px in controls; a taller header (56px) and tab bar (64px) | 2.5.8, 1.4.4 |
| Phone tabs show their whole names, with the mode off too; when they don't fit, the tab bar scrolls sideways | 1.4.10 |
| On and off settings are switches (`role="switch"`, `aria-checked`), picks of one are segmented buttons with `aria-pressed` | 4.1.2 |
| Taps allow a looser touch (16px of travel, no time limit), so a shaky tap still counts | 2.5.1 |
| Airport tags leave the tab order; In view reaches them instead | 2.4.3 |
| Keyboard: arrows turn and tilt, Shift with arrows moves the map, plus and minus zoom; only while the map has focus, never as single-key shortcuts elsewhere (`aria-keyshortcuts` names them) | 2.1.1, 2.1.4 |
| Buttons say their state with `aria-pressed`; groups and fields have names | 4.1.2 |

## Free roam

| Change | WCAG 2.2 |
|---|---|
| Camera pad over the map, bottom left: arrows turn and tilt, plus and minus zoom, Pan makes the arrows move the map. On a phone it folds behind a Camera button (`aria-expanded`) so it covers less of the map | 2.5.1, 2.5.7 |
| In view (a pill under Airspace on desktop, a tab on a phone) lists what is on the map now, numbered, with the same number on a white badge on the map. Focusing an entry outlines its thing; picking an area raises or lowers it, picking an airport opens it. Escape closes it and returns focus | 2.1.1, 2.5.7, 2.4.3 |
| The procedure plate panel's divider is a `separator` with `aria-valuenow` (25 to 75, the plate's share): arrows move it by 5, and dragging is never the only way, since Full screen and Close are buttons | 2.1.1, 2.5.7 |
| The procedure chart in the plate panel: while the chart has focus, arrows move it and plus and minus zoom it (`aria-keyshortcuts` names them); the mode adds Zoom in, Zoom out and Fit buttons; a double tap or click fits the page. The chart's region and image are named by the chart, page arrows by the page they go to. Escape closes the panel only from inside it, and not from its chart picker | 2.1.1, 2.1.4, 2.5.1, 4.1.2 |
| A text summary of the scene (chart, raised areas, procedures) is the map's description for screen readers | 1.1.1 |

## Walkthroughs

| Change | WCAG 2.2 |
|---|---|
| Playback stops at the end of every step; Play goes on | 2.2.1, 2.2.2 |
| A quick check asks for a choice, then Check | 3.2.2 |

## Quizzes

| Change | WCAG 2.2 |
|---|---|
| Choices: choose, then Check (full width under the choices). Nothing is scored until Check | 3.2.2 |
| Find questions: the numbered picker shows numbers only (it still asks the student to find the thing on the chart), a number field takes the badge's number, then Check | 2.1.1, 2.5.7 |
| Skip on find questions: moves on, and the quiz's total drops by one | 2.1.1 |
| The camera pad, as in free roam. It sits inside the map, so Tab reaches it with the map, after the count and Explore | 2.5.1, 2.5.7, 2.4.3 |
| No time limit: `ms` is reported, never enforced | 2.2.1 |

The chart reading hunt, once built, uses the same picker and Skip.

## What a site must do

- Pass `a11y` from its own toggle, if it has one, so the two never disagree.
- Never turn `onResult`'s `ms` into a time limit or a score.
- Treat a result with `skipped: true` as not asked: it is not wrong, and the end result's total already leaves it out. A quiz with every question skipped ends with `total: 0`, so never divide by it unchecked.
- Keep the site's own focus ring and contrast at least this high around the map.
