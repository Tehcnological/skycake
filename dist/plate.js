/** `show` adds a procedure in 3D, as picking it in the search box does. */
export function plateView(_c, _el, _on) {
    return { has: false, procedures: () => { }, destroy: () => { } };
}
/**
 * The picker's order: for each shown procedure in turn, the first chart of its airport that draws it, then every other
 * chart of the current airport in index (FAA) order. Each chart once; a procedure whose index is not loaded is skipped.
 */
export function pickOrder(indexes, refs, airport) {
    const out = [];
    const put = (a, entry) => {
        if (entry && !out.some((p) => p.airport === a && p.entry === entry))
            out.push({ airport: a, entry });
    };
    for (const r of refs)
        put(r.airport, indexes.get(r.airport)?.find((x) => x.procedures.includes(r.name)));
    if (airport !== null)
        for (const x of indexes.get(airport) ?? [])
            put(airport, x);
    return out;
}
/** The chart for a shown procedure: the current one when it draws it, else the first that does. */
export function chartFor(entries, name, current) {
    if (current?.procedures.includes(name))
        return current;
    return entries.find((x) => x.procedures.includes(name)) ?? null;
}
/** Picking a chart shows the procedures it draws. */
export const pickRefs = (p) => p.entry.procedures.map((name) => ({ airport: p.airport, name }));
/** The arrows for page `page` (from 1) of `pages`; none for a chart of one page. */
export function pageArrows(pages, page) {
    return pages > 1 ? { back: page > 1, next: page < pages } : null;
}
/** The whole chart in the box, centred. */
export function fitChart(img, box) {
    const s = Math.min(box.w / img.w, box.h / img.h);
    return { x: (box.w - img.w * s) / 2, y: (box.h - img.h * s) / 2, s };
}
/** Zooms by `factor`, the scale clamped to min..max, keeping the chart point under `at` where it is. */
export function zoomAbout(t, factor, at, min, max) {
    const s = Math.min(max, Math.max(min, t.s * factor));
    const k = s / t.s;
    return { x: at[0] - (at[0] - t.x) * k, y: at[1] - (at[1] - t.y) * k, s };
}
