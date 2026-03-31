/**
 * useMunicipiosIBGE — Hook para busca e resolução de municípios IBGE
 *
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 *
 * Uso:
 *   const { searchMunicipios, getMunicipioByCodigo } = useMunicipiosIBGE();
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MunicipioIBGE {
  codigo_ibge: string;
  nome: string;
  nome_normalizado: string;
  uf_sigla: string;
  uf_codigo: string | null;
  regiao: string | null;
  ativo: boolean;
}

const STALE_TIME = 1000 * 60 * 15; // 15 min — dados estáticos
const QUERY_KEY = "municipios_ibge" as const;

/**
 * Busca municípios por termo (nome parcial) com filtro opcional de UF
 */
export function useSearchMunicipios(term: string, uf?: string) {
  const normalizedTerm = term
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  return useQuery({
    queryKey: [QUERY_KEY, "search", normalizedTerm, uf],
    queryFn: async () => {
      if (!normalizedTerm || normalizedTerm.length < 2) return [];

      let query = supabase
        .from("municipios_ibge" as any)
        .select("codigo_ibge, nome, uf_sigla, uf_codigo, regiao")
        .ilike("nome_normalizado", `%${normalizedTerm}%`)
        .eq("ativo", true)
        .order("nome")
        .limit(20);

      if (uf) {
        query = query.eq("uf_sigla", uf.toUpperCase());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as MunicipioIBGE[];
    },
    staleTime: STALE_TIME,
    enabled: normalizedTerm.length >= 2,
  });
}

/**
 * Busca um município específico por código IBGE
 */
export function useMunicipioByCodigo(codigo: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, "detail", codigo],
    queryFn: async () => {
      if (!codigo) return null;

      const { data, error } = await supabase
        .from("municipios_ibge" as any)
        .select("codigo_ibge, nome, uf_sigla, uf_codigo, regiao")
        .eq("codigo_ibge", codigo)
        .single();

      if (error) throw error;
      return data as unknown as MunicipioIBGE;
    },
    staleTime: STALE_TIME,
    enabled: !!codigo,
  });
}

/**
 * Resolve município a partir de cidade/UF textuais
 * Útil para backfill e integração com endereços existentes
 */
export async function resolveMunicipioFromAddress(
  cidade: string,
  uf: string
): Promise<MunicipioIBGE | null> {
  const normalizedCidade = cidade
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const { data, error } = await supabase
    .from("municipios_ibge" as any)
    .select("codigo_ibge, nome, uf_sigla, uf_codigo, regiao")
    .eq("nome_normalizado", normalizedCidade)
    .eq("uf_sigla", uf.toUpperCase())
    .eq("ativo", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as MunicipioIBGE;
}

/**
 * Valida se um código IBGE existe
 */
export async function validateMunicipioIBGE(
  codigo: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("municipios_ibge" as any)
    .select("*", { count: "exact", head: true })
    .eq("codigo_ibge", codigo)
    .eq("ativo", true);

  if (error) return false;
  return (count || 0) > 0;
}
