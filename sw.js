// sw.js - the service worker.
// It saves a copy of the app's own files, so the app still opens with no signal.
// It always tries the internet first, so you never get stuck on an old version.

const cacheName = "hidden-history-v1";

const appFiles = [
  "./",
  "index.html",
  "style.css",
  "places.js",
  "finder.js",
  "script.js",
  "manifest.json",
  "lib/leaflet/leaflet.js",
  "lib/leaflet/leaflet.css",
  "fonts/marcellus.woff2",
  "fonts/atkinson-regular.woff2",
  "fonts/atkinson-bold.woff2",
  "icons/icon.svg",
  "icons/icon-192.png"
];

// When the app is first installed, save its files
self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(appFiles)));
});

// Every time the app asks for one of its own files:
// try the internet, and if that fails use the saved copy
self.addEventListener("fetch", event => {
  const isOwnFile = event.request.url.startsWith(self.location.origin);
  if (!isOwnFile || event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(cacheName).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
