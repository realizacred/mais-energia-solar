import { useState, useEffect } from "react";

interface CidadeIBGE {
  nome: string;
}

/**
 * Hook que busca cidades de um estado via API do IBGE
 */
export function useCidadesPorEstado(uf: string) {
  const [cidades, setCidades] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!uf || uf.length !== 2) {
      setCidades([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
      .then((res) => res.json())
      .then((data: CidadeIBGE[]) => {
        if (!cancelled) {
          setCidades(data.map((c) => c.nome));
        }
      })
      .catch(() => {
        if (!cancelled) setCidades([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uf]);

  return { cidades, isLoading };
}
