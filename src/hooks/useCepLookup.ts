/**
 * useCepLookup — Hook único para busca de CEP via ViaCEP
 *
 * SUBSTITUI o código duplicado em:
 * - ClientesManager.tsx
 * - ConvertLeadToClientDialog.tsx
 * - LeadForm.tsx / LeadFormWizard.tsx
 * - NovoProjetoModal.tsx
 * - ProjectAddressFields.tsx
 * - StepCliente.tsx
 *
 * USO:
 *   const { fetchCep, loading, error } = useCepLookup();
 *
 *   // Quando o CEP estiver completo:
 *   const address = await fetchCep("01310-100");
 *   if (address) {
 *     setForm({ ...form, rua: address.logradouro, bairro: address.bairro, ... })
 *   }
 */

import { useState, useCallback } from "react";

export interface CepAddress {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;   // cidade
  uf: string;           // estado
  ibge: string;
  erro?: boolean;
  /** Aliases for convenience */
  rua: string;
  cidade: string;
  estado: string;
}

interface UseCepLookupReturn {
  fetchCep: (cep: string) => Promise<CepAddress | null>;
  /** Alias for fetchCep — keeps backward compat */
  lookup: (cep: string) => Promise<CepAddress | null>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCepLookup(): UseCepLookupReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchCep = useCallback(async (cep: string): Promise<CepAddress | null> => {
    const digits = cep.replace(/\D/g, "");

    if (digits.length !== 8) {
      setError("CEP deve ter 8 dígitos");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);

      if (!res.ok) {
        throw new Error(`Erro HTTP ${res.status}`);
      }

      const raw = await res.json();

      if (raw.erro) {
        setError("CEP não encontrado");
        return null;
      }

      const data: CepAddress = {
        ...raw,
        rua: raw.logradouro ?? "",
        cidade: raw.localidade ?? "",
        estado: raw.uf ?? "",
      };

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao buscar CEP";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchCep, lookup: fetchCep, loading, error, clearError };
}

/**
 * Formata string de CEP para exibição: "01310100" → "01310-100"
 */
export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
