import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Play, CheckCircle2, AlertTriangle, XCircle, Clock,
  ChevronDown, ChevronRight, Building2, Zap, Eye, BarChart3,
  Activity, Shield, Info,
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
  tarifa_total_kwh: number | null;
  validation_status: string;
  validation_notes: string[];
  published_at: string | null;
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
  running:  { label: "Executando", icon: RefreshCw,    color: "text-info",    bg: "bg-info/10",    badge: "secondary" },
  success:  { label: "Sucesso",    icon: CheckCircle2,  color: "text-success", bg: "bg-success/10", badge: "default" },
  partial:  { label: "Parcial",    icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", badge: "secondary" },
  error:    { label: "Erro",       icon: XCircle,       color: "text-destructive", bg: "bg-destructive/10", badge: "destructive" },
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

function RunRow({ run }: { run: AneelSyncRun }) {
  const [open, setOpen] = useState(false);
  const cfg = statusConfig[run.status as keyof typeof statusConfig] ?? statusConfig.error;

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
                    <div key={i} className={`${line.includes("✅") ? "text-success" : line.includes("⚠️") ? "text-warning" : line.includes("ERRO") ? "text-destructive" : "text-muted-foreground"}`}>
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-tarifas-aneel", {
        body: { trigger_type: "manual" },
      });
      if (error) throw error;
      if (data?.success) {
        const updated = data.resultados?.length || 0;
        const errors = data.erros?.length || 0;
        toast({
          title: `Sync concluído — ${updated} atualizadas`,
          description: errors > 0 ? `${errors} distribuidora(s) não encontradas na ANEEL` : "Todas atualizadas com sucesso",
        });
        fetchData();
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const lastRun = runs[0];
  const totalActive = versions.length;
  const totalAtencao = versions.filter(v => v.validation_status === 'atencao').length;
  const totalIncompleto = versions.filter(v => v.validation_status === 'incompleto_gd3').length;

  const getConcessionariaStatus = (conc: Concessionaria): { label: string; color: string; bg: string } => {
    const version = versions.find(v => v.concessionaria_id === conc.id);
    if (!version) return { label: "Sem versão ANEEL", color: "text-muted-foreground", bg: "bg-muted/40" };
    if (version.validation_status === 'atencao') return { label: "Atenção", color: "text-warning", bg: "bg-warning/10" };
    if (version.validation_status === 'incompleto_gd3') return { label: "Incompleto GD III", color: "text-info", bg: "bg-info/10" };
    return { label: "OK", color: "text-success", bg: "bg-success/10" };
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
        <Button onClick={handleSync} disabled={syncing} className="gap-2">
          <Play className={`w-4 h-4 ${syncing ? "hidden" : ""}`} />
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : "hidden"}`} />
          {syncing ? "Sincronizando..." : "Executar Agora"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <strong className="text-foreground">Motor GD 2026:</strong> GD II aplica 60% do Fio B como custo não compensável (Lei 14.300).
          GD III inclui Fio A (40%), TFSEE e P&D — quando disponíveis pela ANEEL.
          Cada sync gera uma versão imutável auditável com hash do snapshot ANEEL.
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
                <Button onClick={handleSync} disabled={syncing} className="mt-4 gap-2">
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
                    <TableHead>Total</TableHead>
                    <TableHead>Vigência</TableHead>
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
                        {v.tusd_fio_b_kwh != null ? v.tusd_fio_b_kwh.toFixed(6) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {v.tarifa_total_kwh != null ? `R$ ${v.tarifa_total_kwh.toFixed(4)}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {v.vigencia_inicio}
                        {v.vigencia_fim ? ` → ${v.vigencia_fim}` : " → atual"}
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
                  <TableHead>Status ANEEL</TableHead>
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
                              toast({ title: data?.success ? "Sync concluído" : "Sem correspondência ANEEL", description: `${conc.nome}` });
                              fetchData();
                            } catch (err: any) {
                              toast({ title: "Erro", description: err.message, variant: "destructive" });
                            } finally {
                              setSyncing(false);
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
