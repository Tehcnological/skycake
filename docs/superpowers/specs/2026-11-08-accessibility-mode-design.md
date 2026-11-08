# Accessibility mode: design

Status: reviewed with Chris, 2026-11-08 (answers under "Settled with Chris"). Spec only, no code. Every on-screen word is a placeholder in `labels`; Chris writes the copy.

## Why

Chris, 2026-11-08: skycake gets an accessibility mode that "changes a lot of things", as instrumentready.com has one. The chart reading quiz spec (`2026-11-08-chart-reading-quiz-design.md`) already settled its own part: in the mode the symbol hunt shows a number on every symbol in view, is answered by the number, and has no countdown. This spec covers the rest: free roam, walkthroughs and the other quiz types.

Success: someone using only a keyboard, a screen reader, a switch or a phone with a tremor can do everything a mouse user can (or, where a question tests reading the chart with the eyes, can skip it), with no time pressure, no motion they did not ask for, and text and controls they can see. Every change is written down for sites and students (section 11).

## What instrumentready.com's mode does (to match)

- `src/lib/a11y.ts`: `A11Y_KEY = "ir-a11y"` in localStorage; an inline boot script sets `data-a11y` on `<html>` before first paint; `a11yOn()` reads it.
- `src/layouts/App.astro`: a round toggle in the top bar (a person icon, `aria-pressed`, "Accessibility mode"); a click flips the key and **reloads the page**. `:root[data-a11y]` raises `--soft #c5c8cc`, `--muted #b0b4b9`, `--dim #969ba1`, `--red #e5766b`, `--frame #767c83` (text at least 4.5:1, control borders at least 3:1). `prefers-contrast: more` applies the same tokens without the mode.
- `Search.astro`, `TopicBar.astro`: no single-key shortcuts (`/`, `j`, `k`, `d`); Ctrl/Cmd+K stays and is announced with `aria-keyshortcuts`.
- `progress.astro`: selects no longer save on change; an explicit Save button shows.
- `agree.astro`: no "scroll to the end first" gate.

The pattern: higher contrast, nothing happens on its own, nothing fires from a single key, nothing is gated on how you move.

## Turning it on

Two ways, and the host picks:

- **The host drives it: `mount` option `a11y?: boolean`.** When a site passes it, the site's own toggle is the only switch and skycake shows no row of its own. instrumentready.com passes `a11y: a11yOn()` from `Airspace3D.astro`; its toggle reloads the page, so a change reaches skycake through a fresh `mount`. No live update API (Chris: reload is enough).
- **skycake drives it: `a11y` left out.** Standalone (SkyCake Viewer, or a site with no toggle), skycake shows a labeled row, "Accessibility mode" with a switch, in its View controls (desktop: under the view buttons, bottom right; phone: at the foot of the View sheet). It is kept per browser as `skycake-a11y` in localStorage. SkyCake Viewer's start screen has the same labeled row (same key), and sets `data-a11y` on its `<html>` so `app.css` raises the start screen's contrast too.
- **Flipping the row mid-session rebuilds in place.** `mount` keeps the loaded area data; the row tears down the view and the mode's UI and builds them again with the new setting and the scene on screen. Free roam keeps its place (camera, raised areas, procedures, chart). A walkthrough resumes at its current step, paused. A quiz keeps its attempt and asks the current question again, unanswered; nothing extra is sent to `onResult`.
- **Inside skycake:** `mount` sets `data-a11y` on the `.skycake` figure (the same attribute name as instrumentready.com, scoped to the figure) and passes `a11y` on in `Context` and to `build()`.
- **System settings keep working alone:** `prefers-reduced-motion` (already read in `src/viewer.ts`) and `prefers-contrast: more` (new, the same tokens as the mode, as instrumentready.com does). Neither turns the whole mode on.

## What the mode changes

### 1. Contrast

- `style.css`: `.skycake[data-a11y]` (and `@media (prefers-contrast: more)`) sets `--sc-soft: var(--soft, #c5c8cc)`, `--sc-muted: var(--muted, #b0b4b9)`, `--sc-dim: var(--dim, #969ba1)`, `--sc-frame: var(--frame, #767c83)`, `--sc-accent: var(--red, #6aa6e8)`. Host tokens still win, so on instrumentready.com the figure takes the site's own raised tokens (and stays red); elsewhere it takes these. Measured on `--sc-panel` #1f2226: muted 4.59 to 7.66, dim 2.59 to 5.70, frame 1.50 to 3.79, accent 3.66 to 6.26.
- **Tags on the chart** (they keep their own colors, as today): text 13 px instead of 11 px, fully opaque backgrounds, `.fix` border solid white instead of 60%.
- **3D lines:** area rims and walls 2.4 px instead of 1.6 px.
- The FAA chart image is unchanged (it is the thing being learned).

### 2. Visible focus and focus order

- **One focus ring for everything in the figure:** a 3 px ring in the text color (`--sc-ink`), a 2 px gap, and a dark (`--sc-side`) halo around it, so it shows over light and dark chart alike. Today skycake relies on the browser's ring, which can vanish over the chart.
- **No invisible focus:** the find question's hidden buttons (`.sc-hidden` in `card.ts`) are replaced in the mode by the visible numbered list (section 5).
- **Fewer tab stops on the map:** airport tags on the chart (`<button class="tag apt">` in `viewer.ts`) get `tabindex="-1"` in the mode; the search box's airport list and the In view list are the keyboard paths to them.
- **Order** (DOM order): free roam is view, Airspace, In view, search, shown procedures, camera pad, view buttons and the accessibility row; phone adds the tab bar last. Walkthrough: view, title, Explore, step caption, player bar. Quiz: view, count, Explore, camera pad, card.
- **Focus follows the work:** in the mode, each new question and each walkthrough check moves focus to the card's first control (today only when focus was already in the card), except on first load, so the page's own focus is never taken. Escape closes the Airspace list, the In view list, the View sheet and the search results and returns focus to the button that opened them.

### 3. Motion

- The mode implies reduced motion: `build()` takes `still = reducedMotion || a11y`. Camera moves cut instead of fly, areas appear at once instead of rising, the propeller does not spin.
- A walkthrough's timeline (a procedure drawing, the airplane flying) is the lesson, so it still plays, but only while the student has pressed Play (section 4).
- The view buttons' tooltip fade (`transition: opacity 0.12s`) is off in the mode.

### 4. Time

- **Walkthroughs stop at each step's end.** Today a playing walkthrough moves to the next step after `stepSeconds` (4 s plus 0.06 s a character), which can cut off a screen reader mid-caption. In the mode, `tick()` in `walkthrough.ts` takes a `hold` flag: at the end of a step it stops (`playing: false`, the step's segment full) and Next or Play goes on. A pure-function change with its own tests.
- **Quizzes have no time limits** today, and the chart reading hunt has none in the mode (already settled). `QuizResult.ms` is still reported; a site must not turn it into a limit in the mode.
- **Nothing else is timed.** The card's 300 ms settle guard (`SETTLE_MS`) stays; it only ignores a double click.
- **Taps are forgiven:** in the mode a tap may move up to 16 px (today 8) and has no 500 ms limit (`isTap` in `gesture.ts` takes the thresholds), so a slow or shaky tap still counts.

### 5. One numbered picker, shared

The mode's keyboard and pointer path for anything on the map. One piece, used three ways:

- **On the map:** a number badge on each candidate `view.onScreen()` returns (areas smallest first, then shown fixes, then airports): a 24 px white circle with a bold dark number and a thin dark edge. Areas take their number at the point their chart tag already uses (`deepest()` on the widest ring); fixes and airports at their point. Badges are a layer of their own that never hides behind other tags (today overlapping tags hide), and are `aria-hidden`.
- **In a list:** the same numbers as buttons. Focusing or hovering one outlines its thing on the map (`view.focus`, as the hidden buttons do now). The list is rebuilt when the camera stops, as `fill()` does now.
- **By typing:** a number field, then Check, as the hunt spec says ("chosen by typing or picking the number"). No single-key shortcuts.

Uses:

- **Find questions** (`card.ts`): the list shows numbers only, so the question still asks the student to find the thing on the chart. A pick is chosen, then Check answers (section 6). A Skip button moves on (section 9).
- **The chart reading hunt:** the same picker over the symbols in view (that spec's `quizui.ts` work uses this piece instead of its own), with the same Skip.
- **Free roam's In view panel** (section 7): the list with names and altitudes, for reading and raising areas without a pointer.

### 6. Answers are chosen, then checked (the mode only)

instrumentready.com swaps instant saves for an explicit button. The quiz's instant change is the answer itself: today a tap on a choice, or on the map in a find question, scores at once. In the mode only (everyone else keeps one tap to answer):

- A choice, a map tap or a number pick is **chosen** (`aria-pressed`, one at a time, changeable), and a full-width Check button under the choices (`L.submit`, as number questions use now, styled as the walkthrough's Continue) scores it.
- A stray tap or a wrong key is never scored. The rest of the card (reveal, the right answer marked with a check and an outline, Next taking focus) is unchanged.

### 7. Free roam

- **In view panel** (new): the numbered list with each thing's name, and for an area its floor and ceiling (the hover tip's words, `L.facts`). Picking an area raises or lowers it (the tap on the map); picking an airport lists its procedures (the tag on the chart). It is the map's screen reader text and the keyboard and switch path for every tap on the map. Desktop: an In view pill under Airspace (top left) opening its list, as Airspace does. Phone: a tab in the tab bar opening a sheet.
- **Camera pad** (new), always on screen in the mode: a ring of four arrows (turn left and right, tilt up and down) with a centre mark, plus and minus to zoom, and a Pan toggle that switches the arrows to move the map. Desktop: bottom left, above the caption line. Phone: over the map, bottom left, above the tab bar. Every drag, pinch and twist has a single-tap equivalent (WCAG 2.5.1 and 2.5.7). The buttons call `view.orbit` and `view.zoom`, which exist, and a new `view.pan(dx, dz)` (the same move a one-finger drag makes on a phone). The focused view also gains Shift+arrows to pan, in both modes. Each button is 44 px.
- **What the map shows, in words:** the view gets `aria-describedby` pointing at a visually hidden summary rewritten after each `apply`: the chart and edition, the raised areas with their altitudes, the procedures shown. It is not a live region (the camera moving would make it chatter); a screen reader reads it on reaching the view.
- **Keys stay as they are:** arrows and plus or minus work only while the view has focus, which WCAG 2.1.4 allows; they are named with `aria-keyshortcuts` in the mode, as instrumentready.com does for Ctrl+K.
- Search, shown procedures, Airspace list, view buttons: already buttons and checkboxes with names, 44 px or more; no change beyond the ring.

### 8. Walkthroughs

- Stop at each step's end (section 4); camera cuts (section 3).
- The caption is already a polite live region; with the stop it is read through before anything changes.
- The big play button, the bar's buttons and the full screen button keep their names; the progress segments stay `aria-hidden` and the count (`4/8`) is the text.
- Checks inside a walkthrough are question cards, so they get sections 5 and 6.
- No camera pad or In view panel on the player in v1: a walkthrough sets its own camera, and Explore leads into free roam where they are.

### 9. Quizzes

- **Find questions:** the numbered picker and Check (sections 5, 6), plus a **Skip** button in the mode, since a find question cannot be answered without seeing the chart. Skip moves on without scoring: a fixed quiz's total drops by one, practice just asks the next, and `onResult` gets the item with `skipped: true` (`QuizResult` gains the field; `right` is false and sites should not count it). The same Skip is on the chart reading hunt.
- **Choice and Yes/No questions:** chosen, then Check.
- **Number questions:** unchanged (they already have Check and a labeled field).
- **Airplane questions:** the airplane's altitude is its tag on the chart; the prompt is already in the live region.
- **The camera pad shows in quizzes too,** since find and hunt questions need the map moved to bring the answer into view.
- While a question is open, the map's summary (section 7) says only the chart, as `hints(false)` hides the tip and fix altitudes, so it never gives an answer away.

### 10. Phone target sizes

- Every control is already 44 px or taller (pills, round buttons 48 px, rows, the `x` on a chip, the tab bar 76 px).
- The small targets are the tags on the chart. In the mode the numbered picker gives every one a full-size equivalent (WCAG 2.5.8 allows an equivalent control), and number badges are 24 px.
- The camera pad's buttons, the In view rows, Check and Skip are 44 px.

### 11. The accessibility docs (Chris: both)

- **For sites: `docs/accessibility.md`** in skycake, linked from the README. Every change the mode makes, per mode (free roam, walkthroughs, quizzes, the hunt), with the WCAG 2.2 point each meets; how to turn it on (`a11y`, or skycake's own row); what a site must do (pass `a11y` from its own toggle, not turn `ms` into a time limit, treat `skipped` as not asked). Updated in the same PR as any change to the mode.
- **For students:** a short plain-language page drawn from it: what the mode changes and how to use the camera pad, the In view list, numbers and Skip. In SkyCake Viewer it is linked from the accessibility row on the start screen (`app/accessibility.html`, as `privacy.html`); sites may link to it or write their own. Chris writes the copy; the build ships placeholders.

## What already works and stays

- Result never by color alone (check and cross icons, the right choice outlined).
- One live region per player, on the page before text goes in.
- Labeled buttons (`aria-label`), `aria-pressed` and `aria-expanded` on toggles, `role="group"` on the player bar, `role="listbox"` on search results.
- `prefers-reduced-motion` already read in `viewer.ts`.
- iPhone zoom avoided on the search field (16 px).
- "Not for navigation" stays on screen in every layout.

## Code touched (for the plan, not now)

- `src/ui.ts`: `Options.a11y`; `data-a11y` on the figure; the accessibility row when `a11y` is left out, `skycake-a11y`, and rebuild in place; `Context.a11y`; new placeholder labels (the row, In view, the camera pad's buttons, Pan, Skip, the map summary).
- `src/viewer.ts`: `still` from `a11y`; `pan()`; the number badge layer; airport tags out of the tab order; wider rims; bigger tags.
- `src/gesture.ts`: `isTap` thresholds as parameters.
- `src/walkthrough.ts`: `hold` in `tick()`; `src/player.ts`: start at a given step (for the rebuild).
- `src/quiz.ts`: `QuizResult.skipped`; skipping an item; `src/quizui.ts`: resume an attempt (for the rebuild), focus into new cards, the camera pad.
- `src/card.ts`: the numbered picker in place of the hidden list; chosen then Check; Skip.
- `src/freeroam.ts`: In view panel and tab, camera pad, Escape on sheets, the summary.
- `style.css`: the mode's tokens, `prefers-contrast: more`, focus ring, tag sizes, badges, In view, camera pad, the row.
- `app/main.ts`, `app/app.css`, `app/accessibility.html`: the start screen's row and the student page.
- `docs/accessibility.md`, `README.md`.
- instrumentready.com, separately: `Airspace3D.astro` passes `a11y: a11yOn()` once skycake ships.

No new dependency.

## Testing

- Unit (Vitest, as today): `tick()` with `hold` stops at each step's end and Next goes on; `isTap` with the mode's thresholds; the numbered picker's order and numbering match `onScreen()`; the chosen-then-Check card scores only on Check; Skip drops a fixed quiz's total by one and reports `skipped`; a resumed attempt asks the same question.
- Manual, each mode (free roam, walkthrough, quiz) with `a11y: true` and with the row: keyboard only on Windows (Chrome, Firefox); NVDA with Firefox; VoiceOver on an iPhone (real device emulation for layout, a real phone for VoiceOver); 200% page zoom; Windows High Contrast check that controls stay visible; flipping the row mid-quiz and mid-walkthrough.
- The demo page gets an `a11y` switch for these checks.

## Not in v1

- A live API for hosts (`setA11y()`); a host's toggle reloads.
- Turning the mode on from system settings.
- Changing the FAA chart image.
- Sound or speech of skycake's own.
- The camera pad and In view panel on the walkthrough player.

## Settled with Chris (2026-11-08)

- Find questions: numbers only, plus Skip in the mode (`skipped: true`, a fixed quiz's total drops by one).
- The mode implies reduced motion. And a detailed doc of every accessibility change: both a repo doc for sites and a student page.
- Walkthroughs stop at each step's end in the mode.
- Chosen then Check: the mode only.
- Reload is enough for hosts; no live API.
- No camera pad or In view on walkthroughs in v1.
- Standalone: a labeled row inside skycake (View controls; the Viewer's start screen too). A host that passes `a11y` drives it instead and the row is gone. Flipping the row rebuilds in place.
- Focus ring: text color with a dark halo.
- Tags bigger (13 px, opaque, solid fix borders) and 3D lines wider (2.4 px).
- Number badges: white circle, dark number.
- In view: a pill under Airspace on desktop, a tab on phones.
- Camera pad: compact, always over the map in the mode, bottom left; arrows turn and tilt, a Pan toggle switches them to move.
- Check: full width under the choices.

## Open questions for Chris

None. All on-screen words remain placeholders for Chris's copy.
