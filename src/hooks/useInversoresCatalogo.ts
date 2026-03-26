/**
 * Hooks for Inversores Catalogo (inverter catalog).
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "inversores-catalogo" as const;

const SELECT_COLS = "id, tenant_id, fabricante, modelo, potencia_nominal_kw, potencia_maxima_kw, tipo, fases, mppt_count, strings_por_mppt, tensao_entrada_max_v, tensao_saida_v, corrente_entrada_max_a, tensao_mppt_min_v, tensao_mppt_max_v, corrente_saida_a, fator_potencia, eficiencia_max_percent, peso_kg, dimensoes_mm, garantia_anos, ip_protection, wifi_integrado, datasheet_url, status, ativo, created_at, updated_at";

export interface Inversor {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_nominal_kw: number;
  potencia_maxima_kw: number | null;
  tipo: string;
  tensao_entrada_max_v: number | null;
  corrente_entrada_max_a: number | null;
  tensao_mppt_min_v: number | null;
  tensao_mppt_max_v: number | null;
  corrente_saida_a: number | null;
  fator_potencia: number | null;
  mppt_count: number | null;
  strings_por_mppt: number | null;
  fases: string;
  tensao_saida_v: number | null;
  eficiencia_max_percent: number | null;
  garantia_anos: number | null;
  peso_kg: number | null;
  dimensoes_mm: string | null;
  wifi_integrado: boolean | null;
  ip_protection: string | null;
  datasheet_url: string | null;
  status: string;
  ativo: boolean;
  tenant_id: string | null;
}

export function useInversoresCatalogo() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inversores_catalogo")
        .select(SELECT_COLS)
        .order("fabricante")
        .order("potencia_nominal_kw");
      if (error) throw error;
      return data as Inversor[];
    },
    staleTime: STALE_TIME,
  });
}

export function useSalvarInversor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, unknown> }) => {
      if (id) {
        const { error } = await supabase.from("inversores_catalogo").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inversores_catalogo").insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeletarInversor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inversores_catalogo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useToggleInversor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("inversores_catalogo").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
