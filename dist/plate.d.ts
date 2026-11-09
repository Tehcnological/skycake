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
export declare function plateView(_c: Context, _el: {
    title: HTMLElement;
    body: HTMLElement;
}, _on: {
    show: (ref: ProcedureRef) => void;
}): Plates;
