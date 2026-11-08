import type { Question } from "./question.js";
import type { Scene } from "./scene.js";
export type Step = {
    caption: string;
    scene: Scene;
    seconds?: number;
    check?: Question;
};
export type Walkthrough = {
    id: string;
    title: string;
    area: string;
    steps: Step[];
};
/** t is seconds into the step. */
export type Play = {
    step: number;
    t: number;
    playing: boolean;
    started: boolean;
    checking: boolean;
    moved: boolean;
    done: boolean;
};
export declare const stepSeconds: (s: Step) => number;
export declare const begin: () => Play;
/** Play resumes the current step from its start (after a drag), restarts a finished walkthrough, and waits out a check. */
export declare function play(p: Play): Play;
export declare const pause: (p: Play) => Play;
export declare function tick(p: Play, w: Walkthrough, dt: number): Play;
export declare const next: (p: Play, w: Walkthrough) => Play;
export declare const back: (p: Play, w: Walkthrough) => Play;
export declare const moved: (p: Play) => Play;
export declare const answered: (p: Play, w: Walkthrough) => Play;
