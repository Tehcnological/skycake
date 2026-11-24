// What a site embeds: mount() builds the view inside any element. The area's data loads at once; three.js and the
// chart only when the element comes into sight. Styles are in style.css, which the site loads.
import { chartsOf } from "./airspace.js";
import { firstScene } from "./scene.js";
import { STEPS, browserStorage, initial, store } from "./a11y.js";
export const LABELS = {
    kinds: { B: "Class B", C: "Class C", D: "Class D", E: "Class E", E700: "E 700 ft", MODEC: "Mode C", R: "Restricted", P: "Prohibited", W: "Warning", MOA: "MOA", A: "Alert" },
    groups: { IAP: "approaches", STAR: "arrivals", SID: "departures" },
    airspace: "airspace",
    search: "airport or procedure",
    airports: "airports",
    noMatches: "no matches",
    remove: (name) => `remove ${name}`,
    procedureTab: "procedure",
    viewTab: "view",
    controls: "controls",
    diagram: "diagram",
    tags: "tags",
    heightScale: (n) => `height scale ${n}×`,
    height: "height",
    fullScreen: "full screen",
    open: "open 3D view",
    wake: "tap to move the map",
    close: "close",
    finalCourse: "final course",
    glidepath: "glidepath",
    fafToMap: "FAF to MAP",
    floor700: "floor 700 AGL",
    view: "3D airspace. Arrow keys turn the view, plus and minus zoom.",
    caption: (edition, chart) => `FAA ${{ tac: "TAC and sectional", sectional: "sectional", area: "IFR area and low", low: "IFR low" }[chart]} ${edition} · not for navigation`,
    mode: "rules",
    modes: { vfr: "VFR", ifr: "IFR" },
    chart: "chart",
    charts: { tac: "TAC", sectional: "SEC", area: "AREA", low: "LOW" },
    // Walkthrough and quiz words are the site's to write (instrumentready.com supplies them through `labels`); their
    // defaults say Placeholder so any the site leaves out stand out on screen. Words free roam shows too are real.
    right: "Placeholder: Right",
    wrong: "Placeholder: Wrong",
    tryAgain: "Placeholder: Not quite. Try again.",
    rightSecondTry: "Placeholder: Right on the second try",
    submit: "Placeholder: Check",
    continue: "Placeholder: Continue",
    facts: (name, floor, ceiling) => `${name} · ${floor} to ${ceiling}`,
    answerWas: (answer) => `Placeholder: Answer: ${answer}`,
    play: "Placeholder: Play",
    pause: "Placeholder: Pause",
    back: "Placeholder: Back",
    next: "Placeholder: Next",
    explore: "Placeholder: Explore",
    backToQuiz: "Placeholder: Back to quiz",
    stepOf: (n, total) => `Placeholder: ${n}/${total}`,
    count: (n, total, right) => `Placeholder: ${n}/${total} · ${right}`,
    practiceCount: (right, answered) => `Placeholder: ${right}/${answered}`,
    nextQuestion: "Placeholder: Next",
    again: "Placeholder: Again",
    result: (right, total) => `Placeholder: ${right} of ${total}`,
    nothing: "Placeholder: Nothing to ask here",
    a11y: "accessibility mode",
    on: "on",
    off: "off",
    plate: "procedure plate",
    plateOpen: "plate",
    split: "split view",
    resize: "resize",
    plateChart: "chart",
    platePage: (n, of) => `page ${n} of ${of}`,
    plateMap: "map",
    platePlate: "plate",
    plateSplit: "split",
    zoomIn: "zoom in",
    zoomOut: "zoom out",
    zoomFit: "fit",
    plateMissing: "This chart did not load.",
    plateEmpty: "pick an airport or procedure to view its chart",
    diagramPick: "pick",
    diagramNone: "none",
    diagramPickHint: "pick an airport to view its diagram",
    diagramNoneHint: (airport) => `${airport} has no FAA airport diagram`,
    diagramShow: (airport) => `show ${airport} airport diagram`,
    diagramHide: (airport) => `hide ${airport} airport diagram`,
    loading: "loading…",
    loadStep: (step) => ({ terrain: "loading terrain…", chart: "loading charts…", airspace: "building airspace…", prepare: "preparing 3D view…" })[step],
    powered: "powered by skycake",
    unavailable: "chart unavailable",
    retry: "try again",
    inView: "in view",
    number: "Placeholder: Number",
    skip: "Placeholder: Skip",
    summary: (chart, areas, procedures) => `${chart}. Raised: ${areas.join("; ") || "none"}. Procedures: ${procedures.join("; ") || "none"}.`,
    camera: {
        group: "Camera",
        left: "Turn left",
        right: "Turn right",
        up: "Tilt up",
        down: "Tilt down",
        zoomIn: "Zoom in",
        zoomOut: "Zoom out",
        pan: "Pan",
        panLeft: "Move left",
        panRight: "Move right",
        panUp: "Move forward",
        panDown: "Move back",
    },
    ask: {
        findArea: (name) => `Placeholder: Tap the ${name}`,
        findPiece: (name, floor, ceiling) => `Placeholder: Tap the ${name} from ${floor} to ${ceiling}`,
        findFix: (fix) => `Placeholder: Tap ${fix}`,
        findFaf: (procedure) => `Placeholder: Tap the final approach fix of the ${procedure}`,
        findMap: (procedure) => `Placeholder: Tap the missed approach point of the ${procedure}`,
        floor: "Placeholder: What is the floor of the highlighted airspace?",
        ceiling: "Placeholder: What is its ceiling?",
        cls: "Placeholder: What class is the highlighted airspace?",
        airplaneClass: "Placeholder: What airspace is the airplane in?",
        clearance: "Placeholder: Does the pilot need an ATC clearance here?",
        radio: "Placeholder: Is two-way radio communication required here?",
        transponder: "Placeholder: Is an altitude-reporting transponder required here?",
        yes: "Placeholder: Yes",
        no: "Placeholder: No",
        altAt: (fix) => `Placeholder: What altitude is charted at ${fix}?`,
        after: (fix) => `Placeholder: Which fix comes after ${fix}?`,
        faf: "Placeholder: Which fix is the final approach fix?",
        missed: "Placeholder: Which fix starts the missed approach?",
    },
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
    const L = { ...LABELS, ...o.labels, camera: { ...LABELS.camera, ...o.labels?.camera }, kinds: { ...LABELS.kinds, ...o.labels?.kinds }, groups: { ...LABELS.groups, ...o.labels?.groups }, charts: { ...LABELS.charts, ...o.labels?.charts }, modes: { ...LABELS.modes, ...o.labels?.modes }, ask: { ...LABELS.ask, ...o.labels?.ask } };
    const base = new URL(o.base, location.href);
    const url = (p) => new URL(p, base).href;
    const view = h("div", { class: "view", tabindex: "0", role: "application", "aria-label": L.view, "aria-keyshortcuts": "ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown + -" });
    const fig = h("figure", { class: "skycake sc-busy" }, view);
    const storage = browserStorage();
    const a11y = initial(o.a11y, storage);
    fig.toggleAttribute("data-a11y", a11y.on);
    // Embedded maps get their own loading screen with "powered by skycake" and an inline retry on error.
    // Standalone apps (o.close) drive their own full-window loading overlay.
    let loader = null;
    let loadStatus = null;
    if (!o.close) {
        loadStatus = h("p", { role: "status" }, L.loading);
        loader = h("div", { class: "sc-loading" }, h("span", { class: "sc-spinner", "aria-hidden": "true" }), loadStatus, h("small", { class: "sc-powered" }, L.powered));
        fig.append(loader);
        fig.addEventListener("skycake-loading", (e) => {
            const msg = L.loadStep(e.detail?.step);
            if (msg && loadStatus)
                loadStatus.textContent = msg;
        });
    }
    host.replaceChildren(fig);
    try {
        const data = await fetch(url("area.json")).then((r) => {
            if (!r.ok)
                throw new Error(`skycake: ${r.status} for ${url("area.json")}`);
            return r.json();
        });
        // The viewer takes absolute URLs.
        data.charts = { sectional: url(data.charts.sectional), ...(data.charts.tac && { tac: { ...data.charts.tac, url: url(data.charts.tac.url) } }), ...(data.charts.low && { low: url(data.charts.low) }), ...(data.charts.area && { area: { ...data.charts.area, url: url(data.charts.area.url) } }) };
        data.dem = { ...data.dem, url: url(data.dem.url) };
        for (const a of data.airports)
            if (a.diagram)
                a.diagram = { ...a.diagram, url: url(a.diagram.url) };
        const tip = h("div", { class: "tip", hidden: true });
        view.append(tip);
        fig.append(h("p", { class: "sc-caption" }, L.caption(data.edition, chartsOf(data.charts)[0])));
        // Embedded views defer three.js and the chart until they scroll into sight; standalone apps load at once
        // (including in background tabs).
        if (!o.close) {
            await new Promise((done) => {
                new IntersectionObserver(([e], io) => {
                    if (!e.isIntersecting)
                        return;
                    io.disconnect();
                    done();
                }).observe(view);
            });
        }
        const { build, fraction, START_SCALE } = await import("./viewer.js");
        const show = (a, x, y) => {
            tip.hidden = !a;
            if (!a)
                return;
            tip.textContent = "";
            tip.append(Object.assign(document.createElement("span"), { className: "name", textContent: a.name }), a.kind === "E700" ? h("span", {}, L.floor700) : fraction(a, data.ground));
            tip.style.transform = `translate(${Math.min(x + 12, view.clientWidth - tip.offsetWidth - 8)}px, ${Math.max(y - tip.offsetHeight - 8, 8)}px)`;
        };
        const v = await build(view, data, show, (kind, on) => fig.dispatchEvent(new CustomEvent("skycake-raised", { detail: { kind, on } })), (airport) => fig.dispatchEvent(new CustomEvent("skycake-airport", { detail: { airport } })), a11y.on);
        // Keyboard: arrows turn the view, Shift and arrows move it, + and - zoom, only while the view has focus.
        const { turn: STEP, pan: PAN, zoom: ZOOM } = STEPS;
        view.addEventListener("keydown", (e) => {
            const pan = {
                ArrowLeft: () => v.pan(-PAN, 0),
                ArrowRight: () => v.pan(PAN, 0),
                ArrowUp: () => v.pan(0, PAN),
                ArrowDown: () => v.pan(0, -PAN),
            };
            const act = e.shiftKey && pan[e.key] ? pan : {
                ArrowLeft: () => v.orbit(-STEP, 0),
                ArrowRight: () => v.orbit(STEP, 0),
                ArrowUp: () => v.orbit(0, -STEP),
                ArrowDown: () => v.orbit(0, STEP),
                "+": () => v.zoom(ZOOM),
                "=": () => v.zoom(ZOOM),
                "-": () => v.zoom(1 / ZOOM),
            };
            // Not an arrow pressed on the camera pad (its own buttons move the camera), on Play (it sits in the view) or in a text field.
            if (e.target.closest(".sc-pad, .sc-big-play, input, textarea") || !act[e.key] || e.ctrlKey || e.metaKey || e.altKey)
                return;
            e.preventDefault();
            act[e.key]();
        });
        // Every mode: CSS covers most browsers; iPhone Safari also needs its own gesture events stopped, or a pinch zooms
        // the page. sc-preview (free roam's map in the page on a phone) and sc-asleep (a walkthrough's or quiz's, until tapped)
        // leave them to the page.
        const taken = () => !fig.classList.contains("sc-preview") && !(fig.classList.contains("sc-asleep") && !fig.classList.contains("full"));
        for (const t of ["gesturestart", "gesturechange", "gestureend"])
            fig.addEventListener(t, (e) => taken() && e.preventDefault());
        fig.addEventListener("dblclick", (e) => taken() && !(e.target instanceof HTMLInputElement) && e.preventDefault());
        fig.addEventListener("touchmove", (e) => fig.classList.contains("full") && e.touches.length > 1 && e.preventDefault(), { passive: false });
        // A long press on the map would open the browser's menu. The search box keeps its own, for paste.
        if (matchMedia("(pointer: coarse)").matches)
            fig.addEventListener("contextmenu", (e) => e.target instanceof HTMLInputElement || e.preventDefault());
        const loaded = new Map();
        const procedures = (id) => {
            if (!loaded.has(id))
                loaded.set(id, fetch(url(`procedures/${id}.json`)).then((r) => (r.ok ? r.json() : [])).catch(() => []));
            return loaded.get(id);
        };
        const { freeRoam } = await import("./freeroam.js");
        const airport = o.airport ?? null;
        const context = { fig, view: v, data, first: firstScene(o, data, (m) => console.warn(m)), airport, labels: L, procedures, url, startScale: START_SCALE, close: o.close, a11y: a11y.on, title: o.title };
        // Free roam's new controls are always built and shown by CSS, so the switch changes the mode in place.
        if (a11y.row)
            context.setA11y = (on) => {
                context.a11y = on;
                fig.toggleAttribute("data-a11y", on);
                v.setA11y(on);
                store(storage, on);
            };
        const mode = o.mode ?? "explore";
        const ready = () => {
            fig.classList.remove("sc-busy");
            loader?.remove();
        };
        if (mode === "explore") {
            await freeRoam(context);
            return ready();
        }
        const explore = (from, back) => void freeRoam({ ...context, first: from, back });
        if ("quiz" in mode) {
            const { quiz } = await import("./quizui.js");
            await quiz(context, mode, o.onResult ?? (() => { }), explore);
            return ready();
        }
        const { player } = await import("./player.js");
        await player(context, mode.walkthrough, mode.next, explore);
        ready();
    }
    catch (err) {
        if (loader) {
            const retry = h("button", { type: "button", class: "sc-pill sc-retry" }, L.retry);
            retry.addEventListener("click", () => void mount(host, o).catch((e) => console.error(e)));
            loader.replaceChildren(h("p", { role: "alert" }, L.unavailable), retry, h("small", { class: "sc-powered" }, L.powered));
        }
        throw err;
    }
}
