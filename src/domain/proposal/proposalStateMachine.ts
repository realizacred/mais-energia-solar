/**
 * proposalStateMachine.ts
 * 
 * Real state machine for proposal lifecycle.
 * Mirrors backend VALID_TRANSITIONS (edge function proposal-transition).
 * Used for UI gating (disable buttons, show allowed actions).
 */

export type ProposalStatus =
  | "rascunho"
  | "gerada"
  | "enviada"
  | "vista"
  | "aceita"
  | "recusada"
  | "expirada"
  | "cancelada";

const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  rascunho: ["gerada"],
  gerada: ["enviada", "aceita", "recusada", "cancelada"],
  enviada: ["vista", "aceita", "recusada", "cancelada"],
  vista: ["aceita", "recusada", "cancelada"],
  aceita: ["gerada", "cancelada"],
  recusada: ["gerada", "enviada"],
  expirada: ["gerada"],
  cancelada: [],
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
  return canTransition(status, "aceita");
}

export function canRejectFromMachine(status: string): boolean {
  return canTransition(status, "recusada");
}

export function canCancelFromMachine(status: string): boolean {
  return canTransition(status, "cancelada");
}

export function canGenerateOsFromStatus(status: string): boolean {
  return status === "aceita";
}
