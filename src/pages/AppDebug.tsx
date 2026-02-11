import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { BUILD_TIMESTAMP } from "@/lib/buildInfo";
import { loadPipelineDiag, type WaPipelineDiag } from "@/lib/waAutoMessage";

export default function AppDebug() {
  const [info, setInfo] = useState({
    displayMode: "browser",
    controllerStatus: "none",
    manifestUrl: "unknown",
    swState: "unknown",
    swScope: "unknown",
  });
  const [diag, setDiag] = useState<WaPipelineDiag | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const displayMode = isStandalone ? "standalone" : "browser";
      const controllerStatus = navigator.serviceWorker?.controller ? "active" : "none";
      const manifestLink = document.querySelector('link[rel="manifest"]');
      const manifestUrl = manifestLink?.getAttribute("href") || "not found";

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
    setDiag(loadPipelineDiag());
  }, []);

  const rows = [
    { label: "Display Mode", value: info.displayMode, ok: info.displayMode === "standalone" },
    { label: "SW Controller", value: info.controllerStatus, ok: info.controllerStatus === "active" },
    { label: "Manifest URL", value: info.manifestUrl, ok: info.manifestUrl.includes("manifest") },
    { label: "SW State", value: info.swState, ok: info.swState === "activated" },
    { label: "SW Scope", value: info.swScope, ok: true },
    { label: "Build", value: BUILD_TIMESTAMP, ok: true },
  ];

  const assignBadge = (result: WaPipelineDiag["assignResult"]) => {
    switch (result) {
      case "ok": return "soft-success";
      case "not_found": return "soft-warning";
      case "permission_denied": return "destructive";
      case "error": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-6">PWA Debug — /app</h1>

      {/* PWA Info */}
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

      {/* WA Pipeline Diagnostics */}
      <h2 className="text-lg font-semibold text-foreground mt-8 mb-4">Last Lead — WhatsApp Pipeline</h2>
      {diag ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/40">
            <span className="text-sm font-medium text-foreground">Phone</span>
            <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{diag.phone}</code>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/40">
            <span className="text-sm font-medium text-foreground">Message Sent</span>
            <div className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {diag.sentOk ? "yes" : diag.sentAt ? "failed" : "not attempted"}
              </code>
              <Badge variant={diag.sentOk ? "soft-success" : diag.sentAt ? "destructive" : "secondary"} size="sm">
                {diag.sentOk ? "OK" : diag.sentAt ? "❌" : "—"}
              </Badge>
            </div>
          </div>

          {diag.sentError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <span className="text-xs text-destructive">{diag.sentError}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/40">
            <span className="text-sm font-medium text-foreground">Assign Result</span>
            <div className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {diag.assignResult} ({diag.assignAttempts} tries)
              </code>
              <Badge variant={assignBadge(diag.assignResult)} size="sm">
                {diag.assignResult === "ok" ? "OK" : diag.assignResult === "pending" ? "⏳" : "⚠️"}
              </Badge>
            </div>
          </div>

          {diag.assignConvId && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/40">
              <span className="text-sm font-medium text-foreground">Conv ID</span>
              <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded truncate max-w-[200px]">{diag.assignConvId}</code>
            </div>
          )}

          {diag.assignError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <span className="text-xs text-destructive">{diag.assignError}</span>
            </div>
          )}

          {diag.sentAt && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/40">
              <span className="text-sm font-medium text-foreground">Timestamp</span>
              <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{diag.sentAt}</code>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
          Nenhum pipeline registrado nesta sessão. Cadastre um lead para ver o diagnóstico.
        </p>
      )}

      <p className="text-xs text-muted-foreground mt-6 text-center">
        Abra esta página dentro do PWA instalado para ver display-mode: standalone
      </p>
    </div>
  );
}
