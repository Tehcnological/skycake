/** One toggle each. Order is the legend order. */
export const KINDS = ["B", "C", "D", "E", "E700", "EFLOOR", "MODEC", "TRSA", "SFRA", "SATR", "R", "P", "W", "MOA", "A", "TFR", "NSA", "ADIZ", "DC60"];
/** Drawn as a sheet (E700: 700 ft above the ground; EFLOOR: Class E from any other floor) or a line (Mode C veils, the ADIZ,
 * the 60 NM ring around the DCA VOR/DME), not a volume: nothing to tap. */
export const tappable = (k) => !["E700", "EFLOOR", "MODEC", "ADIZ", "DC60"].includes(k);
/** An area's charts in the chart button's order. The area chart only covers its own map, so it needs the low around it. */
export const chartsOf = (c) => [...(c.tac ? ["tac"] : []), "sectional", ...(c.low && c.area ? ["area"] : []), ...(c.low ? ["low"] : [])];
/** The chart asked for if the area has it, else its first. */
export const pickChart = (c, wanted) => (wanted && chartsOf(c).includes(wanted) ? wanted : chartsOf(c)[0]);
export const modeOf = (c) => (c === "area" || c === "low" ? "ifr" : "vfr");
export const chartsIn = (c, m) => chartsOf(c).filter((x) => modeOf(x) === m);
const IFR_TOO = ["SFRA", "R", "P", "W", "MOA", "A", "TFR", "ADIZ"];
export const shownIn = (m, k) => m === "vfr" || IFR_TOO.includes(k);
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
    // Any other floor (9,500 MSL in the mountains) is charted; 1,200 AGL is the default and 14,500 MSL everywhere.
    if (["CLASS_E5", "CLASS_E6", "CLASS_E"].includes(localType ?? "") && !(lowerCode === "SFC" && lowerVal === 1200) && lowerVal > 0 && lowerVal < 14500)
        return "EFLOOR";
    return null;
}
/** Special use airspace type code to a kind. */
export function suaKind(typeCode) {
    return { R: "R", P: "P", W: "W", MOA: "MOA", A: "A" }[typeCode ?? ""] ?? null;
}
/** Boundary airspace record (TYPE_CODE, LOCAL_TYPE) to a kind: TRSAs, SFRAs, special air traffic rule areas, offshore
 * Class E, permanent national defense TFRs, national security areas and the ADIZ. */
export function boundaryKind(typeCode, localType) {
    if (typeCode === "TRSA")
        return "TRSA";
    if (localType === "CLASS_E7")
        return "EFLOOR";
    if (localType === "NDA_TFR")
        return "TFR";
    if (typeCode === "NSA")
        return "NSA";
    if (typeCode === "ADIZ")
        return "ADIZ";
    if (typeCode !== "SATA")
        return null;
    return localType === "SFRA" ? "SFRA" : localType === "SPEC_AT_RULES" ? "SATR" : null;
}
/** An altitude in feet MSL. SFC values are heights above the ground; FL values are hundreds of feet; unlimited is Infinity. */
export function feet(val, uom, code, ground) {
    if (code === "UNLTD")
        return Infinity;
    if (code === "SFC")
        return ground + val;
    return uom === "FL" ? val * 100 : val;
}
/** An altitude as the answer card says it: SFC at the surface, else feet with a thousands comma (5,000). */
export const feetText = (ft, ground) => (ft <= ground ? "SFC" : ft.toLocaleString("en-US"));
/** Hundreds of feet, as the chart writes them; the ground floor reads SFC, and a ceiling up to but not including an
 * altitude (2,999) reads with a minus (-30). */
export const hundreds = (ft, ground) => (ft <= ground ? "SFC" : ft % 100 === 99 ? `-${(ft + 1) / 100}` : String(Math.round(ft / 100)));
// Ids keep a TNI ceiling's whole hundreds (30, not -30), so they stayed the same when the data started recording it.
const idFeet = (ft, ground) => (ft <= ground ? "SFC" : String(Math.round(ft / 100)));
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
    const mid = areas.map((a, i) => (baseN.get(base[i]) > 1 ? `${base[i]}-${idFeet(a.floor, ground)}-${idFeet(a.ceiling, ground)}`.toLowerCase() : base[i]));
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
/** A circle of radius nm around a point, one corner every 3 degrees. Flat-earth: off by feet at 60 NM. */
export function circle(lat, lon, nm) {
    return Array.from({ length: 120 }, (_, i) => {
        const b = (i * 3 * Math.PI) / 180;
        const dLat = (nm / 60) * Math.cos(b), dLon = (nm / 60) * Math.sin(b) / Math.cos((lat * Math.PI) / 180);
        return [Math.round((lat + dLat) * 1e5) / 1e5, Math.round((lon + dLon) * 1e5) / 1e5];
    });
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
