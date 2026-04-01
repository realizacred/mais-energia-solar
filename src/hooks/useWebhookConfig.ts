// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "webhook-config" as const;

export interface WebhookConfig {
  id: string;
  nome: string;
  url: string;
  ativo: boolean;
  eventos: string[];
  created_at: string;
}

export function useWebhookConfigs() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_config")
        .select("id, tenant_id, nome, url, eventos, ativo, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WebhookConfig[];
    },
    staleTime: STALE_TIME,
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { nome: string; url: string; eventos: string[] }) => {
      const { error } = await supabase.from("webhook_config").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useToggleWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("webhook_config").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhook_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

/**
 * Returns the full webhook URL for a given payment gateway.
 * Used in TabCobrancas to display the URL the user must configure
 * in their gateway dashboard.
 */
export function useWebhookUrl(gateway: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) return "";
  const projectRef = supabaseUrl
    .replace("https://", "")
    .replace(".supabase.co", "");
  return `https://${projectRef}.supabase.co/functions/v1/webhook-cobranca?gateway=${gateway}`;
}
