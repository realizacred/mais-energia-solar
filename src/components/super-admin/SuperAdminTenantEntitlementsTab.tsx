/**
 * SuperAdminTenantEntitlementsTab — PR-3
 * Aba unificada (sub-tabs horizontais) para gerenciar Features, Limits, Usage e Health
 * de um tenant específico. SSOT via super_admin_get_tenant_entitlements.
 * Sem mocks. Sem estado fake.
 */
import { useMemo, useState } from "react";
import {
  ShieldCheck, Gauge, Activity, Heart, RotateCw, ToggleLeft,
  ToggleRight, AlertTriangle, CheckCircle2, Clock, Zap,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { LoadingState, EmptyState, SectionCard, StatCard } from "@/components/ui-kit";
import {
  useTenantEntitlements,
  useTenantUsageEvents,
  useSetFeatureOverride,
  useSetLimitOverride,
  useResetUsage,
  type EntitlementsFeature,
  type EntitlementsLimit,
} from "@/hooks/super-admin/useSuperAdminEntitlements";
import { formatDateTime } from "@/lib/dateUtils";

const LOCK_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  none: "success", soft: "warning", hard: "destructive",
};

interface Props { tenantId: string }

function pct(current: number, limit: number | null) {
  if (limit == null || limit < 0) return 0;
  if (limit === 0) return 100;
  return Math.min(100, Math.round((current / limit) * 100));
}

export function SuperAdminTenantEntitlementsTab({ tenantId }: Props) {
  const { data, isLoading, error } = useTenantEntitlements(tenantId);
  const { data: events = [] } = useTenantUsageEvents(tenantId, 50);
  const setFeature = useSetFeatureOverride();
  const setLimit = useSetLimitOverride();
  const resetUsage = useResetUsage();

  const [editLimit, setEditLimit] = useState<EntitlementsLimit | null>(null);
  const [limitForm, setLimitForm] = useState({ value: 0, reason: "", expires: "" });

  const limitsView = useMemo(() => data?.limits ?? [], [data]);

  if (isLoading) return <LoadingState message="Carregando entitlements..." />;
  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erro ao carregar"
        description={(error as Error).message}
      />
    );
  }
  if (!data) return null;

  const handleToggleFeature = (f: EntitlementsFeature) => {
    const newEnabled = !f.effective;
    setFeature.mutate({
      tenant_id: tenantId,
      feature_key: f.feature_key,
      enabled: newEnabled,
      source: "manual",
      reason: "Toggled by Super Admin",
    });
  };

  const openEditLimit = (l: EntitlementsLimit) => {
    setEditLimit(l);
    setLimitForm({
      value: l.effective_limit ?? l.plan_limit ?? 0,
      reason: l.override_reason ?? "",
      expires: l.override_expires_at?.slice(0, 10) ?? "",
    });
  };

  const submitLimit = () => {
    if (!editLimit) return;
    setLimit.mutate(
      {
        tenant_id: tenantId,
        limit_key: editLimit.limit_key,
        limit_value: Number(limitForm.value),
        expires_at: limitForm.expires ? new Date(limitForm.expires).toISOString() : null,
        reason: limitForm.reason || null,
      },
      { onSuccess: () => setEditLimit(null) },
    );
  };

  const featuresByCategory = useMemo(() => {
    const g: Record<string, EntitlementsFeature[]> = {};
    for (const f of data.features) {
      const k = f.category ?? "geral";
      (g[k] = g[k] ?? []).push(f);
    }
    return g;
  }, [data.features]);

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={Heart}
          label="Health Score"
          value={`${data.health.score}/100`}
          color={data.health.score >= 80 ? "success" : data.health.score >= 50 ? "warning" : "destructive"}
        />
        <StatCard
          icon={ShieldCheck}
          label="Lock Level"
          value={data.lock_state.level.toUpperCase()}
          color={data.lock_state.level === "none" ? "success" : data.lock_state.level === "soft" ? "warning" : "destructive"}
          subtitle={data.lock_state.reason}
        />
        <StatCard
          icon={Activity}
          label="Eventos (últimos)"
          value={String(events.length)}
        />
      </div>

      <Tabs defaultValue="features" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="features"><ShieldCheck className="w-4 h-4 mr-1" />Features</TabsTrigger>
          <TabsTrigger value="limits"><Gauge className="w-4 h-4 mr-1" />Limits</TabsTrigger>
          <TabsTrigger value="usage"><Activity className="w-4 h-4 mr-1" />Usage</TabsTrigger>
          <TabsTrigger value="health"><Heart className="w-4 h-4 mr-1" />Health</TabsTrigger>
        </TabsList>

        {/* FEATURES */}
        <TabsContent value="features" className="space-y-3 pt-4">
          {Object.entries(featuresByCategory).map(([cat, list]) => (
            <SectionCard key={cat} title={cat.toUpperCase()}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Override</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead className="text-right">Efetivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((f) => (
                    <TableRow key={f.feature_key}>
                      <TableCell>
                        <div className="font-medium text-foreground text-sm">{f.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{f.feature_key}</div>
                      </TableCell>
                      <TableCell>
                        {f.plan_enabled === null ? (
                          <Badge variant="outline">—</Badge>
                        ) : f.plan_enabled ? (
                          <Badge variant="default">incluso</Badge>
                        ) : (
                          <Badge variant="secondary">não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.override_enabled === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Badge variant={f.override_enabled ? "default" : "destructive"}>
                            {f.override_source ?? "manual"}: {f.override_enabled ? "on" : "off"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {f.override_expires_at ? formatDateTime(f.override_expires_at) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={f.effective}
                          onCheckedChange={() => handleToggleFeature(f)}
                          disabled={setFeature.isPending}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          ))}
          {data.features.length === 0 && (
            <EmptyState icon={ShieldCheck} title="Sem features no catálogo" description="Cadastre features em feature_flags_catalog." />
          )}
        </TabsContent>

        {/* LIMITS */}
        <TabsContent value="limits" className="pt-4">
          <SectionCard title="Limites e consumo do mês">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Métrica</TableHead>
                  <TableHead className="text-right">Uso atual</TableHead>
                  <TableHead className="text-right">Limite plano</TableHead>
                  <TableHead className="text-right">Override</TableHead>
                  <TableHead>Consumo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {limitsView.map((l) => {
                  const p = pct(l.current_value, l.effective_limit);
                  return (
                    <TableRow key={l.limit_key}>
                      <TableCell className="font-mono text-xs">{l.limit_key}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.current_value.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.plan_limit == null || l.plan_limit < 0 ? "∞" : l.plan_limit.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.override_limit == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge variant="default">{l.override_limit.toLocaleString("pt-BR")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        {l.effective_limit != null && l.effective_limit >= 0 ? (
                          <div className="space-y-1">
                            <Progress value={p} className="h-2" />
                            <div className="text-xs text-muted-foreground">{p}%</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">ilimitado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => openEditLimit(l)}>
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resetUsage.mutate({ tenant_id: tenantId, metric_key: l.limit_key })}
                          disabled={resetUsage.isPending}
                          title="Zerar contador do mês"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {limitsView.length === 0 && (
              <EmptyState icon={Gauge} title="Sem limites no plano" description="Configure plan_limits para o plano deste tenant." />
            )}
          </SectionCard>
        </TabsContent>

        {/* USAGE */}
        <TabsContent value="usage" className="pt-4">
          <SectionCard title="Eventos recentes de consumo">
            {events.length === 0 ? (
              <EmptyState icon={Activity} title="Sem eventos" description="Nenhum consumo registrado ainda." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Métrica</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{e.metric_key}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.delta}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.source ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        {/* HEALTH */}
        <TabsContent value="health" className="pt-4 space-y-3">
          <SectionCard title="Score de saúde">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(data.health.breakdown).map(([k, v]: [string, any]) => (
                <div key={k} className="p-3 rounded-lg border border-border bg-muted/20">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
                  <div className="text-2xl font-bold text-foreground tabular-nums">{v?.score ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {Object.entries(v ?? {})
                      .filter(([kk]) => kk !== "score")
                      .map(([kk, vv]) => (
                        <div key={kk}>
                          {kk}: <span className="text-foreground">{typeof vv === "object" ? JSON.stringify(vv) : String(vv)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Calculado em {formatDateTime(data.health.computed_at)}
            </div>
          </SectionCard>

          <SectionCard title="Lock state">
            <div className="space-y-1 text-sm">
              <div>Nível: <Badge variant={data.lock_state.level === "none" ? "default" : "destructive"}>{data.lock_state.level}</Badge></div>
              <div>Motivo: <span className="text-muted-foreground">{data.lock_state.reason}</span></div>
              <div>Status assinatura: <span className="text-muted-foreground">{data.lock_state.subscription_status ?? "—"}</span></div>
              {data.lock_state.grace_until && (
                <div>Grace até: <span className="text-muted-foreground">{formatDateTime(data.lock_state.grace_until)}</span></div>
              )}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Edit limit dialog */}
      <Dialog open={!!editLimit} onOpenChange={(o) => !o && setEditLimit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override de limite</DialogTitle>
            <DialogDescription>
              {editLimit?.limit_key} — sobrescreve o limite do plano para este tenant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Novo valor (use -1 para ilimitado)</Label>
              <Input
                type="number"
                value={limitForm.value}
                onChange={(e) => setLimitForm((s) => ({ ...s, value: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Expira em (opcional)</Label>
              <Input
                type="date"
                value={limitForm.expires}
                onChange={(e) => setLimitForm((s) => ({ ...s, expires: e.target.value }))}
              />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input
                value={limitForm.reason}
                onChange={(e) => setLimitForm((s) => ({ ...s, reason: e.target.value }))}
                placeholder="Ex: cliente VIP, trial estendido…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLimit(null)}>Cancelar</Button>
            <Button onClick={submitLimit} disabled={setLimit.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
