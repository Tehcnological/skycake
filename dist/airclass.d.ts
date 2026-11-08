import { type AirspaceFile } from "./airspace.js";
export type Class = {
    kind: "A" | "B" | "C" | "D" | "E" | "G";
    area: string | null;
    veil: boolean;
    overBC: boolean;
    agl: number;
};
/** Ground height in feet: bilinear over the DEM (row 0 north, column 0 west, over the bounds), or the field elevation without a grid. */
export declare function groundFt(data: AirspaceFile, grid: Int16Array | null, lat: number, lon: number): number;
export declare function classAt(data: AirspaceFile, grid: Int16Array | null, lat: number, lon: number, ft: number): Class;
export declare function needs(c: Class, ft: number): {
    clearance: boolean;
    radio: boolean;
    transponder: boolean;
};
/** Within 0.5 NM of an outline edge, or 300 ft of a floor, ceiling, or level where the class changes. Such points make poor quiz questions. */
export declare function nearBoundary(data: AirspaceFile, grid: Int16Array | null, lat: number, lon: number, ft: number): boolean;
