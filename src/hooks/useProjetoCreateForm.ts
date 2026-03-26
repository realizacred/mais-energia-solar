/**
 * useProjetoCreateForm — hooks de suporte ao modal de criação de projeto.
 * §16: Queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface ProjetoAbertoResumo {
  id: string;
  codigo: string | null;
}

export function useClienteProjetoAberto(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente-projeto-aberto", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from("projetos")
        .select("id, codigo")
        .eq("cliente_id", clienteId)
        .in("status", ["criado", "aguardando_documentacao", "em_analise", "aprovado", "em_instalacao"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ProjetoAbertoResumo | null;
    },
    enabled: !!clienteId,
    staleTime: STALE_TIME,
  });
}
