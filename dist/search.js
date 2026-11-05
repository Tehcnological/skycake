const ORDER = ["IAP", "STAR", "SID"];
const squash = (s) => s.toUpperCase().replace(/\s+/g, "");
function groups(a, match, limit = Infinity) {
    const out = [];
    let left = limit;
    for (const type of ORDER) {
        const hits = a.procedures.filter((p) => p.type === type && match(p.name)).slice(0, left).map((p) => ({ airport: a.id, procedure: { type, name: p.name } }));
        if (!hits.length)
            continue;
        out.push({ airport: a.id, type, hits });
        left -= hits.length;
    }
    return out;
}
/** Procedures whose name contains the query, at most `limit` across all airports. */
export function search(query, airports, limit = 30) {
    const q = squash(query);
    if (!q)
        return [];
    const out = [];
    for (const a of airports) {
        const left = limit - out.reduce((n, g) => n + g.hits.length, 0);
        if (left <= 0)
            break;
        out.push(...groups(a, (name) => squash(name).includes(q), left));
    }
    return out;
}
/** The airports to pick from: those with procedures, by id. */
export function airportList(airports) {
    return airports.filter((a) => a.procedures.length > 0).sort((a, b) => a.id.localeCompare(b.id));
}
/** Every procedure at one airport. */
export function proceduresAt(airport) {
    return groups(airport, () => true);
}
