import { freeRoamScene, shorthand } from "./scene.js";
export const LABELS = {
    kinds: { B: "Class B", C: "Class C", D: "Class D", E: "Class E", E700: "E 700 ft", MODEC: "Mode C", R: "Restricted", P: "Prohibited", W: "Warning", MOA: "MOA", A: "Alert" },
    groups: { IAP: "Approaches", STAR: "Arrivals", SID: "Departures" },
    airspace: "Airspace",
    search: "Airport or procedure",
    noMatches: "No matches",
    remove: (name) => `Remove ${name}`,
    procedureTab: "Procedure",
    viewTab: "View",
    controls: "Controls",
    diagram: "Diagram",
    tags: "Tags",
    heightScale: (n) => `Height scale ${n}×`,
    fullScreen: "Full screen",
    finalCourse: "Final course",
    glidepath: "Glidepath",
    fafToMap: "FAF to MAP",
    floor700: "Floor 700 AGL",
    view: "3D airspace. Arrow keys turn the view, plus and minus zoom.",
    caption: (edition) => `FAA TAC ${edition} · Not for navigation`,
};
function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === false)
            continue;
        if (k === "class")
            e.className = String(v);
        else
            e.setAttribute(k, v === true ? "" : v);
    }
    e.append(...kids);
    return e;
}
/** Builds the view inside `host`. Resolves once the view has loaded and shows its first scene. */
export async function mount(host, o) {
    const L = { ...LABELS, ...o.labels, kinds: { ...LABELS.kinds, ...o.labels?.kinds }, groups: { ...LABELS.groups, ...o.labels?.groups } };
    const base = new URL(o.base, location.href);
    const url = (p) => new URL(p, base).href;
    const data = await fetch(url("area.json")).then((r) => {
        if (!r.ok)
            throw new Error(`skycake: ${r.status} for ${url("area.json")}`);
        return r.json();
    });
    // The viewer takes absolute URLs.
    data.chart = url(data.chart);
    data.dem = { ...data.dem, url: url(data.dem.url) };
    for (const a of data.airports)
        if (a.diagram)
            a.diagram = { ...a.diagram, url: url(a.diagram.url) };
    const tip = h("div", { class: "tip", hidden: true });
    const view = h("div", { class: "view", tabindex: "0", role: "application", "aria-label": L.view }, tip);
    const fig = h("figure", { class: "skycake" }, view, h("p", { class: "sc-caption" }, L.caption(data.edition)));
    host.replaceChildren(fig);
    // three.js and the chart load only when the view comes into sight.
    await new Promise((done) => {
        new IntersectionObserver(([e], io) => {
            if (!e.isIntersecting)
                return;
            io.disconnect();
            done();
        }).observe(view);
    });
    const { build, fraction, START_SCALE } = await import("./viewer.js");
    const show = (a, x, y) => {
        tip.hidden = !a;
        if (!a)
            return;
        tip.textContent = "";
        tip.append(Object.assign(document.createElement("span"), { className: "name", textContent: a.name }), a.kind === "E700" ? L.floor700 : fraction(a, data.ground));
        tip.style.transform = `translate(${Math.min(x + 12, view.clientWidth - tip.offsetWidth - 8)}px, ${Math.max(y - tip.offsetHeight - 8, 8)}px)`;
    };
    const v = await build(view, data, show, (kind, on) => fig.dispatchEvent(new CustomEvent("skycake-raised", { detail: { kind, on } })));
    // Keyboard: arrows turn the view, + and - zoom, only while the view has focus.
    const STEP = Math.PI / 24;
    view.addEventListener("keydown", (e) => {
        const act = {
            ArrowLeft: () => v.orbit(-STEP, 0),
            ArrowRight: () => v.orbit(STEP, 0),
            ArrowUp: () => v.orbit(0, -STEP),
            ArrowDown: () => v.orbit(0, STEP),
            "+": () => v.zoom(0.85),
            "=": () => v.zoom(0.85),
            "-": () => v.zoom(1 / 0.85),
        };
        if (!act[e.key] || e.ctrlKey || e.metaKey || e.altKey)
            return;
        e.preventDefault();
        act[e.key]();
    });
    const loaded = new Map();
    const procedures = (id) => {
        if (!loaded.has(id))
            loaded.set(id, fetch(url(`procedures/${id}.json`)).then((r) => (r.ok ? r.json() : [])).catch(() => []));
        return loaded.get(id);
    };
    const { freeRoam } = await import("./freeroam.js");
    const airport = o.airport ?? (data.airports.some((a) => a.id === "KPHX") ? "KPHX" : null);
    freeRoam({ fig, view: v, data, first: o.scene ?? shorthand(o, data) ?? freeRoamScene(data), airport, labels: L, procedures, startScale: START_SCALE });
}
