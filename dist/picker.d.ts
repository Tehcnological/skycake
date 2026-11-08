import type { Candidate, View } from "./viewer.js";
export declare function picker(view: View, o: {
    /** The words after the number; "" for the number alone. */
    label: (c: Candidate, n: number) => string;
    onPick: (c: Candidate, n: number) => void;
    /** aria-pressed for each button: raised (In view), or the chosen answer (a find question). */
    pressed?: (c: Candidate) => boolean;
}): {
    el: HTMLElement;
    list(): Candidate[];
    refill(): void;
    stop(): void;
};
