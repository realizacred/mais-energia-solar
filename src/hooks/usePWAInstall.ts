import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PWA_RETURN_URL_KEY = "pwa-return-url";

/** Save current path so PWA opens on the right page after install */
export function savePWAReturnUrl() {
  const path = window.location.pathname + window.location.search;
  if (path && path !== "/" && path !== "/instalar") {
    localStorage.setItem(PWA_RETURN_URL_KEY, path);
  }
}

/** Get and clear saved return URL (used once on standalone launch) */
export function consumePWAReturnUrl(): string | null {
  const url = localStorage.getItem(PWA_RETURN_URL_KEY);
  if (url) {
    localStorage.removeItem(PWA_RETURN_URL_KEY);
  }
  return url;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    return window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
  });
  const ua = navigator.userAgent.toLowerCase();
  const [isIOS] = useState(() => /iphone|ipad|ipod/.test(ua));
  const [isAndroid] = useState(() => /android/.test(ua));
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setCanInstall(false);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    // Save current URL before triggering install
    savePWAReturnUrl();

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setCanInstall(false);
      return true;
    }
    
    return false;
  }, [deferredPrompt]);

  return {
    isInstalled,
    isIOS,
    isAndroid,
    canInstall,
    promptInstall,
  };
}
