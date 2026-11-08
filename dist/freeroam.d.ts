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
    /** Accessibility mode now; questions read it as they open. */
    a11y: boolean;
    /** Only when the site does not drive the mode: switches it in place (free roam's row). */
    setA11y?: (on: boolean) => void;
};
export declare function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string | boolean | undefined>, ...kids: (Node | string)[]): HTMLElementTagNameMap[K];
/** An inline stroke icon built as elements, so strict CSPs allow it. */
export declare function icon(paths: string[], box?: string): SVGSVGElement;
export declare const ICONS: {
    layers: string[];
    search: string[];
    procedure: string[];
    diagram: string[];
    tags: string[];
    view: string[];
    full: string[];
    close: string[];
    list: string[];
};
/** Resolves once the first scene is showing. */
export declare function freeRoam(c: Context): Promise<void>;
/**
 * Walkthroughs and quizzes on a phone: the view in the page lets the page scroll past it until a tap wakes it, and it
 * sleeps again once scrolled out of sight. The player and question card stay live throughout. Returns the undo.
 */
export declare function wakeOnTap(c: Context): () => void;
