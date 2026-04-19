/**
 * useSolarmarketConfig — Lê/grava a configuração da integração SolarMarket
 * persistida em `integrations_api_configs` (provider='solarmarket').
 *
 * RB-04: queries em hook. RB-05: staleTime obrigatório.
 * Token armazenado em `credentials.api_token` (JSONB) e mascarado no retorno
 * pelo serviço canônico (integrationApiService).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  integrationApiService,
  type IntegrationApiConfig,
} from "@/services/integrationApiService";

export const SM_CONFIG_KEY = ["solarmarket-config"];

export interface SolarmarketConfig extends IntegrationApiConfig {}

async function fetchSmConfig(): Promise<SolarmarketConfig | null> {
  const { data, error } = await (supabase as any)
    .from("integrations_api_configs")
    .select(
      "id, tenant_id, provider, name, status, region, base_url, credentials, settings, last_tested_at, last_sync_at, is_active, created_at, updated_at"
    )
    .eq("provider", "solarmarket")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Mascarar token na UI
  const creds = (data.credentials || {}) as Record<string, any>;
  const token = typeof creds.api_token === "string" ? creds.api_token : "";
  const masked =
    token.length > 8
      ? `${token.slice(0, 4)}••••${token.slice(-4)}`
      : token
        ? "••••"
        : "";
  return {
    ...data,
    credentials: { api_token: masked },
  } as SolarmarketConfig;
}

export function useSolarmarketConfig() {
  const qc = useQueryClient();

  const configQuery = useQuery({
    queryKey: SM_CONFIG_KEY,
    queryFn: fetchSmConfig,
    staleTime: 1000 * 60 * 5,
  });

  const save = useMutation({
    mutationFn: async (input: { base_url: string; api_token: string }) => {
      const existing = configQuery.data;
      const credentials =
        input.api_token && !input.api_token.includes("••••")
          ? { api_token: input.api_token.trim() }
          : undefined;

      if (existing) {
        return integrationApiService.update(existing.id, {
          base_url: input.base_url.trim().replace(/\/+$/, ""),
          ...(credentials ? { credentials } : {}),
        } as any);
      }
      if (!credentials) {
        throw new Error("Informe o token da API SolarMarket.");
      }
      return integrationApiService.create({
        provider: "solarmarket",
        name: "SolarMarket",
        base_url: input.base_url.trim().replace(/\/+$/, ""),
        credentials,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SM_CONFIG_KEY }),
  });

  const setActive = useMutation({
    mutationFn: async (active: boolean) => {
      const c = configQuery.data;
      if (!c) throw new Error("Configuração inexistente.");
      return integrationApiService.toggleActive(c.id, active);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SM_CONFIG_KEY }),
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "solarmarket-import",
        { body: { action: "test-connection" } }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SM_CONFIG_KEY }),
  });

  const isConfigured =
    !!configQuery.data?.base_url && !!configQuery.data?.is_active;

  return {
    config: configQuery.data ?? null,
    isLoading: configQuery.isLoading,
    isConfigured,
    save,
    setActive,
    testConnection,
  };
}
