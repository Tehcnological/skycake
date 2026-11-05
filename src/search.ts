// The free-roam search box: one box for airports and procedures. "phx" or "KSDL" finds the airport and lists all its
// procedures; anything else matches procedure names ("25L", "bnyrd"). Results are grouped by airport, then
// Approaches, Arrivals, Departures.
import type { Airport, ProcType } from "./procedure.js";

export type Hit = { airport: string; procedure?: { type: ProcType; name: string } };
/** type null: the airport itself. */
export type Group = { airport: string; type: ProcType | null; hits: Hit[] };

const ORDER: ProcType[] = ["IAP", "STAR", "SID"];
const squash = (s: string) => s.toUpperCase().replace(/\s+/g, "");

export function search(query: string, airports: Airport[], limit = 30): Group[] {
  const q = squash(query);
  if (!q) return [];
  const out: Group[] = [];
  let left = limit;
  const groups = (a: Airport, match: (name: string) => boolean) => {
    for (const type of ORDER) {
      const hits = a.procedures.filter((p) => p.type === type && match(p.name)).slice(0, left).map((p) => ({ airport: a.id, procedure: { type, name: p.name } }));
      if (!hits.length) continue;
      out.push({ airport: a.id, type, hits });
      left -= hits.length;
    }
  };
  const airport = airports.find((a) => a.id === q || a.id === `K${q}`);
  if (airport) {
    // An airport lists every one of its procedures.
    out.push({ airport: airport.id, type: null, hits: [{ airport: airport.id }] });
    left = Infinity;
    groups(airport, () => true);
    return out;
  }
  for (const a of airports) {
    if (left <= 0) break;
    groups(a, (name) => squash(name).includes(q));
  }
  return out;
}
