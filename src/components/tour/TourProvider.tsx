import { createContext, useContext, useState, useCallback, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from "react-joyride";
import { useLocation } from "react-router-dom";

// ─── Tour Steps per Route ────────────────────────────────────

const TOUR_STEPS: Record<string, Step[]> = {
  "/admin/dashboard": [
    {
      target: "[data-tour='sidebar']",
      content: "Este é o menu principal. Navegue por todas as áreas do sistema clicando nas seções.",
      title: "📌 Menu de Navegação",
      placement: "right",
      disableBeacon: true,
    },
    {
      target: "[data-tour='page-header']",
      content: "Cada área mostra um resumo no topo. Aqui você vê o título, descrição e ações rápidas da página.",
      title: "📊 Cabeçalho da Página",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/leads": [
    {
      target: "[data-tour='page-header']",
      content: "Aqui estão todos os seus leads (oportunidades de venda). Use filtros para encontrar rapidamente o que precisa.",
      title: "👥 Gestão de Leads",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: "[data-tour='novo-lead']",
      content: "Clique aqui para adicionar um novo lead ao sistema manualmente.",
      title: "➕ Novo Lead",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/projetos": [
    {
      target: "[data-tour='page-header']",
      content: "Gerencie seus projetos em formato Kanban. Arraste cards entre etapas para atualizar o status.",
      title: "📁 Projetos",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/pipeline": [
    {
      target: "[data-tour='page-header']",
      content: "O Funil Comercial mostra todas as oportunidades organizadas por etapa de venda, com valores e probabilidades.",
      title: "📈 Funil Comercial",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/inbox": [
    {
      target: "[data-tour='page-header']",
      content: "Central de atendimento via WhatsApp. Responda mensagens, atribua conversas e acompanhe o histórico.",
      title: "💬 Atendimento WhatsApp",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/clientes": [
    {
      target: "[data-tour='page-header']",
      content: "Cadastro completo dos seus clientes com documentos, endereço e histórico de projetos.",
      title: "✅ Clientes",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/inteligencia": [
    {
      target: "[data-tour='page-header']",
      content: "Scoring automático de leads e previsão de receita baseada em dados reais da sua operação.",
      title: "🧠 Inteligência Comercial",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/recebimentos": [
    {
      target: "[data-tour='page-header']",
      content: "Controle de parcelas, pagamentos recebidos e previsão de entradas financeiras.",
      title: "💰 Contas a Receber",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/vendedores": [
    {
      target: "[data-tour='page-header']",
      content: "Cadastre e gerencie seus consultores de vendas, defina metas e acompanhe o desempenho.",
      title: "👤 Consultores",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/gamificacao": [
    {
      target: "[data-tour='page-header']",
      content: "Defina metas mensais e veja o ranking da equipe em tempo real para estimular resultados.",
      title: "🏆 Metas & Ranking",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/propostas": [
    {
      target: "[data-tour='page-header']",
      content: "Gere propostas personalizadas com apenas alguns cliques e envie diretamente ao cliente.",
      title: "📋 Propostas",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/monitoramento": [
    {
      target: "[data-tour='page-header']",
      content: "Acompanhe em tempo real todas as usinas solares instaladas, com status, geração e alertas.",
      title: "☀️ Monitoramento Solar",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
  "/admin/diretor": [
    {
      target: "[data-tour='page-header']",
      content: "Insights de IA e métricas executivas para visão estratégica da operação.",
      title: "📊 Dashboard Executivo",
      placement: "bottom",
      disableBeacon: true,
    },
  ],
};

// ─── Context ─────────────────────────────────────────────────

interface TourContextType {
  startTour: (route?: string) => void;
  hasSeenTour: (route: string) => boolean;
  resetTours: () => void;
}

const TourContext = createContext<TourContextType>({
  startTour: () => {},
  hasSeenTour: () => false,
  resetTours: () => {},
});

export const useTour = () => useContext(TourContext);

const STORAGE_KEY = "app_tours_seen";

function getSeenTours(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function markTourSeen(route: string) {
  const seen = getSeenTours();
  if (!seen.includes(route)) {
    seen.push(route);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  }
}

// ─── Provider ────────────────────────────────────────────────

export function TourProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentRoute, setCurrentRoute] = useState("");

  const hasSeenTour = useCallback((route: string) => {
    return getSeenTours().includes(route);
  }, []);

  const startTour = useCallback((route?: string) => {
    const r = route || location.pathname;
    const tourSteps = TOUR_STEPS[r];
    if (tourSteps && tourSteps.length > 0) {
      setSteps(tourSteps);
      setCurrentRoute(r);
      setRun(true);
    }
  }, [location.pathname]);

  const resetTours = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Auto-start tour on first visit to a page
  useEffect(() => {
    const path = location.pathname;
    if (TOUR_STEPS[path] && !hasSeenTour(path)) {
      const timer = setTimeout(() => startTour(path), 800);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, hasSeenTour, startTour]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status, action, type } = data;
    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      (action === ACTIONS.CLOSE && type === EVENTS.STEP_AFTER)
    ) {
      setRun(false);
      markTourSeen(currentRoute);
    }
  }, [currentRoute]);

  return (
    <TourContext.Provider value={{ startTour, hasSeenTour, resetTours }}>
      {children}
      <Joyride
        steps={steps}
        run={run}
        continuous
        showProgress
        showSkipButton
        scrollToFirstStep
        callback={handleCallback}
        locale={{
          back: "Voltar",
          close: "Fechar",
          last: "Entendi!",
          next: "Próximo",
          skip: "Pular tour",
        }}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: "hsl(var(--primary))",
            backgroundColor: "hsl(var(--card))",
            textColor: "hsl(var(--card-foreground))",
            arrowColor: "hsl(var(--card))",
          },
          tooltip: {
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))",
            padding: "16px 20px",
          },
          tooltipTitle: {
            fontSize: "15px",
            fontWeight: 700,
          },
          tooltipContent: {
            fontSize: "13px",
            lineHeight: 1.6,
          },
          buttonNext: {
            borderRadius: "var(--radius)",
            fontSize: "13px",
            fontWeight: 600,
            padding: "8px 16px",
          },
          buttonBack: {
            fontSize: "13px",
            color: "hsl(var(--muted-foreground))",
          },
          buttonSkip: {
            fontSize: "12px",
            color: "hsl(var(--muted-foreground))",
          },
          spotlight: {
            borderRadius: "var(--radius)",
          },
        }}
      />
    </TourContext.Provider>
  );
}
