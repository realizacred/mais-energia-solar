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

export const isDraft     = (s: string | null | undefined) => normalizeStatus(s) === "draft";
export const isGenerated = (s: string | null | undefined) => normalizeStatus(s) === "generated";
export const isSent      = (s: string | null | undefined) => normalizeStatus(s) === "sent";
export const isViewed    = (s: string | null | undefined) => normalizeStatus(s) === "viewed";
export const isAccepted  = (s: string | null | undefined) => normalizeStatus(s) === "accepted";
export const isRejected  = (s: string | null | undefined) => normalizeStatus(s) === "rejected";
export const isExpired   = (s: string | null | undefined) => normalizeStatus(s) === "expired";
export const isCancelled = (s: string | null | undefined) => normalizeStatus(s) === "cancelled";
