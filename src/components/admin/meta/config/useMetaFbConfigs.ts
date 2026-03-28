/**
 * Hook to read / save Meta Facebook integration_configs.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseEdgeFunctionError } from "@/lib/parseEdgeFunctionError";

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
  };
}

export function useMetaFbConfigs() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const keys = Object.values(META_KEYS);
      const { data, error } = await supabase
        .from("integration_configs")
        .select("id, service_key, api_key, is_active, updated_at")
        .in("service_key", keys);
      if (error) throw error;
      const map: MetaConfigMap = {};
      data?.forEach((c) => (map[c.service_key] = c));
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
