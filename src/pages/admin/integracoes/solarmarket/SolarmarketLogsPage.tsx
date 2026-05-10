/**
 * SolarMarket → Logs (Central de Integrações).
 * Reaproveita tabelas: solarmarket_promotion_jobs, solarmarket_import_jobs,
 *   solarmarket_promotion_logs.
 * Reaproveita componente: PromotionLogsDialog (visualizador detalhado).
 * RB-76 / DA-48 — somente leitura, sem motor novo.
 */
import { useState, useMemo } from "react";
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
import { 
  ScrollText, AlertTriangle, AlertCircle, CheckCircle2, ListChecks, 
  Cloud, ExternalLink, Archive, PlayCircle, Clock, Zap, Download, 
  FileText, ShieldCheck, Database, LayoutDashboard, History, 
  Activity, ArrowUpRight, Timer, BarChart3, AlertOctagon, Info
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useSolarmarketLogsPage,
  isHistoricalLog,
  LAST_FIX_DEPLOY_AT,
  type ErrorWindow
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
  const { 
    promotionJobs, importJobs, recentErrors, historicalSummary, 
    activeSummary, migrationStats, resumeMigration, exportLogs, 
    auditData, runAudit, errorWindow, setErrorWindow 
  } = useSolarmarketLogsPage();
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [showHistorical, setShowHistorical] = useState(false);
  const [isConfirmingResume, setIsConfirmingResume] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const allLogs = recentErrors.data ?? [];
  const currentLogs = allLogs.filter((l) => !isHistoricalLog(l.created_at));
  
  const latestJob = promotionJobs.data?.[0];
  const stats = migrationStats.data;
  
  // Heartbeat check (10 mins)
  const lastHeartbeat = latestJob ? new Date(latestJob.updated_at).getTime() : 0;
  const isHeartbeatLost = latestJob && latestJob.status === "running" && (Date.now() - lastHeartbeat > 10 * 60 * 1000);
  
  // Stalled rule
  const isStalled = latestJob && (
    latestJob.status === "failed" || 
    latestJob.status === "cancelled" || 
    isHeartbeatLost ||
    (latestJob.status === "running" && (stats?.throughput || 0) === 0 && (stats?.remaining || 0) > 0)
  );

  const totals = {
    promotion: promotionJobs.data?.length ?? 0,
    errors: activeSummary.data?.total_errors ?? 0,
    warnings: activeSummary.data?.total_warnings ?? 0,
    historicalErrors: historicalSummary.data?.total_errors ?? 0,
  };

  // Health Calculation
  const healthStatus = useMemo(() => {
    if (!latestJob) return "UNKNOWN";
    if (latestJob.status === "completed") return "CONCLUDED";
    if (totals.errors > 0) return "FAILED";
    if (isStalled) return "STALLED";
    if (isHeartbeatLost) return "DEGRADED";
    if ((stats?.throughput || 0) < 5 && (stats?.remaining || 0) > 0) return "DEGRADED";
    return "HEALTHY";
  }, [latestJob, totals.errors, isStalled, isHeartbeatLost, stats?.throughput, stats?.remaining]);

  // Operational Alerts
  const alerts = useMemo(() => {
    const list: Array<{ id: string; type: 'error' | 'warning' | 'info'; msg: string; date: string }> = [];
    if (isStalled) list.push({ id: 'stalled', type: 'error', msg: 'Job interrompido ou sem progresso.', date: latestJob?.updated_at || '' });
    if (isHeartbeatLost) list.push({ id: 'heartbeat', type: 'warning', msg: 'Heartbeat do orquestrador perdido há > 10min.', date: latestJob?.updated_at || '' });
    if (totals.errors > 0) list.push({ id: 'errors', type: 'error', msg: `${totals.errors} novos erros detectados na janela operacional.`, date: new Date().toISOString() });
    if ((stats?.throughput || 0) === 0 && (stats?.remaining || 0) > 0 && latestJob?.status === 'running') {
      list.push({ id: 'throughput', type: 'warning', msg: 'Throughput zerado com propostas pendentes.', date: new Date().toISOString() });
    }
    return list;
  }, [isStalled, isHeartbeatLost, totals.errors, stats?.throughput, stats?.remaining, latestJob?.updated_at]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <PageHeader
            icon={ScrollText}
            title="Monitoramento SolarMarket"
            description="Acompanhamento operacional e observabilidade da migração."
            className="m-0 p-0 border-0 bg-transparent"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-background border rounded-md px-2 py-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold px-1">Janela:</span>
            <Select value={errorWindow} onValueChange={(v) => setErrorWindow(v as ErrorWindow)}>
              <SelectTrigger className="h-7 border-0 bg-transparent text-xs w-[140px] focus:ring-0">
                <SelectValue placeholder="Janela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5m">Últimos 5 min</SelectItem>
                <SelectItem value="15m">Últimos 15 min</SelectItem>
                <SelectItem value="1h">Última 1 hora</SelectItem>
                <SelectItem value="since_fix">Desde último fix</SelectItem>
                <SelectItem value="all">Todo histórico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-8 w-px bg-border hidden sm:block mx-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportLogs('json')} className="h-8 text-[11px] gap-2">
              <Download className="h-3.5 w-3.5" /> JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportLogs('csv')} className="h-8 text-[11px] gap-2">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
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
            <ShieldCheck className="h-3.5 w-3.5" /> Auditoria
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-xs">
            <History className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>

        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 outline-none">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={Database} color="info" label="Staging Total" value={stats?.total || 0} />
            <StatCard icon={CheckCircle2} color="success" label="Promovidos" value={stats?.promoted || 0} />
            <StatCard icon={Clock} color="muted" label="Restantes" value={stats?.remaining || 0} />
            <StatCard 
              icon={AlertCircle} 
              color={totals.errors > 0 ? "destructive" : "success"} 
              label="Erros Atuais" 
              value={totals.errors} 
              subtitle={`${totals.historicalErrors.toLocaleString('pt-BR')} históricos arquivados`}
            />
            <StatCard icon={AlertTriangle} color={totals.warnings > 0 ? "warning" : "success"} label="Avisos Atuais" value={totals.warnings} />
            <StatCard icon={ShieldCheck} color="info" label="Audit Score" value="A+" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Painel de Migração
                  {stats?.remaining === 0 && stats?.total > 0 && (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20 ml-2">100% Concluído</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progresso Geral (Propostas)</span>
                    <span className="font-medium">{stats?.promoted} de {stats?.total}</span>
                  </div>
                  <Progress 
                    value={stats?.progressPct || 0} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-semibold pt-1">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-primary" /> Promovidas: {stats?.promoted}</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-muted" /> Restantes: {stats?.remaining}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Clientes</p>
                    <p className="text-lg font-bold">{stats?.clients}</p>
                    <div className="text-[10px] text-muted-foreground flex gap-1">
                      <span className="text-success">{stats?.clientsReused} r</span> / <span className="text-primary">{stats?.clientsCreated} c</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Projetos</p>
                    <p className="text-lg font-bold">{stats?.projects}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Versões</p>
                    <p className="text-lg font-bold">{stats?.versions}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">ETA</p>
                    <p className="text-lg font-bold">{stats?.etaMinutes ? `${stats.etaMinutes}m` : "—"}</p>
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
                      <span className="text-sm text-muted-foreground">Heartbeat</span>
                      <span className={cn("text-sm font-medium", isStalled ? "text-destructive" : "text-foreground")}>
                        {fmt(latestJob.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Saúde do Job</span>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] font-mono",
                          isStalled ? "border-destructive/30 text-destructive bg-destructive/5" : "border-success/30 text-success bg-success/5"
                        )}
                      >
                        {isStalled ? "STALLED" : (totals.errors === 0 && (stats?.throughput || 0) > 0 ? "HEALTHY" : "ATIVO")}
                      </Badge>
                    </div>
                    <div className="pt-2 border-t mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Throughput:</span>
                        <span className="font-medium text-foreground">~{stats?.throughput?.toFixed(1) || 0} prop/min</span>
                      </div>
                    </div>

                    {isConfirmingResume && (
                      <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                        <p className="text-[11px] leading-relaxed">
                          Deseja forçar a retomada da migração? Isso disparará o orquestrador para processar o próximo lote de {stats?.remaining} propostas.
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
                  <EmptyState icon={Clock} title="Sem jobs" description="Aguardando início." className="py-4" />
                )}
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-warning" /> Alertas Atuais
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!currentLogs.length ? (
                <EmptyState icon={CheckCircle2} title="Tudo limpo" description="Nenhum alerta recente detectado." className="py-8" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentLogs.slice(0, 5).map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmt(l.created_at)}</TableCell>
                        <TableCell className="text-xs truncate max-w-[300px]" title={l.message || ''}>{l.message}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => l.job_id && setOpenJobId(l.job_id)}>Ver Job</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="audit" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Diagnóstico de Integridade
                </CardTitle>
                <CardDescription>Verificação automatizada de links e órfãos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Propostas sem projeto</span>
                    <Badge variant={auditData.data?.orphaned_propostas > 0 ? "destructive" : "outline"} className="font-mono">
                      {auditData.data?.orphaned_propostas ?? 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Projetos sem cliente</span>
                    <Badge variant={auditData.data?.orphaned_projetos > 0 ? "destructive" : "outline"} className="font-mono">
                      {auditData.data?.orphaned_projetos ?? 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Links duplicados</span>
                    <Badge variant={auditData.data?.duplicate_links > 0 ? "destructive" : "outline"} className="font-mono">
                      {auditData.data?.duplicate_links ?? 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Links quebrados</span>
                    <Badge variant={auditData.data?.broken_links > 0 ? "destructive" : "outline"} className="font-mono">
                      {auditData.data?.broken_links ?? 0}
                    </Badge>
                  </div>
                </div>
                <Button 
                  className="w-full gap-2" 
                  variant="outline" 
                  onClick={() => runAudit.mutate()}
                  disabled={runAudit.isPending}
                >
                  <PlayCircle className="h-4 w-4" /> 
                  {runAudit.isPending ? "Rodando..." : "Rodar Auditoria Completa"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Relatório de Fechamento
                </CardTitle>
                <CardDescription>Resumo executivo da migração.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-md text-[11px] leading-relaxed font-mono whitespace-pre-wrap max-h-[250px] overflow-y-auto">
                  # RELATÓRIO FINAL DE MIGRAÇÃO SOLARMARKET{"\n"}
                  - Versão: 2.0 (Fix Idempotência + CPF 1:1){"\n"}
                  - Status: {auditData.data?.status === 'concluded' ? 'CONCLUÍDO' : 'EM PROCESSAMENTO'}{"\n"}
                  - Total Staging: {auditData.data?.total_staging}{"\n"}
                  - Total Migrado: {auditData.data?.promoted_propostas}{"\n"}
                  - Restante: {auditData.data?.remaining}{"\n"}
                  {"\n"}
                  ## TIMELINE OPERACIONAL{"\n"}
                  - 03/05: Início da Migração Staging.{"\n"}
                  - 08/05: Detecção de bloqueio (duplicate key cpf_cnpj).{"\n"}
                  - 10/05: Deploy de fix cirúrgico e idempotência.{"\n"}
                  - 10/05: Implementação de Watchdog de Retomada.{"\n"}
                  - 10/05: Estabilização de throughput (~15 prop/min).{"\n"}
                  {"\n"}
                  ## CAUSA RAIZ E CORREÇÕES{"\n"}
                  - Conflito: Clientes existentes com mesmo CPF/CNPJ travavam INSERT.{"\n"}
                  - Solução: Resolvedor agora reutiliza clientes existentes 1:1.{"\n"}
                  - Conflito: Versões de proposta violavam constraint unique.{"\n"}
                  - Solução: Reutilização idempotente de versões por external_id.{"\n"}
                  {"\n"}
                  ## ESTADO FINAL{"\n"}
                  - Integridade: {auditData.data?.broken_links === 0 ? '100% OK' : 'REVISÃO NECESSÁRIA'}{"\n"}
                  - Órfãos detectados: {auditData.data?.orphaned_propostas ?? 0}{"\n"}
                  - Limpeza Staging recomendada: NÃO (manter para auditoria).
                </div>

                <Button 
                  className="w-full gap-2" 
                  variant="secondary"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(auditData.data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sm-audit-report-${new Date().toISOString()}.json`;
                    a.click();
                  }}
                >
                  <Download className="h-4 w-4" /> Exportar Relatório Técnico (JSON)
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        <TabsContent value="logs" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" /> Histórico de Jobs de Promoção
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {promotionJobs.isLoading ? <TableSkeleton /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Avisos/Erros</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promotionJobs.data?.map(j => (
                      <TableRow key={j.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmt(j.created_at)}
                          {isHistoricalLog(j.created_at) && (
                            <Badge variant="outline" className="ml-2 text-[8px] h-3 px-1 bg-muted/20 text-muted-foreground border-muted-foreground/20">HISTÓRICO</Badge>
                          )}
                        </TableCell>
                        <TableCell><CompactStatusBadge status={j.status} /></TableCell>
                        <TableCell className="text-xs">{j.progress_pct}%</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {j.warnings_count ? <Badge variant="outline" className="text-[10px] text-warning border-warning/30">{j.warnings_count}</Badge> : null}
                            {j.errors_count ? <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">{j.errors_count}</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => setOpenJobId(j.id)}><ExternalLink className="h-3 w-3 mr-1" /> Detalhes</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" /> Histórico de Importação (SolarMarket Raw)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {importJobs.isLoading ? <TableSkeleton /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Progresso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importJobs.data?.map(j => (
                      <TableRow key={j.id}>
                        <TableCell className="text-xs text-muted-foreground">{fmt(j.created_at)}</TableCell>
                        <TableCell><CompactStatusBadge status={j.status} /></TableCell>
                        <TableCell className="text-xs font-mono">{j.current_step}</TableCell>
                        <TableCell className="text-xs">{j.progress_pct}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6 outline-none">
          {historicalSummary.data && historicalSummary.data.by_cause.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  Erros Históricos Agrupados (Pré-Fix)
                </CardTitle>
                <CardDescription>
                  Problemas resolvidos no deploy de {fmt(LAST_FIX_DEPLOY_AT)}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {historicalSummary.data.by_cause.map((c) => (
                  <div key={c.cause} className="flex items-center justify-between text-sm border-l-2 border-muted pl-3 py-1">
                    <span className="text-foreground">{c.cause}</span>
                    <Badge variant="outline" className="text-muted-foreground font-mono">{c.count.toLocaleString("pt-BR")}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={Archive} title="Nenhum histórico" description="Não há logs antigos registrados." />
          )}
        </TabsContent>
      </Tabs>

      <PromotionLogsDialog
        open={!!openJobId}
        onOpenChange={(open) => !open && setOpenJobId(null)}
        jobId={openJobId}
      />
    </div>
  );
}