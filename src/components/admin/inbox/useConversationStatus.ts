import type { WaConversation } from "@/hooks/useWaInbox";

export type ConversationDerivedStatus = "ativo" | "aguardando" | "sla_estourado" | "ia_ativa" | "resolvida" | null;

interface StatusConfig {
  label: string;
  dotClass: string;
  badgeClass: string;
}

export const DERIVED_STATUS_CONFIG: Record<NonNullable<ConversationDerivedStatus>, StatusConfig> = {
  ativo: {
    label: "Ativo",
    dotClass: "bg-success",
    badgeClass: "bg-success/15 text-success border-success/30",
  },
  aguardando: {
    label: "Aguardando",
    dotClass: "bg-warning",
    badgeClass: "bg-warning/15 text-warning border-warning/30",
  },
  sla_estourado: {
    label: "SLA",
    dotClass: "bg-destructive",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
  },
  ia_ativa: {
    label: "IA",
    dotClass: "bg-info",
    badgeClass: "bg-info/15 text-info border-info/30",
  },
  resolvida: {
    label: "Resolvida",
    dotClass: "bg-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

/**
 * Derives a visual status from conversation data already in memory.
 * Zero additional queries. Graceful on NULL fields.
 *
 * Priority (first match wins):
 * 1. Resolvida → status === "resolved"
 * 2. SLA estourado → followupConvIds contains this conv
 * 3. IA Ativa → tag named "IA Ativa" or similar
 * 4. Ativo → last_message_direction = 'in' AND last_message_at < 5 min ago
 * 5. Aguardando → last_message_direction = 'out'
 * 6. null → insufficient data (graceful)
 */
export function deriveConversationStatus(
  conv: WaConversation,
  followupConvIds?: Set<string>,
): ConversationDerivedStatus {
  // 1. Resolved
  if (conv.status === "resolved") return "resolvida";

  // 2. SLA estourado (follow-up pending)
  if (followupConvIds?.has(conv.id)) return "sla_estourado";

  // 3. IA Ativa (check tags)
  if (conv.tags?.some((t) => {
    const name = t.tag?.name?.toLowerCase();
    return name === "ia ativa" || name === "ia_ativa" || name === "ia atendendo";
  })) {
    return "ia_ativa";
  }

  // Need direction to determine ativo/aguardando
  if (!conv.last_message_direction) return null;

  // 4. Ativo: client sent last message within 5 minutes
  if (conv.last_message_direction === "in" && conv.last_message_at) {
    const diffMs = Date.now() - new Date(conv.last_message_at).getTime();
    if (diffMs < 5 * 60 * 1000) return "ativo";
  }

  // 5. Aguardando: we sent last message
  if (conv.last_message_direction === "out") return "aguardando";

  // Client sent but > 5 min ago — still show as awaiting implicitly
  if (conv.last_message_direction === "in") return "ativo";

  return null;
}
