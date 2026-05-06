/**
 * MeuPlanoPage — Tenant-facing plan & usage dashboard.
 *
 * Reaproveita (RB-76 / DA-48):
 *  - useTenantPlan        → subscription + features + limits do plano
 *  - useTenantLockState   → estado de bloqueio (none/soft/hard)
 *  - useUsageLimit        → uso atual vs limite por métrica (RPC check_tenant_limit)
 *  - UpgradeModal         → fluxo de upgrade existente (Asaas)
 *  - PageHeader / StatCard / EmptyState / LoadingState / Progress
 *
 * NÃO cria nova engine, tabela ou billing. Sem queries diretas no componente.
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
  CreditCard,
  ArrowUpRight,
  PackageSearch,
} from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
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
  max_wa_messages_month: "Mensagens WhatsApp / mês",
  max_ai_insights_month: "Insights IA / mês",
  max_proposals_month: "Propostas / mês",
  max_reports_pdf_month: "Relatórios PDF / mês",
  max_users: "Usuários",
  max_automations: "Automações",
  max_performance_alerts: "Alertas de performance / mês",
  max_leads_month: "Leads / mês",
  max_storage_mb: "Armazenamento (MB)",
};

const FEATURE_LABELS: Record<string, string> = {
  ai_insights: "Insights de IA",
  ai_followup: "Follow-up com IA",
  multi_instance_wa: "WhatsApp multi-instância",
  whatsapp_automation: "Automação WhatsApp",
  automacoes: "Automações",
  advanced_reports: "Relatórios avançados",
  relatorio_mensal_pdf: "Relatório mensal PDF",
  exportacao_relatorios: "Exportação de relatórios",
  dashboards_avancados: "Dashboards avançados",
  api_access: "Acesso à API",
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

function MetricRow({ metricKey }: { metricKey: string }) {
  const { current, limit, percentage, isNearLimit, isAtLimit, isLoading, isUnlimited } =
    useUsageLimit(metricKey);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-12 animate-pulse bg-muted rounded" />
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
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {METRIC_LABELS[metricKey] ?? metricKey}
            </p>
            <p className="text-xs text-muted-foreground">
              {isUnlimited ? "Uso ilimitado neste plano" : `Limite: ${limit.toLocaleString("pt-BR")}`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-lg font-bold leading-none ${valueColor}`}>
              {current.toLocaleString("pt-BR")}
              {!isUnlimited && (
                <span className="text-xs text-muted-foreground font-normal">
                  {" "}/ {limit.toLocaleString("pt-BR")}
                </span>
              )}
            </p>
            {!isUnlimited && (
              <p className="text-xs text-muted-foreground">{percentage}%</p>
            )}
          </div>
        </div>
        {!isUnlimited && (
          <Progress value={percentage} className={`h-2 ${progressClass}`} />
        )}
        {status === "warning" && (
          <p className="flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="w-3 h-3" /> Próximo do limite
          </p>
        )}
        {status === "critical" && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="w-3 h-3" /> Limite atingido
          </p>
        )}
      </CardContent>
    </Card>
  );
}

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

  const lockLevel = lockState?.level ?? "none";

  const featureEntries = useMemo(
    () => Object.entries(features).sort(([a], [b]) => a.localeCompare(b)),
    [features],
  );
  const activeFeatures = featureEntries.filter(([, v]) => v).length;

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
      return { label: "Suspensa", color: "destructive" as const, icon: ShieldX };
    if (lockLevel === "soft")
      return { label: "Pendência", color: "warning" as const, icon: ShieldAlert };
    if (isPastDue)
      return { label: "Em atraso", color: "warning" as const, icon: ShieldAlert };
    if (isCanceled)
      return { label: "Cancelada", color: "destructive" as const, icon: ShieldX };
    if (isTrialing)
      return { label: "Trial", color: "info" as const, icon: ShieldCheck };
    return { label: "Ativa", color: "success" as const, icon: ShieldCheck };
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Meu Plano & Uso"
        description="Acompanhe limites, consumo e recursos disponíveis no seu plano."
        actions={
          <Button onClick={() => setUpgradeOpen(true)} className="gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Fazer upgrade
          </Button>
        }
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Sparkles}
          label="Plano atual"
          value={subscription.plan_name}
          color="primary"
          subtitle={`R$ ${subscription.price_monthly.toFixed(2)} / mês`}
        />
        <StatCard
          icon={statusInfo.icon}
          label="Status da conta"
          value={statusInfo.label}
          color={statusInfo.color}
          subtitle={
            subscription.current_period_end
              ? `Renova em ${new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}`
              : undefined
          }
        />
        <StatCard
          icon={Gauge}
          label="Consumo crítico"
          value={<UsageCriticalCount />}
          color="warning"
          subtitle="Métricas ≥ 80% do limite"
        />
        <StatCard
          icon={Activity}
          label="Recursos ativos"
          value={activeFeatures}
          color="info"
          subtitle={`${featureEntries.length} disponíveis no plano`}
        />
      </div>

      {/* Consumo por métrica */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Consumo do mês</h2>
          <span className="text-xs text-muted-foreground">
            Período: {new Date(subscription.current_period_start).toLocaleDateString("pt-BR")} —{" "}
            {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TRACKED_METRICS.map((m) => (
            <MetricRow key={m} metricKey={m} />
          ))}
        </div>
      </section>

      {/* Recursos do plano */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Recursos do plano</h2>
        {featureEntries.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="Sem recursos configurados"
            description="Não há recursos definidos para este plano."
          />
        ) : (
          <Card>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {featureEntries.map(([key, enabled]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card"
                >
                  {enabled ? (
                    <Check className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={`text-sm truncate ${
                      enabled ? "text-foreground" : "text-muted-foreground line-through"
                    }`}
                  >
                    {FEATURE_LABELS[key] ?? key}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Footer CTA */}
      <Card className="border-l-[3px] border-l-primary">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Precisa de mais capacidade?
              </p>
              <p className="text-xs text-muted-foreground">
                Faça upgrade para liberar mais recursos, limites maiores e novas integrações.
              </p>
            </div>
          </div>
          <Button onClick={() => setUpgradeOpen(true)} className="gap-2">
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

/** Conta quantas métricas rastreadas estão ≥80% (chama hooks reais, não mock). */
function UsageCriticalCount() {
  const m1 = useUsageLimit("max_wa_messages_month");
  const m2 = useUsageLimit("max_ai_insights_month");
  const m3 = useUsageLimit("max_proposals_month");
  const m4 = useUsageLimit("max_reports_pdf_month");
  const m5 = useUsageLimit("max_users");
  const all = [m1, m2, m3, m4, m5];
  const count = all.filter((m) => !m.isLoading && !m.isUnlimited && m.isNearLimit).length;
  return <Badge variant={count > 0 ? "destructive" : "secondary"}>{count}</Badge>;
}
