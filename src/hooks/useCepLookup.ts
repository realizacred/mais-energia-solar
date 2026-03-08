import { useCallback, useRef, useState } from "react";

export interface CepResult {
  rua?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  complemento?: string;
}

/**
 * Centralized CEP lookup via ViaCEP with built-in cache, abort control and loading state.
 * Replaces all inline fetch(...viacep...) calls across the codebase.
 */
export function useCepLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<Map<string, CepResult>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const lookup = useCallback(async (cep: string): Promise<CepResult | null> => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return null;

    // Check cache
    const cached = cacheRef.current.get(digits);
    if (cached) return cached;

    // Abort previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.erro) return null;

      const result: CepResult = {
        rua: data.logradouro || undefined,
        bairro: data.bairro || undefined,
        cidade: data.localidade || undefined,
        estado: data.uf || undefined,
        complemento: data.complemento || undefined,
      };
      cacheRef.current.set(digits, result);
      return result;
    } catch (err: any) {
      if (err?.name === "AbortError") return null;
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { lookup, isLoading };
}
