// Quiz questions drawn from the FAA data: seeded and pure, so the same seed asks the same questions. Every answer and
// every wrong choice comes from the area's airspace, terrain and procedures; the class rules live in airclass.ts.
import { deepest, hundreds, inRing, KINDS } from "./airspace.js";
import { classAt, groundFt, nearBoundary, needs } from "./airclass.js";
import { flightLine } from "./fly.js";
import { LABELS } from "./ui.js";
/** mulberry32 */
export function seeded(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const shuffled = (xs, rng) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};
/** The right choice among up to 3 distinct wrong ones, in random order; null with no wrong choice to offer. */
function choose(right, wrong, rng) {
    const w = [...new Set(wrong)].filter((x) => x !== right).slice(0, 3);
    if (!w.length)
        return null;
    const choices = shuffled([right, ...w], rng);
    return { choices, answer: choices.indexOf(right) };
}
const feetText = (ft, ground) => (ft <= ground ? "SFC" : ft.toLocaleString("en-US"));
/** The answer card's line for an area: its name, floor and ceiling ("CHANDLER CLASS D · SFC to 3,900"). */
export const areaFacts = (facts, data, a) => facts(a.name, feetText(a.floor, data.ground), feetText(a.ceiling, data.ground));
const factsOf = (g, a) => areaFacts(g.facts ?? LABELS.facts, g.data, a);
const allowed = (g) => g.data.areas.filter((a) => (g.kinds ?? KINDS).includes(a.kind));
const procs = (g) => g.procedures.filter((p) => !g.airports || g.airports.includes(p.airport));
const sceneOf = (p) => ({ procedures: [{ airport: p.airport, name: p.name }] });
function find(g, rng) {
    // A name that repeats cannot be tapped by name: the score is by id. The view does not make E700 or MODEC tappable.
    const areas = allowed(g).filter((a) => a.kind !== "E700" && a.kind !== "MODEC" && g.data.areas.filter((o) => o.name === a.name).length === 1);
    const ps = procs(g).filter((p) => p.fixes.some((f) => p.fixes.filter((o) => o.name === f.name).length === 1));
    if (ps.length && (!areas.length || rng() < 0.5)) {
        const p = ps[Math.floor(rng() * ps.length)];
        const ones = p.fixes.filter((f) => p.fixes.filter((o) => o.name === f.name).length === 1);
        const fix = ones[Math.floor(rng() * ones.length)].name;
        return { type: "find", prompt: g.ask.findFix(fix), answer: { fix }, scene: { ...sceneOf(p), tags: true }, facts: null };
    }
    if (!areas.length)
        return null;
    const a = areas[Math.floor(rng() * areas.length)];
    return { type: "find", prompt: g.ask.findArea(a.name), answer: { area: a.id }, facts: factsOf(g, a) };
}
const middles = new WeakMap();
const middle = (a) => middles.get(a) ?? (middles.set(a, deepest(a.rings[0])), middles.get(a));
const CLASSES = ["B", "C", "D", "E"];
/** The kinds whose floor or ceiling is asked: one charted and meaningful (a Class D floor is the surface). */
const READS = { floor: ["B", "C"], ceiling: ["B", "C", "D"] };
function read(g, rng) {
    const { data, ask } = g;
    const areas = allowed(g);
    for (const sub of shuffled(["floor", "ceiling", "cls"], rng)) {
        for (const a of shuffled(areas, rng)) {
            let made;
            if (sub === "cls") {
                if (!CLASSES.includes(a.kind))
                    continue;
                made = choose(a.kind, shuffled(data.areas.map((x) => x.kind).filter((k) => CLASSES.includes(k)), rng), rng);
            }
            else {
                if (!READS[sub].includes(a.kind))
                    continue;
                const show = (x) => hundreds(x[sub], data.ground);
                const [y, x] = middle(a);
                const away = (o) => Math.hypot(middle(o)[0] - y, middle(o)[1] - x);
                const near = data.areas.filter((o) => o.kind === a.kind && o !== a).sort((p, q) => away(p) - away(q));
                made = choose(show(a), near.map(show), rng);
            }
            if (made)
                return { type: "read", prompt: ask[sub], scene: { highlight: [{ area: a.id }] }, ...made, facts: factsOf(g, a) };
        }
    }
    return null;
}
/** An area's outline box, inside the data's bounds. */
function boxOf(data, a) {
    const ys = a.rings.flat().map((p) => p[0]), xs = a.rings.flat().map((p) => p[1]);
    return { s: Math.max(data.bounds.s, Math.min(...ys)), n: Math.min(data.bounds.n, Math.max(...ys)), w: Math.max(data.bounds.w, Math.min(...xs)), e: Math.min(data.bounds.e, Math.max(...xs)) };
}
function airplane(g, rng) {
    const { data, grid, ask } = g;
    // A uniform draw is nearly all Class E, so about half the questions aim inside a B, C or D area's slab (decided once
    // per question, as aimed draws are skipped more often); after 100 misses the draw goes uniform.
    const targets = allowed(g).filter((a) => ["B", "C", "D"].includes(a.kind));
    const aim = targets.length > 0 && rng() < 0.5;
    for (let i = 0; i < 200; i++) {
        const t = aim && i < 100 ? targets[Math.floor(rng() * targets.length)] : null;
        const { s, w, n, e } = t ? boxOf(data, t) : data.bounds;
        const [lat, lon] = [s + rng() * (n - s), w + rng() * (e - w)];
        if (t && !t.rings.some((r) => inRing([lat, lon], r)))
            continue;
        const ground = Math.ceil((groundFt(data, grid, lat, lon) + 500) / 100) * 100;
        const [lo, hi] = t ? [Math.max(ground, Math.ceil(t.floor / 100) * 100), Math.min(17500, t.ceiling)] : [ground, 17500];
        if (lo >= hi)
            continue;
        const ft = lo + Math.floor((rng() * (hi - lo)) / 100) * 100;
        if (nearBoundary(data, grid, lat, lon, ft))
            continue;
        const c = classAt(data, grid, lat, lon, ft);
        const area = data.areas.find((a) => a.id === c.area);
        const base = { type: "airplane", scene: { airplane: { at: [lat, lon, ft] } }, facts: area ? factsOf(g, area) : null, ...(area && { answerArea: area.id }) };
        const kind = ["class", "clearance", "radio", "transponder"][Math.floor(rng() * 4)];
        if (kind === "class")
            return { ...base, prompt: ask.airplaneClass, ...choose(c.kind, shuffled(["B", "C", "D", "E", "G"], rng), rng) };
        return { ...base, prompt: ask[kind], choices: [ask.yes, ask.no], answer: needs(c, ft)[kind] ? 0 : 1 };
    }
    return null;
}
/** The fix names along points, in order. */
const named = (p, pts) => {
    const names = pts.map((pt) => p.fixes.find((f) => Math.abs(f.lat - pt[0]) < 1e-4 && Math.abs(f.lon - pt[1]) < 1e-4)?.name);
    return names.filter((x) => !!x).filter((x, i, a) => x !== a[i - 1]); // a hold repeats its fix
};
/** Fixes with more than one next fix across the paths, missed approach aside: where transitions split, "after" has no one answer. */
const splits = (p) => {
    const next = new Map();
    for (const path of p.paths)
        if (path.seg !== "missed")
            named(p, path.pts).forEach((x, i, a) => i && next.set(a[i - 1], (next.get(a[i - 1]) ?? new Set()).add(x)));
    return new Set([...next].filter(([, v]) => v.size > 1).map(([k]) => k));
};
function procedure(g, rng) {
    const { ask } = g;
    for (const p of shuffled(procs(g), rng)) {
        const names = p.fixes.map((f) => f.name);
        const once = (n) => names.filter((x) => x === n).length === 1;
        const make = (prompt, right, wrong) => {
            const c = choose(right, shuffled(wrong, rng), rng);
            return c && { type: "procedure", prompt, scene: sceneOf(p), ...c, facts: null };
        };
        const line = named(p, flightLine(p));
        const split = splits(p);
        const subs = {
            alt: () => {
                const f = shuffled(p.fixes.filter((x) => x.alt && once(x.name)), rng)[0];
                return f && make(ask.altAt(f.name), f.alt, p.fixes.map((x) => x.alt).filter((x) => !!x));
            },
            after: () => {
                const i = shuffled(line.map((_, k) => k).filter((k) => k < line.length - 1 && once(line[k]) && !split.has(line[k])), rng)[0];
                return i === undefined ? null : make(ask.after(line[i]), line[i + 1], names.filter((x) => x !== line[i]));
            },
            faf: () => {
                const f = p.fixes.find((x) => x.role === "FAF");
                return f && make(ask.faf, f.name, names);
            },
            missed: () => {
                const f = p.fixes.find((x) => x.seg === "missed");
                // Wrong choices leave out the MAP and every other missed approach fix (the hold is on the missed approach too).
                return f && make(ask.missed, f.name, p.fixes.filter((x) => x.role !== "MAP" && x.seg !== "missed").map((x) => x.name));
            },
        };
        for (const k of shuffled(Object.keys(subs), rng)) {
            const q = subs[k]();
            if (q)
                return q;
        }
    }
    return null;
}
/** One question of the type, or null when the filters leave nothing to ask. */
export function generate(type, g, rng) {
    return { find, read, airplane, procedure }[type](g, rng);
}
