import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
import { DollarSign, Plus, Users, CreditCard, CheckCircle, XCircle, Clock, Crown, Zap, Shield } from "lucide-react";
import { toast } from "sonner";
import { listSubscriptions, createSubscription, updateSubscription, listBillingRecords, createBillingRecord, updateBillingRecord } from "@/services/monitoring/monitorBillingService";
import type { MonitorSubscription, MonitorBillingRecord } from "@/services/monitoring/monitorBillingService";
import { formatBRL, formatDate } from "@/lib/formatters/index";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const STATUS_MAP: Record<string, { label: string; variant: string }> = {
  active: { label: "Ativo", variant: "success" },
  trialing: { label: "Trial", variant: "info" },
  trial: { label: "Trial", variant: "info" },
  past_due: { label: "Pendente", variant: "warning" },
  suspended: { label: "Suspenso", variant: "warning" },
  cancelled: { label: "Cancelado", variant: "error" },
  canceled: { label: "Cancelado", variant: "error" },
};

const BILLING_STATUS_MAP: Record<string, { label: string; icon: React.ElementType }> = {
  pending: { label: "Pendente", icon: Clock },
  paid: { label: "Pago", icon: CheckCircle },
  overdue: { label: "Vencido", icon: XCircle },
  cancelled: { label: "Cancelado", icon: XCircle },
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  basic: Shield,
  pro: Zap,
  premium: Crown,
};

interface MonitorPlan {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  currency: string;
  interval: string;
  features: Record<string, unknown>;
  max_plants: number | null;
  is_active: boolean;
  display_order: number;
}

export default function MonitorBilling() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<"subscriptions" | "plans">("subscriptions");

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["monitor-subscriptions"],
    queryFn: listSubscriptions,
  });

  const { data: billingRecords = [] } = useQuery({
    queryKey: ["monitor-billing-records"],
    queryFn: () => listBillingRecords(),
  });

  const { data: plans = [] } = useQuery<MonitorPlan[]>({
    queryKey: ["monitor-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitor_plans" as any)
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data as unknown as MonitorPlan[]) || [];
    },
  });

  const createMut = useMutation({
    mutationFn: createSubscription,
    onSuccess: () => {
      toast.success("Assinatura criada!");
      queryClient.invalidateQueries({ queryKey: ["monitor-subscriptions"] });
      setShowCreate(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MonitorSubscription> }) =>
      updateSubscription(id, updates),
    onSuccess: () => {
      toast.success("Assinatura atualizada!");
      queryClient.invalidateQueries({ queryKey: ["monitor-subscriptions"] });
    },
  });

  const generateBillingMut = useMutation({
    mutationFn: async (sub: MonitorSubscription) => {
      const now = new Date();
      await createBillingRecord({
        subscription_id: sub.id,
        reference_month: now.getMonth() + 1,
        reference_year: now.getFullYear(),
        amount_brl: sub.price_brl,
        status: "pending",
        due_date: new Date(now.getFullYear(), now.getMonth() + 1, 10).toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      toast.success("Cobrança gerada!");
      queryClient.invalidateQueries({ queryKey: ["monitor-billing-records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaidMut = useMutation({
    mutationFn: (id: string) => updateBillingRecord(id, { status: "paid", paid_at: new Date().toISOString() }),
    onSuccess: () => {
      toast.success("Marcado como pago!");
      queryClient.invalidateQueries({ queryKey: ["monitor-billing-records"] });
    },
  });

  if (isLoading) return <LoadingState message="Carregando cobranças..." />;

  const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trial" || s.status === "trialing");
  const totalMRR = activeSubs.reduce((s, sub) => s + sub.price_brl, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobranças de Monitoramento"
        description="Gerencie planos, assinaturas e cobranças"
        icon={DollarSign}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nova Assinatura
          </Button>
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50 border border-border/60 w-fit">
        {[
          { key: "subscriptions" as const, label: "Assinaturas" },
          { key: "plans" as const, label: "Planos" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const PlanIcon = PLAN_ICONS[plan.slug] || Shield;
            const features = plan.features as Record<string, unknown>;
            const alerts = (features.alerts as string[]) || [];
            return (
              <div key={plan.id} className={cn(
                "rounded-xl border-2 p-6 space-y-4 transition-all",
                plan.slug === "pro"
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border/60 bg-card"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-lg",
                    plan.slug === "premium" ? "bg-warning/10 text-warning" :
                    plan.slug === "pro" ? "bg-primary/10 text-primary" :
                    "bg-muted text-muted-foreground"
                  )}>
                    <PlanIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{plan.name}</h3>
                    {plan.slug === "pro" && (
                      <Badge variant="default" className="text-2xs mt-0.5">Mais popular</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-3xl font-bold text-foreground">
                    {formatBRL(plan.price_cents / 100)}
                  </span>
                  <span className="text-sm text-muted-foreground">/mês por usina</span>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-success shrink-0" />
                    {alerts.length} tipos de alerta
                  </li>
                  {features.channels && (
                    <li className="flex items-center gap-2 text-foreground">
                      <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      Canais MPPT/String
                    </li>
                  )}
                  {features.whatsapp && (
                    <li className="flex items-center gap-2 text-foreground">
                      <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      Notificações WhatsApp
                    </li>
                  )}
                  {features.reports && (
                    <li className="flex items-center gap-2 text-foreground">
                      <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      Relatórios avançados
                    </li>
                  )}
                  {features.sla && (
                    <li className="flex items-center gap-2 text-foreground">
                      <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      SLA garantido
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {tab === "subscriptions" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniCard label="Assinaturas Ativas" value={String(activeSubs.length)} />
            <MiniCard label="MRR (Receita Mensal)" value={formatBRL(totalMRR)} />
            <MiniCard label="Cobranças Pendentes" value={String(billingRecords.filter((b) => b.status === "pending").length)} />
            <MiniCard label="Cobranças Pagas (Mês)" value={String(billingRecords.filter((b) => b.status === "paid").length)} />
          </div>

          {subs.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="Nenhuma assinatura"
              description="Crie uma assinatura de monitoramento para começar a cobrar clientes."
              action={{ label: "Nova Assinatura", onClick: () => setShowCreate(true), icon: Plus }}
            />
          ) : (
            <>
              <SectionCard title={`Assinaturas (${subs.length})`} icon={Users}>
                <div className="space-y-2">
                  {subs.map((sub) => {
                    const st = STATUS_MAP[sub.status] || { label: sub.status, variant: "default" };
                    return (
                      <div key={sub.id} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-all">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{sub.plan_name}</p>
                            <StatusBadge status={st.label} size="sm" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatBRL(sub.price_brl)}/{sub.billing_cycle === "monthly" ? "mês" : sub.billing_cycle === "quarterly" ? "tri" : "ano"}
                            {" · "}Desde {formatDate(sub.started_at)}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => generateBillingMut.mutate(sub)} className="text-xs h-7">
                            <CreditCard className="h-3 w-3 mr-1" />
                            Gerar Cobrança
                          </Button>
                          {sub.status === "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 text-destructive"
                              onClick={() => updateMut.mutate({ id: sub.id, updates: { status: "suspended" } })}
                            >
                              Suspender
                            </Button>
                          )}
                          {(sub.status === "suspended" || sub.status === "past_due") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 text-success"
                              onClick={() => updateMut.mutate({ id: sub.id, updates: { status: "active" } })}
                            >
                              Reativar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              {billingRecords.length > 0 && (
                <SectionCard title="Histórico de Cobranças" icon={CreditCard}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="py-2 px-3 font-medium">Ref.</th>
                          <th className="py-2 px-3 font-medium text-right">Valor</th>
                          <th className="py-2 px-3 font-medium">Vencimento</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                          <th className="py-2 px-3 font-medium text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingRecords.map((rec) => {
                          const bs = BILLING_STATUS_MAP[rec.status] || { label: rec.status, icon: Clock };
                          const BIcon = bs.icon;
                          return (
                            <tr key={rec.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 px-3">{String(rec.reference_month).padStart(2, "0")}/{rec.reference_year}</td>
                              <td className="py-2.5 px-3 text-right font-medium">{formatBRL(rec.amount_brl)}</td>
                              <td className="py-2.5 px-3 text-muted-foreground">{rec.due_date ? formatDate(rec.due_date) : "—"}</td>
                              <td className="py-2.5 px-3">
                                <Badge variant={rec.status === "paid" ? "default" : rec.status === "overdue" ? "destructive" : "outline"} className="text-2xs">
                                  <BIcon className="h-3 w-3 mr-1" />
                                  {bs.label}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {rec.status === "pending" && (
                                  <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => markPaidMut.mutate(rec.id)}>
                                    Marcar Pago
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}
            </>
          )}
        </>
      )}

      <CreateSubscriptionModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={(data) => createMut.mutate(data)}
        saving={createMut.isPending}
      />
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 ring-1 ring-primary/10">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-lg font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

function CreateSubscriptionModal({
  open,
  onOpenChange,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: Partial<MonitorSubscription>) => void;
  saving: boolean;
}) {
  const [planName, setPlanName] = useState("Monitoramento Básico");
  const [price, setPrice] = useState("49.90");
  const [cycle, setCycle] = useState("monthly");
  const [maxPlants, setMaxPlants] = useState("10");

  const handleSubmit = () => {
    onSubmit({
      plan_name: planName,
      price_brl: parseFloat(price) || 0,
      billing_cycle: cycle,
      max_plants: parseInt(maxPlants) || 10,
      status: "active",
    });
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={onOpenChange}
      title="Nova Assinatura de Monitoramento"
      submitLabel="Criar Assinatura"
      onSubmit={handleSubmit}
      saving={saving}
      asForm
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nome do Plano</Label>
          <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Ex: Monitoramento Pro" />
        </div>
        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49.90" />
        </div>
        <div className="space-y-1.5">
          <Label>Ciclo de Cobrança</Label>
          <Select value={cycle} onValueChange={setCycle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Máx. Usinas</Label>
          <Input type="number" value={maxPlants} onChange={(e) => setMaxPlants(e.target.value)} placeholder="10" />
        </div>
      </div>
    </FormModalTemplate>
  );
}
