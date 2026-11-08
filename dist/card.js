// The question card: shared by the quiz player and anything else that asks. Shows a question, reports one answer,
// then reveals the result. A find question is answered on the chart (taps) or from a list of what is on screen (keys).
import { typedNumber } from "./question.js";
import { picker } from "./picker.js";
/** Accessibility mode's number field: the 0-based index for a whole number 1 to count, else null. */
export function pickByNumber(text, count) {
    const t = text.trim();
    if (!/^\d+$/.test(t))
        return null;
    const n = Number(t);
    return n >= 1 && n <= count ? n - 1 : null;
}
function h(tag, cls, ...kids) {
    const e = document.createElement(tag);
    e.className = cls;
    e.append(...kids);
    return e;
}
/** A check or a cross: the icon that goes with the word, so the result never rests on color. */
const icon = (right) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", right ? "M5 12.5l4.5 4.5L19 7.5" : "M6 6l12 12M18 6L6 18");
    svg.append(path);
    return svg;
};
const SETTLE_MS = 300;
/** The card that owns the view's tap, focus ring and hints now; an older card closing later leaves them alone. */
const owner = new WeakMap();
/**
 * say: sets the text of a live region already on the page (a new card's own region would not be announced).
 * a11y (accessibility mode): an answer is chosen, then Check scores it; a find question is answered by number (badges on
 * the map, a list, a field), and onSkip, when given, adds Skip.
 */
export function card(q, L, view, say, onAnswer, o = { a11y: false }) {
    const el = h("section", "sc-card");
    const text = h("div", "sc-text", h("p", "sc-prompt", q.prompt));
    el.append(text);
    say(q.prompt);
    const controls = [];
    const choiceButtons = [];
    let answered = false;
    // The card opens where the last one's Next or the end's Again was: a double click, a quick second Enter or a held
    // key would answer for the student. Nothing counts in its first moments.
    const born = performance.now();
    const answer = (a) => {
        if (answered || performance.now() - born < SETTLE_MS)
            return false;
        answered = true;
        onAnswer(a);
        return true;
    };
    el.addEventListener("keydown", (e) => e.repeat && (e.key === "Enter" || e.key === " ") && e.preventDefault());
    const button = (cls, text, onClick) => {
        const b = h("button", cls, text);
        b.type = "button";
        b.addEventListener("click", (e) => e.detail > 1 || onClick());
        controls.push(b);
        return b;
    };
    // Accessibility mode: the chosen answer and the Check that scores it, enabled once something is chosen.
    let chosen = null;
    const check = button("sc-choice sc-submit sc-check", L.submit, () => chosen && answer(chosen));
    check.disabled = true;
    const choose = (a) => {
        if (answered)
            return;
        chosen = a;
        check.disabled = false;
    };
    let pick = null;
    const me = {};
    // Taking the view from another card: what that card left on it (its tap, outline and number badges) goes.
    if (owner.has(view)) {
        view.tap(null);
        view.focus(null);
        view.numbers(null);
    }
    owner.set(view, me);
    view.hints(false);
    if ("choices" in q) {
        const list = h("div", "sc-choices");
        q.choices.forEach((c, i) => {
            const b = button("sc-choice", c, () => {
                if (!o.a11y)
                    return answer({ choice: i }) && b.setAttribute("aria-pressed", "true");
                choose({ choice: i });
                for (const x of choiceButtons)
                    x.setAttribute("aria-pressed", String(x === b));
            });
            choiceButtons.push(b);
            list.append(b);
        });
        el.append(list);
        if (o.a11y)
            el.append(check);
    }
    else if ("number" in q) {
        const input = h("input", "sc-number");
        input.setAttribute("inputmode", "decimal");
        input.setAttribute("aria-label", q.prompt);
        controls.push(input);
        const form = h("form", "sc-numform", input, ...(q.number.unit ? [h("span", "sc-unit", q.number.unit)] : []));
        const submit = h("button", "sc-choice sc-submit", L.submit);
        submit.type = "submit";
        controls.push(submit);
        form.append(submit);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const n = typedNumber(input.value);
            if (n !== null)
                answer({ number: n });
        });
        el.append(form);
    }
    else if (o.a11y) {
        // By number: the badges on the map, the same numbers as buttons, or typed. A tap on the map chooses too.
        const toAnswer = (c) => ("area" in c ? { area: c.area, at: null } : { area: null, at: c.at });
        let chosenKey = "";
        const keyOf = (a) => ("area" in a && a.area ? `a:${a.area}` : "at" in a && a.at ? `p:${a.at}` : "");
        const field = h("input", "sc-number sc-pick-number");
        // The one place the choice is set, so Check, the pressed number and the field always agree. A number with no badge
        // (or a half-typed one) chooses nothing, so Enter never scores an earlier pick; the field keeps what is being typed.
        const mark = (a, typed = false) => {
            if (answered)
                return;
            chosen = a;
            chosenKey = a ? keyOf(a) : "";
            check.disabled = !a;
            const i = a ? p.list().findIndex((c) => keyOf(toAnswer(c)) === chosenKey) : -1;
            [...p.el.children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
            if (!typed)
                field.value = i >= 0 ? String(i + 1) : "";
        };
        const p = picker(view, {
            label: () => "",
            pressed: () => (c) => keyOf(toAnswer(c)) === chosenKey,
            onPick: (c) => mark(toAnswer(c)),
            // The numbers change as the map moves: the field follows the chosen thing's new number.
            onRefill: () => chosen && mark(chosen),
        });
        pick = p;
        view.tap((hit) => mark(hit));
        field.setAttribute("inputmode", "numeric");
        field.setAttribute("aria-label", L.number);
        field.placeholder = L.number;
        field.addEventListener("input", () => {
            const i = pickByNumber(field.value, p.list().length);
            mark(i === null ? null : toAnswer(p.list()[i]), true);
        });
        field.addEventListener("keydown", (e) => e.key === "Enter" && !check.disabled && check.click());
        controls.push(field);
        p.el.classList.add("sc-pick-numbers");
        el.append(p.el, h("div", "sc-numform", field), check);
        if (o.onSkip)
            el.append(button("sc-choice sc-skip", L.skip, () => !answered && o.onSkip()));
    }
    else {
        view.tap((hit) => answer(hit));
        // The same answers for a keyboard: what is on screen, as hidden buttons. Rebuilt as Tab enters, since the camera moves.
        const list = h("div", "sc-onscreen");
        let filling = false;
        const fill = (focusAt = -1) => {
            filling = true;
            try {
                list.replaceChildren();
                controls.length = 0;
                view.onScreen().forEach((c) => {
                    const b = button("sc-hidden", "area" in c ? L.facts(c.name, c.floor, c.ceiling) : c.name, () => answer("area" in c ? { area: c.area, at: null } : { area: null, at: c.at }));
                    b.addEventListener("focus", () => view.focus(c));
                    b.addEventListener("blur", () => view.focus(null));
                    list.append(b);
                });
                if (focusAt >= 0)
                    list.children[Math.min(focusAt, list.children.length - 1)]?.focus();
            }
            finally {
                filling = false;
            }
        };
        list.addEventListener("focusin", (e) => {
            if (!filling && !(e.relatedTarget instanceof Node && list.contains(e.relatedTarget)))
                fill([...list.children].indexOf(e.target));
        });
        fill();
        el.append(list);
    }
    let closed = false;
    const done = () => {
        if (closed)
            return;
        closed = true;
        // Another card has the view already: stop this one's picker, and leave the view (and its badges) to that card.
        if (owner.get(view) !== me)
            return pick?.stop(false);
        pick?.stop();
        for (const b of pick?.el.querySelectorAll("button") ?? [])
            b.disabled = true;
        owner.delete(view);
        view.hints(true);
        view.tap(null);
        view.focus(null);
    };
    return {
        el,
        reveal(right, facts, label, onNext) {
            for (const c of controls)
                c.disabled = true;
            done();
            const said = [h("p", `sc-result ${right ? "right" : "wrong"}`, icon(right), right ? L.right : L.wrong)];
            // A wrong answer still teaches the right one: in words, and marked with the check on its choice.
            const shown = "choices" in q ? q.choices[q.answer] : "number" in q ? `${q.number.answer.toLocaleString("en-US")}${q.number.unit ? ` ${q.number.unit}` : ""}` : null;
            if (!right && shown !== null) {
                said.push(h("p", "sc-facts", L.answerWas(shown)));
                const b = "choices" in q ? choiceButtons[q.answer] : undefined;
                b?.classList.add("sc-answer");
                b?.prepend(icon(true));
            }
            if (facts)
                said.push(h("p", "sc-facts", facts));
            if (q.explanation)
                said.push(h("p", "sc-explain", q.explanation));
            text.append(...said);
            say(said.map((p) => p.textContent).join(" "));
            const next = h("button", "sc-choice sc-next", label);
            next.type = "button";
            next.addEventListener("click", onNext);
            el.append(next);
            next.focus();
        },
        remove() {
            done();
            el.remove();
        },
    };
}
