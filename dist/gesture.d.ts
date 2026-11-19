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
/** How far a click or pen tap may wander and still be one, also before a drag zooms. */
export declare const TAP_SLOP = 10;
/** A second tap or click soon after and near the first: it zooms, as a map app's double-click and double-tap and drag. */
export declare const isSecondTap: (first: {
    at: Pt;
    ms: number;
} | null, at: Pt, ms: number) => boolean;
/** How far a double-tap and drag zooms: down zooms in, up zooms out, twice per 150 px. */
export declare const dragZoom: (dy: number) => number;
