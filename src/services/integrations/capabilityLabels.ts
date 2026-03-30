/**
 * Tradução de chaves de capabilities para PT-BR.
 * Usado nos badges de recursos das integrações.
 */
const CAPABILITY_LABELS: Record<string, string> = {
  // Monitoramento
  sync_plants: "Sincronizar usinas",
  sync_metrics: "Sincronizar métricas",
  sync_health: "Saúde dos equipamentos",
  sync_alerts: "Alertas",
  sync_inverters: "Inversores",
  realtime_data: "Dados em tempo real",

  // Fornecedor / Catálogo
  import_kits: "Importar kits",
  realtime_pricing: "Preços em tempo real",
  stock_availability: "Disponibilidade de estoque",
  sync_catalog: "Sincronizar catálogo",

  // CRM
  sync_contacts: "Sincronizar contatos",
  sync_leads: "Sincronizar leads",
  send_messages: "Enviar mensagens",

  // Geral
  webhooks: "Webhooks",
  oauth: "OAuth",
  api_key: "Chave de API",
};

/**
 * Traduz uma chave de capability para PT-BR.
 * Se não houver tradução, formata o snake_case de forma legível.
 */
export function translateCapability(key: string): string {
  if (CAPABILITY_LABELS[key]) return CAPABILITY_LABELS[key];
  // Fallback: snake_case → "Palavra Palavra"
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
