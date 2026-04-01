import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_CONFIG = 1000 * 60 * 15;

// ── Pricing Config ───────────────────────────────────────────
export function usePricingConfig() {
  return useQuery({
    queryKey: ["pricing-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pricing_config")
        .select("id, markup_equipamentos_percent, markup_servicos_percent, margem_minima_percent, comissao_padrao_percent, comissao_gerente_percent, preco_kwp_minimo, preco_kwp_maximo, preco_kwp_sugerido, desconto_maximo_percent, requer_aprovacao_desconto")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: STALE_CONFIG,
  });
}

export function useRefreshPricingConfig() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["pricing-config"] });
}

// ── Premissas Tecnicas ───────────────────────────────────────
export function usePremissasTecnicas() {
  return useQuery({
    queryKey: ["premissas-tecnicas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("premissas_tecnicas")
        .select("id, irradiacao_media_kwh_m2, performance_ratio, degradacao_anual_percent, vida_util_anos, fator_perdas_percent, horas_sol_pico, reajuste_tarifa_anual_percent, taxa_selic_anual, ipca_anual, custo_disponibilidade_mono, custo_disponibilidade_bi, custo_disponibilidade_tri, taxas_fixas_mensais")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: STALE_CONFIG,
  });
}

export function useRefreshPremissasTecnicas() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["premissas-tecnicas"] });
}

// ── Proposta Templates ───────────────────────────────────────
export function usePropostaTemplates() {
  return useQuery({
    queryKey: ["proposta-templates-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposta_templates")
        .select("id, nome, descricao, grupo, categoria, tipo, ativo, ordem, thumbnail_url, template_html")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_CONFIG,
  });
}

export function useRefreshPropostaTemplates() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["proposta-templates-config"] });
}

// ── Variáveis Custom ─────────────────────────────────────────
export function usePropostaVariaveisCustom() {
  return useQuery({
    queryKey: ["proposta-variaveis-custom"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposta_variaveis_custom")
        .select("id, nome, label, expressao, tipo_resultado, categoria, ordem, ativo, descricao")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_CONFIG,
  });
}

export function useRefreshPropostaVariaveis() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["proposta-variaveis-custom"] });
}
