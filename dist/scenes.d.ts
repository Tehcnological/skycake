import type { Context } from "./freeroam.js";
import type { Procedure } from "./procedure.js";
import { type Scene } from "./scene.js";
/** timeline: called once the scene resolves, just before the view applies it; its value is the step timeline (0 to 1). */
export declare function scenes(c: Context, timeline?: () => number): {
    show: (scene: Scene, now?: boolean) => Promise<void>;
    /** The procedure files a scene loads: a question's fix is scored by its own scene's, whatever is on screen. */
    filesOf: (scene: Scene) => Promise<Procedure[]>;
    onScreen: () => Scene;
    /** Drops any scene still loading. */
    stop: () => undefined;
};
