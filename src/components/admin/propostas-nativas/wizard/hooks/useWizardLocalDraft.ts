import { useEffect, useRef, useCallback } from "react";
import type { WizardSnapshot } from "./useWizardPersistence";

const STORAGE_KEY = "wizard_proposta_draft";
const DEBOUNCE_MS = 2000;

interface LocalDraftMeta {
  snapshot: WizardSnapshot;
  savedPropostaId: string | null;
  savedVersaoId: string | null;
  savedAt: string;
}

/** Saves wizard state to localStorage on every change (debounced). Restores on mount. */
export function useWizardLocalDraft() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((snapshot: WizardSnapshot, propostaId: string | null, versaoId: string | null) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const meta: LocalDraftMeta = {
          snapshot,
          savedPropostaId: propostaId,
          savedVersaoId: versaoId,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
      } catch { /* quota exceeded — ignore */ }
    }, DEBOUNCE_MS);
  }, []);

  const load = useCallback((): LocalDraftMeta | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as LocalDraftMeta;
    } catch {
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { persist, load, clear };
}
