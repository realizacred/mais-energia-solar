/**
 * useUnitComparativo — Compares estimated generation (from proposta_versoes) vs real consumption (unit_invoices).
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const MONTHS_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export interface ComparativoMes {
  mes: string;
  month: number;
  estimado_kwh: number;
  real_kwh: number;
  diferenca_kwh: number;
  performance_pct: number;
}

export interface ComparativoData {
  meses: ComparativoMes[];
  mediaPerformance: number;
  melhorMes: { label: string; pct: number } | null;
  piorMes: { label: string; pct: number } | null;
  simulacao: {
    id: string;
    potencia_kwp: number | null;
    geracao_mensal: number | null;
    geracao_anual: number | null;
  } | null;
}

/**
 * Fetch comparativo data for a UC with a linked simulacao.
 */
export function useUnitComparativo(unitId: string | null, simulacaoId: string | null) {
  return useQuery({
    queryKey: ["unit_comparativo", unitId, simulacaoId],
    queryFn: async (): Promise<ComparativoData> => {
      // 1. Fetch simulacao (proposta_versoes)
      let simulacao: ComparativoData["simulacao"] = null;
      if (simulacaoId) {
        const { data } = await supabase
          .from("proposta_versoes")
          .select("id, potencia_kwp, geracao_mensal, geracao_anual")
          .eq("id", simulacaoId)
          .maybeSingle();
        if (data) {
          simulacao = {
            id: data.id,
            potencia_kwp: data.potencia_kwp ? Number(data.potencia_kwp) : null,
            geracao_mensal: data.geracao_mensal ? Number(data.geracao_mensal) : null,
            geracao_anual: data.geracao_anual ? Number(data.geracao_anual) : null,
          };
        }
      }

      // 2. Fetch real invoices
      const { data: invoices } = await supabase
        .from("unit_invoices")
        .select("reference_month, reference_year, compensated_kwh, energy_injected_kwh")
        .eq("unit_id", unitId!)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false })
        .limit(24);

      const estimadoMensal = simulacao?.geracao_mensal ? Number(simulacao.geracao_mensal) : 0;

      // Group invoices by month (use latest year data)
      const byMonth = new Map<number, number>();
      (invoices || []).forEach((inv) => {
        const m = inv.reference_month;
        if (!byMonth.has(m)) {
          // Use compensated + injected as "real generation proxy"
          const real = (Number(inv.compensated_kwh) || 0) + (Number(inv.energy_injected_kwh) || 0);
          byMonth.set(m, real);
        }
      });

      const meses: ComparativoMes[] = [];
      byMonth.forEach((real, month) => {
        const estimado = estimadoMensal;
        const diferenca = real - estimado;
        const performance = estimado > 0 ? (real / estimado) * 100 : 0;
        meses.push({
          mes: MONTHS_LABELS[month - 1] || `M${month}`,
          month,
          estimado_kwh: Math.round(estimado * 100) / 100,
          real_kwh: Math.round(real * 100) / 100,
          diferenca_kwh: Math.round(diferenca * 100) / 100,
          performance_pct: Math.round(performance * 10) / 10,
        });
      });

      meses.sort((a, b) => a.month - b.month);

      const withPerf = meses.filter((m) => m.performance_pct > 0);
      const mediaPerformance =
        withPerf.length > 0
          ? Math.round((withPerf.reduce((s, m) => s + m.performance_pct, 0) / withPerf.length) * 10) / 10
          : 0;

      const melhorMes =
        withPerf.length > 0
          ? withPerf.reduce((best, m) => (m.performance_pct > best.performance_pct ? m : best))
          : null;
      const piorMes =
        withPerf.length > 0
          ? withPerf.reduce((worst, m) => (m.performance_pct < worst.performance_pct ? m : worst))
          : null;

      return {
        meses,
        mediaPerformance,
        melhorMes: melhorMes ? { label: melhorMes.mes, pct: melhorMes.performance_pct } : null,
        piorMes: piorMes ? { label: piorMes.mes, pct: piorMes.performance_pct } : null,
        simulacao,
      };
    },
    staleTime: STALE_TIME,
    enabled: !!unitId,
  });
}

/**
 * Fetch available proposta_versoes for linking.
 */
export function usePropostaVersoesForLink(tenantId: string | null) {
  return useQuery({
    queryKey: ["proposta_versoes_for_link", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_versoes")
        .select("id, potencia_kwp, geracao_mensal, geracao_anual, versao_numero, proposta_id, distribuidora_nome, created_at, snapshot")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  });
}

/**
 * Mutation to link a simulacao to a UC.
 */
export function useLinkSimulacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unitId, simulacaoId }: { unitId: string; simulacaoId: string | null }) => {
      const { error } = await supabase
        .from("units_consumidoras")
        .update({ simulacao_id: simulacaoId } as any)
        .eq("id", unitId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["uc_detail", variables.unitId] });
      qc.invalidateQueries({ queryKey: ["unit_comparativo", variables.unitId] });
    },
  });
}
