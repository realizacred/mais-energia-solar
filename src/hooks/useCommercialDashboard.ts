import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TenantUsageRow {
  tenant_id: string;
  tenant_nome: string;
  plan_code: string | null;
  sub_status: string | null;
  metric_key: string;
  current_value: number;
  limit_value: number;
  percentage: number;
  status: "normal" | "warning" | "blocked";
}

export interface CommercialDashboardData {
  rows: TenantUsageRow[];
  totalActiveTenants: number;
  tenantsNearLimit: number;
  tenantsBlocked: number;
  totalEventsMonth: number;
}

const STALE_TIME = 1000 * 60 * 5;

export function useCommercialDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["commercial-dashboard"],
    queryFn: async (): Promise<CommercialDashboardData> => {
      // 1. Fetch all tenants with subscriptions
      const { data: tenants, error: tErr } = await supabase
        .from("tenants")
        .select("id, nome")
        .eq("ativo", true);
      if (tErr) throw tErr;

      // 2. Fetch subscriptions
      const { data: subs, error: sErr } = await supabase
        .from("subscriptions")
        .select("tenant_id, plan_id, status, plans(code)")
        .in("status", ["active", "trialing"]);
      if (sErr) throw sErr;

      const subMap = new Map<string, { plan_code: string; status: string }>();
      (subs || []).forEach((s: any) => {
        subMap.set(s.tenant_id, {
          plan_code: s.plans?.code ?? "free",
          status: s.status,
        });
      });

      // 3. Fetch plan limits
      const { data: limits, error: lErr } = await supabase
        .from("plan_limits")
        .select("plan_id, limit_key, limit_value, plans(code)");
      if (lErr) throw lErr;

      const limitMap = new Map<string, number>();
      (limits || []).forEach((l: any) => {
        const key = `${l.plans?.code}::${l.limit_key}`;
        limitMap.set(key, l.limit_value);
      });

      // 4. Fetch current month usage counters
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const { data: counters, error: cErr } = await supabase
        .from("usage_counters")
        .select("tenant_id, metric_key, current_value")
        .eq("period_start", periodStart);
      if (cErr) throw cErr;

      const usageMap = new Map<string, number>();
      (counters || []).forEach((c: any) => {
        usageMap.set(`${c.tenant_id}::${c.metric_key}`, c.current_value);
      });

      // 5. Fetch total events this month
      const { count: totalEvents } = await supabase
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${periodStart}T00:00:00Z`);

      // 6. Build rows
      const metricKeys = [
        "max_ai_insights_month",
        "max_reports_pdf_month",
        "max_automations",
        "max_performance_alerts",
        "max_leads_month",
        "max_wa_messages_month",
        "max_proposals_month",
        "max_users",
      ];

      // Map from plan_limits key to usage_counters metric_key
      const limitToUsageMap: Record<string, string> = {
        max_ai_insights_month: "ai_insights",
        max_reports_pdf_month: "relatorios_pdf",
        max_automations: "automacoes_executadas",
        max_performance_alerts: "alertas_performance",
        max_leads_month: "leads_criados",
        max_wa_messages_month: "wa_messages_sent",
        max_proposals_month: "propostas_geradas",
        max_users: "users_count",
      };

      const rows: TenantUsageRow[] = [];
      let tenantsNearLimit = 0;
      let tenantsBlocked = 0;
      const nearLimitTenants = new Set<string>();
      const blockedTenants = new Set<string>();

      for (const t of tenants || []) {
        const sub = subMap.get(t.id);
        const planCode = sub?.plan_code ?? "free";

        for (const mk of metricKeys) {
          const limitVal = limitMap.get(`${planCode}::${mk}`) ?? -1;
          if (limitVal <= 0) continue; // unlimited or 0 = skip

          const usageKey = limitToUsageMap[mk] ?? mk;
          const currentVal = usageMap.get(`${t.id}::${usageKey}`) ?? 0;
          const pct = limitVal > 0 ? Math.round((currentVal / limitVal) * 100) : 0;
          
          let status: "normal" | "warning" | "blocked" = "normal";
          if (pct >= 100) {
            status = "blocked";
            blockedTenants.add(t.id);
          } else if (pct >= 80) {
            status = "warning";
            nearLimitTenants.add(t.id);
          }

          // Only include rows with actual usage or limits
          if (currentVal > 0 || pct >= 80) {
            rows.push({
              tenant_id: t.id,
              tenant_nome: t.nome,
              plan_code: planCode,
              sub_status: sub?.status ?? null,
              metric_key: mk,
              current_value: currentVal,
              limit_value: limitVal,
              percentage: pct,
              status,
            });
          }
        }
      }

      // Sort by percentage descending
      rows.sort((a, b) => b.percentage - a.percentage);

      return {
        rows,
        totalActiveTenants: tenants?.length ?? 0,
        tenantsNearLimit: nearLimitTenants.size,
        tenantsBlocked: blockedTenants.size,
        totalEventsMonth: totalEvents ?? 0,
      };
    },
    enabled: !!user,
    staleTime: STALE_TIME,
  });
}
