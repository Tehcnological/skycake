import type { Airport, ProcType } from "./procedure.js";
export type Hit = {
    airport: string;
    procedure: {
        type: ProcType;
        name: string;
    };
};
export type Group = {
    airport: string;
    type: ProcType;
    hits: Hit[];
};
/** Procedures whose name contains the query, at most `limit` across all airports. */
export declare function search(query: string, airports: Airport[], limit?: number): Group[];
/** The airports to pick from: those with procedures, by id. */
export declare function airportList(airports: Airport[]): Airport[];
/** Every procedure at one airport. */
export declare function proceduresAt(airport: Airport): Group[];
