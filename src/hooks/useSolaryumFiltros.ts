import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types (based on Solaryum Plataforma-V1 API) ──────────

export interface MarcaIntegracaoPlataforma {
  idMarca: number;
  descricao: string;
}

export interface TipoTelhadoIntegracaoPlataforma {
  id: number;
  descricao: string;
}

export interface PotenciaPainelIntegracaoPlataforma {
  potencia: number;
}

export interface FiltrosIntegracaoPlataforma {
  marcasPaineis: MarcaIntegracaoPlataforma[];
  marcasInversores: MarcaIntegracaoPlataforma[];
  tiposTelhados: TipoTelhadoIntegracaoPlataforma[];
  potenciasPaineis: PotenciaPainelIntegracaoPlataforma[];
}

// ─── Hook ──────────

export function useSolaryumFiltros(distribuidor: "vertys" | "jng" | null) {
  return useQuery({
    queryKey: ["solaryum-filtros", distribuidor],
    queryFn: async () => {
      if (!distribuidor) return null;
      const { data, error } = await supabase.functions.invoke("solaryum-proxy", {
        body: { distribuidor, endpoint: "BuscarFiltros", params: {} },
      });
      if (error) throw error;
      return data as FiltrosIntegracaoPlataforma;
    },
    enabled: !!distribuidor,
    staleTime: 1000 * 60 * 60, // 1 hora — filtros mudam pouco
  });
}
