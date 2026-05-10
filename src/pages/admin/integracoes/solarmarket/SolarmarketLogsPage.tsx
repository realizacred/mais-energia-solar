/**
 * SolarMarket → Logs (Central de Integrações).
 * Reaproveita tabelas: solarmarket_promotion_jobs, solarmarket_import_jobs,
 *   solarmarket_promotion_logs.
 * Reaproveita componente: PromotionLogsDialog (visualizador detalhado).
 * RB-76 / DA-48 — somente leitura, sem motor novo.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import { PageHeader, StatCard, EmptyState, StatusBadge } from "@/components/ui-kit";
import { ScrollText, AlertTriangle, AlertCircle, CheckCircle2, ListChecks, Cloud, ExternalLink, Archive, PlayCircle, Clock, Zap, Download, FileText, ShieldCheck, Database, LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { cn } from "@/lib/utils";
import {
  useSolarmarketLogsPage,
  isHistoricalLog,
  LAST_FIX_DEPLOY_AT,
} from "@/hooks/integrations/solarmarket/useSolarmarketLogsPage";
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

function CompactStatusBadge({ status }: { status?: string }) {
  const s = (status || "pending").toLowerCase();
  let variant: "success" | "warning" | "destructive" | "info" | "primary" | "secondary" | "muted" = "muted";
  let label = status || "Pendente";

  if (s === "completed" || s === "success") { variant = "success"; label = "Concluído"; }
  else if (s === "running" || s === "processing") { variant = "primary"; label = "Em execução"; }
  else if (s === "failed" || s === "error") { variant = "destructive"; label = "Falhou"; }
  else if (s === "completed_with_warnings" || s === "warning") { variant = "warning"; label = "Concluído c/ avisos"; }
  else if (s === "pending") { variant = "muted"; label = "Pendente"; }
  else if (s === "cancelled") { variant = "secondary"; label = "Cancelado"; }

  return (
    <StatusBadge variant={variant} dot>
      {label}
    </StatusBadge>
  );
}

export default function SolarmarketLogsPage() {
  const { promotionJobs, importJobs, recentErrors, historicalSummary, migrationStats, resumeMigration, exportLogs } = useSolarmarketLogsPage();
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [showHistorical, setShowHistorical] = useState(false);
  const [isConfirmingResume, setIsConfirmingResume] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const allLogs = recentErrors.data ?? [];
  const currentLogs = allLogs.filter((l) => !isHistoricalLog(l.created_at));
  
  const latestJob = promotionJobs.data?.[0];
  const isStalled = latestJob && (latestJob.status === "failed" || latestJob.status === "cancelled" || (latestJob.status === "running" && new Date().getTime() - new Date(latestJob.updated_at).getTime() > 10 * 60 * 1000));

  const stats = migrationStats.data;
  const totals = {
    promotion: promotionJobs.data?.length ?? 0,
    errors: currentLogs.filter((l) => l.severity === "error").length,
    warnings: currentLogs.filter((l) => l.severity === "warning").length,
    historicalErrors: historicalSummary.data?.total_errors ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          icon={ScrollText}
          title="Monitoramento SolarMarket"
          description="Acompanhamento operacional e auditoria da migração."
          className="m-0 p-0 border-0 bg-transparent"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportLogs('json')} className="h-8 text-[11px] gap-2">
            <Download className="h-3.5 w-3.5" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportLogs('csv')} className="h-8 text-[11px] gap-2">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-background border h-10 p-1">
          <TabsTrigger value="dashboard" className="gap-2 text-xs">
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 text-xs">
            <ScrollText className="h-3.5 w-3.5" /> Logs e Jobs
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" /> Auditoria Final
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 outline-none">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={Database} color="info" label="Staging Total" value={stats?.total || 0} />
            <StatCard icon={CheckCircle2} color="success" label="Promovidos" value={stats?.promoted || 0} />
            <StatCard icon={Clock} color="muted" label="Restantes" value={stats?.remaining || 0} />
            <StatCard icon={AlertCircle} color={totals.errors > 0 ? "destructive" : "success"} label="Erros Atuais" value={totals.errors} />
            <StatCard icon={AlertTriangle} color={totals.warnings > 0 ? "warning" : "success"} label="Avisos Atuais" value={totals.warnings} />
            <StatCard icon={Archive} color="muted" label="Histórico" value={totals.historicalErrors} />
          </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Painel de Migração
              {migrationStats.data?.remaining === 0 && migrationStats.data?.total > 0 && (
                <Badge variant="outline" className="bg-success/10 text-success border-success/20 ml-2">100% Concluído</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progresso Geral (Propostas)</span>
                <span className="font-medium">{migrationStats.data?.promoted} de {migrationStats.data?.total}</span>
              </div>
              <Progress 
                value={migrationStats.data?.total ? (migrationStats.data.promoted * 100 / migrationStats.data.total) : 0} 
                className="h-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-semibold pt-1">
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-primary" /> Promovidas: {migrationStats.data?.promoted}</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-muted" /> Restantes: {migrationStats.data?.remaining}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Clientes</p>
                <p className="text-lg font-bold">{migrationStats.data?.clients}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Projetos</p>
                <p className="text-lg font-bold">{migrationStats.data?.projects}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Erros Atuais</p>
                <p className={cn("text-lg font-bold", totals.errors > 0 ? "text-destructive" : "text-foreground")}>{totals.errors}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Avisos Atuais</p>
                <p className={cn("text-lg font-bold", totals.warnings > 0 ? "text-warning" : "text-foreground")}>{totals.warnings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Status do Job
              </div>
              {isStalled && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-[10px] gap-1 border-primary/30 hover:bg-primary/10"
                  onClick={() => setIsConfirmingResume(true)}
                  disabled={resumeMigration.isPending}
                >
                  <PlayCircle className="h-3 w-3" /> RETOMAR
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {promotionJobs.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : latestJob ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado Atual</span>
                  <CompactStatusBadge status={latestJob.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Último Heartbeat</span>
                  <span className={cn("text-sm font-medium", isStalled ? "text-destructive" : "text-foreground")}>
                    {fmt(latestJob.updated_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Watchdog</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] font-mono",
                      isStalled ? "border-destructive/30 text-destructive" : "border-success/30 text-success"
                    )}
                  >
                    {isStalled ? "STALLED" : "ATIVO"}
                  </Badge>
                </div>
                <div className="pt-2 border-t mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Throughput:</span>
                    <span className="font-medium text-foreground">~{migrationStats.data?.throughput?.toFixed(1) || 0} prop/min</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>ETA:</span>
                    <span className="font-medium text-foreground">
                      {migrationStats.data?.etaMinutes ? `${migrationStats.data.etaMinutes} min` : (migrationStats.data?.remaining === 0 ? "Finalizado" : "Calculando...")}
                    </span>
                  </div>
                </div>

                {isConfirmingResume && (
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                    <p className="text-[11px] leading-relaxed">
                      Deseja forçar a retomada da migração? Isso disparará o orquestrador para processar o próximo lote de {migrationStats.data?.remaining} propostas.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="h-8 flex-1 text-xs"
                        onClick={() => {
                          resumeMigration.mutate();
                          setIsConfirmingResume(false);
                        }}
                      >
                        Confirmar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 flex-1 text-xs"
                        onClick={() => setIsConfirmingResume(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={Clock}
                title="Sem jobs"
                description="Aguardando início."
                className="py-4"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {historicalSummary.data && historicalSummary.data.by_cause.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4 text-muted-foreground" />
              Erros históricos agrupados por causa
              <Badge variant="outline" className="ml-2 text-xs">pré-fix</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Erros gerados antes do último deploy de correção em {fmt(LAST_FIX_DEPLOY_AT)}.
              Não refletem o estado atual da migração.
            </p>
            <div className="space-y-2">
              {historicalSummary.data.by_cause.map((c) => (
                <div key={c.cause} className="flex items-center justify-between text-sm border-l-2 border-muted pl-3 py-1">
                  <span className="text-foreground">{c.cause}</span>
                  <Badge variant="outline" className="text-muted-foreground">{c.count.toLocaleString("pt-BR")}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                      <TableCell><CompactStatusBadge status={j.status} /></TableCell>
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
                      <TableCell><CompactStatusBadge status={j.status} /></TableCell>
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
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Eventos recentes (avisos e erros)
            </span>
            <Button size="sm" variant="outline" onClick={() => setShowHistorical((v) => !v)}>
              {showHistorical ? "Ocultar históricos" : "Mostrar históricos"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentErrors.isLoading ? (
            <TableSkeleton />
          ) : !visibleLogs.length ? (
            <EmptyState
              icon={CheckCircle2}
              title={showHistorical ? "Nenhum evento" : "Nenhum evento atual"}
              description={
                showHistorical
                  ? "Não há avisos ou erros para mostrar."
                  : "Não há avisos ou erros após o último deploy de correção."
              }
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
                  {visibleLogs.map((l) => {
                    const historical = isHistoricalLog(l.created_at);
                    return (
                      <TableRow key={l.id} className={cn(historical && "opacity-60")}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {fmt(l.created_at)}
                            {historical ? (
                              <Badge variant="outline" className="text-[10px] py-0 h-4 border-muted-foreground/40 text-muted-foreground">
                                histórico
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
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
                    );
                  })}
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
