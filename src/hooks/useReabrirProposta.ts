/**
 * useReabrirProposta.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 *
 * Hook para reabrir proposta aceita/rejeitada via RPC proposal_reabrir.
 * Apenas admin/gerente/super_admin podem executar.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const STALE_TIME = 1000 * 60 * 5;

/**
 * Verifica se o usuário logado tem role admin/gerente/super_admin.
 */
export function useIsAdminOrGerente() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-admin-gerente-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (data ?? []).map((r: any) => r.role);
      return roles.some((r: string) => ["admin", "gerente", "super_admin"].includes(r));
    },
    staleTime: STALE_TIME,
    enabled: !!user?.id,
  });
}

/**
 * Mutation para reabrir proposta via RPC proposal_reabrir.
 */
export function useReabrirProposta() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (propostaId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase.rpc(
        "proposal_reabrir" as any,
        { p_proposta_id: propostaId, p_user_id: user.id }
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Proposta reaberta com sucesso ✅" });
      qc.invalidateQueries({ queryKey: ["propostas-projeto-tab"] });
      qc.invalidateQueries({ queryKey: ["proposta-detail"] });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao reabrir proposta",
        description: err?.message,
        variant: "destructive",
      });
    },
  });
}
