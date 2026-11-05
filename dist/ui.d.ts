import type { Kind } from "./airspace.js";
import type { ProcType } from "./procedure.js";
import { type Scene } from "./scene.js";
/** On-screen words. Each site can supply its own; these are placeholders. */
export type Labels = {
    kinds: Record<Kind, string>;
    groups: Record<ProcType, string>;
    airspace: string;
    search: string;
    noMatches: string;
    remove: (name: string) => string;
    procedureTab: string;
    viewTab: string;
    controls: string;
    diagram: string;
    tags: string;
    heightScale: (n: number) => string;
    fullScreen: string;
    finalCourse: string;
    glidepath: string;
    fafToMap: string;
    floor700: string;
    view: string;
    caption: (edition: string) => string;
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
