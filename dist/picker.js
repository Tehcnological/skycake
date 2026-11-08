// Accessibility mode's numbered picker: what is on the map now (View.onScreen), as numbered buttons with the same number
// on a badge on the map. Free roam's In view panel names each one; a find question shows numbers only, so it still asks
// the student to find the thing on the chart. Focus or hover on a button outlines its thing on the map.
import { h } from "./freeroam.js";
const key = (c) => ("area" in c ? `a:${c.area}` : "fix" in c ? `f:${c.fix}:${c.at}` : `p:${c.airport}`);
export function picker(view, o) {
    const el = h("div", { class: "sc-pick" });
    let list = [];
    const refill = () => {
        const had = el.contains(document.activeElement) ? document.activeElement.dataset.key : undefined;
        list = view.onScreen();
        view.numbers(list);
        el.replaceChildren(...list.map((c, i) => {
            const n = i + 1;
            const words = o.label(c, n);
            const b = h("button", { type: "button", class: "sc-option", "data-key": key(c), "aria-pressed": o.pressed ? String(o.pressed(c)) : undefined }, h("b", { class: "sc-num" }, String(n)), ...(words ? [h("span", {}, words)] : []));
            b.addEventListener("click", () => o.onPick(c, n));
            for (const t of ["focus", "pointerenter"])
                b.addEventListener(t, () => view.focus(c));
            for (const t of ["blur", "pointerleave"])
                b.addEventListener(t, () => view.focus(null));
            return b;
        }));
        if (had)
            el.querySelector(`[data-key="${CSS.escape(had)}"]`)?.focus();
    };
    // shortcut: the camera is checked twice a second and the list rebuilt once it has changed; upgrade to a viewer event
    // if a list this long ever shows up in a profile.
    let last = JSON.stringify(view.camera());
    const timer = setInterval(() => {
        const now = JSON.stringify(view.camera());
        if (now === last)
            return;
        last = now;
        refill();
    }, 500);
    refill();
    return {
        el,
        list: () => list,
        refill,
        stop() {
            clearInterval(timer);
            view.numbers(null);
            view.focus(null);
        },
    };
}
