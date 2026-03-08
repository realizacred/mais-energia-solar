/**
 * DEPRECATED — This file is kept only to cleanly unregister itself.
 * All push + caching logic now lives in the unified VitePWA service worker (sw.js).
 * When the browser fetches this file (from a previous registration), it will
 * unregister itself so the VitePWA SW takes over permanently.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      });
    })
  );
});
