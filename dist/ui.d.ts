import { type ChartName, type Kind, type Mode } from "./airspace.js";
import type { ProcType } from "./procedure.js";
import { type Scene } from "./scene.js";
import type { QuestionType } from "./generate.js";
import type { Quiz, QuizResult } from "./quiz.js";
import type { Walkthrough } from "./walkthrough.js";
/** On-screen words. Each site can supply its own; these are placeholders. */
export type Labels = {
    kinds: Record<Kind, string>;
    groups: Record<ProcType, string>;
    airspace: string;
    search: string;
    airports: string;
    noMatches: string;
    remove: (name: string) => string;
    procedureTab: string;
    viewTab: string;
    controls: string;
    diagram: string;
    tags: string;
    heightScale: (n: number) => string;
    /** The height button's name in words, on hover and on phones. */
    height: string;
    fullScreen: string;
    /** On phones: the map in the page opens full screen, and the tab bar closes it. */
    open: string;
    /** Walkthroughs and quizzes on a phone: the view in the page takes touches only after this is tapped. */
    wake: string;
    close: string;
    finalCourse: string;
    glidepath: string;
    fafToMap: string;
    floor700: string;
    view: string;
    /** Under the view: the charts shown and their edition. */
    caption: (edition: string, chart: ChartName) => string;
    /** The VFR/IFR button's name in words, and its text in each mode. */
    mode: string;
    modes: Record<Mode, string>;
    /** The chart button's name in words, and its text for each chart. */
    chart: string;
    charts: Record<ChartName, string>;
    /** The question card: the result words, the number question's button, the next button, and a revealed area's name and altitudes. */
    right: string;
    wrong: string;
    submit: string;
    continue: string;
    facts: (name: string, floor: string, ceiling: string) => string;
    /** After a wrong answer: the right one. */
    answerWas: (answer: string) => string;
    /** The walkthrough player: its buttons, the button that leaves into free roam, and the step count ("4/8"). */
    play: string;
    pause: string;
    back: string;
    next: string;
    explore: string;
    stepOf: (n: number, total: number) => string;
    /** The quiz: the count (question n of total, right so far; practice: right of answered), the card's next button,
     * the end's score and its button for a new attempt, and what practice says when its filters leave nothing to ask. */
    count: (n: number, total: number, right: number) => string;
    practiceCount: (right: number, answered: number) => string;
    nextQuestion: string;
    again: string;
    result: (right: number, total: number) => string;
    nothing: string;
    /** Accessibility mode's own switch, when the site does not drive it. */
    a11y: string;
    /** Accessibility mode: free roam's list of what is on the map, and the map in words (areas as `facts` gives them). */
    inView: string;
    /** Accessibility mode's find questions: the number field's name, and Skip (moves on without scoring). */
    number: string;
    skip: string;
    summary: (chart: string, areas: string[], procedures: string[]) => string;
    /** Accessibility mode's camera pad: each button's name; with Pan pressed the arrows move the map instead. */
    camera: {
        group: string;
        left: string;
        right: string;
        up: string;
        down: string;
        zoomIn: string;
        zoomOut: string;
        pan: string;
        panLeft: string;
        panRight: string;
        panUp: string;
        panDown: string;
    };
    /** The generated questions' prompts and their Yes/No answers. */
    ask: {
        findArea: (name: string) => string;
        /** One piece of an area in many pieces, by the altitudes the chart prints (SFC, 5,000). */
        findPiece: (name: string, floor: string, ceiling: string) => string;
        findFix: (fix: string) => string;
        floor: string;
        ceiling: string;
        cls: string;
        airplaneClass: string;
        clearance: string;
        radio: string;
        transponder: string;
        yes: string;
        no: string;
        altAt: (fix: string) => string;
        after: (fix: string) => string;
        faf: string;
        missed: string;
    };
};
export declare const LABELS: Labels;
export type Options = {
    /** URL of the area's data folder, e.g. "/skycake/phoenix/". */
    base: string;
    /** Free roam's first scene. Default: every type raised, the whole chart in view. */
    scene?: Scene;
    /** Shorthand for a first scene: types raised at first. */
    types?: Kind[];
    /** The airport current at first (search box, diagram). Default: KPHX when the area has it. */
    airport?: string;
    /** Shorthand for a first scene: this approach (at `airport`, default KPHX) shown. */
    approach?: string;
    labels?: Omit<Partial<Labels>, "ask" | "camera"> & {
        ask?: Partial<Labels["ask"]>;
        camera?: Partial<Labels["camera"]>;
    };
    /** For a standalone app: the view fills the window from the start, and its close button (phones: the Close tab;
     * desktop: in place of Full screen) calls this. */
    close?: () => void;
    /** The view's one job. "explore" (default): free roam. A walkthrough plays instead; its Explore button leaves into
     * free roam, and `next`, when given, is a link at its end (for example the topic's quiz). A quiz asks its items;
     * "practice" asks generated questions without end, of `types` (default all) within `kinds` and `airports`. */
    mode?: "explore" | {
        walkthrough: Walkthrough;
        next?: {
            label: string;
            href: string;
        };
    } | QuizMode;
    /** A quiz calls this after each answer and at its end. skycake stores nothing; the site decides what to keep. */
    onResult?: (r: QuizResult) => void;
    /** Accessibility mode, driven by the site's own toggle (instrumentready.com: a11yOn()). Left out, skycake shows its own
     * switch in free roam's view controls and keeps it per browser as "skycake-a11y". See docs/accessibility.md. */
    a11y?: boolean;
};
export type QuizMode = {
    quiz: Quiz | "practice";
    kinds?: Kind[];
    types?: QuestionType[];
    airports?: string[];
};
/** Builds the view inside `host`. Resolves once the view has loaded and shows its first scene. */
export declare function mount(host: HTMLElement, o: Options): Promise<void>;
