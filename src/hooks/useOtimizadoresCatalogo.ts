/**
 * Hooks for Otimizadores Catalogo (optimizer catalog).
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "otimizadores-catalogo" as const;

const SELECT_COLS = "id, tenant_id, fabricante, modelo, potencia_wp, tensao_entrada_max_v, corrente_entrada_max_a, tensao_saida_v, corrente_saida_max_a, eficiencia_percent, compatibilidade, dimensoes_mm, peso_kg, garantia_anos, ip_protection, datasheet_url, status, ativo, created_at, updated_at";

export interface Otimizador {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_wp: number | null;
  tensao_entrada_max_v: number | null;
  corrente_entrada_max_a: number | null;
  tensao_saida_v: number | null;
  corrente_saida_max_a: number | null;
  eficiencia_percent: number | null;
  compatibilidade: string | null;
  dimensoes_mm: string | null;
  peso_kg: number | null;
  garantia_anos: number | null;
  ip_protection: string | null;
  datasheet_url: string | null;
  status: string;
  ativo: boolean;
  tenant_id: string | null;
}

export function useOtimizadoresCatalogo() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const allData: Otimizador[] = [];
      const batchSize = 1000;
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from("otimizadores_catalogo")
          .select(SELECT_COLS)
          .order("fabricante")
          .order("potencia_wp")
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData.push(...(data as Otimizador[]));
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      return allData;
    },
    staleTime: STALE_TIME,
  });
}

export function useSalvarOtimizador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, unknown> }) => {
      if (id) {
        const { error } = await supabase.from("otimizadores_catalogo").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("otimizadores_catalogo").insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeletarOtimizador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("otimizadores_catalogo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useToggleOtimizador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("otimizadores_catalogo").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
