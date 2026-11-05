import { type Kind } from "./airspace.js";
import type { ProcType } from "./procedure.js";
import { type Scene } from "./scene.js";
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
export declare const LABELS: Labels;
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
/** Builds the view inside `host`. Resolves once the area's data has loaded and the controls are in place. */
export declare function mount(host: HTMLElement, o: Options): Promise<void>;
