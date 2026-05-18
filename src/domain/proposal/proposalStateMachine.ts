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
  | "accepted"
  | "rejected"
  | "expired"
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
  const allowed = VALID_TRANSITIONS[from as ProposalStatus];
  return allowed ? allowed.includes(to as ProposalStatus) : false;
}

/** Get all valid next states from current status */
export function getNextStates(status: string): ProposalStatus[] {
  return VALID_TRANSITIONS[status as ProposalStatus] || [];
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
