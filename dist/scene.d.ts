import { type AirspaceFile, type Kind } from "./airspace.js";
export type ProcedureRef = {
    airport: string;
    name: string;
};
export type AreaRef = {
    area: string;
};
/** diagram: an airport diagram's area, by airport id. */
export type Target = AreaRef | {
    fix: string;
} | {
    procedure: ProcedureRef;
} | {
    point: [lat: number, lon: number];
} | {
    diagram: string;
};
export type Camera = "fit" | "top" | {
    frame: Target[];
    tilt?: number;
} | {
    azimuth: number;
    tilt: number;
    distance: number;
    target: [lat: number, lon: number];
};
export type Scene = {
    /** null: leave the camera where it is. */
    camera?: Camera | null;
    /** Raised; everything else lies flat on the chart. */
    raise?: (Kind | AreaRef)[];
    /** Any number at once. draw (leg by leg) plays in walkthroughs. */
    procedures?: (ProcedureRef & {
        draw?: boolean;
    })[];
    /** An airport id. */
    diagram?: string | null;
    height?: 1 | 4;
    tags?: boolean;
    /** "tac": the TAC over its own map area and the sectional outside it; "sectional": the sectional everywhere. */
    chart?: "tac" | "sectional";
};
/** What the viewer applies: every field filled in, names checked. raised holds area ids. */
export type Resolved = {
    camera: Camera | null;
    raised: Set<string>;
    procedures: ProcedureRef[];
    diagram: string | null;
    height: 1 | 4;
    tags: boolean;
    chart: "tac" | "sectional";
};
export declare class SceneError extends Error {
}
export declare function resolve(scene: Scene, data: AirspaceFile): Resolved;
/** Procedures the camera frames that the scene does not show: their files load for framing only. */
export declare function framedOnly(scene: Scene): ProcedureRef[];
/** Free roam's first view: every airspace type in the area raised, the whole chart in view. */
export declare function freeRoamScene(data: AirspaceFile): Scene;
/** mount()'s older options as a first scene; undefined when none is given. */
export declare function shorthand(o: {
    types?: Kind[];
    airport?: string;
    approach?: string;
}, data: AirspaceFile): Scene | undefined;
/**
 * The first scene from mount()'s options. A name the data no longer has (an FAA cycle renamed an approach, a typo)
 * falls back to free roam's first view, and warn() says why, so the embed still works.
 */
export declare function firstScene(o: {
    scene?: Scene;
    types?: Kind[];
    airport?: string;
    approach?: string;
}, data: AirspaceFile, warn: (message: string) => void): Scene;
