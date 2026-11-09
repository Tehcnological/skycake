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
export declare function plateView(_c: Context, _el: {
    title: HTMLElement;
    body: HTMLElement;
}, _on: {
    show: (ref: ProcedureRef) => void;
}): Plates;
/** A chart in the picker, with the airport whose index listed it (a shared arrival is one chart per airport). */
export type PlatePick = {
    airport: string;
    entry: ChartEntry;
};
/**
 * The picker's order: for each shown procedure in turn, the first chart of its airport that draws it, then every other
 * chart of the current airport in index (FAA) order. Each chart once; a procedure whose index is not loaded is skipped.
 */
export declare function pickOrder(indexes: Map<string, ChartEntry[]>, refs: ProcedureRef[], airport: string | null): PlatePick[];
/** The chart for a shown procedure: the current one when it draws it, else the first that does. */
export declare function chartFor(entries: ChartEntry[], name: string, current: ChartEntry | null): ChartEntry | null;
/** Picking a chart shows the procedures it draws. */
export declare const pickRefs: (p: PlatePick) => ProcedureRef[];
/** The arrows for page `page` (from 1) of `pages`; none for a chart of one page. */
export declare function pageArrows(pages: number, page: number): {
    back: boolean;
    next: boolean;
} | null;
/** The chart's place: CSS `translate(x px, y px) scale(s)`, origin top left. (`Fit` is taken by diagram.ts.) */
export type PanZoom = {
    x: number;
    y: number;
    s: number;
};
/** The whole chart in the box, centred. */
export declare function fitChart(img: {
    w: number;
    h: number;
}, box: {
    w: number;
    h: number;
}): PanZoom;
/** Zooms by `factor`, the scale clamped to min..max, keeping the chart point under `at` where it is. */
export declare function zoomAbout(t: PanZoom, factor: number, at: [x: number, y: number], min: number, max: number): PanZoom;
