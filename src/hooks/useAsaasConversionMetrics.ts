/**
 * useAsaasConversionMetrics — Query audit_feature_access_log for Asaas config funnel.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STALE_TIME = 1000 * 60 * 5;
const QK = "asaas-conversion-metrics" as const;

export interface AsaasConversionEvent {
  id: string;
  feature_key: string;
  access_result: string;
  tenant_id: string | null;
  user_id: string | null;
  reason: string | null;
  created_at: string;
}

export interface AsaasConversionTenantRow {
  tenant_id: string;
  context: string;
  views: number;
  clicks: number;
  configured: number;
  conversion: number;
  last_activity: string;
}

export interface AsaasConversionKpis {
  total_views: number;
  total_clicks: number;
  total_configured: number;
  conversion_rate: number;
}

export interface AsaasConversionDaily {
  date: string;
  views: number;
  clicks: number;
  configured: number;
}

function buildTenantRows(events: AsaasConversionEvent[]): AsaasConversionTenantRow[] {
  const map = new Map<string, AsaasConversionTenantRow>();

  for (const e of events) {
    const tid = e.tenant_id || "unknown";
    const ctx = e.reason || "generic";
    const key = `${tid}::${ctx}`;

    if (!map.has(key)) {
      map.set(key, {
        tenant_id: tid,
        context: ctx,
        views: 0,
        clicks: 0,
        configured: 0,
        conversion: 0,
        last_activity: e.created_at,
      });
    }

    const row = map.get(key)!;
    if (e.feature_key === "asaas_not_configured" && e.access_result === "view") row.views++;
    if (e.feature_key === "asaas_not_configured" && e.access_result === "click") row.clicks++;
    if (e.feature_key === "asaas_configured" && e.access_result === "configured") row.configured++;

    if (e.created_at > row.last_activity) row.last_activity = e.created_at;
  }

  for (const row of map.values()) {
    row.conversion = row.views > 0 ? Math.round((row.configured / row.views) * 100) : 0;
  }

  return Array.from(map.values()).sort((a, b) => b.last_activity.localeCompare(a.last_activity));
}

function buildKpis(events: AsaasConversionEvent[]): AsaasConversionKpis {
  let views = 0, clicks = 0, configured = 0;
  for (const e of events) {
    if (e.feature_key === "asaas_not_configured" && e.access_result === "view") views++;
    if (e.feature_key === "asaas_not_configured" && e.access_result === "click") clicks++;
    if (e.feature_key === "asaas_configured" && e.access_result === "configured") configured++;
  }
  return {
    total_views: views,
    total_clicks: clicks,
    total_configured: configured,
    conversion_rate: views > 0 ? Math.round((configured / views) * 100) : 0,
  };
}

function buildDailyChart(events: AsaasConversionEvent[]): AsaasConversionDaily[] {
  const map = new Map<string, AsaasConversionDaily>();

  for (const e of events) {
    const d = new Date(e.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    if (!map.has(d)) map.set(d, { date: d, views: 0, clicks: 0, configured: 0 });
    const row = map.get(d)!;
    if (e.feature_key === "asaas_not_configured" && e.access_result === "view") row.views++;
    if (e.feature_key === "asaas_not_configured" && e.access_result === "click") row.clicks++;
    if (e.feature_key === "asaas_configured" && e.access_result === "configured") row.configured++;
  }

  return Array.from(map.values());
}

export function useAsaasConversionMetrics(filters?: {
  tenantId?: string;
  context?: string;
  from?: string;
  to?: string;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [QK, filters],
    queryFn: async () => {
      let query = supabase
        .from("audit_feature_access_log")
        .select("*")
        .in("feature_key", ["asaas_not_configured", "asaas_configured"])
        .order("created_at", { ascending: true });

      if (filters?.tenantId) query = query.eq("tenant_id", filters.tenantId);
      if (filters?.context) query = query.eq("reason", filters.context);
      if (filters?.from) query = query.gte("created_at", filters.from);
      if (filters?.to) query = query.lte("created_at", filters.to);

      const { data, error } = await query;
      if (error) throw error;

      const events = (data || []) as AsaasConversionEvent[];
      return {
        events,
        kpis: buildKpis(events),
        tenantRows: buildTenantRows(events),
        dailyChart: buildDailyChart(events),
      };
    },
    staleTime: STALE_TIME,
    enabled: !!user,
  });
}
