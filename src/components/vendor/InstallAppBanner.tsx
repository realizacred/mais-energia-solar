import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Share, MoreVertical, Smartphone } from "lucide-react";
import { usePWAInstall, savePWAReturnUrl } from "@/hooks/usePWAInstall";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InstallAppBannerProps {
  vendedorNome?: string | null;
}

export function InstallAppBanner({ vendedorNome }: InstallAppBannerProps) {
  const { isInstalled, isIOS, isAndroid, canInstall, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(() => {
    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (!dismissed) return false;
    // Reset after 24h so it shows again
    const ts = parseInt(dismissed, 10);
    if (Date.now() - ts > 24 * 60 * 60 * 1000) {
      localStorage.removeItem("pwa-banner-dismissed");
      return false;
    }
    return true;
  });
  const [showInstructions, setShowInstructions] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("pwa-banner-dismissed", Date.now().toString());
  };

  const handleInstallClick = async () => {
    // Save current URL so PWA opens on this page after install
    savePWAReturnUrl();
    if (canInstall) {
      await promptInstall();
    } else if (isIOS || isAndroid) {
      setShowInstructions(true);
    }
  };

  // Don't show if installed or dismissed
  if (isInstalled || isDismissed) {
    return null;
  }

  // Show on mobile devices or when browser supports install prompt
  const showBanner = isIOS || isAndroid || canInstall;
  if (!showBanner) {
    return null;
  }

  return (
    <>
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

      {/* Instructions Dialog for iOS/Android */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Instalar Aplicativo</DialogTitle>
            <DialogDescription>
              Siga os passos abaixo para adicionar à tela inicial
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  1
                </div>
                <div className="flex items-center gap-2 text-sm pt-1">
                  <span>Toque no botão</span>
                  <Share className="w-4 h-4" />
                  <span className="font-medium">Compartilhar</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  2
                </div>
                <div className="text-sm pt-1">
                  Deslize e toque em <span className="font-medium">"Adicionar à Tela Inicial"</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  3
                </div>
                <div className="text-sm pt-1">
                  Toque em <span className="font-medium">Adicionar</span>
                </div>
              </div>
            </div>
          ) : isAndroid ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  1
                </div>
                <div className="flex items-center gap-2 text-sm pt-1">
                  <span>Toque no menu</span>
                  <MoreVertical className="w-4 h-4" />
                  <span className="font-medium">(3 pontos)</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  2
                </div>
                <div className="text-sm pt-1">
                  Toque em <span className="font-medium">"Instalar app"</span> ou <span className="font-medium">"Adicionar à tela inicial"</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  3
                </div>
                <div className="text-sm pt-1">
                  Confirme tocando em <span className="font-medium">Instalar</span>
                </div>
              </div>
            </div>
          ) : null}

          <Button variant="outline" onClick={() => setShowInstructions(false)} className="mt-2">
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
