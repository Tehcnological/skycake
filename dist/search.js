const ORDER = ["IAP", "STAR", "SID"];
const squash = (s) => s.toUpperCase().replace(/\s+/g, "");
export function search(query, airports, limit = 30) {
    const q = squash(query);
    if (!q)
        return [];
    const out = [];
    let left = limit;
    const groups = (a, match) => {
        for (const type of ORDER) {
            const hits = a.procedures.filter((p) => p.type === type && match(p.name)).slice(0, left).map((p) => ({ airport: a.id, procedure: { type, name: p.name } }));
            if (!hits.length)
                continue;
            out.push({ airport: a.id, type, hits });
            left -= hits.length;
        }
    };
    const airport = airports.find((a) => a.id === q || a.id === `K${q}`);
    if (airport) {
        out.push({ airport: airport.id, type: null, hits: [{ airport: airport.id }] });
        groups(airport, () => true);
        return out;
    }
    for (const a of airports) {
        if (left <= 0)
            break;
        groups(a, (name) => squash(name).includes(q));
    }
    return out;
}
