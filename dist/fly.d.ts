import type { Point, Procedure } from "./procedure.js";
type Path = Procedure["paths"][number];
/**
 * The connected route as published, without the missed approach: from the first path no other path leads into, each
 * next path the one that starts where the route ends. A SID's runway leg, common route and transition; a STAR's or
 * approach's transition, common route and final.
 */
export declare function flightPaths(p: Procedure): Path[];
/** flightPaths as one line. With only a missed approach, its first point. */
export declare function flightLine(p: Procedure): Point[];
/** When each flown path draws over a flight's timeline (0 to 1): its share of the ground distance, so the line grows
 * under the airplane. Paths off the route are left out. */
export declare function flightShares(p: Procedure): Map<Path, [from: number, to: number]>;
/** The point a fraction f (clamped to 0..1) of the way along the line, by ground distance. */
export declare function along(line: Point[], f: number): Point;
export {};
