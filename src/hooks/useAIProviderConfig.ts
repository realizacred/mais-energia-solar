import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AIProviderConfig {
  id: string;
  tenant_id: string;
  active_provider: "lovable_gateway" | "gemini" | "openai";
  active_model: string;
  fallback_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export const AVAILABLE_MODELS = {
  lovable_gateway: [
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (padrão)" },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "openai/gpt-5", name: "GPT-5" },
    { id: "openai/gpt-5-mini", name: "GPT-5 Mini" },
  ],
  gemini: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
  ],
} as const;

export const PROVIDER_INFO = {
  lovable_gateway: {
    name: "Lovable Gateway",
    description: "Gateway padrão incluído no plano. Acesso a Gemini e GPT sem API key própria.",
    requiresKey: false,
  },
  gemini: {
    name: "Google Gemini",
    description: "API direta do Google. Requer GEMINI_API_KEY configurada.",
    requiresKey: true,
  },
  openai: {
    name: "OpenAI",
    description: "API direta da OpenAI. Requer OPENAI_API_KEY configurada.",
    requiresKey: true,
  },
} as const;

export function useAIProviderConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ["ai-provider-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_provider_config")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as AIProviderConfig | null;
    },
    staleTime: 1000 * 60 * 15, // dados estáticos — §23
  });

  const updateConfig = useMutation({
    mutationFn: async (
      updates: Partial<Pick<AIProviderConfig, "active_provider" | "active_model" | "fallback_enabled">>
    ) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (config?.id) {
        const { error } = await supabase
          .from("ai_provider_config")
          .update({ ...updates, updated_by: user.id })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_provider_config")
          .insert({ ...updates, updated_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-provider-config"] });
      toast.success("Configuração de IA atualizada");
    },
    onError: (error) => {
      console.error("[useAIProviderConfig] update error:", error);
      toast.error("Erro ao atualizar configuração de IA");
    },
  });

  return {
    config,
    isLoading,
    error,
    updateConfig,
    availableModels: AVAILABLE_MODELS,
    providerInfo: PROVIDER_INFO,
  };
}
