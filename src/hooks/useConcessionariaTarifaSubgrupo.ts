import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TarifaSubgrupoResult {
  // BT
  tarifa_energia: number;
  tarifa_fio_b: number;
  // MT Ponta
  te_ponta: number;
  tusd_ponta: number;
  fio_b_ponta: number;
  // MT Fora Ponta
  te_fora_ponta: number;
  tusd_fora_ponta: number;
  fio_b_fora_ponta: number;
  // GD3
  tarifacao_ponta: number;
  tarifacao_fora_ponta: number;
  tarifacao_bt: number;
  // Demanda
  demanda_consumo_rs: number;
  demanda_geracao_rs: number;
  // Meta
  origem: string;
}

/**
 * Extracts the base subgrupo and modalidade from a combined string.
 * e.g. "A4 - Verde" → { subgrupo: "A4", modalidade: "Verde" }
 * e.g. "B1" → { subgrupo: "B1", modalidade: null }
 */
export function parseSubgrupoModalidade(value: string): { subgrupo: string; modalidade: string | null } {
  const match = value.match(/^(A\d+a?|AS|B\d)\s*-?\s*(Verde|Azul)?$/i);
  if (match) {
    return {
      subgrupo: match[1],
      modalidade: match[2] || null,
    };
  }
  return { subgrupo: value, modalidade: null };
}

/**
 * Hook to fetch tarifas from concessionaria_tarifas_subgrupo.
 * Returns a fetch function that can be called imperatively.
 */
export function useFetchTarifaSubgrupo() {
  const fetchTarifa = useCallback(async (
    concessionariaId: string,
    subgrupoRaw: string,
  ): Promise<TarifaSubgrupoResult | null> => {
    if (!concessionariaId || !subgrupoRaw) return null;

    const { subgrupo, modalidade } = parseSubgrupoModalidade(subgrupoRaw);

    // 1. Try concessionaria_tarifas_subgrupo (new table)
    let query = supabase
      .from("concessionaria_tarifas_subgrupo")
      .select("tarifa_energia, tarifa_fio_b, te_ponta, tusd_ponta, fio_b_ponta, te_fora_ponta, tusd_fora_ponta, fio_b_fora_ponta, tarifacao_ponta, tarifacao_fora_ponta, tarifacao_bt, demanda_consumo_rs, demanda_geracao_rs, origem")
      .eq("concessionaria_id", concessionariaId)
      .eq("subgrupo", subgrupo)
      .eq("is_active", true);

    if (modalidade) {
      query = query.eq("modalidade_tarifaria", modalidade);
    }

    const { data, error } = await query.maybeSingle();

    if (!error && data) {
      return data as TarifaSubgrupoResult;
    }

    // 2. Fallback for BT: use concessionarias table
    if (subgrupo.startsWith("B")) {
      const { data: conc } = await supabase
        .from("concessionarias")
        .select("tarifa_energia, tarifa_fio_b")
        .eq("id", concessionariaId)
        .maybeSingle();

      if (conc) {
        return {
          tarifa_energia: conc.tarifa_energia ?? 0,
          tarifa_fio_b: conc.tarifa_fio_b ?? 0,
          te_ponta: 0, tusd_ponta: 0, fio_b_ponta: 0,
          te_fora_ponta: 0, tusd_fora_ponta: 0, fio_b_fora_ponta: 0,
          tarifacao_ponta: 0, tarifacao_fora_ponta: 0, tarifacao_bt: 0,
          demanda_consumo_rs: 0, demanda_geracao_rs: 0,
          origem: "concessionaria_fallback",
        };
      }
    }

    return null;
  }, []);

  return { fetchTarifa };
}

/**
 * Fetches available subgrupos for a specific concessionária from the database.
 * Returns the subgrupos that have tariff data configured.
 */
export async function fetchAvailableSubgrupos(
  concessionariaId: string,
  grupo: "A" | "B",
): Promise<Array<{ value: string; label: string }>> {
  if (!concessionariaId) return [];

  const { data } = await supabase
    .from("concessionaria_tarifas_subgrupo")
    .select("subgrupo, modalidade_tarifaria")
    .eq("concessionaria_id", concessionariaId)
    .eq("is_active", true);

  if (!data || data.length === 0) return [];

  // Filter by grupo
  const filtered = data.filter(d => {
    if (grupo === "B") return d.subgrupo.startsWith("B");
    return d.subgrupo.startsWith("A");
  });

  return filtered.map(d => {
    const label = d.modalidade_tarifaria
      ? `${d.subgrupo} - ${d.modalidade_tarifaria}`
      : d.subgrupo;
    const value = d.modalidade_tarifaria
      ? `${d.subgrupo} - ${d.modalidade_tarifaria}`
      : d.subgrupo;
    return { value, label };
  });
}
