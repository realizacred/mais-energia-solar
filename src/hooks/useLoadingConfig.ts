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

const CACHE_KEY_PREFIX = "loading-config-cache";
const CACHE_KEY_GLOBAL = "loading-config-cache-latest";

function cacheKey(tenantId?: string): string {
  return tenantId ? `${CACHE_KEY_PREFIX}-${tenantId}` : CACHE_KEY_PREFIX;
}

function getCachedConfig(tenantId?: string): LoadingConfig | null {
  try {
    const raw = localStorage.getItem(cacheKey(tenantId));
    if (!raw) return null;
    return JSON.parse(raw) as LoadingConfig;
  } catch {
    return null;
  }
}

function getGlobalCachedConfig(): LoadingConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_GLOBAL);
    if (!raw) return null;
    return JSON.parse(raw) as LoadingConfig;
  } catch {
    return null;
  }
}

function setCachedConfig(config: LoadingConfig) {
  try {
    localStorage.setItem(cacheKey(config.tenant_id), JSON.stringify(config));
    // Also store a global "latest" copy so pre-auth screens can use it
    localStorage.setItem(CACHE_KEY_GLOBAL, JSON.stringify(config));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export function useLoadingConfig() {
  const { user } = useAuth();

  const { data: config, isLoading } = useQuery({
    queryKey: ["loading-config", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loading_config")
        .select("id, tenant_id, sun_loader_enabled, sun_loader_style, loader_theme, custom_loader_url, show_messages, messages_catalog, overlay_delay_ms, overlay_min_duration_ms, ai_messages_enabled, ai_max_calls_per_flow, ai_min_duration_seconds, ai_timeout_ms, created_at, updated_at")
        .maybeSingle();

      if (error) {
        console.warn("Failed to fetch loading config, using defaults:", error.message);
        return null;
      }

      if (data) {
        setCachedConfig(data as LoadingConfig);
      }

      return data as LoadingConfig | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Use cached config instantly while DB fetch is in-flight
  // Try tenant-specific cache first, then global "latest" cache, then legacy key
  const tenantId = config?.tenant_id ?? user?.user_metadata?.tenant_id;
  const effectiveConfig = config ?? getCachedConfig(tenantId) ?? getGlobalCachedConfig() ?? getCachedConfig();

  const mergedConfig: Omit<LoadingConfig, "id" | "tenant_id"> = effectiveConfig
    ? { ...DEFAULT_CONFIG, ...effectiveConfig, messages_catalog: { ...DEFAULT_CONFIG.messages_catalog, ...(effectiveConfig.messages_catalog || {}) } }
    : DEFAULT_CONFIG;

  return {
    config: mergedConfig,
    isLoading,
    defaults: DEFAULT_CONFIG,
  };
}
