// Accessibility mode's camera pad: every drag, pinch and twist as a single tap (WCAG 2.5.1, 2.5.7). Four arrows turn and
// tilt, or move the map while Pan is pressed; plus and minus zoom. It sits inside the view, bottom left, in free roam and
// quizzes; style.css shows it only under data-a11y, so the mode can switch in place.
import { STEPS } from "./a11y.js";
import { h, icon } from "./freeroam.js";
export const ARROWS = {
    left: ["M15 5 8 12l7 7"],
    right: ["M9 5l7 7-7 7"],
    up: ["M5 15l7-7 7 7"],
    down: ["M5 9l7 7 7-7"],
};
export const PLUS = ["M12 5v14", "M5 12h14"];
export const MINUS = ["M5 12h14"];
const PAN = ["M12 3v18", "M3 12h18", "M9 6l3-3 3 3", "M9 18l3 3 3-3", "M6 9l-3 3 3 3", "M18 9l3 3-3 3"];
export function pad(c) {
    const { view: v, labels: L } = c;
    const { turn, pan, zoom } = STEPS;
    const round = (label, paths, cls, onClick) => {
        const b = h("button", { type: "button", class: `sc-round ${cls}`, "aria-label": label }, icon(paths));
        b.addEventListener("click", onClick);
        return b;
    };
    let panning = false;
    const arrows = {
        left: round(L.camera.left, ARROWS.left, "sc-pad-left", () => (panning ? v.pan(-pan, 0) : v.orbit(-turn, 0))),
        right: round(L.camera.right, ARROWS.right, "sc-pad-right", () => (panning ? v.pan(pan, 0) : v.orbit(turn, 0))),
        up: round(L.camera.up, ARROWS.up, "sc-pad-up", () => (panning ? v.pan(0, pan) : v.orbit(0, -turn))),
        down: round(L.camera.down, ARROWS.down, "sc-pad-down", () => (panning ? v.pan(0, -pan) : v.orbit(0, turn))),
    };
    const panButton = round(L.camera.pan, PAN, "sc-pad-pan", () => {
        panning = !panning;
        panButton.setAttribute("aria-pressed", String(panning));
        const names = panning ? [L.camera.panLeft, L.camera.panRight, L.camera.panUp, L.camera.panDown] : [L.camera.left, L.camera.right, L.camera.up, L.camera.down];
        [arrows.left, arrows.right, arrows.up, arrows.down].forEach((b, i) => b.setAttribute("aria-label", names[i]));
    });
    panButton.setAttribute("aria-pressed", "false");
    const ring = h("div", { class: "sc-pad-ring" }, arrows.up, arrows.left, h("i", { class: "sc-pad-mid", "aria-hidden": "true" }), arrows.right, arrows.down);
    const side = h("div", { class: "sc-pad-side" }, round(L.camera.zoomIn, PLUS, "", () => v.zoom(zoom)), round(L.camera.zoomOut, MINUS, "", () => v.zoom(1 / zoom)), panButton);
    // On a phone the pad folds away behind one button, so it leaves the map clear until wanted.
    const fold = h("button", { type: "button", class: "sc-pill sc-pad-fold", "aria-expanded": "false" }, icon(PAN), L.camera.group);
    const el = h("div", { class: "sc-pad", role: "group", "aria-label": L.camera.group }, fold, ring, side);
    fold.addEventListener("click", () => fold.setAttribute("aria-expanded", String(el.classList.toggle("sc-pad-open"))));
    return el;
}
