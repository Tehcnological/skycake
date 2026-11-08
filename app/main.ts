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
  names: { phoenix: "Phoenix", miami: "Miami" } as Record<string, string>,
  through: (d: string) => `Current through ${d}`,
  expired: (d: string) => `Out of date since ${d}`,
  download: (mb: number) => `Save ${mb} MB`,
  update: (mb: number) => `Update ${mb} MB`,
  saving: "Saving",
  saved: "Saved",
  failed: "Retry",
  notForNavigation: "Not for navigation",
  privacy: "Privacy",
  a11y: "Placeholder: Accessibility mode",
  a11yHelp: "Placeholder: Accessibility",
};

// Accessibility mode: the same switch as the map's own (skycake-a11y), so they agree; it also raises the start screen's contrast.
const storage = browserStorage();
const setA11y = (on: boolean) => document.documentElement.toggleAttribute("data-a11y", on);
setA11y(stored(storage));

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

async function save(id: string, a: AreaInfo) {
  const name = cacheOf(id, a);
  try {
    const cache = await caches.open(name);
    // cache: "reload" tells the service worker to fetch, not to answer from the copy being replaced.
    await cache.addAll(a.files.map((f) => new Request(`data/${id}/${f}`, { cache: "reload" })));
    await cache.put(MARK, new Response(a.rev));
  } catch (e) {
    await caches.delete(name);
    throw e;
  }
  for (const k of await caches.keys()) if (isArea(k, id) && k !== name) await caches.delete(k);
  await navigator.storage?.persist?.();
}

async function startScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const keys = "caches" in window ? await caches.keys() : null;
  const icon = Object.assign(document.createElement("img"), { src: "icon.svg", alt: "" });
  const h1 = document.createElement("h1");
  h1.append(icon, TEXT.title);
  const list = document.createElement("ul");
  for (const [id, a] of Object.entries(manifest.areas)) {
    const li = document.createElement("li");
    const old = a.through < today;
    li.classList.toggle("old", old);
    const link = Object.assign(document.createElement("a"), { href: `?area=${encodeURIComponent(id)}` });
    link.append(Object.assign(document.createElement("b"), { textContent: TEXT.names[id] ?? id }), Object.assign(document.createElement("span"), { textContent: old ? TEXT.expired(a.through) : TEXT.through(a.through) }));
    li.append(link);
    // Without Cache Storage (an http page other than localhost) there is no offline copy to offer.
    if (keys) {
      const mb = Math.ceil(a.bytes / 1e6);
      const button = Object.assign(document.createElement("button"), { type: "button" });
      const show = (state: "download" | "update" | "saving" | "saved" | "failed") => {
        button.dataset.state = state;
        button.textContent = { download: TEXT.download(mb), update: TEXT.update(mb), saving: TEXT.saving, saved: TEXT.saved, failed: TEXT.failed }[state];
        button.disabled = state === "saving" || state === "saved";
      };
      show((await complete(keys, cacheOf(id, a))) ? "saved" : keys.some((k) => isArea(k, id)) ? "update" : "download");
      button.addEventListener("click", () => {
        show("saving");
        save(id, a).then(() => show("saved"), (e) => {
          console.warn("skycake: save failed", e);
          show("failed");
        });
      });
      li.append(button);
    }
    list.append(li);
  }
  const section = document.createElement("section");
  section.className = "areas";
  const box = Object.assign(document.createElement("input"), { type: "checkbox", checked: stored(storage) });
  box.setAttribute("role", "switch");
  box.addEventListener("change", () => {
    store(storage, box.checked);
    setA11y(box.checked);
  });
  const row = document.createElement("label");
  row.className = "a11y";
  row.append(Object.assign(document.createElement("span"), { textContent: TEXT.a11y }), box);
  const foot = Object.assign(document.createElement("p"), { textContent: `${TEXT.notForNavigation} · ` });
  foot.append(Object.assign(document.createElement("a"), { href: "privacy.html", textContent: TEXT.privacy }), " · ", Object.assign(document.createElement("a"), { href: "accessibility.html", textContent: TEXT.a11yHelp }));
  section.append(h1, list, row, foot);
  root.replaceChildren(section);
}

if (area && Object.hasOwn(manifest.areas, area)) {
  let scene;
  try {
    scene = JSON.parse(params.get("scene") ?? "null") ?? undefined;
  } catch {
    console.warn("skycake: ignoring a scene that is not JSON");
  }
  // replace, so Back after Close doesn't reopen the map.
  await mount(root, { base: `data/${area}/`, close: () => location.replace(location.pathname), ...(scene && { scene }) });
} else {
  await startScreen();
}
