/**
 * proposalState.ts
 * 
 * State machine for proposal lifecycle.
 * Defines explicit states, status config for UI, and transition rules.
 */

import {
  Clock, FileText, Send, CheckCircle2, XCircle, AlertTriangle, Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Business Status ──────────────────────────────────────

export type ProposalBusinessStatus =
  | "rascunho"
  | "gerada"
  | "enviada"
  | "vista"
  | "aceita"
  | "recusada"
  | "expirada"
  | "cancelada";

// ─── UI Status Config ─────────────────────────────────────

export interface StatusConfig {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: LucideIcon;
  color: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  rascunho: { label: "Rascunho", variant: "secondary", icon: Clock, color: "text-muted-foreground" },
  gerada: { label: "Gerada", variant: "default", icon: FileText, color: "text-primary" },
  enviada: { label: "Enviada", variant: "outline", icon: Send, color: "text-info" },
  aceita: { label: "Aceita", variant: "default", icon: CheckCircle2, color: "text-success" },
  vista: { label: "Vista", variant: "outline", icon: Eye, color: "text-warning" },
  recusada: { label: "Recusada", variant: "destructive", icon: XCircle, color: "text-destructive" },
  expirada: { label: "Expirada", variant: "secondary", icon: AlertTriangle, color: "text-muted-foreground" },
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle, color: "text-destructive" },
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] || STATUS_CONFIG.rascunho;
}

// ─── Transition Rules ─────────────────────────────────────

// Re-export state machine helpers for backward compat
export {
  canTransition,
  getNextStates,
  canAcceptFromMachine as canAccept,
  canRejectFromMachine as canReject,
  canGenerateOsFromStatus as canGenerateOs,
  canCancelFromMachine as canCancel,
} from "./proposalStateMachine";

export function isActionableStatus(status: string): boolean {
  return ["enviada", "gerada", "vista", "aceita", "recusada"].includes(status);
}
