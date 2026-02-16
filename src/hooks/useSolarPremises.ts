/**
 * useSolarPremises — "Solar Brain" Read-Only Hook
 *
 * Single Source of Truth for solar calculation constants.
 * Reads EXCLUSIVELY from `tenant_premises`.
 * If data is missing, returns safe hardcoded defaults.
 *
 * This hook is READ-ONLY. For admin editing, use `useTenantPremises`.
 *
 * @architecture Replaces direct reads from `calculadora_config` and
 *   `premissas_tecnicas` in consumer components. Those tables remain
 *   in the DB for backward compat but are NO LONGER the source of truth.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Canonical Shape ────────────────────────────────

export interface SolarPremises {
  // Tarifa & Financeiro
  tarifa: number;                        // R$/kWh
  imposto_energia: number;               // % ICMS
  inflacao_energetica: number;           // % a.a.
  percentual_economia: number;           // % economia estimada

  // Sistema Solar
  perda_eficiencia: number;              // % degradação anual (topologia padrão)
  sobredimensionamento: number;          // % sobredimensionamento
  geracao_mensal_por_kwp: number;        // kWh/kWp/mês (fallback)
  custo_por_kwp: number;                 // R$/kWp médio
  vida_util_sistema: number;             // anos

  // Ambiental
  kg_co2_por_kwh: number;

  // Metadados
  base_irradiancia: string;
  grupo_tarifario: string;
  fase_tensao_rede: string;
  tipo_telhado_padrao: string;
}

// ─── Safe Defaults ──────────────────────────────────

export const SOLAR_DEFAULTS: SolarPremises = {
  tarifa: 0.99,
  imposto_energia: 0,
  inflacao_energetica: 9.5,
  percentual_economia: 90,
  perda_eficiencia: 0.8,
  sobredimensionamento: 20,
  geracao_mensal_por_kwp: 130,
  custo_por_kwp: 5500,
  vida_util_sistema: 25,
  kg_co2_por_kwh: 0.084,
  base_irradiancia: "inpe_2017",
  grupo_tarifario: "BT",
  fase_tensao_rede: "bifasico_127_220",
  tipo_telhado_padrao: "metalico",
};

// ─── Query Key ──────────────────────────────────────

const QUERY_KEY = ["solar-premises"] as const;

// ─── Mapper ─────────────────────────────────────────

function mapRowToSolarPremises(row: Record<string, unknown>): SolarPremises {
  return {
    tarifa: (row.tarifa as number) ?? SOLAR_DEFAULTS.tarifa,
    imposto_energia: (row.imposto_energia as number) ?? SOLAR_DEFAULTS.imposto_energia,
    inflacao_energetica: (row.inflacao_energetica as number) ?? SOLAR_DEFAULTS.inflacao_energetica,
    percentual_economia: (row.percentual_economia as number) ?? SOLAR_DEFAULTS.percentual_economia,
    perda_eficiencia: (row.perda_eficiencia_tradicional as number) ?? SOLAR_DEFAULTS.perda_eficiencia,
    sobredimensionamento: (row.sobredimensionamento_padrao as number) ?? SOLAR_DEFAULTS.sobredimensionamento,
    geracao_mensal_por_kwp: (row.geracao_mensal_por_kwp as number) ?? SOLAR_DEFAULTS.geracao_mensal_por_kwp,
    custo_por_kwp: (row.custo_por_kwp as number) ?? SOLAR_DEFAULTS.custo_por_kwp,
    vida_util_sistema: (row.vida_util_sistema as number) ?? SOLAR_DEFAULTS.vida_util_sistema,
    kg_co2_por_kwh: (row.kg_co2_por_kwh as number) ?? SOLAR_DEFAULTS.kg_co2_por_kwh,
    base_irradiancia: (row.base_irradiancia as string) ?? SOLAR_DEFAULTS.base_irradiancia,
    grupo_tarifario: (row.grupo_tarifario as string) ?? SOLAR_DEFAULTS.grupo_tarifario,
    fase_tensao_rede: (row.fase_tensao_rede as string) ?? SOLAR_DEFAULTS.fase_tensao_rede,
    tipo_telhado_padrao: (row.tipo_telhado_padrao as string) ?? SOLAR_DEFAULTS.tipo_telhado_padrao,
  };
}

// ─── Hook ───────────────────────────────────────────

export function useSolarPremises() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<SolarPremises> => {
      const { data, error } = await supabase
        .from("tenant_premises")
        .select(
          "tarifa, imposto_energia, inflacao_energetica, percentual_economia, " +
          "perda_eficiencia_tradicional, sobredimensionamento_padrao, " +
          "geracao_mensal_por_kwp, custo_por_kwp, vida_util_sistema, kg_co2_por_kwh, " +
          "base_irradiancia, grupo_tarifario, fase_tensao_rede, tipo_telhado_padrao"
        )
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[SolarBrain] Failed to load premises:", error.message);
        return SOLAR_DEFAULTS;
      }

      if (!data) {
        console.warn("[SolarBrain] No tenant_premises row found, using defaults");
        return SOLAR_DEFAULTS;
      }

      return mapRowToSolarPremises(data as unknown as Record<string, unknown>);
    },
    staleTime: 5 * 60 * 1000,  // 5 min — config changes rarely
    gcTime: 30 * 60 * 1000,    // 30 min cache
    retry: 2,
  });
}
