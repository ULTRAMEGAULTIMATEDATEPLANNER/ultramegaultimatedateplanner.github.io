// Offline support for the installed app.
// - The page and its config: network first (revalidated every time), so updates show up as soon as
//   you're online; the saved copy is used when offline.
// - Firebase SDK files (versioned URLs) and Google Fonts never change, so they're served from cache.
// - Everything else, including the Firestore connection, goes straight to the network.
const SHELL = "shell-v1";
const RUNTIME = "runtime-v1";
const SHELL_FILES = [
  "./", "./index.html", "./firebase-config.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const immutable = url =>
  (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) ||
  url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(async () =>
          (await caches.match(req, { ignoreSearch: true })) ||
          (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))
    );
    return;
  }

  if (immutable(url)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(RUNTIME).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
