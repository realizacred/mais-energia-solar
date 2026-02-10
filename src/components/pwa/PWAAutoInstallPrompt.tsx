import { useEffect, useRef } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useAuth } from "@/hooks/useAuth";

const PWA_LOGIN_COUNT_KEY = "pwa-mobile-login-count";
const PWA_PROMPT_SHOWN_KEY = "pwa-auto-prompt-shown";

/**
 * Automatically triggers the native install prompt after the vendor's
 * second mobile login. Only fires once per device. Renders nothing.
 */
export function PWAAutoInstallPrompt() {
  const { user } = useAuth();
  const { canInstall, promptInstall, isInstalled } = usePWAInstall();
  const prompted = useRef(false);

  useEffect(() => {
    if (!user || isInstalled || prompted.current) return;

    // Only on mobile
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Throttle: don't show more than once per 7 days
    const lastShown = localStorage.getItem(PWA_PROMPT_SHOWN_KEY);
    if (lastShown) {
      const daysSince = (Date.now() - parseInt(lastShown, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    // Increment login count
    const count = parseInt(localStorage.getItem(PWA_LOGIN_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(PWA_LOGIN_COUNT_KEY, count.toString());

    if (count >= 2 && canInstall) {
      prompted.current = true;
      localStorage.setItem(PWA_PROMPT_SHOWN_KEY, Date.now().toString());

      // Small delay so the page is fully rendered before prompt
      const timer = setTimeout(() => {
        promptInstall();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [user, canInstall, isInstalled, promptInstall]);

  return null;
}
