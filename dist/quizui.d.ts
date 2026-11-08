import { type Context } from "./freeroam.js";
import { type QuizResult } from "./quiz.js";
import { type Scene } from "./scene.js";
import type { QuizMode } from "./ui.js";
/** Resolves once the first question shows. explore: leave into free roam from the scene on screen; the quiz's DOM is gone by then. */
export declare function quiz(c: Context, mode: QuizMode, onResult: (r: QuizResult) => void, explore: (from: Scene) => void): Promise<void>;
