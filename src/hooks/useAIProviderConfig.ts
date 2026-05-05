import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AIProviderConfig {
  id: string;
  tenant_id: string;
  active_provider: "gemini" | "openai";
  active_model: string;
  fallback_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export const AVAILABLE_MODELS = {
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
    staleTime: 1000 * 60 * 2,
  });

  const { data: activeKeys } = useQuery({
    queryKey: ["ai-active-keys"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_configs")
        .select("service_key, is_active")
        .in("service_key", ["openai", "google_gemini"])
        .eq("is_active", true);
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const hasOpenAIKey = activeKeys?.some(k => k.service_key === "openai") ?? false;
  const hasGeminiKey = activeKeys?.some(k => k.service_key === "google_gemini") ?? false;

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
    hasOpenAIKey,
    hasGeminiKey,
  };
}
