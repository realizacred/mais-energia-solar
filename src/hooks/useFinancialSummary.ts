/**
 * useFinancialSummary
 * ---------------------------------------------------------------
 * Lê valores financeiros REAIS do projeto sem alterar `deals.value`.
 *
 * Retorna:
 *  - valorContratado: soma de vendas_transacional.valor_total (status != cancelada)
 *  - valorRecebido:   soma de recebimentos.total_pago vinculados ao projeto
 *
 * NÃO sincroniza nada. NÃO escreve. Apenas leitura derivada.
 * (Fase 1 — Sinalização de Divergência Comercial vs Financeiro)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FinancialSummary {
  valorContratado: number;
  valorRecebido: number;
  hasContrato: boolean;
}

export function useFinancialSummary(dealId?: string | null, projetoId?: string | null) {
  return useQuery<FinancialSummary>({
    queryKey: ["financial-summary", dealId, projetoId],
    enabled: !!dealId || !!projetoId,
    staleTime: 30_000,
    queryFn: async () => {
      const empty: FinancialSummary = { valorContratado: 0, valorRecebido: 0, hasContrato: false };

      // 1) Vendas transacionais (valor contratado)
      let vendasQ = supabase
        .from("vendas_transacional")
        .select("valor_total, status, projeto_id, deal_id")
        .neq("status", "cancelada");
      if (dealId) vendasQ = vendasQ.eq("deal_id", dealId);
      else if (projetoId) vendasQ = vendasQ.eq("projeto_id", projetoId);

      const { data: vendas, error: vErr } = await vendasQ;
      if (vErr) throw vErr;

      const valorContratado = (vendas || []).reduce(
        (acc, v: any) => acc + Number(v.valor_total || 0),
        0
      );

      // 2) Recebimentos (valor recebido = total_pago)
      let valorRecebido = 0;
      if (projetoId) {
        const { data: receb, error: rErr } = await supabase
          .from("recebimentos")
          .select("total_pago")
          .eq("projeto_id", projetoId);
        if (rErr) throw rErr;
        valorRecebido = (receb || []).reduce(
          (acc, r: any) => acc + Number(r.total_pago || 0),
          0
        );
      }

      return {
        valorContratado,
        valorRecebido,
        hasContrato: (vendas?.length || 0) > 0,
      };
    },
  });
}
