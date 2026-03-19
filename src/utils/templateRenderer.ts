/**
 * templateRenderer.ts — Renderiza templates de mensagem com variáveis dinâmicas.
 * Usado para WhatsApp e Email templates de proposta.
 */

/**
 * Substitui placeholders {{variavel}} pelos valores reais.
 * Placeholders sem valor correspondente permanecem intactos.
 */
export function renderTemplate(
  corpo: string,
  vars: Record<string, string>
): string {
  return corpo.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

/** Variáveis de exemplo para preview no editor de templates */
export const SAMPLE_TEMPLATE_VARS: Record<string, string> = {
  cliente_nome: "João Silva",
  tipo_instalacao: "Telhado Cerâmico",
  potencia_kwp: "8.56",
  numero_modulos: "16",
  modelo_inversor: "Growatt MIN 8000TL-X",
  consumo_mensal: "650",
  geracao_mensal: "1.120",
  valor_total: "42.500,00",
  proposta_link: "https://app.exemplo.com/proposta/abc123",
  economia_mensal: "580,00",
  payback_meses: "48",
  empresa_nome: "Mais Energia Solar",
};

/** Catálogo de variáveis disponíveis para templates de proposta */
export const TEMPLATE_VARIABLES_CATALOG = [
  { key: "cliente_nome", label: "Nome do cliente", origem: "lead.nome" },
  { key: "tipo_instalacao", label: "Tipo de instalação", origem: "snapshot.tipo_telhado" },
  { key: "potencia_kwp", label: "Potência kWp", origem: "proposta_versoes.potencia_kwp" },
  { key: "numero_modulos", label: "Qtd módulos", origem: "snapshot (contagem)" },
  { key: "modelo_inversor", label: "Modelo inversor", origem: "snapshot.itens (inversor)" },
  { key: "consumo_mensal", label: "Consumo mensal kWh", origem: "snapshot.ucs" },
  { key: "geracao_mensal", label: "Geração mensal kWh", origem: "proposta_versoes.geracao_mensal" },
  { key: "valor_total", label: "Valor total (R$)", origem: "proposta_versoes.valor_total" },
  { key: "economia_mensal", label: "Economia mensal (R$)", origem: "proposta_versoes.economia_mensal" },
  { key: "payback_meses", label: "Payback (meses)", origem: "proposta_versoes.payback_meses" },
  { key: "proposta_link", label: "Link da proposta", origem: "gerado no envio" },
  { key: "empresa_nome", label: "Nome da empresa", origem: "tenants.nome" },
] as const;
