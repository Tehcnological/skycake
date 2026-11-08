// SkyCake Viewer's service worker. scripts/app.mjs puts VERSION and SHELL (the app's own files) in front of this.
// The shell is cached per build; areas the person saved are in their own caches (app/main.ts). Every GET is answered
// from any cache first, then the network.
const SHELL_CACHE = `shell:${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
  // ?area= and ?scene= are the same page.
  e.respondWith(caches.match(e.request, { ignoreSearch: e.request.mode === "navigate" }).then((hit) => hit ?? fetch(e.request)));
});
