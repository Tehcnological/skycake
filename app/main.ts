// SkyCake Viewer, the standalone app. The start screen lists the areas, each with its offline download and the date its
// data is current through; ?area=phoenix opens one full screen (and ?scene={...} a first scene, as in the demo).
// Every on-screen word here is a placeholder for Chris's copy.
import { mount } from "../src/index.js";

/** www/data/manifest.json, written by scripts/app.mjs. */
type AreaInfo = { edition: string; through: string; bytes: number; files: string[] };
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
};

const root = document.querySelector<HTMLElement>("#app")!;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch((e) => console.warn("skycake: offline unavailable", e));

const manifest: Manifest = await fetch("data/manifest.json").then((r) => r.json());
const params = new URLSearchParams(location.search);
const area = params.get("area");

// One Cache Storage cache per area and edition; the service worker answers from any of them.
const cacheOf = (id: string, a: AreaInfo) => `data:${id}:${a.edition}`;
const isArea = (key: string, id: string) => key.startsWith(`data:${id}:`);

async function save(id: string, a: AreaInfo) {
  const name = cacheOf(id, a);
  try {
    await (await caches.open(name)).addAll(a.files.map((f) => `data/${id}/${f}`));
  } catch (e) {
    await caches.delete(name); // a half-saved area must not read as saved
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
      show(keys.includes(cacheOf(id, a)) ? "saved" : keys.some((k) => isArea(k, id)) ? "update" : "download");
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
  section.append(h1, list, Object.assign(document.createElement("p"), { textContent: TEXT.notForNavigation }));
  root.replaceChildren(section);
}

if (area && Object.hasOwn(manifest.areas, area)) {
  let scene;
  try {
    scene = JSON.parse(params.get("scene") ?? "null") ?? undefined;
  } catch {
    console.warn("skycake: ignoring a scene that is not JSON");
  }
  await mount(root, { base: `data/${area}/`, close: () => location.assign(location.pathname), ...(scene && { scene }) });
} else {
  await startScreen();
}
