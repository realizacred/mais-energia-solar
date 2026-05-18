/**
 * proposalActionsHelper.ts
 *
 * Centralized logic for determining which actions are available for a proposal
 * based on its current status. Mirrors backend state machine rules.
 */

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
 */
export function getAvailableProposalActions(status: string): AvailableActions {
  const normalization: Record<string, ProposalStatus> = {
    rascunho: "draft",
    gerada: "generated",
    enviada: "sent",
    vista: "viewed",
    aceita: "accepted",
    recusada: "rejected",
    expirada: "expired",
    cancelada: "cancelled",
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

  const canonical = (normalization[status] || status) as ProposalStatus;

  return {
    canGenerate: ["draft", "generated"].includes(canonical),
    canEdit: ["draft", "generated"].includes(canonical),
    canSend: ["draft", "generated"].includes(canonical),
    canView: ["sent", "viewed", "accepted", "rejected"].includes(canonical),
    canAccept: canTransition(canonical, "accepted"),
    canReject: canTransition(canonical, "rejected"),
    canCancel: canTransition(canonical, "cancelled") && canonical !== "accepted" && canonical !== "rejected",
    canRevertAccept: canonical === "accepted",
    canRevertReject: canonical === "rejected",
    canGenerateOs: canonical === "accepted",
  };
}
