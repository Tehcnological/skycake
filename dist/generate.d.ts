import { type AirspaceFile, type Area, type Kind } from "./airspace.js";
import type { Procedure } from "./procedure.js";
import type { Question } from "./question.js";
import { type Labels } from "./ui.js";
export type Rng = () => number;
export type QuestionType = "find" | "read" | "airplane" | "procedure";
/** kinds: the area kinds that may be asked about (default all). airports: the airports whose procedures may be asked about (default all). facts: the answer card's line (default LABELS.facts). */
export type Gen = {
    data: AirspaceFile;
    grid: Int16Array | null;
    procedures: Procedure[];
    ask: Labels["ask"];
    kinds?: Kind[];
    airports?: string[];
    facts?: Labels["facts"];
};
type Made = Question & {
    facts: string | null;
};
/** mulberry32 */
export declare function seeded(seed: number): Rng;
/** The answer card's line for an area: its name, floor and ceiling ("CHANDLER CLASS D · SFC to 3,900"). */
export declare const areaFacts: (facts: Labels["facts"], data: AirspaceFile, a: Area) => string;
/** One question of the type, or null when the filters leave nothing to ask. */
export declare function generate(type: QuestionType, g: Gen, rng: Rng): Made | null;
export {};
