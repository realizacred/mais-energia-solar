/**
 * proposalStateMachine.ts
 * 
 * Real state machine for proposal lifecycle.
 * Mirrors backend VALID_TRANSITIONS (edge function proposal-transition).
 * Used for UI gating (disable buttons, show allowed actions).
 */

export type ProposalStatus =
  | "draft"
  | "generated"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled"
  | "excluida"
  | "arquivada";

const VALID_TRANSITIONS: Record<string, ProposalStatus[]> = {
  draft: ["generated", "cancelled"],
  generated: ["sent", "accepted", "rejected", "cancelled", "draft"],
  sent: ["viewed", "expired", "cancelled", "generated"], // Restricted: no accepted/rejected
  viewed: ["accepted", "rejected", "expired", "cancelled", "generated"],
  accepted: ["rejected", "cancelled", "generated"],
  rejected: ["draft", "generated"],
  expired: ["generated", "draft"],
  cancelled: ["draft"],
  excluida: [],
  arquivada: [],
};

/** Check if a transition from → to is valid */
export function canTransition(from: string, to: string): boolean {
  const normalization: Record<string, ProposalStatus> = {
    'draft': 'draft',
    'generated': 'generated',
    'sent': 'sent',
    'viewed': 'viewed',
    'accepted': 'accepted',
    'rejected': 'rejected',
    'expired': 'expired',
    'cancelled': 'cancelled'
  };
  const canonicalFrom = normalization[from] || from;
  const canonicalTo = normalization[to] || to;
  
  const allowed = VALID_TRANSITIONS[canonicalFrom as ProposalStatus];
  return allowed ? allowed.includes(canonicalTo as ProposalStatus) : false;
}

/** Get all valid next states from current status */
export function getNextStates(status: string): ProposalStatus[] {
  const normalization: Record<string, ProposalStatus> = {
    'rascunho': 'draft',
    'gerada': 'generated',
    'enviada': 'sent',
    'vista': 'viewed',
    'aceita': 'accepted',
    'recusada': 'rejected',
    'expirada': 'expired',
    'cancelada': 'cancelled'
  };
  const canonical = normalization[status] || status;
  return VALID_TRANSITIONS[canonical as ProposalStatus] || [];
}

/** UI helpers derived from state machine */
export function canAcceptFromMachine(status: string): boolean {
  return canTransition(status, "accepted");
}

export function canRejectFromMachine(status: string): boolean {
  return canTransition(status, "rejected");
}

export function canCancelFromMachine(status: string): boolean {
  return canTransition(status, "cancelled");
}

export function canGenerateOsFromStatus(status: string): boolean {
  return status === "accepted";
}
