export function describe(o, L) {
    return L.summary(o.chart, o.areas.map((a) => L.facts(a.name, a.floor, a.ceiling)), o.procedures);
}
