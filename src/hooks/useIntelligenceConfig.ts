import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

export interface IntelligenceConfig {
  tenant_id: string;
  ia_analise_habilitada: boolean;
  alertas_habilitados: boolean;
  reaquecimento_automatico: boolean;
  threshold_quente: number;
  threshold_morno: number;
  threshold_frio: number;
  alerta_preco_habilitado: boolean;
  alerta_preco_palavras: string[];
  alerta_preco_min_confidence: number;
  alerta_tempo_habilitado: boolean;
  alerta_tempo_palavras: string[];
  alerta_concorrencia_habilitado: boolean;
  alerta_concorrencia_palavras: string[];
  consultor_autoriza_ate: number;
  gerente_autoriza_ate: number;
  sempre_alertar_gerente_se_valor_acima: number;
  reaquecimento_dias_inativo: number;
  reaquecimento_max_mensagens: number;
  reaquecimento_canais: string[];
  ia_modelo: string;
  ia_temperatura: number;
  updated_at: string;
  updated_by: string | null;
}

export function useIntelligenceConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const configQuery = useQuery({
    queryKey: ["intelligence-config"],
    queryFn: async () => {
      const { tenantId } = await getCurrentTenantId();
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from("intelligence_config")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;
      return data as IntelligenceConfig | null;
    },
    staleTime: 1000 * 60 * 15,
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<IntelligenceConfig>) => {
      const { tenantId } = await getCurrentTenantId();
      if (!tenantId) throw new Error("Tenant não encontrado");

      const payload = {
        ...updates,
        tenant_id: tenantId,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      // Use upsert as single object
      const { data: existing } = await supabase
        .from("intelligence_config")
        .select("tenant_id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("intelligence_config")
          .update(payload)
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("intelligence_config")
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intelligence-config"] });
    },
  });

  return {
    config: configQuery.data,
    isLoading: configQuery.isLoading,
    updateConfig,
  };
}
