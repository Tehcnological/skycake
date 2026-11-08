// The quiz over the 3D view: the count (top left), Explore (top right), the question card along the bottom (phone: the
// answer area under the view). The attempt is quiz.ts; this draws it, shows each question's scene and reports each
// answer to the site. One DOM for desktop and phone; style.css decides the layout.
import { card } from "./card.js";
import { h } from "./freeroam.js";
import { classAt } from "./airclass.js";
import { areaFacts } from "./generate.js";
import { locator, questionScene, revealScene, score } from "./question.js";
import { advance, answer, attempt, maker, practice } from "./quiz.js";
import { stripPlayback } from "./scene.js";
import { scenes } from "./scenes.js";
const TYPES = ["find", "read", "airplane", "procedure"];
/** Resolves once the first question shows. explore: leave into free roam from the scene on screen; the quiz's DOM is gone by then. */
export async function quiz(c, mode, onResult, explore) {
    const { fig, view: v, data, labels: L } = c;
    const id = mode.quiz === "practice" ? "practice" : mode.quiz.id;
    const viewEl = fig.querySelector(".view");
    const count = h("p", { class: "sc-title sc-score" });
    const exploreTop = h("button", { type: "button", class: "sc-pill" }, L.explore);
    const top = h("div", { class: "sc-wtop" }, count, exploreTop);
    // One live region for the whole quiz, on the page before any text goes in, so each question and result is announced.
    const live = h("p", { class: "sc-hidden", "aria-live": "polite" });
    const say = (text) => live.replaceChildren(text);
    const box = h("div", { class: "sc-quiz" }, live);
    viewEl.after(top);
    fig.append(box);
    fig.classList.add("sc-quizzing");
    // Generated questions draw from the terrain the view loaded and, when a generator can ask about them, the procedures.
    const filters = { kinds: mode.kinds, airports: mode.airports };
    const gens = mode.quiz === "practice" ? (mode.types ?? TYPES).map((generate) => ({ generate, count: 1, ...filters })) : mode.quiz.items.filter((x) => "generate" in x);
    const wantsProcedures = gens.some((g) => (g.generate === "find" || g.generate === "procedure") && !(g.kinds && !g.airports));
    const ids = mode.airports ?? data.airports.filter((a) => a.procedures.length).map((a) => a.id);
    const procedures = wantsProcedures ? (await Promise.all(ids.map(c.procedures))).flat() : [];
    const rng = Math.random;
    const make = maker({ data, grid: v.dem(), procedures, ask: L.ask, facts: L.facts }, rng);
    const start = () => (mode.quiz === "practice" ? practice(make, mode.types ?? TYPES, filters, rng) : attempt(mode.quiz, make, rng));
    const stage = scenes(c);
    const show = stage.show;
    // The box holds one thing: the open card, the end or the nothing-to-ask note. Focus follows when it was in the box.
    let open = null;
    const put = (el) => {
        const had = box.contains(document.activeElement);
        open?.remove();
        open = null;
        for (const x of [...box.children])
            if (x !== live)
                x.remove();
        box.append(el);
        return had;
    };
    const pill = (text, onClick) => {
        const b = h("button", { type: "button", class: "sc-pill" }, text);
        b.addEventListener("click", onClick);
        return b;
    };
    const note = (text, ...buttons) => {
        say(text);
        if (put(h("section", { class: "sc-card" }, h("p", { class: "sc-prompt" }, text), h("div", { class: "sc-end" }, ...buttons))))
            buttons[0].focus();
    };
    // A throw in the site's onResult must not stall the quiz.
    const report = (r) => {
        try {
            onResult(r);
        }
        catch (e) {
            console.error(e);
        }
    };
    // A written airplane question names no area: the reveal raises the one the airplane is in, as for generated ones.
    const withArea = (q) => {
        const plane = q.scene?.airplane;
        if (q.type !== "airplane" || q.answerArea || !plane || !("at" in plane))
            return q;
        const area = classAt(data, v.dem(), ...plane.at).area;
        return area ? { ...q, answerArea: area } : q;
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
        const scene = questionScene(it.q);
        const files = stage.filesOf(scene);
        const k = card(it.q, L, v, say, async (ans) => {
            const loaded = await files;
            if (!a || a.done || open !== k)
                return;
            const right = score(it.q, ans, locator(data, loaded));
            a = answer(a, right);
            drawCount();
            report({ quiz: id, item: it.key, right, ms: Math.round(performance.now() - shownAt) });
            void show(revealScene(withArea(it.q)));
            k.reveal(right, factsOf(it), L.nextQuestion, () => open === k && next());
        });
        const had = put(k.el);
        open = k;
        drawCount();
        shownAt = performance.now();
        // A find question is answered on the view, or by Tab into the list of what is on it.
        if (had)
            (k.el.querySelector(".sc-choice, .sc-number") ?? viewEl).focus();
        return show(scene, now);
    };
    const next = () => {
        if (!a || a.done)
            return;
        a = advance(a, make, rng);
        if (!a.done)
            return void ask(); // practice is done only when nothing more can be made; it ends with its score too
        report({ quiz: id, end: true, right: a.right, total: a.items.length });
        note(L.result(a.right, a.items.length), pill(L.again, () => {
            a = start();
            void ask();
        }), pill(L.explore, leave));
    };
    function leave() {
        stage.stop();
        open?.remove();
        open = null;
        top.remove();
        box.remove();
        fig.classList.remove("sc-quizzing");
        viewEl.focus();
        explore(stripPlayback({ ...stage.onScreen(), camera: v.camera() }));
    }
    exploreTop.addEventListener("click", leave);
    return ask(true);
}
