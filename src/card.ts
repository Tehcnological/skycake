// The question card: shared by the quiz player and anything else that asks. Shows a question, reports one answer,
// then reveals the result. A find question is answered on the chart (taps) or from a list of what is on screen (keys).
import type { Answer, Question } from "./question.js";
import type { Labels } from "./ui.js";
import type { Candidate, View } from "./viewer.js";

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.append(...kids);
  return e;
}
/** A check or a cross: the icon that goes with the word, so the result never rests on color. */
const icon = (right: boolean) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", right ? "M5 12.5l4.5 4.5L19 7.5" : "M6 6l12 12M18 6L6 18");
  svg.append(path);
  return svg;
};

/** The card that owns the view's tap, focus ring and hints now; an older card closing later leaves them alone. */
let current: object | null = null;

export function card(q: Question, L: Labels, view: View, onAnswer: (a: Answer) => void): { el: HTMLElement; reveal(right: boolean, facts: string | null, button: string, onNext: () => void): void; remove(): void } {
  const el = h("section", "sc-card");
  const live = h("div", "sc-live", h("p", "sc-prompt", q.prompt));
  live.setAttribute("aria-live", "polite");
  el.append(live);
  const controls: (HTMLButtonElement | HTMLInputElement)[] = [];
  let answered = false;
  const answer = (a: Answer) => {
    if (answered) return;
    answered = true;
    onAnswer(a);
  };
  const button = (cls: string, text: string, onClick: () => void) => {
    const b = h("button", cls, text);
    b.type = "button";
    b.addEventListener("click", onClick);
    controls.push(b);
    return b;
  };

  const me = {};
  current = me;
  view.hints(false);
  if ("choices" in q) {
    const list = h("div", "sc-choices");
    q.choices.forEach((c, i) => {
      const b = button("sc-choice", c, () => {
        b.setAttribute("aria-pressed", "true");
        answer({ choice: i });
      });
      list.append(b);
    });
    el.append(list);
  } else if ("number" in q) {
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
      const n = parseFloat(input.value.replace(",", "."));
      if (Number.isFinite(n)) answer({ number: n });
    });
    el.append(form);
  } else {
    view.tap((hit) => answer(hit));
    // The same answers for a keyboard: what is on screen, as hidden buttons. Rebuilt as Tab enters, since the camera moves.
    const list = h("div", "sc-onscreen");
    let filling = false;
    const fill = (focusAt = -1) => {
      filling = true;
      list.replaceChildren();
      controls.length = 0;
      view.onScreen().forEach((c: Candidate) => {
        const b = button("sc-hidden", c.name, () => answer("area" in c ? { area: c.area, at: null } : { area: null, at: c.at }));
        b.addEventListener("focus", () => view.focus(c));
        b.addEventListener("blur", () => view.focus(null));
        list.append(b);
      });
      if (focusAt >= 0) (list.children[Math.min(focusAt, list.children.length - 1)] as HTMLElement | undefined)?.focus();
      filling = false;
    };
    list.addEventListener("focusin", (e) => {
      if (!filling && !(e.relatedTarget instanceof Node && list.contains(e.relatedTarget))) fill([...list.children].indexOf(e.target as Element));
    });
    fill();
    el.append(list);
  }

  let closed = false;
  const done = () => {
    if (closed || current !== me) return;
    closed = true;
    current = null;
    view.hints(true);
    view.tap(null);
    view.focus(null);
  };
  return {
    el,
    reveal(right, facts, label, onNext) {
      for (const c of controls) c.disabled = true;
      done();
      live.append(h("p", `sc-result ${right ? "right" : "wrong"}`, icon(right), right ? L.right : L.wrong));
      if (facts) live.append(h("p", "sc-facts", facts));
      if (q.explanation) live.append(h("p", "sc-explain", q.explanation));
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
