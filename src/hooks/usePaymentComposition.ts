import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PaymentItemInput } from "@/services/paymentComposition/types";
import { computeItem } from "@/services/paymentComposition/calculator";

interface SaveCompositionParams {
  vendaId: string;
  items: PaymentItemInput[];
  observacoes?: string;
}

export function useSavePaymentComposition() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendaId, items, observacoes }: SaveCompositionParams) => {
      // Compute all items with interest and installments
      const computedItems = items.map((item) => {
        const computed = computeItem(item);
        return {
          forma_pagamento: computed.forma_pagamento,
          valor_base: computed.valor_base,
          entrada: computed.entrada,
          data_pagamento: computed.data_pagamento || null,
          data_primeiro_vencimento: computed.data_primeiro_vencimento || null,
          parcelas: computed.parcelas,
          intervalo_dias: computed.intervalo_dias,
          juros_tipo: computed.juros_tipo,
          juros_valor: computed.juros_valor,
          juros_responsavel: computed.juros_responsavel,
          observacoes: computed.observacoes || null,
          metadata_json: {},
          parcelas_detalhes: computed.parcelas_detalhes.map((p) => ({
            numero_parcela: p.numero_parcela,
            tipo_parcela: p.tipo_parcela,
            valor: p.valor,
            vencimento: p.vencimento,
          })),
        };
      });

      const { data, error } = await (supabase as any).rpc("save_payment_composition", {
        p_venda_id: vendaId,
        p_observacoes: observacoes || null,
        p_itens: computedItems,
      });

      if (error) throw error;
      return data as string; // pagamento_id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["venda-pagamentos"] });
      toast.success("Composição de pagamento salva com sucesso");
    },
    onError: (err: any) => {
      console.error("[PaymentComposition] Save error:", err);
      toast.error("Erro ao salvar composição de pagamento");
    },
  });
}
