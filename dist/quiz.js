import { generate } from "./generate.js";
/**
 * Make from the generators, each Generate's filters laid over gen. One filter alone keeps to its side: kinds alone asks
 * about airspace only (no procedures, and the airplane only when kinds names a class), airports alone about procedures only.
 */
export const maker = (gen, rng) => (g) => {
    const kinds = g.kinds ?? (g.airports ? [] : undefined);
    if (g.generate === "airplane" && kinds && !kinds.some((k) => ["B", "C", "D", "E"].includes(k)))
        return null;
    return generate(g.generate, { ...gen, kinds, airports: g.airports, procedures: g.kinds && !g.airports ? [] : gen.procedures }, rng);
};
function shuffle(xs, rng) {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
export function attempt(quiz, make, rng) {
    const drawn = {};
    let items = quiz.items.flatMap((it, at) => {
        if (!("generate" in it))
            return [{ q: it, key: it.id ?? `item:${at}`, facts: null }];
        const out = [];
        for (let k = 0; k < it.count; k++) {
            const m = make(it);
            if (!m)
                continue; // a type that makes nothing leaves the attempt shorter
            const { facts, ...q } = m;
            out.push({ q: q, key: `generate:${it.generate}:${drawn[it.generate] ?? 0}`, facts });
            drawn[it.generate] = (drawn[it.generate] ?? 0) + 1;
        }
        return out;
    });
    if (quiz.shuffle)
        items = shuffle(items, rng);
    return { items, i: 0, right: 0, answered: 0, done: items.length === 0, practice: false };
}
function draw(pool, make, rng, n) {
    for (const g of shuffle(pool, rng)) {
        const m = make(g);
        if (m) {
            const { facts, ...q } = m;
            return { q: q, key: `generate:${g.generate}:${n}`, facts };
        }
    }
    return null;
}
export function practice(make, types, filters, rng) {
    const pool = types.map((generate) => ({ generate, count: 1, ...filters }));
    const first = draw(pool, make, rng, 0);
    return first && { items: [first], i: 0, right: 0, answered: 0, done: false, practice: true, pool };
}
export const answer = (a, right) => ({ ...a, right: a.right + (right ? 1 : 0), answered: a.answered + 1 });
export function advance(a, make, rng) {
    if (a.practice && a.pool) {
        const next = draw(a.pool, make, rng, a.items.length);
        if (next)
            return { ...a, items: [...a.items, next], i: a.i + 1 };
        return { ...a, done: true }; // nothing more can be made: end rather than spin
    }
    const i = a.i + 1;
    return { ...a, i: Math.min(i, a.items.length - 1), done: i >= a.items.length };
}
