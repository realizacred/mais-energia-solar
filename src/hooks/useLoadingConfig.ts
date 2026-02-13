import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface LoadingConfig {
  id: string;
  tenant_id: string;
  sun_loader_enabled: boolean;
  sun_loader_style: string;
  loader_theme: string;
  custom_loader_url: string | null;
  show_messages: boolean;
  overlay_delay_ms: number;
  overlay_min_duration_ms: number;
  messages_catalog: Record<string, string[]>;
  ai_messages_enabled: boolean;
  ai_min_duration_seconds: number;
  ai_timeout_ms: number;
  ai_max_calls_per_flow: number;
}

const DEFAULT_CONFIG: Omit<LoadingConfig, "id" | "tenant_id"> = {
  sun_loader_enabled: true,
  sun_loader_style: "pulse",
  loader_theme: "sun",
  custom_loader_url: null,
  show_messages: true,
  overlay_delay_ms: 400,
  overlay_min_duration_ms: 300,
  messages_catalog: {
    general: ["Carregando..."],
    submit: ["Enviando dados...", "Processando..."],
    data_load: ["Carregando dados...", "Buscando informações..."],
    upload: ["Enviando arquivo...", "Processando upload..."],
    whatsapp: ["Enviando mensagem...", "Conectando..."],
    ai_analysis: ["Analisando dados...", "Processando análise..."],
    calculation: ["Calculando economia...", "Simulando cenários..."],
    login: ["Verificando credenciais...", "Autenticando..."],
  },
  ai_messages_enabled: false,
  ai_min_duration_seconds: 3,
  ai_timeout_ms: 2000,
  ai_max_calls_per_flow: 1,
};

export function useLoadingConfig() {
  const { user } = useAuth();

  const { data: config, isLoading } = useQuery({
    queryKey: ["loading-config", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loading_config")
        .select("*")
        .maybeSingle();

      if (error) {
        console.warn("Failed to fetch loading config, using defaults:", error.message);
        return null;
      }

      return data as LoadingConfig | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const mergedConfig: Omit<LoadingConfig, "id" | "tenant_id"> = config
    ? { ...DEFAULT_CONFIG, ...config, messages_catalog: { ...DEFAULT_CONFIG.messages_catalog, ...(config.messages_catalog || {}) } }
    : DEFAULT_CONFIG;

  return {
    config: mergedConfig,
    isLoading,
    defaults: DEFAULT_CONFIG,
  };
}
