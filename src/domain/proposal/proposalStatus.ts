/**
 * proposalStatus.ts
 *
 * SSOT de normalização de status de proposta.
 * Backend persiste em inglês (draft/generated/sent/viewed/accepted/rejected/expired/cancelled);
 * UI legada (e snapshots migrados) usa labels em português.
 * Use SEMPRE estes helpers — NUNCA compare strings literais como `=== 'accepted'` ou `=== 'aceita'`.
 */

import type { ProposalStatus } from "./proposalStateMachine";

const NORMALIZATION: Record<string, ProposalStatus> = {
  // PT → canônico EN
  rascunho: "draft",
  gerada: "generated",
  enviada: "sent",
  vista: "viewed",
  visualizada: "viewed",
  aceita: "accepted",
  recusada: "rejected",
  expirada: "expired",
  cancelada: "cancelled",
  // EN → canônico EN (identidade)
  draft: "draft",
  generated: "generated",
  sent: "sent",
  viewed: "viewed",
  accepted: "accepted",
  rejected: "rejected",
  expired: "expired",
  cancelled: "cancelled",
  // Estados terminais especiais
  excluida: "excluida",
  arquivada: "arquivada",
};

export function normalizeStatus(status: string | null | undefined): ProposalStatus {
  if (!status) return "draft";
  const lower = String(status).toLowerCase().trim();
  return NORMALIZATION[lower] || (lower as ProposalStatus);
}

// ─── Governance Helpers ─────────────────────────────────────

export interface ProposalLike {
  status: string | null | undefined;
  aceita_at?: string | null;
  accepted_via?: string | null;
}

/**
 * Verifica se a proposta foi FORMALMENTE aceita.
 * Não confia apenas na string do status se os campos de auditoria estiverem vazios.
 */
export function isProposalAccepted(p: ProposalLike | null | undefined): boolean {
  if (!p) return false;
  const status = normalizeStatus(p.status);
  
  // Critério CANÔNICO: Status é accepted E temos data ou via de aceite
  if (status === "accepted" && (p.aceita_at || p.accepted_via)) {
    return true;
  }

  // Se o status for "accepted" mas não tiver data/via, é uma inconsistência
  // mas por retrocompatibilidade com propostas legadas (migradas) podemos permitir 
  // se o status for explicitamente 'accepted' e for de uma origem confiável, 
  // mas o objetivo aqui é GOVERNANÇA.
  
  return false;
}

export const isDraft     = (s: string | null | undefined) => normalizeStatus(s) === "draft";
export const isGenerated = (s: string | null | undefined) => normalizeStatus(s) === "generated";
export const isSent      = (s: string | null | undefined) => normalizeStatus(s) === "sent";
export const isViewed    = (s: string | null | undefined) => normalizeStatus(s) === "viewed";
export const isAccepted  = (s: string | null | undefined) => normalizeStatus(s) === "accepted";
export const isRejected  = (s: string | null | undefined) => normalizeStatus(s) === "rejected";
export const isExpired   = (s: string | null | undefined) => normalizeStatus(s) === "expired";
export const isCancelled = (s: string | null | undefined) => normalizeStatus(s) === "cancelled";
