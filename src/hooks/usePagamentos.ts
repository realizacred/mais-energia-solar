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
      // 1. Get project info
      const { data: recData } = await supabase
        .from("recebimentos")
        .select("projeto_id, cliente_id, tenant_id")
        .eq("id", recebimentoId)
        .single();

      // 2. Insert into lancamentos_financeiros
      const { data: lancamento, error: lancErr } = await supabase
        .from("lancamentos_financeiros")
        .insert({
          tenant_id: recData?.tenant_id,
          tipo: "receita",
          valor: valor_pago,
          forma_pagamento,
          data_lancamento: data_pagamento,
          status: "confirmado",
          origem: "registrar_pagamento",
          projeto_id: recData?.projeto_id,
          cliente_id: recData?.cliente_id,
          descricao: "Pagamento Recebido",
          observacoes: observacoes
        } as any)
        .select("id")
        .single();

      if (lancErr) throw lancErr;

      // 3. Insert legacy record
      const { data: inserted, error } = await supabase
        .from("_deprecated_pagamentos" as any)
        .insert({
          recebimento_id: recebimentoId,
          valor_pago,
          forma_pagamento,
          data_pagamento,
          observacoes,
          tenant_id: recData?.tenant_id
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      if ((inserted as any)?.id) {
        await reconcilePagamentoWithParcelas(recebimentoId, (inserted as any).id, valor_pago);
      }

      return inserted;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
      qc.invalidateQueries({ queryKey: ["lancamentos_financeiros"] });
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

      const { error } = await supabase.from("_deprecated_pagamentos").delete().eq("id", pagamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
    },
  });
}
