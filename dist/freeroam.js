// Free roam's controls, over the 3D view. Desktop: floating panels in the corners (Airspace top left, search top
// right, view buttons bottom right). Phone: a tab bar along the bottom, menus as sheets above it. One DOM for both;
// style.css decides what shows. Every change goes through roam.ts and reaches the viewer as a scene.
import { KINDS } from "./airspace.js";
import { add, pickAirport, raiseNow, remove, sceneOf, start, toggleDiagram } from "./roam.js";
import { SceneError, framedOnly, resolve } from "./scene.js";
import { search } from "./search.js";
const SVG = "http://www.w3.org/2000/svg";
function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === false)
            continue;
        if (k === "class")
            e.className = String(v);
        else
            e.setAttribute(k, v === true ? "" : v);
    }
    e.append(...kids);
    return e;
}
/** An inline stroke icon built as elements, so strict CSPs allow it. */
function icon(paths, box = "0 0 24 24") {
    const s = document.createElementNS(SVG, "svg");
    for (const [k, v] of Object.entries({ viewBox: box, width: "20", height: "20", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }))
        s.setAttribute(k, v);
    for (const d of paths) {
        const p = document.createElementNS(SVG, "path");
        p.setAttribute("d", d);
        s.append(p);
    }
    return s;
}
const ICONS = {
    layers: ["M12 3 3 8l9 5 9-5-9-5Z", "m3 13 9 5 9-5"],
    search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m20 20-3.5-3.5"],
    procedure: ["M4 19c4-1 6-5 8-9s5-6 8-6"],
    diagram: ["M4 18 18 4", "M8 20 20 8", "M4 9h6"],
    tags: ["M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z", "M6 12h12"],
    view: ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
    full: ["M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8"],
    close: ["M6 6l12 12M18 6 6 18"],
};
/** Resolves once the first scene is showing. */
export function freeRoam(c) {
    const { fig, view: v, data, labels: L } = c;
    const has = (a) => !!data.airports.find((x) => x.id === a)?.diagram;
    let r = start(c.first, c.airport ?? undefined);
    // Once the first scene is showing, every change keeps what is raised on screen.
    let shown = false;
    let tagsOn = c.first.tags ?? true;
    let scale = c.first.height ?? c.startScale;
    const present = KINDS.filter((k) => data.areas.some((a) => a.kind === k));
    // Airspace: a button and its list (desktop top left; phone: a sheet from the Airspace tab).
    const rows = new Map(present.map((k) => {
        const box = h("input", { type: "checkbox" });
        const row = h("label", { class: `sc-row s-${k}` }, h("i", { "aria-hidden": "true" }), h("span", {}, L.kinds[k]), box);
        box.addEventListener("change", () => v.raise(k, box.checked));
        return [k, { row, box }];
    }));
    const kindList = h("div", { class: "sc-panel sc-kinds", id: "sc-kinds" }, ...[...rows.values()].map((x) => x.row));
    const kindButton = h("button", { type: "button", class: "sc-pill", "aria-expanded": "false", "aria-controls": "sc-kinds" }, icon(ICONS.layers), L.airspace);
    const topLeft = h("div", { class: "sc-tl" }, kindButton, kindList);
    // Search, its results and the shown procedures (top right; phone: top).
    const input = h("input", { type: "search", "aria-label": L.search, placeholder: L.search, autocomplete: "off", spellcheck: "false" });
    const results = h("div", { class: "sc-panel sc-results", role: "listbox", "aria-label": L.search, hidden: true });
    const chips = h("div", { class: "sc-chips" });
    const topRight = h("div", { class: "sc-tr" }, h("label", { class: "sc-search" }, icon(ICONS.search), input), results, chips);
    // View buttons (desktop bottom right; phone: a sheet from the View tab).
    const round = (label, kids, cls = "") => h("button", { type: "button", class: `sc-round ${cls}`, "aria-label": label }, ...kids);
    const diagramButton = round(L.diagram, [icon(ICONS.diagram)]);
    const tagsButton = round(L.tags, [icon(ICONS.tags)]);
    const scaleButton = round(L.heightScale(scale), [`${scale}×`], "sc-scale");
    const fullButton = round(L.fullScreen, [icon(ICONS.full, "0 0 12 12")]);
    const bottomRight = h("div", { class: "sc-br" }, diagramButton, tagsButton, scaleButton, fullButton);
    // Phone tab bar.
    const tab = (label, paths) => h("button", { type: "button", class: "sc-tab" }, icon(paths), h("span", {}, label));
    const tabs = { airspace: tab(L.airspace, ICONS.layers), procedure: tab(L.procedureTab, ICONS.procedure), diagram: tab(L.diagram, ICONS.diagram), view: tab(L.viewTab, ICONS.view) };
    const tabBar = h("nav", { class: "sc-tabs", "aria-label": L.controls }, ...Object.values(tabs));
    fig.querySelector(".view").after(topLeft, topRight, bottomRight);
    fig.append(tabBar);
    const sheet = (name) => {
        fig.classList.toggle("sc-open-kinds", name === "kinds");
        fig.classList.toggle("sc-open-view", name === "view");
        kindButton.setAttribute("aria-expanded", String(name === "kinds"));
        tabs.airspace.setAttribute("aria-pressed", String(name === "kinds"));
        tabs.view.setAttribute("aria-pressed", String(name === "view"));
    };
    kindButton.addEventListener("click", () => sheet(fig.classList.contains("sc-open-kinds") ? null : "kinds"));
    tabs.airspace.addEventListener("click", () => sheet(fig.classList.contains("sc-open-kinds") ? null : "kinds"));
    tabs.view.addEventListener("click", () => sheet(fig.classList.contains("sc-open-view") ? null : "view"));
    tabs.procedure.addEventListener("click", () => {
        sheet(null);
        input.focus();
    });
    // Every change: the roam state becomes a scene, procedure files load, the viewer shows it. The newest change wins.
    let ticket = 0;
    let files = [];
    const refresh = async (now = false) => {
        const mine = ++ticket;
        const wanted = sceneOf(r);
        const load = (refs) => Promise.all(refs.map(async (p) => (await c.procedures(p.airport)).find((x) => x.name === p.name)));
        const [loaded, framing] = await Promise.all([load(wanted.procedures ?? []), load(framedOnly(wanted))]);
        if (mine !== ticket)
            return;
        // The toggles are read now, after the files arrived, so one pressed during the load is not undone.
        const scene = { ...wanted, raise: raiseNow(c.first, shown ? v.raisedAreas() : null), tags: tagsOn, height: scale };
        let resolved;
        try {
            resolved = resolve(scene, data);
        }
        catch (e) {
            if (!(e instanceof SceneError))
                throw e;
            console.warn(`skycake: ${e.message}`);
            return;
        }
        files = loaded.filter((p) => !!p);
        drawChips();
        const diagram = r.airport !== null && has(r.airport);
        diagramButton.hidden = tabs.diagram.hidden = !diagram;
        diagramButton.setAttribute("aria-pressed", String(r.diagram));
        tabs.diagram.setAttribute("aria-pressed", String(r.diagram));
        shown = true;
        await v.apply(resolved, files, now, framing.filter((p) => !!p));
    };
    const drawChips = () => {
        chips.replaceChildren(...r.procedures.map((p) => {
            const file = files.find((f) => f.airport === p.airport && f.name === p.name);
            const x = h("button", { type: "button", class: "sc-x", "aria-label": L.remove(`${p.airport} ${p.name}`) }, icon(ICONS.close));
            x.addEventListener("click", () => {
                r = remove(r, p);
                refresh();
            });
            const chip = h("div", { class: "sc-chip" }, h("span", { class: "sc-apt" }, p.airport), h("span", { class: "sc-name" }, p.name), x);
            if (file?.type !== "IAP")
                return chip;
            const fact = (label, value) => (value === null ? [] : [h("div", {}, h("dt", {}, label), h("dd", {}, value))]);
            const info = h("dl", { class: "sc-info" }, ...fact(L.finalCourse, file.course === null ? null : `${String(file.course).padStart(3, "0")}°`), ...fact(L.glidepath, file.glidepath === null ? null : `${file.glidepath.toFixed(2)}°`), ...fact(L.fafToMap, file.fafToMap === null ? null : `${file.fafToMap} NM`));
            return h("div", { class: "sc-panel sc-procedure" }, chip, ...(info.children.length ? [info] : []));
        }));
    };
    // Results: groups by airport and type; picking adds a procedure or makes an airport current.
    const showResults = () => {
        const q = input.value;
        if (!q.trim()) {
            results.hidden = true;
            return;
        }
        const groups = search(q, data.airports);
        results.replaceChildren();
        if (!groups.length)
            results.append(h("p", { class: "sc-none" }, L.noMatches));
        for (const g of groups) {
            if (g.type !== null)
                results.append(h("p", { class: "sc-group" }, `${g.airport} · ${L.groups[g.type]}`));
            for (const hit of g.hits) {
                const opt = h("button", { type: "button", role: "option", class: "sc-option" }, hit.procedure ? hit.procedure.name : hit.airport);
                opt.addEventListener("click", () => {
                    r = hit.procedure ? add(r, { airport: hit.airport, name: hit.procedure.name }, has) : pickAirport(r, hit.airport, has);
                    input.value = hit.procedure ? "" : hit.airport;
                    results.hidden = true;
                    refresh();
                });
                results.append(opt);
            }
        }
        results.hidden = false;
    };
    input.addEventListener("input", showResults);
    input.addEventListener("focus", showResults);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Escape")
            results.hidden = true;
    });
    fig.addEventListener("pointerdown", (e) => {
        if (!topRight.contains(e.target))
            results.hidden = true;
    });
    const toggleDiagramNow = () => {
        r = toggleDiagram(r, has);
        refresh();
    };
    diagramButton.addEventListener("click", toggleDiagramNow);
    tabs.diagram.addEventListener("click", toggleDiagramNow);
    const setTags = () => tagsButton.setAttribute("aria-pressed", String(tagsOn));
    tagsButton.addEventListener("click", () => {
        tagsOn = !tagsOn;
        setTags();
        v.tags(tagsOn);
    });
    setTags();
    scaleButton.addEventListener("click", () => {
        scale = scale === c.startScale ? 1 : c.startScale;
        scaleButton.textContent = `${scale}×`;
        scaleButton.setAttribute("aria-label", L.heightScale(scale));
        v.exaggerate(scale);
    });
    // iPhone Safari has no element fullscreen, so the class fills the window and the real thing is added where it exists.
    const setFull = (on) => {
        fig.classList.toggle("full", on);
        fullButton.setAttribute("aria-pressed", String(on));
        document.documentElement.classList.toggle("skycake-full", on);
    };
    fullButton.addEventListener("click", () => {
        const on = !fig.classList.contains("full");
        setFull(on);
        if (on)
            fig.requestFullscreen?.().catch(() => { });
        else if (document.fullscreenElement)
            document.exitFullscreen();
    });
    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement)
            setFull(false);
    });
    if (c.airport)
        input.value = c.airport;
    // The chip and type list state follows the viewer, including areas raised by tapping the chart.
    const onRaised = (kind, on) => {
        const x = rows.get(kind);
        if (!x)
            return;
        x.box.checked = on;
        x.row.classList.toggle("on", on);
    };
    c.fig.addEventListener("skycake-raised", (e) => onRaised(e.detail.kind, e.detail.on));
    sheet(null);
    return refresh(true);
}
