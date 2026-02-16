import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { FEATURE_HINTS, type FeatureHint } from "@/config/features";

const STORAGE_KEY = "feature_discovery_seen";

/** Returns a map of featureId → version the user has already acknowledged */
function getSeenMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function persistSeen(map: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export interface ActiveBeacon {
  hint: FeatureHint;
  /** The live DOM element the beacon should attach to */
  element: HTMLElement;
}

/**
 * Scans the current page for elements matching unseen feature hints.
 * Returns the list of active beacons and a dismiss function.
 */
export function useFeatureDiscovery() {
  const { pathname } = useLocation();
  const [activeBeacons, setActiveBeacons] = useState<ActiveBeacon[]>([]);
  const [seen, setSeen] = useState<Record<string, number>>(getSeenMap);
  const scanRef = useRef<ReturnType<typeof setTimeout>>();

  // Filter hints relevant to the current route
  const routeHints = useMemo(
    () =>
      FEATURE_HINTS.filter((h) => {
        if (!h.routes || h.routes.length === 0) return true;
        return h.routes.some((r) => pathname.startsWith(r));
      }),
    [pathname]
  );

  // Scan DOM for matching elements
  const scan = useCallback(() => {
    const results: ActiveBeacon[] = [];
    for (const hint of routeHints) {
      const version = hint.version ?? 1;
      if ((seen[hint.id] ?? 0) >= version) continue; // already seen this version

      const el = document.querySelector<HTMLElement>(hint.selector);
      if (el) {
        results.push({ hint, element: el });
      }
    }
    setActiveBeacons(results);
  }, [routeHints, seen]);

  // Run scan on mount, route change, and after DOM settles
  useEffect(() => {
    // Immediate scan
    scan();
    // Deferred scan (components may mount async)
    scanRef.current = setTimeout(scan, 1500);
    return () => clearTimeout(scanRef.current);
  }, [scan]);

  // Re-scan when the DOM mutates (lazy — only observe body children)
  useEffect(() => {
    if (routeHints.length === 0) return;
    const observer = new MutationObserver(() => {
      clearTimeout(scanRef.current);
      scanRef.current = setTimeout(scan, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [routeHints, scan]);

  const dismiss = useCallback(
    (featureId: string) => {
      const hint = FEATURE_HINTS.find((h) => h.id === featureId);
      const version = hint?.version ?? 1;
      const next = { ...seen, [featureId]: version };
      setSeen(next);
      persistSeen(next);
      setActiveBeacons((prev) => prev.filter((b) => b.hint.id !== featureId));
    },
    [seen]
  );

  const dismissAll = useCallback(() => {
    const next = { ...seen };
    for (const b of activeBeacons) {
      next[b.hint.id] = b.hint.version ?? 1;
    }
    setSeen(next);
    persistSeen(next);
    setActiveBeacons([]);
  }, [seen, activeBeacons]);

  return { activeBeacons, dismiss, dismissAll };
}
