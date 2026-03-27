/**
 * useClienteRecebimento.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * 
 * Busca recebimento vinculado ao cliente ou projeto.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface RecebimentoVinculado {
  id: string;
  valor_total: number;
  status: string;
  numero_parcelas: number;
  proxima_parcela?: {
    valor: number;
    data_vencimento: string;
  } | null;
}

export function useClienteHasRecebimento(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente-has-recebimento", clienteId],
    queryFn: async () => {
      if (!clienteId) return false;
      const { count, error } = await supabase
        .from("recebimentos")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", clienteId);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

export function useClienteRecebimentoDetalhes(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente-recebimento-detalhes", clienteId],
    queryFn: async (): Promise<RecebimentoVinculado | null> => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from("recebimentos")
        .select("id, valor_total, status, numero_parcelas")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Fetch next pending parcela
      const { data: proxParcela } = await supabase
        .from("parcelas")
        .select("valor, data_vencimento")
        .eq("recebimento_id", data.id)
        .in("status", ["pendente", "atrasada"])
        .order("data_vencimento", { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        ...data,
        proxima_parcela: proxParcela || null,
      };
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}
