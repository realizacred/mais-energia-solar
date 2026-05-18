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
  draft: ["generated"],
  generated: ["sent", "accepted", "rejected", "draft"],
  sent: ["accepted", "rejected", "expired", "generated"],
  accepted: ["rejected", "generated"],
  rejected: ["draft", "generated"],
  expired: ["generated"],
  excluida: [],
  arquivada: [],
};

/** Check if a transition from → to is valid */
export function canTransition(from: string, to: string): boolean {
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
  return canTransition(status, "excluida");
}

export function canGenerateOsFromStatus(status: string): boolean {
  return status === "accepted";
}
