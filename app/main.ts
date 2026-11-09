// SkyCake Viewer, the standalone app. The start screen lists the areas, each with its offline download and the date its
// data is current through; ?area=phoenix opens one full screen (and ?scene={...} a first scene, as in the demo).
// Every on-screen word here is a placeholder for Chris's copy.
import { browserStorage, mount, store, stored } from "../src/index.js";

/** www/data/manifest.json, written by scripts/app.mjs. */
/** rev: a hash of every file, so any rebuild (charts every 56 days, procedures every 28) is a new revision. */
type AreaInfo = { edition: string; through: string; rev: string; bytes: number; files: string[] };
type Manifest = { areas: Record<string, AreaInfo> };

const TEXT = {
  title: "SkyCake Viewer",
  choose: "Choose an area",
  open: "Open area",
  names: { phoenix: "Phoenix", miami: "Miami" } as Record<string, string>,
  through: (d: string) => `Current through ${d}`,
  expired: (d: string) => `Out of date since ${d}`,
  download: (mb: number) => `Save ${mb} MB`,
  update: (mb: number) => `Update ${mb} MB`,
  saving: (pct: number) => `Saving ${pct}%`,
  saved: "Saved",
  failed: "Retry",
  notForNavigation: "Not for navigation",
  privacy: "Privacy",
  help: "How to use",
  a11y: "Placeholder: Accessibility mode",
  a11yNote: "Placeholder: Larger text and controls",
  a11yHelp: "Placeholder: Accessibility",
};

// Accessibility mode: the same switch as the map's own (skycake-a11y), so they agree; it also raises the start screen's
// contrast. Only the start screen sets data-a11y on the page: a map follows its own switch.
const storage = browserStorage();
const setA11y = (on: boolean) => document.documentElement.toggleAttribute("data-a11y", on);

const root = document.querySelector<HTMLElement>("#app")!;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch((e) => console.warn("skycake: offline unavailable", e));

const manifest: Manifest = await fetch("data/manifest.json").then((r) => r.json());
const params = new URLSearchParams(location.search);
const area = params.get("area");

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

async function startScreen() {
  setA11y(stored(storage));
  const today = new Date().toISOString().slice(0, 10);
  const keys = "caches" in window ? await caches.keys() : null;
  const h1 = el("h1", {}, el("img", { src: "icon-192.png", alt: "" }), TEXT.title);
  const list = el("ul");
  // One card per area: its name and date, Open area, and its offline copy's button.
  for (const [id, a] of Object.entries(manifest.areas)) {
    const old = a.through < today;
    const li = el("li", { className: old ? "old" : "" }, el("div", { className: "info" }, el("b", { textContent: TEXT.names[id] ?? id }), el("span", { textContent: note(a, today) })));
    const actions = el("div", { className: "actions" }, el("a", { className: "go", href: `?area=${encodeURIComponent(id)}`, textContent: TEXT.open }));
    // Without Cache Storage (an http page other than localhost) there is no offline copy to offer.
    if (keys) {
      const mb = Math.ceil(a.bytes / 1e6);
      const button = el("button", { type: "button" });
      const show = (state: "download" | "update" | "saving" | "saved" | "failed", pct = 0) => {
        button.dataset.state = state;
        button.textContent = { download: TEXT.download(mb), update: TEXT.update(mb), saving: TEXT.saving(pct), saved: TEXT.saved, failed: TEXT.failed }[state];
        button.disabled = state === "saving" || state === "saved";
      };
      show((await complete(keys, cacheOf(id, a))) ? "saved" : keys.some((k) => isArea(k, id)) ? "update" : "download");
      button.addEventListener("click", () => {
        show("saving");
        save(id, a, (share) => show("saving", Math.floor(share * 100))).then(() => show("saved"), (e) => {
          console.warn("skycake: save failed", e);
          show("failed");
        });
      });
      actions.append(button);
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
  const foot = el("p", {}, `${TEXT.notForNavigation} · `, el("a", { href: "help.html", textContent: TEXT.help }), " · ", el("a", { href: "privacy.html", textContent: TEXT.privacy }), " · ", el("a", { href: "accessibility.html", textContent: TEXT.a11yHelp }));
  root.replaceChildren(el("section", { className: "areas" }, h1, el("h2", { textContent: TEXT.choose }), list, row, foot));
}

if (area && Object.hasOwn(manifest.areas, area)) {
  let scene;
  try {
    scene = JSON.parse(params.get("scene") ?? "null") ?? undefined;
  } catch {
    console.warn("skycake: ignoring a scene that is not JSON");
  }
  // replace, so Back after Close doesn't reopen the map.
  const a = manifest.areas[area];
  const title = { name: TEXT.names[area] ?? area, note: note(a, new Date().toISOString().slice(0, 10)) };
  await mount(root, { base: `data/${area}/`, title, close: () => location.replace(location.pathname), ...(scene && { scene }) });
} else {
  await startScreen();
}
