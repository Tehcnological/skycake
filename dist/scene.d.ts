import { type AirspaceFile, type Kind } from "./airspace.js";
export type ProcedureRef = {
    airport: string;
    name: string;
};
export type AreaRef = {
    area: string;
};
export type Target = AreaRef | {
    fix: string;
} | {
    procedure: ProcedureRef;
} | {
    point: [lat: number, lon: number];
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
    camera?: Camera;
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
};
/** What the viewer applies: every field filled in, names checked. raised holds area ids. */
export type Resolved = {
    camera: Camera;
    raised: Set<string>;
    procedures: ProcedureRef[];
    diagram: string | null;
    height: 1 | 4;
    tags: boolean;
};
export declare class SceneError extends Error {
}
export declare function resolve(scene: Scene, data: AirspaceFile): Resolved;
/** Free roam's first view: every airspace type in the area raised, the whole chart in view. */
export declare function freeRoamScene(data: AirspaceFile): Scene;
/** mount()'s older options as a first scene; undefined when none is given. */
export declare function shorthand(o: {
    types?: Kind[];
    airport?: string;
    approach?: string;
}, data: AirspaceFile): Scene | undefined;
