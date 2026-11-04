import type { Bounds } from "./airspace.js";
/** A tick label's center on the page, in points from the top left. */
export type Label = {
    x: number;
    y: number;
    text: string;
};
type Axis = {
    along: "x" | "y";
    a: number;
    b: number;
};
export type Fit = {
    lat: Axis;
    lon: Axis; /** Worst label miss, feet. */
    error: number;
};
/** 33°26.5'N, 112°02.0'W, 33°26'N: degrees north or east, negative south or west. */
export declare function labelValue(text: string): {
    kind: "lat" | "lon";
    value: number;
} | null;
/**
 * Page position to latitude and longitude from the tick labels, or null when the labels don't make a trustworthy
 * north-aligned, true-scale map: too few, on the same axis, a label more than 100 ft off the fit, or the two scales
 * more than 3% apart.
 */
export declare function fitLabels(labels: Label[]): Fit | null;
export declare const latLon: (f: Fit, x: number, y: number) => [number, number];
/** Clockwise turn, in degrees, that puts north at the top of the page image. */
export declare function northUp(f: Fit): 0 | 90 | 180 | 270;
/** The map area covered by a rectangle of the page. */
export declare function boundsOf(f: Fit, x0: number, y0: number, x1: number, y1: number): Bounds;
/**
 * The diagram's frame in a rendered page (RGBA): the outermost rows and columns with a dark line across most of the
 * page. Inside it are the airport and its notes; outside are the title, dates and margins.
 */
export declare function frame(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): [x0: number, y0: number, x1: number, y1: number];
export {};
