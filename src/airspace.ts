// Airspace for the 3D view: FAA records mapped to chart types, altitudes in feet MSL, and
// outlines clipped to the chart area. Built by scripts/build-area.ts; the browser only reads the result.
import type { Airway, Waypoint } from "./airway.js";
import type { Airport } from "./procedure.js";

/** One toggle each. Order is the legend order. */
export const KINDS = ["B", "C", "D", "E", "E700", "MODEC", "R", "P", "W", "MOA", "A"] as const;
export type Kind = (typeof KINDS)[number];
export type Ring = [lat: number, lon: number][];
/** id: stable across data rebuilds while the FAA record stays the same (areaIds), so content can name one area. */
export type Area = { id: string; kind: Kind; name: string; floor: number; ceiling: number; rings: Ring[] };
export type Bounds = { s: number; w: number; n: number; e: number };
/** Terrain: rows north to south, 16-bit little-endian feet MSL. */
export type Dem = { url: string; nx: number; ny: number };
/** One area's data (area.json). URLs are relative to the area's folder; each airport's procedures are in procedures/<id>.json. */
/** The charts under the airspace: over the whole area the sectional and the IFR low; over its own map the TAC and the IFR area chart. */
export type Charts = { sectional: string; tac?: { url: string; bounds: Bounds }; low?: string; area?: { url: string; bounds: Bounds } };
export type ChartName = "tac" | "sectional" | "area" | "low";
/** An area's charts in the chart button's order. The area chart only covers its own map, so it needs the low around it. */
export const chartsOf = (c: Charts): ChartName[] => [...(c.tac ? ["tac" as const] : []), "sectional", ...(c.low && c.area ? ["area" as const] : []), ...(c.low ? ["low" as const] : [])];
/** The chart asked for if the area has it, else its first. */
export const pickChart = (c: Charts, wanted?: ChartName): ChartName => (wanted && chartsOf(c).includes(wanted) ? wanted : chartsOf(c)[0]);
/** VFR: the visual charts and all the airspace. IFR: the enroute charts, special use airspace, airways and their fixes. */
export type Mode = "vfr" | "ifr";
export const modeOf = (c: ChartName): Mode => (c === "area" || c === "low" ? "ifr" : "vfr");
export const chartsIn = (c: Charts, m: Mode): ChartName[] => chartsOf(c).filter((x) => modeOf(x) === m);
const SPECIAL_USE: readonly Kind[] = ["R", "P", "W", "MOA", "A"];
export const shownIn = (m: Mode, k: Kind) => m === "vfr" || SPECIAL_USE.includes(k);
/** edition: the charts' 56-day edition. cycle: the 28-day procedure cycle (CIFP, d-TPP) the area was built from; areas
 * built before it was recorded lack it. Both are effective dates, YYYY-MM-DD. */
export type AirspaceFile = { edition: string; cycle?: string; bounds: Bounds; ground: number; charts: Charts; dem: Dem; areas: Area[]; airports: Airport[]; airways: Airway[]; waypoints: Waypoint[] };

/** Class E reaches 17,999 MSL; the view stops walls here so the chart stays readable. */
export const TOP = 18000;

/** NASR class airspace record to a kind. Class E with a 1,200 ft floor is everywhere and not drawn, as on the chart. */
export function classKind(cls: string | null, localType: string | null, lowerVal: number, lowerCode: string | null): Kind | null {
  if (cls === "B" || cls === "C" || cls === "D") return cls;
  if (localType === "MODE C") return "MODEC";
  if (localType === "CLASS_E2" || localType === "CLASS_E3" || localType === "CLASS_E4") return "E";
  if (localType === "CLASS_E5" && lowerCode === "SFC" && lowerVal === 700) return "E700";
  return null;
}

/** Special use airspace type code to a kind. */
export function suaKind(typeCode: string | null): Kind | null {
  return ({ R: "R", P: "P", W: "W", MOA: "MOA", A: "A" } as Record<string, Kind>)[typeCode ?? ""] ?? null;
}

/** An altitude in feet MSL. SFC values are heights above the ground; FL values are hundreds of feet. */
export function feet(val: number, uom: string | null, code: string | null, ground: number): number {
  if (code === "SFC") return ground + val;
  return uom === "FL" ? val * 100 : val;
}

/** Hundreds of feet, as the chart writes them; the ground floor reads SFC. */
export const hundreds = (ft: number, ground: number) => (ft <= ground ? "SFC" : String(Math.round(ft / 100)));

/**
 * One readable id per area, in the same order: kind and name ("d-chandler-municipal-airport-class-d"); where that
 * repeats, the floor and ceiling as the chart writes them ("b-phoenix-class-b-50-90"); where that still repeats, a
 * number by position, west to east, then north to south. Input order never changes an id.
 */
export function areaIds(areas: Omit<Area, "id">[], ground: number): string[] {
  const slug = (a: Omit<Area, "id">) => `${a.kind}-${a.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const count = <T>(xs: T[]) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<T, number>());
  const base = areas.map(slug);
  const baseN = count(base);
  const mid = areas.map((a, i) => (baseN.get(base[i])! > 1 ? `${base[i]}-${hundreds(a.floor, ground)}-${hundreds(a.ceiling, ground)}`.toLowerCase() : base[i]));
  const midN = count(mid);
  const centre = (a: Omit<Area, "id">) => {
    const r = a.rings[0];
    return [r.reduce((s, p) => s + p[1], 0) / r.length, r.reduce((s, p) => s + p[0], 0) / r.length];
  };
  const out = [...mid];
  for (const [id, n] of midN) {
    if (n < 2) continue;
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
export function inRing(p: number[], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, c] = [ring[i], ring[j]];
    if (a[1] > p[1] !== c[1] > p[1] && p[0] < ((c[0] - a[0]) * (p[1] - a[1])) / (c[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** The spot on a coarse grid farthest from a ring's corners while inside it: where its tag goes, even on a curved shelf. */
export function deepest(ring: number[][]): number[] {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = ring[0], score = -1;
  for (let i = 1; i < 24; i++) {
    for (let j = 1; j < 24; j++) {
      const p = [x0 + ((x1 - x0) * i) / 24, y0 + ((y1 - y0) * j) / 24];
      if (!inRing(p, ring)) continue;
      const d = Math.min(...ring.map((c) => Math.hypot(p[0] - c[0], p[1] - c[1])));
      if (d > score) [best, score] = [p, d];
    }
  }
  return best;
}

/** Sutherland-Hodgman: the part of a ring inside the bounds. Fewer than 3 points means it lies outside. */
export function clipRing(ring: Ring, b: Bounds): Ring {
  const edges: [(p: [number, number]) => boolean, (a: [number, number], c: [number, number]) => [number, number]][] = [
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
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cross(prev, cur));
    });
    if (out.length < 3) return [];
  }
  return out;
}

function at(a: [number, number], c: [number, number], axis: 0 | 1, v: number): [number, number] {
  const t = (v - a[axis]) / (c[axis] - a[axis]);
  return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
}
