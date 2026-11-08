// Scenes onto the view, for the walkthrough player and the quiz: loads the procedure files a scene names, leaves out
// what the data no longer has (each missing name warned once), and shows only the newest scene asked for.
import type { Context } from "./freeroam.js";
import type { Procedure } from "./procedure.js";
import { locator } from "./question.js";
import { framedOnly, resolve, usable, type ProcedureRef, type Scene } from "./scene.js";

/** timeline: called once the scene resolves, just before the view applies it; its value is the step timeline (0 to 1). */
export function scenes(c: Context, timeline?: () => number) {
  const { view: v, data, labels: L } = c;
  const caption = c.fig.querySelector<HTMLElement>(".sc-caption");
  const warned = new Set<string>();
  const warn = (m: string) => {
    if (warned.has(m)) return;
    warned.add(m);
    console.warn(`skycake: ${m}`);
  };
  // Files load out of order, so only the newest scene asked for shows.
  let ticket = 0;
  let files: Procedure[] = [];
  // The scene on screen, for Explore.
  let onScreen: Scene = {};
  const show = async (scene: Scene, now = false) => {
    const mine = ++ticket;
    const plane = scene.airplane && "along" in scene.airplane ? [scene.airplane.along] : [];
    const load = (refs: ProcedureRef[]) => Promise.all(refs.map(async (r) => (await c.procedures(r.airport)).find((x) => x.name === r.name)));
    // The airplane's procedure goes in too: the viewer flies only a route it was passed.
    const found = (await load([...(scene.procedures ?? []), ...framedOnly(scene), ...plane])).filter((x): x is Procedure => !!x);
    if (mine !== ticket) return;
    const locate = locator(data, found);
    const ok = usable(scene, data, (fix) => !!locate({ fix }), warn);
    let r;
    try {
      r = resolve(ok, data);
    } catch (e) {
      // Never stop on a bad scene: the view stays as it was.
      warn(`${e instanceof Error ? e.message : e}; leaving the view as it was`);
      return;
    }
    onScreen = ok;
    files = found;
    if (caption) caption.textContent = L.caption(data.edition, r.chart);
    await v.apply(r, r.procedures.flatMap((x) => found.find((f) => f.airport === x.airport && f.name === x.name) ?? []), now, found, timeline?.());
  };
  return {
    show,
    /** The procedure files of the scene on screen, to score a fix by. */
    files: () => files,
    onScreen: () => onScreen,
    /** Drops any scene still loading. */
    stop: () => void ticket++,
  };
}
