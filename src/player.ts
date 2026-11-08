// The walkthrough player over the 3D view: the title (top left), Explore (top right), the step's caption above the
// player along the bottom (phone: the player is the 76 px bar). Timing is walkthrough.ts; this draws it and shows each
// step's scene. One DOM for desktop and phone; style.css decides the layout.
import { card } from "./card.js";
import { ICONS, h, icon, wakeOnTap, type Context } from "./freeroam.js";
import { locator, questionScene, revealScene, score } from "./question.js";
import { stripPlayback, type Scene } from "./scene.js";
import { scenes } from "./scenes.js";
import { answered, back, begin, moved, next, pause, play, stepSeconds, tick, type Play, type Walkthrough } from "./walkthrough.js";

const PLAYER = {
  play: ["M7 4.5v15L19.5 12 7 4.5Z"],
  pause: ["M8 5v14", "M16 5v14"],
  back: ["M6 5v14", "M19 5.5 9 12l10 6.5V5.5Z"],
  next: ["M18 5v14", "M5 5.5 15 12 5 18.5V5.5Z"],
};

/** Resolves once step 1 shows. explore: leave into free roam from that scene; the player's DOM is gone by then. */
export function player(c: Context, w: Walkthrough, nextLink: { label: string; href: string } | undefined, explore: (from: Scene) => void): Promise<void> {
  const { fig, view: v, data, labels: L } = c;
  const html = document.documentElement;
  const off = new AbortController();

  const exploreTop = h("button", { type: "button", class: "sc-pill" }, L.explore);
  const top = h("div", { class: "sc-wtop" }, h("p", { class: "sc-title" }, w.title), exploreTop);

  // The step's caption; once the walkthrough ends, Explore and the site's next link under it.
  const text = h("p", { "aria-live": "polite" });
  const exploreEnd = h("button", { type: "button", class: "sc-pill" }, L.explore);
  const end = h("div", { class: "sc-end" }, exploreEnd, ...(nextLink ? [h("a", { class: "sc-pill sc-next-link", href: nextLink.href }, nextLink.label)] : []));
  const stepCard = h("section", { class: "sc-step" }, text, end);

  const round = (label: string, paths: string[], box?: string) => h("button", { type: "button", class: "sc-round", "aria-label": label }, icon(paths, box));
  const backButton = round(L.back, PLAYER.back);
  const playButton = round(L.play, PLAYER.play);
  const nextButton = round(L.next, PLAYER.next);
  // One segment per step; a check's is outlined. --f is how much of it is played.
  const segments = w.steps.map((s) => h("i", { class: s.check ? "check" : undefined }));
  const count = h("span", { class: "sc-count" });
  const fullButton = c.close ? round(L.close, ICONS.close) : round(L.fullScreen, ICONS.full, "0 0 12 12");
  const bar = h("div", { class: "sc-bar", role: "group", "aria-label": L.controls }, backButton, playButton, nextButton, h("div", { class: "sc-progress", "aria-hidden": "true" }, ...segments), count, fullButton);
  // The check card's prompt and result go to this region, on the page from the start so they are announced.
  const live = h("p", { class: "sc-hidden", "aria-live": "polite" });
  const box = h("div", { class: "sc-player" }, live, stepCard, bar);
  const big = h("button", { type: "button", class: "sc-big-play", "aria-label": L.play }, icon(PLAYER.play));
  fig.querySelector(".view")!.after(top, big);
  fig.append(box);
  const unwake = wakeOnTap(c);

  let p: Play = begin();
  const frac = () => (p.done ? 1 : p.t / stepSeconds(w.steps[p.step]));
  // The timeline fraction the view shows now.
  let drawn = -1;

  // Every scene goes through here; the step's timeline fraction is what the view shows then.
  const stage = scenes(c, () => (drawn = frac()));
  const show = stage.show;

  // A quick check: the shared question card in the caption's place. Not scored; Continue plays on.
  let open: ReturnType<typeof card> | null = null;
  const closeCard = () => {
    const had = !!open?.el.contains(document.activeElement);
    open?.remove();
    open = null;
    if (had) playButton.focus();
  };
  const ask = () => {
    const q = w.steps[p.step].check!;
    closeCard();
    const scene = questionScene(q);
    const files = stage.filesOf(scene);
    const k = card(q, L, v, (t) => live.replaceChildren(t), async (a) => {
      const loaded = await files;
      if (open !== k) return;
      const right = score(q, a, locator(data, loaded));
      void show(revealScene(q));
      k.reveal(right, null, L.continue, () => set(answered(p, w)));
    }, { a11y: c.a11y });
    open = k;
    bar.before(k.el);
    // In accessibility mode a check takes focus as it opens.
    if (c.a11y) k.el.querySelector<HTMLElement>(".sc-choice, .sc-number, .sc-option")?.focus();
    void show(scene);
  };

  const draw = () => {
    const step = w.steps[p.step];
    if (text.textContent !== step.caption) text.textContent = step.caption;
    stepCard.hidden = !!open;
    end.hidden = !p.done;
    big.hidden = p.started;
    const label = p.playing ? L.pause : L.play;
    if (playButton.getAttribute("aria-label") !== label) {
      playButton.setAttribute("aria-label", label);
      playButton.replaceChildren(icon(p.playing ? PLAYER.pause : PLAYER.play));
    }
    // Play waits while a check is open; its Continue is the way on.
    playButton.setAttribute("aria-disabled", String(p.checking));
    const f = frac();
    segments.forEach((s, i) => s.style.setProperty("--f", `${p.done || i < p.step ? 100 : i === p.step ? f * 100 : 0}%`));
    const n = L.stepOf(p.step + 1, w.steps.length);
    if (count.textContent !== n) count.textContent = n;
    if (f !== drawn) {
      drawn = f;
      v.timeline(f);
    }
  };

  const set = (n: Play) => {
    const was = p;
    p = n;
    if (was.checking && !p.checking) closeCard();
    // A new step, a restart from the end, or play after a drag: the step's scene again.
    if (p.step !== was.step || (was.done && !p.done) || (was.moved && !p.moved)) void show(w.steps[p.step].scene);
    if (p.checking && !was.checking) ask();
    draw();
  };

  let last = performance.now();
  let raf = requestAnimationFrame(function loop(now) {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.25);
    last = now;
    if (p.playing) set(tick(p, w, dt, c.a11y));
    raf = requestAnimationFrame(loop);
  });

  playButton.addEventListener("click", () => set(p.playing ? pause(p) : play(p)));
  big.addEventListener("click", () => {
    set(play(p));
    playButton.focus();
  });
  backButton.addEventListener("click", () => set(back(p, w)));
  nextButton.addEventListener("click", () => set(next(p, w)));
  fig.addEventListener("skycake-moved", () => set(moved(p)), { signal: off.signal });

  // Full screen, or the site's close in a standalone app, as in free roam.
  const setFull = (on: boolean) => {
    fig.classList.toggle("full", on);
    html.classList.toggle("skycake-full", on);
    fullButton.setAttribute("aria-pressed", String(on));
  };
  fullButton.addEventListener("click", () => {
    if (c.close) {
      html.classList.remove("skycake-full");
      return c.close();
    }
    const on = !fig.classList.contains("full");
    setFull(on);
    if (on) fig.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen();
  });
  document.addEventListener("fullscreenchange", () => document.fullscreenElement || setFull(false), { signal: off.signal });
  if (c.close) {
    fig.classList.add("full");
    html.classList.add("skycake-full");
  }

  const leave = () => {
    cancelAnimationFrame(raf);
    off.abort();
    unwake();
    stage.stop();
    closeCard();
    top.remove();
    big.remove();
    box.remove();
    fig.querySelector<HTMLElement>(".view")?.focus();
    explore(stripPlayback({ ...stage.onScreen(), camera: v.camera() }));
  };
  exploreTop.addEventListener("click", leave);
  exploreEnd.addEventListener("click", leave);

  draw();
  return show(w.steps[0].scene, true);
}
