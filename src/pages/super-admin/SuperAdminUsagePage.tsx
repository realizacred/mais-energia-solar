/**
 * SuperAdminUsagePage — PR-4 observability.
 * Top consumers, near-limit tenants, recent denials.
 * SSOT: usage_counters + plan_limits + audit_feature_access_log. Sem mocks.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, TrendingUp } from "lucide-react";
import { LoadingState, EmptyState, SectionCard } from "@/components/ui-kit";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const STALE = 30_000;

function periodStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

function useTopConsumers() {
  return useQuery({
    queryKey: ["sa-top-consumers"],
    staleTime: STALE,
    queryFn: async () => {
      const { data: counters } = await supabase
        .from("usage_counters")
        .select("tenant_id, metric_key, current_value")
        .eq("period_start", periodStart())
        .order("current_value", { ascending: false })
        .limit(50);
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

function useNearLimit() {
  return useQuery({
    queryKey: ["sa-near-limit"],
    staleTime: STALE,
    queryFn: async () => {
      const { data: counters } = await supabase
        .from("usage_counters")
        .select("tenant_id, metric_key, current_value")
        .eq("period_start", periodStart());
      if (!counters?.length) return [];

      const { data: subs } = await supabase
        .from("subscriptions")
        .select("tenant_id, plan_id")
        .in("tenant_id", Array.from(new Set(counters.map((c) => c.tenant_id))));
      const planByTenant = new Map((subs ?? []).map((s: any) => [s.tenant_id, s.plan_id]));

      const planIds = Array.from(new Set((subs ?? []).map((s: any) => s.plan_id).filter(Boolean)));
      const { data: limits } = planIds.length
        ? await supabase.from("plan_limits").select("plan_id, limit_key, limit_value").in("plan_id", planIds)
        : { data: [] as any[] };
      const limMap = new Map<string, number>();
      (limits ?? []).forEach((l: any) => limMap.set(`${l.plan_id}::${l.limit_key}`, l.limit_value));

      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, nome")
        .in("id", Array.from(new Set(counters.map((c) => c.tenant_id))));
      const tn = new Map((tenants ?? []).map((t: any) => [t.id, t.nome]));

      return counters
        .map((c: any) => {
          const planId = planByTenant.get(c.tenant_id);
          const limit = planId ? limMap.get(`${planId}::${c.metric_key}`) ?? -1 : -1;
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
        .slice(0, 30);
    },
  });
}

function useRecentDenials() {
  return useQuery({
    queryKey: ["sa-recent-denials"],
    staleTime: STALE,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("audit_feature_access_log")
        .select("id, tenant_id, feature_key, access_result, reason, created_at")
        .in("access_result", ["denied", "limit_exceeded"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });
}

export default function SuperAdminUsagePage() {
  const top = useTopConsumers();
  const near = useNearLimit();
  const denials = useRecentDenials();

  if (top.isLoading || near.isLoading || denials.isLoading) {
    return <LoadingState message="Calculando consumo da plataforma..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Consumo & Enforcement</h1>
      </div>

      <SectionCard title={`Tenants próximos do limite (${near.data?.length ?? 0})`}>
        {!near.data?.length ? (
          <EmptyState icon={TrendingUp} title="Nenhum tenant próximo do limite" description="Todos abaixo de 80% do plano." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Uso</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {near.data.map((r) => (
                <TableRow key={`${r.tenant_id}-${r.metric_key}`}>
                  <TableCell>
                    <Link to={`/super-admin/tenants/${r.tenant_id}`} className="text-primary hover:underline">
                      {r.tenant_name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.metric_key}</TableCell>
                  <TableCell className="text-right">{r.current}/{r.limit}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={r.pct >= 100 ? "destructive" : r.pct >= 90 ? "secondary" : "default"}>
                      {r.pct}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title={`Top consumers do mês (${top.data?.length ?? 0})`}>
        {!top.data?.length ? (
          <EmptyState icon={Activity} title="Sem consumo registrado" description="Nenhum tenant gerou uso este mês." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Consumo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.data.slice(0, 30).map((c: any, i: number) => (
                <TableRow key={`${c.tenant_id}-${c.metric_key}-${i}`}>
                  <TableCell>
                    <Link to={`/super-admin/tenants/${c.tenant_id}`} className="text-primary hover:underline">
                      {c.tenant_name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.metric_key}</TableCell>
                  <TableCell className="text-right font-mono">{c.current_value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title={`Bloqueios nas últimas 24h (${denials.data?.length ?? 0})`}>
        {!denials.data?.length ? (
          <EmptyState icon={AlertTriangle} title="Nenhum bloqueio recente" description="Nenhuma feature ou limite negado nas últimas 24h." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {denials.data.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs">{new Date(d.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>
                    <Link to={`/super-admin/tenants/${d.tenant_id}`} className="text-primary hover:underline text-xs">
                      {d.tenant_id.slice(0, 8)}…
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{d.feature_key}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{d.access_result}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{d.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
