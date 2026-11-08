import type { AirspaceFile } from "./airspace.js";
import type { Procedure } from "./procedure.js";
import type { Scene, Target } from "./scene.js";
/** answerArea: an area the reveal raises though the question never names it (a generated airplane point's class area). */
export type Question = {
    id?: string;
    prompt: string;
    scene?: Scene;
    explanation?: string;
    answerArea?: string;
} & ({
    type: "find";
    answer: Target;
} | {
    type: "read" | "airplane" | "procedure";
    choices: string[];
    answer: number;
} | {
    type: "read";
    number: {
        answer: number;
        tolerance: number;
        unit?: string;
    };
});
export type Answer = {
    choice: number;
} | {
    number: number;
} | {
    area: string | null;
    at: [lat: number, lon: number] | null;
};
/** A fix or airport's position; the caller builds it from the area's airports, waypoints and loaded procedure fixes. */
export type Locate = (t: Target) => [lat: number, lon: number] | null;
/** Locate from the area: a fix in the loaded procedures or the area's waypoints, an airport, a point. */
export declare const locator: (data: Pick<AirspaceFile, "airports" | "waypoints">, procedures: Procedure[]) => Locate;
/** A malformed question (one validateQuiz would reject) scores false with a warning: the quiz goes on. */
export declare function score(q: Question, a: Answer, locate: Locate): boolean;
/** A typed number in US style: commas and spaces dropped ("3,000" is 3000); null when it is not a number. */
export declare function typedNumber(text: string): number | null;
/** The type's default scene with the question's own fields laid over it. */
export declare const questionScene: (q: Question) => Scene;
/** After the answer: the answer raised, tags on, tilted to 3D on the frame the question showed. */
export declare function revealScene(q: Question): Scene;
