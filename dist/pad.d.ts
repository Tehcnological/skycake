import { type Context } from "./freeroam.js";
export declare const ARROWS: {
    left: string[];
    right: string[];
    up: string[];
    down: string[];
};
export declare const PLUS: string[];
export declare const MINUS: string[];
export declare function zoomButtons({ view, labels }: Pick<Context, "view" | "labels">): HTMLButtonElement[];
export declare function pad(c: Context): HTMLElement;
