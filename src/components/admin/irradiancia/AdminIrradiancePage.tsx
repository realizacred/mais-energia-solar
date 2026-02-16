import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2, AlertTriangle, Loader2,
  Play, Upload, FileText, X, Search, Zap, Shield,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────

interface LogEntry {
  ts: number;
  level: "info" | "warn" | "error" | "success";
  msg: string;
}

// ─── CSV Helpers ─────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  m01: 1, m02: 2, m03: 3, m04: 4, m05: 5, m06: 6,
  m07: 7, m08: 8, m09: 9, m10: 10, m11: 11, m12: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function parseNumber(val: string): number {
  const cleaned = val.trim().replace(",", ".");
  const n = parseFloat(cleaned);
  if (isNaN(n)) throw new Error(`Valor não numérico: "${val}"`);
  return n;
}

interface CsvRow {
  lat: number;
  lon: number;
  months: number[];
}

function parseCsvContent(content: string, fileName: string): { rows: CsvRow[]; unitDetected: string } {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error(`${fileName}: arquivo vazio ou apenas cabeçalho`);

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

  const latIdx = headers.findIndex(h => h === "lat" || h === "latitude");
  const lonIdx = headers.findIndex(h => h === "lon" || h === "lng" || h === "longitude");
  if (latIdx < 0 || lonIdx < 0) throw new Error(`${fileName}: colunas LAT/LON não encontradas. Headers: ${headers.join(", ")}`);

  const monthCols: { idx: number; month: number }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const m = MONTH_MAP[headers[i]];
    if (m !== undefined) monthCols.push({ idx: i, month: m });
  }
  if (monthCols.length !== 12) {
    throw new Error(`${fileName}: esperado 12 colunas de meses, encontrado ${monthCols.length}. Headers: ${headers.join(", ")}`);
  }
  monthCols.sort((a, b) => a.month - b.month);

  const rows: CsvRow[] = [];
  const allValues: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    if (cols.length < Math.max(latIdx, lonIdx, ...monthCols.map(m => m.idx)) + 1) continue;

    try {
      const lat = parseNumber(cols[latIdx]);
      const lon = parseNumber(cols[lonIdx]);
      const months = monthCols.map(mc => parseNumber(cols[mc.idx]));

      if (lat < -40 || lat > 12 || lon < -80 || lon > -30) continue;
      if (months.some(v => isNaN(v))) continue;

      allValues.push(...months);
      rows.push({ lat, lon, months });
    } catch {
      // skip invalid
    }
  }

  const avg = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
  const unitDetected = avg > 50 ? "Wh/m²/dia → kWh" : "kWh/m²/dia";

  if (avg > 50) {
    for (const r of rows) {
      r.months = r.months.map(v => v / 1000);
    }
  }

  return { rows, unitDetected };
}

function makeKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)}|${lon.toFixed(4)}`;
}

interface MergedPoint {
  lat: number; lon: number;
  m01: number; m02: number; m03: number; m04: number; m05: number; m06: number;
  m07: number; m08: number; m09: number; m10: number; m11: number; m12: number;
  dhi_m01: number; dhi_m02: number; dhi_m03: number; dhi_m04: number; dhi_m05: number; dhi_m06: number;
  dhi_m07: number; dhi_m08: number; dhi_m09: number; dhi_m10: number; dhi_m11: number; dhi_m12: number;
  dni_m01: number; dni_m02: number; dni_m03: number; dni_m04: number; dni_m05: number; dni_m06: number;
  dni_m07: number; dni_m08: number; dni_m09: number; dni_m10: number; dni_m11: number; dni_m12: number;
  unit: string;
}

function mergeFiles(ghiRows: CsvRow[], dhiRows: CsvRow[], dniRows: CsvRow[]): MergedPoint[] {
  const dhiMap = new Map<string, CsvRow>();
  for (const r of dhiRows) dhiMap.set(makeKey(r.lat, r.lon), r);

  const dniMap = new Map<string, CsvRow>();
  for (const r of dniRows) dniMap.set(makeKey(r.lat, r.lon), r);

  const points: MergedPoint[] = [];
  for (const ghi of ghiRows) {
    const k = makeKey(ghi.lat, ghi.lon);
    const dhi = dhiMap.get(k);
    const dni = dniMap.get(k);

    points.push({
      lat: ghi.lat, lon: ghi.lon,
      m01: ghi.months[0], m02: ghi.months[1], m03: ghi.months[2],
      m04: ghi.months[3], m05: ghi.months[4], m06: ghi.months[5],
      m07: ghi.months[6], m08: ghi.months[7], m09: ghi.months[8],
      m10: ghi.months[9], m11: ghi.months[10], m12: ghi.months[11],
      dhi_m01: dhi?.months[0] ?? 0, dhi_m02: dhi?.months[1] ?? 0, dhi_m03: dhi?.months[2] ?? 0,
      dhi_m04: dhi?.months[3] ?? 0, dhi_m05: dhi?.months[4] ?? 0, dhi_m06: dhi?.months[5] ?? 0,
      dhi_m07: dhi?.months[6] ?? 0, dhi_m08: dhi?.months[7] ?? 0, dhi_m09: dhi?.months[8] ?? 0,
      dhi_m10: dhi?.months[9] ?? 0, dhi_m11: dhi?.months[10] ?? 0, dhi_m12: dhi?.months[11] ?? 0,
      dni_m01: dni?.months[0] ?? 0, dni_m02: dni?.months[1] ?? 0, dni_m03: dni?.months[2] ?? 0,
      dni_m04: dni?.months[3] ?? 0, dni_m05: dni?.months[4] ?? 0, dni_m06: dni?.months[5] ?? 0,
      dni_m07: dni?.months[6] ?? 0, dni_m08: dni?.months[7] ?? 0, dni_m09: dni?.months[8] ?? 0,
      dni_m10: dni?.months[9] ?? 0, dni_m11: dni?.months[10] ?? 0, dni_m12: dni?.months[11] ?? 0,
      unit: "kwh_m2_day",
    });
  }

  return points;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
    reader.readAsText(file);
  });
}

function generateVersionTag(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `atlas-import-${y}${m}${d}-${h}${min}`;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Constants ───────────────────────────────────────────────

const CHUNK_SIZE = 500;
const MAX_RETRIES = 3;

const DATASET_OPTIONS = [
  { code: "INPE_2017_SUNDATA", label: "INPE 2017 (SunData)" },
  { code: "INPE_2009_10KM", label: "INPE 2009 (10km)" },
  { code: "NASA_POWER_GLOBAL", label: "NASA POWER Global" },
];

// ─── Component ───────────────────────────────────────────────

type ImportState = "idle" | "parsing" | "validated" | "uploading" | "done" | "error";

interface ValidationResult {
  ghiCount: number;
  dhiCount: number;
  dniCount: number;
  mergedCount: number;
  unitDetected: string;
  keysMatch: boolean;
  keysDiffPct: number;
  samplePoints: { lat: number; lon: number; jan: number; dec: number }[];
}

export function CsvImportPanel() {
  const { user } = useAuth();

  // ── Version ──
  const [datasetCode, setDatasetCode] = useState("INPE_2017_SUNDATA");
  const [versionTag, setVersionTag] = useState(generateVersionTag);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [creatingVersion, setCreatingVersion] = useState(false);

  // ── Import ──
  const [ghiFile, setGhiFile] = useState<File | null>(null);
  const [dhiFile, setDhiFile] = useState<File | null>(null);
  const [dniFile, setDniFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [state, setState] = useState<ImportState>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pointsLoaded, setPointsLoaded] = useState<number | null>(null);
  const abortRef = useRef(false);

  // ── Activate ──
  const [activateResult, setActivateResult] = useState<{ row_count: number } | null>(null);
  const [activating, setActivating] = useState(false);

  const allFilesSelected = !!ghiFile && !!dhiFile && !!dniFile;
  const canImport = allFilesSelected && versionId && validation && state === "validated";

  const log = useCallback((level: LogEntry["level"], msg: string) => {
    setLogs(prev => [...prev, { ts: Date.now(), level, msg }]);
  }, []);

  // ── Step 1: Create Version ──
  const createVersion = async () => {
    setCreatingVersion(true);
    try {
      const metadata = {
        source: "ATLAS/CEPEL/SUNDATA",
        variables: ["GHI", "DHI", "DNI"],
        plane: "horizontal",
        unit: "kwh_m2_day",
        imported_by: user?.id ?? "unknown",
      };

      const { data, error } = await supabase.rpc("create_irradiance_version", {
        _dataset_code: datasetCode,
        _version_tag: versionTag,
        _metadata: metadata,
      });

      if (error) throw error;
      setVersionId(data as string);
      toast.success("Versão criada", { description: `ID: ${data}` });
    } catch (e: any) {
      toast.error("Erro ao criar versão", { description: e.message });
    } finally {
      setCreatingVersion(false);
    }
  };

  // ── Step 2: Validate Files ──
  const validateFiles = async () => {
    if (!ghiFile || !dhiFile || !dniFile) return;
    setState("parsing");
    setLogs([]);
    setValidation(null);

    try {
      log("info", "Lendo arquivos CSV...");
      const [ghiText, dhiText, dniText] = await Promise.all([
        readFileAsText(ghiFile),
        readFileAsText(dhiFile),
        readFileAsText(dniFile),
      ]);

      const ghi = parseCsvContent(ghiText, "GHI.csv");
      const dhi = parseCsvContent(dhiText, "DHI.csv");
      const dni = parseCsvContent(dniText, "DNI.csv");

      log("info", `GHI: ${ghi.rows.length} pontos (${ghi.unitDetected})`);
      log("info", `DHI: ${dhi.rows.length} pontos (${dhi.unitDetected})`);
      log("info", `DNI: ${dni.rows.length} pontos (${dni.unitDetected})`);

      const ghiKeys = new Set(ghi.rows.map(r => makeKey(r.lat, r.lon)));
      const dhiKeys = new Set(dhi.rows.map(r => makeKey(r.lat, r.lon)));
      const dniKeys = new Set(dni.rows.map(r => makeKey(r.lat, r.lon)));

      const intersection = [...ghiKeys].filter(k => dhiKeys.has(k) && dniKeys.has(k));
      const maxKeys = Math.max(ghiKeys.size, dhiKeys.size, dniKeys.size);
      const diffPct = maxKeys > 0 ? ((maxKeys - intersection.length) / maxKeys) * 100 : 0;
      const keysMatch = diffPct <= 0.5;

      if (!keysMatch) {
        log("warn", `⚠️ Divergência de ${diffPct.toFixed(1)}% entre coordenadas!`);
      } else {
        log("success", `✅ Coordenadas compatíveis (${intersection.length} comuns)`);
      }

      const merged = mergeFiles(ghi.rows, dhi.rows, dni.rows);
      const samplePoints = merged.slice(0, 3).map(p => ({
        lat: p.lat, lon: p.lon, jan: p.m01, dec: p.m12,
      }));

      log("success", `${merged.length} pontos mesclados. Prontos para importar.`);

      setValidation({
        ghiCount: ghi.rows.length,
        dhiCount: dhi.rows.length,
        dniCount: dni.rows.length,
        mergedCount: merged.length,
        unitDetected: ghi.unitDetected,
        keysMatch,
        keysDiffPct: diffPct,
        samplePoints,
      });
      setState("validated");
    } catch (e: any) {
      log("error", `Erro: ${e.message}`);
      setState("error");
    }
  };

  // ── Step 3: Import ──
  const importNow = async () => {
    if (!ghiFile || !dhiFile || !dniFile || !versionId) return;
    abortRef.current = false;
    setState("uploading");
    setPointsLoaded(null);

    try {
      log("info", "Re-parseando e mesclando arquivos...");
      const [ghiText, dhiText, dniText] = await Promise.all([
        readFileAsText(ghiFile),
        readFileAsText(dhiFile),
        readFileAsText(dniFile),
      ]);

      const ghi = parseCsvContent(ghiText, "GHI.csv");
      const dhi = parseCsvContent(dhiText, "DHI.csv");
      const dni = parseCsvContent(dniText, "DNI.csv");
      const points = mergeFiles(ghi.rows, dhi.rows, dni.rows);

      if (points.length === 0) {
        log("error", "Nenhum ponto válido após mesclagem.");
        setState("error");
        return;
      }

      const chunks = chunkArray(points, CHUNK_SIZE);
      setProgress({ current: 0, total: points.length });
      log("info", `Enviando ${points.length.toLocaleString("pt-BR")} pontos em ${chunks.length} chunks...`);

      for (let i = 0; i < chunks.length; i++) {
        if (abortRef.current) {
          log("warn", "Importação cancelada pelo usuário.");
          setState("error");
          return;
        }

        let success = false;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          const { error } = await supabase.rpc("import_irradiance_points_chunk", {
            _version_id: versionId,
            _rows: chunks[i] as any,
          });

          if (!error) {
            success = true;
            break;
          }

          if (attempt < MAX_RETRIES - 1) {
            const wait = (attempt + 1) * 1000;
            log("warn", `Chunk ${i + 1} falhou (tentativa ${attempt + 1}/${MAX_RETRIES}): ${error.message}. Retentando em ${wait}ms...`);
            await new Promise(r => setTimeout(r, wait));
          } else {
            log("error", `Chunk ${i + 1}/${chunks.length} falhou após ${MAX_RETRIES} tentativas: ${error.message}`);
            setState("error");
            return;
          }
        }

        const sent = Math.min((i + 1) * CHUNK_SIZE, points.length);
        setProgress({ current: sent, total: points.length });

        if (i % 10 === 0 || i === chunks.length - 1) {
          log("info", `Chunk ${i + 1}/${chunks.length} OK (${sent.toLocaleString("pt-BR")} pontos)`);
        }

        await new Promise(r => setTimeout(r, 10));
      }

      log("success", `✅ Todos os ${points.length.toLocaleString("pt-BR")} pontos enviados!`);

      log("info", "Verificando contagem no banco...");
      const { count } = await supabase
        .from("irradiance_points_monthly")
        .select("id", { count: "exact", head: true })
        .eq("version_id", versionId);

      setPointsLoaded(count ?? 0);
      log("success", `Confirmado no banco: ${(count ?? 0).toLocaleString("pt-BR")} pontos para esta versão.`);

      setState("done");
      toast.success("Upload concluído!", {
        description: `${(count ?? 0).toLocaleString("pt-BR")} pontos carregados.`,
      });
    } catch (e: any) {
      log("error", `Erro: ${e.message}`);
      setState("error");
    }
  };

  // ── Step 4: Activate ──
  const activateVersion = async () => {
    if (!versionId) return;

    if (pointsLoaded === 0 || pointsLoaded === null) {
      toast.error("Não é possível ativar com 0 pontos carregados.");
      return;
    }

    setActivating(true);
    try {
      const { data, error } = await supabase.rpc("activate_irradiance_version", {
        _version_id: versionId,
      });

      if (error) throw error;
      const res = data as any;
      setActivateResult({ row_count: res?.row_count ?? pointsLoaded ?? 0 });
      toast.success("Versão ativada!", { description: `${(res?.row_count ?? 0).toLocaleString("pt-BR")} pontos.` });
      log("success", `✅ Versão ativada! row_count=${res?.row_count}`);
    } catch (e: any) {
      toast.error("Erro ao ativar", { description: e.message });
      log("error", `Ativação falhou: ${e.message}`);
    } finally {
      setActivating(false);
    }
  };

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ═══════════ STEP 1: Create Version ═══════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            1. Criar Nova Versão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Selecione o dataset e crie uma versão antes de importar os arquivos CSV.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 max-w-[200px]">
              <Label className="text-xs">Dataset</Label>
              <Select value={datasetCode} onValueChange={setDatasetCode} disabled={!!versionId}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATASET_OPTIONS.map(d => (
                    <SelectItem key={d.code} value={d.code} className="text-xs">{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 max-w-xs">
              <Label className="text-xs">Version Tag</Label>
              <Input
                value={versionTag}
                onChange={e => setVersionTag(e.target.value)}
                disabled={!!versionId}
                className="font-mono text-xs h-9"
              />
            </div>
          </div>

          {versionId ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-success/10 text-success border-success/30 gap-1 font-mono text-[10px]">
                <CheckCircle2 className="h-3 w-3" /> {versionId}
              </Badge>
            </div>
          ) : (
            <Button
              onClick={createVersion}
              disabled={creatingVersion}
              size="sm"
              className="gap-1.5"
            >
              {creatingVersion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Criar Versão
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ STEP 2: Import 3 CSV ═══════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            2. Importar 3 CSV (GHI / DHI / DNI)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Envie os 3 arquivos separados do Atlas Brasileiro (global_horizontal, diffuse, direct_normal).
            Formato: colunas <code className="text-[10px] bg-muted px-1 py-0.5 rounded">LAT;LON;JAN;FEB;…;DEC</code>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FileInput label="GHI (Global Horizontal)" file={ghiFile} onSelect={setGhiFile} disabled={state === "uploading"} />
            <FileInput label="DHI (Diffuse Horizontal)" file={dhiFile} onSelect={setDhiFile} disabled={state === "uploading"} />
            <FileInput label="DNI (Direct Normal)" file={dniFile} onSelect={setDniFile} disabled={state === "uploading"} />
          </div>

          <Separator />

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={validateFiles}
              disabled={!allFilesSelected || state === "uploading"}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              {state === "parsing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Validar Arquivos
            </Button>

            {canImport && (
              <Button onClick={importNow} size="sm" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Importar Agora
              </Button>
            )}

            {state === "uploading" && (
              <Button variant="destructive" size="sm" onClick={() => { abortRef.current = true; }} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
            )}
          </div>

          {validation && (
            <div className="rounded-md border border-border p-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><span className="text-muted-foreground">GHI:</span> {validation.ghiCount.toLocaleString("pt-BR")} pts</div>
                <div><span className="text-muted-foreground">DHI:</span> {validation.dhiCount.toLocaleString("pt-BR")} pts</div>
                <div><span className="text-muted-foreground">DNI:</span> {validation.dniCount.toLocaleString("pt-BR")} pts</div>
                <div><span className="text-muted-foreground">Mesclados:</span> {validation.mergedCount.toLocaleString("pt-BR")} pts</div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <span>Unidade: <strong>{validation.unitDetected}</strong></span>
                <span>
                  Keys: {validation.keysMatch ? (
                    <Badge variant="outline" className="text-success border-success/30 text-[10px] h-5">OK</Badge>
                  ) : (
                    <Badge variant="outline" className="text-warning border-warning/30 text-[10px] h-5">
                      Divergência {validation.keysDiffPct.toFixed(1)}%
                    </Badge>
                  )}
                </span>
              </div>
              {validation.samplePoints.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Amostra:</span>
                  <div className="font-mono mt-1 space-y-0.5">
                    {validation.samplePoints.map((p, i) => (
                      <div key={i}>({p.lat}, {p.lon}) → Jan={p.jan.toFixed(2)} Dez={p.dec.toFixed(2)} kWh/m²/dia</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!versionId && allFilesSelected && validation && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Crie uma versão (Passo 1) antes de importar.
            </p>
          )}

          {state === "uploading" && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Enviados {progress.current.toLocaleString("pt-BR")} de {progress.total.toLocaleString("pt-BR")}</span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
          )}

          {pointsLoaded !== null && (
            <Badge className="bg-success/10 text-success border-success/30 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {pointsLoaded.toLocaleString("pt-BR")} pontos confirmados no banco
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ STEP 3: Activate ═══════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            3. Ativar Versão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Após o upload, ative a versão para que os dados fiquem disponíveis para simulações.
          </p>
          <Button
            onClick={activateVersion}
            disabled={!versionId || activating || pointsLoaded === 0 || pointsLoaded === null}
            size="sm"
            className="gap-1.5"
          >
            {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Ativar Versão
          </Button>

          {activateResult && (
            <div className="text-sm space-y-1">
              <div className="flex gap-2">
                <span className="text-muted-foreground">Version ID:</span>
                <span className="font-mono text-xs">{versionId}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Row Count:</span>
                <span className="font-semibold">{activateResult.row_count.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          )}

          {(!versionId || pointsLoaded === null) && (
            <p className="text-xs text-muted-foreground">
              Complete os passos 1 e 2 antes de ativar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ Log ═══════════ */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Log de Importação</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-0.5 text-xs font-mono">
                {logs.map((entry, i) => (
                  <div key={i} className={`flex gap-2 ${
                    entry.level === "error" ? "text-destructive" :
                    entry.level === "warn" ? "text-warning" :
                    entry.level === "success" ? "text-success" :
                    "text-muted-foreground"
                  }`}>
                    <span className="text-muted-foreground/50 shrink-0">
                      {new Date(entry.ts).toLocaleTimeString("pt-BR")}
                    </span>
                    <span>{entry.msg}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function FileInput({ label, file, onSelect, disabled }: {
  label: string;
  file: File | null;
  onSelect: (f: File | null) => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <input
        ref={ref}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        disabled={disabled}
        onChange={e => onSelect(e.target.files?.[0] ?? null)}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs h-9 justify-start"
        disabled={disabled}
        onClick={() => ref.current?.click()}
      >
        {file ? (
          <>
            <FileText className="h-3.5 w-3.5 text-success" />
            <span className="truncate">{file.name}</span>
            <span className="text-muted-foreground ml-auto">
              {(file.size / 1024).toFixed(0)} KB
            </span>
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" />
            Selecionar arquivo
          </>
        )}
      </Button>
    </div>
  );
}
