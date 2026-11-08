// What a site embeds: mount() builds the view inside any element. The area's data loads at once; three.js and the
// chart only when the element comes into sight. Styles are in style.css, which the site loads.
import { chartsOf, type AirspaceFile, type Area, type ChartName, type Kind, type Mode } from "./airspace.js";
import type { ProcType, Procedure } from "./procedure.js";
import { firstScene, type Scene } from "./scene.js";
import type { QuestionType } from "./generate.js";
import type { Quiz, QuizResult } from "./quiz.js";
import type { Walkthrough } from "./walkthrough.js";
import { STEPS, browserStorage, initial, store } from "./a11y.js";
import type { Context } from "./freeroam.js";

/** On-screen words. Each site can supply its own; these are placeholders. */
export type Labels = {
  kinds: Record<Kind, string>;
  groups: Record<ProcType, string>;
  airspace: string;
  search: string;
  airports: string;
  noMatches: string;
  remove: (name: string) => string;
  procedureTab: string;
  viewTab: string;
  controls: string;
  diagram: string;
  tags: string;
  heightScale: (n: number) => string;
  /** The height button's name in words, on hover and on phones. */
  height: string;
  fullScreen: string;
  /** On phones: the map in the page opens full screen, and the tab bar closes it. */
  open: string;
  /** Walkthroughs and quizzes on a phone: the view in the page takes touches only after this is tapped. */
  wake: string;
  close: string;
  finalCourse: string;
  glidepath: string;
  fafToMap: string;
  floor700: string;
  view: string;
  /** Under the view: the charts shown and their edition. */
  caption: (edition: string, chart: ChartName) => string;
  /** The VFR/IFR button's name in words, and its text in each mode. */
  mode: string;
  modes: Record<Mode, string>;
  /** The chart button's name in words, and its text for each chart. */
  chart: string;
  charts: Record<ChartName, string>;
  /** The question card: the result words, the number question's button, the next button, and a revealed area's name and altitudes. */
  right: string;
  wrong: string;
  submit: string;
  continue: string;
  facts: (name: string, floor: string, ceiling: string) => string;
  /** After a wrong answer: the right one. */
  answerWas: (answer: string) => string;
  /** The walkthrough player: its buttons, the button that leaves into free roam, and the step count ("4/8"). */
  play: string;
  pause: string;
  back: string;
  next: string;
  explore: string;
  stepOf: (n: number, total: number) => string;
  /** The quiz: the count (question n of total, right so far; practice: right of answered), the card's next button,
   * the end's score and its button for a new attempt, and what practice says when its filters leave nothing to ask. */
  count: (n: number, total: number, right: number) => string;
  practiceCount: (right: number, answered: number) => string;
  nextQuestion: string;
  again: string;
  result: (right: number, total: number) => string;
  nothing: string;
  /** Accessibility mode's own switch, when the site does not drive it. */
  a11y: string;
  /** Accessibility mode: free roam's list of what is on the map, and the map in words (areas as `facts` gives them). */
  inView: string;
  summary: (chart: string, areas: string[], procedures: string[]) => string;
  /** Accessibility mode's camera pad: each button's name; with Pan pressed the arrows move the map instead. */
  camera: { group: string; left: string; right: string; up: string; down: string; zoomIn: string; zoomOut: string; pan: string; panLeft: string; panRight: string; panUp: string; panDown: string };
  /** The generated questions' prompts and their Yes/No answers. */
  ask: {
    findArea: (name: string) => string;
    /** One piece of an area in many pieces, by the altitudes the chart prints (SFC, 5,000). */
    findPiece: (name: string, floor: string, ceiling: string) => string;
    findFix: (fix: string) => string;
    floor: string;
    ceiling: string;
    cls: string;
    airplaneClass: string;
    clearance: string;
    radio: string;
    transponder: string;
    yes: string;
    no: string;
    altAt: (fix: string) => string;
    after: (fix: string) => string;
    faf: string;
    missed: string;
  };
};

export const LABELS: Labels = {
  kinds: { B: "Class B", C: "Class C", D: "Class D", E: "Class E", E700: "E 700 ft", MODEC: "Mode C", R: "Restricted", P: "Prohibited", W: "Warning", MOA: "MOA", A: "Alert" },
  groups: { IAP: "Approaches", STAR: "Arrivals", SID: "Departures" },
  airspace: "Airspace",
  search: "Airport or procedure",
  airports: "Airports",
  noMatches: "No matches",
  remove: (name) => `Remove ${name}`,
  procedureTab: "Procedure",
  viewTab: "View",
  controls: "Controls",
  diagram: "Diagram",
  tags: "Tags",
  heightScale: (n) => `Height scale ${n}×`,
  height: "Height scale",
  fullScreen: "Full screen",
  open: "Open 3D view",
  wake: "Placeholder: Tap to move the map",
  close: "Close",
  finalCourse: "Final course",
  glidepath: "Glidepath",
  fafToMap: "FAF to MAP",
  floor700: "Floor 700 AGL",
  view: "3D airspace. Arrow keys turn the view, plus and minus zoom.",
  caption: (edition, chart) => `FAA ${{ tac: "TAC and sectional", sectional: "sectional", area: "IFR area and low", low: "IFR low" }[chart]} ${edition} · Not for navigation`,
  mode: "VFR or IFR",
  modes: { vfr: "VFR", ifr: "IFR" },
  chart: "Chart",
  charts: { tac: "TAC", sectional: "SEC", area: "AREA", low: "LOW" },
  // Walkthrough and quiz words are the site's to write (instrumentready.com supplies them through `labels`); these defaults
  // say Placeholder so any the site leaves out stand out on screen.
  right: "Placeholder: Right",
  wrong: "Placeholder: Wrong",
  submit: "Placeholder: Check",
  continue: "Placeholder: Continue",
  facts: (name, floor, ceiling) => `Placeholder: ${name} · ${floor} to ${ceiling}`,
  answerWas: (answer) => `Placeholder: Answer: ${answer}`,
  play: "Placeholder: Play",
  pause: "Placeholder: Pause",
  back: "Placeholder: Back",
  next: "Placeholder: Next",
  explore: "Placeholder: Explore",
  stepOf: (n, total) => `Placeholder: ${n}/${total}`,
  count: (n, total, right) => `Placeholder: ${n}/${total} · ${right}`,
  practiceCount: (right, answered) => `Placeholder: ${right}/${answered}`,
  nextQuestion: "Placeholder: Next",
  again: "Placeholder: Again",
  result: (right, total) => `Placeholder: ${right} of ${total}`,
  nothing: "Placeholder: Nothing to ask here",
  a11y: "Placeholder: Accessibility mode",
  inView: "Placeholder: In view",
  summary: (chart, areas, procedures) => `Placeholder: ${chart}. Raised: ${areas.join("; ") || "none"}. Procedures: ${procedures.join("; ") || "none"}.`,
  camera: {
    group: "Placeholder: Camera",
    left: "Placeholder: Turn left",
    right: "Placeholder: Turn right",
    up: "Placeholder: Tilt up",
    down: "Placeholder: Tilt down",
    zoomIn: "Placeholder: Zoom in",
    zoomOut: "Placeholder: Zoom out",
    pan: "Placeholder: Pan",
    panLeft: "Placeholder: Move left",
    panRight: "Placeholder: Move right",
    panUp: "Placeholder: Move forward",
    panDown: "Placeholder: Move back",
  },
  ask: {
    findArea: (name) => `Placeholder: Tap the ${name}`,
    findPiece: (name, floor, ceiling) => `Placeholder: Tap the ${name} from ${floor} to ${ceiling}`,
    findFix: (fix) => `Placeholder: Tap ${fix}`,
    floor: "Placeholder: What is the floor of the highlighted airspace?",
    ceiling: "Placeholder: What is its ceiling?",
    cls: "Placeholder: What class is the highlighted airspace?",
    airplaneClass: "Placeholder: What airspace is the airplane in?",
    clearance: "Placeholder: Does the pilot need an ATC clearance here?",
    radio: "Placeholder: Is two-way radio communication required here?",
    transponder: "Placeholder: Is an altitude-reporting transponder required here?",
    yes: "Placeholder: Yes",
    no: "Placeholder: No",
    altAt: (fix) => `Placeholder: What altitude is charted at ${fix}?`,
    after: (fix) => `Placeholder: Which fix comes after ${fix}?`,
    faf: "Placeholder: Which fix is the final approach fix?",
    missed: "Placeholder: Which fix starts the missed approach?",
  },
};

export type Options = {
  /** URL of the area's data folder, e.g. "/skycake/phoenix/". */
  base: string;
  /** Free roam's first scene. Default: every type raised, the whole chart in view. */
  scene?: Scene;
  /** Shorthand for a first scene: types raised at first. */
  types?: Kind[];
  /** The airport current at first (search box, diagram). Default: KPHX when the area has it. */
  airport?: string;
  /** Shorthand for a first scene: this approach (at `airport`, default KPHX) shown. */
  approach?: string;
  labels?: Omit<Partial<Labels>, "ask" | "camera"> & { ask?: Partial<Labels["ask"]>; camera?: Partial<Labels["camera"]> };
  /** For a standalone app: the view fills the window from the start, and its close button (phones: the Close tab;
   * desktop: in place of Full screen) calls this. */
  close?: () => void;
  /** The view's one job. "explore" (default): free roam. A walkthrough plays instead; its Explore button leaves into
   * free roam, and `next`, when given, is a link at its end (for example the topic's quiz). A quiz asks its items;
   * "practice" asks generated questions without end, of `types` (default all) within `kinds` and `airports`. */
  mode?: "explore" | { walkthrough: Walkthrough; next?: { label: string; href: string } } | QuizMode;
  /** A quiz calls this after each answer and at its end. skycake stores nothing; the site decides what to keep. */
  onResult?: (r: QuizResult) => void;
  /** Accessibility mode, driven by the site's own toggle (instrumentready.com: a11yOn()). Left out, skycake shows its own
   * switch in free roam's view controls and keeps it per browser as "skycake-a11y". See docs/accessibility.md. */
  a11y?: boolean;
};
export type QuizMode = { quiz: Quiz | "practice"; kinds?: Kind[]; types?: QuestionType[]; airports?: string[] };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false) continue;
    if (k === "class") e.className = String(v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  e.append(...kids);
  return e;
}

/** Builds the view inside `host`. Resolves once the view has loaded and shows its first scene. */
export async function mount(host: HTMLElement, o: Options): Promise<void> {
  const L: Labels = { ...LABELS, ...o.labels, camera: { ...LABELS.camera, ...o.labels?.camera }, kinds: { ...LABELS.kinds, ...o.labels?.kinds }, groups: { ...LABELS.groups, ...o.labels?.groups }, charts: { ...LABELS.charts, ...o.labels?.charts }, modes: { ...LABELS.modes, ...o.labels?.modes }, ask: { ...LABELS.ask, ...o.labels?.ask } };
  const base = new URL(o.base, location.href);
  const url = (p: string) => new URL(p, base).href;
  const data: AirspaceFile = await fetch(url("area.json")).then((r) => {
    if (!r.ok) throw new Error(`skycake: ${r.status} for ${url("area.json")}`);
    return r.json();
  });
  // The viewer takes absolute URLs.
  data.charts = { sectional: url(data.charts.sectional), ...(data.charts.tac && { tac: { ...data.charts.tac, url: url(data.charts.tac.url) } }), ...(data.charts.low && { low: url(data.charts.low) }), ...(data.charts.area && { area: { ...data.charts.area, url: url(data.charts.area.url) } }) };
  data.dem = { ...data.dem, url: url(data.dem.url) };
  for (const a of data.airports) if (a.diagram) a.diagram = { ...a.diagram, url: url(a.diagram.url) };

  const tip = h("div", { class: "tip", hidden: true });
  const view = h("div", { class: "view", tabindex: "0", role: "application", "aria-label": L.view, "aria-keyshortcuts": "ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown + -" }, tip);
  const fig = h("figure", { class: "skycake" }, view, h("p", { class: "sc-caption" }, L.caption(data.edition, chartsOf(data.charts)[0])));
  const storage = browserStorage();
  const a11y = initial(o.a11y, storage);
  fig.toggleAttribute("data-a11y", a11y.on);
  host.replaceChildren(fig);

  // three.js and the chart load only when the view comes into sight.
  await new Promise<void>((done) => {
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      done();
    }).observe(view);
  });
  const { build, fraction, START_SCALE } = await import("./viewer.js");
  const show = (a: Area | null, x: number, y: number) => {
    tip.hidden = !a;
    if (!a) return;
    tip.textContent = "";
    tip.append(Object.assign(document.createElement("span"), { className: "name", textContent: a.name }), a.kind === "E700" ? h("span", {}, L.floor700) : fraction(a, data.ground));
    tip.style.transform = `translate(${Math.min(x + 12, view.clientWidth - tip.offsetWidth - 8)}px, ${Math.max(y - tip.offsetHeight - 8, 8)}px)`;
  };
  const v = await build(
    view,
    data,
    show,
    (kind, on) => fig.dispatchEvent(new CustomEvent("skycake-raised", { detail: { kind, on } })),
    (airport) => fig.dispatchEvent(new CustomEvent("skycake-airport", { detail: { airport } })),
    a11y.on,
  );

  // Keyboard: arrows turn the view, Shift and arrows move it, + and - zoom, only while the view has focus.
  const { turn: STEP, pan: PAN, zoom: ZOOM } = STEPS;
  view.addEventListener("keydown", (e) => {
    const pan: Record<string, () => void> = {
      ArrowLeft: () => v.pan(-PAN, 0),
      ArrowRight: () => v.pan(PAN, 0),
      ArrowUp: () => v.pan(0, PAN),
      ArrowDown: () => v.pan(0, -PAN),
    };
    const act: Record<string, () => void> = e.shiftKey && pan[e.key] ? pan : {
      ArrowLeft: () => v.orbit(-STEP, 0),
      ArrowRight: () => v.orbit(STEP, 0),
      ArrowUp: () => v.orbit(0, -STEP),
      ArrowDown: () => v.orbit(0, STEP),
      "+": () => v.zoom(ZOOM),
      "=": () => v.zoom(ZOOM),
      "-": () => v.zoom(1 / ZOOM),
    };
    // Only the view's own keys: not an arrow pressed on the camera pad or a tag inside it.
    if (e.target !== view || !act[e.key] || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    act[e.key]();
  });

  // Every mode: CSS covers most browsers; iPhone Safari also needs its own gesture events stopped, or a pinch zooms
  // the page. sc-preview (free roam's map in the page on a phone) and sc-asleep (a walkthrough's or quiz's, until tapped)
  // leave them to the page.
  const taken = () => !fig.classList.contains("sc-preview") && !(fig.classList.contains("sc-asleep") && !fig.classList.contains("full"));
  for (const t of ["gesturestart", "gesturechange", "gestureend"]) fig.addEventListener(t, (e) => taken() && e.preventDefault());
  fig.addEventListener("dblclick", (e) => taken() && !(e.target instanceof HTMLInputElement) && e.preventDefault());
  fig.addEventListener("touchmove", (e) => fig.classList.contains("full") && e.touches.length > 1 && e.preventDefault(), { passive: false });
  // A long press on the map would open the browser's menu. The search box keeps its own, for paste.
  if (matchMedia("(pointer: coarse)").matches) fig.addEventListener("contextmenu", (e) => e.target instanceof HTMLInputElement || e.preventDefault());

  const loaded = new Map<string, Promise<Procedure[]>>();
  const procedures = (id: string) => {
    if (!loaded.has(id)) loaded.set(id, fetch(url(`procedures/${id}.json`)).then((r) => (r.ok ? r.json() : [])).catch(() => []));
    return loaded.get(id)!;
  };
  const { freeRoam } = await import("./freeroam.js");
  const airport = o.airport ?? (data.airports.some((a) => a.id === "KPHX") ? "KPHX" : null);
  const context: Context = { fig, view: v, data, first: firstScene(o, data, (m) => console.warn(m)), airport, labels: L, procedures, startScale: START_SCALE, close: o.close, a11y: a11y.on };
  // Free roam's new controls are always built and shown by CSS, so the switch changes the mode in place.
  if (a11y.row)
    context.setA11y = (on) => {
      context.a11y = on;
      fig.toggleAttribute("data-a11y", on);
      v.setA11y(on);
      store(storage, on);
    };
  const mode = o.mode ?? "explore";
  if (mode === "explore") return freeRoam(context);
  const explore = (from: Scene) => void freeRoam({ ...context, first: from });
  if ("quiz" in mode) {
    const { quiz } = await import("./quizui.js");
    return quiz(context, mode, o.onResult ?? (() => {}), explore);
  }
  const { player } = await import("./player.js");
  await player(context, mode.walkthrough, mode.next, explore);
}
