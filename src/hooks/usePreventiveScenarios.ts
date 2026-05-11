/**
 * Hook read-only — Catálogo de cenários preventivos.
 * Reaproveita vw_preventive_scenarios (deriva de wa_followup_rules,
 * pipeline_automations e wa_cadences) — RB-76: zero duplicação.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PreventiveDomain } from "./usePreventiveHeatmap";

export interface PreventiveScenario {
  scenario_id: string;
  nome: string;
  descricao: string | null;
  dominio: PreventiveDomain;
  ativo: boolean;
  usa_ia: boolean;
  cooldown_horas: number;
  requer_aprovacao: boolean;
  executor: string;
  gatilho: string | null;
  volume_estimado: number;
}

export function usePreventiveScenarios() {
  return useQuery({
    queryKey: ["preventive-scenarios"],
    queryFn: async (): Promise<PreventiveScenario[]> => {
      const { data, error } = await (supabase as any)
        .from("vw_preventive_scenarios")
        .select("*")
        .order("ativo", { ascending: false })
        .order("dominio", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        scenario_id: String(r.scenario_id),
        nome: r.nome ?? "—",
        descricao: r.descricao,
        dominio: (r.dominio ?? "comercial") as PreventiveDomain,
        ativo: !!r.ativo,
        usa_ia: !!r.usa_ia,
        cooldown_horas: Number(r.cooldown_horas ?? 0),
        requer_aprovacao: !!r.requer_aprovacao,
        executor: r.executor ?? "—",
        gatilho: r.gatilho,
        volume_estimado: Number(r.volume_estimado ?? 0),
      }));
    },
    staleTime: 60 * 1000,
  });
}
