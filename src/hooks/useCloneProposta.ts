/**
 * useCloneProposta.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 *
 * Hook para clonar uma proposta via RPC proposal_clone (atomic, backend-driven).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STALE_TIME = 1000 * 60 * 5;

export interface ProjetoOption {
  id: string;
  nome: string;
  cliente_nome: string | null;
}

/**
 * Lista projetos disponíveis para clonar proposta.
 */
export function useProjetosParaClone(enabled: boolean) {
  return useQuery({
    queryKey: ["projetos-para-clone"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos" as any)
        .select("id, codigo, potencia_kwp, cliente_id, clientes!projetos_cliente_id_fkey(nome)")
        .not("status", "in", '("cancelado","concluido")')
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map((p: any): ProjetoOption => ({
        id: p.id,
        nome: p.codigo ? `#${p.codigo}` : "Sem código",
        cliente_nome: p.clientes?.nome || null,
      }));
    },
    staleTime: STALE_TIME,
    enabled,
  });
}

interface ClonePayload {
  propostaId: string;
  titulo: string;
  targetDealId: string;
  customerId: string | null;
}

/**
 * Mutation para clonar proposta via RPC proposal_clone.
 * Atomic: duplica propostas_nativas + proposta_versoes (snapshot) + proposta_versao_ucs.
 * NÃO copia artefatos (PDF/DOCX) — proposta nova nasce sem arquivo gerado.
 */
export function useCloneProposta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propostaId, titulo, targetDealId, customerId }: ClonePayload) => {
      const { data: result, error } = await supabase.rpc("proposal_clone" as any, {
        p_source_proposta_id: propostaId,
        p_titulo: titulo || null,
        p_target_deal_id: targetDealId || null,
        p_target_cliente_id: customerId || null,
      });

      if (error) throw error;
      if ((result as any)?.error) throw new Error((result as any).error);

      return {
        newPropostaId: (result as any).proposta_id,
        newVersaoId: (result as any).versao_id,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propostas-projeto-tab"] });
      toast({ title: "Proposta clonada com sucesso! ✅" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao clonar proposta", description: err.message, variant: "destructive" });
    },
  });
}
