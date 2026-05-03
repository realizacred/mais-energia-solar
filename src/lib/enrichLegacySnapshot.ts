/**
 * enrichLegacySnapshot.ts
 *
 * Service para enriquecer snapshots de propostas migradas (SolarMarket)
 * com dados nativos do tenant: premissas, distribuidora, irradiação, geocoding.
 *
 * §16: Queries imperativas em services — não em componentes.
 * Chamado por normalizeLegacySnapshot no ProposalWizard.
 */

import { supabase } from "@/integrations/supabase/client";

export interface LegacyEnrichmentResult {
  premissas: Record<string, any> | null;
  distribuidoraId: string | null;
  distribuidoraNome: string | null;
  tarifaEnergia: number | null;
  irradiacaoEstimada: number | null;
  irradiacaoTenant: number | null;
  lat: number | null;
  lon: number | null;
}

interface EnrichParams {
  existingPremissas: Record<string, any> | null;
  distribuidoraNome: string;
  locIrradiacao: number;
  geracaoMensal: number;
  potenciaKwp: number;
  cidade: string;
  estado: string;
  hasLatitude: boolean;
}

export async function enrichLegacySnapshot(params: EnrichParams): Promise<LegacyEnrichmentResult> {
  const result: LegacyEnrichmentResult = {
    premissas: null,
    distribuidoraId: null,
    distribuidoraNome: null,
    tarifaEnergia: null,
    irradiacaoEstimada: null,
    irradiacaoTenant: null,
    lat: null,
    lon: null,
  };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return result;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const tenantId = profile?.tenant_id;
    if (!tenantId) return result;

    // ── Premissas nativas ──
    const { data: premissasNativas } = await (supabase as any)
      .from("premissas_tecnicas")
      .select("degradacao_anual_percent, reajuste_tarifa_anual_percent, performance_ratio, vida_util_anos, horas_sol_pico, irradiacao_media_kwh_m2, fator_perdas_percent")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (premissasNativas) {
      const ep = params.existingPremissas || {};
      result.premissas = {
        ...ep,
        perda_eficiencia_anual: premissasNativas.degradacao_anual_percent ?? ep.perda_eficiencia_anual ?? 0.5,
        inflacao_energetica: premissasNativas.reajuste_tarifa_anual_percent ?? ep.inflacao_energetica ?? 6,
        performance_ratio: premissasNativas.performance_ratio ?? ep.performance_ratio,
        vida_util: premissasNativas.vida_util_anos ?? ep.vida_util,
        horas_sol_pico: premissasNativas.horas_sol_pico ?? ep.horas_sol_pico,
      };
    }

    // ── Distribuidora vinculada ──
    if (params.distribuidoraNome) {
      const { data: concessionaria } = await supabase
        .from("concessionarias")
        .select("id, nome, tarifa_energia")
        .ilike("nome", `%${params.distribuidoraNome}%`)
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (concessionaria) {
        result.distribuidoraId = concessionaria.id;
        result.distribuidoraNome = concessionaria.nome;
        if (concessionaria.tarifa_energia) {
          result.tarifaEnergia = Number(concessionaria.tarifa_energia);
        }
      }
    }

    // ── Irradiação estimada da geração SM ──
    const pr = Number(result.premissas?.performance_ratio ?? params.existingPremissas?.performance_ratio) || 0.78;
    if (!params.locIrradiacao && params.geracaoMensal > 0 && params.potenciaKwp > 0) {
      const est = params.geracaoMensal / (params.potenciaKwp * pr * 30);
      if (est > 0 && est < 10) {
        result.irradiacaoEstimada = Math.round(est * 100) / 100;
      }
    }
    // Fallback: irradiação média do tenant
    if (!params.locIrradiacao && !result.irradiacaoEstimada && premissasNativas?.irradiacao_media_kwh_m2) {
      result.irradiacaoTenant = Number(premissasNativas.irradiacao_media_kwh_m2);
    }

    // ── Geocoding via Nominatim ──
    if (params.cidade && !params.hasLatitude) {
      try {
        const query = encodeURIComponent(`${params.cidade}, ${params.estado}, Brasil`);
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`,
          { headers: { "User-Agent": "MaisEnergiaSolar/1.0" } }
        );
        const results = await resp.json();
        if (results?.[0]) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          if (!isNaN(lat) && !isNaN(lon)) {
            result.lat = lat;
            result.lon = lon;
          }
        }
      } catch {
        // Geocoding is best-effort
      }
    }
  } catch {
    // Enrichment is best-effort — legacy snapshot still usable without it
  }

  return result;
}
