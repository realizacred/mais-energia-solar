/**
 * resolveWaTemplate.ts — Resolver compartilhado para variáveis em mensagens WhatsApp.
 *
 * Unifica a substituição de variáveis {{var}} (canônico) e {var} (legado)
 * em todos os edge functions que enviam mensagens WA:
 *   - process-whatsapp-automations
 *   - wa-bg-worker (auto-reply)
 *   - send-wa-welcome
 *   - notificar-agendamento-wa
 *   - reaquecimento-analyzer
 *   - process-wa-followups
 *
 * Formato canônico: {{variavel}} (Mustache)
 * Formato legado:   {variavel} (mantido para backward compat)
 */

/**
 * Substitui variáveis {{var}} e {var} em um template de mensagem WA.
 * Suporta ambos os formatos para compatibilidade com templates existentes.
 *
 * @param template - Texto do template com placeholders
 * @param vars - Record de chave → valor (chaves sem chaves, ex: "nome")
 * @returns Texto com variáveis substituídas
 */
export function resolveWaTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    // Canonical {{var}} format
    result = result.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "g"), value);
    // Legacy {var} format (backward compat)
    result = result.replace(new RegExp(`\\{${escapeRegex(key)}\\}`, "g"), value);
  }
  return result;
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builder para variáveis de contexto de lead/cliente.
 * Facilita montagem do Record<string, string> a partir de dados parciais.
 */
export function buildLeadVars(data: {
  nome?: string | null;
  cidade?: string | null;
  estado?: string | null;
  consumo?: number | string | null;
  vendedor?: string | null;
  consultor?: string | null;
  telefone?: string | null;
}): Record<string, string> {
  const vars: Record<string, string> = {};
  if (data.nome) vars.nome = data.nome;
  if (data.cidade) vars.cidade = data.cidade;
  if (data.estado) vars.estado = data.estado;
  if (data.consumo != null) vars.consumo = String(data.consumo);
  if (data.vendedor) vars.vendedor = data.vendedor;
  if (data.consultor) vars.consultor = data.consultor || data.vendedor || "";
  if (data.telefone) vars.telefone = data.telefone;
  return vars;
}
