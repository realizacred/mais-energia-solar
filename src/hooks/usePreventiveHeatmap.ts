/**
 * Hook read-only — Heatmap operacional preventivo.
 * Reaproveita vw_preventive_heatmap (RB-76).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PreventiveDomain = "comercial" | "pos_venda" | "engenharia" | "financeiro";
export type PreventiveStatus = "saudavel" | "atencao" | "critico";

export interface PreventiveHeatmapRow {
  dominio: PreventiveDomain;
  dominio_label: string;
  total: number;
  criticos: number;
  criticos_pct: number;
  status: PreventiveStatus;
}

export function usePreventiveHeatmap() {
  return useQuery({
    queryKey: ["preventive-heatmap"],
    queryFn: async (): Promise<PreventiveHeatmapRow[]> => {
      const { data, error } = await (supabase as any)
        .from("vw_preventive_heatmap")
        .select("*");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        dominio: r.dominio as PreventiveDomain,
        dominio_label: r.dominio_label,
        total: Number(r.total ?? 0),
        criticos: Number(r.criticos ?? 0),
        criticos_pct: Number(r.criticos_pct ?? 0),
        status: (r.status ?? "saudavel") as PreventiveStatus,
      }));
    },
    staleTime: 60 * 1000,
  });
}
