import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Database, Upload, Search, CheckCircle2, AlertTriangle,
  Globe, Hash, Calendar, Loader2, Sun, MapPin, Download, Zap,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useIrradianceDatasets } from "@/hooks/useIrradianceDatasets";
import { getMonthlyIrradiance, type IrradianceLookupResult } from "@/services/irradiance-provider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/10 text-success border-success/30",
  deprecated: "bg-muted text-muted-foreground border-border",
  processing: "bg-warning/10 text-warning border-warning/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
};

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function IrradianciaPage() {
  const { datasets, versions, loading, reload, getVersionsForDataset, getActiveVersion } = useIrradianceDatasets();
  const [tab, setTab] = useState("datasets");

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDatasetCode, setImportDatasetCode] = useState("");
  const [importVersionTag, setImportVersionTag] = useState("");
  const [importNote, setImportNote] = useState("");
  const [importing, setImporting] = useState(false);

  // Auto-fetch state
  const [fetchDatasetCode, setFetchDatasetCode] = useState("");
  const [fetchVersionTag, setFetchVersionTag] = useState("");
  const [fetchStep, setFetchStep] = useState("1");
  const [fetching, setFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);

  // Lookup test state
  const [testLat, setTestLat] = useState("-15.7942");
  const [testLon, setTestLon] = useState("-47.8822");
  const [testResult, setTestResult] = useState<IrradianceLookupResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState("");

  const handleImport = async () => {
    if (!importFile || !importDatasetCode || !importVersionTag) {
      toast.error("Preencha todos os campos de importação");
      return;
    }

    setImporting(true);
    try {
      // Upload file to storage
      const filePath = `imports/${importDatasetCode}/${importVersionTag}/${importFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("irradiance-source")
        .upload(filePath, importFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Call edge function to process
      const { data, error } = await supabase.functions.invoke("irradiance-import", {
        body: {
          dataset_code: importDatasetCode,
          version_tag: importVersionTag,
          source_note: importNote,
          file_path: filePath,
        },
      });

      if (error) throw error;

      toast.success(`Importação iniciada: ${data?.row_count ?? 0} pontos processados`);
      reload();
      setImportFile(null);
      setImportVersionTag("");
      setImportNote("");
    } catch (e: any) {
      toast.error("Erro na importação", { description: e.message });
    } finally {
      setImporting(false);
    }
  };

  const handleAutoFetch = async () => {
    if (!fetchDatasetCode || !fetchVersionTag) {
      toast.error("Selecione o dataset e informe a tag da versão");
      return;
    }
    setFetching(true);
    setFetchProgress("Buscando dados via NASA POWER API... Isso pode levar alguns minutos.");
    try {
      const { data, error } = await supabase.functions.invoke("irradiance-fetch", {
        body: {
          dataset_code: fetchDatasetCode,
          version_tag: fetchVersionTag,
          step_deg: Number(fetchStep) || 1,
        },
      });

      if (error) throw error;

      toast.success(
        `Importação concluída: ${data?.row_count?.toLocaleString() ?? 0} pontos importados` +
          (data?.errors ? ` (${data.errors} erros)` : "")
      );
      setFetchProgress(null);
      reload();
    } catch (e: any) {
      toast.error("Erro na importação automática", { description: e.message });
      setFetchProgress(null);
    } finally {
      setFetching(false);
    }
  };

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
          <TabsTrigger value="import" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Importar
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <Search className="h-3.5 w-3.5" /> Auditoria & Teste
          </TabsTrigger>
        </TabsList>

        {/* ── Datasets Tab ── */}
        <TabsContent value="datasets" className="space-y-4 mt-4">
          {datasets.map((ds) => {
            const dsVersions = getVersionsForDataset(ds.id);
            const activeVersion = getActiveVersion(ds.id);

            return (
              <Card key={ds.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{ds.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{ds.description}</p>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">{ds.code}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
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
                    <p className="text-xs text-muted-foreground italic">Nenhuma versão importada.</p>
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
        </TabsContent>

        {/* ── Import Tab ── */}
        <TabsContent value="import" className="space-y-4 mt-4">
          {/* Auto-fetch from API */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                Importar via API (Automático)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Busca dados de irradiância automaticamente da <strong>NASA POWER API</strong> para todo o território brasileiro.
                Os dados são inseridos diretamente no banco sem necessidade de arquivo CSV.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Dataset</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={fetchDatasetCode}
                    onChange={(e) => setFetchDatasetCode(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {datasets.map((ds) => (
                      <option key={ds.code} value={ds.code}>{ds.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tag da Versão</Label>
                  <Input
                    placeholder="ex: v1-nasa-2024"
                    value={fetchVersionTag}
                    onChange={(e) => setFetchVersionTag(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Resolução (graus)</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={fetchStep}
                    onChange={(e) => setFetchStep(e.target.value)}
                  >
                    <option value="2">2° (~220km, rápido ~150 pontos)</option>
                    <option value="1">1° (~110km, ~3.000 pontos)</option>
                    <option value="0.5">0.5° (~55km, ~12.000 pontos)</option>
                  </select>
                </div>
              </div>

              {fetchProgress && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <p className="text-xs text-primary font-medium">{fetchProgress}</p>
                  </div>
                  <Progress className="h-1.5" />
                </div>
              )}

              <Button onClick={handleAutoFetch} disabled={fetching || !fetchDatasetCode || !fetchVersionTag} className="gap-1.5">
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {fetching ? "Importando da API..." : "Buscar da NASA POWER API"}
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Manual CSV import */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importar via Arquivo CSV (Manual)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Dataset</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={importDatasetCode}
                    onChange={(e) => setImportDatasetCode(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {datasets.map((ds) => (
                      <option key={ds.code} value={ds.code}>{ds.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tag da Versão</Label>
                  <Input
                    placeholder="ex: v1, 2017-2ed"
                    value={importVersionTag}
                    onChange={(e) => setImportVersionTag(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notas de Origem</Label>
                <Input
                  placeholder="Descrição da origem dos dados..."
                  value={importNote}
                  onChange={(e) => setImportNote(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Arquivo CSV</Label>
                <p className="text-[10px] text-muted-foreground">
                  Formato esperado: lat, lon, m01, m02, ..., m12 (valores em kWh/m²/dia). Separador: vírgula ou ponto-e-vírgula.
                </p>
                <Input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
              </div>

              <Button onClick={handleImport} disabled={importing || !importFile} className="gap-1.5">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? "Processando..." : "Iniciar Importação CSV"}
              </Button>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <p className="text-2xl font-bold text-primary">
                    {versions.reduce((sum, v) => sum + v.row_count, 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Total de Pontos</p>
                </div>
              </div>
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

          {/* Integrity checks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Integridade dos Datasets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {datasets.map((ds) => {
                  const active = getActiveVersion(ds.id);
                  const allVersions = getVersionsForDataset(ds.id);
                  return (
                    <div key={ds.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                      <div className="flex items-center gap-2">
                        {active ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        )}
                        <span className="text-xs font-medium">{ds.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{allVersions.length} versão(ões)</span>
                        {active && (
                          <>
                            <span>•</span>
                            <span className="font-mono">SHA: {active.checksum_sha256?.substring(0, 12) || "—"}</span>
                            <span>•</span>
                            <span>{active.row_count.toLocaleString()} pontos</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default IrradianciaPage;
