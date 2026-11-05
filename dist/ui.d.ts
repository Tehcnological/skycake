import { type ChartName, type Kind, type Mode } from "./airspace.js";
import type { ProcType } from "./procedure.js";
import { type Scene } from "./scene.js";
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
};
export declare const LABELS: Labels;
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
};
/** Builds the view inside `host`. Resolves once the view has loaded and shows its first scene. */
export declare function mount(host: HTMLElement, o: Options): Promise<void>;
