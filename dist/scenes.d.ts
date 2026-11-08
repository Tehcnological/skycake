import type { Context } from "./freeroam.js";
import type { Procedure } from "./procedure.js";
import { type Scene } from "./scene.js";
/** timeline: called once the scene resolves, just before the view applies it; its value is the step timeline (0 to 1). */
export declare function scenes(c: Context, timeline?: () => number): {
    show: (scene: Scene, now?: boolean) => Promise<void>;
    /** The procedure files of the scene on screen, to score a fix by. */
    files: () => Procedure[];
    onScreen: () => Scene;
    /** Drops any scene still loading. */
    stop: () => undefined;
};
