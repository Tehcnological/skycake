/**
 * The FAA's procedure charts (d-TPP) of an airport: its records in the cycle's metafile, grouped into charts with their
 * continuation pages, and matched to the procedures skycake builds from the CIFP. Pure; scripts/build-area.ts does the I/O.
 */
/** The airport's block of the metafile, by its ICAO or FAA identifier. */
export const airportBlock = (meta, id) => meta.split("<airport_name").find((b) => new RegExp(`(icao_ident|apt_ident)="${id}"`).test(b.slice(0, b.indexOf(">"))));
const tag = (r, t) => r.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1] ?? "";
/** Every record of an airport's block, in metafile order. */
export const chartRecords = (block) => block.split("<record>").slice(1).map((r) => ({ code: tag(r, "chart_code"), name: tag(r, "chart_name"), pdf: tag(r, "pdf_name"), action: tag(r, "useraction") }));
const KINDS = ["IAP", "DP", "STR"];
const CONT = /, CONT\.(\d+)$/;
/** Approaches, departures and arrivals (deleted records left out), each with its continuation pages after the first. */
export function chartGroups(recs) {
    const groups = new Map();
    const pages = recs.map((r, i) => ({ r, i, n: Number(r.name.match(CONT)?.[1] ?? 0) })).filter(({ r }) => KINDS.includes(r.code) && r.action !== "D");
    // First pages first, in metafile order, so groups come in the order of their first page; then CONT.1, CONT.2.
    for (const { r } of pages.sort((a, b) => a.n - b.n || a.i - b.i)) {
        const name = r.name.replace(CONT, ""), key = `${r.code} ${name}`;
        if (!groups.has(key))
            groups.set(key, { kind: r.code, name, pdfs: [] });
        groups.get(key).pdfs.push(r.pdf);
    }
    return [...groups.values()];
}
/** A page's image file: "00322IL7R.PDF" to "00322il7r.png". */
export const pageFile = (pdf) => pdf.toLowerCase().replace(/\.pdf$/, ".png");
// An approach name's types and its tail: " RWY <n>" (runway padded to two digits) or "-<letter>" (circling).
function approach(name) {
    const m = name.match(/^(.*?)(?: RWY (\d+)([LRC]?)|-([A-Z]))$/);
    if (!m)
        return { types: [name], tail: "" };
    return { types: m[1].split(" OR "), tail: m[4] ? `-${m[4]}` : m[2].padStart(2, "0") + m[3] };
}
const bare = (type) => type.replace("/DME", "");
/** Whether an approach chart's name ("ILS OR LOC/DME RWY 07L") draws a skycake procedure ("LOC RWY 07L"). */
export function approachMatches(chart, procedure) {
    const c = approach(chart), p = approach(procedure);
    return c.tail === p.tail && p.types.length === 1 && c.types.map(bare).includes(bare(p.types[0]));
}
/** Both names of every computer code, "(BXK4.BXK)", in a chart's text. */
export const codesIn = (text) => [...text.matchAll(/\(\s*([A-Z0-9]+)\s*\.\s*([A-Z0-9]+)\s*\)/g)].flatMap((m) => [m[1], m[2]]);
/** The airport's procedures a chart draws: approaches by type and runway, departures and arrivals by the computer code on the first page. */
export function proceduresOn(kind, name, firstPageText, procedures) {
    const codes = new Set(codesIn(firstPageText));
    const type = { IAP: "IAP", DP: "SID", STR: "STAR" }[kind];
    const on = procedures.filter((p) => p.type === type && (kind === "IAP" ? approachMatches(name, p.name) : codes.has(p.name)));
    return [...new Set(on.map((p) => p.name))];
}
/** Procedures no chart draws. */
export const noChart = (entries, procedures) => procedures.map((p) => p.name).filter((n) => !entries.some((e) => e.procedures.includes(n)));
