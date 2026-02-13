import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Share, MoreVertical, Smartphone } from "lucide-react";
import { usePWAInstall, savePWAReturnUrl } from "@/hooks/usePWAInstall";

interface InstallAppBannerProps {
  vendedorNome?: string | null;
}

const DISMISS_KEY = "pwa-banner-dismissed";
const DISMISS_HOURS = 24;

export function InstallAppBanner({ vendedorNome }: InstallAppBannerProps) {
  const { isInstalled, isIOS, isAndroid, canInstall, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return false;
    const ts = parseInt(dismissed, 10);
    if (Date.now() - ts > DISMISS_HOURS * 60 * 60 * 1000) {
      localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    return true;
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  const handleInstallClick = async () => {
    savePWAReturnUrl();
    if (canInstall) {
      const ok = await promptInstall();
      if (ok) handleDismiss();
    }
  };

  // Don't show if installed or dismissed
  if (isInstalled || isDismissed) return null;

  // iOS: show inline A2HS instructions (no fake "Instalar" button)
  if (isIOS) {
    return (
      <Card className="mx-4 mt-4 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Adicione à Tela Inicial 📲
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <span>Toque em</span>
                <Share className="w-3.5 h-3.5 flex-shrink-0" />
                <span><strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong></span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Android/Desktop with native install available
  if (canInstall) {
    return (
      <Card className="mx-4 mt-4 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                Instale o App {vendedorNome ? `de ${vendedorNome}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Acesso rápido e funciona offline
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button size="sm" onClick={handleInstallClick} className="gap-1.5">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Instalar</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDismiss}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Android without native prompt: show manual instructions
  if (isAndroid) {
    return (
      <Card className="mx-4 mt-4 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Instale o App 📲
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <span>No menu</span>
                <MoreVertical className="w-3.5 h-3.5 flex-shrink-0" />
                <span>toque em <strong>"Instalar app"</strong></span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Desktop without native prompt: don't show banner
  return null;
}
