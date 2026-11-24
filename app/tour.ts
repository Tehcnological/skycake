// skycake viewer's tutorial: a card that points at one control at a time.
// Anchors a flat popout card and spotlight ring directly to live free-roam UI controls (no walkthrough/quiz engine).

type Placement = "right" | "left" | "bottom" | "top" | "center";

type TourStep = {
  title: string;
  body: string;
  /** Live UI element to spotlight (desktop selector, phone selector fallback). */
  target?: (fig: HTMLElement) => HTMLElement | null;
  prefer?: Placement;
};

const visible = (el: HTMLElement | null): HTMLElement | null => {
  if (!el || el.hidden) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
};

const firstVisible = (fig: HTMLElement, selectors: string[]): HTMLElement | null => {
  for (const s of selectors) {
    const el = visible(fig.querySelector<HTMLElement>(s));
    if (el) return el;
  }
  return null;
};

const STEPS: TourStep[] = [
  {
    title: "explore FAA charts in 3D",
    body: "Drag to pan, right-drag (or use two fingers) to tilt and turn, and scroll or pinch to zoom. Tap any airspace shelf on the chart to raise or lower it.",
    prefer: "center",
  },
  {
    title: "raise airspace",
    body: "Open Airspace to toggle entire classes at once (Class B, C, D, E, Mode C, and special use) from their charted floors to ceilings.",
    target: (fig) => firstVisible(fig, [".sc-tl .sc-pill", ".sc-tabs .sc-tab:first-child"]),
    prefer: "right",
  },
  {
    title: "search airports and procedures",
    body: "Search any airport or instrument procedure, or click the box to browse airports. Picking an approach switches to IFR and draws its fixes and altitudes in 3D.",
    target: (fig) => firstVisible(fig, [".sc-tr .sc-search", ".sc-head .sc-find"]),
    prefer: "bottom",
  },
  {
    title: "FAA procedure plates",
    body: "Open Plate to view the FAA approach, arrival, or departure chart beside the 3D view. Switch between map, plate, and split, or drag the divider to resize.",
    target: (fig) => firstVisible(fig, [".sc-tr .sc-plate-open", ".sc-tabs .sc-tab:last-child"]),
    prefer: "bottom",
  },
  {
    title: "airport diagrams",
    body: "After picking an airport, toggle Diagram to drape its FAA runway diagram over the field and frame the runways. Clicking it before picking an airport opens the airport list.",
    target: (fig) => firstVisible(fig, [".sc-rail .sc-tool:first-child", ".sc-tabs .sc-tab:nth-child(4)"]),
    prefer: "left",
  },
  {
    title: "tags, height, rules, and chart",
    body: "Toggle chart tags, stretch heights to 4× so thin shelves stand apart, switch between VFR and IFR rules, and flip between TAC/sectional or IFR area/low charts.",
    target: (fig) => firstVisible(fig, [".sc-rail", ".sc-tabs .sc-tab:nth-child(5)"]),
    prefer: "left",
  },
  {
    title: "accessibility mode",
    body: "Raises contrast, enlarges controls and chart tags, pauses motion, adds an on-screen camera pad, and lists everything in view with numbered badges.",
    target: (fig) => firstVisible(fig, [".sc-br .sc-a11y-toggle", ".sc-head .sc-a11y-toggle"]),
    prefer: "left",
  },
  {
    title: "switch areas",
    body: "Select Close to return to the start screen, switch between Phoenix and Miami, or save areas offline. skycake is for learning, not for navigation.",
    target: (fig) => firstVisible(fig, [".sc-rail .sc-tool:last-child", ".sc-head .sc-area-close"]),
    prefer: "left",
  },
];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.append(...kids);
  return e;
};

/** Starts the tutorial over a mounted free roam view. */
export function startTour(fig: HTMLElement, onDone?: () => void): () => void {
  const shade = el("div", "tour-shade");
  const ring = el("div", "tour-ring");
  const arrow = el("span", "tour-arrow");
  arrow.setAttribute("aria-hidden", "true");

  const stepLabel = el("span", "tour-step");
  const skipBtn = el("button", "tour-skip", "skip");
  skipBtn.type = "button";
  const head = el("div", "tour-head", stepLabel, skipBtn);

  const heading = el("h2", "tour-title");
  const body = el("p", "tour-body");

  const backBtn = el("button", "tour-back", "back");
  backBtn.type = "button";
  const nextBtn = el("button", "tour-next", "next");
  nextBtn.type = "button";
  const foot = el("div", "tour-foot", backBtn, nextBtn);

  const pop = el("section", "tour-pop", arrow, head, heading, body, foot);
  pop.tabIndex = -1;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-modal", "true");
  pop.setAttribute("aria-label", "skycake tutorial");
  pop.setAttribute("aria-live", "polite");

  const root = el("div", "tour-layer", shade, ring, pop);
  document.body.append(root);

  let index = 0;
  let closed = false;

  const place = () => {
    if (closed) return;
    const step = STEPS[index];
    const target = step.target?.(fig) ?? null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 6;
    const gap = 14;
    const margin = 12;

    const pw = Math.min(336, vw - 2 * margin);
    pop.style.width = `${pw}px`;
    const ph = pop.offsetHeight || 180;

    if (!target) {
      shade.classList.add("on");
      ring.classList.remove("on");
      arrow.hidden = true;
      pop.dataset.side = "center";
      pop.style.left = `${Math.round((vw - pw) / 2)}px`;
      pop.style.top = `${Math.round(Math.max(margin, (vh - ph) / 2))}px`;
      return;
    }

    shade.classList.remove("on");
    const r = target.getBoundingClientRect();
    const rx = Math.max(2, r.left - pad);
    const ry = Math.max(2, r.top - pad);
    const rw = Math.min(vw - rx - 2, r.width + pad * 2);
    const rh = Math.min(vh - ry - 2, r.height + pad * 2);

    ring.style.left = `${Math.round(rx)}px`;
    ring.style.top = `${Math.round(ry)}px`;
    ring.style.width = `${Math.round(rw)}px`;
    ring.style.height = `${Math.round(rh)}px`;
    ring.classList.add("on");

    // Pick best placement that fits without clipping off screen.
    const fits: Record<Exclude<Placement, "center">, boolean> = {
      right: rx + rw + gap + pw + margin <= vw,
      left: rx - gap - pw - margin >= 0,
      bottom: ry + rh + gap + ph + margin <= vh,
      top: ry - gap - ph - margin >= 0,
    };
    const order: Exclude<Placement, "center">[] =
      step.prefer && step.prefer !== "center"
        ? [step.prefer, "bottom", "top", "left", "right"]
        : ["bottom", "top", "right", "left"];
    const side = order.find((s) => fits[s]) ?? "bottom";

    let left = 0;
    let top = 0;
    if (side === "right") {
      left = rx + rw + gap;
      top = ry + rh / 2 - ph / 2;
    } else if (side === "left") {
      left = rx - gap - pw;
      top = ry + rh / 2 - ph / 2;
    } else if (side === "bottom") {
      left = rx + rw / 2 - pw / 2;
      top = ry + rh + gap;
    } else {
      left = rx + rw / 2 - pw / 2;
      top = ry - gap - ph;
    }

    left = Math.max(margin, Math.min(vw - pw - margin, left));
    top = Math.max(margin, Math.min(vh - ph - margin, top));

    pop.dataset.side = side;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;

    // Position the directional arrow pointing straight at the target's center.
    arrow.hidden = false;
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    if (side === "left" || side === "right") {
      arrow.style.left = "";
      arrow.style.top = `${Math.round(Math.max(18, Math.min(ph - 18, cy - top)))}px`;
    } else {
      arrow.style.top = "";
      arrow.style.left = `${Math.round(Math.max(18, Math.min(pw - 18, cx - left)))}px`;
    }
  };

  const render = () => {
    const step = STEPS[index];
    stepLabel.textContent = `${index + 1} / ${STEPS.length}`;
    heading.textContent = step.title;
    body.textContent = step.body;
    backBtn.hidden = index === 0;
    nextBtn.textContent = index === STEPS.length - 1 ? "done" : "next";
    // Placed before it fades in, so the card does not jump.
    place();
    pop.classList.remove("pop-in");
    void pop.offsetWidth;
    pop.classList.add("pop-in");
  };

  const stop = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener("resize", place);
    window.removeEventListener("keydown", onKey);
    root.remove();
    onDone?.();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      stop();
    } else if (!pop.contains(e.target as Node)) {
      // Arrows elsewhere belong to the live map and its fields.
      return;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (index < STEPS.length - 1) {
        index++;
        render();
      } else {
        stop();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      index--;
      render();
    }
  };

  skipBtn.addEventListener("click", stop);
  backBtn.addEventListener("click", () => {
    if (index > 0) {
      index--;
      render();
    }
  });
  nextBtn.addEventListener("click", () => {
    if (index < STEPS.length - 1) {
      index++;
      render();
    } else {
      stop();
    }
  });

  window.addEventListener("resize", place);
  window.addEventListener("keydown", onKey);
  render();
  pop.focus({ preventScroll: true });
  return stop;
}
