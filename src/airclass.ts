// Class of airspace at a point, and what that class requires of an ordinary airplane (14 CFR 91.129, 91.130, 91.131, 91.215). Pure: no DOM.
import { inRing, type AirspaceFile, type Area, type Ring } from "./airspace.js";
import { nm } from "./cifp.js";

export type Class = { kind: "B" | "C" | "D" | "E" | "G"; area: string | null; veil: boolean; overBC: boolean; agl: number };

/** Ground height in feet: bilinear over the DEM (row 0 north, column 0 west, over the bounds), or the field elevation without a grid. */
export function groundFt(data: AirspaceFile, grid: Int16Array | null, lat: number, lon: number): number {
  if (!grid) return data.ground;
  const { nx, ny } = data.dem, { s, w, n, e } = data.bounds;
  const fi = Math.max(0, Math.min(nx - 1, ((lon - w) / (e - w)) * (nx - 1)));
  const fj = Math.max(0, Math.min(ny - 1, ((n - lat) / (n - s)) * (ny - 1)));
  const i = Math.min(Math.floor(fi), nx - 2), j = Math.min(Math.floor(fj), ny - 2);
  const [a, c] = [fi - i, fj - j];
  const h = (di: number, dj: number) => grid[(j + dj) * nx + i + di];
  return (h(0, 0) * (1 - a) + h(1, 0) * a) * (1 - c) + (h(0, 1) * (1 - a) + h(1, 1) * a) * c;
}

const within = (a: Area, lat: number, lon: number) => a.rings.some((r) => inRing([lat, lon], r));
const surface = (data: AirspaceFile, a: Area) => a.floor <= data.ground; // floor "SFC"

export function classAt(data: AirspaceFile, grid: Int16Array | null, lat: number, lon: number, ft: number): Class {
  const agl = ft - groundFt(data, grid, lat, lon);
  const ins = data.areas.filter((a) => within(a, lat, lon));
  const slab = (a: Area) => a.floor <= ft && ft < a.ceiling;
  // 91.215(b)(3): above the ceiling and within the lateral boundaries of a B or C area, outer shelves included.
  const overBC = ins.some((a) => (a.kind === "B" || a.kind === "C") && ft >= a.ceiling);
  const veil = ins.some((a) => a.kind === "MODEC" && slab(a));
  const hit = (k: Area["kind"]) => ins.find((a) => a.kind === k && slab(a) && (k !== "E" || surface(data, a)));
  for (const k of ["B", "C", "D", "E"] as const) {
    const a = hit(k);
    if (a) return { kind: k, area: a.id, veil, overBC, agl };
  }
  const e = ins.some((a) => a.kind === "E700") ? 700 : 1200;
  return { kind: agl > e || ft > 14500 ? "E" : "G", area: null, veil, overBC, agl };
}

export function needs(c: Class, ft: number): { clearance: boolean; radio: boolean; transponder: boolean } {
  const transponder =
    c.kind === "B" || c.kind === "C" || // (b)(1)
    (ft < 10000 && (c.veil || c.overBC)) || // (b)(2), (b)(3)
    (ft >= 10000 && c.agl > 2500); // (b)(5)(i)
  return { clearance: c.kind === "B", radio: c.kind !== "E" && c.kind !== "G", transponder };
}

/** NM from a point to the nearest edge of a ring, flat-earth. */
function edgeNm(lat: number, lon: number, r: Ring): number {
  const k = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [ay, ax, by, bx] = [(r[j][0] - lat) * 60, (r[j][1] - lon) * 60 * k, (r[i][0] - lat) * 60, (r[i][1] - lon) * 60 * k];
    const [dy, dx] = [by - ay, bx - ax];
    const t = Math.max(0, Math.min(1, -(ay * dy + ax * dx) / (dy * dy + dx * dx || 1)));
    best = Math.min(best, Math.hypot(ay + t * dy, ax + t * dx));
  }
  return best;
}

/** Within 0.5 NM of an outline edge, or 300 ft of a floor, ceiling, or level where the class changes. Such points make poor quiz questions. */
export function nearBoundary(data: AirspaceFile, grid: Int16Array | null, lat: number, lon: number, ft: number): boolean {
  const KINDS = ["B", "C", "D", "E", "E700", "MODEC"];
  const outlines = data.areas.filter((a) => KINDS.includes(a.kind));
  if (outlines.some((a) => a.rings.some((r) => edgeNm(lat, lon, r) <= 0.5))) return true;
  const g = groundFt(data, grid, lat, lon);
  const levels = [14500, 10000];
  for (const a of data.areas) if (["B", "C", "D", "E"].includes(a.kind) && within(a, lat, lon)) levels.push(a.floor, a.ceiling);
  levels.push(g + (data.areas.some((a) => a.kind === "E700" && within(a, lat, lon)) ? 700 : 1200));
  if (ft >= 10000) levels.push(g + 2500);
  return levels.some((l) => Math.abs(ft - l) <= 300);
}
