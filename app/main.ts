// skycake viewer, the standalone app. The start screen lists the areas, each with its offline download and the date its
// data is current through; ?area=phoenix opens one full screen (and ?scene={...} a first scene, as in the demo).
// Every on-screen word here is a placeholder for Chris's copy.
import { browserStorage, mount, store, stored } from "../src/index.js";
import { startTour } from "./tour.js";

/** www/data/manifest.json, written by scripts/app.mjs. */
/** rev: a hash of every file, so any rebuild (charts every 56 days, procedures every 28) is a new revision. */
type AreaInfo = { edition: string; through: string; rev: string; bytes: number; files: string[] };
type Manifest = { areas: Record<string, AreaInfo> };

const TEXT = {
  title: "skycake viewer",
  choose: "choose an area",
  open: (name: string) => `open ${name}`,
  names: { atlanta: "atlanta", boston: "boston", chicago: "chicago", "dallas-fort-worth": "dallas-fort worth", denver: "denver", "grand-forks": "grand forks", houston: "houston", "las-vegas": "las vegas", "los-angeles": "los angeles", miami: "miami", "new-york": "new york", phoenix: "phoenix", "san-diego": "san diego", "san-francisco": "san francisco", seattle: "seattle", washington: "washington" } as Record<string, string>,
  through: (d: string) => `current through ${d}`,
  expired: (d: string) => `out of date since ${d}`,
  download: (mb: number) => `save offline · ${mb} MB`,
  update: (mb: number) => `update ${mb} MB`,
  saving: (pct: number) => `saving ${pct}%`,
  saved: "saved",
  failed: "retry download",
  notForNavigation: "not for navigation",
  tutorial: "take the tutorial",
  privacy: "privacy",
  help: "how to use",
  a11y: "accessibility mode",
  a11yNote: "larger text and controls",
  a11yHelp: "accessibility",
};

// Accessibility mode: the same switch as the map's own (skycake-a11y), so they agree; it also raises the start screen's
// contrast. Only the start screen sets data-a11y on the page: a map follows its own switch.
const storage = browserStorage();
const setA11y = (on: boolean) => document.documentElement.toggleAttribute("data-a11y", on);

const root = document.querySelector<HTMLElement>("#app")!;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch((e) => console.warn("skycake: offline unavailable", e));


const params = new URLSearchParams(location.search);
const area = params.get("area");
const tutorial = params.has("tutorial") && params.get("tutorial") !== "0";

// One Cache Storage cache per area and revision; the service worker answers from any of them. A cache counts as saved
// only once it holds the marker, written after every file arrived (another tab, or a closed page, can see it half done).
const cacheOf = (id: string, a: AreaInfo) => `data:${id}:${a.rev}`;
const isArea = (key: string, id: string) => key.startsWith(`data:${id}:`);
const MARK = "saved";
const complete = async (keys: string[], name: string) => keys.includes(name) && !!(await (await caches.open(name)).match(MARK));

/** progress: the share of the area's files saved so far, 0 to 1. */
async function save(id: string, a: AreaInfo, progress: (share: number) => void) {
  const name = cacheOf(id, a);
  try {
    const cache = await caches.open(name);
    // Six at a time, each counted as it lands. cache: "reload" tells the service worker to fetch, not to answer from
    // the copy being replaced.
    const queue = [...a.files];
    let done = 0, failed = false;
    await Promise.all(Array.from({ length: 6 }, async () => {
      for (let f = queue.shift(); f !== undefined && !failed; f = queue.shift()) {
        try {
          await cache.add(new Request(`data/${id}/${f}`, { cache: "reload" }));
        } catch (e) {
          failed = true; // the other workers stop, and stop reporting, so the button stays on Retry
          throw e;
        }
        if (!failed) progress(++done / a.files.length);
      }
    }));
    await cache.put(MARK, new Response(a.rev));
  } catch (e) {
    await caches.delete(name);
    throw e;
  }
  for (const k of await caches.keys()) if (isArea(k, id) && k !== name) await caches.delete(k);
  await navigator.storage?.persist?.();
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids);
  return e;
};
const note = (a: AreaInfo, today: string) => (a.through < today ? TEXT.expired(a.through) : TEXT.through(a.through));

async function startScreen(manifest: Manifest) {
  setA11y(stored(storage));
  const today = new Date().toISOString().slice(0, 10);
  const keys = "caches" in window ? await caches.keys() : null;
  const svgEl = (cls: string, vb: string, inner: string) => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("class", cls);
    s.setAttribute("viewBox", vb);
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = inner;
    return s;
  };
  const brandWord = el(
    "span",
    { className: "brand-word" },
    el(
      "span",
      { className: "bw-sky" },
      "sky",
      svgEl(
        "bw-plane",
        "0 0 46 26",
        `<path class="bw-trail" d="M2 16.5 C -1 22.5, 9 23.5, 22 14.5 C 28 10.5, 33 6.8, 37.5 3.8" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/><g transform="translate(39.8 2.6) rotate(-35) scale(0.46)"><path d="M9 0 L2.5 -1.4 L-2.8 -7.8 L-4.8 -7.8 L-1.8 -1.4 L-6.6 -1.1 L-8.6 -3.5 L-10 -3.5 L-8.7 0 L-10 3.5 L-8.6 3.5 L-6.6 1.1 L-1.8 1.4 L-4.8 7.8 L-2.8 7.8 L2.5 1.4 Z" fill="currentColor"/></g>`,
      ),
    ),
    el(
      "span",
      { className: "bw-c" },
      "c",
      svgEl(
        "bw-cake",
        "0 0 20 18",
        `<path d="M10.2 5.4 C10.4 3.2, 11.7 1.7, 13.7 1.2" fill="none" stroke="#d9454b" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="6.6" r="2.7" fill="#f05458"/><path d="M2.2 13.2 C2.8 9.9, 6.0 8.4, 10.2 8.4 C14.3 8.4, 17.2 9.8, 17.9 12.7 C16.9 13.4, 15.6 12.6, 14.6 12.1 C13.5 11.6, 12.7 12.8, 11.7 13.2 C10.6 13.6, 9.7 12.0, 8.6 12.2 C7.5 12.4, 7.0 15.0, 5.9 15.0 C4.9 15.0, 4.9 12.6, 3.8 12.7 C3.1 12.8, 2.5 13.6, 2.2 13.2 Z" fill="#ffffff"/>`,
      ),
    ),
    el("span", { className: "bw-ake" }, "ake"),
  );
  const brand = el("div", { className: "brand" }, brandWord, el("span", { className: "brand-sub", textContent: "viewer" }));
  const list = el("ul");
  // One card per area: its name and date, Open area, and its offline copy's button.
  for (const [id, a] of Object.entries(manifest.areas)) {
    const old = a.through < today;
    const li = el("li", { className: old ? "old" : "" }, el("div", { className: "info" }, el("b", { id: `name-${id}`, textContent: TEXT.names[id] ?? id }), el("span", { textContent: note(a, today) })));
    const go = el("a", { id: `go-${id}`, className: "go", href: `?area=${encodeURIComponent(id)}`, textContent: TEXT.open(TEXT.names[id] ?? id) });
    li.prepend(el("img", { className: "chart-preview", src: `preview-${encodeURIComponent(id)}.webp`, alt: "" }));
    const actions = el("div", { className: "actions" }, go);
    // Without Cache Storage (an http page other than localhost) there is no offline copy to offer.
    if (keys) {
      const mb = Math.ceil(a.bytes / 1e6);
      const button = el("button", { type: "button" });
      const removeBtn = el("button", { type: "button", className: "remove-offline", textContent: "×", title: "remove offline copy" });
      removeBtn.setAttribute("aria-label", `remove offline copy, ${TEXT.names[id] ?? id}`);
      const show = (state: "download" | "update" | "saving" | "saved" | "failed", pct = 0) => {
        button.dataset.state = state;
        button.textContent = { download: TEXT.download(mb), update: TEXT.update(mb), saving: TEXT.saving(pct), saved: TEXT.saved, failed: TEXT.failed }[state];
        button.setAttribute("aria-label", `${button.textContent}, ${TEXT.names[id] ?? id}`);
        button.disabled = state === "saving" || state === "saved";
        removeBtn.hidden = state !== "saved";
      };
      show((await complete(keys, cacheOf(id, a))) ? "saved" : keys.some((k) => isArea(k, id)) ? "update" : "download");
      button.addEventListener("click", () => {
        show("saving");
        save(id, a, (share) => show("saving", Math.floor(share * 100))).then(() => show("saved"), (e) => {
          console.warn("skycake: save failed", e);
          show("failed");
        });
      });
      removeBtn.addEventListener("click", async () => {
        for (const k of await caches.keys()) if (isArea(k, id)) await caches.delete(k);
        show("download");
        button.focus();
      });
      actions.append(button, removeBtn);
    }
    li.append(actions);
    list.append(li);
  }
  const box = el("input", { type: "checkbox", checked: stored(storage) });
  box.setAttribute("role", "switch");
  box.addEventListener("change", () => {
    store(storage, box.checked);
    setA11y(box.checked);
  });
  const row = el("label", { className: "a11y" }, el("span", {}, el("b", { textContent: TEXT.a11y }), el("small", { textContent: TEXT.a11yNote })), box);
  const headRow = el("div", { className: "head-row" }, el("h1", { textContent: TEXT.choose }), el("a", { className: "tutorial-link", href: "?tutorial=1", textContent: TEXT.tutorial }));
  const foot = el("p", {}, `${TEXT.notForNavigation} · `, el("a", { href: "help.html", textContent: TEXT.help }), " · ", el("a", { href: "privacy.html", textContent: TEXT.privacy }), " · ", el("a", { href: "accessibility.html", textContent: TEXT.a11yHelp }));
  root.replaceChildren(el("section", { className: "areas" }, brand, headRow, list.children.length ? list : el("p", { textContent: "No areas available." }), row, foot));
}

const status = document.querySelector<HTMLElement>("#load-status")!;
const statusText = status.querySelector("p")!;
const progress = status.querySelector("progress")!;
// The viewer's loading steps (skycake-loading events), in order, as the words under the spinner and the bar's value.
const STEPS: Record<string, [number, string]> = { terrain: [1, "loading terrain"], chart: [2, "loading charts"], airspace: [3, "building airspace"], prepare: [4, "preparing 3D view"] };
try {
  const response = await fetch("data/manifest.json");
  if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
  const manifest: Manifest = await response.json();
  const closeToHome = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    location.replace(new URL("./", location.href).href);
  };
  const chosenArea = area && Object.hasOwn(manifest.areas, area) ? area : tutorial && Object.hasOwn(manifest.areas, "phoenix") ? "phoenix" : null;
  if (chosenArea) {
    let scene;
    try {
      scene = JSON.parse(params.get("scene") ?? "null") ?? undefined;
    } catch {
      console.warn("skycake: ignoring a scene that is not JSON");
    }
    // replace, so Back after Close doesn't reopen the map.
    const a = manifest.areas[chosenArea];
    const title = { name: TEXT.names[chosenArea] ?? chosenArea, note: note(a, new Date().toISOString().slice(0, 10)) };
    statusText.textContent = tutorial ? "loading tutorial…" : `loading ${title.name}…`;
    progress.hidden = false;
    root.addEventListener("skycake-loading", (e) => {
      const [n, words] = STEPS[(e as CustomEvent).detail.step] ?? [];
      if (!n) return;
      progress.value = n;
      statusText.textContent = `${tutorial ? "tutorial" : title.name}: ${words}…`;
    });
    await mount(root, { base: `data/${chosenArea}/`, title, close: closeToHome, ...(scene && { scene }) });
    status.remove();
    if (tutorial) {
      const fig = root.querySelector<HTMLElement>(".skycake");
      if (fig) {
        startTour(fig, () => history.replaceState(null, "", `?area=${encodeURIComponent(chosenArea)}`));
      }
    }
  } else {
    await startScreen(manifest);
    status.remove();
  }
} catch (error) {
  console.warn("skycake: viewer unavailable", error);
  status.remove();
  const retry = el("button", { type: "button", textContent: "Try again" });
  retry.addEventListener("click", () => location.reload());
  const actions = el("div", { className: "actions" }, retry);
  if (area || tutorial) actions.append(el("a", { className: "go", href: "./", textContent: TEXT.choose }));
  root.replaceChildren(el("section", { className: "areas" }, el("h1", { textContent: area || tutorial ? "Chart unavailable" : "Areas unavailable" }), el("p", { className: "notice", role: "alert", textContent: "Check your connection and try again." }), actions));
}
