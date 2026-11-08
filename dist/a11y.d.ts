export declare const A11Y_KEY = "skycake-a11y";
export declare function stored(s: Pick<Storage, "getItem"> | null): boolean;
export declare function store(s: Pick<Storage, "setItem" | "removeItem"> | null, on: boolean): void;
/** row: skycake shows its own switch, only when the site passes nothing. */
export declare const initial: (option: boolean | undefined, s: Pick<Storage, "getItem"> | null) => {
    on: boolean;
    row: boolean;
};
/** localStorage, or null where touching it throws. */
export declare function browserStorage(): Storage | null;
/** One step of the keyboard and the camera pad: a turn or tilt (radians), a move (fraction of the camera's distance), a zoom. */
export declare const STEPS: {
    turn: number;
    pan: number;
    zoom: number;
};
