import { useState, useRef, useMemo } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle, AlertCircle, ChevronDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  type ParsedTarifa,
  type FileType,
  parseCSVLine,
  detectFileType,
  parseNumber,
  norm,
  stripSuffixes,
  parseTarifasHomologadas,
  parseComponentesTarifas,
  parseXlsxFile,
  detectColumns,
} from "./importCsvAneelUtils";
import { validateRows, type ValidationReport, type RowValidation } from "./importCsvAneelValidation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ImportResult {
  matched: number;
  updated: number;
  skipped: number;
  errors: string[];
  grupoA: number;
  grupoB: number;
}

type Step = "upload" | "validate" | "preview" | "done";

export function ImportCsvAneelDialog({ open, onOpenChange, onImportComplete }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [parsed, setParsed] = useState<ParsedTarifa[]>([]);
  const [fileType, setFileType] = useState<FileType | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [unmatchedAgents, setUnmatchedAgents] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ headers: string[]; colMap: Record<string, number>; sampleRows: string[][] } | null>(null);

  const reset = () => {
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setParsed([]);
    setResult(null);
    setFileType(null);
    setProgress({ current: 0, total: 0, percent: 0 });
    setUnmatchedAgents([]);
    setStep("upload");
    setValidation(null);
    setShowAllRows(false);
    setDebugInfo(null);
  };

  // ─── Step 1: Upload & Parse ───
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    try {
      const isXlsx = f.name.toLowerCase().endsWith(".xlsx") || f.name.toLowerCase().endsWith(".xls");
      
      let hdrs: string[];
      let rows: string[][];
      
      if (isXlsx) {
        const buffer = await f.arrayBuffer();
        const result = parseXlsxFile(buffer);
        hdrs = result.headers;
        rows = result.rows;
      } else {
        const text = await f.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        hdrs = parseCSVLine(lines[0]);
        rows = lines.slice(1).map(l => parseCSVLine(l));
      }
      
      if (rows.length < 1) {
        toast({ title: "Arquivo vazio ou inválido", description: "O arquivo não contém linhas de dados.", variant: "destructive" });
        return;
      }

      setHeaders(hdrs);
      setRawRows(rows);
      
      console.log("[ANEEL Import] Headers:", hdrs);
      const colMap = detectColumns(hdrs);
      console.log("[ANEEL Import] Detected columns:", colMap);
      
      // Save debug info for UI display
      setDebugInfo({
        headers: hdrs,
        colMap,
        sampleRows: rows.slice(0, 3),
      });
      
      const detected = detectFileType(hdrs);
      setFileType(detected);

      // Run validation with file type awareness
      const report = validateRows(hdrs, rows, detected);
      setValidation(report);

      // If missing required columns, show that immediately
      if (report.missingRequiredColumns.length > 0) {
        console.warn("[ANEEL Import] Missing required columns:", report.missingRequiredColumns);
        setStep("validate");
        return;
      }

      // Parse records for import
      let records: ParsedTarifa[];
      if (detected === "componentes") {
        records = parseComponentesTarifas(rows, hdrs);
      } else {
        records = parseTarifasHomologadas(rows, hdrs);
      }
      console.log("[ANEEL Import] Parsed records:", records.length, "from", rows.length, "rows, type:", detected);
      if (records.length === 0 && rows.length > 0) {
        console.warn("[ANEEL Import] 0 records parsed! Headers:", hdrs);
        console.warn("[ANEEL Import] Column map:", colMap);
        console.warn("[ANEEL Import] Sample raw rows:", rows.slice(0, 5));
      }
      setParsed(records);

      setStep("validate");
    } catch (err) {
      toast({ title: "Erro ao ler arquivo", description: String(err), variant: "destructive" });
    }
  };

  // ─── Step 2→3: Proceed to preview ───
  const handleProceedToPreview = () => {
    if (!validation) return;
    
    // Re-parse only valid/warning rows
    let records: ParsedTarifa[];
    if (fileType === "componentes") {
      records = parseComponentesTarifas(rawRows, headers);
    } else {
      records = parseTarifasHomologadas(rawRows, headers);
    }
    setParsed(records);
    setStep("preview");
  };

  // ─── Step 3→4: Import ───
  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    setProgress({ current: 0, total: 0, percent: 0 });

    try {
      const { data: concessionarias, error: concError } = await supabase
        .from("concessionarias")
        .select("id, nome, sigla");
      if (concError) throw concError;
      if (!concessionarias?.length) {
        toast({ title: "Nenhuma concessionária cadastrada", variant: "destructive" });
        setImporting(false);
        return;
      }

      // Build lookup
      const concBySigla: Record<string, typeof concessionarias[0]> = {};
      const concByNome: Record<string, typeof concessionarias[0]> = {};
      for (const c of concessionarias) {
        if (c.sigla) concBySigla[norm(c.sigla)] = c;
        concByNome[norm(c.nome)] = c;
      }

      const findConc = (sig: string, nome: string) => {
        if (sig && concBySigla[norm(sig)]) return concBySigla[norm(sig)];
        if (nome && concByNome[norm(nome)]) return concByNome[norm(nome)];
        if (sig && concByNome[norm(sig)]) return concByNome[norm(sig)];
        const normSig = stripSuffixes(norm(sig));
        const normNome = stripSuffixes(norm(nome || sig));
        for (const c of concessionarias) {
          const ns = stripSuffixes(norm(c.sigla || ""));
          const nn = stripSuffixes(norm(c.nome));
          if (normSig && (ns.includes(normSig) || normSig.includes(ns))) return c;
          if (normNome && (nn.includes(normNome) || normNome.includes(nn))) return c;
          if (normSig && (nn.includes(normSig) || normSig.includes(nn))) return c;
        }
        return null;
      };

      // Pre-cache agent→conc matching (runs once per unique agent instead of per row)
      const agentCache = new Map<string, typeof concessionarias[0] | null>();
      const unmatchedSet = new Set<string>();
      
      for (const r of parsed) {
        const agent = r.sigAgente || r.nomAgente;
        if (!agentCache.has(agent)) {
          const match = findConc(r.sigAgente, r.nomAgente);
          agentCache.set(agent, match);
          if (!match) unmatchedSet.add(agent);
        }
      }
      
      if (unmatchedSet.size > 0) {
        console.warn(`[ANEEL Import] ${unmatchedSet.size} distribuidoras sem correspondência:`, [...unmatchedSet]);
      }
      setUnmatchedAgents([...unmatchedSet].sort());

      const mwhToKwh = (v: number) => v / 1000;

      // Group records by concessionária+subgrupo+modalidade
      const grouped = new Map<string, { conc: typeof concessionarias[0]; records: ParsedTarifa[] }>();
      for (const r of parsed) {
        const agent = r.sigAgente || r.nomAgente;
        const conc = agentCache.get(agent);
        if (!conc) continue;
        const key = `${conc.id}|${r.subgrupo}|${r.modalidade}`;
        if (!grouped.has(key)) grouped.set(key, { conc, records: [] });
        grouped.get(key)!.records.push(r);
      }

      let updated = 0;
      let grupoA = 0, grupoB = 0;
      const errors: string[] = [];
      const entries = [...grouped.entries()];
      const totalEntries = entries.length;
      const BATCH_SIZE = 50;

      // Build all upsert payloads first, then batch
      const payloads: any[] = [];
      for (const [, { conc, records }] of entries) {
        const first = records[0];
        const sub = first.subgrupo;

        if (fileType === "componentes") {
          if (sub.startsWith("A")) {
            let fio_b_ponta = 0, fio_b_fora_ponta = 0;
            for (const r of records) {
              const isPonta = r.posto.toLowerCase().includes("ponta") && !r.posto.toLowerCase().includes("fora");
              const isMWh = norm(r.unidade).includes("mwh");
              const rawVal = r.vlrFioB || 0;
              const val = isMWh ? mwhToKwh(rawVal) : rawVal;
              if (isPonta) fio_b_ponta = val;
              else fio_b_fora_ponta = val;
            }
            payloads.push({
              concessionaria_id: conc.id, subgrupo: sub,
              modalidade_tarifaria: first.modalidade || "Convencional",
              fio_b_ponta, fio_b_fora_ponta,
              origem: "CSV_ANEEL_COMP", is_active: true,
              updated_at: new Date().toISOString(),
              _isGA: true,
            });
          } else {
            const r = records[0];
            const isMWh = norm(r.unidade).includes("mwh");
            const rawFioB = r.vlrFioB || 0;
            payloads.push({
              concessionaria_id: conc.id, subgrupo: sub,
              modalidade_tarifaria: first.modalidade || "Convencional",
              tarifa_fio_b: isMWh ? mwhToKwh(rawFioB) : rawFioB,
              origem: "CSV_ANEEL_COMP", is_active: true,
              updated_at: new Date().toISOString(),
              _isGA: false,
            });
          }
        } else {
          // Tarifas homologadas
          if (sub.startsWith("A")) {
            let te_ponta = 0, te_fora_ponta = 0, tusd_ponta = 0, tusd_fora_ponta = 0;
            let demanda_consumo_rs = 0, demanda_geracao_rs = 0;
            for (const r of records) {
              const isPonta = r.posto.toLowerCase().includes("ponta") && !r.posto.toLowerCase().includes("fora");
              const isEnergy = norm(r.unidade).includes("mwh");
              const isDemand = norm(r.unidade).includes("kw") && !norm(r.unidade).includes("kwh");
              const isGeracao = norm(r.modalidade).includes("gera");
              if (isDemand) {
                if (isGeracao) demanda_geracao_rs = r.vlrTUSD || r.vlrTE;
                else if (isPonta) demanda_consumo_rs = Math.max(demanda_consumo_rs, r.vlrTUSD);
                else demanda_consumo_rs = demanda_consumo_rs || r.vlrTUSD;
              } else if (isEnergy) {
                if (isPonta) { te_ponta = mwhToKwh(r.vlrTE); tusd_ponta = mwhToKwh(r.vlrTUSD); }
                else { te_fora_ponta = mwhToKwh(r.vlrTE); tusd_fora_ponta = mwhToKwh(r.vlrTUSD); }
              }
            }
            const upsertData: any = {
              concessionaria_id: conc.id, subgrupo: sub,
              modalidade_tarifaria: first.modalidade || "Convencional",
              te_ponta, te_fora_ponta, tusd_ponta, tusd_fora_ponta,
              origem: "CSV_ANEEL", is_active: true,
              updated_at: new Date().toISOString(),
              _isGA: true,
            };
            if (demanda_consumo_rs) upsertData.demanda_consumo_rs = demanda_consumo_rs;
            if (demanda_geracao_rs) upsertData.demanda_geracao_rs = demanda_geracao_rs;
            payloads.push(upsertData);
          } else {
            const energyRows = records.filter(r => norm(r.unidade).includes("mwh"));
            const r = energyRows.length > 0 ? energyRows[0] : records[0];
            const isMWh = norm(r.unidade).includes("mwh");
            payloads.push({
              concessionaria_id: conc.id, subgrupo: sub,
              modalidade_tarifaria: first.modalidade || "Convencional",
              tarifa_energia: isMWh ? mwhToKwh(r.vlrTE) : r.vlrTE,
              tarifa_fio_b: isMWh ? mwhToKwh(r.vlrTUSD) : r.vlrTUSD,
              origem: "CSV_ANEEL", is_active: true,
              updated_at: new Date().toISOString(),
              _isGA: false,
            });
          }
        }
      }

      // Batch upsert
      for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const batch = payloads.slice(i, i + BATCH_SIZE).map(p => {
          const isGA = p._isGA;
          const { _isGA, ...clean } = p;
          return { ...clean, _isGA: isGA };
        });

        // Track grupo counts
        for (const p of batch) {
          if (p._isGA) grupoA++;
          else grupoB++;
        }

        const cleanBatch = batch.map(({ _isGA, ...rest }) => rest);
        
        const { error } = await supabase
          .from("concessionaria_tarifas_subgrupo")
          .upsert(cleanBatch as any[], { onConflict: "tenant_id,concessionaria_id,subgrupo,modalidade_tarifaria" });

        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          updated += cleanBatch.length;
        }

        setProgress({
          current: Math.min(i + BATCH_SIZE, payloads.length),
          total: payloads.length,
          percent: Math.round((Math.min(i + BATCH_SIZE, payloads.length) / payloads.length) * 100),
        });
        // Yield to UI thread
        await new Promise(r => setTimeout(r, 30));
      }

      const matched = grouped.size;
      const skipped = parsed.length - [...grouped.values()].reduce((sum, g) => sum + g.records.length, 0);
      const finalResult: ImportResult = { matched, updated, skipped, errors, grupoA, grupoB };
      setResult(finalResult);

      // Record audit log to aneel_sync_runs
      try {
        await supabase.from("aneel_sync_runs").insert({
          trigger_type: "manual_csv",
          status: errors.length > 0 ? "partial" : "completed",
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          total_fetched: rawRows.length,
          total_matched: finalResult.matched,
          total_updated: finalResult.updated,
          total_errors: finalResult.errors.length,
          logs: {
            fileName: file?.name,
            fileType,
            totalRows: rawRows.length,
            validRows: validation?.validRows ?? 0,
            invalidRows: validation?.invalidRows ?? 0,
            grupoA: finalResult.grupoA,
            grupoB: finalResult.grupoB,
            unmatchedAgents: [...unmatchedSet].slice(0, 50),
            importedAt: new Date().toISOString(),
          },
        } as any);
      } catch (auditErr) {
        console.warn("[ANEEL Import] Failed to write audit log:", auditErr);
      }

      setProgress({ current: 1, total: 1, percent: 100 });
      setStep("done");
      onImportComplete();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const uniqueAgents = new Set(parsed.map(r => r.sigAgente || r.nomAgente)).size;
  const uniqueSubgrupos = new Set(parsed.map(r => r.subgrupo)).size;
  const fileTypeLabel = fileType === "componentes" ? "Componentes das Tarifas" : "Tarifas Homologadas";
  const fileTypeBadge = fileType === "componentes" ? "secondary" : "default";

  // Validation display: only show invalid/warning rows (not 68k valid ones)
  const validationIssueRows = useMemo(() => {
    if (!validation) return [];
    const issues = validation.rows.filter(r => r.status === "invalid" || r.status === "warning");
    if (showAllRows) return issues;
    return issues.slice(0, 20);
  }, [validation, showAllRows]);

  const totalIssueRows = useMemo(() => {
    if (!validation) return 0;
    return validation.rows.filter(r => r.status !== "valid").length;
  }, [validation]);

  const hasBlockingErrors = (validation?.missingRequiredColumns.length ?? 0) > 0;
  const canProceed = !hasBlockingErrors && (validation?.validRows ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <ShieldCheck className="w-5 h-5 text-secondary" />
            Importação Tarifária ANEEL
          </DialogTitle>
          <DialogDescription className="text-xs">
            Upload → Validação Estrutural → Preview → Importação Segura
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {(["upload", "validate", "preview", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              <span className={step === s ? "text-secondary font-bold" : step > s ? "text-foreground" : ""}>
                {s === "upload" ? "Upload" : s === "validate" ? "Validação" : s === "preview" ? "Preview" : "Concluído"}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        {/* ─── Step 1: Upload ─── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-secondary/50 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}>
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                Clique para selecionar o arquivo <strong>.csv</strong> ou <strong>.xlsx</strong>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Exportado do site dadosabertos.aneel.gov.br
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border text-[11px] text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-secondary" />
              <div className="space-y-1.5">
                <p className="font-semibold text-foreground">O sistema aceita dois tipos de arquivo (importe separadamente):</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded border bg-background">
                    <p className="font-bold text-foreground text-[10px]">📊 Tarifas Homologadas</p>
                    <p className="text-[10px]">Contém colunas TE e TUSD. Usada para tarifas de energia e distribuição.</p>
                  </div>
                  <div className="p-2 rounded border bg-background">
                    <p className="font-bold text-foreground text-[10px]">🔧 Componentes Tarifários</p>
                    <p className="text-[10px]">Contém coluna Valor Componente / Fio B. Usada para composição tarifária.</p>
                  </div>
                </div>
                <p>O tipo é detectado automaticamente pelo cabeçalho. O mapeamento é por <strong>nome de coluna</strong>.</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />
          </div>
        )}

        {/* ─── Step 2: Validation ─── */}
        {step === "validate" && validation && (
          <ScrollArea className="flex-1 max-h-[55vh]">
          <div className="space-y-4 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={fileTypeBadge as any} className="text-[10px]">{fileTypeLabel}</Badge>
              <span className="text-[11px] text-muted-foreground font-mono truncate">{file?.name}</span>
            </div>

            {/* Column mapping */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-secondary" />
                Colunas Detectadas
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(validation.detectedColumns).map(([key, idx]) => (
                  <Badge key={key} variant="outline" className="text-[9px] font-mono gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-success" />
                    {key} → col {idx}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Missing required columns */}
            {validation.missingRequiredColumns.length > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                  <XCircle className="w-4 h-4" />
                  Estrutura Inválida — Campos Obrigatórios Ausentes
                </div>
                {validation.missingRequiredColumns.map((msg, i) => (
                  <p key={i} className="text-[11px] text-destructive/90 pl-5">{msg}</p>
                ))}
              </div>
            )}

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-center">
                <div className="text-lg font-bold text-success font-mono">{validation.validRows}</div>
                <div className="text-[10px] text-success/80">Válidos</div>
              </div>
              <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-center">
                <div className="text-lg font-bold text-warning font-mono">{validation.warningRows}</div>
                <div className="text-[10px] text-warning/80">Avisos</div>
              </div>
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-center">
                <div className="text-lg font-bold text-destructive font-mono">{validation.invalidRows}</div>
                <div className="text-[10px] text-destructive/80">Inválidos</div>
              </div>
            </div>

            {/* Row-by-row issues (only invalid/warning — not 68k valid rows) */}
            {totalIssueRows > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-warning" />
                  Problemas Encontrados ({totalIssueRows} linha{totalIssueRows > 1 ? "s" : ""})
                </h4>
                <ScrollArea className="h-40 rounded-lg border">
                  <div className="min-w-[400px]">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b bg-muted/40 sticky top-0">
                          <th className="text-left px-3 py-2 font-semibold w-16">Linha</th>
                          <th className="text-left px-3 py-2 font-semibold w-20">Status</th>
                          <th className="text-left px-3 py-2 font-semibold">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationIssueRows.map((row) => (
                          <tr key={row.rowIndex} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{row.rowIndex}</td>
                            <td className="px-3 py-1.5">
                              {row.status === "warning" && (
                                <span className="flex items-center gap-1 text-warning">
                                  <AlertTriangle className="w-3 h-3" /> Aviso
                                </span>
                              )}
                              {row.status === "invalid" && (
                                <span className="flex items-center gap-1 text-destructive">
                                  <XCircle className="w-3 h-3" /> Inválida
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              {row.errors.map((e, i) => (
                                <p key={`e${i}`} className="text-destructive">{e}</p>
                              ))}
                              {row.warnings.map((w, i) => (
                                <p key={`w${i}`} className="text-warning">{w}</p>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
                {!showAllRows && totalIssueRows > 20 && (
                  <button
                    onClick={() => setShowAllRows(true)}
                    className="text-[10px] text-secondary hover:underline flex items-center gap-1"
                  >
                    <ChevronDown className="w-3 h-3" />
                    Mostrar todos os {totalIssueRows} problemas
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 text-[11px] text-success">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium">Nenhum problema encontrado — todas as {validation.validRows} linhas são válidas.</span>
              </div>
            )}

            {/* Discarded footer/summary rows */}
            {(validation as any).discardedFooterRows?.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Linhas Descartadas Automaticamente ({(validation as any).discardedFooterRows.length})
                </h4>
                <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
                  {(validation as any).discardedFooterRows.map((d: any) => (
                    <div key={d.rowIndex} className="flex items-start gap-2 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[9px] shrink-0 font-mono">Linha {d.rowIndex}</Badge>
                      <span className="font-medium text-foreground/70">{d.reason}</span>
                      {d.preview && <span className="truncate italic">— {d.preview}</span>}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Essas linhas foram identificadas como rodapé, resumo de filtros ou linhas em branco do arquivo exportado da ANEEL e não serão importadas.
                </p>
              </div>
            )}

            {/* Pipeline explanation */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border text-[11px] text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-secondary" />
              <div className="space-y-1">
                <p><strong>Como funciona:</strong> Os {validation.totalRows.toLocaleString("pt-BR")} registros serão agrupados por distribuidora + subgrupo + modalidade.</p>
                <p>• Linhas <strong>inválidas</strong> são descartadas automaticamente.</p>
                <p>• Para cada combinação, o sistema mantém apenas o registro mais recente.</p>
                <p>• Apenas distribuidoras já cadastradas no sistema serão atualizadas.</p>
                <p>O resultado final será bem menor que {validation.totalRows.toLocaleString("pt-BR")} linhas — tipicamente ~100-200 registros únicos.</p>
              </div>
            </div>

          </div>
          </ScrollArea>
        )}

        {/* ─── Step 3: Preview (import-ready) ─── */}
        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={fileTypeBadge as any} className="text-[10px]">{fileTypeLabel}</Badge>
              <span className="text-[10px] text-muted-foreground">{file?.name}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-lg font-bold font-mono">{parsed.length}</div>
                <div className="text-[10px] text-muted-foreground">Registros</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-lg font-bold font-mono">{uniqueAgents}</div>
                <div className="text-[10px] text-muted-foreground">Distribuidoras</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-lg font-bold font-mono">{uniqueSubgrupos}</div>
                <div className="text-[10px] text-muted-foreground">Subgrupos</div>
              </div>
            </div>

            <ScrollArea className="h-48 rounded-lg border">
              <div className="p-2 space-y-0.5">
                {parsed.slice(0, 50).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] py-1 px-2 rounded hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] font-mono">{r.subgrupo}</Badge>
                      <span className="text-muted-foreground truncate max-w-[180px]">{r.sigAgente || r.nomAgente}</span>
                    </div>
                    <div className="flex gap-3 font-mono text-[10px]">
                      {fileType === "componentes" ? (
                        <span>FioB: {(r.vlrFioB || 0).toFixed(4)}</span>
                      ) : (
                        <>
                          <span>TE: {r.vlrTE.toFixed(4)}</span>
                          <span>TUSD: {r.vlrTUSD.toFixed(4)}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {parsed.length > 50 && (
                  <div className="text-[10px] text-muted-foreground text-center py-1">
                    … e mais {parsed.length - 50} registros
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Diagnostic info when 0 records */}
            {parsed.length === 0 && debugInfo && (
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  Nenhum registro parseado — Diagnóstico
                </div>
                <div className="space-y-1.5 text-[10px] font-mono">
                  <div>
                    <span className="font-bold text-foreground">Cabeçalhos detectados ({debugInfo.headers.length}):</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {debugInfo.headers.filter(h => h).map((h, i) => (
                        <Badge key={i} variant="outline" className="text-[9px]">{h}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-foreground">Colunas mapeadas:</span>
                    {Object.keys(debugInfo.colMap).length === 0 ? (
                      <span className="text-destructive ml-1">Nenhuma coluna reconhecida!</span>
                    ) : (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {Object.entries(debugInfo.colMap).map(([key, idx]) => (
                          <Badge key={key} variant="secondary" className="text-[9px]">
                            {key}→{debugInfo.headers[idx] || `col${idx}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {debugInfo.sampleRows.length > 0 && (
                    <div>
                      <span className="font-bold text-foreground">Amostra da linha 1:</span>
                      <div className="mt-0.5 p-1.5 bg-muted rounded text-[9px] overflow-x-auto whitespace-nowrap">
                        {debugInfo.sampleRows[0].map((c, i) => (
                          <span key={i} className="inline-block mr-2">
                            <span className="text-muted-foreground">[{i}]</span> {c || "(vazio)"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Se os cabeçalhos acima não correspondem ao esperado, verifique se o arquivo foi exportado corretamente do site da ANEEL (dadosabertos.aneel.gov.br).
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/10 border border-warning/30 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
              <span>Apenas distribuidoras já cadastradas no sistema serão atualizadas. Registros sem correspondência serão ignorados.</span>
            </div>
          </div>
        )}

        {/* ─── Step 4: Done ─── */}
        {step === "done" && result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-success">
              <CheckCircle2 className="w-5 h-5" />
              Importação concluída — registrada para auditoria
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-center">
                <div className="text-lg font-bold text-success font-mono">{result.updated}</div>
                <div className="text-[10px] text-muted-foreground">Atualizados</div>
              </div>
              <div className="rounded-lg bg-muted/50 border p-3 text-center">
                <div className="text-lg font-bold font-mono">{result.matched}</div>
                <div className="text-[10px] text-muted-foreground">Correspondidos</div>
              </div>
              <div className="rounded-lg bg-muted/50 border p-3 text-center">
                <div className="text-lg font-bold text-muted-foreground font-mono">{result.skipped}</div>
                <div className="text-[10px] text-muted-foreground">Ignorados</div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 rounded-lg bg-primary/10 border border-primary/20 p-2 text-center">
                <div className="text-base font-bold text-primary font-mono">{result.grupoA}</div>
                <div className="text-[10px] text-muted-foreground">Grupo A (MT)</div>
              </div>
              <div className="flex-1 rounded-lg bg-success/10 border border-success/20 p-2 text-center">
                <div className="text-base font-bold text-success font-mono">{result.grupoB}</div>
                <div className="text-[10px] text-muted-foreground">Grupo B (BT)</div>
              </div>
            </div>

            {/* Audit info */}
            {validation && (
              <div className="p-3 rounded-lg bg-muted/30 border text-[11px] space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                  Relatório de Auditoria
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground font-mono pl-5">
                  <span>Arquivo:</span><span className="truncate">{file?.name}</span>
                  <span>Tipo:</span><span>{fileTypeLabel}</span>
                  <span>Total linhas:</span><span>{validation.totalRows}</span>
                  <span>Válidas:</span><span className="text-success">{validation.validRows}</span>
                  <span>Inválidas:</span><span className="text-destructive">{validation.invalidRows}</span>
                  <span>Importadas:</span><span className="text-success">{result.updated}</span>
                  <span>Data:</span><span>{new Date().toLocaleString("pt-BR")}</span>
                </div>
              </div>
            )}

            {unmatchedAgents.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-warning font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {unmatchedAgents.length} distribuidora(s) sem correspondência:
                </div>
                <ScrollArea className="h-20 rounded-lg border p-2">
                  {unmatchedAgents.map((a, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground font-mono">{a}</div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] text-destructive font-bold">
                  {result.errors.length} erro(s) de persistência:
                </div>
                <ScrollArea className="h-24 rounded-lg border p-2">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-[10px] text-destructive font-mono">{e}</div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "validate" && (
            <>
              <Button variant="outline" size="sm" onClick={reset}>Voltar</Button>
              <Button
                size="sm"
                onClick={handleProceedToPreview}
                disabled={!canProceed}
                className="gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {canProceed
                  ? `Estrutura válida — Prosseguir (${validation?.validRows ?? 0} registros)`
                  : "Estrutura inválida — Corrija o arquivo"}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              {importing && (
                <div className="flex-1 flex items-center gap-3">
                  <Progress value={progress.percent} className="h-2 flex-1" />
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {progress.current}/{progress.total} ({progress.percent}%)
                  </span>
                </div>
              )}
              {!importing && <Button variant="outline" size="sm" onClick={() => setStep("validate")}>Voltar</Button>}
              <Button size="sm" onClick={handleImport} disabled={importing} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                {importing ? `Importando… ${progress.percent}%` : `Importar ${parsed.length} registros válidos`}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button size="sm" onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
