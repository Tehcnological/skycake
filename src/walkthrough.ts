// A walkthrough's timing: a pure state machine the player drives. No DOM, no clock; the caller feeds tick() elapsed seconds.
import type { Question } from "./question.js";
import type { Scene } from "./scene.js";

export type Step = { caption: string; scene: Scene; seconds?: number; check?: Question };
export type Walkthrough = { id: string; title: string; area: string; steps: Step[] };

/** t is seconds into the step. */
export type Play = { step: number; t: number; playing: boolean; started: boolean; checking: boolean; moved: boolean; done: boolean };

export const stepSeconds = (s: Step): number => s.seconds ?? Math.ceil(4 + 0.06 * s.caption.length);

export const begin = (): Play => ({ step: 0, t: 0, playing: false, started: false, checking: false, moved: false, done: false });

/** Play resumes the current step from its start (after a drag), restarts a finished walkthrough, and waits out a check. */
export function play(p: Play): Play {
  if (p.done) return { ...begin(), playing: true, started: true };
  if (p.checking) return { ...p };
  return { ...p, playing: true, started: true, moved: false, t: p.moved ? 0 : p.t };
}

export const pause = (p: Play): Play => ({ ...p, playing: false });

/** Jump to a step, or to done past the last one. Playing carries over; a finished walkthrough is paused. */
function go(p: Play, w: Walkthrough, step: number): Play {
  const done = step >= w.steps.length;
  return { ...p, step: done ? p.step : Math.max(0, step), t: 0, checking: false, moved: false, done, playing: p.playing && !done };
}

export function tick(p: Play, w: Walkthrough, dt: number): Play {
  if (!p.playing) return { ...p };
  const len = stepSeconds(w.steps[p.step]);
  const t = p.t + dt;
  if (t < len) return { ...p, t };
  if (w.steps[p.step].check) return { ...p, t: len, playing: false, checking: true };
  return go(p, w, p.step + 1);
}

export const next = (p: Play, w: Walkthrough): Play => go(p, w, p.step + 1);
/** From the end, Back replays the last step. */
export const back = (p: Play, w: Walkthrough): Play => ({ ...go(p, w, p.done ? p.step : p.step - 1), done: false });
export const moved = (p: Play): Play => ({ ...p, playing: false, moved: true });
export const answered = (p: Play, w: Walkthrough): Play => go({ ...p, playing: true }, w, p.step + 1);
