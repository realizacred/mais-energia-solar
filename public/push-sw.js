/**
 * Push Notification Service Worker
 * Handles push events and notification clicks with deep-linking.
 * This file lives in /public so it's served at the root scope.
 */

// Listen for push events from the server
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
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

  const options = {
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
    self.registration.showNotification(title, options).then(() => {
      // Update badge count if supported
      return updateBadge();
    })
  );
});

// Handle notification clicks — deep-link to the conversation
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/admin?tab=inbox";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window and navigate it
        for (const client of clientList) {
          if (client.url.includes("/admin") || client.url.includes("/vendedor")) {
            // Store conversation ID for the app to pick up
            if (event.notification.data?.conversationId) {
              // Post message to the client
              client.postMessage({
                type: "PUSH_NOTIFICATION_CLICK",
                conversationId: event.notification.data.conversationId,
              });
            }
            client.focus();
            return client.navigate(targetUrl);
          }
        }
        // No existing window — open a new one
        return clients.openWindow(targetUrl);
      })
      .then(() => updateBadge())
  );
});

// Handle notification close
self.addEventListener("notificationclose", () => {
  // Could track dismissals here if needed
});

// Badge management
async function updateBadge() {
  try {
    const notifications = await self.registration.getNotifications();
    const count = notifications.length;
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    }
  } catch {
    // Badge API not available
  }
}

// Listen for messages from the app (e.g., to clear badge)
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_BADGE") {
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
    // Close all notifications
    self.registration.getNotifications().then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }
});
