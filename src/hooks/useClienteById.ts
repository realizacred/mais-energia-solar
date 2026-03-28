/**
 * Hook para buscar cliente por ID — §16-S1
 * Usado pelo ClienteEditModal em vez de query direta (AP-01)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min

export function useClienteById(clienteId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["cliente-detail", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("clientes")
        .select("nome, telefone, email, cpf_cnpj, data_nascimento, cep, estado, cidade, bairro, rua, numero, complemento, observacoes")
        .eq("id", clienteId)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId && enabled,
  });
}
