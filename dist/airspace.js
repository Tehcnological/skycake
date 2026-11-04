/** One toggle each. Order is the legend order. */
export const KINDS = ["B", "C", "D", "E", "E700", "MODEC", "R", "P", "W", "MOA", "A"];
/** Class E reaches 17,999 MSL; the view stops walls here so the chart stays readable. */
export const TOP = 18000;
/** NASR class airspace record to a kind. Class E with a 1,200 ft floor is everywhere and not drawn, as on the chart. */
export function classKind(cls, localType, lowerVal, lowerCode) {
    if (cls === "B" || cls === "C" || cls === "D")
        return cls;
    if (localType === "MODE C")
        return "MODEC";
    if (localType === "CLASS_E2" || localType === "CLASS_E3" || localType === "CLASS_E4")
        return "E";
    if (localType === "CLASS_E5" && lowerCode === "SFC" && lowerVal === 700)
        return "E700";
    return null;
}
/** Special use airspace type code to a kind. */
export function suaKind(typeCode) {
    return { R: "R", P: "P", W: "W", MOA: "MOA", A: "A" }[typeCode ?? ""] ?? null;
}
/** An altitude in feet MSL. SFC values are heights above the ground; FL values are hundreds of feet. */
export function feet(val, uom, code, ground) {
    if (code === "SFC")
        return ground + val;
    return uom === "FL" ? val * 100 : val;
}
/** Hundreds of feet, as the chart writes them; the ground floor reads SFC. */
export const hundreds = (ft, ground) => (ft <= ground ? "SFC" : String(Math.round(ft / 100)));
/**
 * One readable id per area, in the same order: kind and name ("d-chandler-municipal-airport-class-d"); where that
 * repeats, the floor and ceiling as the chart writes them ("b-phoenix-class-b-50-90"); where that still repeats, a
 * number by position, west to east, then north to south. Input order never changes an id.
 */
export function areaIds(areas, ground) {
    const slug = (a) => `${a.kind}-${a.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const count = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
    const base = areas.map(slug);
    const baseN = count(base);
    const mid = areas.map((a, i) => (baseN.get(base[i]) > 1 ? `${base[i]}-${hundreds(a.floor, ground)}-${hundreds(a.ceiling, ground)}`.toLowerCase() : base[i]));
    const midN = count(mid);
    const centre = (a) => {
        const r = a.rings[0];
        return [r.reduce((s, p) => s + p[1], 0) / r.length, r.reduce((s, p) => s + p[0], 0) / r.length];
    };
    const out = [...mid];
    for (const [id, n] of midN) {
        if (n < 2)
            continue;
        const idx = mid.map((m, i) => (m === id ? i : -1)).filter((i) => i >= 0);
        idx.sort((i, j) => {
            const [lonI, latI] = centre(areas[i]), [lonJ, latJ] = centre(areas[j]);
            return lonI - lonJ || latJ - latI;
        });
        idx.forEach((i, k) => (out[i] = `${id}-${k + 1}`));
    }
    return out;
}
/** Ray casting: is the point inside the ring? */
export function inRing(p, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [a, c] = [ring[i], ring[j]];
        if (a[1] > p[1] !== c[1] > p[1] && p[0] < ((c[0] - a[0]) * (p[1] - a[1])) / (c[1] - a[1]) + a[0])
            inside = !inside;
    }
    return inside;
}
/** The spot on a coarse grid farthest from a ring's corners while inside it: where its tag goes, even on a curved shelf. */
export function deepest(ring) {
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    let best = ring[0], score = -1;
    for (let i = 1; i < 24; i++) {
        for (let j = 1; j < 24; j++) {
            const p = [x0 + ((x1 - x0) * i) / 24, y0 + ((y1 - y0) * j) / 24];
            if (!inRing(p, ring))
                continue;
            const d = Math.min(...ring.map((c) => Math.hypot(p[0] - c[0], p[1] - c[1])));
            if (d > score)
                [best, score] = [p, d];
        }
    }
    return best;
}
/** Sutherland-Hodgman: the part of a ring inside the bounds. Fewer than 3 points means it lies outside. */
export function clipRing(ring, b) {
    const edges = [
        [(p) => p[0] >= b.s, (a, c) => at(a, c, 0, b.s)],
        [(p) => p[0] <= b.n, (a, c) => at(a, c, 0, b.n)],
        [(p) => p[1] >= b.w, (a, c) => at(a, c, 1, b.w)],
        [(p) => p[1] <= b.e, (a, c) => at(a, c, 1, b.e)],
    ];
    let out = ring;
    for (const [inside, cross] of edges) {
        const src = out;
        out = [];
        src.forEach((cur, i) => {
            const prev = src[(i + src.length - 1) % src.length];
            if (inside(cur)) {
                if (!inside(prev))
                    out.push(cross(prev, cur));
                out.push(cur);
            }
            else if (inside(prev))
                out.push(cross(prev, cur));
        });
        if (out.length < 3)
            return [];
    }
    return out;
}
function at(a, c, axis, v) {
    const t = (v - a[axis]) / (c[axis] - a[axis]);
    return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
}
