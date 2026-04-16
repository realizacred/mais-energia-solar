/**
 * Hook to manage SM AI Migration config stored in integration_configs.
 * §16-S1: Queries only in hooks. §5: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SERVICE_KEY = "sm_ai_migration_prompt";
const QUERY_KEY = ["sm-ai-config"];

export interface SmAiConfig {
  id: string | null;
  systemPrompt: string;
  isActive: boolean;
}

const DEFAULT_PROMPT = `Você é um assistente de classificação de propostas solares.
Analise o histórico da proposta e retorne um JSON com:
- sugestao_etapa_id: string (slug da etapa sugerida no funil CRM)
- tags_identificadas: string[] (tags relevantes como "residencial", "alto_valor", "urgente")
- resumo_executivo: string (resumo de 2-3 frases do que aconteceu com esse cliente)

Considere:
- Status "approved" → etapa de fechamento/ganho
- Status "viewed"/"sent" → etapa de acompanhamento
- Valor alto (>50k) → tag "alto_valor"
- Cliente com múltiplas propostas → tag "recorrente"`;

export function useSmAiConfig() {
  const { user } = useAuth();

  return useQuery({
    queryKey: QUERY_KEY,
    enabled: !!user,
    staleTime: 1000 * 60 * 15,
    queryFn: async (): Promise<SmAiConfig> => {
      const { data, error } = await supabase
        .from("integration_configs")
        .select("id, api_key, is_active")
        .eq("service_key", SERVICE_KEY)
        .maybeSingle();

      // RLS may block non-admins — treat as empty (use defaults)
      if (error) {
        console.error("[useSmAiConfig] Query error (may be RLS):", error.message);
        return {
          id: null,
          systemPrompt: DEFAULT_PROMPT,
          isActive: false,
        };
      }

      return {
        id: data?.id ?? null,
        systemPrompt: data?.api_key ?? DEFAULT_PROMPT,
        isActive: data?.is_active ?? false,
      };
    },
  });
}

export function useSaveSmAiConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (config: { systemPrompt: string; isActive: boolean }) => {
      // Use canonical tenant resolver — handles auth + profile + RLS safely
      const { tenantId, userId } = await getCurrentTenantId();

      const { data: existing } = await supabase
        .from("integration_configs")
        .select("id")
        .eq("service_key", SERVICE_KEY)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("integration_configs")
          .update({
            api_key: config.systemPrompt,
            is_active: config.isActive,
            updated_at: new Date().toISOString(),
            updated_by: userId,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("integration_configs")
          .insert({
            service_key: SERVICE_KEY,
            api_key: config.systemPrompt,
            is_active: config.isActive,
            tenant_id: tenantId,
            updated_by: userId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Configuração de IA salva com sucesso");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar configuração: ${err.message}`);
    },
  });
}

export { DEFAULT_PROMPT };
