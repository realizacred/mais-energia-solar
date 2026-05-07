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
/**
 * @deprecated Migrado para `tenant_premises` (SSOT). Mantido por compat
 * de assinatura. Lê de `tenant_premises` e mapeia para o shape antigo.
 * Campos sem equivalente em tenant_premises retornam null:
 *   - degradacao_anual_percent
 *   - performance_ratio
 *   - horas_sol_pico
 *   - fator_perdas_percent
 *   - custo_disponibilidade_*, taxas_fixas_mensais
 * Use diretamente `useTenantPremises` / `useSolarPremises` em código novo.
 */
export function usePremissasTecnicas() {
  return useQuery({
    queryKey: ["premissas-tecnicas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tenant_premises")
        .select("id, base_irradiancia, vida_util_sistema, inflacao_energetica")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        irradiacao_media_kwh_m2: data.base_irradiancia ?? null,
        performance_ratio: null,
        degradacao_anual_percent: null,
        vida_util_anos: data.vida_util_sistema ?? null,
        fator_perdas_percent: null,
        horas_sol_pico: null,
        reajuste_tarifa_anual_percent: data.inflacao_energetica ?? null,
        taxa_selic_anual: null,
        ipca_anual: null,
        custo_disponibilidade_mono: null,
        custo_disponibilidade_bi: null,
        custo_disponibilidade_tri: null,
        taxas_fixas_mensais: null,
      };
    },
    staleTime: STALE_CONFIG,
  });
}

export function useRefreshPremissasTecnicas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["premissas-tecnicas"] });
    qc.invalidateQueries({ queryKey: ["tenant-premises"] });
    qc.invalidateQueries({ queryKey: ["solar-premises"] });
  };
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
