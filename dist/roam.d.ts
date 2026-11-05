import type { Fix, Procedure } from "./procedure.js";
import type { ProcedureRef, Scene } from "./scene.js";
export type Roam = {
    first: Scene;
    procedures: ProcedureRef[];
    airport: string | null;
    diagram: boolean;
};
export declare function start(first: Scene, airport?: string): Roam;
/** Adds a procedure once; its airport becomes the current one. */
export declare function add(r: Roam, p: ProcedureRef): Roam;
export declare function remove(r: Roam, p: ProcedureRef): Roam;
/** Makes an airport current; its diagram stays on only if it has one. */
export declare function pickAirport(r: Roam, airport: string, hasDiagram: (airport: string) => boolean): Roam;
export declare function toggleDiagram(r: Roam, hasDiagram: (airport: string) => boolean): Roam;
/** What the viewer shows now: the first scene, plus the diagram while on, plus the shown procedures framed. */
export declare function sceneOf(r: Roam): Scene;
/** One tag per fix across all shown procedures: the final's role and altitude win, as within one procedure. */
export declare function fixTags(procedures: Procedure[]): Fix[];
