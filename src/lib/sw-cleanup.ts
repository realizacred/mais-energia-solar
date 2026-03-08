/**
 * Active cleanup: remove any legacy service workers (e.g. push-sw.js)
 * before the VitePWA service worker takes control.
 *
 * Run this ONCE in main.tsx before React mounts.
 */
export async function cleanupLegacyServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const reg of registrations) {
      const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";

      // Unregister anything that is NOT the VitePWA worker (sw.js)
      const isLegacy =
        scriptURL.includes("push-sw.js") ||
        scriptURL.includes("firebase-messaging-sw") ||
        scriptURL.includes("OneSignal");

      if (isLegacy) {
        const ok = await reg.unregister();
        console.log(`[SW Cleanup] Unregistered legacy SW: ${scriptURL} → ${ok}`);
      }
    }
  } catch (err) {
    console.warn("[SW Cleanup] Failed to clean legacy SWs:", err);
  }
}

/**
 * Dev-only debug: logs every registered SW with full details.
 * Call from main.tsx in dev mode.
 */
export async function debugServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    console.log("[SW Debug] serviceWorker not supported");
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.group("[SW Debug] All registrations:", registrations.length);

    for (const reg of registrations) {
      console.log({
        scope: reg.scope,
        active: reg.active ? { scriptURL: reg.active.scriptURL, state: reg.active.state } : null,
        waiting: reg.waiting ? { scriptURL: reg.waiting.scriptURL, state: reg.waiting.state } : null,
        installing: reg.installing ? { scriptURL: reg.installing.scriptURL, state: reg.installing.state } : null,
      });
    }

    const controller = navigator.serviceWorker.controller;
    console.log("[SW Debug] Current controller:", controller ? {
      scriptURL: controller.scriptURL,
      state: controller.state,
    } : "none (page not controlled)");

    console.groupEnd();
  } catch (err) {
    console.warn("[SW Debug] Error:", err);
  }
}
