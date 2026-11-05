// Reading fingers on the view, in screen pixels (y runs down). The viewer turns the results into camera moves.
export type Pt = [x: number, y: number];
/** tilt: both fingers moved up or down together, by dy. shape: a pinch and twist, with the fingers' midpoint moving from one spot to another. */
export type TwoFingerStep = { kind: "tilt"; dy: number } | { kind: "shape"; zoom: number; twist: number; from: Pt; mid: Pt };

const DECIDE_PX = 10;
const TAP_PX = 8;
const TAP_MS = 500;

/** A gesture stays what it began as, so a pinch never slips into a tilt. Returns null until it shows which it is. */
export function twoFingers(a0: Pt, b0: Pt): (a: Pt, b: Pt) => TwoFingerStep | null {
  let kind: TwoFingerStep["kind"] | null = null;
  let [pa, pb] = [a0, b0];
  return (a, b) => {
    if (!kind) {
      const [dax, day, dbx, dby] = [a[0] - a0[0], a[1] - a0[1], b[0] - b0[0], b[1] - b0[1]];
      if (Math.max(Math.hypot(dax, day), Math.hypot(dbx, dby)) < DECIDE_PX) return null;
      const upright = Math.abs(day) > 2 * Math.abs(dax) && Math.abs(dby) > 2 * Math.abs(dbx);
      const together = day * dby > 0 && Math.min(Math.abs(day), Math.abs(dby)) >= Math.max(Math.abs(day), Math.abs(dby)) / 2;
      kind = upright && together ? "tilt" : "shape";
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
