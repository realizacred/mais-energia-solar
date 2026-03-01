import React from "react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import {
  BookOpen,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle,
  Info,
  Zap,
  Sun,
  Gauge,
} from "lucide-react";

const ALERT_LEVELS = [
  {
    icon: Info,
    title: "Interno",
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    desc: "Alertas visíveis apenas para a equipe técnica. Ativado quando o score de confiabilidade dos dados é inferior a 80/100 ou quando faltam dados essenciais (capacidade, irradiação, leituras).",
    action: "Nenhuma ação necessária do cliente. A equipe investiga internamente.",
  },
  {
    icon: AlertTriangle,
    title: "Preventivo",
    color: "text-warning",
    bg: "bg-warning/10",
    desc: "Ativado quando o desvio da geração esperada fica entre 10-20% por pelo menos 7 dias consecutivos, com confiabilidade ≥ 80.",
    action: "Verificar sombreamento, sujeira nos painéis, e condições climáticas atípicas.",
  },
  {
    icon: Bell,
    title: "Urgente",
    color: "text-destructive",
    bg: "bg-destructive/10",
    desc: "Ativado quando: usina offline confirmada, geração zero com irradiação alta, ou desvio > 30% por 2-3 dias com confiabilidade ≥ 90.",
    action: "Contatar imediatamente o suporte técnico. Possível falha de equipamento.",
  },
];

const CHECKLIST = [
  "Verificar se os painéis estão limpos e sem sombra",
  "Conferir se o inversor está ligado e com LEDs normais",
  "Checar conexão de internet do datalogger",
  "Verificar disjuntores e fusíveis de proteção",
  "Consultar o clima recente (dias nublados reduzem geração)",
  "Entrar em contato com o suporte se nada resolver",
];

export default function MonitorAlertsTutorial() {
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Entenda seus Alertas"
        description="Guia completo sobre como monitoramos sua usina solar e quando geramos alertas"
        icon={BookOpen}
      />

      {/* O que é PR */}
      <SectionCard title="O que é Performance Ratio (PR)?" icon={Gauge}>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            O <strong className="text-foreground">Performance Ratio</strong> é o indicador
            que compara a <strong className="text-foreground">geração real</strong> da sua usina
            com o que ela <strong className="text-foreground">deveria gerar</strong> considerando
            a irradiação solar disponível no local.
          </p>
          <div className="p-4 rounded-lg bg-muted/40 border border-border/50 font-mono text-xs">
            PR = Energia Real (kWh) ÷ (Potência Instalada (kWp) × Horas de Sol Pico (HSP))
          </div>
          <p>
            Um PR de <strong className="text-foreground">75-85%</strong> é considerado normal.
            Valores acima de 85% são excelentes. Abaixo de 70% pode indicar algum problema.
          </p>
        </div>
      </SectionCard>

      {/* O que entra no cálculo */}
      <SectionCard title="O que entra no cálculo?" icon={Zap}>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Sun,
              label: "Irradiação Solar (HSP)",
              desc: "Horas de Sol Pico no local, obtidas por satélite ou premissas regionais.",
            },
            {
              icon: Gauge,
              label: "Potência Instalada (kWp)",
              desc: "Capacidade total dos painéis instalados na sua usina.",
            },
            {
              icon: Zap,
              label: "Energia Gerada (kWh)",
              desc: "Leitura real do inversor, coletada automaticamente.",
            },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-lg border border-border/50 bg-card">
              <item.icon className="h-5 w-5 text-primary mb-2" />
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Perdas esperadas */}
      <SectionCard title="Perdas esperadas do sistema" icon={TrendingDown}>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            Nenhum sistema gera 100% da energia teórica. Descontamos perdas naturais para
            calcular o <strong className="text-foreground">rendimento esperado</strong>:
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: "Sombreamento", value: "~5%", desc: "Sombras parciais de árvores, antenas, etc." },
              { label: "Sujeira", value: "~3%", desc: "Poeira e resíduos acumulados nos painéis" },
              { label: "Outras perdas", value: "~10%", desc: "Eficiência do inversor, cabeamento, temperatura" },
            ].map((loss) => (
              <div key={loss.label} className="p-3 rounded-lg bg-muted/30 border border-border/40">
                <p className="text-sm font-medium text-foreground">{loss.label}: {loss.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{loss.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Por que varia */}
      <SectionCard title="Por que a geração varia?" icon={Sun}>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "Dias nublados ou chuvosos reduzem a irradiação",
            "No inverno, os dias são mais curtos e o sol mais baixo",
            "Sombreamento temporário (construção vizinha, vegetação)",
            "Sujeira acumulada nos painéis reduz a eficiência",
            "Temperatura muito alta reduz a eficiência dos painéis",
            "Problemas no inversor ou na rede elétrica",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* Níveis de alerta */}
      <SectionCard title="Níveis de Alerta" icon={AlertTriangle}>
        <div className="space-y-3">
          {ALERT_LEVELS.map((level) => (
            <div key={level.title} className={`p-4 rounded-lg border border-border/50 ${level.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <level.icon className={`h-4.5 w-4.5 ${level.color}`} />
                <h4 className="text-sm font-semibold text-foreground">{level.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">{level.desc}</p>
              <p className="text-xs text-foreground/80">
                <strong>O que fazer:</strong> {level.action}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Quando NÃO alertamos */}
      <SectionCard title="Quando NÃO geramos alertas" icon={BellOff}>
        <div className="space-y-2 text-sm text-muted-foreground">
          {[
            "Quando a confiabilidade dos dados é baixa (< 80/100)",
            "Quando a usina não tem potência instalada configurada",
            "Quando não temos dados de irradiação solar para o local",
            "Quando a usina foi recém-conectada (sem histórico)",
            "Quando o desvio é pequeno e por poucos dias (variação normal)",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <ShieldCheck className="h-4 w-4 text-success shrink-0" />
              <span className="text-xs">{item}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Checklist */}
      <SectionCard title="Checklist: o que fazer se receber um alerta" icon={CheckCircle}>
        <ol className="space-y-2">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}
