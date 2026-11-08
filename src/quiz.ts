// A quiz attempt: the items asked, the score, and endless practice. Pure; the quiz UI drives it, and `make` supplies drawn questions.
import type { Kind } from "./airspace.js";
import { generate, type Gen, type QuestionType, type Rng } from "./generate.js";
import type { Question } from "./question.js";

export type Generate = { generate: QuestionType; count: number; kinds?: Kind[]; airports?: string[] };
export type Quiz = { id: string; title: string; area: string; items: (Question | Generate)[]; shuffle?: boolean };
export type Item = { q: Question; key: string; facts: string | null };
/** pool: practice only, the draws advance() may append (one per allowed type). skipped: items skipped in accessibility mode. */
export type Attempt = { items: Item[]; i: number; right: number; answered: number; skipped: number; done: boolean; practice: boolean; pool?: Generate[] };
export type Make = (g: Generate) => (Question & { facts: string | null }) | null;
/** skipped: the student skipped the item (accessibility mode); right is false and it should not count. */
export type QuizResult = { quiz: string; item: string; right: boolean; ms: number; skipped?: true } | { quiz: string; end: true; right: number; total: number };

/**
 * Make from the generators, each Generate's filters laid over gen. One filter alone keeps to its side: kinds alone asks
 * about airspace only (no procedures, and the airplane only when kinds names a class), airports alone about procedures only.
 */
export const maker = (gen: Gen, rng: Rng): Make => (g) => {
  const kinds = g.kinds ?? (g.airports ? [] : undefined);
  if (g.generate === "airplane" && kinds && !kinds.some((k) => ["B", "C", "D", "E"].includes(k))) return null;
  return generate(g.generate, { ...gen, kinds, airports: g.airports, procedures: g.kinds && !g.airports ? [] : gen.procedures }, rng);
};

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function attempt(quiz: Quiz, make: Make, rng: Rng): Attempt {
  const drawn: Record<string, number> = {};
  let items: Item[] = quiz.items.flatMap((it, at): Item[] => {
    if (!("generate" in it)) return [{ q: it, key: it.id ?? `item:${at}`, facts: null }];
    const out: Item[] = [];
    for (let k = 0; k < it.count; k++) {
      const m = make(it);
      if (!m) continue; // a type that makes nothing leaves the attempt shorter
      const { facts, ...q } = m;
      out.push({ q: q as Question, key: `generate:${it.generate}:${drawn[it.generate] ?? 0}`, facts });
      drawn[it.generate] = (drawn[it.generate] ?? 0) + 1;
    }
    return out;
  });
  if (quiz.shuffle) items = shuffle(items, rng);
  return { items, i: 0, right: 0, answered: 0, skipped: 0, done: items.length === 0, practice: false };
}

function draw(pool: Generate[], make: Make, rng: Rng, n: number): Item | null {
  for (const g of shuffle(pool, rng)) {
    const m = make(g);
    if (m) {
      const { facts, ...q } = m;
      return { q: q as Question, key: `generate:${g.generate}:${n}`, facts };
    }
  }
  return null;
}

export function practice(make: Make, types: QuestionType[], filters: { kinds?: Kind[]; airports?: string[] }, rng: Rng): Attempt | null {
  const pool = types.map((generate): Generate => ({ generate, count: 1, ...filters }));
  const first = draw(pool, make, rng, 0);
  return first && { items: [first], i: 0, right: 0, answered: 0, skipped: 0, done: false, practice: true, pool };
}

export const answer = (a: Attempt, right: boolean): Attempt => ({ ...a, right: a.right + (right ? 1 : 0), answered: a.answered + 1 });
/** A skipped item is neither right nor answered, and a fixed quiz's total drops by one. */
export const skip = (a: Attempt): Attempt => ({ ...a, skipped: a.skipped + 1 });
/** A fixed quiz's count: question n of total, skips taken out. */
export const progress = (a: Attempt): { n: number; total: number } => ({ n: a.answered + 1, total: a.items.length - a.skipped });

export function advance(a: Attempt, make: Make, rng: Rng): Attempt {
  if (a.practice && a.pool) {
    const next = draw(a.pool, make, rng, a.items.length);
    if (next) return { ...a, items: [...a.items, next], i: a.i + 1 };
    return { ...a, done: true }; // nothing more can be made: end rather than spin
  }
  const i = a.i + 1;
  return { ...a, i: Math.min(i, a.items.length - 1), done: i >= a.items.length };
}
