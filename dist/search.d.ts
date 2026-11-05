import type { Airport, ProcType } from "./procedure.js";
export type Hit = {
    airport: string;
    procedure?: {
        type: ProcType;
        name: string;
    };
};
/** type null: the airport itself. */
export type Group = {
    airport: string;
    type: ProcType | null;
    hits: Hit[];
};
export declare function search(query: string, airports: Airport[], limit?: number): Group[];
