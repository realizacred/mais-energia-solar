/**
 * useSendProposalMessage.ts
 * §16: Queries só em hooks
 * Mutation para envio real de mensagem da proposta via edge function.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseInvokeError } from "@/lib/supabaseFunctionError";

export interface SendProposalMessagePayload {
  canal: "whatsapp" | "email" | "copy";
  conteudo: string;
  destinatario_valor: string;
  destinatario_tipo: "cliente" | "consultor";
  tipo_mensagem: "cliente" | "consultor";
  estilo: "curta" | "completa";
  proposta_id: string;
  versao_id: string;
  projeto_id: string;
  cliente_id?: string | null;
  cliente_nome?: string | null;
}

export function useSendProposalMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendProposalMessagePayload) => {
      // For "copy" channel, just log without sending
      if (payload.canal === "copy") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Não autenticado");

        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

        const { error } = await (supabase as any)
          .from("proposal_message_logs")
          .insert({
            tenant_id: profile.tenant_id,
            proposta_id: payload.proposta_id,
            versao_id: payload.versao_id,
            projeto_id: payload.projeto_id,
            cliente_id: payload.cliente_id || null,
            user_id: user.id,
            tipo_mensagem: payload.tipo_mensagem,
            estilo: payload.estilo,
            canal: "copy",
            destinatario_tipo: payload.destinatario_tipo,
            destinatario_valor: payload.destinatario_valor || null,
            conteudo: payload.conteudo,
            status: "sent",
            sent_at: new Date().toISOString(),
          });

        if (error) throw error;
        return { success: true };
      }

      // Real send via edge function
      const { data, error } = await supabase.functions.invoke("send-proposal-message", {
        body: payload,
      });

      if (error) {
        const parsed = await parseInvokeError(error);
        throw new Error(parsed.message);
      }
      if (data && !data.success) throw new Error(data.error || "Erro no envio");
      return data;
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["proposal-message-logs", variables.proposta_id] });
    },
  });
}
