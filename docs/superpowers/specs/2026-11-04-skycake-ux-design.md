# skycake UX: free roam, walkthroughs, quizzes

Status: approved by Chris 2026-11-04, with everything raised in free roam and several procedures at once. Decisions behind it are in Projects HQ (Notion), project "skycake". Mockups: the "skycake UX layouts" canvas (claude.ai artifact, private to Chris), rows "Chosen", "Walkthrough" and "Quiz".

## Goal

Make the 3D airspace view usable three ways: exploring freely, watching a walkthrough that plays like a video, and taking a quiz. Students alone are the main users (self-paced, on phones as much as desktops); Chris also uses walkthroughs live, pausing and stepping by hand. Not for navigation.

## What Chris decided (2026-11-04)

- Each embed has one job: free roam, one walkthrough, or one quiz. The site decides which goes where; on instrumentready.com topic pages place them between Chris's text.
- skycake holds the engine (viewer, walkthrough player, quiz engine, question generators). Chris's walkthroughs and quiz questions stay private on instrumentready.com and are handed to skycake when a view mounts.
- Walkthrough steps can move the camera, raise or lower airspace, highlight, show or draw procedures, fly an airplane, ask a quick check, and switch the diagram or height scale. They play on their own like a video.
- Quizzes support four question types: tap to find, read the view, where's the airplane, fly the procedure.
- skycake generates questions from the FAA data. Generated questions run as an endless practice quiz and can be mixed into Chris's written quizzes.
- Layout: controls float over the full view on desktop (canvas layout A); on phones a bottom tab bar holds them (layout C's bar).
- The scene always fits what is being asked. A question about reading the chart starts top-down with nothing raised; the 3D reveal comes after the answer.

## Shared: the scene

Everything the view shows at a moment is one `Scene`. Free roam starts from one; every walkthrough step and quiz question sets one. Changing scene animates the camera (0.7 s, none with reduced motion) and raises or lowers areas (0.35 s), as the viewer does today.

```ts
type Scene = {
  camera?: "fit" | "top" | { frame: Target[]; tilt?: number } | { azimuth: number; tilt: number; distance: number; target: [lat: number, lon: number] };
  raise?: (Kind | AreaRef)[];        // raised; everything else lies flat on the chart. Default: nothing raised
  highlight?: Target[];              // stands out; the rest dims
  procedures?: { airport: string; name: string; draw?: boolean }[];  // any number at once; draw: leg by leg over the step
  airplane?: { at: [lat: number, lon: number, ft: number] } | { along: ProcedureRef; seconds: number };
  diagram?: string | null;           // airport id
  height?: 1 | 4;
  tags?: boolean;
};
type AreaRef = { area: string };      // an area's id in area.json
type Target = AreaRef | { fix: string } | { procedure: ProcedureRef } | { point: [lat: number, lon: number] };
```

- `camera: "top"` looks straight down, north up, framed on the targets or the whole chart; tags and labels stay readable.
- Areas get stable ids in `area.json` (built by `npm run data`), so content can name "the Chandler Class D" and survive a data rebuild. An id that disappears after an FAA change makes the step or question fail loudly in tests on the site, not silently on screen.
- Free roam's first scene, unless the site gives one: every airspace type raised, camera fit on the whole chart (Chris, 2026-11-04). Walkthroughs and quizzes always set their own.
- Free roam remembers nothing between visits.

## Layout (all modes)

The view fills the embed. Controls float over it in small panels with the site's frame, panel color and pill shapes (instrumentready.com: Graphite, Space Grotesk, Inter, JetBrains Mono). Every control is at least 44 px. Full screen keeps the same layout.

- **Desktop (wider than 860 px):** panels sit in the corners: top left for the mode's main control, top right for search or leave, bottom for captions, players and answers.
- **Phone:** the view takes everything above a 76 px bar along the bottom. In free roam that bar is the tab bar; in a walkthrough it is the player; in a quiz it is the answer area. Menus open as sheets above the bar.
- **Caption line:** "FAA TAC and sectional <edition> · Not for navigation" (or "FAA sectional ...") stays on screen in every mode (placeholder wording).
- **Area and charts** (Chris, 2026-11-05): Phoenix to Tucson. The TAC shows over its own map area and the Phoenix sectional outside it; a Chart button (View) switches to the sectional everywhere. Scenes take `chart: "tac" | "sectional"`.

## Free roam

What the current viewer does, rearranged:

- **Search** (top right; phone: top): typing "25L" or "BNYRD" lists procedures whose names match, grouped by airport and type (Approaches, Arrivals, Departures). Airports are not searched (Chris, 2026-11-05): with the box empty it lists the airports, and picking one, or tapping its tag on the chart, lists every procedure there. Airports with procedures have a tag on the chart; procedure tags win over airport tags, and airport tags over airspace tags. Picking a procedure adds it to the view, so an arrival and the approach it feeds can show together (Chris, 2026-11-04). Each shown procedure is a chip under the search box with a remove button; the camera frames all of them. An approach's info card (final course, glidepath, FAF to MAP) shows under its chip. A fix shared by two shown procedures gets one tag. Removing the last one goes back to the first view.
- **Airspace** (top left button and list; phone: Airspace tab): one row per type with its chart swatch and a switch. Tapping a boundary on the chart still raises that area.
- **View** (bottom right round buttons; phone: View tab): tags (on at first), height 1× (at first) or 4×, full screen. Each button's name shows on hover or keyboard focus; on phones it sits under the button (Chris, 2026-11-05). **Diagram** has its own button (phone: tab), shown only when the airport has one.
- Hover or tap on an area shows its name and floor/ceiling, as today. Keyboard: arrows turn the view and + / - zoom while the view has focus; no shortcuts work anywhere else on the page.

## Walkthroughs

### What the student sees

- Free-roam controls hide. Top left: the walkthrough's title. Top right: **Explore**, which leaves the walkthrough into free roam from the current scene.
- A caption card above the player shows the step's text.
- The player: back, play/pause, next, a progress bar with one segment per step (a quick check's segment is outlined), "4/8", full screen. Phone: the player replaces the tab bar.
- It starts paused on step 1 with a play button over the view; nothing moves until the student presses play (also how autoplay rules in browsers want it).
- Playing runs each step for its length, then the next. Back and next jump whole steps. Dragging the view pauses; play resumes from the step's scene.
- A quick check pauses and shows a question card (same card as quizzes). Answering, right or wrong, shows the result and a Continue button. It is not scored.
- The last step ends paused with two buttons: **Explore** and, when the site gives one, **Next** (for example the topic's quiz).

### Format (Chris writes these; kept on instrumentready.com)

```ts
type Walkthrough = {
  id: string;
  title: string;
  area: string;                       // "phoenix"
  steps: Step[];
};
type Step = {
  caption: string;
  scene: Scene;
  seconds?: number;                   // default: 4 + 0.06 per caption character, rounded up
  check?: Question;                   // a quick check: pauses until answered
};
```

JSON (or TypeScript on the site). A small validator in skycake checks ids, airports, procedures and question answers against the area data; instrumentready.com runs it in `npm run validate`.

## Quizzes

### What the student sees

- The scene dims except what the question is about. Top left: question number and correct count in JetBrains Mono. Top right: leave.
- The question card sits at the bottom (desktop) or in the bottom area (phone) with its answers. "Tap to find" questions show only the prompt; the student taps the view.
- After an answer: right or wrong shown with an icon and a word (not color alone), the area's or fix's real values, the explanation if the question has one, then **Next**. The reveal happens here: a chart-reading question raises the answer in 3D.
- The end shows the score and **Again** / **Explore**. Practice mode has no end; its score runs until the student leaves.

### Question types

All four share `prompt`, optional `scene` (default chosen per type, below), optional `explanation` with a citation, and `id`.

| Type | Student does | Answer | Default scene |
|---|---|---|---|
| `find` | taps the view | an area, fix or airport; a tap counts if it lands on it (fixes and airports within 1.5 NM on the ground) | `camera: "top"`, nothing raised |
| `read` | picks one of 2 to 4 choices, or types a number | a choice; numbers have a tolerance | the highlighted target raised alone, oblique |
| `airplane` | picks a choice | a choice | airplane shown with an altitude tag, nothing raised, oblique |
| `procedure` | picks a choice | a choice | only the procedures asked about shown, framed |

### Format

```ts
type Quiz = {
  id: string;
  title: string;
  area: string;
  items: (Question | Generate)[];     // in order; generated items are drawn fresh each attempt
  shuffle?: boolean;
};
type Question =
  | { type: "find"; prompt: string; answer: Target; scene?: Scene; explanation?: string }
  | { type: "read" | "airplane" | "procedure"; prompt: string; choices: string[]; answer: number; scene?: Scene; explanation?: string }
  | { type: "read"; prompt: string; number: { answer: number; tolerance: number; unit?: string }; scene?: Scene; explanation?: string };
type Generate = { generate: "find" | "read" | "airplane" | "procedure"; count: number; kinds?: Kind[]; airports?: string[] };
```

### Generated questions

Generators build questions from `area.json` and the procedure files, so every answer comes from FAA data. Wrong choices come from the same data (neighbouring shelves, other fixes on the same procedure), never invented.

- **find:** "Tap the Class D at Chandler", "Tap the Class B shelf with a 5,000 ft floor", "Tap SCADE" (when a procedure is shown).
- **read:** floor or ceiling of a highlighted shelf; class of a highlighted area.
- **airplane:** the class of airspace at a point and altitude, worked out from the area outlines, floors and ceilings and the terrain (Class G below the 700 ft or 1,200 ft AGL Class E floor); and from that class, whether an ATC clearance is needed (Class B, 14 CFR 91.131(a)), two-way radio communication must be established (Class C, 91.130(c); Class D, 91.129(c)), or an altitude-reporting transponder is required (Mode C veil, 91.215(b)(2)). Altitudes stay between 500 ft AGL and 17,500 ft MSL (the view stops at 18,000, where Class A starts). Points within 0.5 NM or 300 ft of a boundary are skipped so no answer is ambiguous.
- **procedure:** altitude at a fix (the constraint as charted), the fix after a given fix, the final approach fix, the first fix of the missed approach.
- Generated questions carry no written explanation; the answer card shows the data (for example "Chandler Class D · SFC to 3,000"). Explanations stay Chris's to write on his own questions.

### Practice and results

- `quiz: "practice"` with optional `kinds`, `airports` and `types` runs generated questions without end.
- `mount()` takes `onResult(result)`, called after each answer and at the end with the question id or generator, right or wrong, and the time taken. skycake stores nothing; instrumentready.com decides whether to record anything (not in this round).

## Embedding

```ts
mount(element, {
  base: "/skycake/phoenix/",
  mode: "explore" | { walkthrough: Walkthrough; next?: { label: string; href: string } } | { quiz: Quiz | "practice"; kinds?: Kind[]; types?: QuestionType[] },
  scene?: Scene,                      // free roam's first scene; replaces types / airport / approach
  labels?: Partial<Labels>,
  onResult?: (r: QuizResult) => void,
});
```

The current options (`types`, `airport`, `approach`) keep working as shorthand for a first scene.

On instrumentready.com: `<Airspace3D />`, `<Airspace3D walkthrough="class-b" />`, `<Airspace3D quiz="class-b" />`, `<Airspace3D quiz="practice" kinds={["B"]} />`. Walkthroughs and quizzes live in the instrumentready.com repo and reach the browser only for signed-in members, through an on-demand endpoint like the topic pages' members-only sections. That wiring gets its own short spec in instrumentready.com when the content format here is approved.

## Later (not in this round)

- A diagram for KLUF (Luke AFB). Its PDF draws its tick labels as shapes, and it is the one of the four below still without a diagram.
- Recording quiz results on the progress page.
- Audio narration.

Done since this spec was approved:

- **IFR charts and airways** (0.5.0, 0.6.0): the IFR area chart and low as base maps behind a VFR/IFR button, and the scene's `chart` field. Low altitude airways stand at their MEA, from the CIFP rather than NASR.
- **More areas** (0.4.0): Key West to Palm Beach (Miami), beside Phoenix to Tucson.
- **Diagrams for KDVT, KGYR and KIWA** (0.4.1), read from tick labels drawn as outlines.
- **The data pipeline** (Data cycle workflow): new FAA data every 28 days, each area recording its procedure `cycle`.

## Accessibility

- All controls are real buttons, inputs and switches with labels; icon buttons have `aria-label`s.
- Captions and question text are live regions, so screen readers announce each new step or question.
- Reduced motion: no camera flights or raising animation; walkthroughs still advance by time unless paused.
- "Tap to find" also works by keyboard: Tab moves through the candidate areas on screen with their names announced, Enter answers.
- instrumentready.com's accessibility mode (higher contrast, no single-key shortcuts) applies: skycake reads the site's colors and adds no page-wide keys.

## Testing

- Scene: each field applies and animates; an unknown area id throws in validation.
- Walkthrough player: timing from caption length, play/pause/back/next, quick checks pause until answered, the end state.
- Quiz engine: each type scores right and wrong; number tolerance; shuffle; generated items drawn per attempt.
- Generators: every answer matches the data; choices are distinct; airplane points avoid boundaries; class at a point agrees with hand-checked points around Phoenix (inside Class B shelves, under a shelf in Class E, in Class G near the edge of the chart, inside the Mode C veil).
- Validator: catches a missing area, airport, procedure or fix.
- Layout checked at desktop and phone widths with real device emulation.

## Build order

1. Scene model and the new free-roam layout (replaces today's control row).
2. Walkthrough format, validator and player.
3. Quiz engine and generators, practice mode first.
4. Written quizzes and mixing.
5. instrumentready.com wiring (its own spec): members-only content, `<Airspace3D walkthrough|quiz>`.
