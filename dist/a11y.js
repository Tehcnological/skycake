// Accessibility mode's switch. A site that has its own toggle passes mount's `a11y` and drives it; without one, skycake
// shows its own row and keeps the choice per browser under A11Y_KEY. Storage can be blocked (private windows), so every
// read and write is guarded and blocked storage means off.
export const A11Y_KEY = "skycake-a11y";
export function stored(s) {
    try {
        return s?.getItem(A11Y_KEY) === "1";
    }
    catch {
        return false;
    }
}
export function store(s, on) {
    try {
        if (on)
            s?.setItem(A11Y_KEY, "1");
        else
            s?.removeItem(A11Y_KEY);
    }
    catch {
        // shortcut: blocked storage keeps the choice for this page only; nothing more to do.
    }
}
/** row: skycake shows its own switch, only when the site passes nothing. */
export const initial = (option, s) => option === undefined ? { on: stored(s), row: true } : { on: option, row: false };
/** localStorage, or null where touching it throws. */
export function browserStorage() {
    try {
        return localStorage;
    }
    catch {
        return null;
    }
}
/** One step of the keyboard and the camera pad: a turn or tilt (radians), a move (fraction of the camera's distance), a zoom. */
export const STEPS = { turn: Math.PI / 24, pan: 0.15, zoom: 0.85 };
