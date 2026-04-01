import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types (based on Solaryum Plataforma-V1 API) ──────────

export interface ProdutoComposicaoSolaryum {
  idProduto: number;
  descricao: string | null;
  qtd: number | null;
  agrupamento: string | null;
  marca: string | null;
  unidade: string | null;
  potencia: number | null;
  fotoUrl: string | null;
  idCategoria: number;
  categoria: string | null;
}

export interface ProdutoSolaryum {
  idProduto: number;
  codErp: string | null;
  descricao: string | null;
  precoVenda: number;
  marca: string | null;
  modelo: string | null;
  categoria: string | null;
  potencia: number;
  estoque: number;
  dtDisponibilidade: string | null;
  marcaPainel: string | null;
  marcaInversor: string | null;
  tensao: number | null;
  fase: number | null;
  tipoInv: number | null;
  telhado: number | null;
  estrutura: string | null;
  fotoUrl: string | null;
  composicao: ProdutoComposicaoSolaryum[] | null;
}

// ─── Params ──────────

interface UseSolaryumKitsParams {
  distribuidor: "vertys" | "jng" | null;
  endpoint: "BuscarKits" | "MontarKits";
  potenciaDoKit?: number | null;
  ibge?: string | null;
  fase?: number | null;
  tensao?: number | null;
  tipoInv?: number | null;
  marcaPainel?: string | null;
  marcaInversor?: string | null;
  cifComDescarga?: boolean;
  enabled?: boolean;
}

// ─── Hook ──────────

export function useSolaryumKits(params: UseSolaryumKitsParams) {
  const {
    distribuidor,
    endpoint,
    potenciaDoKit,
    ibge,
    fase,
    tensao,
    tipoInv,
    marcaPainel,
    marcaInversor,
    cifComDescarga = false,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: [
      "solaryum-kits",
      distribuidor,
      endpoint,
      potenciaDoKit,
      ibge,
      fase,
      tensao,
      tipoInv,
      marcaPainel,
      marcaInversor,
      cifComDescarga,
    ],
    queryFn: async () => {
      if (!distribuidor || !ibge) return [];
      const queryParams: Record<string, any> = { cifComDescarga };
      if (potenciaDoKit != null) queryParams.potenciaDoKit = potenciaDoKit;
      if (fase != null) queryParams.fase = fase;
      if (tensao != null) queryParams.tensao = tensao;
      if (tipoInv != null) queryParams.tipoInv = tipoInv;
      if (marcaPainel) queryParams.marcaPainel = marcaPainel;
      if (marcaInversor) queryParams.marcaInversor = marcaInversor;
      if (ibge) queryParams.ibge = ibge;

      const { data, error } = await supabase.functions.invoke(
        "solaryum-proxy",
        { body: { distribuidor, endpoint, params: queryParams } }
      );
      if (error) throw error;
      return (data ?? []) as ProdutoSolaryum[];
    },
    enabled: enabled && !!distribuidor && !!ibge,
    staleTime: 1000 * 60 * 5,
  });
}
