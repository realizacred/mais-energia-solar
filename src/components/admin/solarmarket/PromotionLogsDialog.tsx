/**
 * PromotionLogsDialog — Visualizador de avisos/erros de um job sm-promote.
 *
 * Lê de `solarmarket_promotion_logs` filtrando por job_id + severity.
 * Permite alternar entre todos / só warnings / só errors.
 * Lazy load: 50 linhas por vez via "Ver mais".
 *
 * RB-04 (queries em hook): query inline justificada — escopo restrito ao
 * dialog, sem reuso fora deste componente; mantém staleTime e queryKey.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type LogsFilter = "all" | "warning" | "error";

interface PromotionLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string | null;
  initialFilter?: LogsFilter;
  warningsCount?: number;
  errorsCount?: number;
}

const PAGE_SIZE = 50;

type LogRow = {
  id: string;
  created_at: string;
  severity: string;
  source_entity_type: string | null;
  source_entity_id: string;
  error_code: string | null;
  message: string | null;
  details: unknown;
};

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function PromotionLogsDialog({
  open,
  onOpenChange,
  jobId,
  initialFilter = "all",
  warningsCount = 0,
  errorsCount = 0,
}: PromotionLogsDialogProps) {
  const [filter, setFilter] = useState<LogsFilter>(initialFilter);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Reset limit/filter quando reabre
  const queryKey = ["sm-promotion-logs", jobId, filter, limit] as const;

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    enabled: open && !!jobId,
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (!jobId) return { rows: [] as LogRow[], total: 0 };

      const severities = filter === "all" ? ["warning", "error"] : [filter];

      // Master jobs (sm-migrate-chunk) só agregam contadores; os logs reais
      // ficam vinculados aos sub-jobs do sm-promote, registrados em
      // metadata.sub_jobs[].id. Buscamos a lista e consultamos por todos.
      const { data: masterRow } = await supabase
        .from("solarmarket_promotion_jobs")
        .select("metadata")
        .eq("id", jobId)
        .maybeSingle();

      const subJobIds = Array.isArray(
        (masterRow?.metadata as { sub_jobs?: Array<{ id?: string }> } | null)?.sub_jobs,
      )
        ? ((masterRow!.metadata as { sub_jobs: Array<{ id?: string }> }).sub_jobs
            .map((s) => s?.id)
            .filter((id): id is string => typeof id === "string" && id.length > 0))
        : [];

      const allJobIds = Array.from(new Set<string>([jobId, ...subJobIds]));

      const { data: rows, error, count } = await supabase
        .from("solarmarket_promotion_logs")
        .select(
          "id, created_at, severity, source_entity_type, source_entity_id, error_code, message, details",
          { count: "exact" },
        )
        .in("job_id", allJobIds)
        .in("severity", severities)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { rows: (rows ?? []) as LogRow[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const hasMore = rows.length < total;

  const dashboardUrl = useMemo(() => {
    if (!jobId) return null;
    const sql = `select created_at, severity, source_entity_type, source_entity_id, error_code, message, details from solarmarket_promotion_logs where job_id = '${jobId}' order by created_at desc limit 500`;
    return `https://supabase.com/dashboard/project/bguhckqkpnziykpbwbeu/sql/new?content=${encodeURIComponent(
      sql,
    )}`;
  }, [jobId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          // reset paginação ao fechar
          setLimit(PAGE_SIZE);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="w-[90vw] max-w-4xl max-h-[85dvh] flex flex-col gap-0 p-0">
        <DialogHeader className="p-5 pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2">
            Logs da migração
            {jobId && (
              <Badge variant="outline" className="font-mono text-[10px]">
                job {jobId.slice(0, 8)}…
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Avisos e erros emitidos durante a última execução do <code>sm-promote</code>.
          </DialogDescription>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(v) => {
                if (v) {
                  setFilter(v as LogsFilter);
                  setLimit(PAGE_SIZE);
                }
              }}
              size="sm"
            >
              <ToggleGroupItem value="all" className="text-xs gap-1.5">
                Todos
                <Badge variant="outline" className="font-mono text-[10px] h-4 px-1.5">
                  {warningsCount + errorsCount}
                </Badge>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="warning"
                className="text-xs gap-1.5 data-[state=on]:bg-warning/15 data-[state=on]:text-warning"
              >
                <AlertTriangle className="w-3 h-3" /> Avisos
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] h-4 px-1.5 border-warning/30 text-warning"
                >
                  {warningsCount}
                </Badge>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="error"
                className="text-xs gap-1.5 data-[state=on]:bg-destructive/15 data-[state=on]:text-destructive"
              >
                <AlertCircle className="w-3 h-3" /> Erros
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] h-4 px-1.5 border-destructive/30 text-destructive"
                >
                  {errorsCount}
                </Badge>
              </ToggleGroupItem>
            </ToggleGroup>

            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "Carregando…"
                : `Mostrando ${rows.length.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}`}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 pt-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando logs…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum {filter === "all" ? "aviso ou erro" : filter === "warning" ? "aviso" : "erro"} registrado neste job.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Data</TableHead>
                  <TableHead className="w-[110px]">Severidade</TableHead>
                  <TableHead className="w-[140px]">Entidade</TableHead>
                  <TableHead className="w-[150px]">Código</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isError = r.severity === "error";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDateBR(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 text-[10px] uppercase font-semibold",
                            isError
                              ? "bg-destructive/10 text-destructive border-destructive/30"
                              : "bg-warning/10 text-warning border-warning/30",
                          )}
                        >
                          {isError ? (
                            <AlertCircle className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {r.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground">
                          {r.source_entity_type ?? "—"}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[130px]">
                          {r.source_entity_id}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-foreground">
                        {r.error_code ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        <div className="break-words">{r.message ?? "—"}</div>
                        {r.details ? (
                          <details className="mt-1">
                            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                              detalhes
                            </summary>
                            <pre className="mt-1 p-2 rounded bg-muted text-[10px] font-mono overflow-x-auto max-w-full whitespace-pre-wrap">
                              {JSON.stringify(r.details, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="border-t border-border/40 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            {dashboardUrl && (
              <Button asChild variant="ghost" size="sm">
                <a href={dashboardUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" /> Ver logs completos
                </a>
              </Button>
            )}
          </div>
          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => setLimit((l) => l + PAGE_SIZE)}
            >
              {isFetching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              Ver mais ({Math.min(PAGE_SIZE, total - rows.length)})
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
