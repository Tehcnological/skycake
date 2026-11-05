import type { Airway, Waypoint } from "./airway.js";
import type { Airport } from "./procedure.js";
/** One toggle each. Order is the legend order. */
export declare const KINDS: readonly ["B", "C", "D", "E", "E700", "MODEC", "R", "P", "W", "MOA", "A"];
export type Kind = (typeof KINDS)[number];
export type Ring = [lat: number, lon: number][];
/** id: stable across data rebuilds while the FAA record stays the same (areaIds), so content can name one area. */
export type Area = {
    id: string;
    kind: Kind;
    name: string;
    floor: number;
    ceiling: number;
    rings: Ring[];
};
export type Bounds = {
    s: number;
    w: number;
    n: number;
    e: number;
};
/** Terrain: rows north to south, 16-bit little-endian feet MSL. */
export type Dem = {
    url: string;
    nx: number;
    ny: number;
};
/** One area's data (area.json). URLs are relative to the area's folder; each airport's procedures are in procedures/<id>.json. */
/** The charts under the airspace: over the whole area the sectional and the IFR low; over its own map the TAC and the IFR area chart. */
export type Charts = {
    sectional: string;
    tac?: {
        url: string;
        bounds: Bounds;
    };
    low?: string;
    area?: {
        url: string;
        bounds: Bounds;
    };
};
export type ChartName = "tac" | "sectional" | "area" | "low";
/** An area's charts in the chart button's order. The area chart only covers its own map, so it needs the low around it. */
export declare const chartsOf: (c: Charts) => ChartName[];
/** The chart asked for if the area has it, else its first. */
export declare const pickChart: (c: Charts, wanted?: ChartName) => ChartName;
/** VFR: the visual charts and all the airspace. IFR: the enroute charts, special use airspace, airways and their fixes. */
export type Mode = "vfr" | "ifr";
export declare const modeOf: (c: ChartName) => Mode;
export declare const chartsIn: (c: Charts, m: Mode) => ChartName[];
export declare const shownIn: (m: Mode, k: Kind) => boolean;
export type AirspaceFile = {
    edition: string;
    bounds: Bounds;
    ground: number;
    charts: Charts;
    dem: Dem;
    areas: Area[];
    airports: Airport[];
    airways: Airway[];
    waypoints: Waypoint[];
};
/** Class E reaches 17,999 MSL; the view stops walls here so the chart stays readable. */
export declare const TOP = 18000;
/** NASR class airspace record to a kind. Class E with a 1,200 ft floor is everywhere and not drawn, as on the chart. */
export declare function classKind(cls: string | null, localType: string | null, lowerVal: number, lowerCode: string | null): Kind | null;
/** Special use airspace type code to a kind. */
export declare function suaKind(typeCode: string | null): Kind | null;
/** An altitude in feet MSL. SFC values are heights above the ground; FL values are hundreds of feet. */
export declare function feet(val: number, uom: string | null, code: string | null, ground: number): number;
/** Hundreds of feet, as the chart writes them; the ground floor reads SFC. */
export declare const hundreds: (ft: number, ground: number) => string;
/**
 * One readable id per area, in the same order: kind and name ("d-chandler-municipal-airport-class-d"); where that
 * repeats, the floor and ceiling as the chart writes them ("b-phoenix-class-b-50-90"); where that still repeats, a
 * number by position, west to east, then north to south. Input order never changes an id.
 */
export declare function areaIds(areas: Omit<Area, "id">[], ground: number): string[];
/** Ray casting: is the point inside the ring? */
export declare function inRing(p: number[], ring: number[][]): boolean;
/** The spot on a coarse grid farthest from a ring's corners while inside it: where its tag goes, even on a curved shelf. */
export declare function deepest(ring: number[][]): number[];
/** Sutherland-Hodgman: the part of a ring inside the bounds. Fewer than 3 points means it lies outside. */
export declare function clipRing(ring: Ring, b: Bounds): Ring;
