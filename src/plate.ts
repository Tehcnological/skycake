// The procedure chart viewer: the plate panel (its head, full screen, close and the divider) and, filling its body,
// the charts. Free roam, walkthroughs and quizzes build it once, place its panel, tell it what is shown as that
// changes, and ask whether the area has charts at all (their open buttons show only then).
import { h, icon, ICONS, type Context } from "./freeroam.js";
import { isTap, twoFingers, type Pt } from "./gesture.js";
import { ARROWS, MINUS, PLUS } from "./pad.js";
import type { ProcedureRef } from "./scene.js";
import type { ChartEntry } from "./tpp.js";

export type PlateMode = "split" | "full" | null;
export type Plates = {
  /** The area has charts to show; until then free roam hides the panel's open buttons. */
  has: boolean;
  /** The panel (aside.sc-plate) for the caller to place; null when the area has no charts. */
  el: HTMLElement | null;
  mode: () => PlateMode;
  set: (mode: PlateMode) => void;
  /** The procedures shown and the current airport, whenever either changes. */
  procedures: (refs: ProcedureRef[], airport: string | null) => void;
  destroy: () => void;
};

/**
 * The panel beside the map on desktop and on a phone held sideways, over it on an upright phone; full screen covers
 * the map. The fig's sc-plate class opens it, sc-plate-full makes it full screen. `show` adds a procedure in 3D, as
 * picking it in the search box does.
 */
export function plateView(c: Context, on: {
  show: (ref: ProcedureRef) => void;
  /** Every mode change, from inside the panel or set(). */
  mode?: (m: PlateMode) => void;
  /** Where focus goes when the panel closes with focus inside it. Default: the view. */
  back?: () => HTMLElement;
  /** The map's room on an upright phone, for the divider. Default: the figure's box. */
  room?: () => { top: number; bottom: number };
}): Plates {
  if (!c.data.plates) return { has: false, el: null, mode: () => null, set: () => {}, procedures: () => {}, destroy: () => {} };
  const { fig, labels: L } = c;
  const id = `sc-plate-${Math.random().toString(36).slice(2)}`;
  const title = h("span", { class: "sc-plate-title" }, L.plate);
  const pick = h("select", { class: "sc-plate-pick", "aria-label": L.plateChart });
  const arrow = (paths: string[]) => h("button", { type: "button", class: "sc-x", hidden: true }, icon(paths));
  const [back, next] = [arrow(ARROWS.left), arrow(ARROWS.right)];
  // Map / Plate / Split: map only (the panel closed), chart only (full screen), both.
  const modes = ([[L.plateMap, null], [L.platePlate, "full"], [L.plateSplit, "split"]] as const).map(([label, m]) => ({ m, b: h("button", { type: "button", "aria-pressed": "false" }, label) }));
  const switcher = h("div", { class: "sc-seg sc-plate-switch", role: "group", "aria-label": L.plate }, ...modes.map((x) => x.b));
  const full = h("button", { type: "button", class: "sc-x", "aria-pressed": "false" }, icon(ICONS.full, "0 0 12 12"));
  const close = h("button", { type: "button", class: "sc-x", "aria-label": L.close }, icon(ICONS.close));
  const body = h("div", { class: "sc-plate-body", tabindex: "0", role: "group", "aria-label": L.plateChart, "aria-keyshortcuts": "ArrowLeft ArrowRight ArrowUp ArrowDown + -" });
  const round = (label: string, paths: string[], box?: string) => h("button", { type: "button", class: "sc-round", "aria-label": label }, icon(paths, box));
  const [zoomIn, zoomOut, zoomFit] = [round(L.zoomIn, PLUS), round(L.zoomOut, MINUS), round(L.zoomFit, FIT, "0 0 12 12")];
  // Accessibility mode's zoom buttons (style.css shows them only then), in the body's corner.
  const zoom = h("div", { class: "sc-plate-zoom", role: "group" }, zoomIn, zoomOut, zoomFit);
  const divider = h("div", { class: "sc-divider", role: "separator", tabindex: "0", "aria-label": L.resize, "aria-controls": id, "aria-valuemin": "25", "aria-valuemax": "75" });
  const el = h("aside", { class: "sc-plate", id, "aria-label": L.plate }, divider, h("div", { class: "sc-plate-head" }, title, back, next, switcher, full, close), body);

  // The charts: indexes by airport, fetched only while the panel is open and kept for its life (a failed fetch is none).
  const fetched = new Map<string, Promise<unknown>>();
  const indexes = new Map<string, ChartEntry[]>();
  const index = (a: string) => {
    if (!fetched.has(a)) fetched.set(a, fetch(c.url(`charts/${a}.json`)).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((x: ChartEntry[]) => indexes.set(a, x)));
    return fetched.get(a)!;
  };
  let refs: ProcedureRef[] = [];
  let airport: string | null = null;
  let picks: PlatePick[] = [];
  let shown: PlatePick | null = null;
  let page = 1;
  // The newest procedure shown in 3D, until the open panel (its index loaded) shows its chart.
  let want: ProcedureRef | null = null;
  const listed = (p: PlatePick | null) => picks.findIndex((q) => q.airport === p?.airport && q.entry === p.entry);

  // The image, placed by a CSS transform from the body's top left.
  let img: HTMLImageElement | null = null;
  let fit: PanZoom = { x: 0, y: 0, s: 1 };
  let t = fit;
  const place = (to: PanZoom) => {
    t = to;
    if (img) img.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.s})`;
  };
  const fitNow = () => {
    if (!img?.naturalWidth || !body.clientWidth || !body.clientHeight) return;
    place((fit = fitChart({ w: img.naturalWidth, h: img.naturalHeight }, { w: body.clientWidth, h: body.clientHeight })));
  };
  const zoomBy = (k: number, at: Pt) => place(zoomAbout(t, k, at, fit.s, 3));
  const pan = (dx: number, dy: number) => place({ ...t, x: t.x + dx, y: t.y + dy });

  const show = (p: PlatePick | null, n = 1) => {
    shown = p;
    page = n;
    pick.value = String(listed(p));
    const a = p && pageArrows(p.entry.pages.length, n);
    back.hidden = next.hidden = !a;
    if (a && p) {
      const of = p.entry.pages.length;
      back.disabled = !a.back;
      next.disabled = !a.next;
      back.setAttribute("aria-label", L.platePage(Math.max(1, n - 1), of));
      next.setAttribute("aria-label", L.platePage(Math.min(of, n + 1), of));
      // An arrow that just reached the end hands focus to the other.
      if (document.activeElement === next && !a.next) back.focus();
      if (document.activeElement === back && !a.back) next.focus();
    }
    if (!p) {
      img = null;
      return body.replaceChildren();
    }
    // Unfitted until it loads, so a chart that loads while the panel is closed is fitted as it reopens.
    t = fit = { x: 0, y: 0, s: 1 };
    const i = (img = h("img", { class: "sc-plate-img", draggable: "false", alt: p.entry.name }));
    i.addEventListener("load", () => i === img && fitNow());
    i.addEventListener("error", () => {
      if (i !== img) return;
      img = null;
      body.replaceChildren(h("p", { class: "sc-plate-missing" }, L.plateMissing));
    });
    i.src = c.url(`charts/${p.entry.pages[n - 1]}`);
    body.replaceChildren(i, zoom);
  };

  // Loads the indexes the picker needs, redraws it, and shows the wanted procedure's chart; with none, the chart
  // shown stays while the picker still lists it, else the first listed shows. The newest call wins.
  let ticket = 0;
  const sync = async () => {
    const mine = ++ticket;
    await Promise.all([...new Set([...refs.map((r) => r.airport), ...(airport === null ? [] : [airport])])].map(index));
    if (mine !== ticket || now === null) return;
    // The options stay put while the student browses them; they are rebuilt as focus leaves.
    if (focused) return void (stale = true);
    picks = pickOrder(indexes, refs, airport);
    pick.replaceChildren(...picks.map((p, i) => h("option", { value: String(i) }, p.airport === airport ? p.entry.name : `${p.airport} ${p.entry.name}`)));
    title.replaceChildren(picks.length ? pick : L.plate);
    const w = want && refs.some((r) => r.airport === want?.airport && r.name === want.name) ? want : null;
    want = null;
    const e = w && chartFor(indexes.get(w.airport) ?? [], w.name, shown?.airport === w.airport ? shown.entry : null);
    const p = w && e ? { airport: w.airport, entry: e } : null;
    if (p && listed(p) !== listed(shown)) show(p);
    else if (listed(shown) < 0) show(picks[0] ?? null);
    else pick.value = String(listed(shown));
  };
  // Arrow keys and typed letters on a closed picker change it at every step (Windows): each step shows its chart, and
  // the procedures draw in 3D once the student commits with Enter or Space or leaves the picker. A mouse or touch pick
  // draws at once.
  let focused = false;
  let stale = false;
  let browsing = false;
  let browsed: PlatePick | null = null;
  const commit = () => {
    browsing = false;
    const p = browsed;
    browsed = null;
    for (const r of p ? pickRefs(p) : []) on.show(r);
  };
  pick.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") commit();
    else if (e.key.length === 1 || /^(Arrow|Page|Home|End|Backspace)/.test(e.key)) browsing = true;
  });
  pick.addEventListener("pointerdown", commit);
  pick.addEventListener("focus", () => (focused = true));
  pick.addEventListener("blur", () => {
    focused = false;
    commit();
    if (stale) void sync();
    stale = false;
  });
  pick.addEventListener("change", () => {
    const p = picks[Number(pick.value)];
    want = null;
    show(p);
    if (browsing) browsed = p;
    else for (const r of pickRefs(p)) on.show(r);
  });
  back.addEventListener("click", () => shown && show(shown, page - 1));
  next.addEventListener("click", () => shown && show(shown, page + 1));

  // Pan and zoom: one pointer drags, two pinch (twoFingers: shape zooms and follows the fingers, tilt pans), the wheel
  // zooms about the cursor, a double tap or click fits.
  // shortcut: no pan limit, Fit brings the chart back; clamp if students lose it
  const at = (e: { clientX: number; clientY: number }): Pt => {
    const b = body.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  const down = new Map<number, Pt>();
  let two: ReturnType<typeof twoFingers> | null = null;
  let mid: Pt = [0, 0];
  let tap = { fingers: 0, moved: 0, start: 0, from: [0, 0] as Pt };
  let lastTap = -Infinity;
  const pair = () => [...down.values()].slice(0, 2) as [Pt, Pt];
  const middle = ([a, b]: [Pt, Pt]): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  body.addEventListener("pointerdown", (e) => {
    if (!img || e.button !== 0 || (e.target as Element).closest("button")) return;
    body.setPointerCapture(e.pointerId);
    if (!down.size) tap = { fingers: 0, moved: 0, start: e.timeStamp, from: at(e) };
    down.set(e.pointerId, at(e));
    tap.fingers = Math.max(tap.fingers, down.size);
    two = down.size === 2 ? twoFingers(...pair()) : null;
    if (two) mid = middle(pair());
  });
  body.addEventListener("pointermove", (e) => {
    const was = down.get(e.pointerId);
    if (!was) return;
    const p = at(e);
    down.set(e.pointerId, p);
    tap.moved = Math.max(tap.moved, Math.hypot(p[0] - tap.from[0], p[1] - tap.from[1]));
    if (down.size === 1) return pan(p[0] - was[0], p[1] - was[1]);
    const step = two?.(...pair());
    if (!step) return;
    const m = middle(pair());
    if (step.kind === "shape") place(zoomAbout({ ...t, x: t.x + m[0] - mid[0], y: t.y + m[1] - mid[1] }, step.zoom, m, fit.s, 3));
    else pan(0, step.dy);
    mid = m;
  });
  const up = (e: PointerEvent) => {
    if (!down.delete(e.pointerId)) return;
    two = down.size === 2 ? twoFingers(...pair()) : null;
    if (two) mid = middle(pair());
    if (down.size) return;
    const tapped = e.type === "pointerup" && isTap({ fingers: tap.fingers, moved: tap.moved, ms: e.timeStamp - tap.start }, c.a11y);
    if (tapped && tap.start - lastTap < 300) {
      fitNow();
      lastTap = -Infinity;
    } else lastTap = tapped ? e.timeStamp : -Infinity;
  };
  body.addEventListener("pointerup", up);
  body.addEventListener("pointercancel", up);
  body.addEventListener("wheel", (e) => {
    if (!img) return;
    e.preventDefault();
    zoomBy(Math.exp(-e.deltaY * 0.002), at(e));
  }, { passive: false });
  // Keys act only while the chart itself has focus, as the view's own arrows and plus and minus do.
  body.addEventListener("keydown", (e) => {
    const [w, ht] = [body.clientWidth, body.clientHeight];
    const act = ({
      ArrowLeft: () => pan(0.15 * w, 0),
      ArrowRight: () => pan(-0.15 * w, 0),
      ArrowUp: () => pan(0, 0.15 * ht),
      ArrowDown: () => pan(0, -0.15 * ht),
      "+": () => zoomBy(1.25, [w / 2, ht / 2]),
      "=": () => zoomBy(1.25, [w / 2, ht / 2]),
      "-": () => zoomBy(1 / 1.25, [w / 2, ht / 2]),
    } as Record<string, () => void>)[e.key];
    if (e.target !== body || !img || !act || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    act();
  });
  zoomIn.addEventListener("click", () => zoomBy(1.25, [body.clientWidth / 2, body.clientHeight / 2]));
  zoomOut.addEventListener("click", () => zoomBy(1 / 1.25, [body.clientWidth / 2, body.clientHeight / 2]));
  zoomFit.addEventListener("click", fitNow);
  // A chart left as fitted stays fitted as the panel resizes.
  const resized = new ResizeObserver(() => t === fit && fitNow());
  resized.observe(body);

  let now: PlateMode = null;
  const set = (mode: PlateMode) => {
    const opening = now === null && mode !== null;
    now = mode;
    fig.classList.toggle("sc-plate", mode !== null);
    fig.classList.toggle("sc-plate-full", mode === "full");
    full.setAttribute("aria-pressed", String(mode === "full"));
    for (const x of modes) x.b.setAttribute("aria-pressed", String(x.m === mode));
    full.setAttribute("aria-label", mode === "full" ? L.split : L.fullScreen);
    on.mode?.(mode);
    // Opening shows the newest procedure's chart, else the one shown before, else the first listed.
    if (opening) void sync();
  };
  const shut = () => {
    set(null);
    (on.back?.() ?? fig.querySelector<HTMLElement>(".view")!).focus();
  };
  full.addEventListener("click", () => set(now === "full" ? "split" : "full"));
  close.addEventListener("click", shut);
  for (const x of modes) x.b.addEventListener("click", () => (x.m === null ? shut() : set(x.m)));
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    shut();
  });
  set(null);

  // The divider (drag it, or arrow keys) sets the panel's share of the map's room: its width beside the map, its
  // height over it on an upright phone.
  const upright = matchMedia("(max-width: 860px) and (orientation: portrait)");
  const setShare = (x: number) => {
    const share = Math.min(0.75, Math.max(0.25, x));
    fig.style.setProperty("--sc-share", share.toFixed(3));
    divider.setAttribute("aria-valuenow", String(Math.round(share * 100)));
  };
  const drawUpright = () => divider.setAttribute("aria-orientation", upright.matches ? "horizontal" : "vertical");
  upright.addEventListener("change", drawUpright);
  drawUpright();
  setShare(0.38);
  const shareNow = () => Number(fig.style.getPropertyValue("--sc-share"));
  divider.addEventListener("pointerdown", (e) => {
    divider.setPointerCapture(e.pointerId);
    const box = fig.getBoundingClientRect();
    const { top, bottom } = upright.matches && on.room ? on.room() : box;
    const move = (m: PointerEvent) => setShare(upright.matches ? (m.clientY - top) / (bottom - top) : (box.right - m.clientX) / box.width);
    divider.addEventListener("pointermove", move);
    // Fires after pointerup and after a cancelled drag alike.
    divider.addEventListener("lostpointercapture", () => divider.removeEventListener("pointermove", move), { once: true });
  });
  divider.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: 0.05, ArrowRight: -0.05, ArrowUp: -0.05, ArrowDown: 0.05 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    setShare(shareNow() + step);
  });

  return {
    has: true,
    el,
    mode: () => now,
    set,
    procedures: (next, at) => {
      // Picking a chart adds its procedures last, so the last one new is the newest.
      want = [...next].reverse().find((r) => !refs.some((q) => q.airport === r.airport && q.name === r.name)) ?? want;
      refs = next;
      airport = at;
      if (now !== null) void sync();
    },
    destroy: () => {
      ticket++;
      set(null);
      resized.disconnect();
      upright.removeEventListener("change", drawUpright);
      fig.style.removeProperty("--sc-share");
      el.remove();
    },
  };
}

// Fit: corners drawn inward, unlike Full screen's.
const FIT = ["M1 4h3V1M8 1v3h3M11 8H8v3M4 11V8H1"];

/** A chart in the picker, with the airport whose index listed it (a shared arrival is one chart per airport). */
export type PlatePick = { airport: string; entry: ChartEntry };

/**
 * The picker's order: for each shown procedure in turn, the first chart of its airport that draws it, then every other
 * chart of the current airport in index (FAA) order. Each chart once; a procedure whose index is not loaded is skipped.
 */
export function pickOrder(indexes: Map<string, ChartEntry[]>, refs: ProcedureRef[], airport: string | null): PlatePick[] {
  const out: PlatePick[] = [];
  const put = (a: string, entry: ChartEntry | undefined) => {
    if (entry && !out.some((p) => p.airport === a && p.entry === entry)) out.push({ airport: a, entry });
  };
  for (const r of refs) put(r.airport, indexes.get(r.airport)?.find((x) => x.procedures.includes(r.name)));
  if (airport !== null) for (const x of indexes.get(airport) ?? []) put(airport, x);
  return out;
}

/** The chart for a shown procedure: the current one when it draws it, else the first that does. */
export function chartFor(entries: ChartEntry[], name: string, current: ChartEntry | null): ChartEntry | null {
  if (current?.procedures.includes(name)) return current;
  return entries.find((x) => x.procedures.includes(name)) ?? null;
}

/** Picking a chart shows the procedures it draws. */
export const pickRefs = (p: PlatePick): ProcedureRef[] => p.entry.procedures.map((name) => ({ airport: p.airport, name }));

/** The arrows for page `page` (from 1) of `pages`; none for a chart of one page. */
export function pageArrows(pages: number, page: number): { back: boolean; next: boolean } | null {
  return pages > 1 ? { back: page > 1, next: page < pages } : null;
}

/** The chart's place: CSS `translate(x px, y px) scale(s)`, origin top left. (`Fit` is taken by diagram.ts.) */
export type PanZoom = { x: number; y: number; s: number };

/** The whole chart in the box, centred. */
export function fitChart(img: { w: number; h: number }, box: { w: number; h: number }): PanZoom {
  const s = Math.min(box.w / img.w, box.h / img.h);
  return { x: (box.w - img.w * s) / 2, y: (box.h - img.h * s) / 2, s };
}

/** Zooms by `factor`, the scale clamped to min..max, keeping the chart point under `at` where it is. */
export function zoomAbout(t: PanZoom, factor: number, at: [x: number, y: number], min: number, max: number): PanZoom {
  const s = Math.min(max, Math.max(min, t.s * factor));
  const k = s / t.s;
  return { x: at[0] - (at[0] - t.x) * k, y: at[1] - (at[1] - t.y) * k, s };
}
