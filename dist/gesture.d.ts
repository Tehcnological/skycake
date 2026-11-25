export type Pt = [x: number, y: number];
/** tilt: both fingers moved up or down together, by dy. shape: a pinch and twist about the fingers' midpoint. */
export type TwoFingerStep = {
    kind: "tilt";
    dy: number;
} | {
    kind: "shape";
    zoom: number;
    twist: number;
    mid: Pt;
};
/**
 * Returns null until the gesture shows what it is, then what it is now, judged on the fingers' recent movement.
 * Call it with both fingers current, not per finger: each finger's move is its own event, and seen alone a two-finger
 * swipe looks like one finger pulling away from the other.
 */
export declare function twoFingers(a0: Pt, b0: Pt): (a: Pt, b: Pt) => TwoFingerStep | null;
/** Fingers: the most on the view at once. Lifting after a pinch or a long press is not a tap. loose: accessibility mode. */
export declare const isTap: (t: {
    fingers: number;
    moved: number;
    ms: number;
}, loose?: boolean) => boolean;
