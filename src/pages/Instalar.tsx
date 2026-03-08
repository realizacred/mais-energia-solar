import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Wrench, ExternalLink } from "lucide-react";
import { useLogo } from "@/hooks/useLogo";

export default function Instalar() {
  const logo = useLogo();
  const navigate = useNavigate();

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    if (isStandalone) {
      navigate("/app", { replace: true });
    }
  }, [navigate]);

  const apps = [
    {
      icon: MessageCircle,
      iconColor: "text-success",
      iconBg: "bg-success/10",
      title: "Mensagens WhatsApp",
      description: "Central de atendimento, contatos e configurações",
      url: "/app",
    },
    {
      icon: Wrench,
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
      title: "Portal do Instalador",
      description: "Serviços agendados, checklists e fotos",
      url: "/instalador",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-center">
        <img src={logo} alt="Mais Energia Solar" className="h-12" />
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center max-w-lg space-y-6">
        <Card className="w-full border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Instalar Aplicativo</CardTitle>
            <CardDescription className="text-base">
              Escolha o app que deseja instalar na sua tela inicial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {apps.map((app) => (
              <a
                key={app.url}
                href={app.url}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/40 transition-colors group"
              >
                <div className={`w-12 h-12 rounded-xl ${app.iconBg} flex items-center justify-center shrink-0`}>
                  <app.icon className={`h-6 w-6 ${app.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{app.title}</p>
                  <p className="text-xs text-muted-foreground">{app.description}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </a>
            ))}
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Abra o link desejado e use o menu do navegador:
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>iPhone:</strong> Compartilhar → Adicionar à Tela de Início
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Android:</strong> Menu (⋮) → Instalar aplicativo
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Mais Energia Solar
      </footer>
    </div>
  );
}
