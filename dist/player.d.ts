import { type Context } from "./freeroam.js";
import { type Scene } from "./scene.js";
import { type Walkthrough } from "./walkthrough.js";
/** Resolves once step 1 shows. explore: leave into free roam from that scene; the player's DOM is gone by then. */
export declare function player(c: Context, w: Walkthrough, nextLink: {
    label: string;
    href: string;
} | undefined, explore: (from: Scene) => void): Promise<void>;
