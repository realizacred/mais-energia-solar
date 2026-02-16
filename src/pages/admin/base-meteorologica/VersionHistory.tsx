/**
 * VersionHistory — Displays version history with clear status badges.
 */

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Loader2, XCircle, Archive } from "lucide-react";
import type { VersionRow } from "./types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  active: { label: "Ativa", className: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  processing: { label: "Processando", className: "bg-warning/10 text-warning border-warning/30", icon: Loader2 },
  failed: { label: "Falhou", className: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  archived: { label: "Arquivada", className: "bg-muted text-muted-foreground border-border", icon: Archive },
  deprecated: { label: "Descontinuada", className: "bg-muted text-muted-foreground border-border", icon: Archive },
};

interface VersionHistoryProps {
  versions: VersionRow[];
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  if (versions.length === 0) return null;

  return (
    <ScrollArea className="max-h-48">
      <div className="space-y-1.5">
        {versions.map(v => {
          const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG.archived;
          const StatusIcon = cfg.icon;
          return (
            <div key={v.id} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${v.status === "processing" ? "animate-spin" : ""} ${cfg.className.includes("text-success") ? "text-success" : cfg.className.includes("text-warning") ? "text-warning" : cfg.className.includes("text-destructive") ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="font-mono truncate">{v.version_tag}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-muted-foreground">
                  {(v.row_count ?? 0).toLocaleString("pt-BR")} pts
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: ptBR })}
                </span>
                <Badge className={`${cfg.className} text-[9px] px-1.5 py-0`}>
                  {cfg.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export function statusBadgeClass(status: string): string {
  return STATUS_CONFIG[status]?.className || STATUS_CONFIG.archived.className;
}