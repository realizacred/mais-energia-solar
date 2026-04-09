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

/**
 * Variáveis de exemplo para preview no editor de templates de e-mail.
 * SSOT: importar de variablesCatalog.ts; mantidas aqui por backward compat.
 * @deprecated Prefira importar EMAIL_SAMPLE_VARS de @/lib/variablesCatalog
 */
export { EMAIL_SAMPLE_VARS as SAMPLE_TEMPLATE_VARS } from "@/lib/variablesCatalog";

/**
 * Catálogo de variáveis disponíveis para templates de e-mail de proposta.
 * SSOT: importar de variablesCatalog.ts; mantidas aqui por backward compat.
 * @deprecated Prefira importar EMAIL_PROPOSAL_VARIABLES de @/lib/variablesCatalog
 */
export { EMAIL_PROPOSAL_VARIABLES as TEMPLATE_VARIABLES_CATALOG } from "@/lib/variablesCatalog";
