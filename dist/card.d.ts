import { type Answer, type Question } from "./question.js";
import type { Labels } from "./ui.js";
import type { View } from "./viewer.js";
export declare function card(q: Question, L: Labels, view: View, onAnswer: (a: Answer) => void): {
    el: HTMLElement;
    reveal(right: boolean, facts: string | null, button: string, onNext: () => void): void;
    remove(): void;
};
