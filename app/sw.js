// skycake viewer's service worker. scripts/app.mjs puts VERSION and SHELL (the app's own files) in front of this.
// The shell is cached per build; areas the person saved are in their own caches (app/main.ts). Every GET is answered
// from any cache first, then the network.
const SHELL_CACHE = `shell:${VERSION}`;

// One shell file into the cache. Cloudflare Pages answers help.html with a redirect to /help, and a redirected
// response cannot answer a navigation, so such a page is stored as a plain copy under both addresses.
async function keep(cache, url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  if (!r.redirected) return cache.put(url, r);
  const body = await r.blob();
  const copy = () => new Response(body, { status: r.status, statusText: r.statusText, headers: r.headers });
  await Promise.all([cache.put(url, copy()), cache.put(r.url, copy())]);
}

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => Promise.all(SHELL.map((url) => keep(c, url)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("shell:") && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  // A save asks for fresh copies with cache: "reload"; those go to the network.
  if (e.request.method !== "GET" || e.request.cache === "reload") return;
  const path = new URL(e.request.url).pathname;
  // Area data (charts, terrain, procedures, plates): cache-first so saved offline copies load instantly without network.
  // manifest.json stays network-first so new FAA data cycles appear right away when online.
  if (path.includes("/data/") && !path.endsWith("/data/manifest.json") && e.request.mode !== "navigate") {
    e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
    return;
  }
  // Shell (HTML navigations, JS, CSS): prefer fresh online deploys, falling back quickly to cache if offline or stalled.
  e.respondWith((async () => {
    const cached = await caches.match(e.request, { ignoreSearch: e.request.mode === "navigate" });
    const net = fetch(e.request).then((r) => (r.ok ? r : cached ?? r));
    if (!cached) return net;
    return Promise.race([
      net.catch(() => cached),
      new Promise((done) => setTimeout(() => done(cached), 2000)),
    ]);
  })());
});
