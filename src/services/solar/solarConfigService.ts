import { supabase } from "@/integrations/supabase/client";

export const solarConfigService = {
  async fetchPricingConfig() {
    const { data, error } = await (supabase as any)
      .from("pricing_config")
      .select("id, markup_equipamentos_percent, markup_servicos_percent, margem_minima_percent, comissao_padrao_percent, comissao_gerente_percent, preco_kwp_minimo, preco_kwp_maximo, preco_kwp_sugerido, desconto_maximo_percent, requer_aprovacao_desconto")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  async fetchPremissasTecnicas() {
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

  async fetchPropostaTemplates() {
    const { data, error } = await (supabase as any)
      .from("proposta_templates")
      .select("id, nome, descricao, grupo, categoria, tipo, ativo, ordem, thumbnail_url, template_html, is_default")
      .order("ordem", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async fetchPropostaVariaveisCustom() {
    const { data, error } = await (supabase as any)
      .from("proposta_variaveis_custom")
      .select("id, nome, label, expressao, tipo_resultado, categoria, ordem, ativo, descricao")
      .order("ordem", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
};
