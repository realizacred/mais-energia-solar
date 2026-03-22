/**
 * Hooks for Pagamentos (payments) mutations.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-reconcile a payment with pending parcelas.
 * Marks parcelas as "paga" from oldest pending, consuming the payment amount.
 */
async function reconcilePagamentoWithParcelas(
  recebimentoId: string,
  pagamentoId: string,
  valorPago: number
) {
  const { data: parcelas, error } = await supabase
    .from("parcelas")
    .select("id, numero_parcela, valor, status")
    .eq("recebimento_id", recebimentoId)
    .in("status", ["pendente", "atrasada"])
    .order("numero_parcela", { ascending: true });

  if (error || !parcelas || parcelas.length === 0) return;

  let remaining = valorPago;
  const parcelasToUpdate: string[] = [];

  for (const parcela of parcelas) {
    if (remaining <= 0) break;
    if (remaining >= parcela.valor - 0.01) {
      parcelasToUpdate.push(parcela.id);
      remaining -= parcela.valor;
    }
  }

  if (parcelasToUpdate.length > 0) {
    await supabase
      .from("parcelas")
      .update({ status: "paga", pagamento_id: pagamentoId })
      .in("id", parcelasToUpdate);
  }
}

export function useRegistrarPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      recebimentoId,
      valor_pago,
      forma_pagamento,
      data_pagamento,
      observacoes,
    }: {
      recebimentoId: string;
      valor_pago: number;
      forma_pagamento: string;
      data_pagamento: string;
      observacoes: string | null;
    }) => {
      const { data: inserted, error } = await supabase
        .from("pagamentos")
        .insert({
          recebimento_id: recebimentoId,
          valor_pago,
          forma_pagamento,
          data_pagamento,
          observacoes,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (inserted?.id) {
        await reconcilePagamentoWithParcelas(recebimentoId, inserted.id, valor_pago);
      }

      return inserted;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
    },
  });
}

export function useDeletarPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pagamentoId: string) => {
      // Unlink parcelas tied to this pagamento
      await supabase
        .from("parcelas")
        .update({ status: "pendente", pagamento_id: null })
        .eq("pagamento_id", pagamentoId);

      const { error } = await supabase.from("pagamentos").delete().eq("id", pagamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
    },
  });
}
