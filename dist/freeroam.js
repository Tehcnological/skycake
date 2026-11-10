// Free roam's controls, over the 3D view. Desktop: floating panels in the corners (Airspace top left, search top
// right, view buttons bottom right). Phone: a tab bar along the bottom, menus as sheets above it. One DOM for both;
// style.css decides what shows. Every change goes through roam.ts and reaches the viewer as a scene.
import { KINDS, chartsIn, feetText, modeOf, pickChart, shownIn } from "./airspace.js";
import { add, pickAirport, raiseNow, remove, sceneOf, start, toggleDiagram } from "./roam.js";
import { SceneError, framedOnly, resolve } from "./scene.js";
import { airportList, proceduresAt, search } from "./search.js";
import { pad } from "./pad.js";
import { plateView } from "./plate.js";
import { picker } from "./picker.js";
import { describe } from "./summary.js";
const SVG = "http://www.w3.org/2000/svg";
export function h(tag, attrs = {}, ...kids) {
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
export function icon(paths, box = "0 0 24 24") {
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
export const ICONS = {
    layers: ["M12 3 3 8l9 5 9-5-9-5Z", "m3 13 9 5 9-5"],
    search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m20 20-3.5-3.5"],
    procedure: ["M4 19c4-1 6-5 8-9s5-6 8-6"],
    diagram: ["M4 18 18 4", "M8 20 20 8", "M4 9h6"],
    tags: ["M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z", "M6 12h12"],
    view: ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
    full: ["M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8"],
    close: ["M6 6l12 12M18 6 6 18"],
    list: ["M9 6h11", "M9 12h11", "M9 18h11", "M4 6h1", "M4 12h1", "M4 18h1"],
    plate: ["M7 3h7l4 4v14H7Z", "M14 3v4h4", "M10 12h5", "M10 16h5"],
    height: ["M8 4v16", "m5 7 3-3 3 3", "m5 17 3 3 3-3", "M14 8h6", "M14 16h6"],
    rules: ["M4 7h10", "M18 7h2", "M4 17h4", "M12 17h8", "M16 5v4", "M10 15v4"],
    map: ["M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2Z", "M9 4v14", "M15 6v14"],
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
    // Which chart is under the airspace: VFR or IFR, then one of that mode's charts. Each mode keeps the last one picked.
    let chart = pickChart(data.charts, c.first.chart);
    const lastIn = { [modeOf(chart)]: chart };
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
    // In view (accessibility mode): what is on the map, numbered as on the map; picking an area raises or lowers it, an
    // airport lists its procedures. The picker (and its badges) lives only while the panel is open.
    const inViewList = h("div", { class: "sc-panel sc-inview", id: "sc-inview" });
    const inViewButton = h("button", { type: "button", class: "sc-pill sc-inview-pill", "aria-expanded": "false", "aria-controls": "sc-inview" }, icon(ICONS.list), L.inView);
    const topLeft = h("div", { class: "sc-tl" }, kindButton, kindList, inViewButton, inViewList);
    // The header: the area and its note (desktop: top left, over Airspace; phone: a bar over the view), and on a phone the
    // button that opens search.
    const findButton = h("button", { type: "button", class: "sc-find", "aria-label": L.search, "aria-expanded": "false", "aria-controls": "sc-tr" }, icon(ICONS.search));
    const where = c.title ? [h("div", { class: "sc-where" }, h("b", {}, c.title.name), ...(c.title.note ? [h("span", {}, c.title.note)] : []))] : [];
    const head = h("header", { class: "sc-head" }, ...where, findButton);
    // Search, the plate panel's button, results and the shown procedures (top right; phone: under the header, search
    // only once opened).
    const input = h("input", { type: "search", "aria-label": L.search, placeholder: L.search, autocomplete: "off", spellcheck: "false" });
    const results = h("div", { class: "sc-panel sc-results", role: "listbox", "aria-label": L.search, hidden: true });
    const chips = h("div", { class: "sc-chips" });
    const plateButton = h("button", { type: "button", class: "sc-pill sc-plate-open", "aria-expanded": "false", "aria-controls": "sc-plate" }, icon(ICONS.plate), L.plateOpen);
    const topRight = h("div", { class: "sc-tr", id: "sc-tr" }, h("div", { class: "sc-findrow" }, h("label", { class: "sc-search" }, icon(ICONS.search), input), plateButton), results, chips);
    // The view's tools. Desktop: a rail, bottom right, each a row with its name and value; each press steps the value.
    // Phone: the View sheet, each a segmented choice (Diagram and Close have their own tabs).
    const tool = (label, paths, box) => {
        const value = h("b", { class: "sc-value" });
        return { button: h("button", { type: "button", class: "sc-tool" }, icon(paths, box), h("span", {}, label), value), value };
    };
    const diagramTool = tool(L.diagram, ICONS.diagram);
    const tagsTool = tool(L.tags, ICONS.tags);
    const heightTool = tool(L.height, ICONS.height);
    const modeTool = tool(L.mode, ICONS.rules);
    const chartTool = tool(L.chart, ICONS.map);
    const fullTool = c.close ? tool(L.close, ICONS.close) : tool(L.fullScreen, ICONS.full, "0 0 12 12");
    const diagramButton = diagramTool.button, fullButton = fullTool.button;
    const hasIfr = chartsIn(data.charts, "ifr").length > 0;
    modeTool.button.hidden = !hasIfr;
    const bottomRight = h("div", { class: "sc-br" }, h("div", { class: "sc-panel sc-rail" }, diagramButton, tagsTool.button, heightTool.button, modeTool.button, chartTool.button, fullButton));
    const seg = (label) => {
        const opts = h("div", { class: "sc-seg", role: "group", "aria-label": label });
        return { row: h("div", { class: "sc-segrow" }, h("span", {}, label), opts), opts };
    };
    const fillSeg = (s, items) => {
        // Redrawn on every pick, so focus moves to the new button in the same place.
        const at = [...s.opts.children].indexOf(document.activeElement);
        s.opts.replaceChildren(...items.map((x) => {
            const b = h("button", { type: "button", "aria-pressed": String(x.on) }, x.text);
            b.addEventListener("click", x.pick);
            return b;
        }));
        if (at >= 0)
            s.opts.children[at]?.focus();
    };
    const heightSeg = seg(L.height), modeSeg = seg(L.mode), chartSeg = seg(L.chart);
    modeSeg.row.hidden = !hasIfr;
    const tagsBox = h("input", { type: "checkbox", role: "switch" });
    const viewSheet = h("div", { class: "sc-panel sc-vs", id: "sc-vs" }, h("label", { class: "sc-row sc-switch" }, h("span", {}, L.tags), tagsBox), heightSeg.row, modeSeg.row, chartSeg.row);
    // Accessibility mode's own switch, when the site has none: under the rail (phone: the foot of the View sheet). Two
    // switches, kept in step.
    if (c.setA11y) {
        const boxes = [];
        const a11yRow = () => {
            const box = h("input", { type: "checkbox", role: "switch" });
            box.checked = c.a11y;
            boxes.push(box);
            box.addEventListener("change", () => {
                for (const b of boxes)
                    b.checked = box.checked;
                if (!box.checked && fig.classList.contains("sc-open-inview"))
                    sheet(null);
                c.setA11y(box.checked);
            });
            return h("label", { class: "sc-row sc-switch sc-a11y-row" }, h("span", {}, L.a11y), box);
        };
        bottomRight.append(a11yRow());
        viewSheet.append(a11yRow());
    }
    const caption = fig.querySelector(".sc-caption");
    // Phone tab bar.
    const tab = (label, paths) => h("button", { type: "button", class: "sc-tab" }, icon(paths), h("span", {}, label));
    const tabs = { airspace: tab(L.airspace, ICONS.layers), inView: tab(L.inView, ICONS.list), procedure: tab(L.procedureTab, ICONS.procedure), diagram: tab(L.diagram, ICONS.diagram), view: tab(L.viewTab, ICONS.view), plate: tab(L.plateOpen, ICONS.plate), close: tab(L.close, ICONS.close) };
    tabs.inView.classList.add("sc-inview-tab");
    const tabBar = h("nav", { class: "sc-tabs", "aria-label": L.controls }, ...Object.values(tabs));
    // The procedure plate panel (plate.ts), opened by the Plate button or tab, which show only when the area has charts.
    const plates = plateView(c, {
        show: (ref) => {
            r = add(r, ref, has);
            refresh();
        },
        mode: (m) => {
            plateButton.setAttribute("aria-expanded", String(m !== null));
            tabs.plate.setAttribute("aria-pressed", String(m !== null));
        },
        back: () => opener(plateButton, tabs.plate),
        // The map's room on an upright phone: between the header and the tab bar.
        room: () => ({ top: head.getBoundingClientRect().bottom, bottom: tabBar.getBoundingClientRect().top }),
    });
    plateButton.hidden = tabs.plate.hidden = !plates.has;
    // A site's first scene can open a chart; its procedures go in first, so they are not news that would show theirs.
    plates.procedures(r.procedures, r.airport);
    if (c.first.plate)
        void plates.open(c.first.plate);
    if (plates.el)
        plateButton.setAttribute("aria-controls", plates.el.id);
    // The map in words, read by a screen reader on reaching the view; written now (browse mode reaches it without focus)
    // and again as the view takes focus, so it is current.
    const viewEl = fig.querySelector(".view");
    const summary = h("p", { class: "sc-hidden", id: `sc-summary-${Math.random().toString(36).slice(2)}` });
    viewEl.after(summary);
    viewEl.setAttribute("aria-describedby", summary.id);
    const writeSummary = () => {
        const raised = v.raisedAreas().flatMap((id) => data.areas.find((a) => a.id === id) ?? []);
        summary.textContent = describe({
            chart: `${L.charts[chart]} ${data.edition}`,
            areas: raised.map((a) => ({ name: a.name, floor: feetText(a.floor, data.ground), ceiling: feetText(a.ceiling, data.ground) })),
            procedures: r.procedures.map((p) => `${p.airport} ${p.name}`),
        }, L);
    };
    writeSummary();
    viewEl.addEventListener("focus", writeSummary);
    // On a phone the map in the page is a preview the page scrolls past; a tap opens it, and only then does it take touches.
    const openButton = h("button", { type: "button", class: "sc-open" }, h("span", { class: "sc-pill" }, icon(ICONS.full, "0 0 12 12"), L.open));
    fig.querySelector(".view").after(openButton, head, topLeft, topRight, bottomRight, viewSheet, ...(plates.el ? [plates.el] : []));
    fig.querySelector(".view").append(pad(c));
    fig.append(tabBar);
    let inView = null;
    const sheet = (name) => {
        fig.classList.toggle("sc-open-kinds", name === "kinds");
        fig.classList.toggle("sc-open-view", name === "view");
        fig.classList.toggle("sc-open-inview", name === "inview");
        // One thing open at a time on a phone: a sheet closes the search.
        if (name && fig.classList.contains("sc-open-find")) {
            fig.classList.remove("sc-open-find");
            findButton.setAttribute("aria-expanded", "false");
            results.hidden = true;
        }
        kindButton.setAttribute("aria-expanded", String(name === "kinds"));
        inViewButton.setAttribute("aria-expanded", String(name === "inview"));
        tabs.airspace.setAttribute("aria-pressed", String(name === "kinds"));
        tabs.inView.setAttribute("aria-pressed", String(name === "inview"));
        tabs.view.setAttribute("aria-pressed", String(name === "view"));
        if (name === "inview" && !inView) {
            inView = picker(v, {
                label: (x) => ("area" in x ? L.facts(x.name, x.floor, x.ceiling) : "airport" in x ? `${x.airport} ${x.name}` : x.name),
                pressed: () => {
                    const up = new Set(v.raisedAreas());
                    return (x) => "area" in x && up.has(x.area);
                },
                onPick: (x) => {
                    if ("area" in x) {
                        v.raiseArea(x.area, !v.raisedAreas().includes(x.area));
                        inView?.refill();
                    }
                    else if ("airport" in x) {
                        sheet(null);
                        showAirport(x.airport);
                        input.focus();
                    }
                },
            });
            inViewList.replaceChildren(inView.el);
        }
        else if (name !== "inview" && inView) {
            inView.stop();
            inView = null;
            inViewList.replaceChildren();
        }
    };
    // The open sheet's own button, where Escape puts focus back (desktop pill or phone tab, whichever shows).
    const opener = (a, b) => (a.offsetParent ? a : b);
    fig.addEventListener("keydown", (e) => {
        if (e.key !== "Escape")
            return;
        if (fig.classList.contains("sc-open-kinds"))
            opener(kindButton, tabs.airspace).focus();
        else if (fig.classList.contains("sc-open-inview"))
            opener(inViewButton, tabs.inView).focus();
        else if (fig.classList.contains("sc-open-view"))
            tabs.view.focus();
        else if (fig.classList.contains("sc-open-find") && e.target !== input) {
            setFind(false);
            findButton.focus();
            return;
        }
        else if (plates.mode() !== null && e.target !== input) {
            plates.set(null);
            opener(plateButton, tabs.plate).focus();
            return;
        }
        else
            return;
        sheet(null);
    });
    inViewButton.addEventListener("click", () => sheet(fig.classList.contains("sc-open-inview") ? null : "inview"));
    tabs.inView.addEventListener("click", () => sheet(fig.classList.contains("sc-open-inview") ? null : "inview"));
    kindButton.addEventListener("click", () => sheet(fig.classList.contains("sc-open-kinds") ? null : "kinds"));
    tabs.airspace.addEventListener("click", () => sheet(fig.classList.contains("sc-open-kinds") ? null : "kinds"));
    tabs.view.addEventListener("click", () => sheet(fig.classList.contains("sc-open-view") ? null : "view"));
    // Phone search: the header's button (or the Procedure tab) opens it under the header.
    const setFind = (on, focus = true) => {
        fig.classList.toggle("sc-open-find", on);
        findButton.setAttribute("aria-expanded", String(on));
        if (!on)
            results.hidden = true;
        else if (focus)
            input.focus();
    };
    findButton.addEventListener("click", () => {
        sheet(null);
        setFind(!fig.classList.contains("sc-open-find"));
    });
    tabs.procedure.addEventListener("click", () => {
        sheet(null);
        setFind(true);
    });
    // The plate panel's buttons.
    const togglePlate = () => plates.set(plates.mode() === null ? "split" : null);
    plateButton.addEventListener("click", togglePlate);
    tabs.plate.addEventListener("click", () => {
        sheet(null);
        togglePlate();
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
        const scene = { ...wanted, raise: raiseNow(c.first, shown ? v.raisedAreas() : null), tags: tagsOn, height: scale, chart };
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
        plates.procedures(r.procedures, r.airport);
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
    // Results. Typing finds procedures by name. With the box empty: the airport list, or, once an airport is picked
    // (from the list or its tag on the chart), every procedure there.
    let browse = null;
    const option = (kids, pick, cls = "") => {
        const opt = h("button", { type: "button", role: "option", class: `sc-option ${cls}` }, ...kids);
        opt.addEventListener("click", pick);
        return opt;
    };
    const listGroups = (groups) => {
        for (const g of groups) {
            results.append(h("p", { class: "sc-group" }, `${g.airport} · ${L.groups[g.type]}`));
            for (const hit of g.hits) {
                results.append(option([hit.procedure.name], () => {
                    r = add(r, { airport: hit.airport, name: hit.procedure.name }, has);
                    // The list follows the airport the diagram now follows.
                    if (browse !== null)
                        browse = hit.airport;
                    input.value = "";
                    results.hidden = true;
                    refresh();
                }));
            }
        }
    };
    const showAirport = (id) => {
        browse = id;
        r = pickAirport(r, id, has);
        input.value = "";
        // A phone's search is shut until asked for: open it for the list, without the keyboard.
        if (findButton.offsetParent)
            setFind(true, false);
        showResults();
        refresh();
    };
    const showResults = () => {
        const q = input.value;
        results.replaceChildren();
        const at = browse === null ? undefined : data.airports.find((a) => a.id === browse);
        if (q.trim()) {
            const groups = search(q, data.airports);
            if (!groups.length)
                results.append(h("p", { class: "sc-none" }, L.noMatches));
            listGroups(groups);
        }
        else if (at) {
            results.append(option([L.airports], () => {
                browse = null;
                showResults();
                input.focus();
            }, "sc-back"));
            listGroups(proceduresAt(at));
        }
        else {
            results.append(h("p", { class: "sc-group" }, L.airports));
            for (const a of airportList(data.airports))
                results.append(option([h("b", {}, a.id), h("span", {}, a.name)], () => showAirport(a.id), "sc-airport"));
        }
        results.hidden = false;
    };
    input.addEventListener("input", showResults);
    input.addEventListener("focus", showResults);
    input.addEventListener("keydown", (e) => {
        if (e.key !== "Escape")
            return;
        results.hidden = true;
        // A phone's search closes too, back to its button.
        if (fig.classList.contains("sc-open-find")) {
            setFind(false);
            findButton.focus();
        }
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
    // Each tool's value, on the rail and in the View sheet.
    const drawTags = () => {
        tagsTool.value.textContent = tagsOn ? L.on : L.off;
        tagsTool.button.setAttribute("aria-label", `${L.tags}: ${tagsOn ? L.on : L.off}`);
        tagsBox.checked = tagsOn;
    };
    const setTags = (on) => {
        tagsOn = on;
        drawTags();
        v.tags(tagsOn);
    };
    tagsTool.button.addEventListener("click", () => setTags(!tagsOn));
    tagsBox.addEventListener("change", () => setTags(tagsBox.checked));
    drawTags();
    const drawHeight = () => {
        heightTool.value.textContent = `${scale}×`;
        heightTool.button.setAttribute("aria-label", L.heightScale(scale));
        fillSeg(heightSeg, [1, 4].map((n) => ({ text: `${n}×`, on: n === scale, pick: () => setHeight(n) })));
    };
    const setHeight = (n) => {
        scale = n;
        drawHeight();
        v.exaggerate(scale);
    };
    heightTool.button.addEventListener("click", () => setHeight(scale === 1 ? 4 : 1));
    drawHeight();
    const drawChart = () => {
        const mode = modeOf(chart);
        const here = chartsIn(data.charts, mode);
        modeTool.value.textContent = L.modes[mode];
        modeTool.button.setAttribute("aria-label", `${L.mode}: ${L.modes[mode]}`);
        chartTool.value.textContent = L.charts[chart];
        chartTool.button.setAttribute("aria-label", `${L.chart}: ${L.charts[chart]}`);
        chartTool.button.hidden = chartSeg.row.hidden = here.length < 2;
        fillSeg(modeSeg, ["vfr", "ifr"].map((m) => ({ text: L.modes[m], on: m === mode, pick: () => setMode(m) })));
        fillSeg(chartSeg, here.map((x) => ({ text: L.charts[x], on: x === chart, pick: () => setChart(x) })));
        for (const [k, { row }] of rows)
            row.hidden = !shownIn(mode, k);
        if (caption)
            caption.textContent = L.caption(data.edition, chart);
    };
    const setChart = (next) => {
        chart = next;
        lastIn[modeOf(chart)] = chart;
        // Comparing the charts: the camera stays on what is being looked at.
        r = { ...r, camera: null };
        drawChart();
        refresh();
    };
    const setMode = (mode) => {
        if (mode !== modeOf(chart))
            setChart(lastIn[mode] ?? chartsIn(data.charts, mode)[0]);
    };
    modeTool.button.addEventListener("click", () => setMode(modeOf(chart) === "vfr" ? "ifr" : "vfr"));
    chartTool.button.addEventListener("click", () => {
        const here = chartsIn(data.charts, modeOf(chart));
        setChart(here[(here.indexOf(chart) + 1) % here.length]);
    });
    drawChart();
    // iPhone Safari has no element fullscreen, so the class fills the window and the real thing is added where it exists.
    const phone = matchMedia("(max-width: 860px) and (pointer: coarse)");
    const drawPhone = () => {
        fig.classList.toggle("sc-preview", phone.matches && !fig.classList.contains("full"));
        fullButton.hidden = phone.matches;
        tabs.close.hidden = !phone.matches;
    };
    const setFull = (on) => {
        fig.classList.toggle("full", on);
        fullButton.setAttribute("aria-pressed", String(on));
        document.documentElement.classList.toggle("skycake-full", on);
        drawPhone();
    };
    const goFull = (on) => {
        setFull(on);
        if (on)
            fig.requestFullscreen?.().catch(() => { });
        else if (document.fullscreenElement)
            document.exitFullscreen();
    };
    // The page scrolls again before the site's close runs, in case it stays on this page.
    const leave = (close) => {
        document.documentElement.classList.remove("skycake-full");
        close();
    };
    fullButton.addEventListener("click", () => (c.close ? leave(c.close) : goFull(!fig.classList.contains("full"))));
    openButton.addEventListener("click", () => goFull(true));
    tabs.close.addEventListener("click", () => {
        sheet(null);
        results.hidden = true;
        if (c.close)
            leave(c.close);
        else
            goFull(false);
    });
    phone.addEventListener("change", drawPhone);
    // A standalone app: the view fills the window from the start and only close leaves it.
    if (c.close) {
        fig.classList.add("full");
        document.documentElement.classList.add("skycake-full");
    }
    drawPhone();
    // The page's own gestures over the map are stopped in mount() (ui.ts), for every mode.
    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement)
            setFull(false);
    });
    // A tap on an airport's tag on the chart lists its procedures.
    c.fig.addEventListener("skycake-airport", (e) => {
        sheet(null);
        showAirport(e.detail.airport);
    });
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
/**
 * Walkthroughs and quizzes on a phone: the view in the page lets the page scroll past it until a tap wakes it, and it
 * sleeps again once scrolled out of sight. The player and question card stay live throughout. Returns the undo.
 */
export function wakeOnTap(c) {
    const { fig, labels: L } = c;
    const phone = matchMedia("(max-width: 860px) and (pointer: coarse)");
    const button = h("button", { type: "button", class: "sc-wake" }, h("span", { class: "sc-pill" }, L.wake));
    fig.querySelector(".view").append(button);
    const asleep = (on) => fig.classList.toggle("sc-asleep", on && phone.matches);
    button.addEventListener("click", () => asleep(false));
    const seen = new IntersectionObserver(([e]) => e.isIntersecting || asleep(true));
    seen.observe(fig);
    const change = () => asleep(true);
    phone.addEventListener("change", change);
    asleep(true);
    return () => {
        seen.disconnect();
        phone.removeEventListener("change", change);
        button.remove();
        fig.classList.remove("sc-asleep");
    };
}
