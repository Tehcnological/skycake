import type { Point, Procedure } from "./procedure.js";
/**
 * The connected route as published, without the missed approach: from the first path no other path leads into, each
 * next path the one that starts where the line ends. A SID's runway leg, common route and transition; a STAR's or
 * approach's transition, common route and final. With only a missed approach, its first point.
 */
export declare function flightLine(p: Procedure): Point[];
/** The point a fraction f (clamped to 0..1) of the way along the line, by ground distance. */
export declare function along(line: Point[], f: number): Point;
