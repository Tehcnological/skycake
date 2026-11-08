import { type AirspaceFile } from "./airspace.js";
import type { Procedure } from "./procedure.js";
import { type Scene } from "./scene.js";
import type { Labels } from "./ui.js";
import type { View } from "./viewer.js";
export type Context = {
    fig: HTMLElement;
    view: View;
    data: AirspaceFile;
    first: Scene;
    airport: string | null;
    labels: Labels;
    /** A procedure file by airport, cached by the caller. */
    procedures: (airport: string) => Promise<Procedure[]>;
    startScale: number;
    /** See Options.close in ui.ts. */
    close?: () => void;
};
/** Resolves once the first scene is showing. */
export declare function freeRoam(c: Context): Promise<void>;
