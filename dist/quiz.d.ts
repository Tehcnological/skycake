import type { Kind } from "./airspace.js";
import { type Gen, type QuestionType, type Rng } from "./generate.js";
import type { Question } from "./question.js";
export type Generate = {
    generate: QuestionType;
    count: number;
    kinds?: Kind[];
    airports?: string[];
};
export type Quiz = {
    id: string;
    title: string;
    area: string;
    items: (Question | Generate)[];
    shuffle?: boolean;
};
export type Item = {
    q: Question;
    key: string;
    facts: string | null;
};
/** pool: practice only, the draws advance() may append (one per allowed type). skipped: items skipped in accessibility mode. */
export type Attempt = {
    items: Item[];
    i: number;
    right: number;
    answered: number;
    skipped: number;
    done: boolean;
    practice: boolean;
    pool?: Generate[];
};
export type Make = (g: Generate) => (Question & {
    facts: string | null;
}) | null;
/** skipped: the student skipped the item (accessibility mode); right is false and it should not count. */
export type QuizResult = {
    quiz: string;
    item: string;
    right: boolean;
    ms: number;
    skipped?: true;
} | {
    quiz: string;
    end: true;
    right: number;
    total: number;
};
/**
 * Make from the generators, each Generate's filters laid over gen. One filter alone keeps to its side: kinds alone asks
 * about airspace only (no procedures, and the airplane only when kinds names a class), airports alone about procedures only.
 */
export declare const maker: (gen: Gen, rng: Rng) => Make;
export declare function attempt(quiz: Quiz, make: Make, rng: Rng): Attempt;
export declare function practice(make: Make, types: QuestionType[], filters: {
    kinds?: Kind[];
    airports?: string[];
}, rng: Rng): Attempt | null;
export declare const answer: (a: Attempt, right: boolean) => Attempt;
/** A skipped item is neither right nor answered, and a fixed quiz's total drops by one. */
export declare const skip: (a: Attempt) => Attempt;
/** A fixed quiz's count: question n of total, skips taken out; n stays on a question while its answer shows. */
export declare const progress: (a: Attempt) => {
    n: number;
    total: number;
};
export declare function advance(a: Attempt, make: Make, rng: Rng): Attempt;
