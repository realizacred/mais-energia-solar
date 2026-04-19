/**
 * GroupedSkippedList — Agrupa registros "skipped" por motivo (error_message)
 * para o usuário entender por que cada item foi pulado.
 */
import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Info, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MigrationSkippedItem {
  entity_type: string;
  sm_entity_id: number;
  error_message: string | null;
  native_entity_id?: string | null;
}

interface Props {
  skipped: MigrationSkippedItem[];
  jobId: string;
}

function normalizeReason(msg: string | null): string {
  if (!msg) return "Sem motivo informado";
  return msg
    .replace(/\([^)]*\)/g, "(…)")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b\d{6,}\b/g, "<n>")
    .replace(/"[^"]+"/g, '"…"')
    .trim()
    .slice(0, 160);
}

function toCsv(rows: MigrationSkippedItem[]): string {
  const header = "entity_type,sm_entity_id,reason,native_entity_id";
  const body = rows
    .map((r) => {
      const msg = (r.error_message ?? "").replace(/"/g, '""');
      return `${r.entity_type},${r.sm_entity_id},"${msg}",${r.native_entity_id ?? ""}`;
    })
    .join("\n");
  return header + "\n" + body;
}

export function GroupedSkippedList({ skipped, jobId }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, MigrationSkippedItem[]>();
    for (const e of skipped) {
      const k = normalizeReason(e.error_message);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [skipped]);

  const exportCsv = () => {
    const csv = toCsv(skipped);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration-skipped-${jobId.slice(0, 8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (skipped.length === 0) return null;

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between p-2.5 border-b">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          {skipped.length} pulado(s) em {groups.length} motivo(s)
        </p>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
      </div>

      <ul className="divide-y max-h-80 overflow-y-auto">
        {groups.map((g) => {
          const isOpen = !!open[g.key];
          return (
            <li key={g.key}>
              <button
                onClick={() => setOpen((s) => ({ ...s, [g.key]: !s[g.key] }))}
                className="w-full flex items-start gap-2 p-2 text-left hover:bg-muted/50 transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 text-xs font-mono text-foreground/90 break-all">
                  {g.key}
                </span>
                <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {g.items.length}×
                </span>
              </button>
              {isOpen && (
                <ul className={cn("px-7 pb-2 space-y-0.5 text-[11px] font-mono text-muted-foreground")}>
                  {g.items.slice(0, 50).map((it, i) => (
                    <li key={i} className="truncate">
                      [{it.entity_type}#{it.sm_entity_id}]
                    </li>
                  ))}
                  {g.items.length > 50 && (
                    <li className="text-muted-foreground/70 italic">
                      +{g.items.length - 50} mais (use o CSV para ver todos)
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}