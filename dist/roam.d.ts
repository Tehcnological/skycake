import type { Fix, Procedure } from "./procedure.js";
import type { Camera, ProcedureRef, Scene } from "./scene.js";
/**
 * camera: the camera to use next. undefined: frame what is shown (the procedures, else the diagram); null: leave it
 * where it is.
 */
export type Roam = {
    first: Scene;
    procedures: ProcedureRef[];
    airport: string | null;
    diagram: boolean;
    camera: Camera | null | undefined;
};
/** Starts from the first scene: its procedures and diagram are shown and removable, its camera used until a change. */
export declare function start(first: Scene, airport?: string): Roam;
/** Adds a procedure once; its airport becomes the current one. */
export declare function add(r: Roam, p: ProcedureRef): Roam;
/** Removing the last one goes back to the first view. */
export declare function remove(r: Roam, p: ProcedureRef): Roam;
/** Makes an airport current; its diagram stays on only if it has one. */
export declare function pickAirport(r: Roam, airport: string, hasDiagram: (airport: string) => boolean): Roam;
export declare function toggleDiagram(r: Roam, hasDiagram: (airport: string) => boolean): Roam;
/** What the viewer shows now: the first scene, plus the diagram while on, plus the shown procedures framed. */
export declare function sceneOf(r: Roam): Scene;
/**
 * One tag per fix across all shown procedures: the final's role and altitude win, as within one procedure. A fix is
 * its name at its place, since runway fixes (RW03) share names across airports.
 */
export declare function fixTags(procedures: Procedure[]): Fix[];
