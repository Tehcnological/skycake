// Low altitude airways from the FAA CIFP's enroute records (section ER), cut to the map. Built by
// scripts/build-area.ts; the browser only reads the result.
import type { Bounds } from "./airspace.js";
import { cifpFixKey, cifpPositions } from "./cifp.js";
import { clipPath } from "./procedure.js";

/** ft: the leg's minimum enroute altitude in feet MSL; null where the FAA publishes none. */
export type Airway = { name: string; legs: { pts: [number, number][]; ft: number | null }[] };
/** A fix on an airway. ft: the highest minimum of the legs meeting it; null where none of them has one. */
export type Waypoint = { name: string; lat: number; lon: number; ft: number | null };

const minimum = (s: string): number | null => {
  const v = s.trim();
  return /^\d{5}$/.test(v) ? Number(v) : /^FL\d{3}$/.test(v) ? Number(v.slice(2)) * 100 : null;
};

const higher = (a: number | null, c: number | null) => (a === null ? c : c === null ? a : Math.max(a, c));

/** A second minimum is the other direction's (V190 east of LAKEY: 9000 east, 6000 west). One line per leg, at the higher. */
const legMinimum = (l: string) => higher(minimum(l.slice(83, 88)), minimum(l.slice(88, 93)));

/** Every low altitude airway leg touching the bounds, and the fixes on those legs that lie inside them. */
export function parseAirways(text: string, b: Bounds): { airways: Airway[]; waypoints: Waypoint[] } {
  const lines = text.split(/\r?\n/).filter((l) => l[0] === "S");
  const at = cifpPositions(lines);
  const inside = ([lat, lon]: [number, number]) => lat >= b.s && lat <= b.n && lon >= b.w && lon <= b.e;
  // By area code too: one name can be two separate lists, with no leg between them.
  const routes = new Map<string, string[]>();
  for (const l of lines) {
    if (l.slice(4, 6) !== "ER") continue;
    const key = l.slice(1, 4) + l.slice(13, 18);
    if (!routes.has(key)) routes.set(key, []);
    routes.get(key)!.push(l);
  }
  const airways = new Map<string, Airway>();
  const waypoints = new Map<string, Waypoint>();
  const keyOf = (l: string) => cifpFixKey(l, "", l.slice(29, 34).trim());
  for (const recs of routes.values()) {
    for (let i = 0; i + 1 < recs.length; i++) {
      const [from, to] = [recs[i], recs[i + 1]];
      // Column 41 "E" ends a stretch of airway, column 46 "H" is high altitude.
      if (from[40] === "E" || from[45] === "H") continue;
      const [p, q] = [at.get(keyOf(from)), at.get(keyOf(to))];
      if (!p || !q || Math.abs(p[1] - q[1]) > 180) continue;
      const pieces = clipPath([[p[0], p[1], 0], [q[0], q[1], 0]], b);
      if (!pieces.length) continue;
      const ft = legMinimum(from);
      const name = from.slice(13, 18).trim();
      if (!airways.has(name)) airways.set(name, { name, legs: [] });
      for (const piece of pieces) airways.get(name)!.legs.push({ pts: piece.map(([lat, lon]): [number, number] => [lat, lon]), ft });
      for (const [l, pos] of [[from, p], [to, q]] as const) {
        if (!inside(pos)) continue;
        const key = keyOf(l);
        const w = waypoints.get(key);
        if (w) w.ft = higher(w.ft, ft);
        else waypoints.set(key, { name: l.slice(29, 34).trim(), lat: pos[0], lon: pos[1], ft });
      }
    }
  }
  return { airways: [...airways.values()], waypoints: [...waypoints.values()] };
}
