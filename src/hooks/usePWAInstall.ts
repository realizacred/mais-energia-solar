import { useState, useEffect, useCallback } from "react";
import {
  getDeferredPrompt,
  clearDeferredPrompt,
  onPromptChange,
} from "@/lib/pwa-install-prompt";

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
  const [isInstalled, setIsInstalled] = useState(() => {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    );
  });

  const ua = navigator.userAgent.toLowerCase();
  const [isIOS] = useState(() => /iphone|ipad|ipod/.test(ua));
  const [isAndroid] = useState(() => /android/.test(ua));

  // Derive canInstall from the global singleton
  const [canInstall, setCanInstall] = useState(() => !!getDeferredPrompt());

  useEffect(() => {
    // Subscribe to changes from the global singleton
    const unsub = onPromptChange((e) => {
      setCanInstall(!!e);
      if (!e) setIsInstalled(true);
    });

    // Sync initial state (prompt may have arrived before mount)
    setCanInstall(!!getDeferredPrompt());

    return unsub;
  }, []);

  const promptInstall = useCallback(async () => {
    const prompt = getDeferredPrompt();
    if (!prompt) return false;

    savePWAReturnUrl();

    prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      setCanInstall(false);
      clearDeferredPrompt();
      return true;
    }

    return false;
  }, []);

  return {
    isInstalled,
    isIOS,
    isAndroid,
    canInstall,
    promptInstall,
  };
}
