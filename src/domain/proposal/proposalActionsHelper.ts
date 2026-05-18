import { ProposalStatus, canTransition } from "./proposalStateMachine";

export type ProposalAction =
  | "generate"
  | "edit"
  | "send"
  | "view"
  | "accept"
  | "reject"
  | "cancel"
  | "revert_accept"
  | "revert_reject"
  | "generate_os";

export interface AvailableActions {
  canGenerate: boolean;
  canEdit: boolean;
  canSend: boolean;
  canView: boolean;
  canAccept: boolean;
  canReject: boolean;
  canCancel: boolean;
  canRevertAccept: boolean;
  canRevertReject: boolean;
  canGenerateOs: boolean;
}

/**
 * Returns a map of available actions based on the canonical status.
 * SSOT: Centralizes UI governance according to backend rules.
 */
export function getAvailableProposalActions(status: string | null | undefined): AvailableActions {
  const normalization: Record<string, ProposalStatus> = {
    rascunho: "draft",
    gerada: "generated",
    enviada: "sent",
    vista: "viewed",
    aceita: "accepted",
    recusada: "rejected",
    expirada: "expired",
    cancelada: "cancelled",
    visualizada: "viewed",
    // EN names
    draft: "draft",
    generated: "generated",
    sent: "sent",
    viewed: "viewed",
    accepted: "accepted",
    rejected: "rejected",
    expired: "expired",
    cancelled: "cancelled",
  };

  const canonical = (normalization[status || "draft"] || status || "draft") as ProposalStatus;

  return {
    // Basic editing/generation: only allowed in initial states
    canGenerate: ["draft", "generated"].includes(canonical),
    canEdit: ["draft", "generated"].includes(canonical),
    
    // Sending: allowed in initial states to move to 'sent'
    canSend: ["draft", "generated"].includes(canonical),
    
    // Viewing/Details: allowed after generation
    canView: ["generated", "sent", "viewed", "accepted", "rejected"].includes(canonical),
    
    // Core state machine transitions (Mirroring proposal-transition Edge Function)
    canAccept: canTransition(canonical, "accepted"),
    canReject: canTransition(canonical, "rejected"),
    
    // Cancellation: can cancel any time EXCEPT when already terminal/accepted
    canCancel: canTransition(canonical, "cancelled") && !["accepted", "rejected", "cancelled"].includes(canonical),
    
    // Reversions: only from their respective terminal states
    canRevertAccept: canonical === "accepted",
    canRevertReject: canonical === "rejected",
    
    // Downstream actions
    canGenerateOs: canonical === "accepted",
  };
}
