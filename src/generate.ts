// Quiz questions drawn from the FAA data: seeded and pure, so the same seed asks the same questions. Every answer and
// every wrong choice comes from the area's airspace, terrain and procedures; the class rules live in airclass.ts.
import { deepest, hundreds, KINDS, type AirspaceFile, type Area, type Kind } from "./airspace.js";
import { classAt, groundFt, nearBoundary, needs } from "./airclass.js";
import { flightLine } from "./fly.js";
import type { Procedure } from "./procedure.js";
import type { Question } from "./question.js";
import { LABELS, type Labels } from "./ui.js";

export type Rng = () => number;
export type QuestionType = "find" | "read" | "airplane" | "procedure";
/** kinds: the area kinds that may be asked about (default all). airports: the airports whose procedures may be asked about (default all). facts: the answer card's line (default LABELS.facts). */
export type Gen = { data: AirspaceFile; grid: Int16Array | null; procedures: Procedure[]; ask: Labels["ask"]; kinds?: Kind[]; airports?: string[]; facts?: Labels["facts"] };
type Made = Question & { facts: string | null };

/** mulberry32 */
export function seeded(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffled = <T>(xs: T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** The right choice among up to 3 distinct wrong ones, in random order; null with no wrong choice to offer. */
function choose(right: string, wrong: string[], rng: Rng): { choices: string[]; answer: number } | null {
  const w = [...new Set(wrong)].filter((x) => x !== right).slice(0, 3);
  if (!w.length) return null;
  const choices = shuffled([right, ...w], rng);
  return { choices, answer: choices.indexOf(right) };
}

const feetText = (ft: number, ground: number) => (ft <= ground ? "SFC" : ft.toLocaleString("en-US"));
const factsOf = (g: Gen, a: Area) => (g.facts ?? LABELS.facts)(a.name, feetText(a.floor, g.data.ground), feetText(a.ceiling, g.data.ground));
const allowed = (g: Gen) => g.data.areas.filter((a) => (g.kinds ?? KINDS).includes(a.kind));
const procs = (g: Gen) => g.procedures.filter((p) => !g.airports || g.airports.includes(p.airport));
const sceneOf = (p: Procedure) => ({ procedures: [{ airport: p.airport, name: p.name }] });

function find(g: Gen, rng: Rng): Made | null {
  // A name that repeats cannot be tapped by name: the score is by id.
  const areas = allowed(g).filter((a) => g.data.areas.filter((o) => o.name === a.name).length === 1);
  const ps = procs(g).filter((p) => p.fixes.some((f) => p.fixes.filter((o) => o.name === f.name).length === 1));
  if (ps.length && (!areas.length || rng() < 0.5)) {
    const p = ps[Math.floor(rng() * ps.length)];
    const ones = p.fixes.filter((f) => p.fixes.filter((o) => o.name === f.name).length === 1);
    const fix = ones[Math.floor(rng() * ones.length)].name;
    return { type: "find", prompt: g.ask.findFix(fix), answer: { fix }, scene: sceneOf(p), facts: null };
  }
  if (!areas.length) return null;
  const a = areas[Math.floor(rng() * areas.length)];
  return { type: "find", prompt: g.ask.findArea(a.name), answer: { area: a.id }, facts: factsOf(g, a) };
}

const middles = new WeakMap<Area, number[]>();
const middle = (a: Area) => middles.get(a) ?? (middles.set(a, deepest(a.rings[0])), middles.get(a)!);
const CLASSES = ["B", "C", "D", "E"];

function read(g: Gen, rng: Rng): Made | null {
  const { data, ask } = g;
  const areas = allowed(g);
  for (const sub of shuffled(["floor", "ceiling", "cls"] as const, rng)) {
    for (const a of shuffled(areas, rng)) {
      let made: { choices: string[]; answer: number } | null;
      if (sub === "cls") {
        if (!CLASSES.includes(a.kind)) continue;
        made = choose(a.kind, shuffled(data.areas.map((x) => x.kind).filter((k) => CLASSES.includes(k)), rng), rng);
      } else {
        const show = (x: Area) => hundreds(x[sub], data.ground);
        const [y, x] = middle(a);
        const away = (o: Area) => Math.hypot(middle(o)[0] - y, middle(o)[1] - x);
        const near = data.areas.filter((o) => o.kind === a.kind && o !== a).sort((p, q) => away(p) - away(q));
        made = choose(show(a), near.map(show), rng);
      }
      if (made) return { type: "read", prompt: ask[sub], scene: { highlight: [{ area: a.id }] }, ...made, facts: factsOf(g, a) };
    }
  }
  return null;
}

function airplane(g: Gen, rng: Rng): Made | null {
  const { data, grid, ask } = g;
  const { s, w, n, e } = data.bounds;
  for (let i = 0; i < 200; i++) {
    const [lat, lon] = [s + rng() * (n - s), w + rng() * (e - w)];
    const lo = Math.ceil((groundFt(data, grid, lat, lon) + 500) / 100) * 100;
    const ft = lo + Math.floor((rng() * (17500 - lo)) / 100) * 100;
    if (nearBoundary(data, grid, lat, lon, ft)) continue;
    const c = classAt(data, grid, lat, lon, ft);
    const area = data.areas.find((a) => a.id === c.area);
    const base = { type: "airplane" as const, scene: { airplane: { at: [lat, lon, ft] as [number, number, number] } }, facts: area ? factsOf(g, area) : null };
    const kind = (["class", "clearance", "radio", "transponder"] as const)[Math.floor(rng() * 4)];
    if (kind === "class") return { ...base, prompt: ask.airplaneClass, ...choose(c.kind, shuffled(["B", "C", "D", "E", "G"], rng), rng)! };
    return { ...base, prompt: ask[kind], choices: [ask.yes, ask.no], answer: needs(c, ft)[kind] ? 0 : 1 };
  }
  return null;
}

/** The fix names along the flight line, in order. */
const route = (p: Procedure) => {
  const names = flightLine(p).map((pt) => p.fixes.find((f) => Math.abs(f.lat - pt[0]) < 1e-4 && Math.abs(f.lon - pt[1]) < 1e-4)?.name);
  return names.filter((x): x is string => !!x).filter((x, i, a) => x !== a[i - 1]); // a hold repeats its fix
};

function procedure(g: Gen, rng: Rng): Made | null {
  const { ask } = g;
  for (const p of shuffled(procs(g), rng)) {
    const names = p.fixes.map((f) => f.name);
    const once = (n: string) => names.filter((x) => x === n).length === 1;
    const make = (prompt: string, right: string, wrong: string[]): Made | null => {
      const c = choose(right, shuffled(wrong, rng), rng);
      return c && { type: "procedure", prompt, scene: sceneOf(p), ...c, facts: null };
    };
    const line = route(p);
    const subs = {
      alt: () => {
        const f = shuffled(p.fixes.filter((x) => x.alt && once(x.name)), rng)[0];
        return f && make(ask.altAt(f.name), f.alt!, p.fixes.map((x) => x.alt).filter((x): x is string => !!x));
      },
      after: () => {
        const i = shuffled(line.map((_, k) => k).filter((k) => k < line.length - 1 && once(line[k])), rng)[0];
        return i === undefined ? null : make(ask.after(line[i]), line[i + 1], names.filter((x) => x !== line[i]));
      },
      faf: () => {
        const f = p.fixes.find((x) => x.role === "FAF");
        return f && make(ask.faf, f.name, names);
      },
      missed: () => {
        const f = p.fixes.find((x) => x.seg === "missed");
        return f && make(ask.missed, f.name, names);
      },
    };
    for (const k of shuffled(Object.keys(subs) as (keyof typeof subs)[], rng)) {
      const q = subs[k]();
      if (q) return q;
    }
  }
  return null;
}

/** One question of the type, or null when the filters leave nothing to ask. */
export function generate(type: QuestionType, g: Gen, rng: Rng): Made | null {
  return { find, read, airplane, procedure }[type](g, rng);
}
