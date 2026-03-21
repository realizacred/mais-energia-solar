/**
 * BillingFeaturesPage — Admin page for plans, features, subscriptions, overrides.
 * §26: Header, §29: Tabs, §27: KPI cards, §4: Table shadcn, §12: Skeleton.
 */
import { useState } from "react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard, Package, Users, Settings2, Zap, Lock, Unlock,
} from "lucide-react";
import { useBillingPlans, useSaveBillingPlan, useToggleBillingPlan, type BillingPlan } from "@/hooks/useBillingPlans";
import { useFeatureCatalog, useSaveFeatureFlag, useToggleFeatureFlag, type FeatureFlag } from "@/hooks/useFeatureCatalog";
import { usePlanFeatures, useTogglePlanFeature } from "@/hooks/usePlanFeatures";
import { useTenantSubscriptionsAdmin, useUpdateSubscription } from "@/hooks/useTenantSubscriptions";
import { useTenantFeatureOverridesAdmin, useUpsertTenantOverride, useDeleteTenantOverride } from "@/hooks/useTenantFeatureOverrides";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/dateUtils";

// ─── PLANS TAB ───────────────────────────────────────────────

function PlansTab() {
  const { data: plans = [], isLoading } = useBillingPlans();
  const toggleMut = useToggleBillingPlan();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>;
  if (!plans.length) return <EmptyState icon={CreditCard} title="Nenhum plano cadastrado" description="Planos serão criados automaticamente pelo sistema." />;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold text-foreground">Nome</TableHead>
            <TableHead className="font-semibold text-foreground">Código</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Mensal</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Anual</TableHead>
            <TableHead className="font-semibold text-foreground">Status</TableHead>
            <TableHead className="font-semibold text-foreground">Features</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((p) => (
            <TableRow key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedPlanId(p.id)}>
              <TableCell className="font-medium text-foreground">{p.name}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs font-mono">{p.code}</Badge></TableCell>
              <TableCell className="text-right font-mono">R$ {Number(p.price_monthly).toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono">{p.price_yearly ? `R$ ${Number(p.price_yearly).toFixed(2)}` : "—"}</TableCell>
              <TableCell>
                <Switch checked={p.is_active} onCheckedChange={(v) => toggleMut.mutate({ id: p.id, is_active: v })} />
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); setSelectedPlanId(p.id); }}>
                  Gerenciar Features
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedPlanId && (
        <PlanFeaturesPanel planId={selectedPlanId} planName={plans.find((p) => p.id === selectedPlanId)?.name ?? ""} onClose={() => setSelectedPlanId(null)} />
      )}
    </div>
  );
}

// ─── PLAN FEATURES PANEL ─────────────────────────────────────

function PlanFeaturesPanel({ planId, planName, onClose }: { planId: string; planName: string; onClose: () => void }) {
  const { data: features = [] } = useFeatureCatalog();
  const { data: planFeatures = [], isLoading } = usePlanFeatures(planId);
  const toggleMut = useTogglePlanFeature();

  const enabledMap = new Map(planFeatures.map((pf) => [pf.feature_key, pf.enabled]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Features do plano: {planName}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
        ) : (
          <div className="space-y-2">
            {features.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.feature_key} {f.category ? `• ${f.category}` : ""}</p>
                </div>
                <Switch
                  checked={enabledMap.get(f.feature_key) ?? false}
                  onCheckedChange={(v) => toggleMut.mutate({ planId, featureKey: f.feature_key, enabled: v })}
                  disabled={toggleMut.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── FEATURES CATALOG TAB ────────────────────────────────────

function FeaturesCatalogTab() {
  const { data: features = [], isLoading } = useFeatureCatalog();
  const toggleMut = useToggleFeatureFlag();
  const [editFeature, setEditFeature] = useState<FeatureFlag | null>(null);

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>;
  if (!features.length) return <EmptyState icon={Package} title="Nenhuma feature cadastrada" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditFeature({ id: "", feature_key: "", name: "", description: null, category: null, is_active: true, created_at: "", updated_at: "" })}>
          + Nova Feature
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold text-foreground">Nome</TableHead>
            <TableHead className="font-semibold text-foreground">Chave</TableHead>
            <TableHead className="font-semibold text-foreground">Categoria</TableHead>
            <TableHead className="font-semibold text-foreground">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((f) => (
            <TableRow key={f.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setEditFeature(f)}>
              <TableCell className="font-medium text-foreground">{f.name}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs font-mono">{f.feature_key}</Badge></TableCell>
              <TableCell className="text-muted-foreground text-sm">{f.category ?? "—"}</TableCell>
              <TableCell>
                <Switch checked={f.is_active} onCheckedChange={(v) => { toggleMut.mutate({ id: f.id, is_active: v }); }} onClick={(e) => e.stopPropagation()} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editFeature && <EditFeatureModal feature={editFeature} onClose={() => setEditFeature(null)} />}
    </div>
  );
}

function EditFeatureModal({ feature, onClose }: { feature: FeatureFlag; onClose: () => void }) {
  const saveMut = useSaveFeatureFlag();
  const { toast } = useToast();
  const [form, setForm] = useState({
    feature_key: feature.feature_key,
    name: feature.name,
    description: feature.description ?? "",
    category: feature.category ?? "",
  });

  const handleSave = async () => {
    try {
      await saveMut.mutateAsync({ ...form, id: feature.id || undefined } as any);
      toast({ title: "Feature salva com sucesso!" });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">{feature.id ? "Editar Feature" : "Nova Feature"}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Defina os dados do recurso</p>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Chave (feature_key)</Label>
              <Input value={form.feature_key} onChange={(e) => setForm({ ...form, feature_key: e.target.value })} disabled={!!feature.id} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saveMut.isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saveMut.isPending || !form.feature_key || !form.name}>
            {saveMut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── SUBSCRIPTIONS TAB ───────────────────────────────────────

function SubscriptionsTab() {
  const { data: subs = [], isLoading } = useTenantSubscriptionsAdmin();
  const { data: plans = [] } = useBillingPlans();
  const updateMut = useUpdateSubscription();
  const { toast } = useToast();

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>;
  if (!subs.length) return <EmptyState icon={Users} title="Nenhuma assinatura encontrada" />;

  const statusColor = (s: string) => {
    if (s === "active") return "text-success";
    if (s === "trialing") return "text-info";
    if (s === "past_due") return "text-warning";
    return "text-destructive";
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead className="font-semibold text-foreground">Tenant</TableHead>
          <TableHead className="font-semibold text-foreground">Plano</TableHead>
          <TableHead className="font-semibold text-foreground">Status</TableHead>
          <TableHead className="font-semibold text-foreground">Período</TableHead>
          <TableHead className="font-semibold text-foreground">Trial</TableHead>
          <TableHead className="font-semibold text-foreground">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subs.map((s) => (
          <TableRow key={s.id} className="hover:bg-muted/30">
            <TableCell className="font-medium text-foreground">{(s as any).tenants?.nome ?? s.tenant_id.slice(0, 8)}</TableCell>
            <TableCell><Badge variant="outline" className="text-xs">{(s as any).plans?.name ?? "—"}</Badge></TableCell>
            <TableCell><Badge variant="outline" className={`text-xs ${statusColor(s.status)}`}>{s.status}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDateTime(s.current_period_start)} — {formatDateTime(s.current_period_end)}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{s.trial_ends_at ? formatDateTime(s.trial_ends_at) : "—"}</TableCell>
            <TableCell>
              <Select
                value={s.plan_id}
                onValueChange={(newPlanId) => {
                  updateMut.mutate({ id: s.id, plan_id: newPlanId }, {
                    onSuccess: () => toast({ title: "Plano atualizado!" }),
                    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
                  });
                }}
              >
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── OVERRIDES TAB ───────────────────────────────────────────

function OverridesTab() {
  const { data: subs = [] } = useTenantSubscriptionsAdmin();
  const { data: features = [] } = useFeatureCatalog();
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const { data: overrides = [], isLoading } = useTenantFeatureOverridesAdmin(selectedTenant);
  const upsertMut = useUpsertTenantOverride();
  const deleteMut = useDeleteTenantOverride();
  const { toast } = useToast();

  const overrideMap = new Map(overrides.map((o) => [(o as any).feature_flags_catalog?.feature_key, o]));

  const uniqueTenants = Array.from(new Map(subs.map((s) => [s.tenant_id, { id: s.tenant_id, nome: (s as any).tenants?.nome ?? s.tenant_id.slice(0, 8) }])).values());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label>Tenant:</Label>
        <Select value={selectedTenant ?? ""} onValueChange={(v) => setSelectedTenant(v || null)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione um tenant..." />
          </SelectTrigger>
          <SelectContent>
            {uniqueTenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!selectedTenant && <EmptyState icon={Settings2} title="Selecione um tenant" description="Escolha um tenant para gerenciar overrides de features." />}

      {selectedTenant && isLoading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>}

      {selectedTenant && !isLoading && (
        <div className="space-y-2">
          {features.filter((f) => f.is_active).map((f) => {
            const override = overrideMap.get(f.feature_key);
            const hasOverride = !!override;
            const isEnabled = hasOverride ? (override as any).enabled : undefined;

            return (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.feature_key} {f.category ? `• ${f.category}` : ""}</p>
                  {hasOverride && (
                    <Badge variant="outline" className={`text-xs mt-1 ${isEnabled ? "text-success" : "text-destructive"}`}>
                      Override: {isEnabled ? "Habilitado" : "Desabilitado"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => {
                      upsertMut.mutate(
                        { tenantId: selectedTenant, featureId: f.id, enabled: true, reason: "Override manual" },
                        { onSuccess: () => toast({ title: "Feature habilitada!" }) }
                      );
                    }}
                  >
                    <Unlock className="w-3 h-3" /> Liberar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      upsertMut.mutate(
                        { tenantId: selectedTenant, featureId: f.id, enabled: false, reason: "Override manual" },
                        { onSuccess: () => toast({ title: "Feature bloqueada!" }) }
                      );
                    }}
                  >
                    <Lock className="w-3 h-3" /> Bloquear
                  </Button>
                  {hasOverride && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => {
                        deleteMut.mutate(
                          { id: (override as any).id, tenantId: selectedTenant },
                          { onSuccess: () => toast({ title: "Override removido!" }) }
                        );
                      }}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────

export default function BillingFeaturesPage() {
  const { data: plans = [], isLoading: plansLoading } = useBillingPlans();
  const { data: features = [], isLoading: featuresLoading } = useFeatureCatalog();
  const { data: subs = [], isLoading: subsLoading } = useTenantSubscriptionsAdmin();

  const activePlans = plans.filter((p) => p.is_active).length;
  const activeFeatures = features.filter((f) => f.is_active).length;
  const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trialing").length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CreditCard}
        title="Planos e Features"
        description="Gerencie monetização, módulos liberados e acesso por tenant"
      />

      {/* KPI Cards §27 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {plansLoading || featuresLoading || subsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))
        ) : (
          <>
            <StatCard icon={CreditCard} label="Planos ativos" value={activePlans} color="primary" />
            <StatCard icon={Package} label="Features ativas" value={activeFeatures} color="info" />
            <StatCard icon={Users} label="Assinaturas ativas" value={activeSubs} color="success" />
            <StatCard icon={Settings2} label="Total features" value={features.length} color="muted" />
          </>
        )}
      </div>

      {/* Tabs §29 */}
      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Planos</TabsTrigger>
          <TabsTrigger value="features">Catálogo de Features</TabsTrigger>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="overrides">Overrides por Tenant</TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="mt-4"><PlansTab /></TabsContent>
        <TabsContent value="features" className="mt-4"><FeaturesCatalogTab /></TabsContent>
        <TabsContent value="subscriptions" className="mt-4"><SubscriptionsTab /></TabsContent>
        <TabsContent value="overrides" className="mt-4"><OverridesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
