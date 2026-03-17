import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadIntelligenceProfile {
  id: string;
  tenant_id: string;
  lead_id: string;
  temperamento: "quente" | "morno" | "frio" | "congelado" | null;
  dor_principal: string | null;
  objecao_detectada: string | null;
  urgencia_score: number | null;
  valor_perdido_acumulado: number | null;
  tarifa_atual_vs_historico: number | null;
  primeiro_contato: string | null;
  ultimo_contato: string | null;
  dias_inativo: number;
  cliques_proposta: number;
  mensagens_troca: number;
  status_acao: string;
  analisado_por: string | null;
  created_at: string;
  updated_at: string;
}

export function useLeadIntelligence(leadId?: string) {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["lead-intelligence", leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from("lead_intelligence_profiles")
        .select("*")
        .eq("lead_id", leadId)
        .maybeSingle();
      if (error) throw error;
      return data as LeadIntelligenceProfile | null;
    },
    enabled: !!leadId,
    staleTime: 1000 * 60 * 5,
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    refetch: profileQuery.refetch,
  };
}

export function useLeadIntelligenceList(filters?: {
  temperamento?: string;
  status_acao?: string;
  minUrgencia?: number;
}) {
  return useQuery({
    queryKey: ["lead-intelligence-list", filters],
    queryFn: async () => {
      let query = supabase
        .from("lead_intelligence_profiles")
        .select("*, leads(nome, lead_code, valor_projeto, cidade, estado)")
        .order("urgencia_score", { ascending: false });

      if (filters?.temperamento) {
        query = query.eq("temperamento", filters.temperamento);
      }
      if (filters?.status_acao) {
        query = query.eq("status_acao", filters.status_acao);
      }
      if (filters?.minUrgencia) {
        query = query.gte("urgencia_score", filters.minUrgencia);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 2,
  });
}
