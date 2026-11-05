export type Pt = [x: number, y: number];
/** tilt: both fingers moved up or down together, by dy. shape: a pinch and twist, with the fingers' midpoint moving from one spot to another. */
export type TwoFingerStep = {
    kind: "tilt";
    dy: number;
} | {
    kind: "shape";
    zoom: number;
    twist: number;
    from: Pt;
    mid: Pt;
};
/** A gesture stays what it began as, so a pinch never slips into a tilt. Returns null until it shows which it is. */
export declare function twoFingers(a0: Pt, b0: Pt): (a: Pt, b: Pt) => TwoFingerStep | null;
/** Fingers: the most on the view at once. Lifting after a pinch or a long press is not a tap. */
export declare const isTap: (t: {
    fingers: number;
    moved: number;
    ms: number;
}) => boolean;
