// The quiz over the 3D view: the count (top left), Explore (top right), the question card along the bottom (phone: the
// answer area under the view). The attempt is quiz.ts; this draws it, shows each question's scene and reports each
// answer to the site. One DOM for desktop and phone; style.css decides the layout.
import { card } from "./card.js";
import { h } from "./freeroam.js";
import { areaFacts } from "./generate.js";
import { locator, questionScene, revealScene, score } from "./question.js";
import { advance, answer, attempt, maker, practice } from "./quiz.js";
import { framedOnly, resolve, stripPlayback, usable } from "./scene.js";
const TYPES = ["find", "read", "airplane", "procedure"];
/** Resolves once the first question shows. explore: leave into free roam from the scene on screen; the quiz's DOM is gone by then. */
export async function quiz(c, mode, onResult, explore) {
    const { fig, view: v, data, labels: L } = c;
    const id = mode.quiz === "practice" ? "practice" : mode.quiz.id;
    const viewEl = fig.querySelector(".view");
    const count = h("p", { class: "sc-title sc-score" });
    const exploreTop = h("button", { type: "button", class: "sc-pill" }, L.explore);
    const top = h("div", { class: "sc-wtop" }, count, exploreTop);
    const box = h("div", { class: "sc-quiz" });
    viewEl.after(top);
    fig.append(box);
    fig.classList.add("sc-quizzing");
    const caption = fig.querySelector(".sc-caption");
    // Generated questions draw from the terrain the view loaded and, when a generator can ask about them, the procedures.
    const filters = { kinds: mode.kinds, airports: mode.airports };
    const gens = mode.quiz === "practice" ? (mode.types ?? TYPES).map((generate) => ({ generate, count: 1, ...filters })) : mode.quiz.items.filter((x) => "generate" in x);
    const wantsProcedures = gens.some((g) => (g.generate === "find" || g.generate === "procedure") && !(g.kinds && !g.airports));
    const ids = mode.airports ?? data.airports.filter((a) => a.procedures.length).map((a) => a.id);
    const procedures = wantsProcedures ? (await Promise.all(ids.map(c.procedures))).flat() : [];
    const rng = Math.random;
    const make = maker({ data, grid: v.dem(), procedures, ask: L.ask, facts: L.facts }, rng);
    const start = () => (mode.quiz === "practice" ? practice(make, mode.types ?? TYPES, filters, rng) : attempt(mode.quiz, make, rng));
    // Questions repeat little, but a written one may name something missing: each warning once.
    const warned = new Set();
    const warn = (m) => {
        if (warned.has(m))
            return;
        warned.add(m);
        console.warn(`skycake: ${m}`);
    };
    // Files load out of order, so only the newest scene asked for shows.
    let ticket = 0;
    let files = [];
    let onScreen = {};
    const show = async (scene, now = false) => {
        const mine = ++ticket;
        const plane = scene.airplane && "along" in scene.airplane ? [scene.airplane.along] : [];
        const load = (refs) => Promise.all(refs.map(async (r) => (await c.procedures(r.airport)).find((x) => x.name === r.name)));
        const found = (await load([...(scene.procedures ?? []), ...framedOnly(scene), ...plane])).filter((x) => !!x);
        if (mine !== ticket)
            return;
        const ok = usable(scene, data, (fix) => !!locator(data, found)({ fix }), warn);
        let r;
        try {
            r = resolve(ok, data);
        }
        catch (e) {
            warn(`${e instanceof Error ? e.message : e}; leaving the view as it was`);
            return;
        }
        onScreen = ok;
        files = found;
        if (caption)
            caption.textContent = L.caption(data.edition, r.chart);
        await v.apply(r, r.procedures.flatMap((x) => found.find((f) => f.airport === x.airport && f.name === x.name) ?? []), now, found);
    };
    // The box holds one thing: the open card, the end or the nothing-to-ask note. Focus follows when it was in the box.
    let open = null;
    const put = (el) => {
        const had = box.contains(document.activeElement);
        open?.remove();
        open = null;
        box.replaceChildren(el);
        return had;
    };
    const pill = (text, onClick) => {
        const b = h("button", { type: "button", class: "sc-pill" }, text);
        b.addEventListener("click", onClick);
        return b;
    };
    const note = (text, ...buttons) => {
        if (put(h("section", { class: "sc-card" }, h("p", { class: "sc-prompt", "aria-live": "polite" }, text), h("div", { class: "sc-end" }, ...buttons))))
            buttons[0].focus();
    };
    let a = start();
    const drawCount = () => {
        count.hidden = !a;
        if (a)
            count.textContent = a.practice ? L.practiceCount(a.right, a.answered) : L.count(a.i + 1, a.items.length, a.right);
    };
    // Written questions carry no facts; one whose answer is an area shows that area's.
    const factsOf = (it) => {
        if (it.facts || it.q.type !== "find" || !("area" in it.q.answer))
            return it.facts;
        const area = it.q.answer.area;
        const found = data.areas.find((x) => x.id === area);
        return found ? areaFacts(L.facts, data, found) : null;
    };
    const ask = (now = false) => {
        if (!a || a.done) {
            drawCount();
            note(L.nothing, pill(L.explore, leave));
            return Promise.resolve();
        }
        const it = a.items[a.i];
        let shownAt = 0;
        const k = card(it.q, L, v, (ans) => {
            if (!a || a.done || open !== k)
                return;
            const right = score(it.q, ans, locator(data, files));
            a = answer(a, right);
            drawCount();
            onResult({ quiz: id, item: it.key, right, ms: Math.round(performance.now() - shownAt) });
            void show(revealScene(it.q));
            k.reveal(right, factsOf(it), L.nextQuestion, () => open === k && next());
        });
        const had = put(k.el);
        open = k;
        drawCount();
        shownAt = performance.now();
        // A find question is answered on the view, or by Tab into the list of what is on it.
        if (had)
            (k.el.querySelector(".sc-choice, .sc-number") ?? viewEl).focus();
        return show(questionScene(it.q), now);
    };
    const next = () => {
        if (!a || a.done)
            return;
        a = advance(a, make, rng);
        if (!a.done || a.practice)
            return void ask(); // practice ends only when nothing more can be made
        onResult({ quiz: id, end: true, right: a.right, total: a.items.length });
        note(L.result(a.right, a.items.length), pill(L.again, () => {
            a = start();
            void ask();
        }), pill(L.explore, leave));
    };
    function leave() {
        ticket++;
        open?.remove();
        open = null;
        top.remove();
        box.remove();
        fig.classList.remove("sc-quizzing");
        viewEl.focus();
        explore(stripPlayback({ ...onScreen, camera: v.camera() }));
    }
    exploreTop.addEventListener("click", leave);
    return ask(true);
}
