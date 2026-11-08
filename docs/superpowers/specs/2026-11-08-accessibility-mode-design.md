# Accessibility mode: design

Status: draft for Chris's review, 2026-11-08. Spec only, no code. Every visual piece below is a proposal until Chris gives a direction (see Open questions); every on-screen word is a placeholder in `labels`.

## Why

Chris, 2026-11-08: skycake gets an accessibility mode that "changes a lot of things", as instrumentready.com has one. The chart reading quiz spec (`2026-11-08-chart-reading-quiz-design.md`) already settled its own part: in the mode the symbol hunt shows a number on every symbol in view, is answered by the number, and has no countdown. This spec covers the rest: free roam, walkthroughs and the other quiz types.

Success: someone using only a keyboard, a screen reader, a switch or a phone with a tremor can do everything a mouse user can (or, where a question tests reading the chart with the eyes, is told so and can move on), with no time pressure, no motion they did not ask for, and text and controls they can see.

## What instrumentready.com's mode does (to match)

- `src/lib/a11y.ts`: `A11Y_KEY = "ir-a11y"` in localStorage; an inline boot script sets `data-a11y` on `<html>` before first paint; `a11yOn()` reads it.
- `src/layouts/App.astro`: a round toggle in the top bar (a person icon, `aria-pressed`, "Accessibility mode"); a click flips the key and **reloads the page**. `:root[data-a11y]` raises `--soft #c5c8cc`, `--muted #b0b4b9`, `--dim #969ba1`, `--red #e5766b`, `--frame #767c83` (text at least 4.5:1, control borders at least 3:1). `prefers-contrast: more` applies the same tokens without the mode.
- `Search.astro`, `TopicBar.astro`: no single-key shortcuts (`/`, `j`, `k`, `d`); Ctrl/Cmd+K stays and is announced with `aria-keyshortcuts`.
- `progress.astro`: selects no longer save on change; an explicit Save button shows.
- `agree.astro`: no "scroll to the end first" gate.

The pattern: higher contrast, nothing happens on its own, nothing fires from a single key, nothing is gated on how you move.

## Turning it on

- **`mount` option `a11y?: boolean`** (default false), in `Options` in `src/ui.ts`. `mount` sets `data-a11y` on the `.skycake` figure (the same attribute name as instrumentready.com, scoped to the figure) and passes `a11y` on in `Context` and to `build()`.
- **instrumentready.com:** `Airspace3D.astro` passes `a11y: a11yOn()`. Its toggle already reloads the page, so a change reaches skycake through a fresh `mount`. No live update API in v1 (see Open questions).
- **SkyCake Viewer (`app/`):** its own toggle on the start screen, kept as `skycake-a11y` in localStorage, read when an area opens and passed as `a11y`. It also sets `data-a11y` on the app's `<html>` so `app.css` raises the start screen's contrast too. A change takes effect on the next area opened (or a reload), as on instrumentready.com.
- **System settings keep working alone:** `prefers-reduced-motion` (already read in `src/viewer.ts`) and `prefers-contrast: more` (new, the same tokens as the mode, as instrumentready.com does). Neither turns the whole mode on.

## What the mode changes

### 1. Contrast

- `style.css`: `.skycake[data-a11y]` (and `@media (prefers-contrast: more)`) sets `--sc-soft: var(--soft, #c5c8cc)`, `--sc-muted: var(--muted, #b0b4b9)`, `--sc-dim: var(--dim, #969ba1)`, `--sc-frame: var(--frame, #767c83)`, `--sc-accent: var(--red, #6aa6e8)`. Host tokens still win, so on instrumentready.com the figure takes the site's own raised tokens (and stays red); elsewhere it takes these. Measured on `--sc-panel` #1f2226: muted 4.59 to 7.66, dim 2.59 to 5.70, frame 1.50 to 3.79, accent 3.66 to 6.26.
- Tags on the chart (they keep their own colors, as today): fully opaque backgrounds, `.fix` border solid white instead of 60%, text 13 px instead of 11 px. Proposed; see Open questions.
- The 3D lines: area rims and walls drawn wider (rims 1.6 to 2.4 px). Proposed; see Open questions.
- The FAA chart image is unchanged (it is the thing being learned).

### 2. Visible focus and focus order

- **One focus ring for everything in the figure** in the mode: a two-tone ring that shows on light and dark chart alike (proposed: 3 px `--sc-ink` outline, 2 px offset, with a `--sc-side` halo). Today skycake relies on the browser's ring, which can vanish over the chart.
- **No invisible focus:** the find question's hidden buttons (`.sc-hidden` in `card.ts`) are replaced in the mode by the visible numbered list (section 5).
- **Fewer tab stops on the map:** airport tags on the chart (`<button class="tag apt">` in `viewer.ts`) get `tabindex="-1"` in the mode; the search box's airport list is the keyboard path to them.
- **Order** (DOM order, unchanged): free roam is view, Airspace, search, shown procedures, In view (new), camera buttons (new), view buttons; phone adds the tab bar last. Walkthrough: view, title, Explore, step caption, player bar. Quiz: view, count, Explore, card.
- **Focus follows the work:** in the mode, each new question and each walkthrough check moves focus to the card's first control (today only when focus was already in the card), except on first load, so the page's own focus is never taken. Escape closes the Airspace list, the View sheet and the search results and returns focus to the button that opened them.

### 3. Motion

- In the mode the viewer behaves as under `prefers-reduced-motion`: `build()` takes `still = reducedMotion || a11y`. Camera moves cut instead of fly, areas rise at once, the propeller does not spin.
- A walkthrough's timeline (a procedure drawing, the airplane flying) is the lesson, so it still plays, but only while the student has pressed Play (section 4).
- The view buttons' tooltip fade (`transition: opacity 0.12s`) is off in the mode.

### 4. Time

- **Walkthroughs hold at each step's end.** Today a playing walkthrough moves to the next step after `stepSeconds` (4 s plus 0.06 s a character), which can cut off a screen reader mid-caption. In the mode, `tick()` in `walkthrough.ts` takes a `hold` flag: at the end of a step it stops (`playing: false`, the step's segment full) and Next or Play goes on. A pure-function change with its own tests.
- **Quizzes have no time limits** today, and the chart reading hunt has none in the mode (already settled). `QuizResult.ms` is still reported; a site must not turn it into a limit in the mode.
- **Nothing else is timed.** The card's 300 ms settle guard (`SETTLE_MS`) stays; it only ignores a double click.
- **Taps are forgiven:** in the mode a tap may move up to 16 px (today 8) and has no 500 ms limit (`isTap` in `gesture.ts` takes the thresholds), so a slow or shaky tap still counts.

### 5. One numbered picker, shared

The mode's keyboard and pointer path for anything on the map. One piece, used three ways:

- **On the map:** a number badge on each candidate `view.onScreen()` returns (areas smallest first, then shown fixes, then airports). Areas take their number at the point their chart tag already uses (`deepest()` on the widest ring); fixes and airports at their point. Badges are a layer of their own that never hides behind other tags (today overlapping tags hide), and are `aria-hidden`.
- **In a list:** the same numbers as buttons. Focusing or hovering one outlines its thing on the map (`view.focus`, as the hidden buttons do now). The list is rebuilt when the camera stops, as `fill()` does now.
- **By typing:** a number field with Check, as the hunt spec says ("chosen by typing or picking the number"). No single-key shortcuts.

Uses:

- **Find questions** (`card.ts`): the list shows numbers only, so the question still asks the student to find the thing on the chart. A pick is pressed, then Check answers (section 6).
- **The chart reading hunt:** the same picker over the symbols in view (that spec's `quizui.ts` work uses this piece instead of its own).
- **Free roam's In view panel** (new, section 7): the list with names and altitudes, for reading and raising areas without a pointer.

### 6. Answers are chosen, then checked

instrumentready.com swaps instant saves for an explicit button. The quiz's instant change is the answer itself: today a tap on a choice, or on the map in a find question, scores at once. In the mode:

- A choice, a map tap or a number pick is **pressed** (`aria-pressed`, one at a time, changeable), and the card's Check button (`L.submit`, already used by number questions) scores it.
- A stray tap or a wrong key is never scored. The rest of the card (reveal, the right answer marked with a check and an outline, Next taking focus) is unchanged.

### 7. Free roam

- **In view panel** (new): the numbered list with each thing's name, and for an area its floor and ceiling (the hover tip's words, `L.facts`). Picking an area raises or lowers it (the tap on the map); picking an airport lists its procedures (the tag on the chart). It is the map's screen reader text and the keyboard and switch path for every tap on the map. Desktop: a pill and panel; phone: a sheet from the tab bar. Placement is an open question.
- **Camera buttons** (new): turn left and right, tilt up and down, zoom in and out, and pan in four directions, so every drag, pinch and twist has a single-tap equivalent (WCAG 2.5.1 and 2.5.7). They call `view.orbit` and `view.zoom`, which exist, and a new `view.pan(dx, dz)` (the same move a one-finger drag makes on a phone). The focused view also gains Shift+arrows to pan, in both modes. Layout is an open question.
- **What the map shows, in words:** the view gets `aria-describedby` pointing at a visually hidden summary rewritten after each `apply`: the chart and edition, the raised areas with their altitudes, the procedures shown. It is not a live region (the camera moving would make it chatter); a screen reader reads it on reaching the view.
- **Keys stay as they are:** arrows and plus or minus work only while the view has focus, which WCAG 2.1.4 allows; they are named with `aria-keyshortcuts` in the mode, as instrumentready.com does for Ctrl+K.
- Search, shown procedures, Airspace list, view buttons: already buttons and checkboxes with names, 44 px or more; no change beyond the ring.

### 8. Walkthroughs

- Hold at each step's end (section 4); cut camera moves (section 3).
- The caption is already a polite live region; with the hold it is read through before anything changes.
- The big play button, the bar's buttons and the full screen button keep their names; the progress segments stay `aria-hidden` and the count (`4/8`) is the text.
- Checks inside a walkthrough are question cards, so they get sections 5 and 6.
- The camera buttons and In view panel are not on the player in v1: a walkthrough sets its own camera, and Explore leads into free roam where they are. See Open questions.

### 9. Quizzes

- Find questions: the numbered picker and Check (sections 5, 6).
- Choice and Yes/No questions: pressed, then Check.
- Number questions: unchanged (they already have Check and a labeled field).
- Airplane questions: the airplane's altitude is its tag on the chart; the prompt is already in the live region.
- While a question is open, the map's summary (section 7) says only the chart, as `hints(false)` hides the tip and fix altitudes, so it never gives an answer away.
- A find or hunt question cannot be answered without seeing the chart. See Open questions for a Skip button.

### 10. Phone target sizes

- Every control is already 44 px or taller (pills, round buttons 48 px, rows, the `x` on a chip, the tab bar 76 px).
- The small targets are the tags on the chart. In the mode the numbered picker gives every one a full-size equivalent (WCAG 2.5.8 allows an equivalent control), and number badges are at least 24 px.
- The camera buttons and the In view rows are 44 px.

## What already works and stays

- Result never by color alone (check and cross icons, the right choice outlined).
- One live region per player, on the page before text goes in.
- Labeled buttons (`aria-label`), `aria-pressed` and `aria-expanded` on toggles, `role="group"` on the player bar, `role="listbox"` on search results.
- `prefers-reduced-motion` already read in `viewer.ts`.
- iPhone zoom avoided on the search field (16 px).
- "Not for navigation" stays on screen in every layout.

## Code touched (for the plan, not now)

- `src/ui.ts`: `Options.a11y`, `data-a11y` on the figure, `Context.a11y`, new placeholder labels.
- `src/viewer.ts`: `still` from `a11y`; `pan()`; number badges layer; airport tags out of the tab order; wider rims.
- `src/gesture.ts`: `isTap` thresholds as parameters.
- `src/walkthrough.ts`: `hold` in `tick()`.
- `src/card.ts`: the numbered picker in place of the hidden list; pressed then Check.
- `src/freeroam.ts`: In view panel, camera buttons, Escape on sheets, the summary.
- `src/player.ts`, `src/quizui.ts`: focus into new cards; pass `hold`.
- `style.css`: the mode's tokens, `prefers-contrast: more`, focus ring, tag sizes, badges, new panels.
- `app/main.ts`, `app/app.css`: the Viewer's toggle and `skycake-a11y`.
- instrumentready.com, separately: `Airspace3D.astro` passes `a11y: a11yOn()` once skycake ships.

No new dependency.

## Testing

- Unit (Vitest, as today): `tick()` with `hold` stops at each step's end and Next goes on; `isTap` with the mode's thresholds; the numbered picker's order and numbering match `onScreen()`; the pressed-then-Check card scores only on Check.
- Manual, each mode (free roam, walkthrough, quiz) with `a11y: true`: keyboard only on Windows (Chrome, Firefox); NVDA with Firefox; VoiceOver on an iPhone (real device emulation for layout, a real phone for VoiceOver); 200% page zoom; Windows High Contrast check that controls stay visible.
- The demo page gets an `a11y` switch for these checks.

## Not in v1

- A live switch without remounting (instrumentready.com reloads; the Viewer applies it to the next area).
- Turning the mode on from system settings.
- Changing the FAA chart image.
- Sound or speech of skycake's own.

## Open questions for Chris

Visual (Chris gives a direction before any of these are built):

1. **Focus ring.** Proposed: 3 px ring in the text color with a dark halo, on every control and the view. Or the accent color?
2. **Tags in the mode.** Proposed: 13 px text, opaque backgrounds, solid white fix borders. Larger still, or leave tags alone?
3. **3D lines.** Wider rims and walls in the mode, or leave them?
4. **Number badges.** Shape and color: proposed a white circle with a dark number, 24 px, like a chart's own callouts. Something else?
5. **In view panel.** Desktop: a pill under Airspace (top left) opening a list, or a second section in the Airspace panel? Phone: a sixth tab, or a row inside the View sheet?
6. **Camera buttons.** Desktop: a pad of 10 round buttons by the view buttons (bottom right), or a compact pad (a ring for turn and tilt, plus and minus, with pan behind a toggle)? Phone: in the View sheet, or always over the map in the mode?
7. **The Viewer's toggle.** Reuse instrumentready.com's person icon and round button, top right of the start screen?
8. **Check in the quiz card.** With pressed-then-Check on choices, Check sits under the choices (full width) or at the end of the row?

Behavior:

9. **Find questions for screen reader users.** Numbers only keeps the question a chart reading test but cannot be answered without sight. Options: (a) numbers only, plus a Skip button in the mode that moves on without scoring (a fixed quiz's total drops by one; `QuizResult` gains `skipped: true`); (b) names in the list (the question becomes trivial); (c) numbers only, no Skip. Recommended: (a).
10. **Live update.** "Updates when the toggle changes": instrumentready.com's toggle reloads the page, so `mount` gets the new value with no new API. Is that enough, or should `mount` return a handle with `setA11y()` so a host can switch without reloading? Recommended: reload is enough for v1.
11. **Reduced motion in the mode.** The mode implies reduced motion (camera cuts, no rising). Agreed, or keep motion unless the system asks?
12. **Walkthrough hold.** Hold at every step's end in the mode (recommended), or keep auto-advance with a slower speed setting?
13. **Camera buttons and In view in walkthroughs.** Off in v1 (Explore leads to them), or on the player too?
14. **Pressed then Check everywhere?** In the mode only (recommended), or for everyone (fewer mis-taps on phones, one more tap per question)?
