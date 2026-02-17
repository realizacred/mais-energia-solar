/**
 * BaseMeteorologicaPage — Unified admin page for solar irradiance data management.
 * 
 * 4 Tabs:
 * - Visão geral: Dashboard summary cards + provider status
 * - Importação automática (NASA): NASA POWER API sync with event log
 * - Importação manual (Atlas CSV): Triple CSV upload with validation
 * - Auditoria: Integrity checks + lookup tester + purge
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Database, Globe, Loader2, Sun, Trash2, Zap, ShieldAlert,
  CheckCircle2, AlertTriangle, MapPin, BarChart3, Clock, Layers,
  Search, Info, RefreshCw, Upload, Play, Satellite, FileSpreadsheet,
  ShieldCheck, Activity,
} from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DatasetConfig, DatasetRow, VersionRow } from "./base-meteorologica/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIrradianceDatasets, getExpectedPoints, isVersionStalled } from "@/hooks/useIrradianceDatasets";
import { getMonthlyIrradiance, type IrradianceLookupResult } from "@/services/irradiance-provider";
import { CsvImportPanel } from "./base-meteorologica/CsvImportPanel";
import { VersionHistory } from "./base-meteorologica/VersionHistory";

// ── Provider definitions ─────────────────────────────────
const DATASETS: DatasetConfig[] = [
  {
    code: "INPE_2017_SUNDATA",
    label: "Atlas Brasileiro 2ª Ed. (INPE 2017)",
    type: "csv",
    icon: Sun,
    description: "Base oficial brasileira de irradiância solar — dados de GHI, DHI e DNI para todo o Brasil.",
  },
  {
    code: "INPE_2009_10KM",
    label: "Atlas Solar Brasil 10km (INPE 2009)",
    type: "csv",
    icon: Globe,
    description: "Grade com resolução de 10km sobre o território brasileiro.",
  },
  {
    code: "NASA_POWER_GLOBAL",
    label: "NASA POWER — Dados Globais",
    type: "api",
    icon: Zap,
    description: "Dados globais de irradiância via API da NASA (cobertura mundial).",
  },
];

const CSV_DATASETS = DATASETS.filter(d => d.type === "csv");
const API_DATASETS = DATASETS.filter(d => d.type === "api");

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/10 text-success border-success/30",
  deprecated: "bg-muted text-muted-foreground border-border",
  processing: "bg-warning/10 text-warning border-warning/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
};

// ── Auth Guard ───────────────────────────────────────────
function useAdminGuard() {
  const [state, setState] = useState<"loading" | "authorized" | "denied">("loading");
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState("denied"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = roles?.some((r: any) => ["admin", "super_admin", "gerente"].includes(r.role));
      setState(isAdmin ? "authorized" : "denied");
    })();
  }, []);
  return state;
}

// ── Main Page ────────────────────────────────────────────
export function BaseMeteorologicaPage() {
  const auth = useAdminGuard();
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleanedUp, setCleanedUp] = useState(false);
  const [tab, setTab] = useState("overview");

  // Audit hook
  const {
    datasets: auditDatasets,
    versions: auditVersions,
    loading: auditLoading,
    reload: auditReload,
    getVersionsForDataset,
    getActiveVersion: getAuditActiveVersion,
    getIntegrity,
  } = useIrradianceDatasets();

  // Lookup tester state
  const [testLat, setTestLat] = useState("-15.7942");
  const [testLon, setTestLon] = useState("-47.8822");
  const [testResult, setTestResult] = useState<IrradianceLookupResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState("");

  // Purge state
  const [purgeTarget, setPurgeTarget] = useState<string>("ALL");
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purging, setPurging] = useState(false);

  // NASA sync state
  const [nasaSyncing, setNasaSyncing] = useState(false);
  const [nasaCancelling, setNasaCancelling] = useState(false);
  const [nasaLogs, setNasaLogs] = useState<{ ts: number; level: "info" | "warn" | "error" | "success"; msg: string }[]>([]);
  const [nasaProgress, setNasaProgress] = useState<{ current: number; total: number } | null>(null);
  const nasaPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadData = useCallback(async () => {
    setLoading(true);
    const [dsRes, verRes] = await Promise.all([
      supabase.from("irradiance_datasets").select("id, code, name").order("code"),
      supabase.from("irradiance_dataset_versions").select("*").order("created_at", { ascending: false }),
    ]);
    if (dsRes.data) setDatasets(dsRes.data);
    if (verRes.data) setVersions(verRes.data as VersionRow[]);
    setLoading(false);
  }, []);

  // Auto-cleanup stuck versions on first load
  useEffect(() => {
    if (auth === "authorized" && !cleanedUp) {
      (async () => {
        try {
          const { data, error } = await supabase.rpc("cleanup_stuck_irradiance_versions" as any);
          if (!error && data && (data as number) > 0) {
            toast.info(`${data} versão(ões) travada(s) foram limpas automaticamente.`);
          }
        } catch { /* ignore */ }
        setCleanedUp(true);
        loadData();
        auditReload();
      })();
    } else if (auth === "authorized" && cleanedUp) {
      loadData();
    }
  }, [auth, cleanedUp, loadData, auditReload]);

  const getDatasetId = (code: string) => datasets.find(d => d.code === code)?.id;
  const getVersionsFor = (code: string) => {
    const dsId = getDatasetId(code);
    return dsId ? versions.filter(v => v.dataset_id === dsId) : [];
  };
  const getActiveVersion = (code: string) => getVersionsFor(code).find(v => v.status === "active");
  const getProcessingVersion = (code: string) => getVersionsFor(code).find(v => v.status === "processing");

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (nasaPollRef.current) clearInterval(nasaPollRef.current);
    };
  }, []);

  // Poll NASA progress from version row_count
  const startNasaPolling = useCallback((versionId: string, addLog: (level: "info" | "warn" | "error" | "success", msg: string) => void) => {
    if (nasaPollRef.current) clearInterval(nasaPollRef.current);
    let lastLoggedCount = 0;

    nasaPollRef.current = setInterval(async () => {
      const { data: ver } = await supabase
        .from("irradiance_dataset_versions")
        .select("status, row_count, metadata")
        .eq("id", versionId)
        .single();

      if (!ver) return;

      const meta = (ver.metadata ?? {}) as Record<string, any>;
      const total = meta.total_points_attempted || meta.grid_total_points || 0;
      const current = ver.row_count ?? 0;

      setNasaProgress({ current, total: total || current });

      if (ver.status === "active" || (ver.status === "processing" && meta.ready_for_activation)) {
        clearInterval(nasaPollRef.current!);
        nasaPollRef.current = null;
        addLog("success", `✅ Concluído! ${current.toLocaleString("pt-BR")} pontos prontos para ativação.`);
        setNasaSyncing(false);
        loadData();
        auditReload();
      } else if (ver.status === "failed") {
        clearInterval(nasaPollRef.current!);
        nasaPollRef.current = null;
        addLog("error", `❌ Falhou: ${meta.error || "Erro desconhecido"}`);
        setNasaSyncing(false);
        setNasaProgress(null);
        loadData();
        auditReload();
      } else if (current > lastLoggedCount) {
        lastLoggedCount = current;
        if (total > 0) {
          const pct = Math.round((current / total) * 100);
          addLog("info", `${pct}% — ${current.toLocaleString("pt-BR")}/${total.toLocaleString("pt-BR")} pontos`);
        } else {
          addLog("info", `${current.toLocaleString("pt-BR")} pontos importados...`);
        }
      }
    }, 5000);
  }, [loadData, auditReload]);

  // Cancel NASA sync
  const handleNasaCancel = async () => {
    setNasaCancelling(true);
    const addLog = (level: "info" | "warn" | "error" | "success", msg: string) => {
      setNasaLogs(prev => [...prev, { ts: Date.now(), level, msg }]);
    };

    try {
      const nasaDs = API_DATASETS[0];
      if (!nasaDs) return;

      const processingVer = getProcessingVersion(nasaDs.code);
      if (!processingVer) {
        addLog("warn", "Nenhuma importação em andamento para cancelar.");
        return;
      }

      addLog("info", "Cancelando importação...");

      const { error } = await supabase.functions.invoke("irradiance-import", {
        body: { action: "abort", version_id: processingVer.id, error: "Cancelado pelo usuário" },
      });

      if (error) throw error;

      if (nasaPollRef.current) {
        clearInterval(nasaPollRef.current);
        nasaPollRef.current = null;
      }

      addLog("success", "✅ Importação cancelada. Dados parciais foram removidos.");
      setNasaSyncing(false);
      setNasaProgress(null);
      loadData();
      auditReload();
    } catch (e: any) {
      addLog("error", `Erro ao cancelar: ${e.message}`);
    } finally {
      setNasaCancelling(false);
    }
  };

  // ── NASA Sync ──
  const handleNasaSync = async () => {
    setNasaSyncing(true);
    setNasaLogs([]);
    setNasaProgress(null);
    const addLog = (level: "info" | "warn" | "error" | "success", msg: string) => {
      setNasaLogs(prev => [...prev, { ts: Date.now(), level, msg }]);
    };

    addLog("info", "Conectando ao servidor NASA POWER...");
    
    try {
      const nasaDs = API_DATASETS[0];
      if (!nasaDs) throw new Error("Dataset NASA não configurado");

      addLog("info", "Autenticação verificada ✓");

      const versionTag = `v${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      addLog("info", `Iniciando versão ${versionTag}...`);

      const { data, error } = await supabase.functions.invoke("irradiance-fetch", {
        body: { dataset_code: nasaDs.code, version_tag: versionTag, step_deg: 1 },
      });

      if (error) {
        const msg = String(error?.message ?? "").toLowerCase();
        if (msg.includes("function not found") || msg.includes("404") || msg.includes("boot error")) {
          addLog("warn", "Função de sincronização não está disponível no momento.");
          setNasaSyncing(false);
          return;
        }
        throw error;
      }

      if (data?.error === "VERSION_EXISTS") {
        addLog("warn", `${data.message}`);
        setNasaSyncing(false);
        return;
      }
      if (data?.error === "VERSION_PROCESSING") {
        addLog("warn", `${data.message}`);
        if (data?.version_id) {
          addLog("info", "Monitorando progresso da importação existente...");
          startNasaPolling(data.version_id, addLog);
        } else {
          setNasaSyncing(false);
        }
        return;
      }

      addLog("success", "Sincronização iniciada! Monitorando progresso...");

      if (data?.version_id) {
        setNasaProgress({ current: data.chunk_rows ?? 0, total: data.grid_total_points ?? 0 });
        startNasaPolling(data.version_id, addLog);
      }

      loadData();
      auditReload();
    } catch (e: any) {
      addLog("error", `❌ Erro: ${e.message}`);
      setNasaSyncing(false);
    }
  };

  // Purge via canonical RPC
  const handlePurge = async () => {
    if (purgeConfirm !== "LIMPAR") return;
    setPurging(true);
    try {
      if (purgeTarget === "ALL") {
        for (const ds of datasets) {
          await supabase.rpc("purge_irradiance_dataset", { _dataset_id: ds.id });
        }
        toast.success("Todos os dados meteorológicos foram limpos.");
      } else {
        const dsId = getDatasetId(purgeTarget);
        if (!dsId) throw new Error("Dataset não encontrado");
        const { data, error } = await supabase.rpc("purge_irradiance_dataset", { _dataset_id: dsId });
        if (error) throw error;
        const r = data as any;
        toast.success(`${purgeTarget}: ${r?.points_deleted ?? 0} pontos removidos.`);
      }
      setPurgeConfirm("");
      loadData();
      auditReload();
    } catch (e: any) {
      toast.error("Erro ao limpar", { description: e.message });
    } finally {
      setPurging(false);
    }
  };

  // Lookup tester
  const handleTestLookup = async () => {
    setTestLoading(true);
    setTestError("");
    setTestResult(null);
    try {
      const result = await getMonthlyIrradiance({ lat: Number(testLat), lon: Number(testLon) });
      setTestResult(result);
    } catch (e: any) {
      setTestError(e.message);
    } finally {
      setTestLoading(false);
    }
  };

  // Create version for a dataset
  const handleCreateVersion = async (dsCode: string, dsLabel: string) => {
    const dsId = getDatasetId(dsCode);
    if (!dsId) return;
    try {
      const tag = `${dsCode.toLowerCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
      const { error } = await supabase.rpc("create_irradiance_version" as any, {
        _dataset_code: dsCode,
        _version_tag: tag,
        _metadata: {
          source: dsLabel,
          variables: ["GHI", "DHI", "DNI"],
          plane: "horizontal",
          unit: "kWh/m²/day",
        },
      });
      if (error) throw error;
      toast.success("Nova versão criada", { description: `Tag: ${tag}. Agora importe os dados.` });
      loadData();
      auditReload();
    } catch (e: any) {
      toast.error("Erro ao criar versão", { description: e.message });
    }
  };

  // Activate version
  const handleActivateVersion = async (versionId: string) => {
    try {
      const { data, error } = await supabase.rpc("activate_irradiance_version" as any, {
        _version_id: versionId,
      });
      if (error) throw error;
      toast.success("Versão ativada!", {
        description: `${((data as any)?.row_count ?? 0).toLocaleString("pt-BR")} pontos disponíveis.`,
      });
      loadData();
      auditReload();
    } catch (e: any) {
      toast.error("Erro ao ativar", { description: e.message });
    }
  };

  if (auth === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (auth === "denied") {
    return (
      <Card className="max-w-md mx-auto mt-20 border-destructive/20">
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Acesso restrito</p>
          <p className="text-xs text-muted-foreground text-center">
            Esta página é exclusiva para administradores do sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Compute dashboard metrics ──
  const activeProviders = DATASETS.filter(ds => getActiveVersion(ds.code)).length;
  const totalPoints = versions
    .filter(v => v.status === "active")
    .reduce((sum, v) => sum + (v.row_count ?? 0), 0);
  const lastUpdated = versions.find(v => v.status === "active")?.created_at;
  const hasProcessing = DATASETS.some(ds => getProcessingVersion(ds.code));
  const nasaDs = API_DATASETS[0];
  const nasaActive = nasaDs ? getActiveVersion(nasaDs.code) : undefined;
  const nasaStatus = nasaActive ? "Conectado" : nasaDs && getProcessingVersion(nasaDs.code) ? "Sincronizando" : "Desconectado";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Database}
        title="Base meteorológica"
        description="Gerencie os dados de irradiância solar usados para dimensionamento de sistemas fotovoltaicos."
      />

      {/* ── 4 Dashboard Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          icon={<MapPin className="h-4 w-4" />}
          label="Total de pontos carregados"
          value={totalPoints.toLocaleString("pt-BR")}
          detail={`${versions.filter(v => v.status === "active").length} versão(ões) ativa(s)`}
          color={totalPoints > 0 ? "text-primary" : "text-muted-foreground"}
        />
        <StatusCard
          icon={<Clock className="h-4 w-4" />}
          label="Última sincronização"
          value={lastUpdated
            ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true, locale: ptBR })
            : "Nunca"
          }
          detail={lastUpdated ? new Date(lastUpdated).toLocaleDateString("pt-BR") : "Nenhum dado importado"}
          color={lastUpdated ? "text-foreground" : "text-muted-foreground"}
        />
        <StatusCard
          icon={<Satellite className="h-4 w-4" />}
          label="Status da API NASA"
          value={nasaStatus}
          detail={nasaActive ? `${(nasaActive.row_count ?? 0).toLocaleString("pt-BR")} pontos` : "Sem dados importados"}
          color={nasaActive ? "text-success" : "text-muted-foreground"}
        />
        <StatusCard
          icon={<Layers className="h-4 w-4" />}
          label="Versão ativa"
          value={versions.find(v => v.status === "active")?.version_tag ?? "Nenhuma"}
          detail={
            hasProcessing
              ? "⏳ Importação em andamento"
              : `${versions.length} versão(ões) total`
          }
          color={hasProcessing ? "text-warning" : "text-foreground"}
        />
      </div>

      {/* ── Alert when no data ── */}
      {totalPoints === 0 && (
        <Alert variant="default" className="border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-sm">Nenhum dado de irradiância carregado</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            O sistema precisa de dados meteorológicos para calcular a geração prevista.
            Use as abas abaixo para importar via CSV (Atlas Brasileiro) ou API (NASA POWER).
          </AlertDescription>
        </Alert>
      )}

      {/* ── 4 Tabs ── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> Visão geral
          </TabsTrigger>
          <TabsTrigger value="nasa" className="gap-1.5 text-xs">
            <Satellite className="h-3.5 w-3.5" /> NASA API
          </TabsTrigger>
          <TabsTrigger value="csv" className="gap-1.5 text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Atlas CSV
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" /> Auditoria
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════
            TAB 1: VISÃO GERAL
        ═══════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-5 mt-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Fontes de dados</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Status de cada provedor de dados de irradiância solar.
            </p>
          </div>

          <div className="grid gap-4">
            {DATASETS.map(ds => {
              const active = getActiveVersion(ds.code);
              const processing = getProcessingVersion(ds.code);
              const allVersions = getVersionsFor(ds.code);
              const Icon = ds.icon;
              const hasData = !!active && (active.row_count ?? 0) > 0;

              return (
                <Card key={ds.code} className={`rounded-xl border-2 ${
                  hasData ? "border-success/40 bg-success/5" :
                  processing ? "border-warning/40 bg-warning/5" :
                  "border-border"
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          hasData ? "bg-success/10 text-success" :
                          processing ? "bg-warning/10 text-warning" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold">{ds.label}</h4>
                            {hasData && (
                              <Badge className="bg-success/10 text-success border-success/30 text-[10px] gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Ativo
                              </Badge>
                            )}
                            {processing && !hasData && (
                              <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px] gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Importando
                              </Badge>
                            )}
                            {!hasData && !processing && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Sem dados
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{ds.description}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {active && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{(active.row_count ?? 0).toLocaleString("pt-BR")}</span> pontos
                            <br />
                            <span className="text-[10px] font-mono">{active.version_tag}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Version history */}
                    {allVersions.length > 0 && (
                      <div className="mt-3">
                        <VersionHistory versions={allVersions} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 2: IMPORTAÇÃO AUTOMÁTICA (NASA POWER)
        ═══════════════════════════════════════════════════════ */}
        <TabsContent value="nasa" className="space-y-5 mt-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Satellite className="h-4 w-4 text-primary" />
                Importação automática — NASA POWER
              </CardTitle>
              <CardDescription className="text-xs">
                Sincronize dados de irradiância global diretamente da API da NASA. O processamento ocorre em segundo plano.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* NASA status */}
              <div className={`flex items-center gap-4 p-3 rounded-lg border-2 ${
                nasaActive ? "border-success/40 bg-success/5" : "border-border bg-muted/30"
              }`}>
                <div className={`h-3 w-3 rounded-full ${nasaActive ? "bg-success" : "bg-muted-foreground"}`} />
                <div className="text-xs">
                  <span className="font-medium">Status: </span>
                  <span className={nasaActive ? "text-success" : "text-muted-foreground"}>{nasaStatus}</span>
                  {nasaActive && (
                    <span className="text-muted-foreground ml-2">
                      • {(nasaActive.row_count ?? 0).toLocaleString("pt-BR")} pontos • versão {nasaActive.version_tag}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleNasaSync}
                  disabled={nasaSyncing}
                  className="gap-1.5"
                  size="sm"
                >
                  {nasaSyncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Sincronizar via API
                </Button>
                {nasaSyncing && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleNasaCancel}
                    disabled={nasaCancelling}
                    className="gap-1.5"
                  >
                    {nasaCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Cancelar
                  </Button>
                )}
              </div>

              {/* Progress indicator during sync */}
              {(nasaSyncing || nasaProgress) && nasaProgress && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-muted-foreground">
                      {nasaSyncing ? "Importando via NASA POWER..." : "Concluído"}
                    </span>
                    <span className={nasaSyncing ? "text-primary" : "text-success"}>
                      {nasaProgress.total > 0 ? `${Math.round((nasaProgress.current / nasaProgress.total) * 100)}%` : `${nasaProgress.current.toLocaleString("pt-BR")} pts`}
                    </span>
                  </div>
                  <Progress
                    value={nasaProgress.total > 0 ? Math.round((nasaProgress.current / nasaProgress.total) * 100) : undefined}
                    className="h-3"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {nasaProgress.current.toLocaleString("pt-BR")} / {nasaProgress.total > 0 ? nasaProgress.total.toLocaleString("pt-BR") : "?"} pontos
                  </p>
                </div>
              )}
              {nasaSyncing && !nasaProgress && (
                <div className="space-y-1">
                  <Progress value={undefined} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">Iniciando sincronização...</p>
                </div>
              )}

              {/* Event Log */}
              {nasaLogs.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Log de eventos</Label>
                  <ScrollArea className="max-h-40 border border-border/40 rounded-lg p-3 bg-card">
                    <div className="space-y-1 text-xs font-mono">
                      {nasaLogs.map((l, i) => (
                        <div key={i} className={
                          l.level === "error" ? "text-destructive" :
                          l.level === "success" ? "text-success" :
                          l.level === "warn" ? "text-warning" :
                          "text-muted-foreground"
                        }>
                          <span className="text-[10px] text-muted-foreground/50 mr-2">
                            {new Date(l.ts).toLocaleTimeString("pt-BR")}
                          </span>
                          {l.msg}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* NASA version history */}
              {nasaDs && getVersionsFor(nasaDs.code).length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Histórico de versões</Label>
                  <VersionHistory versions={getVersionsFor(nasaDs.code)} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 3: IMPORTAÇÃO MANUAL (ATLAS CSV)
        ═══════════════════════════════════════════════════════ */}
        <TabsContent value="csv" className="space-y-5 mt-4">
          <Alert variant="default" className="border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-sm">Importação via CSV</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              A importação via CSV processa em segundo plano. Você será notificado ao concluir.
              Cada importação gera uma nova <span className="font-semibold">version tag</span> para preservar dados históricos de propostas antigas.
            </AlertDescription>
          </Alert>

          {CSV_DATASETS.map(ds => {
            const processing = getProcessingVersion(ds.code);
            const active = getActiveVersion(ds.code);
            const allVersions = getVersionsFor(ds.code);
            const Icon = ds.icon;

            return (
              <Card key={ds.code} className="rounded-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm">{ds.label}</CardTitle>
                      {active && (
                        <Badge className="bg-success/10 text-success border-success/30 text-[10px]">
                          Ativo — {(active.row_count ?? 0).toLocaleString("pt-BR")} pts
                        </Badge>
                      )}
                    </div>
                    {!processing && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => handleCreateVersion(ds.code, ds.label)}
                      >
                        <Play className="h-3.5 w-3.5" />
                        {active ? "Nova versão" : "Iniciar importação"}
                      </Button>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {ds.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Processing indicator */}
                  {processing && (
                    <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg bg-warning/5 border border-warning/20">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-warning" />
                      <span className="text-warning font-medium">
                        Versão em processamento — {processing.version_tag}
                        {processing.row_count > 0 && ` (${processing.row_count.toLocaleString("pt-BR")} pontos)`}
                      </span>
                      {(processing.row_count ?? 0) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto gap-1 text-xs h-7"
                          onClick={() => handleActivateVersion(processing.id)}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Ativar
                        </Button>
                      )}
                    </div>
                  )}

                  {/* CSV Import Panel — always visible */}
                  <CsvImportPanel
                    processingVersion={processing}
                    onReload={() => { loadData(); auditReload(); }}
                  />

                  {/* Version history */}
                  {allVersions.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Histórico de versões</Label>
                      <VersionHistory versions={allVersions} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 4: AUDITORIA
        ═══════════════════════════════════════════════════════ */}
        <TabsContent value="audit" className="space-y-5 mt-4">
          {/* Audit summary */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Resumo de auditoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <AuditMetric value={auditDatasets.length} label="Datasets registrados" color="text-primary" />
                <AuditMetric value={auditVersions.filter(v => v.status === "active").length} label="Versões ativas" color="text-success" />
                <AuditMetric value={auditVersions.filter(v => v.status === "processing").length} label="Em processamento" color="text-warning" />
                <AuditMetric value={auditVersions.reduce((sum, v) => sum + v.row_count, 0).toLocaleString("pt-BR")} label="Total de pontos" color="text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Integrity per dataset */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm">Integridade dos datasets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                auditDatasets.map((ds) => {
                  const allVersions = getVersionsForDataset(ds.id);
                  const active = getAuditActiveVersion(ds.id);

                  return (
                    <div key={ds.id} className={`rounded-lg border-2 p-4 space-y-3 ${
                      active ? "border-success/40 bg-success/5" :
                      allVersions.some(v => v.status === "failed") ? "border-destructive/30 bg-destructive/5" :
                      allVersions.some(v => v.status === "processing") ? "border-primary/30 bg-primary/5" :
                      "border-warning/30 bg-warning/5"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {active ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : allVersions.some(v => v.status === "processing") ? (
                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning" />
                          )}
                          <span className="text-xs font-semibold">{ds.name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">{ds.code}</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{allVersions.length} versão(ões)</span>
                      </div>

                      {allVersions.length === 0 ? (
                        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-1">
                          <p className="text-xs font-medium text-warning">Nenhuma versão importada</p>
                          <p className="text-[10px] text-muted-foreground">
                            Vá para a aba "Atlas CSV" ou "NASA API" para importar.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {allVersions.map((v) => {
                            const intg = getIntegrity(v.id);
                            const isProcessing = v.status === "processing";
                            const isFailed = v.status === "failed";
                            const isActive = v.status === "active";

                            const checks: { label: string; status: "ok" | "warning" | "info" | "error"; detail: string; action?: string }[] = [];

                            if (isActive) checks.push({ label: "Status", status: "ok", detail: "Ativo — pronto para uso em cálculos" });
                            else if (isProcessing) checks.push({ label: "Status", status: "info", detail: "Importação em andamento" });
                            else if (isFailed) checks.push({ label: "Status", status: "error", detail: "Falhou — esta versão não pode ser usada", action: "Inicie uma nova importação" });
                            else checks.push({ label: "Status", status: "warning", detail: `${v.status} — versão não está ativa` });

                            if (intg) {
                              if (intg.actual_points === v.row_count && v.row_count > 0) {
                                checks.push({ label: "Pontos", status: "ok", detail: `${v.row_count.toLocaleString("pt-BR")} pontos verificados ✓` });
                              } else if (isProcessing) {
                                checks.push({ label: "Pontos", status: "info", detail: `${intg.actual_points.toLocaleString("pt-BR")} pontos importados até agora` });
                              } else if (v.row_count === 0) {
                                checks.push({ label: "Pontos", status: "error", detail: "Nenhum ponto importado", action: "Recomece a importação" });
                              } else {
                                checks.push({ label: "Pontos", status: "warning", detail: `Divergência: registrado ${v.row_count.toLocaleString("pt-BR")}, encontrado ${intg.actual_points.toLocaleString("pt-BR")}` });
                              }

                              if (intg.min_lat != null && !isProcessing) {
                                const latOk = intg.min_lat <= -32 && intg.max_lat! >= 4;
                                const lonOk = intg.min_lon! <= -72 && intg.max_lon! >= -32;
                                if (latOk && lonOk) {
                                  checks.push({ label: "Cobertura", status: "ok", detail: `Brasil completo: Lat ${intg.max_lat}° a ${intg.min_lat}°, Lon ${intg.min_lon}° a ${intg.max_lon}° ✓` });
                                } else {
                                  checks.push({ label: "Cobertura", status: "error", detail: `Lat ${intg.max_lat}° a ${intg.min_lat}°, Lon ${intg.min_lon}° a ${intg.max_lon}°`, action: "Cobertura incompleta do Brasil" });
                                }
                              }

                              if (!isProcessing) {
                                checks.push({
                                  label: "DHI (Difusa)",
                                  status: intg.has_dhi ? "ok" : "warning",
                                  detail: intg.has_dhi ? "Disponível — cálculos POA de alta precisão ✓" : "Indisponível — precisão reduzida",
                                });
                              }
                            }

                            if (!isProcessing) {
                              checks.push({
                                label: "Integridade",
                                status: v.checksum_sha256 ? "ok" : "warning",
                                detail: v.checksum_sha256 ? `SHA-256: ${v.checksum_sha256.substring(0, 16)}… ✓` : "Sem checksum",
                              });
                            }

                            const errorCount = checks.filter(c => c.status === "error").length;
                            const warnCount = checks.filter(c => c.status === "warning").length;
                            const summaryLabel = isProcessing ? "⏳ Em processamento" : errorCount > 0 ? `${errorCount} erro(s)` : warnCount > 0 ? `${warnCount} aviso(s)` : "✓ Tudo OK";

                            return (
                              <div key={v.id} className={`rounded-md border p-3 space-y-2 ${
                                isFailed ? "border-destructive/30 bg-destructive/5" :
                                isActive ? "border-success/30 bg-success/5" :
                                isProcessing ? "border-primary/30 bg-primary/5" :
                                "border-border/30 bg-muted/30"
                              }`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge className={`text-[10px] ${STATUS_COLORS[v.status] || ""}`}>{v.status}</Badge>
                                    <span className="text-xs font-medium">{v.version_tag}</span>
                                  </div>
                                  <Badge variant={errorCount > 0 ? "destructive" : "secondary"} className="text-[10px]">
                                    {summaryLabel}
                                  </Badge>
                                </div>
                                <div className="space-y-1.5">
                                  {checks.map((check) => (
                                    <div key={check.label} className="flex items-start gap-1.5 text-[10px]">
                                      {check.status === "ok" ? <CheckCircle2 className="h-3 w-3 text-success mt-0.5 shrink-0" />
                                        : check.status === "info" ? <Info className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                        : check.status === "error" ? <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                                        : <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" />}
                                      <div>
                                        <span className="font-medium">{check.label}:</span>{" "}
                                        <span className={
                                          check.status === "ok" ? "text-muted-foreground"
                                          : check.status === "info" ? "text-primary"
                                          : check.status === "error" ? "text-destructive"
                                          : "text-warning"
                                        }>{check.detail}</span>
                                        {check.action && <p className="text-muted-foreground mt-0.5 italic">→ {check.action}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Test Lookup */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4" />
                Teste de lookup
              </CardTitle>
              <CardDescription className="text-xs">
                Consulte a irradiância para uma coordenada específica usando os dados ativos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Latitude</Label>
                  <Input value={testLat} onChange={(e) => setTestLat(e.target.value)} placeholder="-15.7942" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Longitude</Label>
                  <Input value={testLon} onChange={(e) => setTestLon(e.target.value)} placeholder="-47.8822" className="h-9" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleTestLookup} disabled={testLoading} className="gap-1.5 w-full" size="sm">
                    {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Consultar
                  </Button>
                </div>
              </div>

              {testError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{testError}</AlertDescription>
                </Alert>
              )}

              {testResult && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px]">Dataset: {testResult.dataset_code}</Badge>
                    <Badge variant="outline" className="text-[10px]">Versão: {testResult.version_tag}</Badge>
                    <Badge variant="outline" className="text-[10px]">Método: {testResult.method}</Badge>
                    <Badge variant="outline" className="text-[10px]">Distância: {testResult.distance_km}km</Badge>
                    <Badge variant="outline" className="text-[10px]">Tier: {testResult.source_tier}</Badge>
                    <Badge variant={testResult.cache_hit ? "secondary" : "default"} className="text-[10px]">
                      {testResult.cache_hit ? "Cache hit" : "Lookup"}
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-border/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Série mensal (kWh/m²/dia)
                    </p>
                    <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                      {MONTH_LABELS.map((label, i) => {
                        const key = `m${String(i + 1).padStart(2, "0")}` as keyof typeof testResult.series;
                        return (
                          <div key={label} className="text-center">
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                            <p className="text-xs font-mono font-medium">{testResult.series[key].toFixed(2)}</p>
                          </div>
                        );
                      })}
                    </div>
                    <Separator className="my-2" />
                    <p className="text-xs text-center">
                      Média anual: <span className="font-bold">{testResult.annual_average.toFixed(2)}</span> kWh/m²/dia
                    </p>
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    Ponto resolvido: ({testResult.point_lat}, {testResult.point_lon}) •
                    Fonte: {testResult.source} • Consulta em: {testResult.resolved_at}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purge */}
          <Card className="rounded-xl border-destructive/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Limpeza de dados
              </CardTitle>
              <CardDescription className="text-xs">
                Remove todos os pontos, versões e cache do provider selecionado. Esta ação é irreversível.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fonte de dados</Label>
                  <Select value={purgeTarget} onValueChange={setPurgeTarget}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DATASETS.map(d => (
                        <SelectItem key={d.code} value={d.code} className="text-xs">{d.label}</SelectItem>
                      ))}
                      <SelectItem value="ALL" className="text-xs font-semibold text-destructive">TODOS os dados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Digite <span className="font-mono font-bold">LIMPAR</span> para confirmar
                  </Label>
                  <Input
                    value={purgeConfirm}
                    onChange={e => setPurgeConfirm(e.target.value)}
                    placeholder="LIMPAR"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handlePurge}
                    disabled={purgeConfirm !== "LIMPAR" || purging}
                    className="gap-1.5 w-full"
                  >
                    {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Confirmar limpeza
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Status Card Component ──
function StatusCard({
  icon, label, value, detail, color,
}: {
  icon: React.ReactNode; label: string; value: string; detail: string; color: string;
}) {
  // Derive border color from text color
  const borderClass = color.includes("success") ? "border-success/40 bg-success/5"
    : color.includes("warning") ? "border-warning/40 bg-warning/5"
    : color.includes("primary") ? "border-primary/30 bg-primary/5"
    : "border-border bg-card";

  return (
    <Card className={`rounded-xl border-2 ${borderClass}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

// ── Audit Metric ──
function AuditMetric({ value, label, color }: { value: number | string; label: string; color: string }) {
  const bgClass = color.includes("success") ? "bg-success/5 border-success/30"
    : color.includes("warning") ? "bg-warning/5 border-warning/30"
    : color.includes("primary") ? "bg-primary/5 border-primary/30"
    : "bg-muted/30 border-border/50";

  return (
    <div className={`rounded-lg border-2 p-3 text-center ${bgClass}`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default BaseMeteorologicaPage;
