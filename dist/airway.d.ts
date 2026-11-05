import type { Bounds } from "./airspace.js";
/** ft: the leg's minimum enroute altitude in feet MSL; null where the FAA publishes none. */
export type Airway = {
    name: string;
    legs: {
        pts: [number, number][];
        ft: number | null;
    }[];
};
/** A fix on an airway. ft: the highest minimum of the legs meeting it; null where none of them has one. */
export type Waypoint = {
    name: string;
    lat: number;
    lon: number;
    ft: number | null;
};
/** Every low altitude airway leg touching the bounds, and the fixes on those legs that lie inside them. */
export declare function parseAirways(text: string, b: Bounds): {
    airways: Airway[];
    waypoints: Waypoint[];
};
