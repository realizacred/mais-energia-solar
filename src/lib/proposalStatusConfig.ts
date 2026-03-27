/**
 * proposalStatusConfig.ts
 * SSOT for proposal status → badge className mapping.
 * Used by StageDealCard, PropostaExpandedDetail, timeline, etc.
 * 
 * RB-01: All colors use CSS semantic variables, never hardcoded.
 */

export const PROPOSAL_STATUS_CONFIG: Record<string, { label: string; className: string; iconCls: string }> = {
  // Rascunho — neutro
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground", iconCls: "text-muted-foreground" },
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground", iconCls: "text-muted-foreground" },

  // Gerada — info
  gerada: { label: "Gerada", className: "bg-info/10 text-info border-info/30", iconCls: "text-info" },
  generated: { label: "Gerada", className: "bg-info/10 text-info border-info/30", iconCls: "text-info" },

  // Enviada — primary
  enviada: { label: "Enviada", className: "bg-primary/10 text-primary border-primary/30", iconCls: "text-primary" },
  sent: { label: "Enviada", className: "bg-primary/10 text-primary border-primary/30", iconCls: "text-primary" },

  // Visualizada — primary intenso
  visualizada: { label: "Visualizada", className: "bg-primary/20 text-primary border-primary/40", iconCls: "text-primary" },
  vista: { label: "Vista", className: "bg-primary/20 text-primary border-primary/40", iconCls: "text-primary" },

  // Aceita / Aprovada — success
  aceita: { label: "Aceita", className: "bg-success/10 text-success border-success/30", iconCls: "text-success" },
  accepted: { label: "Aceita", className: "bg-success/10 text-success border-success/30", iconCls: "text-success" },
  aprovada: { label: "Aprovada", className: "bg-success/10 text-success border-success/30", iconCls: "text-success" },

  // Ganha — success intenso
  ganha: { label: "Ganha", className: "bg-success/20 text-success border-success/40", iconCls: "text-success" },

  // Expirada — warning
  expirada: { label: "Expirada", className: "bg-warning/10 text-warning border-warning/30", iconCls: "text-warning" },
  expired: { label: "Expirada", className: "bg-warning/10 text-warning border-warning/30", iconCls: "text-warning" },

  // Recusada / Rejeitada — destructive suave
  recusada: { label: "Recusada", className: "bg-destructive/10 text-destructive border-destructive/30", iconCls: "text-destructive" },
  rejected: { label: "Recusada", className: "bg-destructive/10 text-destructive border-destructive/30", iconCls: "text-destructive" },
  rejeitada: { label: "Rejeitada", className: "bg-destructive/10 text-destructive border-destructive/30", iconCls: "text-destructive" },

  // Perdida — destructive intenso
  perdida: { label: "Perdida", className: "bg-destructive/20 text-destructive border-destructive/40", iconCls: "text-destructive" },

  // Cancelada — destructive
  cancelada: { label: "Cancelada", className: "bg-destructive/10 text-destructive border-destructive/30", iconCls: "text-destructive" },

  // Arquivada — muted
  arquivada: { label: "Arquivada", className: "bg-muted text-muted-foreground", iconCls: "text-muted-foreground" },
};

const FALLBACK = { label: "—", className: "bg-muted text-muted-foreground border-border", iconCls: "text-muted-foreground" };

export type ProposalStatusKey = keyof typeof PROPOSAL_STATUS_CONFIG;

export function getProposalStatusConfig(status: string | null | undefined) {
  if (!status) return FALLBACK;
  return PROPOSAL_STATUS_CONFIG[status.toLowerCase()] ?? { ...FALLBACK, label: status };
}

/** Label-only lookup for timeline/text contexts */
export function getProposalStatusLabel(status: string): string {
  return getProposalStatusConfig(status).label;
}
