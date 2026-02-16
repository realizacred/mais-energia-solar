/**
 * BaseMeteorologicaPage — Unified admin page for managing solar irradiance data.
 * 
 * Combines:
 * - Dashboard summary (total points, active providers, health status)
 * - Provider cards with visual progress and clear status
 * - Audit & integrity checks per dataset/version
 * - Full lookup tester with coordinate input
 * - Auto-cleanup of stuck versions
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Search, Info,
} from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProviderCard } from "./base-meteorologica/ProviderCard";
import type { DatasetConfig, DatasetRow, VersionRow } from "./base-meteorologica/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIrradianceDatasets, getExpectedPoints, isVersionStalled } from "@/hooks/useIrradianceDatasets";
import { getMonthlyIrradiance, type IrradianceLookupResult } from "@/services/irradiance-provider";

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

  // Audit hook for integrity checks
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
  const healthPct = Math.round((activeProviders / DATASETS.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Database}
        title="Base meteorológica"
        description="Gerencie os dados de irradiância solar usados para calcular a geração prevista dos sistemas fotovoltaicos."
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Limpar dados
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar dados meteorológicos</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>Esta ação remove todos os pontos, versões e cache do provider selecionado.</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Fonte de dados</Label>
                    <Select value={purgeTarget} onValueChange={setPurgeTarget}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DATASETS.map(d => (
                          <SelectItem key={d.code} value={d.code} className="text-xs">{d.label}</SelectItem>
                        ))}
                        <SelectItem value="ALL" className="text-xs font-semibold text-destructive">TODOS os dados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Digite <span className="font-mono font-bold">LIMPAR</span> para confirmar</Label>
                    <Input
                      value={purgeConfirm}
                      onChange={e => setPurgeConfirm(e.target.value)}
                      placeholder="LIMPAR"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handlePurge}
                  disabled={purgeConfirm !== "LIMPAR" || purging}
                  className="bg-destructive text-destructive-foreground text-xs"
                >
                  {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar limpeza"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      {/* ── Dashboard Summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Status geral"
          value={
            activeProviders === DATASETS.length
              ? "Operacional"
              : activeProviders > 0
                ? "Parcial"
                : "Sem dados"
          }
          detail={`${activeProviders}/${DATASETS.length} fontes ativas`}
          color={activeProviders === DATASETS.length ? "text-success" : activeProviders > 0 ? "text-warning" : "text-destructive"}
          progress={healthPct}
        />
        <DashboardCard
          icon={<MapPin className="h-4 w-4" />}
          label="Pontos geográficos"
          value={totalPoints.toLocaleString("pt-BR")}
          detail="pontos de irradiância carregados"
          color={totalPoints > 0 ? "text-primary" : "text-muted-foreground"}
        />
        <DashboardCard
          icon={<Clock className="h-4 w-4" />}
          label="Última atualização"
          value={lastUpdated
            ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true, locale: ptBR })
            : "Nunca"
          }
          detail={lastUpdated ? new Date(lastUpdated).toLocaleDateString("pt-BR") : "Nenhum dado importado"}
          color={lastUpdated ? "text-foreground" : "text-muted-foreground"}
        />
        <DashboardCard
          icon={<Layers className="h-4 w-4" />}
          label="Versões"
          value={String(versions.length)}
          detail={
            hasProcessing
              ? "⏳ Importação em andamento"
              : `${versions.filter(v => v.status === "active").length} ativa(s)`
          }
          color={hasProcessing ? "text-warning" : "text-foreground"}
        />
      </div>

      {/* ── Alert when no data ── */}
      {totalPoints === 0 && (
        <Card className="border-warning/30 bg-warning/5 rounded-xl">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Nenhum dado de irradiância carregado</p>
              <p className="text-xs text-muted-foreground mt-1">
                O sistema precisa de dados meteorológicos para calcular a geração prevista dos sistemas solares.
                Importe dados de pelo menos uma fonte abaixo para habilitar os cálculos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabs: Fontes de Dados | Auditoria & Teste ── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <Database className="h-3.5 w-3.5" /> Fontes de dados
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs">
            <Search className="h-3.5 w-3.5" /> Auditoria & teste
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: Fontes de Dados ── */}
        <TabsContent value="overview" className="space-y-5 mt-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Fontes de dados</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cada fonte fornece dados de irradiância solar de diferentes provedores. Você pode ter múltiplas fontes ativas simultaneamente.
            </p>
          </div>

          <div className="grid gap-5">
            {DATASETS.map(ds => (
              <ProviderCard
                key={ds.code}
                config={ds}
                datasetId={getDatasetId(ds.code)}
                versions={getVersionsFor(ds.code)}
                activeVersion={getActiveVersion(ds.code)}
                processingVersion={getProcessingVersion(ds.code)}
                onReload={() => { loadData(); auditReload(); }}
              />
            ))}
          </div>
        </TabsContent>

        {/* ── TAB: Auditoria & Teste ── */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          {/* Audit summary */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm">Resumo de auditoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <AuditMetric value={auditDatasets.length} label="Datasets registrados" color="text-primary" />
                <AuditMetric value={auditVersions.filter(v => v.status === "active").length} label="Versões ativas" color="text-primary" />
                <AuditMetric value={auditVersions.filter(v => v.status === "processing").length} label="Em processamento" color="text-warning" />
                <AuditMetric value={auditVersions.reduce((sum, v) => sum + v.row_count, 0).toLocaleString("pt-BR")} label="Total de pontos" color="text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Integrity per dataset/version */}
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
                    <div key={ds.id} className="rounded-lg border border-border/50 p-4 space-y-3">
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
                            Vá para a aba "Fontes de dados" para importar.
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
                              <div key={v.id} className="rounded-md border border-border/30 p-3 space-y-2">
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
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Latitude</Label>
                  <Input value={testLat} onChange={(e) => setTestLat(e.target.value)} placeholder="-15.7942" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Longitude</Label>
                  <Input value={testLon} onChange={(e) => setTestLon(e.target.value)} placeholder="-47.8822" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleTestLookup} disabled={testLoading} className="gap-1.5 w-full">
                    {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Consultar
                  </Button>
                </div>
              </div>

              {testError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <p className="text-xs text-destructive">{testError}</p>
                </div>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Dashboard Card Component ──
function DashboardCard({
  icon, label, value, detail, color, progress,
}: {
  icon: React.ReactNode; label: string; value: string; detail: string; color: string; progress?: number;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        {progress !== undefined && <Progress value={progress} className="h-1.5" />}
        <p className="text-[11px] text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

// ── Audit Metric ──
function AuditMetric({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="rounded-lg border border-border/50 p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default BaseMeteorologicaPage;
