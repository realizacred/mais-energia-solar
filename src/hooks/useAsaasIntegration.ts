/**
 * useAsaasIntegration — Hook for Asaas integration config, status and logs.
 * §16: Queries in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionContext } from "@/hooks/useSessionContext";

const STALE_CONFIG = 1000 * 60 * 5;
const STALE_LOGS = 1000 * 60 * 2;
const QK = "asaas-integration" as const;

export interface AsaasConfig {
  id: string;
  tenant_id: string;
  provider: string;
  environment: string;
  api_key: string;
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

export function useAsaasConfig(tenantId: string | undefined) {
  return useQuery({
    queryKey: [QK, "config", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_gateway_config")
        .select("*")
        .eq("provider", "asaas")
        .maybeSingle();
      if (error) throw error;
      return data as AsaasConfig | null;
    },
    staleTime: STALE_CONFIG,
    enabled: !!tenantId,
  });
}

export function useAsaasWebhookEvents(tenantId: string | undefined) {
  return useQuery({
    queryKey: [QK, "events", tenantId],
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
    enabled: !!tenantId,
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      if (payload.existingId) {
        const { error } = await supabase
          .from("payment_gateway_config")
          .update({
            api_key: payload.api_key,
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
            tenant_id: profile.tenant_id,
            provider: "asaas",
            api_key: payload.api_key,
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
