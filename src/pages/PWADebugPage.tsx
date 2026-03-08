import { useState, useEffect } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { getDeferredPrompt } from "@/lib/pwa-install-prompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw } from "lucide-react";

interface SWInfo {
  scope: string;
  scriptURL: string;
  state: string;
}

export default function PWADebugPage() {
  const { isInstalled, canInstall, promptInstall, isIOS, isAndroid } = usePWAInstall();
  const [swList, setSWList] = useState<SWInfo[]>([]);
  const [controller, setController] = useState<string>("checking...");
  const [manifestUrl, setManifestUrl] = useState<string>("checking...");
  const [displayMode, setDisplayMode] = useState<string>("checking...");
  const [promptStatus, setPromptStatus] = useState<string>("checking...");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Display mode
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setDisplayMode(isStandalone ? "standalone ✅" : "browser (não instalado)");

    // Manifest
    const link = document.querySelector('link[rel="manifest"]');
    setManifestUrl(link?.getAttribute("href") || "❌ NÃO ENCONTRADO");

    // Prompt
    const prompt = getDeferredPrompt();
    if (prompt) {
      setPromptStatus("✅ Capturado — pronto para instalar");
    } else if (isStandalone) {
      setPromptStatus("N/A — já está instalado");
    } else {
      setPromptStatus("❌ Não capturado — fallback manual");
    }

    // Service Workers
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        setSWList(
          regs.map((r) => ({
            scope: r.scope,
            scriptURL: r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "unknown",
            state: r.active?.state || r.installing?.state || r.waiting?.state || "unknown",
          }))
        );
      });

      const ctrl = navigator.serviceWorker.controller;
      setController(ctrl ? `${ctrl.scriptURL} (${ctrl.state})` : "Nenhum controller ativo");
    } else {
      setController("SW não suportado");
    }
  }, [refreshKey]);

  const rows = [
    { label: "Display Mode", value: displayMode, ok: displayMode.includes("standalone") },
    { label: "beforeinstallprompt", value: promptStatus, ok: promptStatus.includes("✅") || promptStatus.includes("N/A") },
    { label: "canInstall (hook)", value: canInstall ? "✅ Sim" : "❌ Não", ok: canInstall },
    { label: "isInstalled (hook)", value: isInstalled ? "✅ Sim" : "❌ Não", ok: isInstalled || !displayMode.includes("standalone") },
    { label: "Plataforma", value: isIOS ? "iOS" : isAndroid ? "Android" : "Desktop/Outro", ok: true },
    { label: "Manifest URL", value: manifestUrl, ok: manifestUrl.includes("manifest") },
    { label: "SW Controller", value: controller, ok: !controller.includes("Nenhum") && !controller.includes("não suportado") },
  ];

  const installMode = isInstalled
    ? "INSTALADO"
    : canInstall
    ? "PROMPT NATIVO DISPONÍVEL"
    : isIOS
    ? "FALLBACK MANUAL (iOS)"
    : isAndroid
    ? "FALLBACK MANUAL (Android)"
    : "FALLBACK MANUAL (Desktop)";

  const installColor = isInstalled
    ? "bg-success/15 text-success border-success/30"
    : canInstall
    ? "bg-primary/15 text-primary border-primary/30"
    : "bg-warning/15 text-warning border-warning/30";

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">PWA Debug</h1>
        <Button variant="ghost" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Status badge */}
      <div className={`rounded-xl border p-4 text-center ${installColor}`}>
        <p className="text-xs font-bold uppercase tracking-wider mb-1">Modo de Instalação</p>
        <p className="text-lg font-black">{installMode}</p>
      </div>

      {/* Install button (real test) */}
      {canInstall && (
        <Button className="w-full gap-2" onClick={promptInstall}>
          <Download className="h-4 w-4" />
          Testar Instalação Nativa
        </Button>
      )}

      {/* Diagnostic rows */}
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-start justify-between gap-2 p-3 rounded-lg bg-card border border-border/40"
          >
            <span className="text-xs font-semibold text-foreground shrink-0">{r.label}</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded break-all text-right">
                {r.value}
              </code>
              <Badge variant={r.ok ? "soft-success" : "soft-warning"} size="sm" className="shrink-0">
                {r.ok ? "OK" : "⚠️"}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Service Workers */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-2">Service Workers Registrados</h2>
        {swList.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">Nenhum SW registrado</p>
        ) : (
          <div className="space-y-2">
            {swList.map((sw, i) => (
              <div key={i} className="p-3 rounded-lg bg-card border border-border/40 space-y-1">
                <div className="flex justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">Scope</span>
                  <code className="text-[10px] text-foreground">{sw.scope}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">Script</span>
                  <code className="text-[10px] text-foreground break-all text-right">{sw.scriptURL}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">State</span>
                  <Badge variant={sw.state === "activated" ? "soft-success" : "soft-warning"} size="sm">
                    {sw.state}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        UA: {navigator.userAgent.slice(0, 80)}…
      </p>
    </div>
  );
}
