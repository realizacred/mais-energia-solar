/**
 * Catálogo de features de energia disponíveis para planos de serviço de UCs.
 * SSOT: todas as feature_keys usadas no sistema de plano.
 */

export interface PlanFeatureDef {
  key: string;
  label: string;
  description: string;
  category: "portal" | "automacao" | "relatorio";
}

export const PLAN_FEATURE_CATALOG: PlanFeatureDef[] = [
  // Portal do cliente
  { key: "portal_monitoramento", label: "Monitoramento de Usina", description: "Visualizar status e geração da usina no portal", category: "portal" },
  { key: "portal_medidor", label: "Medidor IoT", description: "Visualizar leituras e status do medidor inteligente", category: "portal" },
  { key: "portal_faturas", label: "Faturas de Energia", description: "Acessar histórico de faturas e PDFs", category: "portal" },
  { key: "portal_comparativo", label: "Comparativo", description: "Comparar geração real vs estimada", category: "portal" },
  { key: "portal_economia", label: "Economia", description: "Visualizar economia acumulada e projeções", category: "portal" },
  { key: "portal_gd", label: "Geração Distribuída (GD)", description: "Visualizar saldo de créditos e rateio GD", category: "portal" },
  { key: "portal_historico", label: "Histórico Detalhado", description: "Acessar histórico de leituras e geração diário", category: "portal" },
  // Automações
  { key: "auto_whatsapp", label: "Notificações WhatsApp", description: "Receber alertas e relatórios via WhatsApp", category: "automacao" },
  { key: "auto_email", label: "Notificações E-mail", description: "Receber alertas e relatórios por e-mail", category: "automacao" },
  { key: "auto_alerta_performance", label: "Alertas de Performance", description: "Alerta automático quando geração cai abaixo do esperado", category: "automacao" },
  { key: "auto_leitura_medidor", label: "Leitura Automática", description: "Sincronização diária automática do medidor IoT", category: "automacao" },
  // Relatórios
  { key: "relatorio_mensal", label: "Relatório Mensal", description: "Relatório PDF mensal automático de performance", category: "relatorio" },
  { key: "relatorio_financeiro", label: "Relatório Financeiro", description: "Análise financeira com ROI e payback", category: "relatorio" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  portal: "Portal do Cliente",
  automacao: "Automações",
  relatorio: "Relatórios",
};

/** Get grouped catalog */
export function getFeaturesByCategory() {
  const groups: Record<string, PlanFeatureDef[]> = {};
  for (const f of PLAN_FEATURE_CATALOG) {
    if (!groups[f.category]) groups[f.category] = [];
    groups[f.category].push(f);
  }
  return groups;
}
