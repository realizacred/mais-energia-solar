/**
 * CsvImportPanel — Handles CSV file selection, validation, and chunked upload
 * via the canonical RPC `import_irradiance_points_chunk`.
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { VersionRow } from "./types";
import {
  parseCsvContent,
  mergeGhiDhiDni,
  validateCsvFiles,
  chunkArray,
  readFileAsText,
  FILE_HINTS,
} from "./csv-helpers";

const CHUNK_SIZE = 500;
const MAX_RETRIES = 3;
const YIELD_MS = 10; // yield to UI thread between chunks

interface CsvImportPanelProps {
  processingVersion: VersionRow | undefined;
  onReload: () => void;
}

interface LogEntry {
  ts: number;
  level: "info" | "warn" | "error" | "success";
  msg: string;
}

export function CsvImportPanel({ processingVersion, onReload }: CsvImportPanelProps) {
  const [ghiFile, setGhiFile] = useState<File | null>(null);
  const [dhiFile, setDhiFile] = useState<File | null>(null);
  const [dniFile, setDniFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "validating" | "validated" | "uploading" | "done" | "error">("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef(false);

  const log = useCallback((level: LogEntry["level"], msg: string) => {
    setLogs(prev => [...prev, { ts: Date.now(), level, msg }]);
  }, []);

  const handleValidate = async () => {
    if (!ghiFile) return;
    setState("validating");
    setLogs([]);
    try {
      log("info", "Lendo arquivos CSV...");
      const ghiText = await readFileAsText(ghiFile);
      const dhiText = dhiFile ? await readFileAsText(dhiFile) : null;
      const dniText = dniFile ? await readFileAsText(dniFile) : null;

      const ghi = parseCsvContent(ghiText, "GHI");
      const dhi = dhiText ? parseCsvContent(dhiText, "DHI") : null;
      const dni = dniText ? parseCsvContent(dniText, "DNI") : null;

      log("info", `GHI: ${ghi.rows.length.toLocaleString("pt-BR")} pontos (${ghi.unitDetected})`);
      if (dhi) log("info", `DHI: ${dhi.rows.length.toLocaleString("pt-BR")} pontos (${dhi.unitDetected})`);
      if (dni) log("info", `DNI: ${dni.rows.length.toLocaleString("pt-BR")} pontos (${dni.unitDetected})`);

      // Report skipped rows
      const totalSkipped = ghi.skippedRows + (dhi?.skippedRows ?? 0) + (dni?.skippedRows ?? 0);
      if (totalSkipped > 0) {
        const allReasons = { ...ghi.skippedReasons };
        if (dhi) Object.entries(dhi.skippedReasons).forEach(([k, v]) => allReasons[k] = (allReasons[k] || 0) + v);
        if (dni) Object.entries(dni.skippedReasons).forEach(([k, v]) => allReasons[k] = (allReasons[k] || 0) + v);
        const reasonStr = Object.entries(allReasons).map(([k, v]) => `${k}: ${v}`).join(", ");
        log("warn", `⚠️ ${totalSkipped} linhas ignoradas (${reasonStr})`);
      }

      const merged = mergeGhiDhiDni(ghi.rows, dhi?.rows ?? null, dni?.rows ?? null);
      const validation = validateCsvFiles(
        ghi.rows, dhi?.rows ?? null, dni?.rows ?? null, merged,
        totalSkipped, ghi.skippedReasons
      );

      if (!validation.keysMatch) {
        log("warn", `⚠️ Divergência de ${validation.keysDiffPct.toFixed(1)}% entre coordenadas dos arquivos`);
      } else {
        log("success", `✅ Coordenadas compatíveis entre todos os arquivos`);
      }

      if (validation.samplePoints.length > 0) {
        const sample = validation.samplePoints[0];
        log("info", `Amostra: lat=${sample.lat}, lon=${sample.lon}, jan=${sample.jan.toFixed(2)}, dez=${sample.dec.toFixed(2)}`);
      }

      log("success", `${merged.length.toLocaleString("pt-BR")} pontos prontos para importar.`);
      setState("validated");
    } catch (e: any) {
      log("error", `Erro: ${e.message}`);
      setState("error");
    }
  };

  const handleImport = async () => {
    if (!ghiFile || !processingVersion) return;
    abortRef.current = false;
    setState("uploading");

    try {
      log("info", "Lendo arquivos CSV...");
      const ghiText = await readFileAsText(ghiFile);
      const dhiText = dhiFile ? await readFileAsText(dhiFile) : null;
      const dniText = dniFile ? await readFileAsText(dniFile) : null;

      const ghi = parseCsvContent(ghiText, "GHI");
      const dhi = dhiText ? parseCsvContent(dhiText, "DHI") : null;
      const dni = dniText ? parseCsvContent(dniText, "DNI") : null;
      const points = mergeGhiDhiDni(ghi.rows, dhi?.rows ?? null, dni?.rows ?? null);

      if (points.length === 0) {
        log("error", "Nenhum ponto válido após mesclagem.");
        setState("error");
        return;
      }

      const chunks = chunkArray(points, CHUNK_SIZE);
      setProgress({ current: 0, total: points.length });
      log("info", `Enviando ${points.length.toLocaleString("pt-BR")} pontos em ${chunks.length} chunks...`);

      const startTime = Date.now();

      for (let i = 0; i < chunks.length; i++) {
        if (abortRef.current) {
          log("warn", "Importação cancelada pelo usuário.");
          // Abort on server
          await supabase.functions.invoke("irradiance-import", {
            body: { action: "abort", version_id: processingVersion.id, error: "Cancelado pelo usuário" },
          });
          setState("error");
          return;
        }

        const chunkRows = chunks[i].map(p => ({
          version_id: processingVersion.id,
          lat: p.lat,
          lon: p.lon,
          m01: p.m01, m02: p.m02, m03: p.m03, m04: p.m04,
          m05: p.m05, m06: p.m06, m07: p.m07, m08: p.m08,
          m09: p.m09, m10: p.m10, m11: p.m11, m12: p.m12,
          dhi_m01: p.dhi_m01 ?? null, dhi_m02: p.dhi_m02 ?? null, dhi_m03: p.dhi_m03 ?? null, dhi_m04: p.dhi_m04 ?? null,
          dhi_m05: p.dhi_m05 ?? null, dhi_m06: p.dhi_m06 ?? null, dhi_m07: p.dhi_m07 ?? null, dhi_m08: p.dhi_m08 ?? null,
          dhi_m09: p.dhi_m09 ?? null, dhi_m10: p.dhi_m10 ?? null, dhi_m11: p.dhi_m11 ?? null, dhi_m12: p.dhi_m12 ?? null,
          dni_m01: p.dni_m01 ?? null, dni_m02: p.dni_m02 ?? null, dni_m03: p.dni_m03 ?? null, dni_m04: p.dni_m04 ?? null,
          dni_m05: p.dni_m05 ?? null, dni_m06: p.dni_m06 ?? null, dni_m07: p.dni_m07 ?? null, dni_m08: p.dni_m08 ?? null,
          dni_m09: p.dni_m09 ?? null, dni_m10: p.dni_m10 ?? null, dni_m11: p.dni_m11 ?? null, dni_m12: p.dni_m12 ?? null,
          unit: p.unit,
          plane: p.plane,
        }));

        let success = false;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          const { data, error } = await supabase.functions.invoke("irradiance-import", {
            body: { action: "batch", version_id: processingVersion.id, rows: chunkRows },
          });
          if (!error && data?.success) { success = true; break; }
          const errMsg = error?.message || data?.error || "Erro desconhecido";
          if (attempt < MAX_RETRIES - 1) {
            log("warn", `Chunk ${i + 1} falhou (tentativa ${attempt + 1}/${MAX_RETRIES}): ${errMsg}. Retentando...`);
            await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
          } else {
            log("error", `Chunk ${i + 1} falhou após ${MAX_RETRIES} tentativas: ${errMsg}`);
            setState("error");
            return;
          }
        }

        const sent = Math.min((i + 1) * CHUNK_SIZE, points.length);
        setProgress({ current: sent, total: points.length });

        // Log every 5 chunks or first/last
        if (i % 5 === 0 || i === chunks.length - 1) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          const pct = Math.round((sent / points.length) * 100);
          log("info", `${pct}% — ${sent.toLocaleString("pt-BR")}/${points.length.toLocaleString("pt-BR")} pontos (${elapsed}s)`);
        }

        // Yield to UI thread
        await new Promise(r => setTimeout(r, YIELD_MS));
      }

      // Finalize version
      log("info", "Finalizando versão...");
      await supabase.functions.invoke("irradiance-import", {
        body: {
          action: "finalize",
          version_id: processingVersion.id,
          dataset_id: processingVersion.dataset_id,
          row_count: points.length,
          has_dhi: !!dhiFile,
          has_dni: !!dniFile,
        },
      });

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      log("success", `✅ ${points.length.toLocaleString("pt-BR")} pontos importados em ${totalTime}s!`);
      setState("done");
      toast.success("Importação concluída!", { description: `${points.length.toLocaleString("pt-BR")} pontos em ${totalTime}s.` });
      onReload();
    } catch (e: any) {
      log("error", `Erro: ${e.message}`);
      setState("error");
    }
  };

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const fileConfigs = [
    { key: "ghi" as const, file: ghiFile, setter: setGhiFile, required: true },
    { key: "dhi" as const, file: dhiFile, setter: setDhiFile, required: false },
    { key: "dni" as const, file: dniFile, setter: setDniFile, required: false },
  ];

  return (
    <div className="border border-primary/20 rounded-lg p-4 space-y-3 bg-primary/5">
      <p className="text-xs font-medium flex items-center gap-1.5">
        <Upload className="h-3.5 w-3.5 text-primary" />
        Importar dados via CSV
      </p>
      <p className="text-[10px] text-muted-foreground -mt-1">
        Selecione o arquivo GHI (obrigatório). DHI e DNI são opcionais para maior precisão.
      </p>

      <div className="grid grid-cols-3 gap-3">
        {fileConfigs.map(({ key, setter }) => {
          const hint = FILE_HINTS[key];
          return (
            <div key={key} className="space-y-1.5">
              <Label className="text-[10px] uppercase font-semibold text-muted-foreground">
                {key.toUpperCase()} {key === "ghi" ? "*" : "(opcional)"}
              </Label>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground/70">
                <Info className="h-3 w-3 shrink-0" />
                <span className="font-mono truncate" title={hint.description}>
                  {hint.fileName}
                </span>
              </div>
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={e => {
                  const file = e.target.files?.[0] || null;
                  setter(file);
                  setState("idle");
                }}
                className="h-7 text-[10px] file:text-[10px]"
                disabled={state === "uploading"}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        {state === "idle" && ghiFile && (
          <Button size="sm" variant="outline" onClick={handleValidate} className="gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Validar arquivos
          </Button>
        )}
        {state === "validating" && (
          <Button size="sm" variant="outline" disabled className="gap-1.5 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Validando...
          </Button>
        )}
        {state === "validated" && processingVersion && (
          <Button size="sm" onClick={handleImport} className="gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" />
            Importar pontos
          </Button>
        )}
        {state === "validated" && !processingVersion && (
          <span className="text-[10px] text-warning">⚠️ Crie uma versão primeiro para poder importar</span>
        )}
        {state === "uploading" && (
          <Button size="sm" variant="destructive" onClick={() => { abortRef.current = true; }} className="gap-1.5 text-xs">
            Cancelar
          </Button>
        )}
        {state === "error" && ghiFile && (
          <Button size="sm" variant="outline" onClick={() => { setState("idle"); setLogs([]); }} className="gap-1.5 text-xs">
            Tentar novamente
          </Button>
        )}
        {!processingVersion && !ghiFile && state === "idle" && (
          <span className="text-[10px] text-muted-foreground">Crie uma versão primeiro</span>
        )}
      </div>

      {(state === "uploading" || state === "done") && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">
              {state === "done" ? "Concluído" : "Importando..."}
            </span>
            <span className={state === "done" ? "text-success" : "text-primary"}>
              {progressPct}%
            </span>
          </div>
          <Progress value={progressPct} className="h-3" />
          <p className="text-[10px] text-muted-foreground text-right">
            {progress.current.toLocaleString("pt-BR")} / {progress.total.toLocaleString("pt-BR")} pontos
          </p>
        </div>
      )}

      {logs.length > 0 && (
        <ScrollArea className="max-h-48 border border-border/40 rounded p-2 bg-card">
          <div className="space-y-0.5 text-[10px] font-mono">
            {logs.map((l, i) => (
              <div key={i} className={
                l.level === "error" ? "text-destructive" :
                l.level === "success" ? "text-success" :
                l.level === "warn" ? "text-warning" :
                "text-muted-foreground"
              }>
                {l.msg}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
