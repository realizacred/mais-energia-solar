import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Sun, Zap, Users } from "lucide-react";
import { useLogo } from "@/hooks/useLogo";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { InstallAppBanner } from "@/components/vendor/InstallAppBanner";

export default function Instalar() {
  const logo = useLogo();
  const navigate = useNavigate();
  const { isInstalled } = usePWAInstall();

  useEffect(() => {
    // If running in standalone (PWA) mode, redirect away from install page
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    if (isStandalone) {
      navigate("/inbox", { replace: true });
    }
  }, [navigate]);

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

      {/* Install Banner — same component used on /v/slug */}
      <InstallAppBanner />

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
