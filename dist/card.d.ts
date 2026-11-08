import { type Answer, type Question } from "./question.js";
import type { Labels } from "./ui.js";
import type { View } from "./viewer.js";
/** Accessibility mode's number field: the 0-based index for a whole number 1 to count, else null. */
export declare function pickByNumber(text: string, count: number): number | null;
/**
 * say: sets the text of a live region already on the page (a new card's own region would not be announced).
 * a11y (accessibility mode): an answer is chosen, then Check scores it; a find question is answered by number (badges on
 * the map, a list, a field), and onSkip, when given, adds Skip.
 */
export declare function card(q: Question, L: Labels, view: View, say: (text: string) => void, onAnswer: (a: Answer) => void, o?: {
    a11y: boolean;
    onSkip?: () => void;
}): {
    el: HTMLElement;
    reveal(right: boolean, facts: string | null, button: string, onNext: () => void): void;
    remove(): void;
};
