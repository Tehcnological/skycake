// The free-roam view a site embeds: the 3D scene with its type chips, airport and procedure pickers, diagram, tags,
// height scale and full screen controls. mount() builds it inside any element; the scene itself (viewer.ts, three.js)
// loads only when the element comes into sight. Styles are in style.css, which the site loads.
import { KINDS, type AirspaceFile, type Area, type Kind } from "./airspace.js";
import type { ProcType, Procedure } from "./procedure.js";
import { freeRoamScene, resolve, shorthand, type Scene } from "./scene.js";

/** On-screen words. Each site can supply its own. */
export type Labels = {
  kinds: Record<Kind, string>;
  airport: string;
  procedure: string;
  noProcedure: string;
  groups: Record<ProcType, string>;
  diagram: string;
  tags: string;
  heightScale: (n: number) => string;
  fullScreen: string;
  details: string;
  finalCourse: string;
  glidepath: string;
  fafToMap: string;
  floor700: string;
  view: string;
  caption: (edition: string) => string;
};

export const LABELS: Labels = {
  kinds: { B: "Class B", C: "Class C", D: "Class D", E: "Class E", E700: "E 700 ft", MODEC: "Mode C", R: "Restricted", P: "Prohibited", W: "Warning", MOA: "MOA", A: "Alert" },
  airport: "Airport",
  procedure: "Procedure",
  noProcedure: "No procedure",
  groups: { IAP: "Approaches", STAR: "Arrivals", SID: "Departures" },
  diagram: "Diagram",
  tags: "Tags",
  heightScale: (n) => `Height scale ${n}×`,
  fullScreen: "Full screen",
  details: "Details",
  finalCourse: "Final course",
  glidepath: "Glidepath",
  fafToMap: "FAF to MAP",
  floor700: "Floor 700 AGL",
  view: "3D airspace. Arrow keys turn the view, plus and minus zoom.",
  caption: (edition) => `FAA TAC ${edition} · Not for navigation`,
};

export type Options = {
  /** URL of the area's data folder, e.g. "/skycake/phoenix/". */
  base: string;
  /** Free roam's first scene. Default: every type raised, the whole chart in view. */
  scene?: Scene;
  /** Shorthand for a first scene: types raised at first. */
  types?: Kind[];
  /** Airport picked at first. Default: KPHX, else the first one. */
  airport?: string;
  /** Approach shown at first, by name. */
  approach?: string;
  labels?: Partial<Labels>;
};

const GROUP_ORDER: ProcType[] = ["IAP", "STAR", "SID"];

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "class") e.className = String(v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  e.append(...kids);
  return e;
}

/** Builds the view inside `host`. Resolves once the area's data has loaded and the controls are in place. */
export async function mount(host: HTMLElement, o: Options): Promise<void> {
  const L: Labels = { ...LABELS, ...o.labels, kinds: { ...LABELS.kinds, ...o.labels?.kinds }, groups: { ...LABELS.groups, ...o.labels?.groups } };
  const base = new URL(o.base, location.href);
  const url = (p: string) => new URL(p, base).href;
  const data: AirspaceFile = await fetch(url("area.json")).then((r) => {
    if (!r.ok) throw new Error(`skycake: ${r.status} for ${url("area.json")}`);
    return r.json();
  });
  // The viewer takes absolute URLs.
  data.chart = url(data.chart);
  data.dem = { ...data.dem, url: url(data.dem.url) };
  for (const a of data.airports) if (a.diagram) a.diagram = { ...a.diagram, url: url(a.diagram.url) };

  const first = o.types ?? (["B"] as Kind[]);
  const present = KINDS.filter((k) => data.areas.some((a) => a.kind === k));
  let current = data.airports.find((a) => a.id === o.airport) ?? data.airports.find((a) => a.id === "KPHX") ?? data.airports[0];

  // Markup.
  const tip = h("div", { class: "tip", hidden: true });
  const view = h("div", { class: "view", tabindex: "0", role: "application", "aria-label": L.view }, tip);
  const row = (key: string, label: string) => h("div", { "data-row": key }, h("dt", {}, label), h("dd"));
  const info = h("details", { class: "info", hidden: true }, h("summary", {}, L.details), h("dl", {}, row("course", L.finalCourse), row("glidepath", L.glidepath), row("fafToMap", L.fafToMap)));
  const chips = new Map(present.map((k) => [k, h("button", { type: "button", class: `chip s-${k}`, "aria-pressed": String(first.includes(k)), "data-kind": k }, h("i", { "aria-hidden": "true" }), L.kinds[k])]));
  const apt = h("select", { class: "chip pick apt", "aria-label": L.airport }, ...data.airports.map((a) => h("option", { value: a.id, selected: a.id === current?.id }, a.id)));
  const pick = h("select", { class: "chip pick", "aria-label": L.procedure });
  const db = h("button", { type: "button", class: "chip", "aria-pressed": "false" }, L.diagram);
  const tb = h("button", { type: "button", class: "chip", "aria-pressed": "true" }, L.tags);
  const sb = h("button", { type: "button", class: "chip scale" });
  const fb = h("button", { type: "button", class: "chip full", "aria-label": L.fullScreen, "aria-pressed": "false" });
  // An inline SVG icon, built as elements: no inline styles or HTML strings, so strict CSPs allow it.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 12 12", width: "12", height: "12", fill: "none", stroke: "currentColor", "stroke-width": "1.5", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "path");
  icon.setAttribute("d", "M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8");
  svg.append(icon);
  fb.append(svg);
  const ctl = h("div", { class: "ctl" }, ...chips.values(), h("span", { class: "sp" }), apt, pick, db, tb, sb, fb);
  const fig = h("figure", { class: "skycake" }, view, info, ctl, h("figcaption", {}, L.caption(data.edition)));
  host.replaceChildren(fig);

  const fillPicks = () => {
    pick.replaceChildren(new Option(L.noProcedure, ""));
    for (const t of GROUP_ORDER) {
      const list = current?.procedures.filter((p) => p.type === t) ?? [];
      if (!list.length) continue;
      const g = h("optgroup", { label: L.groups[t] });
      g.append(...list.map((p) => new Option(p.name, `${t}|${p.name}`, false, t === "IAP" && p.name === o.approach)));
      pick.append(g);
    }
    db.hidden = !current?.diagram;
  };
  fillPicks();

  // three.js and the chart load only when the view comes into sight.
  await new Promise<void>((resolve) => {
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      resolve();
    }).observe(view);
  });
  const { build, fraction, START_SCALE } = await import("./viewer.js");
  const show = (a: Area | null, x: number, y: number) => {
    tip.hidden = !a;
    if (!a) return;
    tip.textContent = "";
    tip.append(Object.assign(document.createElement("span"), { className: "name", textContent: a.name }), a.kind === "E700" ? L.floor700 : fraction(a, data.ground));
    tip.style.transform = `translate(${Math.min(x + 12, view.clientWidth - tip.offsetWidth - 8)}px, ${Math.max(y - tip.offsetHeight - 8, 8)}px)`;
  };
  const v = await build(view, data, show, (kind, on) => chips.get(kind)?.setAttribute("aria-pressed", String(on)));
  const start: Scene = o.scene ?? shorthand(o, data) ?? freeRoamScene(data);
  const loaded = new Map<string, Promise<Procedure[]>>();
  const procs = (id: string) => {
    if (!loaded.has(id)) loaded.set(id, fetch(url(`procedures/${id}.json`)).then((r) => (r.ok ? r.json() : [])).catch(() => []));
    return loaded.get(id)!;
  };
  let shown: Procedure | null = null;
  const show3d = async (now = false) => {
    const scene: Scene = { ...start, diagram: db.getAttribute("aria-pressed") === "true" ? (current?.id ?? null) : null };
    if (shown) {
      scene.procedures = [{ airport: shown.airport, name: shown.name }];
      scene.camera = { frame: [{ procedure: { airport: shown.airport, name: shown.name } }] };
    }
    const resolved = resolve(scene, data);
    const files = await Promise.all(resolved.procedures.map(async (r) => (await procs(r.airport)).find((p) => p.name === r.name)));
    return v.apply(resolved, files.filter((p): p is Procedure => !!p), now);
  };
  await show3d(true);

  for (const [kind, b] of chips) b.addEventListener("click", () => v.raise(kind, b.getAttribute("aria-pressed") !== "true"));
  let scale = START_SCALE;
  const setScale = () => {
    sb.textContent = `${scale}×`;
    sb.setAttribute("aria-label", L.heightScale(scale));
  };
  setScale();
  sb.addEventListener("click", () => {
    scale = scale === START_SCALE ? 1 : START_SCALE;
    setScale();
    v.exaggerate(scale);
  });
  tb.addEventListener("click", () => {
    const on = tb.getAttribute("aria-pressed") !== "true";
    tb.setAttribute("aria-pressed", String(on));
    v.tags(on);
  });

  // iPhone Safari has no element fullscreen, so the class fills the window and the real thing is added where it exists.
  const setFull = (on: boolean) => {
    fig.classList.toggle("full", on);
    fb.setAttribute("aria-pressed", String(on));
    document.documentElement.classList.toggle("skycake-full", on);
  };
  fb.addEventListener("click", () => {
    const on = !fig.classList.contains("full");
    setFull(on);
    if (on) fig.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen();
  });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) setFull(false);
  });

  // Keyboard: arrows turn the view, + and - zoom.
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

  // Procedures load one airport at a time; the newest pick wins if an older load finishes after it.
  let ticket = 0;
  const choose = async () => {
    const mine = ++ticket;
    const [type, name] = pick.value.split("|");
    const a = pick.value && current ? ((await procs(current.id)).find((p) => p.type === type && p.name === name) ?? null) : null;
    if (mine !== ticket) return;
    shown = a;
    show3d();
    const rows = { course: a?.course == null ? null : `${String(a.course).padStart(3, "0")}°`, glidepath: a?.glidepath == null ? null : `${a.glidepath.toFixed(2)}°`, fafToMap: a?.fafToMap == null ? null : `${a.fafToMap} NM` };
    info.hidden = Object.values(rows).every((r) => r === null);
    for (const [k, text] of Object.entries(rows)) {
      const r = info.querySelector<HTMLElement>(`[data-row="${k}"]`)!;
      r.hidden = text === null;
      r.querySelector("dd")!.textContent = text;
    }
  };
  apt.addEventListener("change", () => {
    current = data.airports.find((a) => a.id === apt.value) ?? current;
    o = { ...o, approach: undefined };
    fillPicks();
    if (db.getAttribute("aria-pressed") === "true") {
      if (!current?.diagram) db.setAttribute("aria-pressed", "false");
    }
    choose();
  });
  db.addEventListener("click", () => {
    const on = db.getAttribute("aria-pressed") !== "true";
    db.setAttribute("aria-pressed", String(on));
    show3d();
  });
  pick.addEventListener("change", choose);
  if (pick.value) choose();
}
