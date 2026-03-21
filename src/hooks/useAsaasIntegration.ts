/**
 * useAsaasIntegration — Hook for Asaas integration config, status and logs.
 * §16: Queries in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { trackAsaasConfigured } from "@/hooks/useAsaasTracking";

const STALE_CONFIG = 1000 * 60 * 5;
const STALE_LOGS = 1000 * 60 * 2;
const QK = "asaas-integration" as const;

export interface AsaasConfig {
  id: string;
  tenant_id: string;
  provider: string;
  environment: string;
  is_active: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface AsaasWebhookEvent {
  id: string;
  tenant_id: string;
  provider: string;
  provider_event_id: string;
  received_at: string;
  payload: Record<string, any>;
  processed_at: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useAsaasConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [QK, "config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_gateway_config")
        .select("id, tenant_id, provider, environment, is_active, metadata, created_at, updated_at")
        .eq("provider", "asaas")
        .maybeSingle();
      if (error) throw error;
      return data as AsaasConfig | null;
    },
    staleTime: STALE_CONFIG,
    enabled: !!user,
  });
}

/** Check if Asaas API key is configured in integration_configs (secure storage) */
export function useAsaasKeyConfigured() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [QK, "key-configured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_configs")
        .select("id, is_active")
        .eq("service_key", "asaas_api_key")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    staleTime: STALE_CONFIG,
    enabled: !!user,
  });
}

export function useAsaasWebhookEvents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [QK, "events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_webhook_events")
        .select("*")
        .eq("provider", "asaas")
        .order("received_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as AsaasWebhookEvent[];
    },
    staleTime: STALE_LOGS,
    enabled: !!user,
  });
}

export function useSaveAsaasConfig() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      api_key: string;
      environment: "sandbox" | "production";
      is_active: boolean;
      existingId?: string | null;
    }) => {
      const { tenantId } = await getCurrentTenantId();
      if (!tenantId) throw new Error("Tenant não encontrado");

      // 1. Save API key securely via edge function (never in payment_gateway_config)
      if (payload.api_key && payload.api_key.trim().length > 0) {
        const { error: secretError } = await supabase.functions.invoke("set-asaas-secret", {
          body: { api_key: payload.api_key },
        });
        if (secretError) throw new Error(secretError.message || "Erro ao salvar chave");
      }

      // 2. Save config (without api_key) in payment_gateway_config
      if (payload.existingId) {
        const { error } = await supabase
          .from("payment_gateway_config")
          .update({
            environment: payload.environment,
            is_active: payload.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("payment_gateway_config")
          .insert({
            tenant_id: tenantId,
            provider: "asaas",
            api_key: "", // empty — key stored in integration_configs
            environment: payload.environment,
            is_active: payload.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useTestAsaasConnection() {
  return useMutation({
    mutationFn: async (payload: { api_key: string; environment: string }) => {
      const { data, error } = await supabase.functions.invoke("asaas-test-connection", {
        body: payload,
      });
      if (error) throw error;
      return data as { success: boolean; balance?: number; error?: string };
    },
  });
}
