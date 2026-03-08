/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { createHandlerBoundToURL } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope;

// ─── Workbox core ───────────────────────────────────────────
self.skipWaiting();
clientsClaim();

// Precache all assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navigation fallback (SPA)
const denylist = [/^\/api/, /^\/~oauth/];
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist }));

// Runtime cache: Supabase storage
registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
  new CacheFirst({
    cacheName: "supabase-storage-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Runtime cache: images
registerRoute(
  /\.(png|jpg|jpeg|svg|gif|webp)$/i,
  new CacheFirst({
    cacheName: "image-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// ─── Push Notification Handlers ─────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: any;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Nova mensagem", body: event.data.text() };
  }

  const {
    title = "Nova mensagem no WhatsApp",
    body = "",
    icon = "/pwa-icon-192.png",
    badge = "/pwa-icon-192.png",
    tag,
    conversationId,
    contactName,
    instanceId,
  } = payload;

  const notificationTag = tag || `wa-push-${conversationId || Date.now()}`;

  const options: NotificationOptions = {
    body,
    icon,
    badge,
    tag: notificationTag,
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      conversationId,
      contactName,
      instanceId,
      url: conversationId
        ? `/admin?tab=inbox&conversation=${conversationId}`
        : "/admin?tab=inbox",
    },
    actions: [
      { action: "open", title: "Abrir conversa" },
      { action: "dismiss", title: "Dispensar" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => updateBadge())
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/admin?tab=inbox";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/admin") || client.url.includes("/vendedor")) {
            if (event.notification.data?.conversationId) {
              client.postMessage({
                type: "PUSH_NOTIFICATION_CLICK",
                conversationId: event.notification.data.conversationId,
              });
            }
            client.focus();
            return (client as WindowClient).navigate(targetUrl);
          }
        }
        return self.clients.openWindow(targetUrl);
      })
      .then(() => updateBadge())
  );
});

self.addEventListener("notificationclose", () => {
  // Could track dismissals here
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_BADGE") {
    if ("clearAppBadge" in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
    self.registration.getNotifications().then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }
});

async function updateBadge() {
  try {
    const notifications = await self.registration.getNotifications();
    const count = notifications.length;
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        await (navigator as any).setAppBadge(count);
      } else {
        await (navigator as any).clearAppBadge();
      }
    }
  } catch {
    // Badge API not available
  }
}
