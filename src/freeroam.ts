// Free roam's controls, over the 3D view. Desktop: floating panels in the corners (Airspace top left, search top
// right, view buttons bottom right). Phone: a tab bar along the bottom, menus as sheets above it. One DOM for both;
// style.css decides what shows. Every change goes through roam.ts and reaches the viewer as a scene.
import { KINDS, chartsIn, modeOf, pickChart, shownIn, type AirspaceFile, type ChartName, type Kind, type Mode } from "./airspace.js";
import type { Procedure } from "./procedure.js";
import { add, pickAirport, raiseNow, remove, sceneOf, start, toggleDiagram, type Roam } from "./roam.js";
import { SceneError, framedOnly, resolve, type ProcedureRef, type Scene } from "./scene.js";
import { airportList, proceduresAt, search, type Group } from "./search.js";
import type { Labels } from "./ui.js";
import type { View } from "./viewer.js";

export type Context = {
  fig: HTMLElement;
  view: View;
  data: AirspaceFile;
  first: Scene;
  airport: string | null;
  labels: Labels;
  /** A procedure file by airport, cached by the caller. */
  procedures: (airport: string) => Promise<Procedure[]>;
  startScale: number;
};

const SVG = "http://www.w3.org/2000/svg";
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
/** An inline stroke icon built as elements, so strict CSPs allow it. */
function icon(paths: string[], box = "0 0 24 24"): SVGSVGElement {
  const s = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: box, width: "20", height: "20", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) s.setAttribute(k, v);
  for (const d of paths) {
    const p = document.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    s.append(p);
  }
  return s;
}
const ICONS = {
  layers: ["M12 3 3 8l9 5 9-5-9-5Z", "m3 13 9 5 9-5"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m20 20-3.5-3.5"],
  procedure: ["M4 19c4-1 6-5 8-9s5-6 8-6"],
  diagram: ["M4 18 18 4", "M8 20 20 8", "M4 9h6"],
  tags: ["M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z", "M6 12h12"],
  view: ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  full: ["M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8"],
  close: ["M6 6l12 12M18 6 6 18"],
};

/** Resolves once the first scene is showing. */
export function freeRoam(c: Context): Promise<void> {
  const { fig, view: v, data, labels: L } = c;
  const has = (a: string) => !!data.airports.find((x) => x.id === a)?.diagram;
  let r: Roam = start(c.first, c.airport ?? undefined);
  // Once the first scene is showing, every change keeps what is raised on screen.
  let shown = false;
  let tagsOn = c.first.tags ?? true;
  let scale = c.first.height ?? c.startScale;
  // Which chart is under the airspace: VFR or IFR, then one of that mode's charts. Each mode keeps the last one picked.
  let chart = pickChart(data.charts, c.first.chart);
  const lastIn: Partial<Record<Mode, ChartName>> = { [modeOf(chart)]: chart };
  const present = KINDS.filter((k) => data.areas.some((a) => a.kind === k));

  // Airspace: a button and its list (desktop top left; phone: a sheet from the Airspace tab).
  const rows = new Map(present.map((k) => {
    const box = h("input", { type: "checkbox" });
    const row = h("label", { class: `sc-row s-${k}` }, h("i", { "aria-hidden": "true" }), h("span", {}, L.kinds[k]), box);
    box.addEventListener("change", () => v.raise(k, box.checked));
    return [k, { row, box }] as const;
  }));
  const kindList = h("div", { class: "sc-panel sc-kinds", id: "sc-kinds" }, ...[...rows.values()].map((x) => x.row));
  const kindButton = h("button", { type: "button", class: "sc-pill", "aria-expanded": "false", "aria-controls": "sc-kinds" }, icon(ICONS.layers), L.airspace);
  const topLeft = h("div", { class: "sc-tl" }, kindButton, kindList);

  // Search, its results and the shown procedures (top right; phone: top).
  const input = h("input", { type: "search", "aria-label": L.search, placeholder: L.search, autocomplete: "off", spellcheck: "false" });
  const results = h("div", { class: "sc-panel sc-results", role: "listbox", "aria-label": L.search, hidden: true });
  const chips = h("div", { class: "sc-chips" });
  const topRight = h("div", { class: "sc-tr" }, h("label", { class: "sc-search" }, icon(ICONS.search), input), results, chips);

  // View buttons (desktop bottom right; phone: a sheet from the View tab).
  // data-tip: the name in words, shown on hover or focus (desktop) and under the button (phone).
  const round = (label: string, tip: string, kids: (Node | string)[], cls = "") => h("button", { type: "button", class: `sc-round ${cls}`, "aria-label": label, "data-tip": tip }, ...kids);
  const diagramButton = round(L.diagram, L.diagram, [icon(ICONS.diagram)]);
  const tagsButton = round(L.tags, L.tags, [icon(ICONS.tags)]);
  const scaleButton = round(L.heightScale(scale), L.height, [`${scale}×`], "sc-scale");
  const modeButton = round(L.mode, L.mode, [], "sc-mode");
  modeButton.hidden = !chartsIn(data.charts, "ifr").length;
  const chartButton = round(L.chart, L.chart, [], "sc-chart");
  const fullButton = round(L.fullScreen, L.fullScreen, [icon(ICONS.full, "0 0 12 12")]);
  const bottomRight = h("div", { class: "sc-br" }, diagramButton, tagsButton, scaleButton, modeButton, chartButton, fullButton);
  const caption = fig.querySelector<HTMLElement>(".sc-caption");

  // Phone tab bar.
  const tab = (label: string, paths: string[]) => h("button", { type: "button", class: "sc-tab" }, icon(paths), h("span", {}, label));
  const tabs = { airspace: tab(L.airspace, ICONS.layers), procedure: tab(L.procedureTab, ICONS.procedure), diagram: tab(L.diagram, ICONS.diagram), view: tab(L.viewTab, ICONS.view), close: tab(L.close, ICONS.close) };
  const tabBar = h("nav", { class: "sc-tabs", "aria-label": L.controls }, ...Object.values(tabs));

  // On a phone the map in the page is a preview the page scrolls past; a tap opens it, and only then does it take touches.
  const openButton = h("button", { type: "button", class: "sc-open" }, h("span", { class: "sc-pill" }, icon(ICONS.full, "0 0 12 12"), L.open));
  fig.querySelector(".view")!.after(openButton, topLeft, topRight, bottomRight);
  fig.append(tabBar);

  const sheet = (name: "kinds" | "view" | null) => {
    fig.classList.toggle("sc-open-kinds", name === "kinds");
    fig.classList.toggle("sc-open-view", name === "view");
    kindButton.setAttribute("aria-expanded", String(name === "kinds"));
    tabs.airspace.setAttribute("aria-pressed", String(name === "kinds"));
    tabs.view.setAttribute("aria-pressed", String(name === "view"));
  };
  kindButton.addEventListener("click", () => sheet(fig.classList.contains("sc-open-kinds") ? null : "kinds"));
  tabs.airspace.addEventListener("click", () => sheet(fig.classList.contains("sc-open-kinds") ? null : "kinds"));
  tabs.view.addEventListener("click", () => sheet(fig.classList.contains("sc-open-view") ? null : "view"));
  tabs.procedure.addEventListener("click", () => {
    sheet(null);
    input.focus();
  });

  // Every change: the roam state becomes a scene, procedure files load, the viewer shows it. The newest change wins.
  let ticket = 0;
  let files: Procedure[] = [];
  const refresh = async (now = false) => {
    const mine = ++ticket;
    const wanted = sceneOf(r);
    const load = (refs: ProcedureRef[]) => Promise.all(refs.map(async (p) => (await c.procedures(p.airport)).find((x) => x.name === p.name)));
    const [loaded, framing] = await Promise.all([load(wanted.procedures ?? []), load(framedOnly(wanted))]);
    if (mine !== ticket) return;
    // The toggles are read now, after the files arrived, so one pressed during the load is not undone.
    const scene: Scene = { ...wanted, raise: raiseNow(c.first, shown ? v.raisedAreas() : null), tags: tagsOn, height: scale as 1 | 4, chart };
    let resolved;
    try {
      resolved = resolve(scene, data);
    } catch (e) {
      if (!(e instanceof SceneError)) throw e;
      console.warn(`skycake: ${e.message}`);
      return;
    }
    files = loaded.filter((p): p is Procedure => !!p);
    drawChips();
    const diagram = r.airport !== null && has(r.airport);
    diagramButton.hidden = tabs.diagram.hidden = !diagram;
    diagramButton.setAttribute("aria-pressed", String(r.diagram));
    tabs.diagram.setAttribute("aria-pressed", String(r.diagram));
    shown = true;
    await v.apply(resolved, files, now, framing.filter((p): p is Procedure => !!p));
  };

  const drawChips = () => {
    chips.replaceChildren(...r.procedures.map((p) => {
      const file = files.find((f) => f.airport === p.airport && f.name === p.name);
      const x = h("button", { type: "button", class: "sc-x", "aria-label": L.remove(`${p.airport} ${p.name}`) }, icon(ICONS.close));
      x.addEventListener("click", () => {
        r = remove(r, p);
        refresh();
      });
      const chip = h("div", { class: "sc-chip" }, h("span", { class: "sc-apt" }, p.airport), h("span", { class: "sc-name" }, p.name), x);
      if (file?.type !== "IAP") return chip;
      const fact = (label: string, value: string | null) => (value === null ? [] : [h("div", {}, h("dt", {}, label), h("dd", {}, value))]);
      const info = h("dl", { class: "sc-info" },
        ...fact(L.finalCourse, file.course === null ? null : `${String(file.course).padStart(3, "0")}°`),
        ...fact(L.glidepath, file.glidepath === null ? null : `${file.glidepath.toFixed(2)}°`),
        ...fact(L.fafToMap, file.fafToMap === null ? null : `${file.fafToMap} NM`));
      return h("div", { class: "sc-panel sc-procedure" }, chip, ...(info.children.length ? [info] : []));
    }));
  };

  // Results. Typing finds procedures by name. With the box empty: the airport list, or, once an airport is picked
  // (from the list or its tag on the chart), every procedure there.
  let browse: string | null = null;
  const option = (kids: (Node | string)[], pick: () => void, cls = "") => {
    const opt = h("button", { type: "button", role: "option", class: `sc-option ${cls}` }, ...kids);
    opt.addEventListener("click", pick);
    return opt;
  };
  const listGroups = (groups: Group[]) => {
    for (const g of groups) {
      results.append(h("p", { class: "sc-group" }, `${g.airport} · ${L.groups[g.type]}`));
      for (const hit of g.hits) {
        results.append(option([hit.procedure.name], () => {
          r = add(r, { airport: hit.airport, name: hit.procedure.name }, has);
          // The list follows the airport the diagram now follows.
          if (browse !== null) browse = hit.airport;
          input.value = "";
          results.hidden = true;
          refresh();
        }));
      }
    }
  };
  const showAirport = (id: string) => {
    browse = id;
    r = pickAirport(r, id, has);
    input.value = "";
    showResults();
    refresh();
  };
  const showResults = () => {
    const q = input.value;
    results.replaceChildren();
    const at = browse === null ? undefined : data.airports.find((a) => a.id === browse);
    if (q.trim()) {
      const groups = search(q, data.airports);
      if (!groups.length) results.append(h("p", { class: "sc-none" }, L.noMatches));
      listGroups(groups);
    } else if (at) {
      results.append(option([L.airports], () => {
        browse = null;
        showResults();
        input.focus();
      }, "sc-back"));
      listGroups(proceduresAt(at));
    } else {
      results.append(h("p", { class: "sc-group" }, L.airports));
      for (const a of airportList(data.airports)) results.append(option([h("b", {}, a.id), h("span", {}, a.name)], () => showAirport(a.id), "sc-airport"));
    }
    results.hidden = false;
  };
  input.addEventListener("input", showResults);
  input.addEventListener("focus", showResults);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") results.hidden = true;
  });
  fig.addEventListener("pointerdown", (e) => {
    if (!topRight.contains(e.target as Node)) results.hidden = true;
  });

  const toggleDiagramNow = () => {
    r = toggleDiagram(r, has);
    refresh();
  };
  diagramButton.addEventListener("click", toggleDiagramNow);
  tabs.diagram.addEventListener("click", toggleDiagramNow);
  const setTags = () => tagsButton.setAttribute("aria-pressed", String(tagsOn));
  tagsButton.addEventListener("click", () => {
    tagsOn = !tagsOn;
    setTags();
    v.tags(tagsOn);
  });
  setTags();
  scaleButton.addEventListener("click", () => {
    scale = scale === 1 ? 4 : 1;
    scaleButton.textContent = `${scale}×`;
    scaleButton.setAttribute("aria-label", L.heightScale(scale));
    v.exaggerate(scale);
  });

  const drawChart = () => {
    const mode = modeOf(chart);
    modeButton.textContent = L.modes[mode];
    modeButton.setAttribute("aria-label", `${L.mode}: ${L.modes[mode]}`);
    chartButton.textContent = L.charts[chart];
    chartButton.setAttribute("aria-label", `${L.chart}: ${L.charts[chart]}`);
    chartButton.hidden = chartsIn(data.charts, mode).length < 2;
    for (const [k, { row }] of rows) row.hidden = !shownIn(mode, k);
    if (caption) caption.textContent = L.caption(data.edition, chart);
  };
  const setChart = (next: ChartName) => {
    chart = next;
    lastIn[modeOf(chart)] = chart;
    // Comparing the charts: the camera stays on what is being looked at.
    r = { ...r, camera: null };
    drawChart();
    refresh();
  };
  modeButton.addEventListener("click", () => {
    const mode: Mode = modeOf(chart) === "vfr" ? "ifr" : "vfr";
    setChart(lastIn[mode] ?? chartsIn(data.charts, mode)[0]);
  });
  chartButton.addEventListener("click", () => {
    const here = chartsIn(data.charts, modeOf(chart));
    setChart(here[(here.indexOf(chart) + 1) % here.length]);
  });
  drawChart();

  // iPhone Safari has no element fullscreen, so the class fills the window and the real thing is added where it exists.
  const phone = matchMedia("(max-width: 860px) and (pointer: coarse)");
  const drawPhone = () => {
    fig.classList.toggle("sc-preview", phone.matches && !fig.classList.contains("full"));
    fullButton.hidden = phone.matches;
    tabs.close.hidden = !phone.matches;
  };
  const setFull = (on: boolean) => {
    fig.classList.toggle("full", on);
    fullButton.setAttribute("aria-pressed", String(on));
    document.documentElement.classList.toggle("skycake-full", on);
    drawPhone();
  };
  const goFull = (on: boolean) => {
    setFull(on);
    if (on) fig.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen();
  };
  fullButton.addEventListener("click", () => goFull(!fig.classList.contains("full")));
  openButton.addEventListener("click", () => goFull(true));
  tabs.close.addEventListener("click", () => {
    sheet(null);
    results.hidden = true;
    goFull(false);
  });
  phone.addEventListener("change", drawPhone);
  drawPhone();

  // CSS covers most browsers; iPhone Safari also needs its own gesture events stopped, or a pinch zooms the page.
  const taken = () => !fig.classList.contains("sc-preview");
  for (const t of ["gesturestart", "gesturechange", "gestureend", "dblclick"]) fig.addEventListener(t, (e) => taken() && e.preventDefault());
  fig.addEventListener("touchmove", (e) => fig.classList.contains("full") && e.touches.length > 1 && e.preventDefault(), { passive: false });
  // A long press on the map would open the browser's menu. The search box keeps its own, for paste.
  if (matchMedia("(pointer: coarse)").matches) fig.addEventListener("contextmenu", (e) => e.target instanceof HTMLInputElement || e.preventDefault());
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) setFull(false);
  });

  // A tap on an airport's tag on the chart lists its procedures.
  c.fig.addEventListener("skycake-airport", (e) => {
    sheet(null);
    showAirport((e as CustomEvent).detail.airport);
  });
  // The chip and type list state follows the viewer, including areas raised by tapping the chart.
  const onRaised = (kind: Kind, on: boolean) => {
    const x = rows.get(kind);
    if (!x) return;
    x.box.checked = on;
    x.row.classList.toggle("on", on);
  };
  c.fig.addEventListener("skycake-raised", (e) => onRaised((e as CustomEvent).detail.kind, (e as CustomEvent).detail.on));
  sheet(null);
  return refresh(true);
}
