/**
 * DEPRECATED — Legacy stub.
 * This file exists ONLY to cleanly unregister itself when a browser
 * that previously cached push-sw.js fetches it again.
 *
 * All push + caching logic lives in the unified VitePWA service worker (sw.js).
 * DO NOT add any logic here.
 */

// Skip waiting so activate fires immediately
self.addEventListener("install", function () {
  self.skipWaiting();
});

// On activate: unregister this worker and refresh all open tabs
self.addEventListener("activate", function (event) {
  event.waitUntil(
    self.registration.unregister().then(function () {
      return self.clients.matchAll({ type: "window" }).then(function (clients) {
        clients.forEach(function (client) {
          client.navigate(client.url);
        });
      });
    })
  );
});

// No-op fetch handler (required for some browsers to consider this a valid SW)
self.addEventListener("fetch", function () {
  // Intentionally empty — this SW should never serve requests
});
