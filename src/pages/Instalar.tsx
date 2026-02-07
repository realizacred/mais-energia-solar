import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Check, Smartphone, Share, MoreVertical, ArrowDown, Sun, Zap, Users } from "lucide-react";
import logo from "@/assets/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Instalar() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
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

                {/* Install Button or Instructions */}
                {deferredPrompt ? (
                  <Button onClick={handleInstallClick} className="w-full h-12 text-base" size="lg">
                    <Download className="w-5 h-5 mr-2" />
                    Instalar Agora
                  </Button>
                ) : isIOS ? (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-center">
                      Para instalar no iPhone/iPad:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          1
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span>Toque no botão</span>
                          <Share className="w-4 h-4" />
                          <span className="font-medium">Compartilhar</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          2
                        </div>
                        <span className="text-sm">Deslize para baixo e toque em</span>
                      </div>
                      <div className="flex items-center gap-3 ml-11">
                        <span className="text-sm font-medium flex items-center gap-1">
                          "Adicionar à Tela Inicial"
                          <ArrowDown className="w-3 h-3" />
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          3
                        </div>
                        <span className="text-sm">Toque em <span className="font-medium">Adicionar</span></span>
                      </div>
                    </div>
                  </div>
                ) : isAndroid ? (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-center">
                      Para instalar no Android:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          1
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span>Toque no menu</span>
                          <MoreVertical className="w-4 h-4" />
                          <span className="font-medium">(3 pontos)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          2
                        </div>
                        <span className="text-sm">Toque em <span className="font-medium">"Instalar app"</span> ou <span className="font-medium">"Adicionar à tela inicial"</span></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          3
                        </div>
                        <span className="text-sm">Confirme tocando em <span className="font-medium">Instalar</span></span>
                      </div>
                    </div>
                  </div>
                ) : (
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
