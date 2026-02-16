/**
 * VersionHistory — Displays version history for a dataset with status badges.
 */

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VersionRow } from "./types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/10 text-success border-success/30",
  processing: "bg-warning/10 text-warning border-warning/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
  archived: "bg-muted text-muted-foreground border-border",
  deprecated: "bg-muted text-muted-foreground border-border",
};

interface VersionHistoryProps {
  versions: VersionRow[];
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  if (versions.length === 0) return null;

  return (
    <div className="pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Histórico de Versões ({versions.length})
      </p>
      <ScrollArea className="max-h-32">
        <div className="space-y-1">
          {versions.map(v => (
            <div key={v.id} className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-muted/30">
              <span className="font-mono">{v.version_tag}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{(v.row_count ?? 0).toLocaleString("pt-BR")} pts</span>
                <Badge className={`${STATUS_STYLES[v.status] || STATUS_STYLES.archived} text-[9px] px-1.5 py-0`}>
                  {v.status}
                </Badge>
                {v.metadata?.ready_for_activation && v.status === "processing" && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-success/40 text-success">
                    pronto
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function statusBadgeClass(status: string): string {
  return STATUS_STYLES[status] || STATUS_STYLES.archived;
}
