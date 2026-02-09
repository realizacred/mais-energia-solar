import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Check, Smartphone, Share, MoreVertical, Sun, Zap, Users } from "lucide-react";
import { useLogo } from "@/hooks/useLogo";
import { usePWAInstall, savePWAReturnUrl } from "@/hooks/usePWAInstall";

export default function Instalar() {
  const logo = useLogo();
  const navigate = useNavigate();
  const { isInstalled, isIOS, isAndroid, canInstall, promptInstall } = usePWAInstall();

  useEffect(() => {
    // If running in standalone (PWA) mode, redirect away from install page
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    if (isStandalone) {
      navigate("/vendedor", { replace: true });
    }
  }, [navigate]);

  const handleInstallClick = async () => {
    savePWAReturnUrl();
    if (canInstall) {
      await promptInstall();
    }
  };

  const features = [
    {
      icon: Zap,
      title: "Acesso Rápido",
      description: "Abra o app direto da tela inicial",
    },
    {
      icon: Sun,
      title: "Funciona Offline",
      description: "Capture leads mesmo sem internet",
    },
    {
      icon: Users,
      title: "Notificações",
      description: "Receba alertas de novos orçamentos",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-center">
        <img src={logo} alt="Mais Energia Solar" className="h-12" />
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center max-w-lg">
        {isInstalled ? (
          <Card className="w-full text-center border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-xl">App Instalado!</CardTitle>
              <CardDescription>
                O aplicativo está pronto para uso na sua tela inicial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild className="w-full">
                <a href="/vendedor">Acessar Portal do Vendedor</a>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <a href="/checklist">Acessar Checklist</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="w-full border-primary/20">
              <CardHeader className="text-center">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <Download className="w-10 h-10 text-primary-foreground" />
                </div>
                <CardTitle className="text-2xl">Instalar Aplicativo</CardTitle>
                <CardDescription className="text-base">
                  Adicione o app à sua tela inicial para acesso rápido
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Features */}
                <div className="grid gap-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{feature.title}</p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Native install button (Android Chrome) */}
                {canInstall && (
                  <Button onClick={handleInstallClick} className="w-full h-12 text-base" size="lg">
                    <Download className="w-5 h-5 mr-2" />
                    Instalar Agora
                  </Button>
                )}

                {/* iOS manual instructions */}
                {isIOS && !canInstall && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-center">
                      Para instalar no iPhone/iPad:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">1</div>
                        <div className="flex items-center gap-2 text-sm pt-1">
                          <span>Toque no botão</span>
                          <Share className="w-4 h-4" />
                          <span className="font-medium">Compartilhar</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">2</div>
                        <div className="text-sm pt-1">
                          Deslize e toque em <span className="font-medium">"Adicionar à Tela Inicial"</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">3</div>
                        <div className="text-sm pt-1">
                          Toque em <span className="font-medium">Adicionar</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Android manual instructions (fallback when native prompt doesn't fire) */}
                {isAndroid && !canInstall && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-center">
                      Para instalar no Android:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">1</div>
                        <div className="flex items-center gap-2 text-sm pt-1">
                          <span>Toque no menu</span>
                          <MoreVertical className="w-4 h-4" />
                          <span className="font-medium">(3 pontos)</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">2</div>
                        <div className="text-sm pt-1">
                          Toque em <span className="font-medium">"Instalar app"</span> ou <span className="font-medium">"Adicionar à tela inicial"</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">3</div>
                        <div className="text-sm pt-1">
                          Confirme tocando em <span className="font-medium">Instalar</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Desktop fallback */}
                {!isIOS && !isAndroid && !canInstall && (
                  <div className="text-center text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                    <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Acesse este link no seu celular para instalar o aplicativo</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skip Link */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              <a href="/vendedor" className="hover:text-primary underline underline-offset-4">
                Continuar no navegador →
              </a>
            </p>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Mais Energia Solar
      </footer>
    </div>
  );
}
