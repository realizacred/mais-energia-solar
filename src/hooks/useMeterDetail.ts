/**
 * Hook para operações do MeterDetailPage.
 * §16: Queries/mutations só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

// ─── Linked UC query ───────────────────────────────
export function useLinkedUC(unitId: string | undefined) {
  return useQuery({
    queryKey: ["uc_for_meter", unitId],
    queryFn: async () => {
      if (!unitId) return null;
      const { data } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc")
        .eq("id", unitId)
        .single();
      return data;
    },
    enabled: !!unitId,
    staleTime: STALE_TIME,
  });
}

// ─── Delete meter mutation ─────────────────────────
export function useDeleteMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meterId: string) => {
      await supabase.from("meter_status_latest").delete().eq("meter_device_id", meterId);
      await supabase.from("meter_readings").delete().eq("meter_device_id", meterId);
      await supabase.from("meter_alerts").delete().eq("meter_device_id", meterId);
      await supabase.from("unit_meter_links").delete().eq("meter_device_id", meterId);
      const { error } = await supabase.from("meter_devices").delete().eq("id", meterId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meter_devices"] });
    },
  });
}
