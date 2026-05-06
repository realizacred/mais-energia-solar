/**
 * MeuPlanoPage — Tenant-facing plan & usage dashboard (UX premium).
 *
 * Reaproveita (RB-76 / DA-48) — sem alterar hooks, lógica ou backend:
 *  - useTenantPlan        → subscription + features + limits do plano
 *  - useTenantLockState   → estado de bloqueio (none/soft/hard)
 *  - useUsageLimit        → uso atual vs limite por métrica (RPC check_tenant_limit)
 *  - UpgradeModal         → fluxo de upgrade existente (Asaas)
 */
import { useMemo, useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Activity,
  Gauge,
  AlertTriangle,
  Check,
  X,
  ArrowUpRight,
  PackageSearch,
  Zap,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTenantPlan } from "@/hooks/useTenantPlan";
import { useTenantLockState } from "@/hooks/useTenantLockState";
import { useUsageLimit } from "@/hooks/useUsageLimits";
import { UpgradeModal } from "@/components/plan/UpgradeModal";

const METRIC_LABELS: Record<string, string> = {
  max_wa_messages_month: "Mensagens WhatsApp",
  max_ai_insights_month: "Insights de IA",
  max_proposals_month: "Propostas geradas",
  max_reports_pdf_month: "Relatórios PDF",
  max_users: "Usuários cadastrados",
  max_automations: "Automações ativas",
  max_performance_alerts: "Alertas de performance",
  max_leads_month: "Leads captados",
  max_storage_mb: "Armazenamento (MB)",
};

const FEATURE_GROUPS: { title: string; description: string; keys: string[] }[] = [
  {
    title: "Inteligência Artificial",
    description: "Recursos de IA para acelerar vendas e atendimento.",
    keys: ["ai_insights", "ai_followup"],
  },
  {
    title: "WhatsApp & Atendimento",
    description: "Canais de comunicação e automação de mensagens.",
    keys: ["multi_instance_wa", "whatsapp_automation"],
  },
  {
    title: "Automação & Produtividade",
    description: "Automações de pipeline e fluxos operacionais.",
    keys: ["automacoes", "gamification"],
  },
  {
    title: "Relatórios & Analytics",
    description: "Visões avançadas e exportação de dados.",
    keys: [
      "advanced_reports",
      "relatorio_mensal_pdf",
      "exportacao_relatorios",
      "dashboards_avancados",
    ],
  },
  {
    title: "Integrações & White Label",
    description: "Personalização da marca e integrações externas.",
    keys: ["api_access", "white_label", "nfse_fiscal"],
  },
];

const FEATURE_LABELS: Record<string, string> = {
  ai_insights: "Insights de IA",
  ai_followup: "Follow-up com IA",
  multi_instance_wa: "WhatsApp multi-instância",
  whatsapp_automation: "Automação WhatsApp",
  automacoes: "Automações de pipeline",
  advanced_reports: "Relatórios avançados",
  relatorio_mensal_pdf: "Relatório mensal PDF",
  exportacao_relatorios: "Exportação de relatórios",
  dashboards_avancados: "Dashboards avançados",
  api_access: "Acesso à API pública",
  white_label: "White label",
  nfse_fiscal: "NFS-e / Fiscal",
  gamification: "Gamificação",
};

const TRACKED_METRICS = [
  "max_wa_messages_month",
  "max_ai_insights_month",
  "max_proposals_month",
  "max_reports_pdf_month",
  "max_users",
];

// ─────────────────────── Hero ───────────────────────

function PlanHero({
  planName,
  priceMonthly,
  statusLabel,
  statusTone,
  StatusIcon,
  periodEnd,
  globalPct,
  onUpgrade,
}: {
  planName: string;
  priceMonthly: number;
  statusLabel: string;
  statusTone: "success" | "warning" | "destructive" | "info";
  StatusIcon: typeof ShieldCheck;
  periodEnd?: string;
  globalPct: number;
  onUpgrade: () => void;
}) {
  const toneText = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    info: "text-info",
  }[statusTone];
  const toneBg = {
    success: "bg-success/10 border-success/30",
    warning: "bg-warning/10 border-warning/30",
    destructive: "bg-destructive/10 border-destructive/30",
    info: "bg-info/10 border-info/30",
  }[statusTone];

  const barTone =
    globalPct >= 90
      ? "[&>div]:bg-destructive"
      : globalPct >= 75
        ? "[&>div]:bg-warning"
        : "[&>div]:bg-success";

  return (
    <Card className="border-l-[3px] border-l-primary overflow-hidden">
      <CardContent className="p-6 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Identidade do plano */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wide">
                <Sparkles className="h-3 w-3 text-primary" />
                Seu plano
              </Badge>
              <div
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${toneBg} ${toneText}`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusLabel}
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
              {planName}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              R$ {priceMonthly.toFixed(2)} / mês
              {periodEnd && (
                <>
                  {" · "}renova em{" "}
                  <span className="text-foreground font-medium">
                    {new Date(periodEnd).toLocaleDateString("pt-BR")}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Resumo de consumo + CTA */}
          <div className="flex-1 min-w-0 lg:max-w-md w-full space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Consumo médio do mês
                </p>
                <p className="text-3xl font-bold text-foreground leading-none mt-1">
                  {globalPct}
                  <span className="text-base text-muted-foreground font-normal">%</span>
                </p>
              </div>
              <Button
                size="sm"
                onClick={onUpgrade}
                className="gap-2 shadow-md hover:shadow-lg transition-shadow"
              >
                <TrendingUp className="h-4 w-4" />
                Fazer upgrade
              </Button>
            </div>
            <Progress value={globalPct} className={`h-3 ${barTone}`} />
            <p className="text-[11px] text-muted-foreground">
              Média de uso entre as principais métricas do plano.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────── Métrica ───────────────────────

function MetricRow({ metricKey }: { metricKey: string }) {
  const { current, limit, percentage, isNearLimit, isAtLimit, isLoading, isUnlimited } =
    useUsageLimit(metricKey);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const status: "normal" | "warning" | "critical" = isAtLimit
    ? "critical"
    : isNearLimit
      ? "warning"
      : "normal";

  const borderColor =
    status === "critical"
      ? "border-l-destructive"
      : status === "warning"
        ? "border-l-warning"
        : "border-l-success";

  const valueColor =
    status === "critical"
      ? "text-destructive"
      : status === "warning"
        ? "text-warning"
        : "text-foreground";

  const progressClass =
    status === "critical"
      ? "[&>div]:bg-destructive"
      : status === "warning"
        ? "[&>div]:bg-warning"
        : "[&>div]:bg-success";

  return (
    <Card className={`border-l-[3px] ${borderColor}`}>
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {METRIC_LABELS[metricKey] ?? metricKey}
            </p>
            <p className="text-xs text-muted-foreground">
              {isUnlimited
                ? "Uso ilimitado neste plano"
                : `Limite mensal: ${limit.toLocaleString("pt-BR")}`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-2xl font-bold leading-none ${valueColor}`}>
              {current.toLocaleString("pt-BR")}
            </p>
            {!isUnlimited && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{percentage}% usado</p>
            )}
          </div>
        </div>
        {!isUnlimited && (
          <Progress value={percentage} className={`h-2 ${progressClass}`} />
        )}
        {status === "warning" && (
          <p className="flex items-center gap-1 text-xs text-warning font-medium">
            <AlertTriangle className="w-3 h-3" /> Próximo do limite — considere upgrade
          </p>
        )}
        {status === "critical" && (
          <p className="flex items-center gap-1 text-xs text-destructive font-medium">
            <AlertTriangle className="w-3 h-3" /> Limite atingido — operações bloqueadas
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────── KPI grande ───────────────────────

function BigStat({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string | number;
  subtitle?: string;
  tone: "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const map = {
    primary: { border: "border-l-primary", bg: "bg-primary/10", text: "text-primary" },
    success: { border: "border-l-success", bg: "bg-success/10", text: "text-success" },
    warning: { border: "border-l-warning", bg: "bg-warning/10", text: "text-warning" },
    destructive: {
      border: "border-l-destructive",
      bg: "bg-destructive/10",
      text: "text-destructive",
    },
    info: { border: "border-l-info", bg: "bg-info/10", text: "text-info" },
  }[tone];
  return (
    <Card className={`border-l-[3px] ${map.border}`}>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${map.bg}`}>
          <Icon className={`h-6 w-6 ${map.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-bold leading-none text-foreground tracking-tight">{value}</p>
          <p className="text-sm font-medium text-foreground mt-2">{label}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────── Página ───────────────────────

export default function MeuPlanoPage() {
  const {
    subscription,
    features,
    loading,
    isTrialing,
    isPastDue,
    isCanceled,
    trialDaysRemaining,
  } = useTenantPlan();
  const { data: lockState } = useTenantLockState();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Hooks de uso (mantidos no topo — uma única chamada por métrica)
  const m1 = useUsageLimit("max_wa_messages_month");
  const m2 = useUsageLimit("max_ai_insights_month");
  const m3 = useUsageLimit("max_proposals_month");
  const m4 = useUsageLimit("max_reports_pdf_month");
  const m5 = useUsageLimit("max_users");
  const allMetrics = [m1, m2, m3, m4, m5];

  const lockLevel = lockState?.level ?? "none";

  const featureEntries = useMemo(
    () => Object.entries(features).sort(([a], [b]) => a.localeCompare(b)),
    [features],
  );
  const activeFeatures = featureEntries.filter(([, v]) => v).length;

  // Resumo global de consumo (média das métricas com limite)
  const globalPct = useMemo(() => {
    const ms = allMetrics.filter((m) => !m.isLoading && !m.isUnlimited && m.limit > 0);
    if (ms.length === 0) return 0;
    return Math.round(ms.reduce((acc, m) => acc + m.percentage, 0) / ms.length);
  }, [allMetrics]);

  const criticalCount = allMetrics.filter(
    (m) => !m.isLoading && !m.isUnlimited && m.isNearLimit,
  ).length;
  const atLimitCount = allMetrics.filter(
    (m) => !m.isLoading && !m.isUnlimited && m.isAtLimit,
  ).length;

  if (loading) {
    return <LoadingState message="Carregando seu plano..." />;
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={Sparkles}
          title="Meu Plano & Uso"
          description="Acompanhe limites, consumo e recursos disponíveis no seu plano."
        />
        <EmptyState
          icon={PackageSearch}
          title="Nenhuma assinatura encontrada"
          description="Sua conta ainda não possui um plano ativo. Fale com o administrador ou escolha um plano para começar."
          action={{
            label: "Ver planos disponíveis",
            onClick: () => setUpgradeOpen(true),
            icon: ArrowUpRight,
          }}
        />
        <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </div>
    );
  }

  const statusInfo = (() => {
    if (lockLevel === "hard")
      return { label: "Suspensa", tone: "destructive" as const, icon: ShieldX };
    if (lockLevel === "soft")
      return { label: "Pendência", tone: "warning" as const, icon: ShieldAlert };
    if (isPastDue)
      return { label: "Em atraso", tone: "warning" as const, icon: ShieldAlert };
    if (isCanceled)
      return { label: "Cancelada", tone: "destructive" as const, icon: ShieldX };
    if (isTrialing)
      return { label: "Trial", tone: "info" as const, icon: ShieldCheck };
    return { label: "Ativa", tone: "success" as const, icon: ShieldCheck };
  })();

  const upgradeUrgency: "low" | "medium" | "high" =
    atLimitCount > 0 || lockLevel === "hard"
      ? "high"
      : criticalCount >= 2 || lockLevel === "soft" || isPastDue
        ? "medium"
        : "low";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Meu Plano & Uso"
        description="Acompanhe limites, consumo e recursos do seu plano em tempo real."
      />

      {/* HERO */}
      <PlanHero
        planName={subscription.plan_name}
        priceMonthly={subscription.price_monthly}
        statusLabel={statusInfo.label}
        statusTone={statusInfo.tone}
        StatusIcon={statusInfo.icon}
        periodEnd={subscription.current_period_end}
        globalPct={globalPct}
        onUpgrade={() => setUpgradeOpen(true)}
      />

      {/* Lock alerts */}
      {lockLevel === "soft" && (
        <Alert className="border-l-[3px] border-l-warning bg-warning/5">
          <ShieldAlert className="h-4 w-4 text-warning" />
          <AlertTitle>Conta com pendência</AlertTitle>
          <AlertDescription>
            Conta com pendência financeira. Novas ações podem estar temporariamente bloqueadas.
            <Button
              variant="link"
              className="px-1 h-auto text-warning"
              onClick={() => setUpgradeOpen(true)}
            >
              Regularizar plano
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {lockLevel === "hard" && (
        <Alert className="border-l-[3px] border-l-destructive bg-destructive/5">
          <ShieldX className="h-4 w-4 text-destructive" />
          <AlertTitle>Conta suspensa</AlertTitle>
          <AlertDescription>
            Conta suspensa. Apenas leitura disponível até regularização.
            <Button
              variant="link"
              className="px-1 h-auto text-destructive"
              onClick={() => setUpgradeOpen(true)}
            >
              Regularizar agora
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {isTrialing && lockLevel === "none" && (
        <Alert className="border-l-[3px] border-l-info bg-info/5">
          <ShieldCheck className="h-4 w-4 text-info" />
          <AlertTitle>Período de avaliação</AlertTitle>
          <AlertDescription>
            Você tem {trialDaysRemaining} dia{trialDaysRemaining === 1 ? "" : "s"} restante
            {trialDaysRemaining === 1 ? "" : "s"} no trial.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs grandes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BigStat
          icon={Gauge}
          label="Consumo crítico"
          value={criticalCount}
          subtitle={
            atLimitCount > 0
              ? `${atLimitCount} métrica${atLimitCount > 1 ? "s" : ""} no limite`
              : "Métricas ≥ 80% do limite"
          }
          tone={atLimitCount > 0 ? "destructive" : criticalCount > 0 ? "warning" : "success"}
        />
        <BigStat
          icon={Activity}
          label="Recursos ativos"
          value={`${activeFeatures}/${featureEntries.length}`}
          subtitle="Funcionalidades liberadas no seu plano"
          tone="info"
        />
        <BigStat
          icon={Zap}
          label="Uso médio do plano"
          value={`${globalPct}%`}
          subtitle="Média entre as principais métricas"
          tone={globalPct >= 90 ? "destructive" : globalPct >= 75 ? "warning" : "success"}
        />
      </div>

      {/* Consumo por métrica */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Consumo do mês</h2>
            <p className="text-xs text-muted-foreground">
              Atualizado em tempo real conforme o uso da plataforma.
            </p>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">
            {new Date(subscription.current_period_start).toLocaleDateString("pt-BR")} —{" "}
            {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TRACKED_METRICS.map((m) => (
            <MetricRow key={m} metricKey={m} />
          ))}
        </div>
      </section>

      {/* Recursos do plano agrupados */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Recursos do plano</h2>
          <p className="text-xs text-muted-foreground">
            Visão consolidada das funcionalidades disponíveis e bloqueadas no seu plano atual.
          </p>
        </div>
        {featureEntries.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="Sem recursos configurados"
            description="Não há recursos definidos para este plano."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FEATURE_GROUPS.map((group) => {
              const groupItems = group.keys
                .filter((k) => k in features)
                .map((k) => ({ key: k, enabled: !!features[k] }));
              if (groupItems.length === 0) return null;
              const enabledCount = groupItems.filter((g) => g.enabled).length;
              return (
                <Card key={group.title} className="border-l-[3px] border-l-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{group.title}</p>
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                      </div>
                      <Badge
                        variant={enabledCount === groupItems.length ? "default" : "outline"}
                        className="shrink-0 text-[10px]"
                      >
                        {enabledCount}/{groupItems.length}
                      </Badge>
                    </div>
                    <ul className="space-y-1.5">
                      {groupItems.map(({ key, enabled }) => (
                        <li key={key} className="flex items-center gap-2 text-sm">
                          {enabled ? (
                            <Check className="h-4 w-4 text-success shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span
                            className={
                              enabled
                                ? "text-foreground"
                                : "text-muted-foreground line-through"
                            }
                          >
                            {FEATURE_LABELS[key] ?? key}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA Upgrade — destaque conforme urgência */}
      <Card
        className={`border-l-[3px] ${
          upgradeUrgency === "high"
            ? "border-l-destructive bg-destructive/5"
            : upgradeUrgency === "medium"
              ? "border-l-warning bg-warning/5"
              : "border-l-primary"
        }`}
      >
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                upgradeUrgency === "high"
                  ? "bg-destructive/10"
                  : upgradeUrgency === "medium"
                    ? "bg-warning/10"
                    : "bg-primary/10"
              }`}
            >
              <TrendingUp
                className={`h-6 w-6 ${
                  upgradeUrgency === "high"
                    ? "text-destructive"
                    : upgradeUrgency === "medium"
                      ? "text-warning"
                      : "text-primary"
                }`}
              />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-foreground">
                {upgradeUrgency === "high"
                  ? "Limite atingido — faça upgrade para continuar operando"
                  : upgradeUrgency === "medium"
                    ? "Você está perto do limite do seu plano"
                    : "Desbloqueie mais capacidade quando precisar"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {upgradeUrgency === "high"
                  ? "Operações estão sendo bloqueadas. Liberar limites maiores leva menos de 1 minuto."
                  : upgradeUrgency === "medium"
                    ? "Evite interrupções fazendo upgrade antes do limite ser atingido."
                    : "Mais mensagens, mais IA, mais relatórios e novas integrações premium."}
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => setUpgradeOpen(true)}
            className="gap-2 shrink-0 shadow-md hover:shadow-lg transition-shadow w-full sm:w-auto"
          >
            Ver planos
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlanCode={subscription.plan_code}
      />
    </div>
  );
}
