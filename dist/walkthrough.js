export const stepSeconds = (s) => s.seconds ?? Math.ceil(4 + 0.06 * s.caption.length);
export const begin = () => ({ step: 0, t: 0, playing: false, started: false, checking: false, moved: false, done: false });
/** Play resumes the current step from its start (after a drag), restarts a finished walkthrough, and waits out a check. */
export function play(p) {
    if (p.done)
        return { ...begin(), playing: true, started: true };
    if (p.checking)
        return { ...p };
    return { ...p, playing: true, started: true, moved: false, t: p.moved ? 0 : p.t };
}
export const pause = (p) => ({ ...p, playing: false });
/** Jump to a step, or to done past the last one. Playing carries over; a finished walkthrough is paused. */
function go(p, w, step) {
    const done = step >= w.steps.length;
    return { ...p, step: done ? p.step : Math.max(0, step), t: 0, checking: false, moved: false, done, playing: p.playing && !done };
}
export function tick(p, w, dt) {
    if (!p.playing)
        return { ...p };
    const len = stepSeconds(w.steps[p.step]);
    const t = p.t + dt;
    if (t < len)
        return { ...p, t };
    if (w.steps[p.step].check)
        return { ...p, t: len, playing: false, checking: true };
    return go(p, w, p.step + 1);
}
export const next = (p, w) => go(p, w, p.step + 1);
/** From the end, Back replays the last step. */
export const back = (p, w) => ({ ...go(p, w, p.done ? p.step : p.step - 1), done: false });
export const moved = (p) => ({ ...p, playing: false, moved: true });
export const answered = (p, w) => go({ ...p, playing: true }, w, p.step + 1);
