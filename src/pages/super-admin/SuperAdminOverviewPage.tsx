/**
 * SuperAdminOverviewPage — Dashboard SaaS premium.
 * Reúne KPIs globais + saúde + uso + eventos recentes em uma única tela
 * de leitura rápida (≤3s para identificar problemas).
 *
 * SSOT (sem alterações de backend, sem novas tabelas):
 *  - tenants / subscriptions          → KPIs globais
 *  - super_admin_global_health (RPC)  → Saúde da plataforma
 *  - usage_counters + plan_limits     → Uso / próximos do limite
 *  - audit_feature_access_log         → Eventos recentes (bloqueios)
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  CreditCard,
  AlertTriangle,
  Activity,
  Heart,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Clock,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  PageHeader,
  StatCard,
  SectionCard,
  LoadingState,
  EmptyState,
} from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useGlobalHealth } from "@/hooks/super-admin/useSuperAdminEntitlements";

const STALE = 1000 * 60 * 2;

function periodStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

// ───────────────────────────────── hooks (queries SSOT) ──────────────────────

function useGlobalKpis() {
  return useQuery({
    queryKey: ["sa-overview-kpis"],
    staleTime: STALE,
    queryFn: async () => {
      const [tenantsRes, subsRes] = await Promise.all([
        supabase.from("tenants").select("id, status, deleted_at"),
        supabase.from("subscriptions").select("id, status"),
      ]);
      const tenants = (tenantsRes.data ?? []).filter((t: any) => !t.deleted_at);
      const subs = subsRes.data ?? [];
      return {
        total_tenants: tenants.length,
        active_tenants: tenants.filter((t: any) => t.status === "active").length,
        suspended_tenants: tenants.filter((t: any) => t.status === "suspended").length,
        trialing: subs.filter((s: any) => s.status === "trialing").length,
        active_subs: subs.filter((s: any) => s.status === "active").length,
        past_due: subs.filter((s: any) => s.status === "past_due").length,
      };
    },
  });
}

function useNearLimitTenants() {
  return useQuery({
    queryKey: ["sa-overview-near-limit"],
    staleTime: STALE,
    queryFn: async () => {
      const { data: counters } = await supabase
        .from("usage_counters")
        .select("tenant_id, metric_key, current_value")
        .eq("period_start", periodStart());
      if (!counters?.length) return [];

      const tenantIds = Array.from(new Set(counters.map((c) => c.tenant_id)));
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("tenant_id, plan_id")
        .in("tenant_id", tenantIds);
      const planByTenant = new Map(
        (subs ?? []).map((s: any) => [s.tenant_id, s.plan_id]),
      );

      const planIds = Array.from(
        new Set((subs ?? []).map((s: any) => s.plan_id).filter(Boolean)),
      );
      const { data: limits } = planIds.length
        ? await supabase
            .from("plan_limits")
            .select("plan_id, limit_key, limit_value")
            .in("plan_id", planIds)
        : { data: [] as any[] };
      const limMap = new Map<string, number>();
      (limits ?? []).forEach((l: any) =>
        limMap.set(`${l.plan_id}::${l.limit_key}`, l.limit_value),
      );

      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, nome")
        .in("id", tenantIds);
      const tn = new Map((tenants ?? []).map((t: any) => [t.id, t.nome]));

      return counters
        .map((c: any) => {
          const planId = planByTenant.get(c.tenant_id);
          const limit = planId
            ? limMap.get(`${planId}::${c.metric_key}`) ?? -1
            : -1;
          const pct = limit > 0 ? Math.round((c.current_value / limit) * 100) : 0;
          return {
            tenant_id: c.tenant_id,
            tenant_name: tn.get(c.tenant_id) ?? c.tenant_id,
            metric_key: c.metric_key,
            current: c.current_value,
            limit,
            pct,
          };
        })
        .filter((r) => r.limit > 0 && r.pct >= 80)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 6);
    },
  });
}

function useTopConsumersOverview() {
  return useQuery({
    queryKey: ["sa-overview-top-consumers"],
    staleTime: STALE,
    queryFn: async () => {
      const { data: counters } = await supabase
        .from("usage_counters")
        .select("tenant_id, metric_key, current_value")
        .eq("period_start", periodStart())
        .order("current_value", { ascending: false })
        .limit(8);
      const ids = Array.from(new Set((counters ?? []).map((c) => c.tenant_id)));
      if (ids.length === 0) return [];
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, nome")
        .in("id", ids);
      const tn = new Map((tenants ?? []).map((t: any) => [t.id, t.nome]));
      return (counters ?? []).map((c: any) => ({
        ...c,
        tenant_name: tn.get(c.tenant_id) ?? c.tenant_id,
      }));
    },
  });
}

function useRecentEvents() {
  return useQuery({
    queryKey: ["sa-overview-recent-events"],
    staleTime: STALE,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("audit_feature_access_log")
        .select("id, tenant_id, feature_key, access_result, reason, created_at")
        .in("access_result", ["denied", "limit_exceeded"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });
}

// ───────────────────────────────────── page ──────────────────────────────────

export default function SuperAdminOverviewPage() {
  const kpis = useGlobalKpis();
  const health = useGlobalHealth();
  const nearLimit = useNearLimitTenants();
  const topConsumers = useTopConsumersOverview();
  const events = useRecentEvents();

  const healthData = (health.data ?? []) as any[];
  const lockedCount = healthData.filter(
    (t) => (t.lock?.level ?? "none") !== "none",
  ).length;
  const softLocks = healthData.filter((t) => t.lock?.level === "soft").length;
  const hardLocks = healthData.filter((t) => t.lock?.level === "hard").length;
  const lowHealth = healthData.filter((t) => (t.health?.score ?? 100) < 50).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title="Visão Geral"
        description="Pulso da plataforma SaaS — leitura rápida e ações priorizadas"
      />

      {/* ─── KPIs globais ──────────────────────────────────────────────── */}
      {kpis.isLoading || !kpis.data ? (
        <LoadingState message="Carregando KPIs..." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            icon={Building2}
            label="Tenants totais"
            value={kpis.data.total_tenants}
            color="info"
            subtitle="cadastrados na plataforma"
          />
          <StatCard
            icon={Users}
            label="Ativos"
            value={kpis.data.active_tenants}
            color="success"
            subtitle="operando normalmente"
          />
          <StatCard
            icon={ShieldAlert}
            label="Suspensos"
            value={kpis.data.suspended_tenants}
            color="destructive"
            subtitle="bloqueados administrativamente"
          />
          <StatCard
            icon={Sparkles}
            label="Em trial"
            value={kpis.data.trialing}
            color="warning"
            subtitle="conversão pendente"
          />
          <StatCard
            icon={CreditCard}
            label="Assinaturas ativas"
            value={kpis.data.active_subs}
            color="success"
            subtitle="receita recorrente"
          />
          <StatCard
            icon={AlertTriangle}
            label="Em atraso"
            value={kpis.data.past_due}
            color="destructive"
            subtitle="pagamento vencido"
          />
        </div>
      )}

      {/* ─── Saúde + Uso ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          icon={Heart}
          title="Saúde da plataforma"
          description="Tenants bloqueados ou em risco operacional"
          variant="red"
          actions={
            <Link
              to="/super-admin/health"
              className="text-xs text-primary hover:underline"
            >
              ver tudo →
            </Link>
          }
        >
          {health.isLoading ? (
            <LoadingState message="Avaliando saúde..." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat
                label="Ativos"
                value={healthData.length - lockedCount}
                tone="success"
              />
              <MiniStat label="Soft lock" value={softLocks} tone="warning" />
              <MiniStat label="Hard lock" value={hardLocks} tone="destructive" />
              <MiniStat
                label="Score < 50"
                value={lowHealth}
                tone="destructive"
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={TrendingUp}
          title="Tenants próximos do limite"
          description="Consumo ≥ 80% do plano contratado"
          variant="warning"
          actions={
            <Link
              to="/super-admin/usage"
              className="text-xs text-primary hover:underline"
            >
              ver tudo →
            </Link>
          }
        >
          {nearLimit.isLoading ? (
            <LoadingState message="Calculando uso..." />
          ) : !nearLimit.data?.length ? (
            <EmptyState
              icon={TrendingUp}
              title="Tudo sob controle"
              description="Nenhum tenant acima de 80% do limite."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="hidden sm:table-cell">Métrica</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nearLimit.data.map((r) => (
                  <TableRow key={`${r.tenant_id}-${r.metric_key}`}>
                    <TableCell className="max-w-[160px] truncate">
                      <Link
                        to={`/super-admin/tenants/${r.tenant_id}`}
                        className="text-primary hover:underline"
                      >
                        {r.tenant_name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                      {r.metric_key}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          r.pct >= 100
                            ? "destructive"
                            : r.pct >= 90
                              ? "secondary"
                              : "default"
                        }
                      >
                        {r.pct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>

      {/* ─── Top consumers + Eventos recentes ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          icon={Activity}
          title="Top consumidores do mês"
          description="Maiores volumes de uso registrados"
          variant="blue"
          actions={
            <Link
              to="/super-admin/usage"
              className="text-xs text-primary hover:underline"
            >
              ver tudo →
            </Link>
          }
        >
          {topConsumers.isLoading ? (
            <LoadingState message="Carregando consumo..." />
          ) : !topConsumers.data?.length ? (
            <EmptyState
              icon={Activity}
              title="Sem consumo registrado"
              description="Nenhum tenant gerou uso neste mês."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="hidden sm:table-cell">Métrica</TableHead>
                  <TableHead className="text-right">Consumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topConsumers.data.map((c: any, i: number) => (
                  <TableRow key={`${c.tenant_id}-${c.metric_key}-${i}`}>
                    <TableCell className="max-w-[160px] truncate">
                      <Link
                        to={`/super-admin/tenants/${c.tenant_id}`}
                        className="text-primary hover:underline"
                      >
                        {c.tenant_name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                      {c.metric_key}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {c.current_value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard
          icon={Clock}
          title="Eventos recentes"
          description="Bloqueios e limites atingidos nas últimas 24h"
          variant="red"
          actions={
            <Link
              to="/super-admin/usage"
              className="text-xs text-primary hover:underline"
            >
              auditoria →
            </Link>
          }
        >
          {events.isLoading ? (
            <LoadingState message="Carregando eventos..." />
          ) : !events.data?.length ? (
            <EmptyState
              icon={Clock}
              title="Nenhum bloqueio recente"
              description="Nenhuma feature ou limite negado nas últimas 24h."
            />
          ) : (
            <ul className="divide-y divide-border">
              {events.data.map((d: any) => (
                <li
                  key={d.id}
                  className="flex items-start justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-[10px]">
                        {d.access_result}
                      </Badge>
                      <span className="font-mono text-xs truncate text-foreground">
                        {d.feature_key}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {d.reason ?? "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Link
                      to={`/super-admin/tenants/${d.tenant_id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {d.tenant_id.slice(0, 8)}…
                    </Link>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(d.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ──────────────────────────────────── helpers ────────────────────────────────

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "destructive" | "info";
}) {
  const toneMap = {
    success: "border-l-success text-success",
    warning: "border-l-warning text-warning",
    destructive: "border-l-destructive text-destructive",
    info: "border-l-info text-info",
  } as const;
  const [border, text] = toneMap[tone].split(" ");
  return (
    <div className={`border-l-[3px] ${border} bg-muted/30 rounded-md px-3 py-2`}>
      <p className={`text-2xl font-bold leading-none ${text}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
