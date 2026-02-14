import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type WritingAction =
  | "improve"
  | "professional"
  | "friendly"
  | "expand"
  | "summarize"
  | "translate_en"
  | "translate_es";

export const WRITING_ACTIONS: {
  key: WritingAction;
  label: string;
  emoji: string;
}[] = [
  { key: "improve", label: "Melhorar texto", emoji: "✨" },
  { key: "professional", label: "Tom profissional", emoji: "👔" },
  { key: "friendly", label: "Tom amigável", emoji: "😊" },
  { key: "expand", label: "Expandir texto", emoji: "📝" },
  { key: "summarize", label: "Resumir", emoji: "📋" },
  { key: "translate_en", label: "Traduzir → Inglês", emoji: "🇺🇸" },
  { key: "translate_es", label: "Traduzir → Espanhol", emoji: "🇪🇸" },
];

const DEBOUNCE_MS = 3000;
const MAX_TEXT_LENGTH = 2000;

interface WritingAssistantState {
  isLoading: boolean;
  originalText: string | null;
  suggestion: string | null;
  model: string | null;
  error: string | null;
}

export function useWritingAssistant() {
  const [state, setState] = useState<WritingAssistantState>({
    isLoading: false,
    originalText: null,
    suggestion: null,
    model: null,
    error: null,
  });

  const lastCallRef = useRef<number>(0);

  const requestSuggestion = useCallback(
    async (text: string, action: WritingAction) => {
      // ── Validations ──
      if (!text || text.trim().length < 3) {
        toast.warning("Digite pelo menos 3 caracteres.");
        return;
      }

      if (text.length > MAX_TEXT_LENGTH) {
        toast.warning(`Texto muito longo (máx ${MAX_TEXT_LENGTH} caracteres).`);
        return;
      }

      if (!navigator.onLine) {
        toast.error("Sem conexão com a internet.");
        return;
      }

      // ── Client-side debounce ──
      const now = Date.now();
      if (now - lastCallRef.current < DEBOUNCE_MS) {
        toast.warning("Aguarde alguns segundos antes de tentar novamente.");
        return;
      }
      lastCallRef.current = now;

      setState({
        isLoading: true,
        originalText: text.trim(),
        suggestion: null,
        model: null,
        error: null,
      });

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          toast.error("Sessão expirada. Faça login novamente.");
          setState((s) => ({ ...s, isLoading: false, error: "auth" }));
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/writing-assistant`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              text: text.trim(),
              action,
              locale: navigator.language || "pt-BR",
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          const errorMsg = data.error || "Erro desconhecido";

          if (response.status === 429) {
            toast.warning(errorMsg);
          } else if (response.status === 402) {
            toast.error(errorMsg);
          } else if (response.status === 502) {
            toast.info(errorMsg);
          } else {
            toast.error(errorMsg);
          }

          setState((s) => ({
            ...s,
            isLoading: false,
            error: errorMsg,
          }));
          return;
        }

        setState({
          isLoading: false,
          originalText: text.trim(),
          suggestion: data.suggestion,
          model: data.model,
          error: null,
        });
      } catch (err) {
        console.error("[WritingAssistant] fetch error:", err);
        toast.error(
          "Assistente de escrita indisponível. Envie sua mensagem normalmente."
        );
        setState((s) => ({
          ...s,
          isLoading: false,
          error: "network",
        }));
      }
    },
    []
  );

  const dismiss = useCallback(() => {
    setState({
      isLoading: false,
      originalText: null,
      suggestion: null,
      model: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    requestSuggestion,
    dismiss,
  };
}
