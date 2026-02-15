import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Database, Search, CheckCircle2, AlertTriangle, Info,
  Globe, Hash, Calendar, Loader2, Sun, MapPin, Download, RefreshCw, Upload,
} from "lucide-react";
import { useIrradianceDatasets } from "@/hooks/useIrradianceDatasets";
import { getMonthlyIrradiance, type IrradianceLookupResult } from "@/services/irradiance-provider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImportJobTracker } from "./ImportJobTracker";
import { loadRecentImportJobs, type ImportJob } from "@/services/solar-datasets-api";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/10 text-success border-success/30",
  deprecated: "bg-muted text-muted-foreground border-border",
  processing: "bg-warning/10 text-warning border-warning/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
};

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function generateVersionTag(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `v${y}.${m}`;
}

export function IrradianciaPage() {
  const { datasets, versions, loading, reload, getVersionsForDataset, getActiveVersion, getIntegrity } = useIrradianceDatasets();
  const location = useLocation();
  const defaultTab = location.pathname.includes("auditoria") ? "audit" : "datasets";
  const [tab, setTab] = useState(defaultTab);

  // ── Async import jobs (persisted in DB, loaded on mount) ──
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [fetchingDs, setFetchingDs] = useState<string | null>(null);
  const [notDeployedError, setNotDeployedError] = useState(false);

  // Track versions being imported (for polling)
  const [importingVersions, setImportingVersions] = useState<Map<string, { versionId: string; datasetCode: string }>>(new Map());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted jobs from database on mount
  useEffect(() => {
    loadRecentImportJobs(20).then((jobs) => {
      if (jobs.length > 0) setImportJobs(jobs);
    });
  }, []);

  // Poll for processing versions
  useEffect(() => {
    if (importingVersions.size === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const poll = async () => {
      for (const [key, { versionId, datasetCode }] of importingVersions) {
        const { data } = await supabase
          .from("irradiance_dataset_versions")
          .select("id, status, row_count, metadata")
          .eq("id", versionId)
          .single();

        if (!data) continue;

        if (data.status === "active") {
          toast.success("✅ Importação concluída!", {
            description: `${datasetCode}: ${(data.row_count ?? 0).toLocaleString("pt-BR")} pontos importados com sucesso.`,
            duration: 10000,
          });
          setImportingVersions((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
          reload();
        } else if (data.status === "failed") {
          const meta = data.metadata as Record<string, unknown> | null;
          toast.error("❌ Importação falhou", {
            description: `${datasetCode}: ${(meta?.error as string) || "Erro durante o processamento."}`,
            duration: 10000,
          });
          setImportingVersions((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
          reload();
        }
        // Still processing — update progress display
      }
    };

    pollingRef.current = setInterval(poll, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [importingVersions, reload]);

  // Also check for already-processing versions on mount
  useEffect(() => {
    const checkExisting = async () => {
      const { data } = await supabase
        .from("irradiance_dataset_versions")
        .select("id, dataset_id, status")
        .eq("status", "processing");

      if (data && data.length > 0) {
        const map = new Map<string, { versionId: string; datasetCode: string }>();
        for (const v of data) {
          const ds = datasets.find((d) => d.id === v.dataset_id);
          if (ds) {
            map.set(v.id, { versionId: v.id, datasetCode: ds.code });
          }
        }
        if (map.size > 0) setImportingVersions(map);
      }
    };
    if (datasets.length > 0) checkExisting();
  }, [datasets]);

  // Trigger NASA POWER fetch — kicks off first chunk, then edge function self-chains
  const handleFetchDataset = async (datasetCode: string) => {
    setFetchingDs(datasetCode);
    setNotDeployedError(false);

    const versionTag = `v${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    try {
      const { data, error } = await supabase.functions.invoke("irradiance-fetch", {
        body: {
          dataset_code: datasetCode,
          version_tag: versionTag,
          step_deg: 1,
        },
      });

      if (error) {
        const msg = String(error?.message ?? "").toLowerCase();
        if (msg.includes("function not found") || msg.includes("404") || msg.includes("relay error") || msg.includes("boot error")) {
          setNotDeployedError(true);
          return;
        }
        throw error;
      }

      const versionId = data.version_id;

      toast.success("Importação iniciada em segundo plano", {
        description: `${datasetCode}: O processamento continuará automaticamente. Você pode navegar para outras páginas.`,
        duration: 8000,
      });

      // Start polling this version
      setImportingVersions((prev) => {
        const next = new Map(prev);
        next.set(versionId, { versionId, datasetCode });
        return next;
      });
    } catch (e: any) {
      toast.error("❌ Falha ao iniciar importação", { description: e.message, duration: 8000 });
    } finally {
      setFetchingDs(null);
    }
  };

  // CSV upload state
  const [uploadDs, setUploadDs] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lookup test state
  const [testLat, setTestLat] = useState("-15.7942");
  const [testLon, setTestLon] = useState("-47.8822");
  const [testResult, setTestResult] = useState<IrradianceLookupResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState("");

  // Update job in list when poll returns new data
  const handleJobUpdate = useCallback((updatedJob: ImportJob) => {
    setImportJobs((prev) =>
      prev.map((j) => (j.job_id === updatedJob.job_id ? updatedJob : j))
    );
    // Reload datasets when a job finishes successfully
    if (updatedJob.status === "success") {
      reload();
    }
  }, [reload]);

  const handleTestLookup = async () => {
    setTestLoading(true);
    setTestError("");
    setTestResult(null);
    try {
      const result = await getMonthlyIrradiance({
        lat: Number(testLat),
        lon: Number(testLon),
      });
      setTestResult(result);
    } catch (e: any) {
      setTestError(e.message);
    } finally {
      setTestLoading(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!uploadFile || !uploadDs) {
      toast.error("Selecione um dataset e um arquivo CSV.");
      return;
    }
    setUploading(true);
    try {
      const versionTag = generateVersionTag();
      const filePath = `uploads/${uploadDs}/${versionTag}_${uploadFile.name}`;

      const { error: storageError } = await supabase.storage
        .from("irradiance-source")
        .upload(filePath, uploadFile, { upsert: true });

      if (storageError) throw storageError;

      const { data, error } = await supabase.functions.invoke("irradiance-import", {
        body: {
          dataset_code: uploadDs,
          version_tag: versionTag,
          source_note: `Upload manual: ${uploadFile.name}`,
          file_path: filePath,
        },
      });

      if (error) throw error;

      toast.success(
        `Importação concluída: ${data?.row_count?.toLocaleString() ?? 0} pontos importados`
      );
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      reload();
    } catch (e: any) {
      toast.error("Erro na importação CSV", { description: e.message });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="datasets" className="gap-1.5">
            <Database className="h-3.5 w-3.5" /> Datasets & Versões
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Importar Arquivo
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <Search className="h-3.5 w-3.5" /> Auditoria & Teste
          </TabsTrigger>
        </TabsList>

        {/* ── Datasets Tab ── */}
        <TabsContent value="datasets" className="space-y-4 mt-4">
          {notDeployedError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Backend import service (solar-dataset-import) não está implantado.
                  </p>
                  <p className="text-xs text-destructive/80 mt-1">
                    A Edge Function <code className="text-[10px] bg-destructive/10 px-1 py-0.5 rounded">solar-dataset-import</code> precisa
                    ser criada e implantada no Supabase antes de usar a importação via API.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Verifique em{" "}
                    <span className="font-mono text-[10px]">supabase/functions/solar-dataset-import/</span>{" "}
                    ou contate o administrador do sistema.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setNotDeployedError(false)}
              >
                Dispensar
              </Button>
            </div>
          )}

          <div className="rounded-lg border border-info/30 bg-info/5 p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-foreground">
                Clique em <strong>"Importar da API"</strong> para buscar dados automaticamente da NASA POWER API.
                A atualização automática ocorre a cada 6 meses.
              </p>
              <p className="text-[10px] text-muted-foreground">
                🌍 <strong>Dados globais</strong> — Os dados de irradiância são compartilhados entre todas as empresas da plataforma.
                Apenas administradores podem importar, auditar e corrigir esses dados.
              </p>
            </div>
          </div>

          {datasets.map((ds) => {
            const dsVersions = getVersionsForDataset(ds.id);
            const activeVersion = getActiveVersion(ds.id);
            const isFetching = fetchingDs === ds.code;

            return (
              <Card key={ds.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{ds.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{ds.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">{ds.code}</Badge>
                      <Button
                        size="sm"
                        variant={activeVersion ? "outline" : "default"}
                        className="gap-1.5 text-xs h-8"
                        disabled={!!fetchingDs}
                        onClick={() => handleFetchDataset(ds.code)}
                      >
                        {isFetching ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : activeVersion ? (
                          <RefreshCw className="h-3.5 w-3.5" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        {isFetching
                          ? "Importando..."
                          : activeVersion
                          ? "Atualizar"
                          : "Importar da API"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(isFetching || importingVersions.has(
                    versions.find(v => v.dataset_id === ds.id && v.status === "processing")?.id ?? ""
                  )) && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <p className="text-xs text-primary font-medium">
                          {isFetching
                            ? "⏳ Iniciando importação via NASA POWER API…"
                            : "Importação em andamento em segundo plano…"}
                        </p>
                      </div>
                      <p className="text-[10px] text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Você pode navegar para outras páginas. Será notificado quando concluir.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 text-[10px]">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Globe className="h-3 w-3" /> {ds.provider}
                    </div>
                    {ds.resolution_km && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {ds.resolution_km}km
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Sun className="h-3 w-3" /> {ds.default_unit}
                    </div>
                  </div>

                  {dsVersions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma versão importada ainda. Clique em "Importar da API" acima.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Versões</p>
                      {dsVersions.map((v) => (
                        <div key={v.id} className="flex items-center justify-between rounded-lg border border-border/50 p-2.5">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] ${STATUS_COLORS[v.status] || ""}`}>
                              {v.status}
                            </Badge>
                            <span className="text-xs font-medium">{v.version_tag}</span>
                            {v.source_note && (
                              <span className="text-[10px] text-muted-foreground">— {v.source_note}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" /> {v.row_count.toLocaleString()} pontos
                            </span>
                            {v.checksum_sha256 && (
                              <span className="font-mono" title={v.checksum_sha256}>
                                SHA: {v.checksum_sha256.substring(0, 8)}…
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(v.ingested_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* ── Import Jobs ── */}
          <ImportJobTracker jobs={importJobs} onJobUpdate={handleJobUpdate} />
        </TabsContent>

        {/* ── Upload CSV Tab ── */}
        <TabsContent value="upload" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importar Arquivo CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Faça upload de um arquivo CSV com colunas <code className="text-[10px] bg-muted px-1 py-0.5 rounded">lat</code>, <code className="text-[10px] bg-muted px-1 py-0.5 rounded">lon</code>, <code className="text-[10px] bg-muted px-1 py-0.5 rounded">m01</code>…<code className="text-[10px] bg-muted px-1 py-0.5 rounded">m12</code> (valores em kWh/m²/dia).
                Separadores aceitos: vírgula ou ponto-e-vírgula.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Dataset</Label>
                  <Select value={uploadDs} onValueChange={setUploadDs}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map((ds) => (
                        <SelectItem key={ds.id} value={ds.code}>{ds.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Arquivo CSV</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    className="text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleCsvUpload}
                    disabled={uploading || !uploadFile || !uploadDs}
                    className="gap-1.5 w-full"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Importando..." : "Enviar e Importar"}
                  </Button>
                </div>
              </div>

              {uploadFile && (
                <div className="text-[10px] text-muted-foreground">
                  Arquivo: <span className="font-medium">{uploadFile.name}</span> ({(uploadFile.size / 1024).toFixed(1)} KB)
                  • Versão será gerada automaticamente: <Badge variant="outline" className="text-[10px]">{generateVersionTag()}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Audit & Test Tab ── */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          {/* Audit summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resumo de Auditoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{datasets.length}</p>
                  <p className="text-[10px] text-muted-foreground">Datasets Registrados</p>
                </div>
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {versions.filter((v) => v.status === "active").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Versões Ativas</p>
                </div>
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-2xl font-bold text-warning">
                    {versions.filter((v) => v.status === "processing").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Em Processamento</p>
                </div>
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {versions.reduce((sum, v) => sum + v.row_count, 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Total de Pontos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integrity per dataset/version */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Integridade dos Datasets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {datasets.map((ds) => {
                const allVersions = getVersionsForDataset(ds.id);
                const active = getActiveVersion(ds.id);

                // Expected Brazil bounds: lat +6 to -34, lon -74 to -34
                const BRAZIL_LAT_MIN = -34;
                const BRAZIL_LAT_MAX = 6;
                const BRAZIL_LON_MIN = -74;
                const BRAZIL_LON_MAX = -34;

                return (
                  <div key={ds.id} className="rounded-lg border border-border/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {active ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        )}
                        <span className="text-xs font-semibold">{ds.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">{ds.code}</Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{allVersions.length} versão(ões)</span>
                    </div>

                    {allVersions.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Nenhuma versão importada — dataset sem dados.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allVersions.map((v) => {
                          const intg = getIntegrity(v.id);
                          const checks: { label: string; ok: boolean; detail: string }[] = [];

                          // 1. Status check
                          checks.push({
                            label: "Status",
                            ok: v.status === "active",
                            detail: v.status === "active" ? "Ativo" : v.status === "processing" ? "Em processamento (incompleto)" : v.status,
                          });

                          // 2. Row count match
                          if (intg) {
                            checks.push({
                              label: "Contagem",
                              ok: intg.actual_points === v.row_count,
                              detail: intg.actual_points === v.row_count
                                ? `${v.row_count.toLocaleString()} pontos ✓`
                                : `Registrado: ${v.row_count.toLocaleString()}, Real: ${intg.actual_points.toLocaleString()}`,
                            });
                          }

                          // 3. Geographic coverage
                          if (intg && intg.min_lat != null) {
                            const latOk = intg.min_lat <= BRAZIL_LAT_MIN + 2 && intg.max_lat! >= BRAZIL_LAT_MAX - 2;
                            const lonOk = intg.min_lon! <= BRAZIL_LON_MIN + 2 && intg.max_lon! >= BRAZIL_LON_MAX + 2;
                            checks.push({
                              label: "Cobertura Lat",
                              ok: latOk,
                              detail: `${intg.max_lat}° a ${intg.min_lat}° ${latOk ? "✓" : `(esperado: ${BRAZIL_LAT_MAX}° a ${BRAZIL_LAT_MIN}°)`}`,
                            });
                            checks.push({
                              label: "Cobertura Lon",
                              ok: lonOk,
                              detail: `${intg.min_lon}° a ${intg.max_lon}° ${lonOk ? "✓" : `(esperado: ${BRAZIL_LON_MIN}° a ${BRAZIL_LON_MAX}°)`}`,
                            });
                          }

                          // 4. DHI availability
                          if (intg) {
                            checks.push({
                              label: "DHI (Difusa)",
                              ok: intg.has_dhi,
                              detail: intg.has_dhi ? "Dados DHI presentes ✓" : "⚠ Sem dados DHI — cálculos POA usarão estimativa",
                            });
                          }

                          // 5. SHA integrity
                          checks.push({
                            label: "SHA-256",
                            ok: !!v.checksum_sha256,
                            detail: v.checksum_sha256 ? `${v.checksum_sha256.substring(0, 16)}…` : "Sem checksum",
                          });

                          const failCount = checks.filter((c) => !c.ok).length;

                          return (
                            <div key={v.id} className="rounded-md border border-border/30 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-[10px] ${STATUS_COLORS[v.status] || ""}`}>{v.status}</Badge>
                                  <span className="text-xs font-medium">{v.version_tag}</span>
                                </div>
                                <Badge variant={failCount === 0 ? "secondary" : "destructive"} className="text-[10px]">
                                  {failCount === 0 ? "✓ Tudo OK" : `${failCount} problema${failCount > 1 ? "s" : ""}`}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                {checks.map((check) => (
                                  <div key={check.label} className="flex items-start gap-1.5 text-[10px]">
                                    {check.ok ? (
                                      <CheckCircle2 className="h-3 w-3 text-success mt-0.5 shrink-0" />
                                    ) : (
                                      <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" />
                                    )}
                                    <div>
                                      <span className="font-medium">{check.label}:</span>{" "}
                                      <span className={check.ok ? "text-muted-foreground" : "text-warning"}>
                                        {check.detail}
                                      </span>
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
              })}
            </CardContent>
          </Card>

          {/* Test Lookup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4" />
                Teste de Lookup
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
                    <Badge variant={testResult.cache_hit ? "secondary" : "default"} className="text-[10px]">
                      {testResult.cache_hit ? "Cache Hit" : "Lookup"}
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-border/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Série Mensal ({testResult.unit})
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
                      Média anual: <span className="font-bold">{testResult.annual_average.toFixed(2)}</span> {testResult.unit}
                    </p>
                  </div>

                  <div className="text-[10px] text-muted-foreground">
                    Ponto resolvido: ({testResult.point_lat}, {testResult.point_lon}) •
                    Consulta em: {testResult.resolved_at}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default IrradianciaPage;
