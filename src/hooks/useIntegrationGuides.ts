import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GuideStep {
  text: string;
  image_url?: string;
}

export interface IntegrationGuide {
  id: string;
  tenant_id: string | null;
  provider_id: string;
  title: string;
  portal_url: string | null;
  portal_label: string | null;
  warning: string | null;
  steps: GuideStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const STALE_TIME = 1000 * 60 * 10;
const QUERY_KEY = "integration-guides" as const;

export function useIntegrationGuides() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_guides" as any)
        .select("*")
        .order("provider_id");
      if (error) throw error;
      return (data || []) as unknown as IntegrationGuide[];
    },
    staleTime: STALE_TIME,
  });
}

export function useIntegrationGuideByProvider(providerId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, "by-provider", providerId],
    queryFn: async () => {
      if (!providerId) return null;
      const { data, error } = await supabase
        .from("integration_guides" as any)
        .select("*")
        .eq("provider_id", providerId)
        .eq("is_active", true)
        .order("tenant_id", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as IntegrationGuide | null;
    },
    staleTime: STALE_TIME,
    enabled: !!providerId,
  });
}

export function useSaveIntegrationGuide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<IntegrationGuide> & { provider_id: string; title: string; steps: GuideStep[] }) => {
      const { id, created_at, updated_at, ...rest } = payload as any;

      if (id) {
        const { data, error } = await supabase
          .from("integration_guides" as any)
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("integration_guides" as any)
          .insert(rest)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeleteIntegrationGuide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("integration_guides" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
