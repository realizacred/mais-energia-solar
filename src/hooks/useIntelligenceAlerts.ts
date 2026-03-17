import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IntelligenceAlert {
  id: string;
  tenant_id: string;
  lead_intelligence_id: string | null;
  lead_id: string | null;
  tipo_alerta: string;
  severidade: "baixa" | "media" | "alta" | "critica";
  direcionado_para: string | null;
  consultor_id: string | null;
  gerente_id: string | null;
  contexto_json: Record<string, any>;
  margem_disponivel: number | null;
  acao_tomada: string | null;
  desconto_autorizado: number | null;
  resultado: string | null;
  created_at: string;
  resolvido_at: string | null;
}

export function useIntelligenceAlerts(filters?: {
  pendentes?: boolean;
  severidade?: string;
  tipo?: string;
}) {
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ["intelligence-alerts", filters],
    queryFn: async () => {
      let query = supabase
        .from("intelligence_alerts")
        .select("*, lead_intelligence_profiles(lead_id, temperamento, urgencia_score, dor_principal), leads(nome, lead_code, valor_projeto)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filters?.pendentes) {
        query = query.is("resolvido_at", null);
      }
      if (filters?.severidade) {
        query = query.eq("severidade", filters.severidade);
      }
      if (filters?.tipo) {
        query = query.eq("tipo_alerta", filters.tipo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    staleTime: 1000 * 30,
  });

  const resolveAlert = useMutation({
    mutationFn: async (params: { alertId: string; acao_tomada: string; resultado?: string; desconto_autorizado?: number }) => {
      const { error } = await supabase
        .from("intelligence_alerts")
        .update({
          acao_tomada: params.acao_tomada,
          resultado: params.resultado || "pendente",
          desconto_autorizado: params.desconto_autorizado,
          resolvido_at: new Date().toISOString(),
        })
        .eq("id", params.alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intelligence-alerts"] });
    },
  });

  return {
    alerts: alertsQuery.data || [],
    isLoading: alertsQuery.isLoading,
    refetch: alertsQuery.refetch,
    resolveAlert,
  };
}
