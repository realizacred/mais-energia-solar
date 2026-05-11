/**
 * Hook read-only — Central Preventiva (Phase 1).
 * Reaproveita vw_preventive_dashboard (RB-76: zero duplicação).
 * KPIs executivos consolidados: comercial + pós-venda + engenharia + financeiro.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PreventiveDashboardKpis {
  clientes_em_risco: number;
  propostas_esfriando: number;
  engenharia_parada: number;
  cobrancas_preventivas: number;
  clientes_sem_interacao: number;
  acoes_automaticas_hoje: number;
  aguardando_revisao: number;
  recuperacao_potencial: number;
}

const ZERO: PreventiveDashboardKpis = {
  clientes_em_risco: 0,
  propostas_esfriando: 0,
  engenharia_parada: 0,
  cobrancas_preventivas: 0,
  clientes_sem_interacao: 0,
  acoes_automaticas_hoje: 0,
  aguardando_revisao: 0,
  recuperacao_potencial: 0,
};

export function usePreventiveDashboard() {
  return useQuery({
    queryKey: ["preventive-dashboard"],
    queryFn: async (): Promise<PreventiveDashboardKpis> => {
      // RLS por tenant é aplicada via security_invoker nas tabelas-base.
      const { data, error } = await (supabase as any)
        .from("vw_preventive_dashboard")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return ZERO;
      return {
        clientes_em_risco: Number(data.clientes_em_risco ?? 0),
        propostas_esfriando: Number(data.propostas_esfriando ?? 0),
        engenharia_parada: Number(data.engenharia_parada ?? 0),
        cobrancas_preventivas: Number(data.cobrancas_preventivas ?? 0),
        clientes_sem_interacao: Number(data.clientes_sem_interacao ?? 0),
        acoes_automaticas_hoje: Number(data.acoes_automaticas_hoje ?? 0),
        aguardando_revisao: Number(data.aguardando_revisao ?? 0),
        recuperacao_potencial: Number(data.recuperacao_potencial ?? 0),
      };
    },
    staleTime: 60 * 1000,
  });
}
