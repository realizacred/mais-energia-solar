/**
 * Hook to read / save Meta Facebook integration_configs.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseEdgeFunctionError } from "@/lib/parseEdgeFunctionError";
import { toast } from "sonner";

export const META_KEYS = {
  appId: "meta_facebook_app_id",
  accessToken: "meta_facebook",
  appSecret: "meta_facebook_app_secret",
  verifyToken: "meta_facebook_verify_token",
  selectedPages: "meta_facebook_selected_pages",
  selectedAccounts: "meta_facebook_selected_accounts",
} as const;

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "meta-fb-configs";

export interface MetaConfigMap {
  [serviceKey: string]: {
    id: string;
    service_key: string;
    api_key: string;
    is_active: boolean;
    updated_at: string;
    account_name?: string;
  };
}


export function useMetaFbConfigs() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const keys = Object.values(META_KEYS);
      
      // Fetch from integration_configs
      const { data: configs, error: configsError } = await supabase
        .from("integration_configs")
        .select("id, service_key, api_key, is_active, updated_at")
        .in("service_key", keys);
      
      if (configsError) throw configsError;

      // Fetch from facebook_integrations (the new OAuth system)
      const { data: fbIntegrations, error: fbError } = await supabase
        .from("facebook_integrations")
        .select("*")
        .maybeSingle();

      if (fbError) throw fbError;

      const map: MetaConfigMap = {};
      configs?.forEach((c) => (map[c.service_key] = c));

      // If we have an OAuth integration, override the access token in the map
      if (fbIntegrations && fbIntegrations.status === 'connected') {
        map[META_KEYS.accessToken] = {
          id: fbIntegrations.id,
          service_key: META_KEYS.accessToken,
          api_key: fbIntegrations.access_token || "",
          is_active: fbIntegrations.status === 'connected',
          updated_at: fbIntegrations.connected_at || fbIntegrations.updated_at,
          account_name: fbIntegrations.connected_account_name,
        };

      }

      return map;
    },
    staleTime: STALE_TIME,
  });
}

export function useSaveMetaKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceKey, apiKey }: { serviceKey: string; apiKey: string }) => {
      const resp = await supabase.functions.invoke("save-integration-key", {
        body: { service_key: serviceKey, api_key: apiKey },
      });
      if (resp.error) {
        const msg = await parseEdgeFunctionError(resp.error, "Erro ao salvar");
        throw new Error(msg);
      }
      const body = resp.data as any;
      if (body?.error) throw new Error(body.details ? `${body.error}: ${body.details}` : body.error);
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["integration-health"] });
    },
  });
}

export function useMetaAutomation() {
  return useQuery({
    queryKey: ["fb-lead-automation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_lead_automations")
        .select("*")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: STALE_TIME,
  });
}

export function useSaveMetaAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      pipeline_id: string | null;
      stage_id: string | null;
      responsible_user_id: string | null;
      round_robin: boolean;
      round_robin_users: string[];
      field_mapping: Record<string, string>;
    }) => {
      // Resolve tenant_id from current user profile (RLS default)
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .single();
      const tenantId = profile?.tenant_id;
      if (!tenantId) throw new Error("Tenant não encontrado");

      // Upsert: find existing or create
      const { data: existing } = await supabase
        .from("facebook_lead_automations")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("facebook_lead_automations")
          .update({
            ...payload,
            active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("facebook_lead_automations")
          .insert([{
            ...payload,
            tenant_id: tenantId,
            active: true,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fb-lead-automation"] });
    },
  });
}

export function useDisconnectMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // 1. Mark as disconnected in DB
      const { error } = await supabase
        .from("facebook_integrations")
        .update({ status: 'disconnected', access_token: null })
        .eq('status', 'connected'); 
      
      if (error) throw error;

      // 2. Clear integration_configs too for backward compatibility
      await supabase
        .from("integration_configs")
        .delete()
        .eq("service_key", META_KEYS.accessToken);

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Desconectado do Facebook");
    },
  });
}
