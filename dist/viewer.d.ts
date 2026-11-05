import { type AirspaceFile, type Area, type Kind } from "./airspace.js";
import type { Procedure } from "./procedure.js";
import type { Resolved } from "./scene.js";
type Style = {
    color: number;
    wall: number;
    roof: number;
    line: "solid" | "dashed" | "hatch" | "none";
    walls: boolean;
};
export declare const STYLE: Record<Kind, Style>;
export declare const START_SCALE = 1;
/** Ceiling over floor, as the chart prints them. */
export declare const fraction: (a: Area, ground: number) => HTMLElement;
export type View = {
    /** Raises or lowers every area of a type. */
    raise(kind: Kind, on: boolean): void;
    exaggerate(n: number): void;
    tags(on: boolean): void;
    /** Raises or lowers one area, by id. */
    raiseArea(id: string, on: boolean): void;
    /** The ids of the areas raised now, by any means: a scene, the type list or a tap on the chart. */
    raisedAreas(): string[];
    /**
     * Shows a scene. procedures: the procedure files' objects for scene.procedures, same order. now: no animation.
     * framing: files for procedures the camera frames but the scene does not show (framedOnly()); not drawn.
     */
    apply(scene: Resolved, procedures: Procedure[], now?: boolean, framing?: Procedure[]): Promise<void>;
    /** Keyboard: turns the camera around the target (radians), within the same limits as the mouse. */
    orbit(azimuth: number, polar: number): void;
    /** Keyboard: moves the camera closer (factor < 1) or farther (factor > 1). */
    zoom(factor: number): void;
};
export declare function build(host: HTMLElement, data: AirspaceFile, label: (a: Area | null, x: number, y: number) => void, raised: (kind: Kind, on: boolean) => void, 
/** A tap on an airport's tag on the chart. */
airport?: (id: string) => void): Promise<View>;
export {};
