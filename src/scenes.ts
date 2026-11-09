// Scenes onto the view, for the walkthrough player and the quiz: loads the procedure files a scene names, leaves out
// what the data no longer has (each missing name warned once), and shows only the newest scene asked for.
import type { Context } from "./freeroam.js";
import type { Procedure } from "./procedure.js";
import { locator } from "./question.js";
import { resolve, sceneRefs, usable, type PlateRef, type Scene } from "./scene.js";

/**
 * timeline: called once the scene resolves, just before the view applies it; its value is the step timeline (0 to 1).
 * plate: called then too with the scene's plate when it has one (null closes the panel); left out, not called.
 */
export function scenes(c: Context, timeline?: () => number, plate?: (p: PlateRef | null) => void) {
  const { view: v, data, labels: L } = c;
  const caption = c.fig.querySelector<HTMLElement>(".sc-caption");
  const warned = new Set<string>();
  const warn = (m: string) => {
    if (warned.has(m)) return;
    warned.add(m);
    console.warn(`skycake: ${m}`);
  };
  const filesOf = async (scene: Scene) => (await Promise.all(sceneRefs(scene).map(async (r) => (await c.procedures(r.airport)).find((x) => x.name === r.name)))).filter((x): x is Procedure => !!x);
  // Files load out of order, so only the newest scene asked for shows.
  let ticket = 0;
  // The scene on screen, for Explore.
  let onScreen: Scene = {};
  const show = async (scene: Scene, now = false) => {
    const mine = ++ticket;
    // The airplane's procedure goes in too: the viewer flies only a route it was passed.
    const found = await filesOf(scene);
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
    if (caption) caption.textContent = L.caption(data.edition, r.chart);
    if (ok.plate !== undefined) plate?.(ok.plate);
    await v.apply(r, r.procedures.flatMap((x) => found.find((f) => f.airport === x.airport && f.name === x.name) ?? []), now, found, timeline?.());
  };
  return {
    show,
    /** The procedure files a scene loads: a question's fix is scored by its own scene's, whatever is on screen. */
    filesOf,
    onScreen: () => onScreen,
    /** Drops any scene still loading. */
    stop: () => void ticket++,
  };
}
