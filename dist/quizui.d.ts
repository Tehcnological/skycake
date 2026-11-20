import { type Context } from "./freeroam.js";
import { type Attempt, type QuizResult } from "./quiz.js";
import { type Scene } from "./scene.js";
import type { QuizMode } from "./ui.js";
/**
 * Resolves once the first question shows. explore: leave into free roam from the scene on screen; the quiz's DOM is gone
 * by then, and back (while the quiz is unfinished) returns to it. resume: the attempt to carry on with, and whether its
 * current question was already answered.
 */
export declare function quiz(c: Context, mode: QuizMode, onResult: (r: QuizResult) => void, explore: (from: Scene, back?: () => void) => void, resume?: {
    a: Attempt;
    answered: boolean;
    height?: 1 | 4;
}): Promise<void>;
