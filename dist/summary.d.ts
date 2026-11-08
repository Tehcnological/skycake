import type { Labels } from "./ui.js";
export declare function describe(o: {
    chart: string;
    areas: {
        name: string;
        floor: string;
        ceiling: string;
    }[];
    procedures: string[];
}, L: Labels): string;
