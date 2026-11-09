import { type AirspaceFile, type ChartName, type Kind } from "./airspace.js";
export type ProcedureRef = {
    airport: string;
    name: string;
};
export type AreaRef = {
    area: string;
};
/** diagram: an airport diagram's area, by airport id. airport: an airport by id. */
export type Target = AreaRef | {
    fix: string;
} | {
    procedure: ProcedureRef;
} | {
    point: [lat: number, lon: number];
} | {
    diagram: string;
} | {
    airport: string;
};
/** A procedure chart page. chart: the FAA's chart name as in charts/<airport>.json; page: 1-based. */
export type PlateRef = {
    airport: string;
    chart: string;
    page?: number;
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
    /** Drawn emphasised. */
    highlight?: Target[];
    /** A fixed spot, or flying a procedure for `seconds`. */
    airplane?: {
        at: [lat: number, lon: number, ft: number];
    } | {
        along: ProcedureRef;
        seconds: number;
    };
    /** An airport id. */
    diagram?: string | null;
    height?: 1 | 4;
    tags?: boolean;
    /** "tac": the TAC over its own map area and the sectional outside it; "sectional": the sectional everywhere; "area": the IFR area chart over its own map and the low outside it; "low": the IFR low everywhere. */
    chart?: ChartName;
    /** Opens the plate panel to this chart in split; null closes it; left out, the panel stays as it is. */
    plate?: PlateRef | null;
};
/** What the viewer applies: every field filled in, names checked. raised holds area ids. */
export type Resolved = {
    camera: Camera | null;
    raised: Set<string>;
    procedures: (ProcedureRef & {
        draw: boolean;
    })[];
    highlight: Target[];
    airplane: Scene["airplane"] | null;
    diagram: string | null;
    height: 1 | 4;
    tags: boolean;
    chart: ChartName;
};
export declare class SceneError extends Error {
}
export declare function resolve(scene: Scene, data: AirspaceFile): Resolved;
/** The scene without playback (highlight, airplane, draw): free roam gets a still scene. */
export declare function stripPlayback(scene: Scene): Scene;
/** Procedures the camera frames that the scene does not show: their files load for framing only. */
export declare function framedOnly(scene: Scene): ProcedureRef[];
/** Every procedure a scene loads: drawn, framed only, and the one the airplane flies. */
export declare const sceneRefs: (scene: Scene) => ProcedureRef[];
/**
 * The scene without each field that names something the data lacks, so the rest still shows; warn() says what was
 * left out. hasFix: whether a fix name is known (fixes live in the procedure files, which resolve() does not read).
 */
export declare function usable(scene: Scene, data: AirspaceFile, hasFix: (name: string) => boolean, warn: (message: string) => void): Scene;
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
