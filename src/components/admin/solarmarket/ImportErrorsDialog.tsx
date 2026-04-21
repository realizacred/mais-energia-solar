import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { AlertTriangle, XCircle } from "lucide-react";

interface ImportErrorsDialogProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LogRow {
  id: string;
  entity_type: string;
  external_id: string | null;
  action: string;
  error_message: string | null;
  error_code: string | null;
  error_origin: string | null;
  created_at: string;
}

/**
 * Taxonomia de erros de importação SolarMarket (Fase 1).
 * SSOT: usa error_code/error_origin gravados pela edge function.
 * Fallback heurístico para registros legados sem classificação.
 */
function classifyError(row: Pick<LogRow, "error_message" | "error_code" | "error_origin" | "entity_type">): {
  code: string;
  origin: "system" | "source_data" | "mapping" | "schema" | "api" | "unknown";
} {
  if (row.error_code) {
    return {
      code: row.error_code,
      origin: ((row.error_origin as any) ?? "unknown"),
    };
  }
  const m = (row.error_message || "").toLowerCase();
  const entity = row.entity_type;
  if (!m) return { code: "UNKNOWN", origin: "unknown" };
  if (m.includes("http 404") || m.includes("404")) return { code: "SOURCE_NOT_FOUND_404", origin: "api" };
  if (m.includes("http 401") || m.includes("http 403")) return { code: "AUTH_FAILED", origin: "api" };
  if (m.includes("http 429") || m.includes("rate")) return { code: "RATE_LIMITED", origin: "api" };
  if (m.includes("http 5")) return { code: "UPSTREAM_5XX", origin: "api" };
  if (m.includes("nenhum endpoint funcionou")) return { code: "ENDPOINT_DISCOVERY_FAILED", origin: "api" };
  if (m.includes("timeout")) return { code: "TIMEOUT", origin: "system" };
  if (m.includes("cliente") && entity === "projeto") return { code: "CLIENT_RESOLUTION_FAILED", origin: "mapping" };
  if (m.includes("pipeline") || m.includes("funil")) return { code: "PIPELINE_NOT_FOUND", origin: "mapping" };
  if (m.includes("stage") || m.includes("etapa")) return { code: "STAGE_NOT_FOUND", origin: "mapping" };
  if (m.includes("duplicate") || m.includes("conflict")) return { code: "DUPLICATE_CONFLICT", origin: "source_data" };
  if (m.includes("column") || m.includes("schema")) return { code: "SCHEMA_MISSING_COLUMN", origin: "schema" };
  if (m.includes("invalid") || m.includes("null")) return { code: "SOURCE_DATA_INVALID", origin: "source_data" };
  if (entity === "proposta") return { code: "PROPOSAL_INSERT_FAILED", origin: "system" };
  if (entity === "projeto") return { code: "PROJECT_UPSERT_FAILED", origin: "system" };
  if (entity === "cliente") return { code: "CLIENT_RESOLUTION_FAILED", origin: "system" };
  return { code: "UNKNOWN", origin: "unknown" };
}

const ORIGIN_STYLES: Record<string, string> = {
  api: "bg-warning/10 text-warning border-warning/20",
  source_data: "bg-info/10 text-info border-info/20",
  mapping: "bg-primary/10 text-primary border-primary/20",
  schema: "bg-destructive/10 text-destructive border-destructive/20",
  system: "bg-destructive/10 text-destructive border-destructive/20",
  unknown: "bg-muted text-muted-foreground border-border",
};

export function ImportErrorsDialog({ jobId, open, onOpenChange }: ImportErrorsDialogProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["sm-import-error-logs", jobId],
    enabled: !!jobId && open,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_import_logs")
        .select("id, entity_type, external_id, action, error_message, error_code, error_origin, created_at")
        .eq("job_id", jobId)
        .eq("action", "error")
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { code: string; origin: string; count: number; sample: string; entities: Set<string> }>();
    (logs ?? []).forEach((l) => {
      const { code, origin } = classifyError(l.error_message, l.entity_type);
      const key = `${code}|${l.entity_type}`;
      const cur = map.get(key);
      if (cur) {
        cur.count++;
        cur.entities.add(l.external_id ?? "");
      } else {
        map.set(key, {
          code,
          origin,
          count: 1,
          sample: l.error_message ?? "—",
          entities: new Set([l.external_id ?? ""]),
        });
      }
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [logs]);

  const totalErrors = logs?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Auditoria de erros da importação
          </DialogTitle>
          <DialogDescription>
            {totalErrors} erro(s) registrado(s) neste job, classificados por código e origem.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingState message="Carregando erros…" />
        ) : grouped.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum erro registrado para este job.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {/* Resumo agrupado */}
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Código</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Entidade</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Origem</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Qtd</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Exemplo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.map((g) => (
                    <TableRow key={g.key} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{g.code}</TableCell>
                      <TableCell className="text-sm capitalize">{
                        (logs ?? []).find((l) => classifyError(l.error_message, l.entity_type).code === g.code)?.entity_type ?? "—"
                      }</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ORIGIN_STYLES[g.origin]}>
                          {g.origin}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">{g.count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[280px]">
                        {g.sample}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Lista detalhada */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                Detalhe por item
              </h3>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Entidade</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">ID origem</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Mensagem</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(logs ?? []).map((l) => (
                      <TableRow key={l.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm capitalize">{l.entity_type}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {l.external_id ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">{l.error_message ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
