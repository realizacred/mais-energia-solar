/**
 * Hooks para auditoria real de variáveis em tempo real.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min
const QUERY_KEY = "audit-variables" as const;

export interface QuickAuditResult {
  templates_ativos: number;
  template_details: Array<{ nome: string; total_placeholders: number }>;
  variaveis_encontradas: string[];
  quebradas: string[];
  nulas: string[];
  ok: string[];
  total_variaveis: number;
  gerado_em: string;
}

export interface FullAuditResult extends QuickAuditResult {
  analise_ia: string;
  prompt_lovable: string | null;
}

/**
 * Varredura rápida — roda ao montar o componente.
 * Lê templates DOCX ativos, extrai placeholders, e testa contra última proposta.
 */
export function useQuickAudit() {
  return useQuery({
    queryKey: [QUERY_KEY, "quick"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("audit-variables", {
        body: { mode: "quick" },
      });
      if (error) throw new Error(error.message || "Erro na auditoria rápida");
      return data as QuickAuditResult;
    },
    staleTime: STALE_TIME,
    refetchOnMount: true,
  });
}

/**
 * Auditoria completa com IA — roda ao clicar "Auditar com IA".
 */
export function useFullAudit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propostaId?: string) => {
      const { data, error } = await supabase.functions.invoke("audit-variables", {
        body: { mode: "full", proposta_id: propostaId },
      });
      if (error) throw new Error(error.message || "Erro na auditoria completa");
      return data as FullAuditResult;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: ["generation-audit-reports-latest"] }),
        queryClient.invalidateQueries({ queryKey: ["generation-audit-health"] }),
        queryClient.invalidateQueries({ queryKey: ["variable-audit-reports-history"] }),
      ]);
    },
  });
}
