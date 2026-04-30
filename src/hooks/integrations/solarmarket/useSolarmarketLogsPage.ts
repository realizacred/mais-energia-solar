/**
 * Adapter para /admin/integracoes/solarmarket/logs.
 * Reaproveita tabelas: solarmarket_import_jobs, solarmarket_promotion_jobs,
 *   solarmarket_import_logs, solarmarket_promotion_logs.
 * RB-76: nenhuma tabela nova, nenhum motor novo. Somente leitura.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export interface SmJobSummary {
  id: string;
  status: string;
  current_step: string | null;
  progress_pct: number | null;
  warnings_count: number | null;
  errors_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface SmLogRow {
  id: string;
  job_id: string | null;
  severity: string | null;
  step: string | null;
  message: string | null;
  details: any;
  created_at: string;
}

export function useSolarmarketLogsPage() {
  const { data: tenantId } = useTenantId();

  const promotionJobs = useQuery<SmJobSummary[]>({
    queryKey: ["sm-logs-page", "promotion-jobs", tenantId],
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_promotion_jobs")
        .select("id,status,current_step,progress_pct,warnings_count,errors_count,created_at,updated_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SmJobSummary[];
    },
  });

  const importJobs = useQuery<SmJobSummary[]>({
    queryKey: ["sm-logs-page", "import-jobs", tenantId],
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_import_jobs")
        .select("id,status,current_step,progress_pct,created_at,updated_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        warnings_count: null,
        errors_count: null,
      })) as SmJobSummary[];
    },
  });

  const recentErrors = useQuery<SmLogRow[]>({
    queryKey: ["sm-logs-page", "recent-errors", tenantId],
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_promotion_logs")
        .select("id,job_id,severity,step,message,details,created_at")
        .eq("tenant_id", tenantId!)
        .in("severity", ["error", "warning"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as SmLogRow[];
    },
  });

  return { promotionJobs, importJobs, recentErrors, tenantId };
}
