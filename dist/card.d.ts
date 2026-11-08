import { type Answer, type Question } from "./question.js";
import type { Labels } from "./ui.js";
import type { View } from "./viewer.js";
/** say: sets the text of a live region already on the page (a new card's own region would not be announced). */
export declare function card(q: Question, L: Labels, view: View, say: (text: string) => void, onAnswer: (a: Answer) => void): {
    el: HTMLElement;
    reveal(right: boolean, facts: string | null, button: string, onNext: () => void): void;
    remove(): void;
};
