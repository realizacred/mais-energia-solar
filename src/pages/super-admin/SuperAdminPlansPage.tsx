/**
 * SuperAdminPlansPage — Catálogo comercial de planos.
 * SSOT: plans + plan_features + plan_limits + feature_flags_catalog + subscriptions.
 * Reusa hooks existentes (useBillingPlans, usePlanFeatures, usePlanLimitsAdmin,
 * useFeatureCatalog, useTogglePlanFeature, useUpsertPlanLimit, useToggleBillingPlan).
 * Nada de mock — RB-76 (sem duplicação) + AGENTS §16/§17.
 */
import { useMemo, useState } from "react";
import { Package, Check, X, Pencil, Star, CheckCircle2, Users, DollarSign, Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SectionCard, LoadingState, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useBillingPlans, useSaveBillingPlan, useToggleBillingPlan, type BillingPlan } from "@/hooks/useBillingPlans";
import { useFeatureCatalog } from "@/hooks/useFeatureCatalog";
import { useTogglePlanFeature } from "@/hooks/usePlanFeatures";
import { useUpsertPlanLimit } from "@/hooks/usePlanLimitsAdmin";

const STALE = 60_000;

interface PlanFeatureRow { plan_id: string; feature_key: string; enabled: boolean }
interface PlanLimitRow { plan_id: string; limit_key: string; limit_value: number }
interface SubCount { plan_id: string; total: number }

function useAllPlanFeatures() {
  return useQuery({
    queryKey: ["all-plan-features"],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_features").select("plan_id, feature_key, enabled");
      if (error) throw error;
      return (data ?? []) as PlanFeatureRow[];
    },
  });
}
function useAllPlanLimits() {
  return useQuery({
    queryKey: ["all-plan-limits"],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_limits").select("plan_id, limit_key, limit_value");
      if (error) throw error;
      return (data ?? []) as PlanLimitRow[];
    },
  });
}
function useSubscriptionCounts() {
  return useQuery({
    queryKey: ["sa-plan-subscription-counts"],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan_id, status")
        .in("status", ["active", "trialing", "past_due"]);
      if (error) throw error;
      const map = new Map<string, number>();
      (data ?? []).forEach((r: any) => map.set(r.plan_id, (map.get(r.plan_id) ?? 0) + 1));
      return Array.from(map.entries()).map(([plan_id, total]) => ({ plan_id, total })) as SubCount[];
    },
  });
}

const LIMIT_LABELS: Record<string, string> = {
  max_users: "Usuários",
  max_leads_month: "Leads / mês",
  max_proposals_month: "Propostas / mês",
  max_wa_messages_month: "Mensagens WhatsApp / mês",
  max_ai_insights_month: "AI Insights / mês",
  max_automations: "Automações ativas",
  max_reports_pdf_month: "Relatórios PDF / mês",
  max_ucs_monitored: "UCs monitoradas",
  max_storage_mb: "Armazenamento (MB)",
  max_performance_alerts: "Alertas de performance",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtLimit(v: number) {
  if (v >= 999999) return "Ilimitado";
  if (v === 0) return "—";
  return v.toLocaleString("pt-BR");
}

export default function SuperAdminPlansPage() {
  const { data: plans = [], isLoading: plansLoading } = useBillingPlans();
  const { data: catalog = [], isLoading: catLoading } = useFeatureCatalog();
  const { data: planFeatures = [] } = useAllPlanFeatures();
  const { data: planLimits = [] } = useAllPlanLimits();
  const { data: subCounts = [] } = useSubscriptionCounts();

  const toggleFeature = useTogglePlanFeature();
  const upsertLimit = useUpsertPlanLimit();
  const togglePlan = useToggleBillingPlan();
  const savePlan = useSaveBillingPlan();

  const [editPlan, setEditPlan] = useState<BillingPlan | null>(null);
  const [planForm, setPlanForm] = useState({ name: "", description: "", price_monthly: 0, price_yearly: 0, is_popular: false });

  const featByPlan = useMemo(() => {
    const map = new Map<string, Map<string, boolean>>();
    planFeatures.forEach((f) => {
      if (!map.has(f.plan_id)) map.set(f.plan_id, new Map());
      map.get(f.plan_id)!.set(f.feature_key, f.enabled);
    });
    return map;
  }, [planFeatures]);

  const limByPlan = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    planLimits.forEach((l) => {
      if (!map.has(l.plan_id)) map.set(l.plan_id, new Map());
      map.get(l.plan_id)!.set(l.limit_key, l.limit_value);
    });
    return map;
  }, [planLimits]);

  const subByPlan = useMemo(() => {
    const map = new Map<string, number>();
    subCounts.forEach((s) => map.set(s.plan_id, s.total));
    return map;
  }, [subCounts]);

  const limitKeys = useMemo(() => {
    const set = new Set<string>();
    planLimits.forEach((l) => set.add(l.limit_key));
    Object.keys(LIMIT_LABELS).forEach((k) => set.add(k));
    return Array.from(set).sort();
  }, [planLimits]);

  const catByCategory = useMemo(() => {
    const map = new Map<string, typeof catalog>();
    catalog.forEach((c: any) => {
      const cat = c.category ?? "Outros";
      if (!map.has(cat)) map.set(cat, [] as any);
      map.get(cat)!.push(c);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  if (plansLoading || catLoading) return <LoadingState message="Carregando catálogo de planos..." />;

  const activePlans = plans.filter((p) => p.is_active);
  const totalSubs = subCounts.reduce((acc, s) => acc + s.total, 0);
  const mrr = subCounts.reduce((acc, s) => {
    const p = plans.find((pl) => pl.id === s.plan_id);
    return acc + (p?.price_monthly ?? 0) * s.total;
  }, 0);

  function openEditPlan(p: BillingPlan) {
    setEditPlan(p);
    setPlanForm({
      name: p.name,
      description: p.description ?? "",
      price_monthly: Number(p.price_monthly),
      price_yearly: Number(p.price_yearly ?? 0),
      is_popular: p.is_popular,
    });
  }

  async function handleSavePlan() {
    if (!editPlan) return;
    await savePlan.mutateAsync({
      id: editPlan.id,
      code: editPlan.code,
      name: planForm.name,
      description: planForm.description || null,
      price_monthly: planForm.price_monthly,
      price_yearly: planForm.price_yearly || null,
      is_popular: planForm.is_popular,
    } as any);
    setEditPlan(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Planos & Features"
        description="Catálogo comercial: o que cada plano vende, quanto custa e quem está assinando"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Planos ativos" value={activePlans.length} icon={Package} variant="default" />
        <StatCard label="Assinaturas ativas" value={totalSubs} icon={Users} variant="success" />
        <StatCard label="MRR estimado" value={fmtBRL(mrr)} icon={DollarSign} variant="success" />
        <StatCard label="Features no catálogo" value={catalog.length} icon={CheckCircle2} variant="default" />
      </div>

      {/* Cards de planos */}
      <SectionCard icon={Package} title="Planos comerciais" description="Configurações de venda — preço, popularidade e status" variant="orange">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const subs = subByPlan.get(p.id) ?? 0;
            const featCount = Array.from(featByPlan.get(p.id)?.values() ?? []).filter(Boolean).length;
            return (
              <div
                key={p.id}
                className={`rounded-lg border-l-4 p-4 bg-card transition-all ${
                  p.is_popular ? "border-l-primary shadow-md" : "border-l-border"
                } ${!p.is_active ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                      {p.is_popular && <Star className="h-4 w-4 fill-primary text-primary" />}
                    </div>
                    <code className="text-[10px] text-muted-foreground">{p.code}</code>
                  </div>
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={(v) => togglePlan.mutate({ id: p.id, is_active: v })}
                  />
                </div>
                <div className="my-3">
                  <div className="text-2xl font-bold text-primary">{fmtBRL(Number(p.price_monthly))}</div>
                  <div className="text-xs text-muted-foreground">por mês</div>
                  {p.price_yearly && Number(p.price_yearly) > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      ou {fmtBRL(Number(p.price_yearly))}/ano
                    </div>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>
                )}
                <div className="flex items-center justify-between text-xs border-t pt-2">
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{featCount}</strong> features
                  </span>
                  <Badge variant={subs > 0 ? "default" : "outline"} className="text-[10px]">
                    {subs} assinante{subs !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => openEditPlan(p)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Editar
                </Button>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Matriz */}
      <Tabs defaultValue="features">
        <TabsList>
          <TabsTrigger value="features">Matriz de Features</TabsTrigger>
          <TabsTrigger value="limits">Matriz de Limites</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="mt-4">
          <SectionCard
            icon={CheckCircle2}
            title="O que cada plano oferece"
            description="Toggle direto na matriz para ativar/desativar feature por plano"
            variant="green"
          >
            <div className="space-y-6">
              {catByCategory.map(([cat, items]) => (
                <div key={cat}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {cat}
                  </h4>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[260px]">Feature</TableHead>
                          {plans.map((p) => (
                            <TableHead key={p.id} className="text-center min-w-[100px]">
                              {p.name}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(items as any[]).map((f) => (
                          <TableRow key={f.feature_key}>
                            <TableCell>
                              <div className="font-medium text-sm">{f.name}</div>
                              {f.description && (
                                <div className="text-xs text-muted-foreground">{f.description}</div>
                              )}
                            </TableCell>
                            {plans.map((p) => {
                              const enabled = featByPlan.get(p.id)?.get(f.feature_key) ?? false;
                              return (
                                <TableCell key={p.id} className="text-center">
                                  <button
                                    onClick={() =>
                                      toggleFeature.mutate({
                                        planId: p.id,
                                        featureKey: f.feature_key,
                                        enabled: !enabled,
                                      })
                                    }
                                    className="inline-flex items-center justify-center"
                                    title={enabled ? "Desabilitar" : "Habilitar"}
                                  >
                                    {enabled ? (
                                      <Check className="h-5 w-5 text-success" />
                                    ) : (
                                      <X className="h-5 w-5 text-muted-foreground/40" />
                                    )}
                                  </button>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="limits" className="mt-4">
          <SectionCard
            icon={DollarSign}
            title="Limites por plano"
            description="Edite valores diretamente. 999999 = ilimitado, 0 = bloqueado."
            variant="blue"
          >
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">Limite</TableHead>
                    {plans.map((p) => (
                      <TableHead key={p.id} className="text-center min-w-[140px]">
                        {p.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limitKeys.map((lk) => (
                    <TableRow key={lk}>
                      <TableCell>
                        <div className="font-medium text-sm">{LIMIT_LABELS[lk] ?? lk}</div>
                        <code className="text-[10px] text-muted-foreground">{lk}</code>
                      </TableCell>
                      {plans.map((p) => {
                        const val = limByPlan.get(p.id)?.get(lk) ?? 0;
                        return (
                          <TableCell key={p.id} className="text-center">
                            <LimitInlineEditor
                              value={val}
                              display={fmtLimit(val)}
                              onSave={(newVal) =>
                                upsertLimit.mutate({ planId: p.id, limitKey: lk, limitValue: newVal })
                              }
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Edit plan dialog */}
      <Dialog open={!!editPlan} onOpenChange={(o) => !o && setEditPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar plano</DialogTitle>
            <DialogDescription>
              Configurações comerciais do plano <code>{editPlan?.code}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={planForm.name} onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={planForm.description}
                onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Para quem é este plano?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço mensal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={planForm.price_monthly}
                  onChange={(e) => setPlanForm((f) => ({ ...f, price_monthly: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Preço anual (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={planForm.price_yearly}
                  onChange={(e) => setPlanForm((f) => ({ ...f, price_yearly: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Plano em destaque</Label>
                <p className="text-xs text-muted-foreground">Marca como "popular" na pricing page</p>
              </div>
              <Switch
                checked={planForm.is_popular}
                onCheckedChange={(v) => setPlanForm((f) => ({ ...f, is_popular: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlan(null)}>Cancelar</Button>
            <Button onClick={handleSavePlan} disabled={savePlan.isPending}>
              <Save className="h-4 w-4 mr-1.5" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LimitInlineEditor({
  value, display, onSave,
}: { value: number; display: string; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (!editing) {
    return (
      <button
        className="text-sm font-medium hover:underline"
        onClick={() => { setV(value); setEditing(true); }}
      >
        {display}
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1">
      <Input
        type="number"
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        className="h-7 w-20 text-xs text-center"
        autoFocus
      />
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { onSave(v); setEditing(false); }}>
        <Check className="h-3.5 w-3.5 text-success" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
