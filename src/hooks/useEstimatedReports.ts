/**
 * useEstimatedReports — CRUD hook for plant_estimated_reports.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listDailyReadings } from "@/services/monitoring/monitorService";

export interface EstimatedReport {
  id: string;
  plant_id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  tarifa_kwh: number;
  credito_kwh: number;
  total_investido: number | null;
  geracao_periodo_kwh: number | null;
  desempenho_pct: number | null;
  retorno_estimado: number | null;
  retorno_pct: number | null;
  is_estimated: boolean;
  created_at: string;
}

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "plant-estimated-reports" as const;

export function useEstimatedReports(plantId: string | null) {
  return useQuery<EstimatedReport[]>({
    queryKey: [QUERY_KEY, plantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_estimated_reports")
        .select("*")
        .eq("plant_id", plantId!)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return (data || []) as EstimatedReport[];
    },
    staleTime: STALE_TIME,
    enabled: !!plantId,
  });
}

interface CreateEstimatedReportInput {
  plant_id: string;
  period_start: string;
  period_end: string;
  tarifa_kwh: number;
  credito_kwh: number;
  total_investido: number | null;
  geracao_periodo_kwh: number | null;
  desempenho_pct: number | null;
  retorno_estimado: number | null;
  retorno_pct: number | null;
}

export function useCreateEstimatedReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEstimatedReportInput) => {
      const { data, error } = await supabase
        .from("plant_estimated_reports")
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.plant_id] });
    },
  });
}

export function useDeleteEstimatedReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, plantId }: { id: string; plantId: string }) => {
      const { error } = await supabase
        .from("plant_estimated_reports")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return plantId;
    },
    onSuccess: (plantId) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, plantId] });
    },
  });
}

/**
 * Fetch generation total for a period (used to pre-calculate the dialog preview).
 */
export async function fetchGenerationForPeriod(
  plantId: string,
  start: string,
  end: string
): Promise<number> {
  const readings = await listDailyReadings(plantId, start, end);
  return readings.reduce((sum, r) => sum + (r.energy_kwh || 0), 0);
}
