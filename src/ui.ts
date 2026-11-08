// What a site embeds: mount() builds the view inside any element. The area's data loads at once; three.js and the
// chart only when the element comes into sight. Styles are in style.css, which the site loads.
import { chartsOf, type AirspaceFile, type Area, type ChartName, type Kind, type Mode } from "./airspace.js";
import type { ProcType, Procedure } from "./procedure.js";
import { firstScene, type Scene } from "./scene.js";
import type { Walkthrough } from "./walkthrough.js";

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
  /** The walkthrough player: its buttons, the button that leaves into free roam, and the step count ("4/8"). */
  play: string;
  pause: string;
  back: string;
  next: string;
  explore: string;
  stepOf: (n: number, total: number) => string;
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
  right: "Right",
  wrong: "Wrong",
  submit: "Check",
  continue: "Continue",
  facts: (name, floor, ceiling) => `${name} · ${floor} to ${ceiling}`,
  play: "Play",
  pause: "Pause",
  back: "Back",
  next: "Next",
  explore: "Explore",
  stepOf: (n, total) => `${n}/${total}`,
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
  labels?: Partial<Labels>;
  /** For a standalone app: the view fills the window from the start, and its close button (phones: the Close tab;
   * desktop: in place of Full screen) calls this. */
  close?: () => void;
  /** The view's one job. "explore" (default): free roam. A walkthrough plays instead; its Explore button leaves into
   * free roam, and `next`, when given, is a link at its end (for example the topic's quiz). */
  mode?: "explore" | { walkthrough: Walkthrough; next?: { label: string; href: string } };
};

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
  const L: Labels = { ...LABELS, ...o.labels, kinds: { ...LABELS.kinds, ...o.labels?.kinds }, groups: { ...LABELS.groups, ...o.labels?.groups }, charts: { ...LABELS.charts, ...o.labels?.charts }, modes: { ...LABELS.modes, ...o.labels?.modes } };
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
  const view = h("div", { class: "view", tabindex: "0", role: "application", "aria-label": L.view }, tip);
  const fig = h("figure", { class: "skycake" }, view, h("p", { class: "sc-caption" }, L.caption(data.edition, chartsOf(data.charts)[0])));
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
  );

  // Keyboard: arrows turn the view, + and - zoom, only while the view has focus.
  const STEP = Math.PI / 24;
  view.addEventListener("keydown", (e) => {
    const act: Record<string, () => void> = {
      ArrowLeft: () => v.orbit(-STEP, 0),
      ArrowRight: () => v.orbit(STEP, 0),
      ArrowUp: () => v.orbit(0, -STEP),
      ArrowDown: () => v.orbit(0, STEP),
      "+": () => v.zoom(0.85),
      "=": () => v.zoom(0.85),
      "-": () => v.zoom(1 / 0.85),
    };
    if (!act[e.key] || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    act[e.key]();
  });

  // Every mode: CSS covers most browsers; iPhone Safari also needs its own gesture events stopped, or a pinch zooms
  // the page. sc-preview (free roam's map in the page on a phone) leaves them to the page.
  const taken = () => !fig.classList.contains("sc-preview");
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
  const context = { fig, view: v, data, first: firstScene(o, data, (m) => console.warn(m)), airport, labels: L, procedures, startScale: START_SCALE, close: o.close };
  const mode = o.mode ?? "explore";
  if (mode === "explore") return freeRoam(context);
  const { player } = await import("./player.js");
  await player(context, mode.walkthrough, mode.next, (from) => void freeRoam({ ...context, first: from }));
}
