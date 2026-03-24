/**
 * useClienteRecebimento.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * 
 * Verifica se existe recebimento vinculado ao cliente.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

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
