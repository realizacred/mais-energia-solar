import { useState, useEffect } from "react";
import { Download, X, Wrench, Share, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DISMISS_KEY = "instalador_install_dismissed_at";
const DISMISS_DAYS = 7;

/**
 * Install prompt banner for the Instalador PWA.
 * Shows platform-appropriate install instructions inline.
 */
export function InstaladorInstallBanner() {
  const { isInstalled, canInstall, promptInstall, isIOS, isAndroid } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isInstalled) {
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
  }, [isInstalled]);

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
    <div className="mx-4 mb-4 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-10 w-10 rounded-full bg-warning/15 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-warning" />
            </div>
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-semibold text-foreground">
              Instale o App do Instalador 📲
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Acesse seus serviços e checklists direto da tela inicial,
              mesmo sem internet.
            </p>

            <div className="mt-3">
              {canInstall ? (
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="h-8 text-xs bg-warning hover:bg-warning/90 text-warning-foreground"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Instalar App
                </Button>
              ) : isIOS ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Share className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Toque em <strong>Compartilhar</strong> →{" "}
                    <strong>Adicionar à Tela de Início</strong>
                  </span>
                </div>
              ) : isAndroid ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MoreVertical className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    No menu, toque em <strong>"Instalar app"</strong>
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No menu do navegador, toque em{" "}
                  <strong>"Instalar app"</strong> ou{" "}
                  <strong>"Adicionar à tela inicial"</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
