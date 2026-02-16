import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload, FileText, CheckCircle2, AlertTriangle, Loader2,
  Play, MapPin, X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────

type ImportState = "idle" | "parsing" | "uploading" | "activating" | "done" | "error";

interface LogEntry {
  ts: number;
  level: "info" | "warn" | "error" | "success";
  msg: string;
}

interface ParsedPoint {
  lat: number;
  lon: number;
  m01: number; m02: number; m03: number; m04: number; m05: number; m06: number;
  m07: number; m08: number; m09: number; m10: number; m11: number; m12: number;
  dhi_m01?: number; dhi_m02?: number; dhi_m03?: number; dhi_m04?: number; dhi_m05?: number; dhi_m06?: number;
  dhi_m07?: number; dhi_m08?: number; dhi_m09?: number; dhi_m10?: number; dhi_m11?: number; dhi_m12?: number;
  dni_m01?: number; dni_m02?: number; dni_m03?: number; dni_m04?: number; dni_m05?: number; dni_m06?: number;
  dni_m07?: number; dni_m08?: number; dni_m09?: number; dni_m10?: number; dni_m11?: number; dni_m12?: number;
  unit: string;
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

function normalizeToKwh(values: number[]): number[] {
  // if avg > 50, assume Wh → divide by 1000
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg > 50) return values.map(v => v / 1000);
  return values;
}

interface CsvRow {
  lat: number;
  lon: number;
  months: number[]; // 12 values, kWh/m²/day
}

function parseCsvContent(content: string, fileName: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error(`${fileName}: arquivo vazio ou com apenas cabeçalho`);

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

  // Find lat/lon columns
  const latIdx = headers.findIndex(h => h === "lat" || h === "latitude");
  const lonIdx = headers.findIndex(h => h === "lon" || h === "lng" || h === "longitude");
  if (latIdx < 0 || lonIdx < 0) throw new Error(`${fileName}: colunas LAT/LON não encontradas. Headers: ${headers.join(", ")}`);

  // Find month columns
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
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    if (cols.length < Math.max(latIdx, lonIdx, ...monthCols.map(m => m.idx)) + 1) continue;

    try {
      const lat = parseNumber(cols[latIdx]);
      const lon = parseNumber(cols[lonIdx]);
      const rawMonths = monthCols.map(mc => parseNumber(cols[mc.idx]));
      const months = normalizeToKwh(rawMonths);

      // Validate Brazil bounds
      if (lat < -40 || lat > 12 || lon < -80 || lon > -30) {
        continue; // skip out-of-bounds
      }

      rows.push({ lat, lon, months });
    } catch {
      // skip invalid rows
    }
  }

  return rows;
}

function mergeFiles(
  ghiRows: CsvRow[],
  dhiRows: CsvRow[],
  dniRows: CsvRow[]
): ParsedPoint[] {
  // Index by lat|lon key
  const key = (lat: number, lon: number) => `${lat.toFixed(4)}|${lon.toFixed(4)}`;

  const dhiMap = new Map<string, CsvRow>();
  for (const r of dhiRows) dhiMap.set(key(r.lat, r.lon), r);

  const dniMap = new Map<string, CsvRow>();
  for (const r of dniRows) dniMap.set(key(r.lat, r.lon), r);

  const points: ParsedPoint[] = [];
  for (const ghi of ghiRows) {
    const k = key(ghi.lat, ghi.lon);
    const dhi = dhiMap.get(k);
    const dni = dniMap.get(k);

    const point: ParsedPoint = {
      lat: ghi.lat,
      lon: ghi.lon,
      m01: ghi.months[0], m02: ghi.months[1], m03: ghi.months[2],
      m04: ghi.months[3], m05: ghi.months[4], m06: ghi.months[5],
      m07: ghi.months[6], m08: ghi.months[7], m09: ghi.months[8],
      m10: ghi.months[9], m11: ghi.months[10], m12: ghi.months[11],
      unit: "kwh_m2_day",
    };

    if (dhi) {
      point.dhi_m01 = dhi.months[0]; point.dhi_m02 = dhi.months[1]; point.dhi_m03 = dhi.months[2];
      point.dhi_m04 = dhi.months[3]; point.dhi_m05 = dhi.months[4]; point.dhi_m06 = dhi.months[5];
      point.dhi_m07 = dhi.months[6]; point.dhi_m08 = dhi.months[7]; point.dhi_m09 = dhi.months[8];
      point.dhi_m10 = dhi.months[9]; point.dhi_m11 = dhi.months[10]; point.dhi_m12 = dhi.months[11];
    }

    if (dni) {
      point.dni_m01 = dni.months[0]; point.dni_m02 = dni.months[1]; point.dni_m03 = dni.months[2];
      point.dni_m04 = dni.months[3]; point.dni_m05 = dni.months[4]; point.dni_m06 = dni.months[5];
      point.dni_m07 = dni.months[6]; point.dni_m08 = dni.months[7]; point.dni_m09 = dni.months[8];
      point.dni_m10 = dni.months[9]; point.dni_m11 = dni.months[10]; point.dni_m12 = dni.months[11];
    }

    points.push(point);
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

// ─── Version tag ─────────────────────────────────────────────

function generateVersionTag(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `atlas-import-${y}${m}${d}-${h}${min}`;
}

// ─── Component ───────────────────────────────────────────────

const CHUNK_SIZE = 500;
const DATASET_CODE = "INPE_2017_SUNDATA";

export default function IrradianceImportPage() {
  const [ghiFile, setGhiFile] = useState<File | null>(null);
  const [dhiFile, setDhiFile] = useState<File | null>(null);
  const [dniFile, setDniFile] = useState<File | null>(null);
  const [versionTag, setVersionTag] = useState(generateVersionTag);
  const [state, setState] = useState<ImportState>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [versionId, setVersionId] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const abortRef = useRef(false);

  const allFilesSelected = !!ghiFile && !!dhiFile && !!dniFile;
  const canStart = allFilesSelected && state === "idle" && versionTag.trim().length > 0;

  const log = useCallback((level: LogEntry["level"], msg: string) => {
    setLogs(prev => [...prev, { ts: Date.now(), level, msg }]);
  }, []);

  const handleImport = async () => {
    if (!ghiFile || !dhiFile || !dniFile) return;
    abortRef.current = false;
    setLogs([]);
    setVersionId(null);
    setRowCount(null);
    setLookupResult(null);

    // ── 1. Parse CSVs ──
    setState("parsing");
    log("info", "Lendo arquivos CSV...");

    let ghiRows: CsvRow[], dhiRows: CsvRow[], dniRows: CsvRow[];
    try {
      const [ghiText, dhiText, dniText] = await Promise.all([
        readFileAsText(ghiFile),
        readFileAsText(dhiFile),
        readFileAsText(dniFile),
      ]);
      ghiRows = parseCsvContent(ghiText, "GHI.csv");
      dhiRows = parseCsvContent(dhiText, "DHI.csv");
      dniRows = parseCsvContent(dniText, "DNI.csv");
    } catch (e: any) {
      log("error", `Erro ao parsear CSV: ${e.message}`);
      setState("error");
      return;
    }

    log("info", `GHI: ${ghiRows.length} pontos | DHI: ${dhiRows.length} pontos | DNI: ${dniRows.length} pontos`);

    // Warn if counts differ
    if (ghiRows.length !== dhiRows.length || ghiRows.length !== dniRows.length) {
      log("warn", `⚠️ Contagem divergente entre arquivos! GHI=${ghiRows.length}, DHI=${dhiRows.length}, DNI=${dniRows.length}`);
    }

    // Merge
    log("info", "Mesclando arquivos por coordenadas...");
    const points = mergeFiles(ghiRows, dhiRows, dniRows);
    log("success", `${points.length} pontos mesclados.`);

    if (points.length === 0) {
      log("error", "Nenhum ponto válido após mesclagem.");
      setState("error");
      return;
    }

    // Check for missing DHI/DNI
    const withDhi = points.filter(p => p.dhi_m01 !== undefined).length;
    const withDni = points.filter(p => p.dni_m01 !== undefined).length;
    if (withDhi < points.length) log("warn", `${points.length - withDhi} pontos sem DHI`);
    if (withDni < points.length) log("warn", `${points.length - withDni} pontos sem DNI`);

    // ── 2. Create version ──
    log("info", "Criando versão no banco...");
    const { data: uid } = await supabase.auth.getUser();
    const metadata = {
      source: "ATLAS/CEPEL/SUNDATA",
      variables: ["GHI", "DHI", "DNI"],
      plane: "horizontal",
      unit: "kwh_m2_day",
      imported_by: uid?.user?.id ?? "unknown",
      ghi_points: ghiRows.length,
      dhi_points: dhiRows.length,
      dni_points: dniRows.length,
      merged_points: points.length,
    };

    const { data: newVersionId, error: createErr } = await supabase.rpc(
      "create_irradiance_version",
      { _dataset_code: DATASET_CODE, _version_tag: versionTag, _metadata: metadata }
    );

    if (createErr) {
      log("error", `Erro ao criar versão: ${createErr.message}`);
      setState("error");
      return;
    }

    const vid = newVersionId as string;
    setVersionId(vid);
    log("success", `Versão criada: ${vid}`);

    // ── 3. Upload chunks ──
    setState("uploading");
    const totalChunks = Math.ceil(points.length / CHUNK_SIZE);
    setProgress({ current: 0, total: points.length });

    for (let i = 0; i < totalChunks; i++) {
      if (abortRef.current) {
        log("warn", "Importação cancelada pelo usuário.");
        setState("error");
        return;
      }

      const chunk = points.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const { error: chunkErr } = await supabase.rpc("import_irradiance_points_chunk", {
        _version_id: vid,
        _rows: chunk as any,
      });

      if (chunkErr) {
        log("error", `Erro no chunk ${i + 1}/${totalChunks}: ${chunkErr.message}`);
        setState("error");
        return;
      }

      const sent = Math.min((i + 1) * CHUNK_SIZE, points.length);
      setProgress({ current: sent, total: points.length });
      log("info", `Chunk ${i + 1}/${totalChunks} enviado (${sent.toLocaleString("pt-BR")} pontos)`);
    }

    log("success", `Todos os ${points.length.toLocaleString("pt-BR")} pontos enviados!`);

    // ── 4. Activate ──
    setState("activating");
    log("info", "Ativando versão...");

    const { data: activateRes, error: activateErr } = await supabase.rpc(
      "activate_irradiance_version",
      { _version_id: vid }
    );

    if (activateErr) {
      log("error", `Erro ao ativar: ${activateErr.message}`);
      setState("error");
      return;
    }

    const result = activateRes as any;
    setRowCount(result?.row_count ?? points.length);
    log("success", `✅ Versão ativada! ${(result?.row_count ?? points.length).toLocaleString("pt-BR")} pontos.`);

    setState("done");
    toast.success("Importação concluída!", {
      description: `${points.length.toLocaleString("pt-BR")} pontos importados e versão ativada.`,
      duration: 10000,
    });
  };

  const handleLookupTest = async () => {
    if (!versionId) return;
    setLookupLoading(true);
    setLookupResult(null);

    try {
      const { data, error } = await supabase.rpc("get_irradiance_for_simulation", {
        _version_id: versionId,
        _lat: -15.7942,
        _lon: -47.8822,
        _radius_deg: 0.5,
      });

      if (error) throw error;
      setLookupResult(data);
      log("success", "Teste de lookup Brasília OK!");
    } catch (e: any) {
      log("error", `Lookup falhou: ${e.message}`);
      toast.error("Lookup falhou", { description: e.message });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleReset = () => {
    setState("idle");
    setGhiFile(null);
    setDhiFile(null);
    setDniFile(null);
    setLogs([]);
    setProgress({ current: 0, total: 0 });
    setVersionId(null);
    setRowCount(null);
    setLookupResult(null);
    setVersionTag(generateVersionTag());
  };

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Importar Atlas (3 CSV)</h2>
        <p className="text-sm text-muted-foreground">
          Importação manual dos arquivos GHI, DHI e DNI do Atlas Brasileiro (INPE/CEPEL/SUNDATA).
        </p>
      </div>

      {/* ── File Selection ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1. Selecionar Arquivos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FileInput label="GHI (Global Horizontal)" file={ghiFile} onSelect={setGhiFile} disabled={state !== "idle"} />
            <FileInput label="DHI (Diffuse Horizontal)" file={dhiFile} onSelect={setDhiFile} disabled={state !== "idle"} />
            <FileInput label="DNI (Direct Normal)" file={dniFile} onSelect={setDniFile} disabled={state !== "idle"} />
          </div>

          <Separator />

          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="version-tag" className="text-xs">Version Tag</Label>
              <Input
                id="version-tag"
                value={versionTag}
                onChange={e => setVersionTag(e.target.value)}
                disabled={state !== "idle"}
                className="font-mono text-xs"
              />
            </div>
            <Badge variant="outline" className="font-mono text-[10px] h-6">{DATASET_CODE}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Action ── */}
      <div className="flex items-center gap-3">
        {state === "idle" && (
          <Button onClick={handleImport} disabled={!canStart} className="gap-1.5">
            <Play className="h-4 w-4" />
            Iniciar Importação
          </Button>
        )}
        {(state === "uploading" || state === "parsing") && (
          <Button variant="destructive" onClick={() => { abortRef.current = true; }} className="gap-1.5">
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        )}
        {(state === "done" || state === "error") && (
          <Button variant="outline" onClick={handleReset} className="gap-1.5">
            Nova Importação
          </Button>
        )}
        {state === "done" && versionId && (
          <Button variant="outline" onClick={handleLookupTest} disabled={lookupLoading} className="gap-1.5">
            {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            Testar Lookup Brasília
          </Button>
        )}
      </div>

      {/* ── Progress ── */}
      {state === "uploading" && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.current.toLocaleString("pt-BR")} / {progress.total.toLocaleString("pt-BR")} pontos</span>
              <span>{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* ── Status badges ── */}
      {state !== "idle" && (
        <div className="flex items-center gap-2 flex-wrap">
          <StateBadge label="Parsing" active={state === "parsing"} done={["uploading", "activating", "done"].includes(state)} />
          <StateBadge label="Upload" active={state === "uploading"} done={["activating", "done"].includes(state)} />
          <StateBadge label="Ativação" active={state === "activating"} done={state === "done"} />
          {state === "error" && <Badge variant="destructive">Erro</Badge>}
          {state === "done" && <Badge className="bg-success/10 text-success border-success/30">Concluído</Badge>}
        </div>
      )}

      {/* ── Result ── */}
      {state === "done" && versionId && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Version ID</div>
              <div className="font-mono text-xs">{versionId}</div>
              <div className="text-muted-foreground">Pontos</div>
              <div className="font-semibold">{rowCount?.toLocaleString("pt-BR")}</div>
              <div className="text-muted-foreground">Dataset</div>
              <div>{DATASET_CODE}</div>
              <div className="text-muted-foreground">Tag</div>
              <div className="font-mono text-xs">{versionTag}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Lookup result ── */}
      {lookupResult && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resultado do Lookup (Brasília)</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-60">
              <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                {JSON.stringify(lookupResult, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ── Logs ── */}
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
            Selecionar CSV
          </>
        )}
      </Button>
    </div>
  );
}

function StateBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  if (done) return (
    <Badge variant="outline" className="gap-1 text-success border-success/30">
      <CheckCircle2 className="h-3 w-3" /> {label}
    </Badge>
  );
  if (active) return (
    <Badge variant="outline" className="gap-1 text-primary border-primary/30">
      <Loader2 className="h-3 w-3 animate-spin" /> {label}
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-muted-foreground">{label}</Badge>
  );
}
