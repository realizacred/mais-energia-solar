import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock,
  Play, FlaskConical, Zap, FileText, Wrench, ChevronDown, ChevronRight,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/ui-kit/StatCard";
import { StatusBadge as UiStatusBadge } from "@/components/ui-kit/StatusBadge";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ─── Types ────────────────────────────────────────────── */

interface SyncRun {
  id: string;
  trigger_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_fetched: number | null;
  total_matched: number | null;
  total_updated: number | null;
  total_errors: number | null;
  error_message: string | null;
  logs: any; // Json
}

interface TarifaVersao {
  id: string;
  status: string;
  origem: string;
  created_at: string;
  activated_at: string | null;
  total_registros: number | null;
  total_concessionarias: number | null;
  sync_run_id: string | null;
  notas: string | null;
}

/* ─── Status helpers ──────────────────────────────────── */

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "info" | "muted" }> = {
  running:   { label: "Executando…",  variant: "info" },
  success:   { label: "Sucesso",      variant: "success" },
  partial:   { label: "Parcial",      variant: "warning" },
  error:     { label: "Falhou",       variant: "destructive" },
  timed_out: { label: "Timeout",      variant: "destructive" },
  test_run:  { label: "Test Run",     variant: "info" },
  failed:    { label: "Falhou",       variant: "destructive" },
};

function RunStatusBadge({ status }: { status: string }) {
  const cfg = statusMap[status] ?? { label: status, variant: "muted" as const };
  return <UiStatusBadge variant={cfg.variant} dot>{cfg.label}</UiStatusBadge>;
}

function formatDuration(start: string, end: string | null) {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/* ─── Main Page ───────────────────────────────────────── */

export function AneelSyncStatusPage() {
  const { toast } = useToast();
  const [run, setRun] = useState<SyncRun | null>(null);
  const [versao, setVersao] = useState<TarifaVersao | null>(null);
  const [orphanCount, setOrphanCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [logsOpen, setLogsOpen] = useState(true);

  /* ─── Fetch latest data ─────────────────────────────── */
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [runRes, versaoRes, orphanRes] = await Promise.all([
        supabase
          .from("aneel_sync_runs")
          .select("id, trigger_type, status, started_at, finished_at, total_fetched, total_matched, total_updated, total_errors, error_message, logs")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("tarifa_versoes")
          .select("id, status, origem, created_at, activated_at, total_registros, total_concessionarias, sync_run_id, notas")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("concessionaria_tarifas_subgrupo")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .is("versao_id", null),
      ]);

      if (runRes.error) {
        console.error("Erro ao buscar sync runs:", runRes.error);
        setFetchError(`Erro ao buscar runs: ${runRes.error.message}`);
      }
      if (versaoRes.error) {
        console.error("Erro ao buscar versões:", versaoRes.error);
      }

      if (runRes.data) setRun(runRes.data as unknown as SyncRun);
      if (versaoRes.data) setVersao(versaoRes.data as unknown as TarifaVersao);
      setOrphanCount(orphanRes.count ?? 0);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setFetchError(`Erro inesperado: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Auto-refresh while running ────────────────────── */
  useEffect(() => {
    if (!run || run.status !== "running") return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("aneel_sync_runs")
        .select("id, trigger_type, status, started_at, finished_at, total_fetched, total_matched, total_updated, total_errors, error_message, logs")
        .eq("id", run.id)
        .single();

      if (!data) return;
      const updated = data as unknown as SyncRun;
      setRun(updated);

      if (updated.status !== "running") {
        clearInterval(interval);
        setSyncing(false);
        // Refetch versão + orphan count
        fetchData();
        toast({
          title: updated.status === "success" ? "✅ Sync concluído" : "⚠️ Sync finalizado",
          description: `Status: ${statusMap[updated.status]?.label ?? updated.status}`,
          variant: updated.status === "success" ? undefined : "destructive",
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [run?.id, run?.status, fetchData, toast]);

  /* ─── Actions ───────────────────────────────────────── */
  const handleSync = async (testRun = false) => {
    setSyncing(true);
    try {
      // Fire the edge function — it now awaits internally (~50s).
      // We race with a short timeout to get the run_id from polling instead.
      const responsePromise = supabase.functions.invoke("sync-tarifas-aneel", {
        body: { trigger_type: "manual", test_run: testRun },
      });

      // Wait up to 5s for immediate response (unlikely since sync now awaits)
      const raceResult = await Promise.race([
        responsePromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);

      if (raceResult && !raceResult.error && raceResult.data?.run_id) {
        // Got immediate response with run_id
        toast({ title: "🚀 Sync iniciado", description: "Acompanhe o progresso abaixo." });
        setRun({
          id: raceResult.data.run_id,
          trigger_type: testRun ? "test_run" : "manual",
          status: raceResult.data.status === "running" ? "running" : (raceResult.data.status || "running"),
          started_at: new Date().toISOString(),
          finished_at: null,
          total_fetched: raceResult.data.total_fetched || 0,
          total_matched: raceResult.data.total_matched || 0,
          total_updated: raceResult.data.total_updated || 0,
          total_errors: raceResult.data.total_errors || 0,
          error_message: null,
          logs: [],
        });
      } else {
        // Timeout — sync is running but we don't have run_id yet.
        // Polling will pick it up from the DB.
        toast({ title: "🚀 Sync iniciado", description: "Buscando progresso..." });
        fetchData();
      }

      // Continue waiting in background so we get the final response
      responsePromise.then((res) => {
        if (res?.data) {
          fetchData();
          setSyncing(false);
        }
      }).catch(() => {
        fetchData();
        setSyncing(false);
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setSyncing(false);
    }
  };

  const handleBackfill = async () => {
    if (orphanCount === 0) return;
    setBackfilling(true);
    try {
      // Try active version first, then fall back to latest rascunho
      let targetVersao: { id: string } | null = null;

      const { data: activeVersao } = await supabase
        .from("tarifa_versoes")
        .select("id")
        .eq("status", "ativa")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeVersao) {
        targetVersao = activeVersao;
      } else {
        // No active version — use latest rascunho and activate it
        const { data: latestRascunho } = await supabase
          .from("tarifa_versoes")
          .select("id")
          .eq("status", "rascunho")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestRascunho) {
          // Activate this rascunho version
          await supabase
            .from("tarifa_versoes")
            .update({ status: "ativa", activated_at: new Date().toISOString() })
            .eq("id", latestRascunho.id);
          targetVersao = latestRascunho;
        }
      }

      if (!targetVersao) {
        toast({ title: "Sem versão disponível", description: "Não existe nenhuma versão para vincular os registros legados.", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from("concessionaria_tarifas_subgrupo")
        .update({ versao_id: targetVersao.id })
        .eq("is_active", true)
        .is("versao_id", null);

      if (error) throw error;

      toast({ title: "✅ Backfill concluído", description: `Registros legados vinculados à versão ${targetVersao.id.substring(0, 8)}…` });
      setOrphanCount(0);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro no backfill", description: err.message, variant: "destructive" });
    } finally {
      setBackfilling(false);
    }
  };

  /* ─── Render ────────────────────────────────────────── */
  const logs: string[] = Array.isArray(run?.logs) ? run.logs : [];
  const isRunning = run?.status === "running";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Status do Sync ANEEL</h1>
            <p className="text-sm text-muted-foreground">
              Monitoramento em tempo real da sincronização de tarifas
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSync(true)} disabled={syncing}>
            <FlaskConical className="w-4 h-4 mr-1" />
            Test Run
          </Button>
          <Button size="sm" onClick={() => handleSync(false)} disabled={syncing}>
            {syncing
              ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" />Sincronizando…</>
              : <><Play className="w-4 h-4 mr-1" />Sincronizar ANEEL</>}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <strong>⚠️ Erro ao carregar dados:</strong> {fetchError}
          <p className="text-xs mt-1 text-muted-foreground">Verifique se você está logado e tem permissão para acessar esta página.</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Status último run"
          value={run ? (statusMap[run.status]?.label ?? run.status) : "Nenhum"}
          color={run?.status === "success" ? "success" : run?.status === "running" ? "info" : run?.status === "partial" ? "warning" : "destructive"}
        />
        <StatCard
          icon={Zap}
          label="Registros atualizados"
          value={run?.total_updated ?? 0}
          color="primary"
          subtitle={`de ${run?.total_fetched ?? 0} lidos`}
        />
        <StatCard
          icon={XCircle}
          label="Erros"
          value={run?.total_errors ?? 0}
          color={run?.total_errors && run.total_errors > 0 ? "destructive" : "success"}
        />
        <StatCard
          icon={Wrench}
          label="Legado sem versão"
          value={orphanCount}
          color={orphanCount > 0 ? "warning" : "success"}
          subtitle={orphanCount > 0 ? "is_active=true, versao_id=null" : "Tudo vinculado"}
        />
      </div>

      {/* Run Detail */}
      {run && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Último Run
                <RunStatusBadge status={run.status} />
                {isRunning && (
                  <span className="text-xs text-info animate-pulse ml-2">● auto-refresh 3s</span>
                )}
              </CardTitle>
              <span className="text-xs text-muted-foreground font-mono">{run.id.substring(0, 12)}…</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Metadata grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Trigger</span>
                <p className="font-medium capitalize">{run.trigger_type}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Início</span>
                <p className="font-medium">{format(new Date(run.started_at), "dd/MM HH:mm:ss", { locale: ptBR })}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Fim</span>
                <p className="font-medium">
                  {run.finished_at
                    ? format(new Date(run.finished_at), "dd/MM HH:mm:ss", { locale: ptBR })
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Duração</span>
                <p className="font-medium">{formatDuration(run.started_at, run.finished_at)}</p>
              </div>
            </div>

            {/* Counters */}
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground">API: <strong className="text-foreground">{run.total_fetched ?? 0}</strong></span>
              <span className="text-muted-foreground">Match: <strong className="text-foreground">{run.total_matched ?? 0}</strong></span>
              <span className="text-success">✓ Atualizados: <strong>{run.total_updated ?? 0}</strong></span>
              {(run.total_errors ?? 0) > 0 && (
                <span className="text-destructive">✗ Erros: <strong>{run.total_errors}</strong></span>
              )}
            </div>

            {/* Error message */}
            {run.error_message && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <strong>Erro:</strong> {run.error_message}
              </div>
            )}

            {/* Logs */}
            <div>
              <button
                onClick={() => setLogsOpen(!logsOpen)}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {logsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Logs ({logs.length} entradas)
              </button>
              {logsOpen && (
                <ScrollArea className="h-64 mt-2 rounded-lg border bg-muted/30">
                  <div className="p-3 font-mono text-xs space-y-0.5">
                    {logs.length === 0 ? (
                      <span className="text-muted-foreground italic">Nenhum log disponível</span>
                    ) : (
                      logs.map((line, i) => (
                        <div
                          key={i}
                          className={cn(
                            typeof line === "string" && line.includes("✅") && "text-success",
                            typeof line === "string" && line.includes("⚠️") && "text-warning",
                            typeof line === "string" && (line.includes("ERRO") || line.includes("❌")) && "text-destructive",
                            typeof line === "string" && line.includes("🧪") && "text-info",
                            !(typeof line === "string" && (line.includes("✅") || line.includes("⚠️") || line.includes("ERRO") || line.includes("❌") || line.includes("🧪"))) && "text-muted-foreground",
                          )}
                        >
                          {typeof line === "string" ? line : JSON.stringify(line)}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Versioning + Backfill */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Latest version */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nova versão criada?</CardTitle>
          </CardHeader>
          <CardContent>
            {versao ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <UiStatusBadge
                    variant={versao.status === "ativa" ? "success" : versao.status === "rascunho" ? "warning" : "muted"}
                    dot
                  >
                    {versao.status}
                  </UiStatusBadge>
                  <span className="text-xs text-muted-foreground font-mono">{versao.id.substring(0, 12)}…</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Origem</span>
                    <p className="font-medium capitalize">{versao.origem}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Criada em</span>
                    <p className="font-medium">{format(new Date(versao.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Registros</span>
                    <p className="font-medium">{versao.total_registros ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Concessionárias</span>
                    <p className="font-medium">{versao.total_concessionarias ?? "—"}</p>
                  </div>
                </div>
                {versao.activated_at && (
                  <p className="text-xs text-success">
                    Ativada em {format(new Date(versao.activated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                )}
                {versao.notas && (
                  <p className="text-xs text-muted-foreground italic">{versao.notas}</p>
                )}
                {versao.sync_run_id && run && versao.sync_run_id === run.id && (
                  <Badge variant="outline" className="text-xs">Vinculada ao último run</Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nenhuma versão encontrada</p>
            )}
          </CardContent>
        </Card>

        {/* Backfill */}
        <Card className={orphanCount > 0 ? "border-warning/40" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              Registros legado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Registros ativos em <code className="text-xs bg-muted px-1 py-0.5 rounded">concessionaria_tarifas_subgrupo</code> com{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">versao_id = NULL</code>.
            </p>
            <div className="flex items-center gap-3">
              <span className={cn("text-3xl font-bold", orphanCount > 0 ? "text-warning" : "text-success")}>
                {orphanCount}
              </span>
              <span className="text-sm text-muted-foreground">registros órfãos</span>
            </div>
            {orphanCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackfill}
                disabled={backfilling}
                className="gap-1.5"
              >
                {backfilling
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Corrigindo…</>
                  : <><Wrench className="w-3.5 h-3.5" />Corrigir legado</>}
              </Button>
            )}
            {orphanCount === 0 && (
              <p className="text-xs text-success flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Todos os registros ativos possuem versao_id
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
