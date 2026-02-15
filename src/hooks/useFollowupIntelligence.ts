import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AiInsight {
  loading: boolean;
  error: string | null;
  data: any | null;
}

export function useFollowupIntelligence() {
  const [state, setState] = useState<Record<string, AiInsight>>({});

  const callIntelligence = useCallback(
    async (conversationId: string, action: string, extra?: Record<string, any>) => {
      const key = `${conversationId}:${action}`;
      setState((s) => ({ ...s, [key]: { loading: true, error: null, data: null } }));

      try {
        const { data, error } = await supabase.functions.invoke("ai-followup-intelligence", {
          body: { conversation_id: conversationId, action, ...extra },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setState((s) => ({ ...s, [key]: { loading: false, error: null, data } }));
        return data;
      } catch (err: any) {
        const msg = err.message || "Erro ao chamar IA";
        setState((s) => ({ ...s, [key]: { loading: false, error: msg, data: null } }));
        toast({ title: "Erro IA", description: msg, variant: "destructive" });
        return null;
      }
    },
    []
  );

  const generateMessage = useCallback(
    (conversationId: string, cenario?: string, tentativa?: number) =>
      callIntelligence(conversationId, "generate_message", { cenario, tentativa }),
    [callIntelligence]
  );

  const classifyUrgency = useCallback(
    (conversationId: string) =>
      callIntelligence(conversationId, "classify_urgency"),
    [callIntelligence]
  );

  const suggestTiming = useCallback(
    (conversationId: string) =>
      callIntelligence(conversationId, "suggest_timing"),
    [callIntelligence]
  );

  const summarize = useCallback(
    (conversationId: string) =>
      callIntelligence(conversationId, "summarize"),
    [callIntelligence]
  );

  const getState = useCallback(
    (conversationId: string, action: string): AiInsight =>
      state[`${conversationId}:${action}`] || { loading: false, error: null, data: null },
    [state]
  );

  return { generateMessage, classifyUrgency, suggestTiming, summarize, getState };
}
