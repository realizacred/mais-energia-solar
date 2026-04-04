/**
 * Global singleton to capture the beforeinstallprompt event EARLY,
 * before any React component mounts. This prevents the race condition
 * where the event fires before usePWAInstall's useEffect runs.
 *
 * Import and call `initPWAPromptCapture()` in main.tsx BEFORE createRoot().
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

export function initPWAPromptCapture() {
  // console.log("[PWA] initPWAPromptCapture registered");

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    // console.log("[PWA] beforeinstallprompt captured ✅", { listenerCount: listeners.size });
    listeners.forEach((fn) => fn(deferredPrompt));
  });

  window.addEventListener("appinstalled", () => {
    // console.log("[PWA] appinstalled event fired");
    deferredPrompt = null;
    listeners.forEach((fn) => fn(null));
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function clearDeferredPrompt() {
  deferredPrompt = null;
}

export function onPromptChange(fn: (e: BeforeInstallPromptEvent | null) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
