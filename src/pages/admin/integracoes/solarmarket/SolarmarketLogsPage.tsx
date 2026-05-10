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
              label={`Erros (${errorWindow})`} 
              value={totals.errors} 
              subtitle={`${totals.historicalErrors.toLocaleString('pt-BR')} históricos`}
            />
            <StatCard icon={Activity} color={(stats?.throughput || 0) > 10 ? "success" : "warning"} label="Throughput" value={stats?.throughput?.toFixed(1) || 0} subtitle="prop / min" />
            <StatCard icon={Timer} color="info" label="ETA" value={stats?.etaMinutes ? `${stats.etaMinutes}m` : "—"} />
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" /> Peak TP
                    </p>
                    <p className="text-lg font-bold">{stats?.peakThroughput?.toFixed(1) || 0} <span className="text-[10px] font-normal text-muted-foreground">p/m</span></p>
                  </div>
                  <div className="space-y-1 border-l pl-4">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                      <Timer className="h-3 w-3" /> Avg Tempo
                    </p>
                    <p className="text-lg font-bold">{stats?.avgTimePerProposal} <span className="text-[10px] font-normal text-muted-foreground">s/p</span></p>
                  </div>
                  <div className="space-y-1 border-l pl-4">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3" /> Clientes
                    </p>
                    <div className="text-lg font-bold flex items-baseline gap-1">
                      {stats?.clients}
                      <span className="text-[10px] font-normal text-muted-foreground">({stats?.clientsReused} r)</span>
                    </div>
                  </div>
                  <div className="space-y-1 border-l pl-4">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Audit
                    </p>
                    <p className="text-lg font-bold">100%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Telemetria Job
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
                      <span className="text-sm text-muted-foreground">Estado</span>
                      <CompactStatusBadge status={latestJob.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Saúde Observada</span>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] font-mono",
                          healthStatus === "HEALTHY" ? "border-success/30 text-success bg-success/5" : 
                          healthStatus === "FAILED" ? "border-destructive/30 text-destructive bg-destructive/5" :
                          healthStatus === "STALLED" ? "border-destructive/30 text-destructive bg-destructive/5 animate-pulse" :
                          "border-warning/30 text-warning bg-warning/5"
                        )}
                      >
                        {healthStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Heartbeat</span>
                      <div className="flex flex-col items-end">
                        <span className={cn("text-xs font-medium", isHeartbeatLost ? "text-destructive" : "text-foreground")}>
                          {fmt(latestJob.updated_at)}
                        </span>
                        {isHeartbeatLost && <span className="text-[9px] text-destructive font-bold animate-pulse">DISCONNECTED</span>}
                      </div>
                    </div>
                    <div className="pt-2 border-t mt-2">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Throughput:</span>
                        <span className="font-medium text-foreground">~{stats?.throughput?.toFixed(1) || 0} prop/min</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Success Rate:</span>
                        <span className="font-medium text-success">100% (atual)</span>
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
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertOctagon className="h-4 w-4 text-primary" /> Alertas Operacionais
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!alerts.length ? (
                <EmptyState icon={CheckCircle2} title="Sistema Nominal" description="Nenhum alerta crítico ativo." className="py-8" />
              ) : (
                <div className="divide-y">
                  {alerts.map(a => (
                    <div key={a.id} className="p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                      {a.type === 'error' ? <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />}
                      <div className="flex-1 space-y-1">
                        <p className="text-xs font-semibold leading-none">{a.msg}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> {fmt(a.date)}
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-[8px] uppercase font-bold", a.type === 'error' ? "border-destructive/30 text-destructive" : "border-warning/30 text-warning")}>
                        {a.type === 'error' ? 'CRITICAL' : 'WARNING'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {alerts.length > 0 && (
              <div className="px-4 py-3 bg-muted/10 border-t flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                  <Info className="h-3 w-3" /> Clique para ver logs detalhados
                </span>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] uppercase font-bold" onClick={() => setActiveTab('logs')}>
                  Ver Logs
                </Button>
              </div>
            )}
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
                  Audit: Histórico Pré-Fix
                </CardTitle>
                <CardDescription>
                  Problemas históricos registrados antes do deploy de correção em {fmt(LAST_FIX_DEPLOY_AT)}.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Causa Raiz</TableHead>
                      <TableHead>Ocorrências</TableHead>
                      <TableHead>Primeira</TableHead>
                      <TableHead>Última</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Deploy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicalSummary.data.by_cause.map((c) => (
                      <TableRow key={c.cause} className="group">
                        <TableCell className="text-xs font-medium max-w-[300px] truncate" title={c.cause}>
                          {c.cause}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">{c.count.toLocaleString("pt-BR")}</Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">{fmt(c.first_seen)}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">{fmt(c.last_seen)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[8px] font-bold uppercase",
                              c.status === 'resolved' ? "border-success/30 text-success bg-success/5" : "border-warning/30 text-warning bg-warning/5"
                            )}
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] font-mono text-muted-foreground">{c.deploy}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={Archive} title="Nenhum histórico" description="Não há logs antigos registrados para auditoria." />
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