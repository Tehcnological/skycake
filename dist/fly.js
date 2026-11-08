// Flying a procedure: its route as one line, and points along it, for the walkthrough's airplane.
import { nm } from "./cifp.js";
const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
/**
 * The connected route as published, without the missed approach: from the first path no other path leads into, each
 * next path the one that starts where the line ends. A SID's runway leg, common route and transition; a STAR's or
 * approach's transition, common route and final. With only a missed approach, its first point.
 */
export function flightLine(p) {
    const paths = p.paths.filter((x) => x.seg !== "missed" && x.pts.length);
    if (!paths.length)
        return [p.paths[0].pts[0]];
    const first = paths.find((a) => !paths.some((b) => b !== a && same(b.pts[b.pts.length - 1], a.pts[0]))) ?? paths[0];
    const used = new Set([first]);
    const line = [...first.pts];
    for (let next; (next = paths.find((x) => !used.has(x) && same(x.pts[0], line[line.length - 1])));) {
        used.add(next);
        line.push(...next.pts);
    }
    return line.filter((q, i) => i === 0 || !same(q, line[i - 1]));
}
/** The point a fraction f (clamped to 0..1) of the way along the line, by ground distance. */
export function along(line, f) {
    if (f >= 1)
        return line[line.length - 1]; // exactly, not off by rounding
    const legs = line.slice(1).map((q, i) => nm(line[i][0], line[i][1], q[0], q[1]));
    let left = Math.max(0, f) * legs.reduce((a, b) => a + b, 0);
    for (let i = 0; i < legs.length; i++) {
        if (left < legs[i]) {
            const s = left / legs[i], [a, b] = [line[i], line[i + 1]];
            return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
        }
        left -= legs[i];
    }
    return line[line.length - 1];
}
