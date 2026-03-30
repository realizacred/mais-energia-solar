/**
 * useEdeltecCatalog — Hook para buscar kits Edeltec do catálogo.
 * §16: Queries só em hooks. RB-04. RB-05: staleTime.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EdeltecCatalogKit {
  id: string;
  name: string;
  description: string | null;
  estimated_kwp: number | null;
  fixed_price: number | null;
  source: string;
  external_id: string | null;
  external_code: string | null;
  fabricante: string | null;
  marca: string | null;
  tipo: string | null;
  potencia_inversor: number | null;
  potencia_modulo: number | null;
  fase: string | null;
  tensao: string | null;
  estrutura: string | null;
  preco_consumidor: number | null;
  valor_avulso: number | null;
  disponivel: boolean;
  permite_compra_sem_estoque: boolean;
  previsao: string | null;
  product_kind: string;
  is_generator: boolean;
  is_available_now: boolean;
  preco_por_kwp: number | null;
  imagem_principal_url: string | null;
  thumbnail_url: string | null;
  external_data: Record<string, any> | null;
  last_synced_at: string | null;
  status: string;
}

export interface EdeltecCatalogFilters {
  onlyGenerators?: boolean;
  search?: string;
  fase?: string;
  fabricante?: string;
  disponibilidade?: "all" | "em_estoque" | "sob_encomenda";
  minKwp?: number;
  maxKwp?: number;
}

const STALE_TIME = 1000 * 60 * 5; // 5 min
const QUERY_KEY = "edeltec-catalog" as const;

export function useEdeltecCatalog(filters?: EdeltecCatalogFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from("solar_kit_catalog")
        .select("id, name, description, estimated_kwp, fixed_price, source, external_id, external_code, fabricante, marca, tipo, potencia_inversor, potencia_modulo, fase, tensao, estrutura, preco_consumidor, valor_avulso, disponivel, permite_compra_sem_estoque, previsao, product_kind, is_generator, is_available_now, preco_por_kwp, imagem_principal_url, thumbnail_url, external_data, last_synced_at, status")
        .eq("source", "edeltec")
        .order("estimated_kwp", { ascending: true });

      if (filters?.onlyGenerators !== false) {
        query = query.eq("is_generator", true);
      }

      const { data, error } = await query;
      if (error) throw error;

      let result = (data || []) as EdeltecCatalogKit[];

      // Client-side filters for complex conditions
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(k =>
          k.name.toLowerCase().includes(q) ||
          (k.fabricante || "").toLowerCase().includes(q) ||
          (k.description || "").toLowerCase().includes(q)
        );
      }
      if (filters?.fase) {
        result = result.filter(k => (k.fase || "").toLowerCase().includes(filters.fase!.toLowerCase()));
      }
      if (filters?.fabricante) {
        const q = filters.fabricante.toLowerCase();
        result = result.filter(k => (k.fabricante || "").toLowerCase().includes(q));
      }
      if (filters?.disponibilidade === "em_estoque") {
        result = result.filter(k => k.disponivel === true);
      } else if (filters?.disponibilidade === "sob_encomenda") {
        result = result.filter(k => !k.disponivel && k.permite_compra_sem_estoque);
      }
      if (filters?.minKwp) {
        result = result.filter(k => (k.estimated_kwp || 0) >= filters.minKwp!);
      }
      if (filters?.maxKwp) {
        result = result.filter(k => (k.estimated_kwp || 0) <= filters.maxKwp!);
      }

      return result;
    },
    staleTime: STALE_TIME,
  });
}

/** Stats derived from the full catalog */
export function useEdeltecCatalogStats() {
  return useQuery({
    queryKey: [QUERY_KEY, "stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solar_kit_catalog")
        .select("id, is_generator, disponivel, permite_compra_sem_estoque, is_available_now, last_synced_at")
        .eq("source", "edeltec");

      if (error) throw error;
      const all = (data || []) as any[];
      const generators = all.filter(k => k.is_generator);
      const emEstoque = generators.filter(k => k.disponivel === true);
      const sobEncomenda = generators.filter(k => !k.disponivel && k.permite_compra_sem_estoque);
      const lastSync = all.reduce((latest: string | null, k: any) => {
        if (!k.last_synced_at) return latest;
        if (!latest || k.last_synced_at > latest) return k.last_synced_at;
        return latest;
      }, null);

      return {
        totalSynced: all.length,
        totalGenerators: generators.length,
        emEstoque: emEstoque.length,
        sobEncomenda: sobEncomenda.length,
        lastSyncedAt: lastSync,
      };
    },
    staleTime: STALE_TIME,
  });
}
