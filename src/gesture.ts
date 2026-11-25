// Reading fingers on the view, in screen pixels (y runs down). The viewer turns the results into camera moves.
export type Pt = [x: number, y: number];
/** tilt: both fingers moved up or down together, by dy. shape: a pinch and twist about the fingers' midpoint. */
export type TwoFingerStep = { kind: "tilt"; dy: number } | { kind: "shape"; zoom: number; twist: number; mid: Pt };

// Fingers rarely start together, so a tilt only has to be clearly more together than apart, and a pinch waits a little.
const TILT_PX = 10;
const PINCH_PX = 16;
const WAIT_PX = 30;
// A first guess can be wrong, so the last stretch of movement keeps judging it, and takes more to change it than to make it.
const WINDOW_PX = 40;
const SWITCH_TILT_PX = 24;
const SWITCH_PINCH_PX = 30;
// One finger leading a swipe reads as a turn, and a turn swings the whole map, so a turn has to be clear before it counts.
const TWIST_RAD = (20 * Math.PI) / 180;
const TAP_PX = 8;
const TAP_MS = 500;
// Accessibility mode: a slow or shaky tap still counts.
const TAP_PX_LOOSE = 16;

/**
 * Returns null until the gesture shows what it is, then what it is now, judged on the fingers' recent movement.
 * Call it with both fingers current, not per finger: each finger's move is its own event, and seen alone a two-finger
 * swipe looks like one finger pulling away from the other.
 */
export function twoFingers(a0: Pt, b0: Pt): (a: Pt, b: Pt) => TwoFingerStep | null {
  let kind: TwoFingerStep["kind"] | null = null;
  let [pa, pb] = [a0, b0];
  let turned = 0;
  let twisting = false;
  const recent: [Pt, Pt][] = [[a0, b0]];
  const travel = ([ra, rb]: [Pt, Pt], a: Pt, b: Pt) => Math.max(Math.hypot(a[0] - ra[0], a[1] - ra[1]), Math.hypot(b[0] - rb[0], b[1] - rb[1]));
  return (a, b) => {
    recent.push([a, b]);
    while (travel(recent[1], a, b) >= WINDOW_PX) recent.shift();
    const [ra, rb] = recent[0];
    const [dax, day, dbx, dby] = [a[0] - ra[0], a[1] - ra[1], b[0] - rb[0], b[1] - rb[1]];
    const [x, y] = [Math.abs(dax + dbx) / 2, Math.abs(day + dby) / 2]; // moved together
    const apart = Math.hypot(dax - dbx, day - dby); // moved relative to each other
    const swipe = y >= TILT_PX && y >= 2 * x && y >= 2 * apart;
    if (!kind) {
      if (swipe) kind = "tilt";
      else if (apart >= PINCH_PX || travel(recent[0], a, b) >= WAIT_PX) kind = "shape";
      else return null;
    } else if (kind === "shape" && swipe && y >= SWITCH_TILT_PX) kind = "tilt";
    else if (kind === "tilt" && apart >= SWITCH_PINCH_PX && apart >= y) kind = "shape";
    const [qa, qb] = [pa, pb];
    [pa, pb] = [a, b];
    if (kind === "tilt") return { kind, dy: (a[1] - qa[1] + b[1] - qb[1]) / 2 };
    const turn = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.atan2(qb[1] - qa[1], qb[0] - qa[0]);
    // Clockwise on screen is positive; across the left of the circle atan2 jumps by a full turn.
    const twist = Math.atan2(Math.sin(turn), Math.cos(turn));
    turned += twist;
    twisting ||= Math.abs(turned) >= TWIST_RAD;
    return {
      kind,
      zoom: Math.hypot(b[0] - a[0], b[1] - a[1]) / (Math.hypot(qb[0] - qa[0], qb[1] - qa[1]) || 1),
      twist: twisting ? twist : 0,
      mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    };
  };
}

/** Fingers: the most on the view at once. Lifting after a pinch or a long press is not a tap. loose: accessibility mode. */
export const isTap = (t: { fingers: number; moved: number; ms: number }, loose = false) =>
  t.fingers === 1 && (loose ? t.moved <= TAP_PX_LOOSE : t.moved <= TAP_PX && t.ms < TAP_MS);
