// The procedure chart viewer, in free roam's plate panel. A stub for now: the chart-viewer branch fills it in.
// Free roam builds it once with the panel's title slot and body, tells it what is shown as that changes, and asks it
// whether the area has charts at all (the panel's open buttons show only then).
import type { Context } from "./freeroam.js";
import type { ProcedureRef } from "./scene.js";
import type { ChartEntry } from "./tpp.js";

export type Plates = {
  /** The area has charts to show; until then free roam hides the panel's open buttons. */
  has: boolean;
  /** The procedures shown and the current airport, whenever either changes. */
  procedures: (refs: ProcedureRef[], airport: string | null) => void;
  destroy: () => void;
};

/** `show` adds a procedure in 3D, as picking it in the search box does. */
export function plateView(_c: Context, _el: { title: HTMLElement; body: HTMLElement }, _on: { show: (ref: ProcedureRef) => void }): Plates {
  return { has: false, procedures: () => {}, destroy: () => {} };
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
