// The procedure chart viewer: the plate panel (its head, full screen, close and the divider) and, filling its body,
// the charts. Free roam, walkthroughs and quizzes build it once, place its panel, tell it what is shown as that
// changes, and ask whether the area has charts at all (their open buttons show only then).
import { h, icon, ICONS, type Context } from "./freeroam.js";
import type { ProcedureRef } from "./scene.js";
import type { ChartEntry } from "./tpp.js";

export type PlateMode = "split" | "full" | null;
export type Plates = {
  /** The area has charts to show; until then free roam hides the panel's open buttons. */
  has: boolean;
  /** The panel (aside.sc-plate) for the caller to place; null when the area has no charts. */
  el: HTMLElement | null;
  mode: () => PlateMode;
  set: (mode: PlateMode) => void;
  /** The procedures shown and the current airport, whenever either changes. */
  procedures: (refs: ProcedureRef[], airport: string | null) => void;
  destroy: () => void;
};

/**
 * The panel beside the map on desktop and on a phone held sideways, over it on an upright phone; full screen covers
 * the map. The fig's sc-plate class opens it, sc-plate-full makes it full screen. `show` adds a procedure in 3D, as
 * picking it in the search box does.
 */
export function plateView(c: Context, on: {
  show: (ref: ProcedureRef) => void;
  /** Every mode change, from inside the panel or set(). */
  mode?: (m: PlateMode) => void;
  /** Where focus goes when the panel closes with focus inside it. Default: the view. */
  back?: () => HTMLElement;
  /** The map's room on an upright phone, for the divider. Default: the figure's box. */
  room?: () => { top: number; bottom: number };
}): Plates {
  if (!c.data.plates) return { has: false, el: null, mode: () => null, set: () => {}, procedures: () => {}, destroy: () => {} };
  const { fig, labels: L } = c;
  const title = h("span", { class: "sc-plate-title" }, L.plate);
  const full = h("button", { type: "button", class: "sc-x", "aria-pressed": "false" }, icon(ICONS.full, "0 0 12 12"));
  const close = h("button", { type: "button", class: "sc-x", "aria-label": L.close }, icon(ICONS.close));
  const body = h("div", { class: "sc-plate-body" });
  const divider = h("div", { class: "sc-divider", role: "separator", tabindex: "0", "aria-label": L.resize, "aria-controls": "sc-plate", "aria-valuemin": "25", "aria-valuemax": "75" });
  const el = h("aside", { class: "sc-plate", id: "sc-plate", "aria-label": L.plate }, divider, h("div", { class: "sc-plate-head" }, title, full, close), body);

  let now: PlateMode = null;
  const set = (mode: PlateMode) => {
    now = mode;
    fig.classList.toggle("sc-plate", mode !== null);
    fig.classList.toggle("sc-plate-full", mode === "full");
    full.setAttribute("aria-pressed", String(mode === "full"));
    full.setAttribute("aria-label", mode === "full" ? L.split : L.fullScreen);
    on.mode?.(mode);
  };
  const shut = () => {
    set(null);
    (on.back?.() ?? fig.querySelector<HTMLElement>(".view")!).focus();
  };
  full.addEventListener("click", () => set(now === "full" ? "split" : "full"));
  close.addEventListener("click", shut);
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    shut();
  });
  set(null);

  // The divider (drag it, or arrow keys) sets the panel's share of the map's room: its width beside the map, its
  // height over it on an upright phone.
  const upright = matchMedia("(max-width: 860px) and (orientation: portrait)");
  const setShare = (x: number) => {
    const share = Math.min(0.75, Math.max(0.25, x));
    fig.style.setProperty("--sc-share", share.toFixed(3));
    divider.setAttribute("aria-valuenow", String(Math.round(share * 100)));
  };
  const drawUpright = () => divider.setAttribute("aria-orientation", upright.matches ? "horizontal" : "vertical");
  upright.addEventListener("change", drawUpright);
  drawUpright();
  setShare(0.38);
  const shareNow = () => Number(fig.style.getPropertyValue("--sc-share"));
  divider.addEventListener("pointerdown", (e) => {
    divider.setPointerCapture(e.pointerId);
    const box = fig.getBoundingClientRect();
    const { top, bottom } = upright.matches && on.room ? on.room() : box;
    const move = (m: PointerEvent) => setShare(upright.matches ? (m.clientY - top) / (bottom - top) : (box.right - m.clientX) / box.width);
    divider.addEventListener("pointermove", move);
    // Fires after pointerup and after a cancelled drag alike.
    divider.addEventListener("lostpointercapture", () => divider.removeEventListener("pointermove", move), { once: true });
  });
  divider.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: 0.05, ArrowRight: -0.05, ArrowUp: -0.05, ArrowDown: 0.05 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    setShare(shareNow() + step);
  });

  return {
    has: true,
    el,
    mode: () => now,
    set,
    procedures: () => {},
    destroy: () => {
      upright.removeEventListener("change", drawUpright);
      el.remove();
      fig.classList.remove("sc-plate", "sc-plate-full");
    },
  };
}

/** A chart in the picker, with the airport whose index listed it (a shared arrival is one chart per airport). */
export type PlatePick = { airport: string; entry: ChartEntry };

/**
 * The picker's order: for each shown procedure in turn, the first chart of its airport that draws it, then every other
 * chart of the current airport in index (FAA) order. Each chart once; a procedure whose index is not loaded is skipped.
 */
export function pickOrder(indexes: Map<string, ChartEntry[]>, refs: ProcedureRef[], airport: string | null): PlatePick[] {
  const out: PlatePick[] = [];
  const put = (a: string, entry: ChartEntry | undefined) => {
    if (entry && !out.some((p) => p.airport === a && p.entry === entry)) out.push({ airport: a, entry });
  };
  for (const r of refs) put(r.airport, indexes.get(r.airport)?.find((x) => x.procedures.includes(r.name)));
  if (airport !== null) for (const x of indexes.get(airport) ?? []) put(airport, x);
  return out;
}

/** The chart for a shown procedure: the current one when it draws it, else the first that does. */
export function chartFor(entries: ChartEntry[], name: string, current: ChartEntry | null): ChartEntry | null {
  if (current?.procedures.includes(name)) return current;
  return entries.find((x) => x.procedures.includes(name)) ?? null;
}

/** Picking a chart shows the procedures it draws. */
export const pickRefs = (p: PlatePick): ProcedureRef[] => p.entry.procedures.map((name) => ({ airport: p.airport, name }));

/** The arrows for page `page` (from 1) of `pages`; none for a chart of one page. */
export function pageArrows(pages: number, page: number): { back: boolean; next: boolean } | null {
  return pages > 1 ? { back: page > 1, next: page < pages } : null;
}

/** The chart's place: CSS `translate(x px, y px) scale(s)`, origin top left. (`Fit` is taken by diagram.ts.) */
export type PanZoom = { x: number; y: number; s: number };

/** The whole chart in the box, centred. */
export function fitChart(img: { w: number; h: number }, box: { w: number; h: number }): PanZoom {
  const s = Math.min(box.w / img.w, box.h / img.h);
  return { x: (box.w - img.w * s) / 2, y: (box.h - img.h * s) / 2, s };
}

/** Zooms by `factor`, the scale clamped to min..max, keeping the chart point under `at` where it is. */
export function zoomAbout(t: PanZoom, factor: number, at: [x: number, y: number], min: number, max: number): PanZoom {
  const s = Math.min(max, Math.max(min, t.s * factor));
  const k = s / t.s;
  return { x: at[0] - (at[0] - t.x) * k, y: at[1] - (at[1] - t.y) * k, s };
}
