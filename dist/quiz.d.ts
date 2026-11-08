import type { Kind } from "./airspace.js";
import type { QuestionType, Rng } from "./generate.js";
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
/** pool: practice only, the draws advance() may append (one per allowed type). */
export type Attempt = {
    items: Item[];
    i: number;
    right: number;
    answered: number;
    done: boolean;
    practice: boolean;
    pool?: Generate[];
};
export type Make = (g: Generate) => (Question & {
    facts: string | null;
}) | null;
export type QuizResult = {
    quiz: string;
    item: string;
    right: boolean;
    ms: number;
} | {
    quiz: string;
    end: true;
    right: number;
    total: number;
};
export declare function attempt(quiz: Quiz, make: Make, rng: Rng): Attempt;
export declare function practice(make: Make, types: QuestionType[], filters: {
    kinds?: Kind[];
    airports?: string[];
}, rng: Rng): Attempt | null;
export declare const answer: (a: Attempt, right: boolean) => Attempt;
export declare function advance(a: Attempt, make: Make, rng: Rng): Attempt;
