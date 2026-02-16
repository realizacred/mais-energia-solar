/**
 * CsvImportPanel — Handles CSV file selection, validation, and chunked upload
 * via the canonical RPC `import_irradiance_points_chunk`.
 * 
 * No critical logic here — just orchestration. All validation/insert happens server-side.
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { VersionRow } from "./types";
import {
  parseCsvContent,
  mergeGhiDhiDni,
  validateCsvFiles,
  chunkArray,
  readFileAsText,
} from "./csv-helpers";

const CHUNK_SIZE = 500;
const MAX_RETRIES = 3;

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

      log("info", `GHI: ${ghi.rows.length} pontos (${ghi.unitDetected})`);
      if (dhi) log("info", `DHI: ${dhi.rows.length} pontos (${dhi.unitDetected})`);
      if (dni) log("info", `DNI: ${dni.rows.length} pontos (${dni.unitDetected})`);

      const merged = mergeGhiDhiDni(ghi.rows, dhi?.rows ?? null, dni?.rows ?? null);
      const validation = validateCsvFiles(ghi.rows, dhi?.rows ?? null, dni?.rows ?? null, merged);

      if (!validation.keysMatch) {
        log("warn", `⚠️ Divergência de ${validation.keysDiffPct.toFixed(1)}% entre coordenadas!`);
      } else {
        log("success", `✅ Coordenadas compatíveis`);
      }
      log("success", `${merged.length} pontos prontos para importar.`);
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

      for (let i = 0; i < chunks.length; i++) {
        if (abortRef.current) {
          log("warn", "Importação cancelada.");
          setState("error");
          return;
        }

        let success = false;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          const { error } = await supabase.rpc("import_irradiance_points_chunk" as any, {
            _version_id: processingVersion.id,
            _rows: chunks[i] as any,
          });
          if (!error) { success = true; break; }
          if (attempt < MAX_RETRIES - 1) {
            log("warn", `Chunk ${i + 1} falhou (tentativa ${attempt + 1}/${MAX_RETRIES}). Retentando...`);
            await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
          } else {
            log("error", `Chunk ${i + 1} falhou: ${error.message}`);
            setState("error");
            return;
          }
        }

        const sent = Math.min((i + 1) * CHUNK_SIZE, points.length);
        setProgress({ current: sent, total: points.length });
        if (i % 10 === 0 || i === chunks.length - 1) {
          log("info", `Chunk ${i + 1}/${chunks.length} OK (${sent.toLocaleString("pt-BR")} pontos)`);
        }
      }

      // Update version row_count via finalize
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

      log("success", `✅ ${points.length.toLocaleString("pt-BR")} pontos importados!`);
      setState("done");
      toast.success("Importação concluída!", { description: `${points.length.toLocaleString("pt-BR")} pontos.` });
      onReload();
    } catch (e: any) {
      log("error", `Erro: ${e.message}`);
      setState("error");
    }
  };

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="border border-border/60 rounded-lg p-3 space-y-2 bg-muted/20">
      <p className="text-xs font-medium flex items-center gap-1.5">
        <Upload className="h-3.5 w-3.5" />
        Importar via CSV (GHI obrigatório / DHI / DNI opcionais)
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
              onChange={e => {
                const file = e.target.files?.[0] || null;
                if (key === "ghi") setGhiFile(file);
                else if (key === "dhi") setDhiFile(file);
                else setDniFile(file);
                setState("idle");
              }}
              className="h-7 text-[10px] file:text-[10px]"
              disabled={state === "uploading"}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {state === "idle" && ghiFile && (
          <Button size="sm" variant="outline" onClick={handleValidate} className="gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Validar Arquivos
          </Button>
        )}
        {state === "validated" && processingVersion && (
          <Button size="sm" onClick={handleImport} className="gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" />
            Importar Pontos
          </Button>
        )}
        {state === "uploading" && (
          <Button size="sm" variant="destructive" onClick={() => { abortRef.current = true; }} className="gap-1.5 text-xs">
            Cancelar
          </Button>
        )}
        {!processingVersion && ghiFile && (
          <span className="text-[10px] text-muted-foreground">Crie uma versão primeiro</span>
        )}
      </div>

      {state === "uploading" && (
        <div className="space-y-1">
          <Progress value={progressPct} className="h-2" />
          <p className="text-[10px] text-muted-foreground">{progressPct}% — {progress.current.toLocaleString("pt-BR")} / {progress.total.toLocaleString("pt-BR")} pontos</p>
        </div>
      )}

      {logs.length > 0 && (
        <ScrollArea className="max-h-24 border border-border/40 rounded p-2 bg-card">
          <div className="space-y-0.5 text-[10px] font-mono">
            {logs.map((l, i) => (
              <div key={i} className={l.level === "error" ? "text-destructive" : l.level === "success" ? "text-success" : l.level === "warn" ? "text-warning" : "text-muted-foreground"}>
                {l.msg}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
