// The procedure chart viewer, in free roam's plate panel. A stub for now: the chart-viewer branch fills it in.
// Free roam builds it once with the panel's title slot and body, tells it what is shown as that changes, and asks it
// whether the area has charts at all (the panel's open buttons show only then).
import type { Context } from "./freeroam.js";
import type { ProcedureRef } from "./scene.js";

export type Plates = {
  /** The area has charts to show; until then free roam hides the panel's open buttons. */
  has: boolean;
  /** The procedures shown and the current airport, whenever either changes. */
  procedures: (refs: ProcedureRef[], airport: string | null) => void;
  destroy: () => void;
};

/** `show` adds a procedure in 3D, as picking it in the search box does. */
export function plateView(_c: Context, _el: { title: HTMLElement; body: HTMLElement }, _on: { show: (ref: ProcedureRef) => void }): Plates {
  return { has: false, procedures: () => {}, destroy: () => {} };
}
