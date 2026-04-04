/**
 * Active cleanup: remove stale or legacy service workers before React mounts.
 * In Lovable preview we aggressively disable SW/cache to avoid stale UI.
 */
async function clearBrowserCaches() {
  if (!("caches" in window)) return;

  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    // console.log(`[SW Cleanup] Cleared caches: ${keys.length}`);
  } catch (err) {
    console.warn("[SW Cleanup] Failed to clear caches:", err);
  }
}

export async function cleanupLegacyServiceWorkers(options?: { aggressive?: boolean }) {
  if (!("serviceWorker" in navigator)) return;

  const aggressive = options?.aggressive === true;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const reg of registrations) {
      const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";

      const isLegacy =
        scriptURL.includes("push-sw.js") ||
        scriptURL.includes("firebase-messaging-sw") ||
        scriptURL.includes("OneSignal");

      if (aggressive || isLegacy) {
        const ok = await reg.unregister();
        // console.log(`[SW Cleanup] Unregistered SW: ${scriptURL || reg.scope} → ${ok}`);
      }
    }

    if (aggressive) {
      await clearBrowserCaches();
    }
  } catch (err) {
    console.warn("[SW Cleanup] Failed to clean service workers:", err);
  }
}

/**
 * Dev-only debug: logs every registered SW with full details.
 * Call from main.tsx in dev mode.
 */
export async function debugServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    // console.log("[SW Debug] serviceWorker not supported");
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.group("[SW Debug] All registrations:", registrations.length);

    for (const reg of registrations) {
      // console.log({
        scope: reg.scope,
        active: reg.active ? { scriptURL: reg.active.scriptURL, state: reg.active.state } : null,
        waiting: reg.waiting ? { scriptURL: reg.waiting.scriptURL, state: reg.waiting.state } : null,
        installing: reg.installing ? { scriptURL: reg.installing.scriptURL, state: reg.installing.state } : null,
      });
    }

    const controller = navigator.serviceWorker.controller;
    // console.log("[SW Debug] Current controller:", controller ? {
      scriptURL: controller.scriptURL,
      state: controller.state,
    } : "none (page not controlled)");

    console.groupEnd();
  } catch (err) {
    console.warn("[SW Debug] Error:", err);
  }
}
