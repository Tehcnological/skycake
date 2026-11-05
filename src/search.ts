// Free roam's search box finds procedures by name ("25L", "bnyrd"); airports are picked from a list or by tapping
// their tag on the chart, which lists every procedure there. Results are grouped by airport, then Approaches,
// Arrivals, Departures.
import type { Airport, ProcType } from "./procedure.js";

export type Hit = { airport: string; procedure: { type: ProcType; name: string } };
export type Group = { airport: string; type: ProcType; hits: Hit[] };

const ORDER: ProcType[] = ["IAP", "STAR", "SID"];
const squash = (s: string) => s.toUpperCase().replace(/\s+/g, "");

function groups(a: Airport, match: (name: string) => boolean, limit = Infinity): Group[] {
  const out: Group[] = [];
  let left = limit;
  for (const type of ORDER) {
    const hits = a.procedures.filter((p) => p.type === type && match(p.name)).slice(0, left).map((p) => ({ airport: a.id, procedure: { type, name: p.name } }));
    if (!hits.length) continue;
    out.push({ airport: a.id, type, hits });
    left -= hits.length;
  }
  return out;
}

/** Procedures whose name contains the query, at most `limit` across all airports. */
export function search(query: string, airports: Airport[], limit = 30): Group[] {
  const q = squash(query);
  if (!q) return [];
  const out: Group[] = [];
  for (const a of airports) {
    const left = limit - out.reduce((n, g) => n + g.hits.length, 0);
    if (left <= 0) break;
    out.push(...groups(a, (name) => squash(name).includes(q), left));
  }
  return out;
}

/** The airports to pick from: those with procedures, by id. */
export function airportList(airports: Airport[]): Airport[] {
  return airports.filter((a) => a.procedures.length > 0).sort((a, b) => a.id.localeCompare(b.id));
}

/** Every procedure at one airport. */
export function proceduresAt(airport: Airport): Group[] {
  return groups(airport, () => true);
}
