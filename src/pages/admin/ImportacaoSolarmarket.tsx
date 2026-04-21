import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { useSolarmarketImport, type ImportScope } from "@/hooks/useSolarmarketImport";
import { useSolarmarketConfig } from "@/hooks/useSolarmarketConfig";
import { SolarmarketImportedTabs } from "@/components/admin/solarmarket/SolarmarketImportedTabs";
import { ImportErrorsDialog } from "@/components/admin/solarmarket/ImportErrorsDialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Cloud, CheckCircle2, XCircle, Loader2, Download, Settings, AlertTriangle, Ban, Trash2, Eraser,
  Users, FolderKanban, FileText, GitBranch, Sliders, Activity, Database, Sparkles, ShieldCheck, TrendingUp,
} from "lucide-react";

const SCOPE_ITEMS: { k: keyof ImportScope; label: string; description: string; icon: typeof Users }[] = [
  { k: "clientes", label: "Clientes", description: "Cadastros e contatos", icon: Users },
  { k: "projetos", label: "Projetos", description: "Oportunidades e deals", icon: FolderKanban },
  { k: "propostas", label: "Propostas", description: "Orçamentos comerciais", icon: FileText },
  { k: "funis", label: "Funis e Etapas", description: "Pipelines do CRM", icon: GitBranch },
  { k: "custom_fields", label: "Campos Customizados", description: "Atributos extras", icon: Sliders },
];

const formatBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

const STEP_LABELS: Record<string, string> = {
  auth: "Autenticando",
  funis: "Funis e Etapas",
  clientes: "Clientes",
  projetos: "Projetos",
  propostas: "Propostas",
  custom_fields: "Campos Customizados",
  done: "Concluído",
};
const stepLabel = (s: string | null | undefined) =>
  (s && STEP_LABELS[s]) || s || "Iniciando…";

const BATCH_EXPECTED_MS = 125 * 1000;

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

function statusBadge(status: string) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: "bg-muted text-muted-foreground border-border", label: "Pendente" },
    running: { cls: "bg-info/10 text-info border-info/20", label: "Em execução" },
    success: { cls: "bg-success/10 text-success border-success/20", label: "Sucesso" },
    partial: { cls: "bg-warning/10 text-warning border-warning/20", label: "Parcial" },
    error: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Erro" },
    cancelled: { cls: "bg-muted text-muted-foreground border-border", label: "Cancelado" },
  };
  const m = map[status] ?? map.pending;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

/** Barra de progresso premium com shimmer e tokens semânticos. */
function PremiumProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-3 w-full rounded-full bg-muted/60 overflow-hidden ring-1 ring-border">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary to-info shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* shimmer */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--primary-foreground)/0.35), transparent)",
            animation: "sm-shimmer 1.8s linear infinite",
            backgroundSize: "200% 100%",
          }}
        />
      </motion.div>
      <style>{`@keyframes sm-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }`}</style>
    </div>
  );
}

export default function ImportacaoSolarmarket() {
  const { jobs, isLoading, testConnection, importAll, cancelImport, clearHistory, clearStaging } = useSolarmarketImport();
  const { config, isConfigured, isLoading: loadingCfg } = useSolarmarketConfig();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [scope, setScope] = useState<ImportScope>({
    clientes: true,
    projetos: true,
    propostas: true,
    funis: true,
    custom_fields: true,
  });

  const isImporting = jobs.some((j) => j.status === "pending" || j.status === "running");

  const liveCounts = useQuery({
    queryKey: ["sm-imported-counts"],
    staleTime: isImporting ? 0 : 1000 * 30,
    refetchInterval: isImporting ? 3000 : false,
    queryFn: async () => {
      const tables = [
        "sm_clientes_raw", "sm_projetos_raw", "sm_propostas_raw", "sm_funis_raw", "sm_custom_fields_raw",
      ] as const;
      const results = await Promise.all(
        tables.map((t) => (supabase as any).from(t).select("id", { count: "exact", head: true })),
      );
      return {
        clientes: results[0].count ?? 0,
        projetos: results[1].count ?? 0,
        propostas: results[2].count ?? 0,
        funis: results[3].count ?? 0,
        custom_fields: results[4].count ?? 0,
      };
    },
  });

  const runningJob = jobs.find((j) => j.status === "pending" || j.status === "running");
  const isStale = runningJob
    ? Date.now() - new Date(runningJob.updated_at ?? runningJob.started_at ?? runningJob.created_at).getTime() > 10 * 60 * 1000
    : false;

  useEffect(() => {
    if (!runningJob) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [runningJob?.id]);

  const lastHeartbeatMs = runningJob ? new Date(runningJob.updated_at ?? runningJob.started_at ?? runningJob.created_at).getTime() : 0;
  const elapsedSinceHeartbeat = runningJob ? Math.max(0, now - lastHeartbeatMs) : 0;
  const etaText = runningJob
    ? elapsedSinceHeartbeat >= BATCH_EXPECTED_MS
      ? "retomando agora"
      : `próximo lote em ~${formatRemaining(BATCH_EXPECTED_MS - elapsedSinceHeartbeat)}`
    : null;

  const handleTest = async () => {
    setTestResult(null);
    try {
      const res: any = await testConnection.mutateAsync();
      const msg = res?.message || "Autenticado no SolarMarket.";
      setTestResult({ ok: true, message: msg });
      toast({ title: "Conexão OK", description: msg });
    } catch (e: any) {
      const msg = e?.message || "Verifique a configuração.";
      setTestResult({ ok: false, message: msg });
      toast({ title: "Falha na conexão", description: msg, variant: "destructive" });
    }
  };

  const handleImport = async () => {
    try {
      await importAll.mutateAsync(scope);
      toast({ title: "Importação iniciada", description: "Acompanhe o progresso abaixo." });
    } catch (e: any) {
      toast({ title: "Erro ao iniciar", description: e?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const toggle = (k: keyof ImportScope) => setScope((s) => ({ ...s, [k]: !s[k] }));

  const handleCancel = async (jobId?: string) => {
    const id = jobId ?? runningJob?.id;
    if (!id) return;
    if (!confirm("Cancelar a importação em andamento? Isto marcará o job como cancelado.")) return;
    try {
      await cancelImport.mutateAsync(id);
      toast({ title: "Importação cancelada" });
    } catch (e: any) {
      toast({ title: "Erro ao cancelar", description: e?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await clearHistory.mutateAsync();
      const r = res?.removed ?? { jobs: 0, logs: 0 };
      toast({ title: "Histórico limpo", description: `Jobs removidos: ${r.jobs} · Logs removidos: ${r.logs}` });
    } catch (e: any) {
      toast({ title: "Erro ao limpar histórico", description: e?.message, variant: "destructive" });
    }
  };

  type StagingEntity = "clientes" | "projetos" | "propostas" | "funis" | "custom_fields";

  const handleClearStaging = async (entities?: StagingEntity[]) => {
    try {
      const res = await clearStaging.mutateAsync(entities);
      const r = res?.removed ?? {};
      const summary = Object.entries(r).map(([k, v]) => `${k.replace("sm_", "").replace("_raw", "")}: ${v}`).join(" · ");
      const scopeLabel = entities && entities.length === 1 ? ` (${entities[0]})` : "";
      toast({ title: `Staging limpo${scopeLabel}`, description: summary || "Nenhum registro encontrado." });
    } catch (e: any) {
      const msg = e?.message || "Tente novamente.";
      const isRunningBlock = /em execução|em andamento|importação em/i.test(msg);
      toast({
        title: "Falha ao limpar staging",
        description: isRunningBlock
          ? `${msg} Use o botão "Cancelar" no card da importação ativa abaixo, ou aguarde a conclusão.`
          : msg,
        variant: "destructive",
      });
      if (isRunningBlock && runningJob) {
        setTimeout(() => {
          document.getElementById(`sm-job-${runningJob.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  };

  if (isLoading || loadingCfg) return <LoadingState message="Carregando importações..." />;

  const progressPct = runningJob ? Math.round(Number(runningJob.progress_pct ?? 0)) : 0;

  const kpis = runningJob
    ? [
        { label: "Clientes", value: liveCounts.data?.clientes ?? runningJob.total_clientes ?? 0, icon: Users, tone: "primary" as const },
        { label: "Projetos", value: liveCounts.data?.projetos ?? runningJob.total_projetos ?? 0, icon: FolderKanban, tone: "info" as const },
        { label: "Propostas", value: liveCounts.data?.propostas ?? runningJob.total_propostas ?? 0, icon: FileText, tone: "secondary" as const },
        {
          label: "Erros",
          value: runningJob.total_errors ?? 0,
          icon: XCircle,
          tone: ((runningJob.total_errors ?? 0) > 0 ? "destructive" : "muted") as "destructive" | "muted",
        },
      ]
    : [];

  const toneMap = {
    primary: { border: "border-l-primary", bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20" },
    info: { border: "border-l-info", bg: "bg-info/10", text: "text-info", ring: "ring-info/20" },
    secondary: { border: "border-l-secondary", bg: "bg-secondary/10", text: "text-secondary", ring: "ring-secondary/20" },
    destructive: { border: "border-l-destructive", bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/20" },
    muted: { border: "border-l-muted-foreground/30", bg: "bg-muted", text: "text-muted-foreground", ring: "ring-border" },
  } as const;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 max-w-[1400px]">
        {/* ============= HEADER DE PRODUTO ============= */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5"
        >
          <div className="flex items-start gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/40 to-info/30 blur-lg opacity-70" aria-hidden />
              <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-md ring-1 ring-border">
                <Cloud className="w-7 h-7 text-primary-foreground" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Importação SolarMarket
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  Motor de migração
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Migre e audite clientes, projetos, propostas, funis e campos customizados antes da
                promoção definitiva ao CRM. Todos os dados ficam em staging para revisão.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={!isConfigured || testConnection.isPending}>
              {testConnection.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Testar conexão
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/configuracoes/integracoes/solarmarket">
                <Settings className="w-4 h-4" /> Configuração
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={clearStaging.isPending || !!runningJob}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
                  title={runningJob ? "Há uma importação em execução. Cancele antes de limpar o staging." : undefined}
                >
                  {clearStaging.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                  Limpar staging
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[90vw] max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar dados importados (staging)</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso apagará apenas os dados brutos importados do SolarMarket
                    (<code>sm_clientes_raw</code>, <code>sm_projetos_raw</code>, <code>sm_propostas_raw</code>,
                    {" "}<code>sm_funis_raw</code>, <code>sm_custom_fields_raw</code>).
                    <br /><br />
                    <strong>Não afeta</strong> Clientes, Projetos ou Propostas do CRM.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleClearStaging()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Limpar staging
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.div>

        {/* ============= BLOQUEIO SE NÃO CONFIGURADO ============= */}
        {!isConfigured && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-l-[3px] border-l-warning bg-warning/5 shadow-sm">
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Integração SolarMarket não configurada</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {config && !config.is_active
                      ? "Configuração existe mas está desativada. Ative-a para liberar a importação."
                      : "Cadastre URL base e token da API antes de importar."}
                  </p>
                </div>
                <Button asChild>
                  <Link to="/admin/configuracoes/integracoes/solarmarket">
                    <Settings className="w-4 h-4" /> Ir para configuração
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {testResult && (
          <div
            className={cn(
              "flex items-start gap-2 p-3 rounded-lg border text-sm",
              testResult.ok
                ? "bg-success/10 border-success/20 text-success"
                : "bg-destructive/10 border-destructive/20 text-destructive",
            )}
          >
            {testResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p>{testResult.message}</p>
              {config?.base_url && (
                <p className="text-xs opacity-80 mt-0.5">
                  URL: <code className="font-mono">{config.base_url}</code>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ============= HERO CARD DE PROGRESSO (DOMINANTE) ============= */}
        {runningJob && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card
              id={`sm-job-${runningJob.id}`}
              className="relative overflow-hidden border-border/60 shadow-lg scroll-mt-6"
            >
              {/* glow decorativo */}
              <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" aria-hidden />
              <div className="absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-info/15 blur-3xl pointer-events-none" aria-hidden />

              <CardContent className="relative p-6 sm:p-8 space-y-7">
                {/* Topo: título + status + ações */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-xl bg-info/30 blur-md animate-pulse" aria-hidden />
                      <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-info to-primary flex items-center justify-center ring-1 ring-border">
                        <Activity className="w-6 h-6 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold tracking-tight text-foreground">Importação em andamento</h2>
                        <Badge variant="outline" className="bg-info/10 text-info border-info/30 gap-1.5">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-info opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-info" />
                          </span>
                          {stepLabel(runningJob.current_step)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Iniciada em <span className="text-foreground font-medium">{formatBR(runningJob.started_at ?? runningJob.created_at)}</span>
                        {etaText ? <> · <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" />{etaText}</span></> : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel()}
                      disabled={cancelImport.isPending}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
                    >
                      {cancelImport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                      Cancelar importação
                    </Button>
                  </div>
                </div>

                {/* Barra de progresso premium */}
                <div className="space-y-3">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Progresso geral</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Etapa atual: <span className="text-foreground font-medium">{stepLabel(runningJob.current_step)}</span></p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-bold tabular-nums bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
                        {progressPct}
                      </span>
                      <span className="text-lg font-semibold text-muted-foreground ml-0.5">%</span>
                    </div>
                  </div>
                  <PremiumProgressBar value={progressPct} />
                </div>

                {/* Alerta de travamento */}
                {isStale && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4"
                  >
                    <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Sem progresso há mais de 10 minutos</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Se os contadores não estiverem subindo, a importação pode ter travado. Clique em{" "}
                        <strong className="text-foreground">Cancelar importação</strong> para liberar e tentar novamente.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* KPIs integrados */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {kpis.map(({ label, value, icon: Icon, tone }, i) => {
                    const t = toneMap[tone];
                    return (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                        className={cn(
                          "relative overflow-hidden rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4 border-l-[3px]",
                          t.border,
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ring-1", t.bg, t.ring)}>
                            <Icon className={cn("w-5 h-5", t.text)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-2xl font-bold tracking-tight text-foreground leading-none tabular-nums">
                              {value.toLocaleString("pt-BR")}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ============= SEÇÃO: SELEÇÃO DE ESCOPO ============= */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Download className="w-4 h-4 text-muted-foreground" />
                Escopo da importação
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Selecione quais entidades deseja trazer. Os dados ficam em staging para auditoria antes da promoção.
              </p>
            </div>
          </div>

          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SCOPE_ITEMS.map(({ k, label, description, icon: Icon }, i) => {
                  const selected = scope[k];
                  return (
                    <motion.label
                      key={k}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.04 }}
                      className={cn(
                        "group relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                        selected
                          ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                          : "border-border bg-background hover:bg-muted/40 hover:border-border hover:-translate-y-0.5",
                      )}
                    >
                      <div
                        className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          selected ? "bg-primary/15 text-primary ring-1 ring-primary/20" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{label}</span>
                          <Checkbox checked={selected} onCheckedChange={() => toggle(k)} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
                      </div>
                    </motion.label>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  Importação idempotente via <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">external_source</code> + <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">external_id</code>.
                  Throttle de 60 req/min com backoff em 429.
                </p>
                <Button
                  size="lg"
                  onClick={handleImport}
                  disabled={!isConfigured || importAll.isPending || !!runningJob}
                  className="shrink-0 shadow-md"
                >
                  {importAll.isPending || runningJob ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Importar selecionados
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============= SEÇÃO: STAGING / AUDITORIA ============= */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              Dados brutos importados (staging)
            </h2>
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px]">
              Área de auditoria
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Audite os registros antes de promovê-los ao CRM. Nada aqui impacta dados de produção.
          </p>

          {/* Ações de limpeza por entidade (independentes) */}
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Eraser className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Limpar staging por entidade</p>
                  <p className="text-xs text-muted-foreground">
                    Remove apenas os dados brutos da entidade escolhida. Não afeta o CRM.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { k: "clientes", label: "Clientes", Icon: Users },
                  { k: "projetos", label: "Projetos", Icon: FolderKanban },
                  { k: "propostas", label: "Propostas", Icon: FileText },
                  { k: "funis", label: "Funis", Icon: GitBranch },
                  { k: "custom_fields", label: "Campos Custom", Icon: Sliders },
                ] as { k: StagingEntity; label: string; Icon: typeof Users }[]).map(({ k, label, Icon }) => (
                  <AlertDialog key={k}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={clearStaging.isPending || !!runningJob}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
                        title={runningJob ? "Há uma importação em execução." : `Limpar apenas ${label}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[90vw] max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Limpar staging — {label}</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso apagará apenas os registros brutos de <strong>{label}</strong> em staging.
                          As demais entidades permanecem intactas, assim como os dados do CRM.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleClearStaging([k])}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Limpar {label}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ))}
              </div>
            </CardContent>
          </Card>

          <SolarmarketImportedTabs />
        </section>

        {/* ============= SEÇÃO: HISTÓRICO ============= */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            Histórico de importações
          </h2>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {jobs.length} execução{jobs.length === 1 ? "" : "ões"} registrada{jobs.length === 1 ? "" : "s"}
              </CardTitle>
              {jobs.some((j) => j.status !== "running" && j.status !== "pending") && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={clearHistory.isPending}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      {clearHistory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Limpar histórico
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[90vw] max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar histórico de importações</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso apagará apenas o histórico de importações finalizadas
                        (sucesso, parcial, erro, cancelado) e seus logs.
                        <br /><br />
                        Os dados importados em <strong>staging</strong> serão preservados.
                        Jobs em execução não são afetados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearHistory}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Limpar histórico
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Database className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Nenhuma importação executada ainda</p>
                  <p className="text-xs text-muted-foreground mt-1">Selecione o escopo acima e dispare sua primeira importação.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Início</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Status</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Etapa</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Clientes</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Projetos</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Propostas</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Erros</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Fim</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((j) => (
                        <TableRow key={j.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-xs">{formatBR(j.started_at ?? j.created_at)}</TableCell>
                          <TableCell>{statusBadge(j.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{stepLabel(j.current_step)}</TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">{j.total_clientes}</TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">{j.total_projetos}</TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">{j.total_propostas}</TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">
                            {j.total_errors > 0 ? (
                              <span className="text-destructive inline-flex items-center justify-end gap-1">
                                <XCircle className="w-3 h-3" />
                                {j.total_errors}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{formatBR(j.finished_at)}</TableCell>
                          <TableCell className="text-right">
                            {j.status === "running" || j.status === "pending" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(j.id)}
                                disabled={cancelImport.isPending}
                                className="text-destructive hover:bg-destructive/10 h-7 px-2"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Cancelar
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
