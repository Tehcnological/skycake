import type { Bounds } from "./airspace.js";
export type Point = [lat: number, lon: number, ft: number];
export type ProcType = "IAP" | "SID" | "STAR";
/** Approaches: transition, final, missed. Departures and arrivals: transition, the common route, and vectors to or from the field. */
/** Vectors: radar vectors joining the field to a departure that starts away from it, or an arrival that ends away from it. */
export type Segment = "transition" | "final" | "missed" | "common" | "vectors";
export type Path = {
    seg: Segment;
    pts: Point[];
};
export type Fix = {
    name: string;
    lat: number;
    lon: number;
    ft: number;
    alt: string | null;
    role: "IAF" | "IF" | "FAF" | "MAP" | null;
    seg: Segment;
};
export type Procedure = {
    airport: string;
    type: ProcType;
    name: string;
    paths: Path[];
    fixes: Fix[];
    /** Degrees magnetic, FAF to MAP. Approaches only. */
    course: number | null;
    /** Degrees; null with no published vertical angle. */
    glidepath: number | null;
    /** Nautical miles. */
    fafToMap: number | null;
};
export type Airport = {
    id: string;
    name: string;
    lat: number;
    lon: number;
    elev: number;
    procedures: {
        type: ProcType;
        name: string;
    }[];
    diagram?: {
        url: string;
        bounds: Bounds;
    };
};
type Row = {
    fix: string;
    pos?: [number, number];
    pt: string;
    turn: string;
    course: number | null;
    dist: string;
    alt: string | null;
    ft: number | null;
    role: Fix["role"];
    angle: number | null;
    /** Recommended navaid, for DME legs. */
    nav?: [number, number];
    /** Arc center, for RF legs. */
    center?: [number, number];
};
/** A leg's altitude constraint as the chart gives it, and the height the path is drawn at. */
export declare function constraint(l: string): {
    alt: string | null;
    ft: number | null;
};
/** A flat local grid: nautical miles east and north of the airport. */
declare function grid(airport: [number, number], variation: number): {
    to: (lat: number, lon: number) => [number, number];
    back: (x: number, y: number, ft: number) => Point;
    dir: (magnetic: number) => [number, number];
};
type Grid = ReturnType<typeof grid>;
/**
 * Walks legs into a path. Heights come from the constraints; between them the path runs straight, by distance flown,
 * so a climb or descent spreads over the legs between two constraints. Before the first constraint the path holds
 * `seed` (or the first constraint), after the last it holds the last.
 */
export declare function walk(rows: Row[], g: Grid, start?: Point, seed?: number): Point[];
/** Liang-Barsky, piece by piece: the parts of a path inside the bounds, cut exactly at the edge. */
export declare function clipPath(pts: Point[], b: Bounds): Point[][];
/** Every airport inside the bounds with its approaches, departures and arrivals, each cut to the bounds. */
export declare function parseProcedures(text: string, b: Bounds): {
    airports: Airport[];
    procedures: Procedure[];
};
export {};
