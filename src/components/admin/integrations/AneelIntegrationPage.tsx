import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Play, CheckCircle2, AlertTriangle, XCircle, Clock,
  ChevronDown, ChevronRight, Building2, Zap, Eye, BarChart3,
  Activity, Shield, Info, ShieldCheck, ShieldAlert, FlaskConical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AneelSyncRun {
  id: string;
  trigger_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_fetched: number;
  total_matched: number;
  total_updated: number;
  total_errors: number;
  snapshot_hash: string | null;
  logs: string[];
  error_message: string | null;
}

interface TariffVersion {
  id: string;
  concessionaria_id: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  is_active: boolean;
  origem: string;
  te_kwh: number | null;
  tusd_fio_b_kwh: number | null;
  tusd_total_kwh: number | null;
  tarifa_total_kwh: number | null;
  validation_status: string;
  validation_notes: string[];
  published_at: string | null;
  precisao: string;
  concessionarias?: { nome: string; sigla: string | null; estado: string | null };
}

interface Concessionaria {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
  ultima_sync_tarifas: string | null;
  tarifa_energia: number | null;
  tarifa_fio_b: number | null;
}

const statusConfig = {
  running:   { label: "Executando", icon: RefreshCw,    color: "text-info",        bg: "bg-info/10",        badge: "secondary" },
  success:   { label: "Sucesso",    icon: CheckCircle2,  color: "text-success",     bg: "bg-success/10",     badge: "default" },
  partial:   { label: "Parcial",    icon: AlertTriangle, color: "text-warning",     bg: "bg-warning/10",     badge: "secondary" },
  error:     { label: "Erro",       icon: XCircle,       color: "text-destructive", bg: "bg-destructive/10", badge: "destructive" },
  test_run:  { label: "Test Run",   icon: FlaskConical,  color: "text-info",        bg: "bg-info/10",        badge: "secondary" },
} as const;

const validationConfig = {
  ok:             { label: "OK",               icon: CheckCircle2,  color: "text-success" },
  atencao:        { label: "Atenção",           icon: AlertTriangle, color: "text-warning" },
  incompleto_gd3: { label: "Incompleto GD III", icon: Info,          color: "text-info" },
} as const;

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.error;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

function ValidationBadge({ status }: { status: string }) {
  const cfg = validationConfig[status as keyof typeof validationConfig] ?? validationConfig.atencao;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

function PrecisaoBadgeSmall({ precisao }: { precisao?: string }) {
  if (precisao === 'exato') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
        <ShieldCheck className="w-3 h-3" />
        EXATO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
      <ShieldAlert className="w-3 h-3" />
      ESTIMADO
    </span>
  );
}

function RunRow({ run }: { run: AneelSyncRun }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer">
          <TableCell>
            <div className="flex items-center gap-2">
              {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <span className="text-xs font-mono text-muted-foreground">{run.id.substring(0, 8)}...</span>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs capitalize">{run.trigger_type}</Badge>
          </TableCell>
          <TableCell><StatusBadge status={run.status} /></TableCell>
          <TableCell className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(run.started_at), { addSuffix: true, locale: ptBR })}
          </TableCell>
          <TableCell className="text-xs">
            {run.finished_at
              ? `${Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
              : "—"}
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">API: <strong className="text-foreground">{run.total_fetched}</strong></span>
              <span className="text-muted-foreground">Match: <strong className="text-foreground">{run.total_matched}</strong></span>
              <span className="text-success">✓ {run.total_updated}</span>
              {run.total_errors > 0 && <span className="text-destructive">✗ {run.total_errors}</span>}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={6} className="p-0 bg-muted/20">
            <div className="p-4">
              {run.snapshot_hash && (
                <p className="text-xs text-muted-foreground mb-3 font-mono">
                  Hash snapshot: {run.snapshot_hash}
                </p>
              )}
              {run.error_message && (
                <div className="mb-3 p-2 rounded bg-destructive/10 text-destructive text-xs">{run.error_message}</div>
              )}
              <ScrollArea className="h-48 rounded border bg-background">
                <div className="p-3 font-mono text-xs space-y-0.5">
                  {(run.logs || []).map((line, i) => (
                    <div key={i} className={`${line.includes("✅") ? "text-success" : line.includes("⚠️") ? "text-warning" : line.includes("ERRO") ? "text-destructive" : line.includes("🧪") ? "text-info" : "text-muted-foreground"}`}>
                      {line}
                    </div>
                  ))}
                  {(!run.logs || run.logs.length === 0) && (
                    <div className="text-muted-foreground italic">Nenhum log disponível</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AneelIntegrationPage() {
  const { toast } = useToast();
  const [runs, setRuns] = useState<AneelSyncRun[]>([]);
  const [versions, setVersions] = useState<TariffVersion[]>([]);
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"status" | "versoes" | "distribuidoras">("status");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [runsRes, versionsRes, concRes] = await Promise.all([
        supabase
          .from("aneel_sync_runs" as any)
          .select("*")
          .order("started_at", { ascending: false })
          .limit(20),
        supabase
          .from("tariff_versions" as any)
          .select("*, concessionarias(nome, sigla, estado)")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("concessionarias")
          .select("id, nome, sigla, estado, ultima_sync_tarifas, tarifa_energia, tarifa_fio_b")
          .eq("ativo", true)
          .order("nome"),
      ]);

      if (runsRes.data) setRuns(runsRes.data as unknown as AneelSyncRun[]);
      if (versionsRes.data) setVersions(versionsRes.data as unknown as TariffVersion[]);
      if (concRes.data) setConcessionarias(concRes.data as Concessionaria[]);
    } catch (err: any) {
      toast({ title: "Erro ao carregar dados", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll for sync progress when syncing
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRunId) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("aneel_sync_runs" as any)
        .select("status, total_fetched, total_matched, total_updated, total_errors, error_message, logs")
        .eq("id", activeRunId)
        .single();

      if (!data) return;

      const run = data as any;

      // Update the runs list with latest progress
      setRuns(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(r => r.id === activeRunId);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], ...run };
        }
        return updated;
      });

      // Check if completed
      if (run.status !== 'running') {
        clearInterval(interval);
        setActiveRunId(null);
        setSyncing(false);

        if (run.status === 'success' || run.status === 'partial') {
          toast({
            title: run.status === 'success' ? '✅ Sincronização concluída com sucesso' : '⚠️ Sincronização parcial',
            description: `${run.total_fetched || 0} registros da ANEEL · ${run.total_matched || 0} concessionárias encontradas · ${run.total_updated || 0} atualizadas${run.total_errors > 0 ? ` · ${run.total_errors} erros` : ''}`,
          });
        } else if (run.status === 'test_run') {
          toast({ title: "🧪 Test Run concluído", description: `${run.total_matched || 0} concessionárias encontradas, ${run.total_updated || 0} simuladas` });
        } else if (run.status === 'error') {
          toast({ title: "❌ Sincronização falhou", description: run.error_message || "Erro desconhecido", variant: "destructive" });
        } else if (run.status === 'timed_out') {
          toast({ title: "⏱️ Sincronização expirou", description: `Timeout. ${run.total_updated || 0} atualizadas antes da expiração.`, variant: "destructive" });
        } else {
          toast({ title: `Sync: ${run.status}`, description: run.error_message || "" });
        }

        fetchData(); // Refresh all data
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [activeRunId, toast, fetchData]);

  const handleSync = async (testRun = false) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-tarifas-aneel", {
        body: { trigger_type: "manual", test_run: testRun },
      });
      if (error) throw error;
      if (data?.success) {
        if (data.already_running) {
          toast({ title: "⏳ Sincronização já em andamento", description: "Acompanhe o progresso na tabela abaixo." });
          setActiveRunId(data.run_id);
        } else {
          toast({ title: "🚀 Sincronização iniciada", description: "Processando em segundo plano. O progresso será atualizado automaticamente na tabela abaixo." });
          setActiveRunId(data.run_id);
          setActiveTab("status");
          // Add placeholder run to the list
          setRuns(prev => [{
            id: data.run_id,
            trigger_type: testRun ? 'test_run' : 'manual',
            status: 'running',
            started_at: new Date().toISOString(),
            finished_at: null,
            total_fetched: 0,
            total_matched: 0,
            total_updated: 0,
            total_errors: 0,
            snapshot_hash: null,
            logs: [],
            error_message: null,
          }, ...prev]);
        }
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
      setSyncing(false);
    }
  };

  const lastRun = runs[0];
  const totalActive = versions.length;
  const totalAtencao = versions.filter(v => v.validation_status === 'atencao').length;
  const totalIncompleto = versions.filter(v => v.validation_status === 'incompleto_gd3').length;
  const totalExato = versions.filter(v => v.precisao === 'exato').length;
  const totalEstimado = versions.filter(v => v.precisao === 'estimado' || !v.precisao).length;

  const getConcessionariaStatus = (conc: Concessionaria) => {
    const version = versions.find(v => v.concessionaria_id === conc.id);
    if (!version) return { label: "Sem versão ANEEL", color: "text-muted-foreground", bg: "bg-muted/40", precisao: null };
    if (version.validation_status === 'atencao') return { label: "Atenção", color: "text-warning", bg: "bg-warning/10", precisao: version.precisao };
    if (version.validation_status === 'incompleto_gd3') return { label: "Incompleto GD III", color: "text-info", bg: "bg-info/10", precisao: version.precisao };
    return { label: "OK", color: "text-success", bg: "bg-success/10", precisao: version.precisao };
  };

  const tabs = [
    { id: "status",        label: "Status & Execuções", icon: Activity },
    { id: "versoes",       label: "Versões de Tarifa",  icon: Shield },
    { id: "distribuidoras", label: "Distribuidoras",    icon: Building2 },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Integração ANEEL
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sincronização semanal de tarifas homologadas · Versionamento auditável · Motor GD II/III 2026
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSync(true)} disabled={syncing} className="gap-2">
            <FlaskConical className="w-4 h-4" />
            Test Run
          </Button>
          <Button onClick={() => handleSync(false)} disabled={syncing} className="gap-2">
            <Play className={`w-4 h-4 ${syncing ? "hidden" : ""}`} />
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : "hidden"}`} />
            {syncing ? "Sincronizando..." : "Executar Agora"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1">Último Sync</div>
            <div className="font-semibold text-sm">
              {lastRun
                ? formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true, locale: ptBR })
                : "Nunca"}
            </div>
            {lastRun && <StatusBadge status={lastRun.status} />}
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1">Versões Ativas</div>
            <div className="text-2xl font-bold">{totalActive}</div>
            <div className="text-xs text-muted-foreground">distribuidoras</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1">Precisão</div>
            <div className="flex items-center gap-2">
              <span className="text-success font-bold">{totalExato}</span>
              <span className="text-xs text-muted-foreground">exato</span>
              <span className="text-warning font-bold">{totalEstimado}</span>
              <span className="text-xs text-muted-foreground">estimado</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1">Com Atenção</div>
            <div className={`text-2xl font-bold ${totalAtencao > 0 ? "text-warning" : "text-success"}`}>{totalAtencao}</div>
            <div className="text-xs text-muted-foreground">dados suspeitos</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1">Incompleto GD III</div>
            <div className={`text-2xl font-bold ${totalIncompleto > 0 ? "text-info" : "text-success"}`}>{totalIncompleto}</div>
            <div className="text-xs text-muted-foreground">sem Fio A/TFSEE</div>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      <div className="p-3 rounded-lg bg-info/5 border border-info/20 flex items-start gap-2">
        <Info className="w-4 h-4 text-info mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Precisão do Fio B:</strong>{" "}
          <span className="text-success font-medium">EXATO</span> quando Fio B é configurado manualmente na distribuidora (valor real). {" "}
          <span className="text-warning font-medium">ESTIMADO</span> quando o TUSD total da ANEEL é usado como proxy (B1 convencional não discrimina Fio B).
          Use "Test Run" para simular o sync sem publicar alterações.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Status & Execuções */}
      {activeTab === "status" && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Histórico de Execuções</CardTitle>
            <CardDescription>Cada execução é imutável — hash do snapshot ANEEL garante rastreabilidade completa.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : runs.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Nenhuma execução registrada</p>
                <p className="text-xs text-muted-foreground mt-1">Execute o sync para começar o histórico de auditoria.</p>
                <Button onClick={() => handleSync(false)} disabled={syncing} className="mt-4 gap-2">
                  <Play className="w-4 h-4" />
                  Executar Primeiro Sync
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run ID</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Iniciado</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Resultados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map(run => <RunRow key={run.id} run={run} />)}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Versões de Tarifa */}
      {activeTab === "versoes" && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Versões de Tarifa Ativas</CardTitle>
            <CardDescription>Uma versão por distribuidora — histórico completo preservado, nunca sobrescrito.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : versions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma versão de tarifa ANEEL encontrada. Execute o sync para gerar versões.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Distribuidora</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>TE (R$/kWh)</TableHead>
                    <TableHead>Fio B (R$/kWh)</TableHead>
                    <TableHead>TUSD Total</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Precisão</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Validação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium text-sm">
                        {(v.concessionarias as any)?.nome || "—"}
                      </TableCell>
                      <TableCell>
                        {(v.concessionarias as any)?.estado
                          ? <Badge variant="outline" className="font-mono text-xs">{(v.concessionarias as any).estado}</Badge>
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.te_kwh != null ? v.te_kwh.toFixed(6) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.tusd_fio_b_kwh != null ? (
                          <span className="text-success">{v.tusd_fio_b_kwh.toFixed(6)}</span>
                        ) : (
                          <span className="text-muted-foreground italic">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.tusd_total_kwh != null ? v.tusd_total_kwh.toFixed(6) : (
                          v.tarifa_total_kwh != null ? <span className="text-muted-foreground">{v.tarifa_total_kwh.toFixed(6)}</span> : "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {v.vigencia_inicio}
                        {v.vigencia_fim ? ` → ${v.vigencia_fim}` : " → atual"}
                      </TableCell>
                      <TableCell>
                        <PrecisaoBadgeSmall precisao={v.precisao} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.origem === 'ANEEL' ? 'default' : 'secondary'} className="text-xs">
                          {v.origem}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ValidationBadge status={v.validation_status} />
                        {(v.validation_notes || []).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {(v.validation_notes as string[])[0]}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Distribuidoras */}
      {activeTab === "distribuidoras" && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Status das Distribuidoras</CardTitle>
            <CardDescription>Cobertura do sync ANEEL por distribuidora cadastrada.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Sigla</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Tarifa atual</TableHead>
                  <TableHead>Fio B</TableHead>
                  <TableHead>Último sync</TableHead>
                  <TableHead>Precisão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {concessionarias.map(conc => {
                  const status = getConcessionariaStatus(conc);
                  return (
                    <TableRow key={conc.id}>
                      <TableCell className="font-medium text-sm">{conc.nome}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{conc.sigla || "—"}</TableCell>
                      <TableCell>
                        {conc.estado ? <Badge variant="outline" className="font-mono text-xs">{conc.estado}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {conc.tarifa_energia != null ? `R$ ${Number(conc.tarifa_energia).toFixed(4)}` : <span className="text-muted-foreground">não definido</span>}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {conc.tarifa_fio_b != null && Number(conc.tarifa_fio_b) > 0 ? `R$ ${Number(conc.tarifa_fio_b).toFixed(4)}` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {conc.ultima_sync_tarifas
                          ? formatDistanceToNow(new Date(conc.ultima_sync_tarifas), { addSuffix: true, locale: ptBR })
                          : <span className="text-destructive">Nunca</span>}
                      </TableCell>
                      <TableCell>
                        {status.precisao ? <PrecisaoBadgeSmall precisao={status.precisao} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={async () => {
                            setSyncing(true);
                            try {
                              const { data, error } = await supabase.functions.invoke("sync-tarifas-aneel", {
                                body: { concessionaria_id: conc.id, trigger_type: "manual" },
                              });
                              if (error) throw error;
                              toast({ title: "Sincronização iniciada", description: `${conc.nome} — acompanhe o progresso.` });
                              // Polling will handle the rest
                            } catch (err: any) {
                              setSyncing(false);
                              toast({ title: "Erro", description: err.message, variant: "destructive" });
                            }
                          }}
                          disabled={syncing}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Sync
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
