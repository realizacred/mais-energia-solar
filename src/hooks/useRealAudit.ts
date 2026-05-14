import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface QuickAuditResult {
  templates_ativos: number;
  total_variaveis: number;
  variaveis_encontradas: string[];
  quebradas: string[];
  nulas: string[];
  ok: string[];
  gerado_em: string;
}

export interface FullAuditResult extends QuickAuditResult {
  analise_ia?: string;
  prompt_lovable?: string;
}

export function useQuickAudit() {
  return useQuery<QuickAuditResult>({
    queryKey: ["audit-quick"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "audit-variables", { body: { mode: "quick" } }
      );
      if (error) throw error;
      return {
        ...data,
        total_variaveis: data.variaveis_encontradas?.length || 0
      };
    },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
  });
}

export function useFullAudit() {
  return useMutation<FullAuditResult, Error, string | undefined>({
    mutationFn: async (propostaId?: string) => {
      const { data, error } = await supabase.functions.invoke(
        "audit-variables",
        { body: { mode: "full", proposta_id: propostaId } }
      );
      if (error) throw error;
      return {
        ...data,
        total_variaveis: data.variaveis_encontradas?.length || 0
      };
    }
  });
}

