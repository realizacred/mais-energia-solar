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
  draft: { label: "Rascunho", variant: "secondary", icon: Clock, color: "text-muted-foreground" },
  
  gerada: { label: "Gerada", variant: "default", icon: FileText, color: "text-primary" },
  generated: { label: "Gerada", variant: "default", icon: FileText, color: "text-primary" },
  
  enviada: { label: "Enviada", variant: "outline", icon: Send, color: "text-info" },
  sent: { label: "Enviada", variant: "outline", icon: Send, color: "text-info" },
  
  aceita: { label: "Aceita", variant: "default", icon: CheckCircle2, color: "text-success" },
  accepted: { label: "Aceita", variant: "default", icon: CheckCircle2, color: "text-success" },
  
  vista: { label: "Vista", variant: "outline", icon: Eye, color: "text-warning" },
  viewed: { label: "Vista", variant: "outline", icon: Eye, color: "text-warning" },
  
  recusada: { label: "Recusada", variant: "destructive", icon: XCircle, color: "text-destructive" },
  rejected: { label: "Recusada", variant: "destructive", icon: XCircle, color: "text-destructive" },
  
  expirada: { label: "Expirada", variant: "secondary", icon: AlertTriangle, color: "text-muted-foreground" },
  expired: { label: "Expirada", variant: "secondary", icon: AlertTriangle, color: "text-muted-foreground" },
  
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle, color: "text-destructive" },
  cancelled: { label: "Cancelada", variant: "destructive", icon: XCircle, color: "text-destructive" },
  
  excluida: { label: "Excluída", variant: "destructive", icon: XCircle, color: "text-destructive" },
  arquivada: { label: "Arquivada", variant: "secondary", icon: Clock, color: "text-muted-foreground" },
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
  const actionable = [
    "enviada", "gerada", "vista", "aceita", "recusada", "cancelada",
    "sent", "generated", "viewed", "accepted", "rejected", "cancelled"

  ];
  return actionable.includes(status);
}
