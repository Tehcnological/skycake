// Reading fingers on the view, in screen pixels (y runs down). The viewer turns the results into camera moves.
export type Pt = [x: number, y: number];
/** tilt: both fingers moved up or down together, by dy. shape: a pinch and twist, with the fingers' midpoint moving from one spot to another. */
export type TwoFingerStep = { kind: "tilt"; dy: number } | { kind: "shape"; zoom: number; twist: number; from: Pt; mid: Pt };

// Fingers rarely start together, so a tilt only has to be clearly more together than apart, and a pinch waits a little.
const TILT_PX = 10;
const PINCH_PX = 16;
const WAIT_PX = 30;
const TAP_PX = 8;
const TAP_MS = 500;

/**
 * A gesture stays what it began as, so a pinch never slips into a tilt. Returns null until it shows which it is.
 * Call it with both fingers current, not per finger: each finger's move is its own event, and seen alone a two-finger
 * swipe looks like one finger pulling away from the other.
 */
export function twoFingers(a0: Pt, b0: Pt): (a: Pt, b: Pt) => TwoFingerStep | null {
  let kind: TwoFingerStep["kind"] | null = null;
  let [pa, pb] = [a0, b0];
  return (a, b) => {
    if (!kind) {
      const [dax, day, dbx, dby] = [a[0] - a0[0], a[1] - a0[1], b[0] - b0[0], b[1] - b0[1]];
      const [x, y] = [Math.abs(dax + dbx) / 2, Math.abs(day + dby) / 2]; // moved together
      const apart = Math.hypot(dax - dbx, day - dby); // moved relative to each other
      if (y >= TILT_PX && y >= 2 * x && y >= 2 * apart) kind = "tilt";
      else if (apart >= PINCH_PX || Math.max(Math.hypot(dax, day), Math.hypot(dbx, dby)) >= WAIT_PX) kind = "shape";
      else return null;
    }
    const [qa, qb] = [pa, pb];
    [pa, pb] = [a, b];
    if (kind === "tilt") return { kind, dy: (a[1] - qa[1] + b[1] - qb[1]) / 2 };
    const turn = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.atan2(qb[1] - qa[1], qb[0] - qa[0]);
    return {
      kind,
      zoom: Math.hypot(b[0] - a[0], b[1] - a[1]) / (Math.hypot(qb[0] - qa[0], qb[1] - qa[1]) || 1),
      // Clockwise on screen is positive; across the left of the circle atan2 jumps by a full turn.
      twist: Math.atan2(Math.sin(turn), Math.cos(turn)),
      from: [(qa[0] + qb[0]) / 2, (qa[1] + qb[1]) / 2],
      mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    };
  };
}

/** Fingers: the most on the view at once. Lifting after a pinch or a long press is not a tap. */
export const isTap = (t: { fingers: number; moved: number; ms: number }) => t.fingers === 1 && t.moved <= TAP_PX && t.ms < TAP_MS;
