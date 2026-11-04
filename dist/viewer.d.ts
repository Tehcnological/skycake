import { type AirspaceFile, type Area, type Bounds, type Kind } from "./airspace.js";
import type { Procedure } from "./procedure.js";
type Style = {
    color: number;
    wall: number;
    roof: number;
    line: "solid" | "dashed" | "hatch" | "none";
    walls: boolean;
};
export declare const STYLE: Record<Kind, Style>;
export declare const START_SCALE = 4;
/** Ceiling over floor, as the chart prints them. */
export declare const fraction: (a: Area, ground: number) => HTMLElement;
export type View = {
    /** Raises or lowers every area of a type. */
    raise(kind: Kind, on: boolean): void;
    exaggerate(n: number): void;
    tags(on: boolean): void;
    /** Shows a procedure, or null to go back to the first view. */
    procedure(p: Procedure | null): void;
    /** Lays an airport diagram over the chart and frames it, or takes it away. */
    diagram(d: {
        url: string;
        bounds: Bounds;
    } | null): Promise<void>;
    /** Keyboard: turns the camera around the target (radians), within the same limits as the mouse. */
    orbit(azimuth: number, polar: number): void;
    /** Keyboard: moves the camera closer (factor < 1) or farther (factor > 1). */
    zoom(factor: number): void;
};
export declare function build(host: HTMLElement, data: AirspaceFile, first: Kind[], label: (a: Area | null, x: number, y: number) => void, raised: (kind: Kind, on: boolean) => void): Promise<View>;
export {};
