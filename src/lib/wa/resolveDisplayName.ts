/**
 * Single Source of Truth para resolução de display name de conversas WhatsApp.
 * Precedência: clientes.nome > leads.nome > cliente_nome (se != profile_name da instância) > telefone formatado.
 *
 * Use em qualquer componente/hook que precise renderizar o nome de uma WaConversation.
 */

export interface WaDisplayNameInput {
  cliente_nome_real?: string | null;   // join clientes.nome
  lead_nome?: string | null;            // join leads.nome
  cliente_nome?: string | null;         // wa_conversations.cliente_nome (legacy / pushName)
  instance_profile_name?: string | null;
  cliente_telefone?: string | null;
  remote_jid?: string | null;
  is_group?: boolean | null;
}

function formatPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return raw;
}

export function resolveWaDisplayName(conv: WaDisplayNameInput): string {
  if (conv.cliente_nome_real?.trim()) return conv.cliente_nome_real.trim();
  if (conv.lead_nome?.trim()) return conv.lead_nome.trim();

  const raw = conv.cliente_nome?.trim();
  const profileName = conv.instance_profile_name?.trim().toLowerCase();
  if (raw) {
    if (conv.is_group) return raw;
    if (!profileName || raw.toLowerCase() !== profileName) return raw;
  }

  const phone = conv.cliente_telefone || conv.remote_jid?.split("@")[0] || "";
  return phone ? formatPhoneBR(phone) : "Sem nome";
}
