import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { useSolarmarketImport, type ImportScope } from "@/hooks/useSolarmarketImport";
import { useSolarmarketConfig } from "@/hooks/useSolarmarketConfig";
import { SolarmarketImportedTabs } from "@/components/admin/solarmarket/SolarmarketImportedTabs";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Cloud, CheckCircle2, XCircle, Loader2, Download, Settings, AlertTriangle, Ban, Trash2, Eraser,
} from "lucide-react";

const formatBR = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";

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

const STEP_ORDER = ["funis", "clientes", "projetos", "propostas", "custom_fields"] as const;
const BATCH_EXPECTED_MS = 125 * 1000;

function getRuntimeStep(scope: any, step: typeof STEP_ORDER[number]) {
  return scope?._runtime?.steps?.[step] ?? null;
}

function getEntityCount(job: any, step: typeof STEP_ORDER[number]) {
  switch (step) {
    case "funis":
      return job.total_funis ?? 0;
    case "clientes":
      return job.total_clientes ?? 0;
    case "projetos":
      return job.total_projetos ?? 0;
    case "propostas":
      return job.total_propostas ?? 0;
    case "custom_fields":
      return job.total_custom_fields ?? 0;
  }
}

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

  // Qualquer job em "pending"/"running" é considerado ativo (e cancelável).
  const isImporting = jobs.some((j) => j.status === "pending" || j.status === "running");

  // Contadores reais do staging (única fonte de verdade durante a importação).
  const liveCounts = useQuery({
    queryKey: ["sm-imported-counts"],
    staleTime: isImporting ? 0 : 1000 * 30,
    refetchInterval: isImporting ? 3000 : false,
    queryFn: async () => {
      const tables = [
        "sm_clientes_raw",
        "sm_projetos_raw",
        "sm_propostas_raw",
        "sm_funis_raw",
        "sm_custom_fields_raw",
      ] as const;
      const results = await Promise.all(
        tables.map((t) =>
          (supabase as any).from(t).select("id", { count: "exact", head: true }),
        ),
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

  // Qualquer job em "pending"/"running" é considerado ativo (e cancelável).
  // Se passou de 10 min, marcamos como "stale" para o usuário ver e cancelar.
  const runningJob = jobs.find((j) => j.status === "pending" || j.status === "running");
  const isStale = runningJob
    ? Date.now() - new Date(runningJob.started_at ?? runningJob.created_at).getTime() > 10 * 60 * 1000
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
  const entityCards = runningJob
    ? STEP_ORDER.map((step) => {
        const runtime = getRuntimeStep((runningJob as any).scope, step);
        const enabled = (runningJob as any).scope?.[step] !== false;
        const done = !!runtime?.done;
        const active = runningJob.current_step === step;
        return {
          step,
          label: stepLabel(step),
          enabled,
          done,
          active,
          page: runtime?.page ?? 1,
          count: getEntityCount(runningJob, step),
        };
      })
    : [];

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
      toast({
        title: "Erro ao iniciar",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const toggle = (k: keyof ImportScope) =>
    setScope((s) => ({ ...s, [k]: !s[k] }));

  const handleCancel = async (jobId?: string) => {
    const id = jobId ?? runningJob?.id;
    if (!id) return;
    if (!confirm("Cancelar a importação em andamento? Isto marcará o job como cancelado.")) return;
    try {
      await cancelImport.mutateAsync(id);
      toast({ title: "Importação cancelada" });
    } catch (e: any) {
      toast({
        title: "Erro ao cancelar",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await clearHistory.mutateAsync();
      const r = res?.removed ?? { jobs: 0, logs: 0 };
      toast({
        title: "Histórico limpo",
        description: `Jobs removidos: ${r.jobs} · Logs removidos: ${r.logs}`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao limpar histórico", description: e?.message, variant: "destructive" });
    }
  };

  const handleClearStaging = async () => {
    try {
      const res = await clearStaging.mutateAsync();
      const r = res?.removed ?? {};
      const summary = Object.entries(r)
        .map(([k, v]) => `${k.replace("sm_", "").replace("_raw", "")}: ${v}`)
        .join(" · ");
      toast({
        title: "Dados de staging removidos",
        description: summary || "Nenhum registro encontrado.",
      });
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
      // Auto-scroll até o card do job ativo para o usuário enxergar o botão Cancelar
      if (isRunningBlock && runningJob) {
        setTimeout(() => {
          document.getElementById(`sm-job-${runningJob.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  };

  if (isLoading || loadingCfg) return <LoadingState message="Carregando importações..." />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
              Importação SolarMarket
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Importação one-shot de Clientes, Projetos, Propostas, Funis e Campos Customizados.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Operacionais */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={!isConfigured || testConnection.isPending}
          >
            {testConnection.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Testar conexão
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/configuracoes/integracoes/solarmarket">
              <Settings className="w-4 h-4 mr-2" /> Configuração
            </Link>
          </Button>

          {/* Separador visual */}
          <span className="hidden sm:inline-block h-6 w-px bg-border mx-1" aria-hidden />

          {/* Destrutivo */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={clearStaging.isPending || !!runningJob}
                className="border-destructive text-destructive hover:bg-destructive/10"
                title={runningJob ? "Há uma importação em execução. Cancele antes de limpar o staging." : undefined}
              >
                {clearStaging.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Eraser className="w-4 h-4 mr-2" />
                )}
                Limpar dados importados
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
                  onClick={handleClearStaging}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Limpar staging
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Bloqueio se não configurado */}
      {!isConfigured && (
        <Card className="border-l-[3px] border-l-warning bg-warning/5 shadow-sm">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Integração SolarMarket não configurada
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {config && !config.is_active
                  ? "Configuração existe mas está desativada. Ative-a para liberar a importação."
                  : "Cadastre URL base e token da API antes de importar."}
              </p>
            </div>
            <Button asChild>
              <Link to="/admin/configuracoes/integracoes/solarmarket">
                <Settings className="w-4 h-4 mr-2" /> Ir para configuração
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resultado do teste de conexão (inline, discreto) */}
      {testResult && (
        <div
          className={`flex items-start gap-2 p-3 rounded-md border text-sm ${
            testResult.ok
              ? "bg-success/10 border-success/20 text-success"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
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

      {/* Escopo + Disparo */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Escopo da importação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(
              [
                { k: "clientes", label: "Clientes" },
                { k: "projetos", label: "Projetos" },
                { k: "propostas", label: "Propostas" },
                { k: "funis", label: "Funis e Etapas" },
                { k: "custom_fields", label: "Campos Customizados" },
              ] as { k: keyof ImportScope; label: string }[]
            ).map(({ k, label }) => (
              <label
                key={k}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox checked={scope[k]} onCheckedChange={() => toggle(k)} />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Importação idempotente via <code>external_source</code> + <code>external_id</code>.
              Throttle de 60 req/min com backoff em 429.
            </p>
            <Button
              onClick={handleImport}
              disabled={!isConfigured || importAll.isPending || !!runningJob}
            >
              {importAll.isPending || runningJob ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Importar selecionados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progresso ao vivo */}
      {runningJob && (
        <Card id={`sm-job-${runningJob.id}`} className="border-l-[3px] border-l-info bg-card shadow-sm scroll-mt-6">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Importação em andamento
                </p>
                <p className="text-xs text-muted-foreground">
                  Etapa atual:{" "}
                  <span className="font-medium text-foreground">
                    {stepLabel(runningJob.current_step)}
                  </span>
                  {" · "}
                  {Math.round(Number(runningJob.progress_pct ?? 0))}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-info" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel()}
                  disabled={cancelImport.isPending}
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  {cancelImport.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4 mr-2" />
                  )}
                  Cancelar
                </Button>
              </div>
            </div>
            {isStale && (
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs text-warning">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Esta importação está em execução há mais de 10 minutos sem progresso.
                  Provavelmente travou — clique em <strong>Cancelar</strong> para liberar e tentar novamente.
                </span>
              </div>
            )}
            <Progress value={Number(runningJob.progress_pct ?? 0)} />
            {/* Contadores reais (staging) — única fonte de verdade */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Clientes</p>
                <p className="text-sm font-mono font-semibold text-foreground">{liveCounts.data?.clientes ?? runningJob.total_clientes ?? 0}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Projetos</p>
                <p className="text-sm font-mono font-semibold text-foreground">{liveCounts.data?.projetos ?? runningJob.total_projetos ?? 0}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Propostas</p>
                <p className="text-sm font-mono font-semibold text-foreground">{liveCounts.data?.propostas ?? runningJob.total_propostas ?? 0}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Erros</p>
                <p className={`text-sm font-mono font-semibold ${(runningJob.total_errors ?? 0) > 0 ? "text-destructive" : "text-foreground"}`}>
                  {runningJob.total_errors ?? 0}
                </p>
              </div>
            </div>
            {/* Durante a execução, contadores do job ficam defasados em relação ao staging
                (que cresce em tempo real). Isso é esperado — não exibimos banner de divergência
                durante `running` para evitar ruído visual. O job é reconciliado ao finalizar. */}
            <p className="text-[11px] text-muted-foreground pt-1">
              Os números acima refletem o staging em tempo real. O job consolida os totais ao finalizar.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dados importados (abas) */}
      <SolarmarketImportedTabs />

      {/* Histórico */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">Histórico</CardTitle>
          {jobs.some((j) => j.status !== "running" && j.status !== "pending") && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={clearHistory.isPending}
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  {clearHistory.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
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
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma importação executada ainda.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Projetos</TableHead>
                    <TableHead className="text-right">Propostas</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs">{formatBR(j.started_at ?? j.created_at)}</TableCell>
                      <TableCell>{statusBadge(j.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{j.current_step ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{j.total_clientes}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{j.total_projetos}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{j.total_propostas}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {j.total_errors > 0 ? (
                          <span className="text-destructive flex items-center justify-end gap-1">
                            <XCircle className="w-3 h-3" />
                            {j.total_errors}
                          </span>
                        ) : (
                          j.total_errors
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
                            <Ban className="w-3.5 h-3.5 mr-1" />
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
    </div>
  );
}
