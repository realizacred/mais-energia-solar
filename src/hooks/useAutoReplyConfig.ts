/**
 * Hook para dados de AutoReplyConfig.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 15;

type AutoReplyData = {
  ativo: boolean;
  mensagem_fora_horario: string;
  mensagem_feriado: string;
  cooldown_minutos: number;
  silenciar_sla: boolean;
  silenciar_alertas: boolean;
};

// ─── Load Config ──────────────────────────
export function useAutoReplyConfigData(tenantId: string) {
  return useQuery({
    queryKey: ["auto-reply-config", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_auto_reply_config")
        .select(
          "ativo, mensagem_fora_horario, mensagem_feriado, cooldown_minutos, silenciar_sla, silenciar_alertas"
        )
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data as AutoReplyData | null;
    },
    enabled: !!tenantId,
    staleTime: STALE_TIME,
  });
}

// ─── Save Config Mutation ──────────────────────────
export function useSaveAutoReplyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      config,
      exists,
    }: {
      tenantId: string;
      config: AutoReplyData;
      exists: boolean;
    }) => {
      const payload = { tenant_id: tenantId, ...config };
      const { error } = exists
        ? await supabase
            .from("wa_auto_reply_config")
            .update(config)
            .eq("tenant_id", tenantId)
        : await supabase.from("wa_auto_reply_config").insert(payload);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["auto-reply-config", variables.tenantId],
      });
    },
  });
}
