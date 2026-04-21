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
import { AlertTriangle, Info, XCircle } from "lucide-react";

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
  severity: "error" | "warning" | "info" | null;
  created_at: string;
}

/**
 * Taxonomia de erros/avisos de importação SolarMarket (Fase 1.5).
 * SSOT: usa severity/error_code/error_origin gravados pela edge function.
 * Fallback heurístico para registros legados sem classificação.
 *
 * Regra semântica (AGENTS.md):
 *   - severity=error    → falha real de sistema/api
 *   - severity=warning  → ausência válida de dado filho (ex: projeto sem proposta)
 *   - severity=info     → eventos informativos (skip/yield)
 */
function classifyError(row: Pick<LogRow, "error_message" | "error_code" | "error_origin" | "entity_type" | "severity">): {
  code: string;
  origin: "system" | "source_data" | "mapping" | "schema" | "api" | "unknown";
  severity: "error" | "warning" | "info";
} {
  const severity = row.severity ?? "error";
  if (row.error_code) {
    return {
      code: row.error_code,
      origin: ((row.error_origin as any) ?? "unknown"),
      severity,
    };
  }
  const m = (row.error_message || "").toLowerCase();
  const entity = row.entity_type;
  if (!m) return { code: "UNKNOWN", origin: "unknown", severity };
  // Heurística semântica: 404 em proposta = projeto sem proposta (warning)
  if (entity === "proposta" && (m.includes("http 404") || m.includes("404"))) {
    return { code: "PROJECT_WITHOUT_PROPOSALS", origin: "source_data", severity: "warning" };
  }
  if (m.includes("http 404") || m.includes("404")) return { code: "SOURCE_NOT_FOUND_404", origin: "api", severity };
  if (m.includes("http 401") || m.includes("http 403")) return { code: "AUTH_FAILED", origin: "api", severity };
  if (m.includes("http 429") || m.includes("rate")) return { code: "RATE_LIMITED", origin: "api", severity };
  if (m.includes("http 5")) return { code: "UPSTREAM_5XX", origin: "api", severity };
  if (m.includes("nenhum endpoint funcionou")) return { code: "ENDPOINT_DISCOVERY_FAILED", origin: "api", severity };
  if (m.includes("timeout")) return { code: "TIMEOUT", origin: "system", severity };
  if (m.includes("cliente") && entity === "projeto") return { code: "CLIENT_RESOLUTION_FAILED", origin: "mapping", severity };
  if (m.includes("pipeline") || m.includes("funil")) return { code: "PIPELINE_NOT_FOUND", origin: "mapping", severity };
  if (m.includes("stage") || m.includes("etapa")) return { code: "STAGE_NOT_FOUND", origin: "mapping", severity };
  if (m.includes("duplicate") || m.includes("conflict")) return { code: "DUPLICATE_CONFLICT", origin: "source_data", severity };
  if (m.includes("column") || m.includes("schema")) return { code: "SCHEMA_MISSING_COLUMN", origin: "schema", severity };
  if (m.includes("invalid") || m.includes("null")) return { code: "SOURCE_DATA_INVALID", origin: "source_data", severity };
  if (entity === "proposta") return { code: "PROPOSAL_INSERT_FAILED", origin: "system", severity };
  if (entity === "projeto") return { code: "PROJECT_UPSERT_FAILED", origin: "system", severity };
  if (entity === "cliente") return { code: "CLIENT_RESOLUTION_FAILED", origin: "system", severity };
  return { code: "UNKNOWN", origin: "unknown", severity };
}

const ORIGIN_STYLES: Record<string, string> = {
  api: "bg-warning/10 text-warning border-warning/20",
  source_data: "bg-info/10 text-info border-info/20",
  mapping: "bg-primary/10 text-primary border-primary/20",
  schema: "bg-destructive/10 text-destructive border-destructive/20",
  system: "bg-destructive/10 text-destructive border-destructive/20",
  unknown: "bg-muted text-muted-foreground border-border",
};

const SEVERITY_STYLES: Record<string, string> = {
  error: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  info: "bg-info/10 text-info border-info/20",
};

export function ImportErrorsDialog({ jobId, open, onOpenChange }: ImportErrorsDialogProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["sm-import-error-logs", jobId],
    enabled: !!jobId && open,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_import_logs")
        .select("id, entity_type, external_id, action, error_message, error_code, error_origin, severity, created_at")
        .eq("job_id", jobId)
        .in("severity", ["error", "warning"])
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const enriched = useMemo(
    () => (logs ?? []).map((l) => ({ row: l, ...classifyError(l) })),
    [logs],
  );

  const errorRows = useMemo(() => enriched.filter((e) => e.severity === "error"), [enriched]);
  const warningRows = useMemo(() => enriched.filter((e) => e.severity === "warning"), [enriched]);

  const grouped = useMemo(() => {
    const map = new Map<string, { code: string; origin: string; severity: string; count: number; sample: string; entity: string }>();
    enriched.forEach((e) => {
      const key = `${e.severity}|${e.code}|${e.row.entity_type}`;
      const cur = map.get(key);
      if (cur) {
        cur.count++;
      } else {
        map.set(key, {
          code: e.code,
          origin: e.origin,
          severity: e.severity,
          count: 1,
          sample: e.row.error_message ?? "—",
          entity: e.row.entity_type,
        });
      }
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      // erros primeiro, depois warnings; dentro de cada grupo, maiores qtd primeiro
      .sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
        return b.count - a.count;
      });
  }, [enriched]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Auditoria de erros e avisos da importação
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-destructive" />
              <strong className="text-destructive">{errorRows.length}</strong> erro(s) reais
            </span>
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              <strong className="text-warning">{warningRows.length}</strong> aviso(s) operacionais
            </span>
            <span className="text-xs text-muted-foreground">
              (avisos = ausências válidas no domínio, ex: projeto sem proposta)
            </span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingState message="Carregando registros…" />
        ) : grouped.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum erro ou aviso registrado para este job.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {/* Resumo agrupado */}
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Severidade</TableHead>
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
                      <TableCell>
                        <Badge variant="outline" className={SEVERITY_STYLES[g.severity]}>
                          {g.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{g.code}</TableCell>
                      <TableCell className="text-sm capitalize">{g.entity}</TableCell>
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
                <Info className="w-4 h-4 text-muted-foreground" />
                Detalhe por item
              </h3>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Sev.</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Entidade</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">ID origem</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Mensagem</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">Em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enriched.map((e) => (
                      <TableRow key={e.row.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Badge variant="outline" className={SEVERITY_STYLES[e.severity]}>
                            {e.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm capitalize">{e.row.entity_type}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {e.row.external_id ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">{e.row.error_message ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(e.row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
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
