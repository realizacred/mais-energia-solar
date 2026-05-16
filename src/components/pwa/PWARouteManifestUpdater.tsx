
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyRouteManifest } from "@/lib/pwa-route-manifest";

/**
 * Component that re-applies the PWA manifest and theme-color 
 * whenever the route changes. This ensures shortcuts and install 
 * behavior match the current shell.
 */
export function PWARouteManifestUpdater() {
  const location = useLocation();

  useEffect(() => {
    applyRouteManifest();
  }, [location.pathname]);

  return null;
}
