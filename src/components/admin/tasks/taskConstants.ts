import { AlertTriangle, Clock, Timer, Play, CheckCircle2, XCircle } from "lucide-react";

export const priorityConfig: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  P0: { label: "P0 Urgente", color: "bg-destructive text-destructive-foreground", icon: AlertTriangle },
  P1: { label: "P1 Alto", color: "bg-warning text-warning-foreground", icon: Clock },
  P2: { label: "P2 Normal", color: "bg-info text-info-foreground", icon: Timer },
};

export const statusConfig: Record<string, { label: string; icon: typeof Play }> = {
  open: { label: "Aberta", icon: Clock },
  doing: { label: "Em Andamento", icon: Play },
  done: { label: "Concluída", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", icon: XCircle },
};
