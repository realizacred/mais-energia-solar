/**
 * BaseMeteorologicaPage — Admin-only page for managing irradiance providers & versions.
 *
 * 3 cards (one per provider/dataset), each with:
 *   - Status of active version + point count
 *   - Create version (processing)
 *   - Import via CSV (Atlas) or API (NASA)
 *   - Activate version
 *   - Test lookup (Brasília)
 *
 * Global purge via RPC (purge_irradiance_dataset).
 * Auth: requires admin or super_admin role.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Database,
  Globe,
  Loader2,
  Sun,
  Trash2,
  Upload,
  Play,
  Search,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Zap,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Constants ────────────────────────────────────────────
const DATASETS = [
  {
    code: "INPE_2017_SUNDATA",
    label: "Atlas Brasileiro 2ª Edição (INPE 2017 / SUNDATA / CRESESB)",
    type: "csv" as const,
    icon: Sun,
    description: "Irradiância solar horizontal (GHI/DHI/DNI) — resolução 0.1° (~10km). Importação via CSV com merge de 3 arquivos.",
  },
  {
    code: "INPE_2009_10KM",
    label: "Brazil Solar Global 10km (INPE 2009)",
    type: "csv" as const,
    icon: Globe,
    description: "Grade brasileira de irradiância com resolução 10km. Importação via CSV.",
  },
  {
    code: "NASA_POWER_GLOBAL",
    label: "NASA POWER — Global Solar Resource",
    type: "api" as const,
    icon: Zap,
    description: "Irradiância global via API NASA POWER (CERES/SSE). Sincronização por API — não utiliza CSV do Atlas.",
  },
] as const;

const BRASILIA = { lat: -15.7942, lon: -47.8822 };

type DatasetCode = (typeof DATASETS)[number]["code"];

interface VersionRow {
  id: string;
  dataset_id: string;
  version_tag: string;
  status: string;
  row_count: number;
  metadata: any;
  created_at: string;
}

interface DatasetRow {
  id: string;
  code: string;
  name: string;
}

// ── Auth Guard ───────────────────────────────────────────
function useAdminGuard() {
  const [state, setState] = useState<"loading" | "authorized" | "denied">("loading");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState("denied"); return; }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdmin = roles?.some((r: any) =>
        ["admin", "super_admin", "gerente"].includes(r.role)
      );
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

  useEffect(() => { if (auth === "authorized") loadData(); }, [auth, loadData]);

  const getDatasetId = (code: string) => datasets.find(d => d.code === code)?.id;
  const getVersionsFor = (code: string) => {
    const dsId = getDatasetId(code);
    return dsId ? versions.filter(v => v.dataset_id === dsId) : [];
  };
  const getActiveVersion = (code: string) => getVersionsFor(code).find(v => v.status === "active");
  const getProcessingVersion = (code: string) => getVersionsFor(code).find(v => v.status === "processing");

  // Purge handler
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
    } catch (e: any) {
      toast.error("Erro ao limpar", { description: e.message });
    } finally {
      setPurging(false);
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

  return (
    <div className="space-y-5">
      {/* ── Header + Global Purge ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Database className="h-4 w-4" />
            Base Meteorológica — Providers & Versionamento
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie datasets de irradiância, versões e importações por provider.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Limpar dados meteorológicos
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar dados meteorológicos</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>Esta ação remove pontos, versões e cache do provider selecionado.</p>
                <div className="space-y-2">
                  <Label className="text-xs">Provider</Label>
                  <Select value={purgeTarget} onValueChange={setPurgeTarget}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATASETS.map(d => (
                        <SelectItem key={d.code} value={d.code} className="text-xs">{d.label}</SelectItem>
                      ))}
                      <SelectItem value="ALL" className="text-xs font-semibold">TODOS os providers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Digite LIMPAR para confirmar</Label>
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
      </div>

      <Separator />

      {/* ── Provider Cards ── */}
      <div className="grid gap-5">
        {DATASETS.map(ds => (
          <ProviderCard
            key={ds.code}
            config={ds}
            datasetId={getDatasetId(ds.code)}
            versions={getVersionsFor(ds.code)}
            activeVersion={getActiveVersion(ds.code)}
            processingVersion={getProcessingVersion(ds.code)}
            onReload={loadData}
          />
        ))}
      </div>
    </div>
  );
}

// ── Provider Card ────────────────────────────────────────
interface ProviderCardProps {
  config: (typeof DATASETS)[number];
  datasetId: string | undefined;
  versions: VersionRow[];
  activeVersion: VersionRow | undefined;
  processingVersion: VersionRow | undefined;
  onReload: () => void;
}

function ProviderCard({ config, datasetId, versions, activeVersion, processingVersion, onReload }: ProviderCardProps) {
  const Icon = config.icon;
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState("");
  const [apiLoading, setApiLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState("");

  // ── Create Version ──
  const handleCreateVersion = async () => {
    if (!datasetId) return;
    setCreating(true);
    try {
      const tag = `${config.code.toLowerCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
      const { error } = await supabase.from("irradiance_dataset_versions").insert({
        dataset_id: datasetId,
        version_tag: tag,
        status: "processing",
        row_count: 0,
        metadata: {
          source: config.label,
          variables: config.type === "csv" ? ["GHI", "DHI", "DNI"] : ["GHI"],
          plane: "horizontal",
          unit: "kWh/m²/day",
        },
      });
      if (error) throw error;
      toast.success("Versão criada (processing)", { description: tag });
      onReload();
    } catch (e: any) {
      toast.error("Erro ao criar versão", { description: e.message });
    } finally {
      setCreating(false);
    }
  };

  // ── Activate Version ──
  const handleActivateVersion = async () => {
    const proc = processingVersion;
    if (!proc) return;
    setActivating(true);
    try {
      // Check row count > 0
      const { data: ver } = await supabase
        .from("irradiance_dataset_versions")
        .select("row_count")
        .eq("id", proc.id)
        .single();
      if (!ver || ver.row_count <= 0) {
        toast.error("Versão sem dados. Importe pontos antes de ativar.");
        setActivating(false);
        return;
      }

      // Archive current active
      if (activeVersion) {
        await supabase
          .from("irradiance_dataset_versions")
          .update({ status: "archived" })
          .eq("id", activeVersion.id);
      }

      const { error } = await supabase
        .from("irradiance_dataset_versions")
        .update({
          status: "active",
          metadata: { ...(proc.metadata || {}), activated_at: new Date().toISOString() },
        })
        .eq("id", proc.id);
      if (error) throw error;
      toast.success("Versão ativada com sucesso!");
      onReload();
    } catch (e: any) {
      toast.error("Erro ao ativar", { description: e.message });
    } finally {
      setActivating(false);
    }
  };

  // ── Test Lookup ──
  const handleTestLookup = async () => {
    const ver = activeVersion;
    if (!ver) { toast.error("Nenhuma versão ativa para testar."); return; }
    setTesting(true);
    setTestResult(null);
    setTestError("");
    try {
      const { data, error } = await supabase.rpc("get_irradiance_for_simulation", {
        _version_id: ver.id,
        _lat: BRASILIA.lat,
        _lon: BRASILIA.lon,
        _radius_deg: 0.3,
      });
      if (error) throw error;
      setTestResult(data);
    } catch (e: any) {
      setTestError(e.message);
    } finally {
      setTesting(false);
    }
  };

  // ── NASA API Stubs ──
  const handleNasaApiCall = async (action: "sync" | "activate-latest" | "lookup") => {
    setApiLoading(true);
    setApiMessage("");
    try {
      if (action === "sync") {
        // Try the existing Edge Function first
        const versionTag = `v${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        const { data, error } = await supabase.functions.invoke("irradiance-fetch", {
          body: { dataset_code: "NASA_POWER_GLOBAL", version_tag: versionTag, step_deg: 1 },
        });
        if (error) {
          const msg = String(error?.message ?? "").toLowerCase();
          if (msg.includes("function not found") || msg.includes("404") || msg.includes("relay error") || msg.includes("boot error")) {
            setApiMessage("⚠️ Edge Function 'irradiance-fetch' não está deployada. Deploy necessário.");
            return;
          }
          throw error;
        }
        if (data?.error === "VERSION_EXISTS") {
          setApiMessage(`ℹ️ ${data.message}`);
          return;
        }
        if (data?.error === "VERSION_PROCESSING") {
          setApiMessage(`ℹ️ ${data.message}`);
          return;
        }
        setApiMessage(`✅ Sincronização iniciada. version_id: ${data?.version_id ?? "—"}`);
        onReload();
      } else if (action === "activate-latest") {
        // Find latest processing version and activate
        const proc = processingVersion;
        if (!proc) {
          setApiMessage("⚠️ Nenhuma versão em 'processing' encontrada. Sincronize primeiro.");
          return;
        }
        await handleActivateVersion();
        setApiMessage("✅ Versão ativada.");
      } else if (action === "lookup") {
        await handleTestLookup();
        setApiMessage("Resultado do lookup renderizado abaixo.");
      }
    } catch (e: any) {
      setApiMessage(`❌ Erro: ${e.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-success/10 text-success border-success/30",
      processing: "bg-warning/10 text-warning border-warning/30",
      failed: "bg-destructive/10 text-destructive border-destructive/30",
      archived: "bg-muted text-muted-foreground border-border",
    };
    return map[status] || "bg-muted text-muted-foreground border-border";
  };

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">{config.description}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {config.code}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 pt-0 space-y-4">
        {/* ── Status ── */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {activeVersion ? (
            <>
              <Badge className={`${statusBadge("active")} text-[10px]`}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Ativa: {activeVersion.version_tag}
              </Badge>
              <span className="text-muted-foreground">
                {(activeVersion.row_count ?? 0).toLocaleString("pt-BR")} pontos
              </span>
            </>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              <AlertTriangle className="h-3 w-3 mr-1" /> Sem versão ativa
            </Badge>
          )}
          {processingVersion && (
            <Badge className={`${statusBadge("processing")} text-[10px]`}>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing: {processingVersion.version_tag}
            </Badge>
          )}
        </div>

        <Separator />

        {/* ── Actions ── */}
        {config.type === "csv" ? (
          <CsvProviderActions
            datasetCode={config.code}
            datasetId={datasetId}
            processingVersion={processingVersion}
            creating={creating}
            activating={activating}
            testing={testing}
            testResult={testResult}
            testError={testError}
            onCreateVersion={handleCreateVersion}
            onActivateVersion={handleActivateVersion}
            onTestLookup={handleTestLookup}
            onReload={onReload}
            activeVersion={activeVersion}
          />
        ) : (
          <NasaApiActions
            apiLoading={apiLoading}
            apiMessage={apiMessage}
            testing={testing}
            testResult={testResult}
            testError={testError}
            onApiCall={handleNasaApiCall}
            onTestLookup={handleTestLookup}
            activeVersion={activeVersion}
          />
        )}

        {/* ── Version History ── */}
        {versions.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Histórico de Versões ({versions.length})
            </p>
            <ScrollArea className="max-h-32">
              <div className="space-y-1">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-muted/30">
                    <span className="font-mono">{v.version_tag}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{(v.row_count ?? 0).toLocaleString("pt-BR")} pts</span>
                      <Badge className={`${statusBadge(v.status)} text-[9px] px-1.5 py-0`}>{v.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── CSV Provider Actions ─────────────────────────────────
interface CsvActionsProps {
  datasetCode: string;
  datasetId: string | undefined;
  processingVersion: VersionRow | undefined;
  activeVersion: VersionRow | undefined;
  creating: boolean;
  activating: boolean;
  testing: boolean;
  testResult: any;
  testError: string;
  onCreateVersion: () => void;
  onActivateVersion: () => void;
  onTestLookup: () => void;
  onReload: () => void;
}

function CsvProviderActions({
  datasetCode, datasetId, processingVersion, activeVersion,
  creating, activating, testing, testResult, testError,
  onCreateVersion, onActivateVersion, onTestLookup, onReload,
}: CsvActionsProps) {
  const [csvFiles, setCsvFiles] = useState<{ ghi: File | null; dhi: File | null; dni: File | null }>({ ghi: null, dhi: null, dni: null });
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importLog, setImportLog] = useState<string[]>([]);

  const log = (msg: string) => setImportLog(prev => [...prev, `[${new Date().toLocaleTimeString("pt-BR")}] ${msg}`]);

  const handleCsvImport = async () => {
    const ver = processingVersion;
    if (!ver) { toast.error("Crie uma versão (processing) antes de importar."); return; }
    if (!csvFiles.ghi) { toast.error("Arquivo GHI é obrigatório."); return; }

    setImporting(true);
    setImportProgress(0);
    setImportLog([]);

    try {
      log("Lendo arquivos CSV...");
      const ghiData = await readAndParseCsv(await csvFiles.ghi.text(), "GHI");
      const dhiData = csvFiles.dhi ? await readAndParseCsv(await csvFiles.dhi.text(), "DHI") : null;
      const dniData = csvFiles.dni ? await readAndParseCsv(await csvFiles.dni.text(), "DNI") : null;

      log(`GHI: ${ghiData.length} pontos`);
      if (dhiData) log(`DHI: ${dhiData.length} pontos`);
      if (dniData) log(`DNI: ${dniData.length} pontos`);

      // Merge by lat/lon
      const merged = mergeByLatLon(ghiData, dhiData, dniData);
      log(`Merged: ${merged.length} pontos únicos`);

      // Send in chunks
      const CHUNK = 500;
      const total = merged.length;
      for (let i = 0; i < total; i += CHUNK) {
        const chunk = merged.slice(i, i + CHUNK);
        const { error } = await supabase.rpc("import_irradiance_points_chunk" as any, {
          _version_id: ver.id,
          _points: chunk,
        });
        if (error) throw new Error(`Chunk ${Math.floor(i / CHUNK) + 1}: ${error.message}`);
        const pct = Math.round(((i + chunk.length) / total) * 100);
        setImportProgress(pct);
        log(`Chunk ${Math.floor(i / CHUNK) + 1}: ${chunk.length} pontos enviados (${pct}%)`);
      }

      log("✅ Importação completa!");
      toast.success(`${total.toLocaleString("pt-BR")} pontos importados com sucesso.`);
      onReload();
    } catch (e: any) {
      log(`❌ Erro: ${e.message}`);
      toast.error("Falha na importação", { description: e.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onCreateVersion}
          disabled={creating || !!processingVersion}
          className="gap-1.5 text-xs"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Criar Versão (processing)
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onActivateVersion}
          disabled={activating || !processingVersion}
          className="gap-1.5 text-xs"
        >
          {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Ativar Versão
        </Button>

        <Button
          size="sm"
          variant="soft"
          onClick={onTestLookup}
          disabled={testing || !activeVersion}
          className="gap-1.5 text-xs"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
          Testar Brasília
        </Button>
      </div>

      {/* CSV Import */}
      <div className="border border-border/60 rounded-lg p-3 space-y-2 bg-muted/20">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Importar via CSV (GHI / DHI / DNI)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["ghi", "dhi", "dni"] as const).map(key => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] uppercase font-semibold text-muted-foreground">
                {key.toUpperCase()} {key === "ghi" ? "*" : "(opcional)"}
              </Label>
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={e => setCsvFiles(prev => ({ ...prev, [key]: e.target.files?.[0] || null }))}
                className="h-7 text-[10px] file:text-[10px]"
                disabled={importing}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleCsvImport}
            disabled={importing || !processingVersion || !csvFiles.ghi}
            className="gap-1.5 text-xs"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {importing ? `Importando ${importProgress}%...` : "Importar Pontos"}
          </Button>
          {!processingVersion && (
            <span className="text-[10px] text-muted-foreground">Crie uma versão primeiro</span>
          )}
        </div>
        {importLog.length > 0 && (
          <ScrollArea className="max-h-24 mt-2 border border-border/40 rounded p-2 bg-card">
            <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground">
              {importLog.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </ScrollArea>
        )}
      </div>

      <TestResultDisplay result={testResult} error={testError} />
    </div>
  );
}

// ── NASA API Actions ─────────────────────────────────────
interface NasaActionsProps {
  apiLoading: boolean;
  apiMessage: string;
  testing: boolean;
  testResult: any;
  testError: string;
  onApiCall: (action: "sync" | "activate-latest" | "lookup") => void;
  onTestLookup: () => void;
  activeVersion: VersionRow | undefined;
}

function NasaApiActions({ apiLoading, apiMessage, testing, testResult, testError, onApiCall, activeVersion }: NasaActionsProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => onApiCall("sync")}
          disabled={apiLoading}
          className="gap-1.5 text-xs"
        >
          {apiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sincronizar por API
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => onApiCall("activate-latest")}
          disabled={apiLoading}
          className="gap-1.5 text-xs"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Ativar Versão Mais Recente
        </Button>

        <Button
          size="sm"
          variant="soft"
          onClick={() => onApiCall("lookup")}
          disabled={apiLoading || !activeVersion}
          className="gap-1.5 text-xs"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Testar Lookup (Brasília)
        </Button>
      </div>

      {apiMessage && (
        <div className="text-xs p-2 rounded bg-muted/50 border border-border/40 font-mono whitespace-pre-wrap">
          {apiMessage}
        </div>
      )}

      <TestResultDisplay result={testResult} error={testError} />
    </div>
  );
}

// ── Test Result Display ──────────────────────────────────
function TestResultDisplay({ result, error }: { result: any; error: string }) {
  if (error) {
    return (
      <div className="p-2 rounded bg-destructive/5 border border-destructive/20 text-xs text-destructive">
        ❌ {error}
      </div>
    );
  }
  if (!result) return null;
  return (
    <div className="p-2 rounded bg-muted/30 border border-border/40">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        Resultado — Brasília ({BRASILIA.lat}, {BRASILIA.lon})
      </p>
      <ScrollArea className="max-h-40">
        <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  );
}

// ── CSV Parsing Helpers ──────────────────────────────────
interface ParsedPoint {
  lat: number;
  lon: number;
  months: number[];
}

function readAndParseCsv(content: string, label: string): ParsedPoint[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error(`${label}: arquivo vazio`);

  const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

  const latIdx = headers.findIndex(h => h === "lat" || h === "latitude");
  const lonIdx = headers.findIndex(h => h === "lon" || h === "lng" || h === "longitude");
  if (latIdx < 0 || lonIdx < 0) throw new Error(`${label}: colunas LAT/LON não encontradas`);

  const MONTH_MAP: Record<string, number> = {
    jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
    m01: 0, m02: 1, m03: 2, m04: 3, m05: 4, m06: 5, m07: 6, m08: 7, m09: 8, m10: 9, m11: 10, m12: 11,
  };

  const monthCols: { idx: number; month: number }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const m = MONTH_MAP[headers[i]];
    if (m !== undefined) monthCols.push({ idx: i, month: m });
  }
  if (monthCols.length !== 12) throw new Error(`${label}: esperado 12 colunas de meses, encontrado ${monthCols.length}`);
  monthCols.sort((a, b) => a.month - b.month);

  const rows: ParsedPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    if (cols.length < 14) continue;
    try {
      const lat = parseFloat(cols[latIdx].trim().replace(",", "."));
      const lon = parseFloat(cols[lonIdx].trim().replace(",", "."));
      const months = monthCols.map(mc => parseFloat(cols[mc.idx].trim().replace(",", ".")));
      if (isNaN(lat) || isNaN(lon) || months.some(isNaN)) continue;
      rows.push({ lat, lon, months });
    } catch { continue; }
  }
  return rows;
}

function mergeByLatLon(ghi: ParsedPoint[], dhi: ParsedPoint[] | null, dni: ParsedPoint[] | null) {
  const key = (p: ParsedPoint) => `${p.lat.toFixed(4)}|${p.lon.toFixed(4)}`;
  const dhiMap = new Map(dhi?.map(p => [key(p), p.months]) || []);
  const dniMap = new Map(dni?.map(p => [key(p), p.months]) || []);

  return ghi.map(p => {
    const k = key(p);
    const dhiMonths = dhiMap.get(k);
    const dniMonths = dniMap.get(k);
    return {
      lat: p.lat,
      lon: p.lon,
      m01: p.months[0], m02: p.months[1], m03: p.months[2], m04: p.months[3],
      m05: p.months[4], m06: p.months[5], m07: p.months[6], m08: p.months[7],
      m09: p.months[8], m10: p.months[9], m11: p.months[10], m12: p.months[11],
      unit: "kWh/m²/day",
      plane: "horizontal",
      ...(dhiMonths ? {
        dhi_m01: dhiMonths[0], dhi_m02: dhiMonths[1], dhi_m03: dhiMonths[2], dhi_m04: dhiMonths[3],
        dhi_m05: dhiMonths[4], dhi_m06: dhiMonths[5], dhi_m07: dhiMonths[6], dhi_m08: dhiMonths[7],
        dhi_m09: dhiMonths[8], dhi_m10: dhiMonths[9], dhi_m11: dhiMonths[10], dhi_m12: dhiMonths[11],
      } : {}),
      ...(dniMonths ? {
        dni_m01: dniMonths[0], dni_m02: dniMonths[1], dni_m03: dniMonths[2], dni_m04: dniMonths[3],
        dni_m05: dniMonths[4], dni_m06: dniMonths[5], dni_m07: dniMonths[6], dni_m08: dniMonths[7],
        dni_m09: dniMonths[8], dni_m10: dniMonths[9], dni_m11: dniMonths[10], dni_m12: dniMonths[11],
      } : {}),
    };
  });
}

export default BaseMeteorologicaPage;
