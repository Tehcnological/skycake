import { type Kind } from "./airspace.js";
import type { ProcType } from "./procedure.js";
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
    /** Types raised at first. Default: Class B. */
    types?: Kind[];
    /** Airport picked at first. Default: KPHX, else the first one. */
    airport?: string;
    /** Approach shown at first, by name. */
    approach?: string;
    labels?: Partial<Labels>;
};
/** Builds the view inside `host`. Resolves once the area's data has loaded and the controls are in place. */
export declare function mount(host: HTMLElement, o: Options): Promise<void>;
