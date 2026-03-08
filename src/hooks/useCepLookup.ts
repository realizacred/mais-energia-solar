import { useCallback, useState } from "react";

interface CepResult {
  rua?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  complemento?: string;
}

export function useCepLookup() {
  const [isLoading, setIsLoading] = useState(false);

  const lookup = useCallback(async (cep: string): Promise<CepResult | null> => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return null;

    setIsLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) return null;
      return {
        rua: data.logradouro || undefined,
        bairro: data.bairro || undefined,
        cidade: data.localidade || undefined,
        estado: data.uf || undefined,
        complemento: data.complemento || undefined,
      };
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { lookup, isLoading };
}
