// Offline support for the installed app.
// - The page and its config: network first (revalidated every time), so updates show up as soon as
//   you're online; the saved copy is used when offline. Each file is stored once, whatever query
//   string it was opened with, and the page itself is always stored as index.html, so an offline
//   launch always gets the newest copy and ?club= or tracking links don't pile up old ones.
// - Firebase SDK files (versioned URLs) and the Google Fonts stylesheet and files: cache first,
//   and only successful responses are ever stored.
// - Everything else, including the Firestore connection, goes straight to the network.
const SHELL = "shell-v2";
const RUNTIME = "runtime-v2";
const PAGE = new URL("./index.html", self.registration.scope).href;
const SHELL_FILES = [
  "./index.html", "./firebase-config.js", "./manifest.webmanifest",
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

// One cache entry per file: the page under index.html, everything else under its path alone.
function shellKey(req, url) {
  if (req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("/index.html")) return PAGE;
  return url.origin + url.pathname;
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const key = shellKey(req, url);
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then(res => {
          if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(SHELL).then(c => c.put(key, copy)); }
          return res;
        })
        .catch(async () => (await caches.match(key)) || (req.mode === "navigate" ? caches.match(PAGE) : Response.error()))
    );
    return;
  }

  if (immutable(url)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
