import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export default function AppDebug() {
  const [info, setInfo] = useState({
    displayMode: "browser",
    controllerStatus: "none",
    manifestUrl: "unknown",
    swState: "unknown",
    swScope: "unknown",
  });

  useEffect(() => {
    const checkStatus = async () => {
      // Display mode
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const displayMode = isStandalone ? "standalone" : "browser";

      // Controller
      const controllerStatus = navigator.serviceWorker?.controller
        ? "active"
        : "none";

      // Manifest
      const manifestLink = document.querySelector('link[rel="manifest"]');
      const manifestUrl = manifestLink?.getAttribute("href") || "not found";

      // SW registration
      let swState = "not registered";
      let swScope = "n/a";
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) {
          swState = reg.active?.state || reg.installing?.state || reg.waiting?.state || "unknown";
          swScope = reg.scope;
        }
      } catch {
        swState = "error checking";
      }

      setInfo({ displayMode, controllerStatus, manifestUrl, swState, swScope });
    };

    checkStatus();
  }, []);

  const rows = [
    { label: "Display Mode", value: info.displayMode, ok: info.displayMode === "standalone" },
    { label: "SW Controller", value: info.controllerStatus, ok: info.controllerStatus === "active" },
    { label: "Manifest URL", value: info.manifestUrl, ok: info.manifestUrl.includes("manifest") },
    { label: "SW State", value: info.swState, ok: info.swState === "activated" },
    { label: "SW Scope", value: info.swScope, ok: true },
  ];

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-6">PWA Debug — /app</h1>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/40">
            <span className="text-sm font-medium text-foreground">{r.label}</span>
            <div className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{r.value}</code>
              <Badge variant={r.ok ? "soft-success" : "soft-warning"} size="sm">
                {r.ok ? "OK" : "⚠️"}
              </Badge>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-6 text-center">
        Abra esta página dentro do PWA instalado para ver display-mode: standalone
      </p>
    </div>
  );
}
