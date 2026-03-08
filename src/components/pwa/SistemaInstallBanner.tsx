import { useState, useEffect } from "react";
import { Download, X, Monitor, Share, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DISMISS_KEY = "sistema_install_dismissed_at";
const DISMISS_DAYS = 3;
const CAME_FROM_SISTEMA_KEY = "pwa-came-from-sistema";

/** Mark that user entered via /sistema so banner shows after redirect */
export function markCameFromSistema() {
  sessionStorage.setItem(CAME_FROM_SISTEMA_KEY, "1");
}

export function SistemaInstallBanner() {
  const { isInstalled, canInstall, promptInstall, isIOS, isAndroid } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    // Only show if user came from /sistema
    const cameFromSistema = sessionStorage.getItem(CAME_FROM_SISTEMA_KEY) === "1";

    console.log("[PWA Banner Sistema]", { isInstalled, canInstall, isIOS, isAndroid, isStandalone, cameFromSistema });

    if (isInstalled || isStandalone || !cameFromSistema) {
      setDismissed(true);
      return;
    }

    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const daysSince = (Date.now() - parseInt(raw, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) {
        setDismissed(true);
        return;
      }
    }

    setDismissed(false);
  }, [isInstalled, canInstall]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    sessionStorage.removeItem(CAME_FROM_SISTEMA_KEY);
    setDismissed(true);
  };

  const handleInstall = async () => {
    const ok = await promptInstall();
    if (ok) {
      localStorage.removeItem(DISMISS_KEY);
      sessionStorage.removeItem(CAME_FROM_SISTEMA_KEY);
      setDismissed(true);
    }
  };

  if (dismissed) return null;

  return (
    <div className="mx-3 mb-3 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center">
              <Monitor className="h-4 w-4 text-primary" />
            </div>
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-semibold text-foreground">
              Instale o App MaisEnergia 📲
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acesse o sistema direto da tela inicial do seu celular.
            </p>

            <div className="mt-2 space-y-2">
              {canInstall && (
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="h-7 text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Instalar
                </Button>
              )}
              {!canInstall && isIOS && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Share className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>
                  </span>
                </div>
              )}
              {!canInstall && isAndroid && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MoreVertical className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    No menu (<strong>⋮</strong>), toque em <strong>"Instalar app"</strong>
                  </span>
                </div>
              )}
              {!canInstall && !isIOS && !isAndroid && (
                <p className="text-xs text-muted-foreground">
                  No menu do navegador, toque em <strong>"Instalar app"</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
