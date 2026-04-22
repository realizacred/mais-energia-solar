/**
 * PromocaoSolarmarketSection — Bloco visual da Fase 2 (Promoção Staging → CRM).
 *
 * Componente reutilizável que pode ser embutido tanto na página dedicada
 * (/admin/promocao-solarmarket) quanto dentro de /admin/importacao-solarmarket
 * como uma seção independente da Fase 1.
 *
 * Governança aplicada (AGENTS.md):
 *   - RB-04/RB-05: queries em hook dedicado (useSolarmarketPromote) com staleTime
 *   - RB-06: Skeleton em estados de carregamento
 *   - RB-18: tabela em container com overflow-x-auto
 *   - RB-21: shadow-sm em cards
 *   - DA-39: invalidação via queryClient (sem reload)
 *   - DS-02: KPI cards com border-l semântico
 */
import { useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  useSolarmarketPromote,
  useSolarmarketPromoteLogs,
  useSolarmarketStagingTotals,
  type PromotionJob,
} from "@/hooks/useSolarmarketPromote";
import { useDefaultPipeline, useEnsureDefaultProjectPipeline } from "@/hooks/useDefaultPipeline";
import {
  Rocket, FlaskConical, Ban, Loader2, Eye, ListChecks,
  CheckCircle2, AlertTriangle, XCircle, Users, FolderKanban, FileText,
  Layers, Activity, Info, ArrowRightLeft, ShieldAlert, Star,
  Trash2, RefreshCw,
} from "lucide-react";

const formatBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

function statusBadge(status: string) {
  const map: Record<string, { cls: string; label: string }> = {
    pending:                  { cls: "bg-muted text-muted-foreground border-border",      label: "Em fila" },
    running:                  { cls: "bg-info/10 text-info border-info/20",                label: "Em execução" },
    completed:                { cls: "bg-success/10 text-success border-success/20",       label: "Concluído" },
    completed_with_warnings:  { cls: "bg-warning/10 text-warning border-warning/20",       label: "Com avisos" },
    completed_with_errors:    { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Com erros" },
    failed:                   { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Falhou" },
    cancelled:                { cls: "bg-muted text-muted-foreground border-border",       label: "Cancelado" },
  };
  const m = map[status] ?? { cls: "bg-muted text-muted-foreground border-border", label: status };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function severityBadge(sev: string) {
  const map: Record<string, string> = {
    info:    "bg-info/10 text-info border-info/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    error:   "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <Badge variant="outline" className={map[sev] ?? "bg-muted text-muted-foreground border-border"}>
      {sev}
    </Badge>
  );
}

interface KpiCardProps {
  icon: typeof Rocket;
  label: string;
  value: number;
  tone: "primary" | "success" | "warning" | "destructive";
}

function KpiCard({ icon: Icon, label, value, tone }: KpiCardProps) {
  const tones: Record<KpiCardProps["tone"], { border: string; bg: string; text: string }> = {
    primary:     { border: "border-l-primary",     bg: "bg-primary/10",     text: "text-primary" },
    success:     { border: "border-l-success",     bg: "bg-success/10",     text: "text-success" },
    warning:     { border: "border-l-warning",     bg: "bg-warning/10",     text: "text-warning" },
    destructive: { border: "border-l-destructive", bg: "bg-destructive/10", text: "text-destructive" },
  };
  const t = tones[tone];
  return (
    <Card className={`border-l-[3px] ${t.border} bg-card shadow-sm`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.bg} shrink-0`}>
          <Icon className={`w-5 h-5 ${t.text}`} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
            {value.toLocaleString("pt-BR")}
          </p>
          <p className="text-sm text-muted-foreground mt-1 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PromocaoSolarmarketSection() {
  const { jobs, isLoading, promoteAll, cancelJob, clearFailedJobs, refetchJobs } = useSolarmarketPromote();
  const { data: defaultPipeline, isLoading: isLoadingPipeline } = useDefaultPipeline();
  const ensureDefaultPipeline = useEnsureDefaultProjectPipeline();
  const { data: stagingTotals } = useSolarmarketStagingTotals();
  const [batchLimit, setBatchLimit] = useState(50);
  const [auditJobId, setAuditJobId] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<"cliente" | "projeto" | "proposta" | null>(null);
  const [runAllState, setRunAllState] = useState<{ running: boolean; scope: "cliente" | "projeto" | "proposta" | null; iteration: number; processed: number }>({ running: false, scope: null, iteration: 0, processed: 0 });

  const failedJobsCount = useMemo(
    () => jobs.filter((j) => ["failed", "cancelled", "completed_with_errors"].includes(j.status)).length,
    [jobs],
  );

  const handleClearFailed = async () => {
    try {
      const res = await clearFailedJobs.mutateAsync();
      toast({
        title: "Histórico limpo",
        description: `${res.deleted} job(s) com falha removido(s).`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao limpar", description: message, variant: "destructive" });
    }
  };

  const hasDefaultPipeline = !!defaultPipeline && defaultPipeline.stagesCount > 0;
  const pipelineBlocked = !isLoadingPipeline && !hasDefaultPipeline;

  const totals = useMemo(() => {
    return jobs.reduce(
      (acc, j) => {
        acc.processed  += j.items_processed ?? 0;
        acc.promoted   += j.items_promoted ?? 0;
        acc.blocked    += j.items_blocked ?? 0;
        acc.warnings   += j.items_with_warnings ?? 0;
        acc.errors     += j.items_with_errors ?? 0;
        return acc;
      },
      { processed: 0, promoted: 0, blocked: 0, warnings: 0, errors: 0 },
    );
  }, [jobs]);

  const runningJob = jobs.find((j) => j.status === "running" || j.status === "pending") ?? null;

  const handleRun = async (dry_run: boolean, scope: "cliente" | "projeto" | "proposta" = "proposta") => {
    const limit = Math.min(Math.max(1, Number(batchLimit) || 1), 200);
    setActiveScope(scope);
    try {
      const res = await promoteAll.mutateAsync({ batch_limit: limit, dry_run, scope });
      const scopeLabel = scope === "cliente" ? "clientes" : scope === "projeto" ? "projetos" : "propostas (completo)";
      toast({
        title: dry_run ? "Dry run executado" : `Promoção iniciada — ${scopeLabel}`,
        description: dry_run
          ? `Job ${res.job_id.slice(0, 8)} — ${res.candidates ?? 0} candidatos identificados.`
          : `Job ${res.job_id.slice(0, 8)} concluído (${res.status}).`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao executar", description: message, variant: "destructive" });
    } finally {
      setActiveScope(null);
    }
  };

  const handleCancel = async (job: PromotionJob) => {
    try {
      await cancelJob.mutateAsync({ job_id: job.id, reason: "Cancelado pelo usuário" });
      toast({ title: "Job cancelado" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao cancelar", description: message, variant: "destructive" });
    }
  };

  const handleEnsurePipeline = async () => {
    try {
      const result = await ensureDefaultPipeline.mutateAsync();
      toast({
        title: "Funil preparado",
        description: result.stagesCreated > 0
          ? `Funil "${result.name}" configurado com ${result.stagesCreated} etapa(s).`
          : `Funil "${result.name}" já estava pronto para a promoção.`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao preparar funil", description: message, variant: "destructive" });
    }
  };

  return (
    <section className="space-y-4">
      {/* Header da seção (separação visual da Fase 1) */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <ArrowRightLeft className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
            Promoção para CRM
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
              Fase 2
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Converte dados do staging em clientes, projetos e propostas reais do CRM.
          </p>
        </div>
      </div>

      {/* Banner explicativo do fluxo */}
      <Card className="bg-info/5 border-info/30 shadow-sm">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            <p>
              <strong>1. Importação</strong> (acima) traz dados da SolarMarket para o <em>staging</em>{" "}
              (<code className="bg-muted px-1 rounded text-xs">sm_*_raw</code>).{" "}
              <strong>2. Promoção</strong> (este bloco) cria os registros oficiais no CRM e mantém
              rastreabilidade via <code className="bg-muted px-1 rounded text-xs">external_entity_links</code>.
              Registros já promovidos não são reprocessados.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status do Pipeline Padrão */}
      {isLoadingPipeline ? (
        <Skeleton className="h-16 w-full" />
      ) : pipelineBlocked ? (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/5">
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-semibold text-foreground">
              Funil padrão de projetos não configurado
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {!defaultPipeline
                ? "Nenhum funil de projetos ativo foi encontrado. A promoção foi bloqueada para evitar dados quebrados no CRM."
                : `O funil "${defaultPipeline.name}" não possui etapas em projeto_etapas. Crie ao menos uma etapa antes de promover.`}
              {" "}Você pode criar automaticamente um funil Comercial com as etapas padrão abaixo.
            </p>
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnsurePipeline}
                disabled={ensureDefaultPipeline.isPending || !!runningJob}
                className="gap-2"
              >
                {ensureDefaultPipeline.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderKanban className="w-4 h-4" />
                )}
                Criar funil + etapas
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-success/30 bg-success/5">
          <Star className="w-4 h-4 text-success shrink-0 fill-success" />
          <div className="text-sm flex-1">
            <span className="text-muted-foreground">Pipeline padrão ativo: </span>
            <strong className="text-foreground">{defaultPipeline!.name}</strong>
            <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/20 text-[10px]">
              Padrão · {defaultPipeline!.stagesCount} etapa{defaultPipeline!.stagesCount === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      )}

      {/* KPIs agregados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={Layers}        label="Itens processados" value={totals.processed} tone="primary" />
        <KpiCard icon={CheckCircle2}  label="Promovidos"        value={totals.promoted}  tone="success" />
        <KpiCard icon={ShieldAlert}   label="Bloqueados"        value={totals.blocked}   tone="destructive" />
        <KpiCard icon={AlertTriangle} label="Com avisos"        value={totals.warnings}  tone="warning" />
        <KpiCard icon={XCircle}       label="Com erros"         value={totals.errors}    tone="destructive" />
      </div>

      {totals.blocked > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {totals.blocked.toLocaleString("pt-BR")} item(ns) bloqueado(s) pelo gate de elegibilidade
            </p>
            <p className="text-xs text-muted-foreground">
              Registros com cliente/projeto/proposta incompletos, snapshot vazio ou pipeline não resolvido
              não foram promovidos. Abra o detalhe do job para ver o motivo (error_code).
            </p>
          </div>
        </div>
      )}

      {/* Controles */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Executar promoção
          </CardTitle>
          <CardDescription>
            O motor canônico processa propostas pendentes em staging em lotes. Use{" "}
            <strong>Dry run</strong> para apenas contar candidatos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cards de progresso por etapa: X de Y (acumulado) + lote atual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { key: "cliente",  label: "Clientes",  icon: Users,        scope: "cliente"  as const },
              { key: "projeto",  label: "Projetos",  icon: FolderKanban, scope: "projeto"  as const },
              { key: "proposta", label: "Propostas", icon: FileText,     scope: "proposta" as const },
            ]).map(({ key, label, icon: Icon, scope }) => {
              const t = stagingTotals?.[key as "cliente" | "projeto" | "proposta"];
              const total = t?.total ?? 0;
              const promoted = t?.promoted ?? 0;
              const pending = Math.max(0, total - promoted);
              const pct = total > 0 ? Math.round((promoted / total) * 100) : 0;
              const isActiveScope = activeScope === scope && !!runningJob;
              const batchProcessed = isActiveScope ? (runningJob?.items_processed ?? 0) : 0;
              const batchTotal = isActiveScope ? (runningJob?.total_items ?? 0) : 0;

              return (
                <Card key={key} className="bg-card border-border shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {promoted.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} promovidos
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] font-mono">
                        {pct}%
                      </Badge>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    {isActiveScope && batchTotal > 0 && (
                      <p className="text-[11px] text-info">
                        Lote atual: {batchProcessed} / {batchTotal}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {pending.toLocaleString("pt-BR")} pendente(s) em staging
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="promote_batch_limit" className="text-xs">Batch limit (1–200)</Label>
              <Input
                id="promote_batch_limit"
                type="number"
                min={1}
                max={200}
                value={batchLimit}
                onChange={(e) => setBatchLimit(Number(e.target.value))}
                disabled={!!runningJob || promoteAll.isPending}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Quantidade máxima de itens por execução.
              </p>
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-end gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnsurePipeline}
                disabled={!!runningJob || promoteAll.isPending || ensureDefaultPipeline.isPending}
              >
                {ensureDefaultPipeline.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FolderKanban className="w-4 h-4 mr-2" />
                )}
                Criar funil + etapas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRun(true, "proposta")}
                disabled={!!runningJob || promoteAll.isPending || pipelineBlocked || ensureDefaultPipeline.isPending}
                title={pipelineBlocked ? "Prepare o funil de projetos antes de executar" : "Apenas conta candidatos sem gravar"}
              >
                {promoteAll.isPending && promoteAll.variables?.dry_run ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FlaskConical className="w-4 h-4 mr-2" />
                )}
                Simular
              </Button>
            </div>
          </div>

          {/* Botões sequenciais: Clientes → Projetos → Propostas */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Promover por etapa (sequencial — mais leve)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { scope: "cliente"  as const, label: "1. Promover Clientes",  icon: Users },
                { scope: "projeto"  as const, label: "2. Promover Projetos",  icon: FolderKanban },
                { scope: "proposta" as const, label: "3. Promover Propostas", icon: FileText },
              ]).map(({ scope, label, icon: Icon }) => {
                const isThisRunning = activeScope === scope && promoteAll.isPending;
                return (
                  <Button
                    key={scope}
                    variant={scope === "proposta" ? "default" : "outline"}
                    onClick={() => handleRun(false, scope)}
                     disabled={!!runningJob || promoteAll.isPending || pipelineBlocked || ensureDefaultPipeline.isPending}
                     title={pipelineBlocked ? "Prepare o funil de projetos antes de executar" : undefined}
                    className="justify-start"
                  >
                    {isThisRunning ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4 mr-2" />
                    )}
                    {label}
                  </Button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong>Recomendado:</strong> rode em sequência. Cada etapa só processa o que ainda não foi promovido.
              "Promover Propostas" executa o fluxo completo (cliente + projeto + proposta) para itens pendentes.
            </p>
          </div>

          {runningJob && (
            <div className="space-y-2 p-3 rounded-lg border border-info/30 bg-info/5">
              <div className="flex items-start gap-3">
                <Loader2 className="w-4 h-4 text-info animate-spin shrink-0 mt-0.5" />
                <div className="text-sm flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    Job {runningJob.id.slice(0, 8)} em andamento
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Processando {runningJob.items_processed ?? 0} de {runningJob.total_items ?? 0} itens
                    {" · "}Iniciado em {formatBR(runningJob.started_at ?? runningJob.created_at)}.
                  </p>
                </div>
                <span className="text-xs font-mono text-info shrink-0">
                  {runningJob.total_items
                    ? `${Math.round(((runningJob.items_processed ?? 0) / runningJob.total_items) * 100)}%`
                    : "—"}
                </span>
              </div>
              <Progress
                value={
                  runningJob.total_items
                    ? ((runningJob.items_processed ?? 0) / runningJob.total_items) * 100
                    : 0
                }
                className="h-2"
              />
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-success">✓ {runningJob.items_promoted ?? 0} promovidos</span>
                <span className="text-warning">⚠ {runningJob.items_with_warnings ?? 0} avisos</span>
                <span className="text-destructive">✗ {runningJob.items_with_errors ?? 0} erros</span>
                <span className="text-muted-foreground">⊘ {runningJob.items_blocked ?? 0} bloqueados</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de jobs */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                Histórico de promoções
              </CardTitle>
              <CardDescription>
                {jobs.length} execu{jobs.length === 1 ? "ção" : "ções"} registradas (mais recentes primeiro).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchJobs()}
                disabled={isLoading}
                title="Recarregar histórico"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline ml-1.5">Atualizar</span>
              </Button>
              {failedJobsCount > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      disabled={clearFailedJobs.isPending}
                    >
                      {clearFailedJobs.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline ml-1.5">
                        Limpar com falha ({failedJobsCount})
                      </span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[90vw] max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar jobs com falha?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Serão removidos <strong>{failedJobsCount}</strong> job(s) com status{" "}
                        <em>failed</em>, <em>cancelled</em> ou <em>completed_with_errors</em>,{" "}
                        junto com seus logs de auditoria. Jobs em execução e concluídos com sucesso
                        permanecem intactos. Esta ação não desfaz registros já promovidos no CRM.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearFailed}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Limpar histórico
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Rocket className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Nenhuma promoção executada ainda</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Quando houver propostas em staging, clique em <strong>Promover para CRM</strong>{" "}
                ou faça uma <strong>Simulação (Dry Run)</strong> para ver os candidatos.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Promovidos</TableHead>
                    <TableHead className="text-right">Bloqueados</TableHead>
                    <TableHead className="text-right">Avisos</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead>Iniciado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => {
                    const cancellable = j.status === "pending" || j.status === "running";
                    return (
                      <TableRow key={j.id}>
                        <TableCell className="font-mono text-xs">{j.id.slice(0, 8)}</TableCell>
                        <TableCell>{statusBadge(j.status)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{j.total_items ?? 0}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-success">{j.items_promoted ?? 0}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-destructive">{j.items_blocked ?? 0}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-warning">{j.items_with_warnings ?? 0}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-destructive">{j.items_with_errors ?? 0}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatBR(j.started_at ?? j.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAuditJobId(j.id)}
                              title="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {cancellable && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                    disabled={cancelJob.isPending}
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="w-[90vw] max-w-md">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancelar job de promoção?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O job <code className="bg-muted px-1 rounded text-xs">{j.id.slice(0, 8)}</code> será marcado como cancelado.
                                      Itens já promovidos permanecem no CRM.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleCancel(j)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Cancelar job
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
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

      <AuditDrawer jobId={auditJobId} onClose={() => setAuditJobId(null)} />
    </section>
  );
}

/* ─── Drawer de auditoria por job ───────────────────────────────────────────── */
function AuditDrawer({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const { data: logs, isLoading } = useSolarmarketPromoteLogs(jobId);
  const [tab, setTab] = useState<"errors" | "warnings" | "success" | "all">("errors");

  const list = logs ?? [];

  const counts = useMemo(() => ({
    total: list.length,
    info: list.filter((l) => l.severity === "info").length,
    warning: list.filter((l) => l.severity === "warning").length,
    error: list.filter((l) => l.severity === "error").length,
  }), [list]);

  // Top 3 erros mais comuns (agrupado por error_code ou message)
  const topErrors = useMemo(() => {
    const errs = list.filter((l) => l.severity === "error");
    const map = new Map<string, { key: string; count: number; sample: string }>();
    for (const e of errs) {
      const key = e.error_code || (e.message ?? "Erro desconhecido").slice(0, 80);
      const cur = map.get(key);
      if (cur) cur.count++;
      else map.set(key, { key, count: 1, sample: e.message ?? key });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [list]);

  const filtered = useMemo(() => {
    if (tab === "all") return list;
    if (tab === "errors") return list.filter((l) => l.severity === "error");
    if (tab === "warnings") return list.filter((l) => l.severity === "warning");
    return list.filter((l) => l.severity === "info");
  }, [list, tab]);

  const entityIcon = (t: string | null) => {
    if (t === "cliente") return <Users className="w-3.5 h-3.5" />;
    if (t === "projeto") return <FolderKanban className="w-3.5 h-3.5" />;
    if (t === "proposta") return <FileText className="w-3.5 h-3.5" />;
    return <Layers className="w-3.5 h-3.5" />;
  };

  return (
    <Sheet open={!!jobId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[90vw] sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" />
            Auditoria do job
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {jobId}
          </SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
              {counts.total} eventos
            </Badge>
            <Badge variant="outline" className="bg-info/10 text-info border-info/20">
              {counts.info} info
            </Badge>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
              {counts.warning} avisos
            </Badge>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
              {counts.error} erros
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {/* Top 3 erros mais comuns */}
          {topErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Top {topErrors.length} erro{topErrors.length === 1 ? "" : "s"} mais frequente{topErrors.length === 1 ? "" : "s"}
              </div>
              <ol className="space-y-1.5">
                {topErrors.map((e, i) => (
                  <li key={e.key} className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 shrink-0 font-mono">
                      {e.count}×
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <code className="text-destructive font-mono text-[11px]">{e.key}</code>
                      {e.sample !== e.key && (
                        <p className="text-muted-foreground mt-0.5 break-words">{e.sample}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Filtros por severidade */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="errors" className="text-xs">
                <XCircle className="w-3.5 h-3.5 mr-1 text-destructive" />
                Erros ({counts.error})
              </TabsTrigger>
              <TabsTrigger value="warnings" className="text-xs">
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-warning" />
                Avisos ({counts.warning})
              </TabsTrigger>
              <TabsTrigger value="success" className="text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-success" />
                Sucessos ({counts.info})
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs">
                Todos ({counts.total})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4 space-y-2">
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <ListChecks className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {list.length === 0 ? "Sem eventos para este job" : "Nenhum evento neste filtro"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {list.length === 0
                      ? "Os logs aparecem conforme o job processa cada item."
                      : "Tente outro filtro acima."}
                  </p>
                </div>
              ) : (
                filtered.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg border border-border bg-background p-3 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {severityBadge(l.severity)}
                        <code className="text-xs text-muted-foreground truncate">{l.step}</code>
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                          {l.status}
                        </Badge>
                        {l.raw_status && l.raw_status !== l.status && (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            {l.raw_status}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 font-mono">
                        {formatBR(l.created_at)}
                      </span>
                    </div>
                    {l.message && (
                      <p className="text-sm text-foreground break-words">{l.message}</p>
                    )}
                    {(l.source_entity_type || l.canonical_entity_id || l.error_code) && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
                        {l.source_entity_type && (
                          <span className="inline-flex items-center gap-1">
                            {entityIcon(l.source_entity_type)}
                            SM: <code className="font-mono">{l.source_entity_id ?? "—"}</code>
                          </span>
                        )}
                        {l.canonical_entity_id && (
                          <span className="inline-flex items-center gap-1">
                            → CRM: <code className="font-mono">{l.canonical_entity_id.slice(0, 8)}</code>
                          </span>
                        )}
                        {l.error_code && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                            {l.error_code}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
