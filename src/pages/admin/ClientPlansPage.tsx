/**
 * ClientPlansPage — Client-facing plans comparison page.
 * §26 header, §12 skeleton, §1 semantic colors only.
 */
import { useState, useEffect, useRef } from "react";
import { formatIntegerBR } from "@/lib/formatters";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Check, X, Star, Zap } from "lucide-react";
import { usePlanPricing, trackPricingEvent, type PricedPlan } from "@/hooks/usePlanPricing";
import { useTenantPlan } from "@/hooks/useTenantPlan";
import { UpgradeModal } from "@/components/plan/UpgradeModal";
import { EmptyState } from "@/components/ui-kit/EmptyState";

const FEATURE_LABELS: Record<string, string> = {
  monitoramento_basico: "Monitoramento Básico",
  checklist_instalacao: "Checklist de Instalação",
  visitas_tecnicas: "Visitas Técnicas",
  comparativo_uc: "Comparativo UC",
  whatsapp_alertas: "Alertas WhatsApp",
  exportacao_relatorios: "Exportação de Relatórios",
  faturas_energia: "Faturas de Energia",
  ai_insights: "AI Insights",
  automacoes: "Automações",
  alerta_performance: "Alerta de Performance",
  dashboards_avancados: "Dashboards Avançados",
  relatorio_mensal_pdf: "Relatório Mensal PDF",
  nfse_fiscal: "NFS-e / Fiscal",
  onboarding_guiado: "Onboarding Guiado",
  alerta_usina_offline: "Alerta Usina Offline",
  whatsapp_automation: "Automação WhatsApp",
  ai_followup: "AI Follow-up",
  advanced_reports: "Relatórios Avançados",
  gamification: "Gamificação",
  white_label: "White Label",
  api_access: "Acesso à API",
  multi_instance_wa: "Multi-instância WA",
};

const LIMIT_LABELS: Record<string, string> = {
  max_ai_insights_month: "AI Insights / mês",
  max_automations: "Automações",
  max_reports_pdf_month: "Relatórios PDF / mês",
  max_performance_alerts: "Alertas Performance / mês",
  max_leads_month: "Leads / mês",
  max_proposals_month: "Propostas / mês",
  max_users: "Usuários",
  max_ucs_monitored: "UCs Monitoradas",
  max_wa_messages_month: "Msgs WhatsApp / mês",
  max_storage_mb: "Armazenamento (MB)",
};

const HIGHLIGHT_LIMITS = [
  "max_ai_insights_month",
  "max_automations",
  "max_reports_pdf_month",
  "max_performance_alerts",
];

function formatLimitValue(v: number): string {
  if (v === 0) return "—";
  if (v >= 999999) return "Ilimitado";
  return `até ${formatIntegerBR(v)}/mês`;
}

export default function ClientPlansPage() {
  const { data: plans, isLoading } = usePlanPricing();
  const { subscription } = useTenantPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const viewTracked = useRef(false);

  const currentPlanCode = subscription?.plan_code ?? null;

  // Track page view once plans load
  useEffect(() => {
    if (viewTracked.current || !plans.length) return;
    viewTracked.current = true;
    plans.forEach((p) => trackPricingEvent("plan_view", p.id, p.variant_id));
  }, [plans]);

  // Collect all feature keys across all plans, ordered
  const allFeatureKeys = Array.from(
    new Set(plans.flatMap((p) => p.features.map((f) => f.feature_key))),
  ).sort();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Sparkles} title="Planos" description="Carregando..." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-8 w-32 mb-4" />
              <Skeleton className="h-12 w-40 mb-6" />
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-5 w-full mb-2" />
              ))}
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!plans.length) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Sparkles} title="Planos" description="" />
        <EmptyState icon={Sparkles} title="Nenhum plano disponível" description="Os planos serão configurados pelo administrador." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Escolha o plano ideal para seu negócio"
        description="Aumente suas vendas, automatize processos e tenha controle total da sua operação solar."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={plan.code === currentPlanCode}
            allFeatureKeys={allFeatureKeys}
            onUpgrade={() => {
              trackPricingEvent("plan_click", plan.id, plan.variant_id);
              setUpgradeOpen(true);
            }}
          />
        ))}
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlanCode={currentPlanCode ?? undefined}
      />
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  allFeatureKeys,
  onUpgrade,
}: {
  plan: PricedPlan;
  isCurrent: boolean;
  allFeatureKeys: string[];
  onUpgrade: () => void;
}) {
  const featureMap = new Map(plan.features.map((f) => [f.feature_key, f.enabled]));
  const limitMap = new Map(plan.limits.map((l) => [l.limit_key, l.limit_value]));

  const isPopular = plan.is_popular;

  return (
    <Card
      className={`flex flex-col overflow-hidden transition-shadow ${
        isPopular
          ? "border-2 border-primary shadow-lg ring-1 ring-primary/20"
          : "border border-border"
      }`}
    >
      {/* Header */}
      <div className={`p-6 pb-4 ${isPopular ? "bg-primary/5" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
          {isPopular && (
            <Badge className="bg-primary text-primary-foreground text-xs gap-1">
              <Star className="w-3 h-3" /> ⭐ Mais popular
            </Badge>
          )}
        </div>
        {plan.description && (
          <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
        )}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-foreground">
            R$ {Number(plan.resolved_price_monthly).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </span>
          <span className="text-sm text-muted-foreground">/mês</span>
        </div>
        {plan.resolved_price_yearly != null && plan.resolved_price_yearly > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            ou R$ {Number(plan.resolved_price_yearly).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}/ano
          </p>
        )}
      </div>

      {/* Social proof for popular plan */}
      {isPopular && (
        <p className="px-6 pb-2 text-xs text-muted-foreground italic">
          Plano mais escolhido por empresas em crescimento
        </p>
      )}

      {/* Button */}
      <div className="px-6 pb-4">
        {isCurrent ? (
          <Button variant="outline" className="w-full" disabled>
            Plano atual
          </Button>
        ) : (
          <Button
            className="w-full gap-2"
            variant={isPopular ? "default" : "outline"}
            onClick={onUpgrade}
          >
            <Zap className="w-4 h-4" /> Desbloquear este plano
          </Button>
        )}
        {!isCurrent && (
          <p className="text-[11px] text-muted-foreground text-center mt-1.5">
            Evite bloqueios e mantenha sua operação fluindo
          </p>
        )}
      </div>

      {/* Limits */}
      <CardContent className="px-6 pb-4 pt-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Limites</p>
        <div className="space-y-1.5">
          {HIGHLIGHT_LIMITS.map((key) => {
            const val = limitMap.get(key);
            return (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{LIMIT_LABELS[key] ?? key}</span>
                <span className="font-medium text-foreground">{val != null ? formatLimitValue(val) : "—"}</span>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Features */}
      <CardContent className="px-6 pb-6 pt-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Features</p>
        <div className="space-y-1.5">
          {allFeatureKeys.map((key) => {
            const enabled = featureMap.get(key) ?? false;
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                {enabled ? (
                  <Check className="w-4 h-4 text-success shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                )}
                <span className={enabled ? "text-foreground" : "text-muted-foreground/50"}>
                  {FEATURE_LABELS[key] ?? key}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
