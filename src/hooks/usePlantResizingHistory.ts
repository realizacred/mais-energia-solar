/**
 * usePlantResizingHistory — CRUD hook for plant resizing/expansion history.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlantResizingRow {
  id: string;
  plant_id: string;
  tenant_id: string;
  potencia_kwp: number;
  data_ampliacao: string;
  valor_investido_total: number | null;
  geracao_anual_prevista_kwh: number | null;
  geracao_anual_acordada_kwh: number | null;
  comentario: string | null;
  created_at: string;
}

const STALE_TIME = 1000 * 60 * 5;
const KEY = "plant_resizing_history" as const;

export function usePlantResizingHistory(plantId: string | null) {
  return useQuery({
    queryKey: [KEY, plantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_resizing_history")
        .select("*")
        .eq("plant_id", plantId!)
        .order("data_ampliacao", { ascending: false });
      if (error) throw error;
      return data as PlantResizingRow[];
    },
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}

export interface ResizingPayload {
  plant_id: string;
  tenant_id: string;
  potencia_kwp: number;
  data_ampliacao: string;
  valor_investido_total?: number | null;
  geracao_anual_prevista_kwh?: number | null;
  geracao_anual_acordada_kwh?: number | null;
  comentario?: string | null;
}

export function useCreatePlantResizing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ResizingPayload) => {
      const { data, error } = await supabase
        .from("plant_resizing_history")
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

export function useDeletePlantResizing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, plantId }: { id: string; plantId: string }) => {
      const { error } = await supabase.from("plant_resizing_history").delete().eq("id", id);
      if (error) throw error;
      return plantId;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: [KEY, v.plantId] });
    },
  });
}
