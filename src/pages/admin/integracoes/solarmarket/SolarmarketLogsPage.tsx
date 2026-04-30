/**
 * SolarMarket → Logs (Central de Integrações).
 * Reaproveita tabelas: solarmarket_promotion_jobs, solarmarket_import_jobs,
 *   solarmarket_promotion_logs.
 * Reaproveita componente: PromotionLogsDialog (visualizador detalhado).
 * RB-76 / DA-48 — somente leitura, sem motor novo.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader, StatCard, EmptyState } from "@/components/ui-kit";
import { ScrollText, AlertTriangle, AlertCircle, CheckCircle2, ListChecks, Cloud, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSolarmarketLogsPage } from "@/hooks/integrations/solarmarket/useSolarmarketLogsPage";
import { PromotionLogsDialog } from "@/components/admin/solarmarket/PromotionLogsDialog";

const TZ = "America/Sao_Paulo";
const dtFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const fmt = (d?: string | null) => {
  if (!d) return "—";
  try { return dtFmt.format(new Date(d)).replace(",", ""); } catch { return "—"; }
};

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function SolarmarketLogsPage() {
  const { promotionJobs, importJobs, recentErrors } = useSolarmarketLogsPage();
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  const totals = {
    promotion: promotionJobs.data?.length ?? 0,
    errors: recentErrors.data?.filter((l) => l.severity === "error").length ?? 0,
    warnings: recentErrors.data?.filter((l) => l.severity === "warning").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScrollText}
        title="Logs SolarMarket"
        description="Histórico de jobs de importação, promoção e eventos recentes."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Cloud}
          color="info"
          label="Jobs de promoção (últimos 20)"
          value={totals.promotion}
        />
        <StatCard
          icon={AlertTriangle}
          color={totals.warnings > 0 ? "warning" : "success"}
          label="Avisos recentes"
          value={totals.warnings}
        />
        <StatCard
          icon={AlertCircle}
          color={totals.errors > 0 ? "destructive" : "success"}
          label="Erros recentes"
          value={totals.errors}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4 text-primary" /> Jobs de promoção
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {promotionJobs.isLoading ? (
            <TableSkeleton />
          ) : !promotionJobs.data?.length ? (
            <EmptyState
              icon={Cloud}
              title="Nenhum job de promoção"
              description="Execute uma migração para gerar jobs."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Criado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Etapa atual</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Avisos / Erros</TableHead>
                    <TableHead>Atualizado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotionJobs.data.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(j.created_at)}</TableCell>
                      <TableCell><StatusBadge status={j.status} size="sm" /></TableCell>
                      <TableCell className="text-xs font-mono">{j.current_step ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{j.progress_pct != null ? `${j.progress_pct}%` : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {j.warnings_count ? (
                            <Badge variant="outline" className="border-warning/40 text-warning">
                              <AlertTriangle className="h-3 w-3 mr-1" /> {j.warnings_count}
                            </Badge>
                          ) : null}
                          {j.errors_count ? (
                            <Badge variant="outline" className="border-destructive/40 text-destructive">
                              <AlertCircle className="h-3 w-3 mr-1" /> {j.errors_count}
                            </Badge>
                          ) : null}
                          {!j.warnings_count && !j.errors_count && (
                            <span className="text-muted-foreground text-xs inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-success" /> Limpo
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(j.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setOpenJobId(j.id)}
                          disabled={!j.warnings_count && !j.errors_count}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" /> Jobs de importação
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {importJobs.isLoading ? (
            <TableSkeleton />
          ) : !importJobs.data?.length ? (
            <EmptyState
              icon={ListChecks}
              title="Nenhum job de importação"
              description="Execute uma importação SolarMarket para gerar jobs."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Criado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Etapa atual</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Atualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importJobs.data.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(j.created_at)}</TableCell>
                      <TableCell><StatusBadge status={j.status} size="sm" /></TableCell>
                      <TableCell className="text-xs font-mono">{j.current_step ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{j.progress_pct != null ? `${j.progress_pct}%` : "—"}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(j.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" /> Eventos recentes (avisos e erros)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentErrors.isLoading ? (
            <TableSkeleton />
          ) : !recentErrors.data?.length ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhum evento recente"
              description="Não há avisos ou erros nos últimos jobs."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Job</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentErrors.data.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(l.created_at)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            l.severity === "error" && "border-destructive/40 text-destructive",
                            l.severity === "warning" && "border-warning/40 text-warning",
                          )}
                        >
                          {l.severity ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{l.step ?? "—"}</TableCell>
                      <TableCell className="max-w-md truncate text-sm" title={l.message ?? ""}>
                        {l.message ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => l.job_id && setOpenJobId(l.job_id)}
                          disabled={!l.job_id}
                        >
                          Ver job
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PromotionLogsDialog
        open={!!openJobId}
        onOpenChange={(open) => !open && setOpenJobId(null)}
        jobId={openJobId}
      />
    </div>
  );
}
