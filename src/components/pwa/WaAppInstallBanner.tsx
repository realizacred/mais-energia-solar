import { useState, useEffect } from "react";
import { Download, X, MessageCircle, Share, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DISMISS_KEY = "wa_app_install_dismissed_at";
const DISMISS_DAYS = 3;

/**
 * Install prompt banner for the WhatsApp Messaging PWA (/app).
 */
export function WaAppInstallBanner() {
  const { isInstalled, canInstall, promptInstall, isIOS, isAndroid } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    console.log("[PWA Banner WA]", { isInstalled, canInstall, isIOS, isAndroid, isStandalone });

    if (isInstalled || isStandalone) {
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
    setDismissed(true);
  };

  const handleInstall = async () => {
    const ok = await promptInstall();
    if (ok) {
      localStorage.removeItem(DISMISS_KEY);
      setDismissed(true);
    }
  };

  if (dismissed) return null;

  return (
    <div className="shrink-0 mx-3 mt-2 animate-in slide-in-from-top-4 fade-in duration-300 select-none touch-action-manipulation">
      <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-3 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-9 w-9 rounded-full bg-success/15 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-success" />
            </div>
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-semibold text-foreground">
              Instale o App de Mensagens 📲
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acesse suas conversas direto da tela inicial.
            </p>

            <div className="mt-2 space-y-2">
              {canInstall && (
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="h-7 text-xs bg-success hover:bg-success/90 text-white"
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
                    No menu (<strong>⋮</strong>), toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong>
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
