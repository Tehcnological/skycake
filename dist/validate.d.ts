import type { AirspaceFile } from "./airspace.js";
import type { Procedure } from "./procedure.js";
import { type Quiz } from "./quiz.js";
import { type Question } from "./question.js";
import type { Walkthrough } from "./walkthrough.js";
/** Problems with a question, without a prefix; the quiz validator reuses this. loaded: every procedure of the area. */
export declare function questionProblems(q: Question, data: AirspaceFile, hasFix: (name: string) => boolean, loaded: Procedure[]): string[];
/** area: the folder name the site loaded (the data carries no area name). Problems read "<id> step <n>: <problem>". */
export declare function validateWalkthrough(w: Walkthrough, data: AirspaceFile, procedures: (airport: string) => Promise<Procedure[]>, area: string): Promise<string[]>;
/** Problems read "<quiz id> item <n>: <problem>". A generate item is tried once with seeded(0) and no elevation grid. */
export declare function validateQuiz(q: Quiz, data: AirspaceFile, procedures: (airport: string) => Promise<Procedure[]>, area: string): Promise<string[]>;
