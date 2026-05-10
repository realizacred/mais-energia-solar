import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { WaConversation } from "@/types";

export function useUpdateAiContext() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async ({
      conversationId,
      novoContexto,
      motivo,
      origem = 'humano',
      projetoId,
      propostaId
    }: {
      conversationId: string;
      novoContexto: WaConversation['ai_context'];
      motivo?: string;
      origem?: 'sistema' | 'humano' | 'ia' | 'automacao';
      projetoId?: string | null;
      propostaId?: string | null;
    }) => {
      // 1. Get current context for history
      const { data: currentConv, error: fetchError } = await supabase
        .from('wa_conversations')
        .select('ai_context, tenant_id, projeto_id, proposta_id')
        .eq('id', conversationId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Update conversation
      const { error: updateError } = await supabase
        .from('wa_conversations')
        .update({
          ai_context: novoContexto,
          ai_context_updated_at: new Date().toISOString(),
          ai_context_reason: motivo || null,
          projeto_id: projetoId !== undefined ? projetoId : currentConv.projeto_id,
          proposta_id: propostaId !== undefined ? propostaId : currentConv.proposta_id
        })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      // 3. Insert into history
      const { error: eventError } = await supabase
        .from('wa_context_events')
        .insert({
          tenant_id: currentConv.tenant_id,
          conversation_id: conversationId,
          projeto_id: projetoId !== undefined ? projetoId : currentConv.projeto_id,
          proposta_id: propostaId !== undefined ? propostaId : currentConv.proposta_id,
          evento: `Alteração de contexto para ${novoContexto}`,
          context_anterior: currentConv.ai_context,
          context_novo: novoContexto,
          origem,
          usuario_id: user?.id,
          criado_em: new Date().toISOString()
        });

      if (eventError) {
        console.warn('Falha ao registrar wa_context_events:', eventError);
        // We don't throw here to not break the main flow if audit fails
      }

      return { conversationId, novoContexto };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
      toast({ title: "Contexto atualizado", description: "O estado da conversa foi alterado com sucesso." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar contexto", description: err.message, variant: "destructive" });
    }
  });

  return {
    updateContext: mutation.mutate,
    updateContextAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error
  };
}
