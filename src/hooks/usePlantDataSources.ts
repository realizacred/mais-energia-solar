/**
 * usePlantDataSources — CRUD hook for plant data sources (portais/coleta de dados).
 * §16: Queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlantDataSourceRow {
  id: string;
  plant_id: string;
  integration_id: string;
  provider_device_id: string | null;
  label: string | null;
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  // joined fields
  provider?: string;
  integration_status?: string;
}

export interface IntegrationOption {
  id: string;
  provider: string;
  status: string;
}

const STALE_TIME = 1000 * 60 * 5;
const KEY = "plant_data_sources" as const;

/**
 * List data sources for a specific plant
 */
export function usePlantDataSources(plantId: string | null) {
  return useQuery({
    queryKey: [KEY, plantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_data_sources")
        .select("*, monitoring_integrations(provider, status)")
        .eq("plant_id", plantId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        provider: row.monitoring_integrations?.provider ?? null,
        integration_status: row.monitoring_integrations?.status ?? null,
      })) as PlantDataSourceRow[];
    },
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

/**
 * List available integrations (credentials) for select
 */
export function useAvailableIntegrations() {
  return useQuery({
    queryKey: ["monitoring_integrations_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitoring_integrations")
        .select("id, provider, status")
        .order("provider", { ascending: true });
      if (error) throw error;
      return data as IntegrationOption[];
    },
    staleTime: STALE_TIME,
  });
}

export interface CreateDataSourcePayload {
  plant_id: string;
  integration_id: string;
  provider_device_id?: string | null;
  label?: string | null;
  tenant_id: string;
}

export function useCreatePlantDataSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateDataSourcePayload) => {
      const { data, error } = await supabase
        .from("plant_data_sources")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: [KEY, v.plant_id] });
    },
  });
}

export function useDeletePlantDataSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, plantId }: { id: string; plantId: string }) => {
      const { error } = await supabase.from("plant_data_sources").delete().eq("id", id);
      if (error) throw error;
      return plantId;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: [KEY, v.plantId] });
    },
  });
}
