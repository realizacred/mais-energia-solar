import { useState, useRef, useMemo, useCallback } from "react";
import {
  Upload, FileText, AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle,
  AlertCircle, ChevronDown, ChevronRight, FileSpreadsheet, ArrowRight,
} from "lucide-react";
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
  normMatch,
  stripSuffixes,
  parseTarifasHomologadas,
  parseComponentesTarifas,
  parseXlsxFile,
  detectColumns,
  ANEEL_AGENT_ALIASES,
} from "./importCsvAneelUtils";
import { validateRows, type ValidationReport } from "./importCsvAneelValidation";
import { ImportWizardProgress, type WizardStep, type StepStatus } from "./ImportWizardProgress";
import { ImportWizardReport } from "./ImportWizardReport";
import { generateImportReports, type ImportReports } from "./importReportGenerator";

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

type Step = "upload" | "processing" | "validate" | "preview" | "importing" | "done";

// Pipeline sub-step IDs for the progress bar
const PIPELINE_STEPS = [
  { id: "upload", label: "Upload" },
  { id: "detect", label: "Detecção" },
  { id: "normalize", label: "Normalizar" },
  { id: "convert", label: "Conversão" },
  { id: "match", label: "Match" },
  { id: "validate", label: "Validação" },
  { id: "preview", label: "Preview" },
  { id: "commit", label: "Commit" },
  { id: "report", label: "Relatório" },
] as const;

type PipelineStepId = typeof PIPELINE_STEPS[number]["id"];

function getStepIcons(): Record<PipelineStepId, React.ReactNode> {
  return {
    upload: <Upload className="w-3 h-3" />,
    detect: <FileText className="w-3 h-3" />,
    normalize: <FileSpreadsheet className="w-3 h-3" />,
    convert: <ArrowRight className="w-3 h-3" />,
    match: <CheckCircle2 className="w-3 h-3" />,
    validate: <ShieldCheck className="w-3 h-3" />,
    preview: <Info className="w-3 h-3" />,
    commit: <Upload className="w-3 h-3" />,
    report: <FileText className="w-3 h-3" />,
  };
}

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
  const [matchedAgentsPreview, setMatchedAgentsPreview] = useState<{ agent: string; conc: string }[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ headers: string[]; colMap: Record<string, number>; sampleRows: string[][] } | null>(null);
  const [importReports, setImportReports] = useState<ImportReports | null>(null);

  // Pipeline progress state
  const [pipelineStatus, setPipelineStatus] = useState<Record<PipelineStepId, { status: StepStatus; detail?: string }>>(() => {
    const init: any = {};
    for (const s of PIPELINE_STEPS) init[s.id] = { status: "pending" as StepStatus };
    return init;
  });

  const updatePipeline = useCallback((stepId: PipelineStepId, status: StepStatus, detail?: string) => {
    setPipelineStatus(prev => ({ ...prev, [stepId]: { status, detail } }));
  }, []);

  const wizardSteps: WizardStep[] = useMemo(() => {
    const icons = getStepIcons();
    return PIPELINE_STEPS.map(s => ({
      id: s.id,
      label: s.label,
      icon: icons[s.id],
      status: pipelineStatus[s.id].status,
      detail: pipelineStatus[s.id].detail,
    }));
  }, [pipelineStatus]);

  const reset = () => {
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setParsed([]);
    setResult(null);
    setFileType(null);
    setProgress({ current: 0, total: 0, percent: 0 });
    setUnmatchedAgents([]);
    setMatchedAgentsPreview([]);
    setStep("upload");
    setValidation(null);
    setShowAllRows(false);
    setDebugInfo(null);
    setImportReports(null);
    const init: any = {};
    for (const s of PIPELINE_STEPS) init[s.id] = { status: "pending" as StepStatus };
    setPipelineStatus(init);
  };

  // ─── Step 1: Upload & Parse (with pipeline progress) ───
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setStep("processing");

    try {
      // Upload step
      updatePipeline("upload", "active", "Lendo arquivo…");
      await new Promise(r => setTimeout(r, 200)); // yield to render

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
        updatePipeline("upload", "error", "Arquivo vazio");
        toast({ title: "Arquivo vazio ou inválido", variant: "destructive" });
        return;
      }
      updatePipeline("upload", "completed", `${rows.length} linhas`);

      // Detect type
      updatePipeline("detect", "active", "Identificando tipo…");
      await new Promise(r => setTimeout(r, 150));
      const detected = detectFileType(hdrs);
      setFileType(detected);
      updatePipeline("detect", "completed", detected === "componentes" ? "Componentes" : "Homologadas");

      // Normalize columns
      updatePipeline("normalize", "active", "Normalizando cabeçalhos…");
      await new Promise(r => setTimeout(r, 150));
      setHeaders(hdrs);
      setRawRows(rows);
      const colMap = detectColumns(hdrs);
      setDebugInfo({ headers: hdrs, colMap, sampleRows: rows.slice(0, 3) });
      updatePipeline("normalize", "completed", `${Object.keys(colMap).length} colunas`);

      // Conversion step (happens inside validation/parsing)
      updatePipeline("convert", "active", "Detectando unidades…");
      await new Promise(r => setTimeout(r, 100));
      // Check if MWh conversion will happen
      const sampleUnits = rows.slice(0, 20).map(r => {
        const unitIdx = colMap.unidade;
        return unitIdx !== undefined ? (r[unitIdx] || "").toLowerCase() : "";
      });
      const hasMwh = sampleUnits.some(u => u.includes("mwh"));
      updatePipeline("convert", "completed", hasMwh ? "MWh → kWh" : "Já em kWh");

      // Match step (quick preview, actual match happens later)
      updatePipeline("match", "active", "Preparando match…");
      updatePipeline("match", "completed");

      // Validate
      updatePipeline("validate", "active", "Validando linhas…");
      await new Promise(r => setTimeout(r, 100));
      const report = validateRows(hdrs, rows, detected);
      setValidation(report);
      
      if (report.missingRequiredColumns.length > 0) {
        updatePipeline("validate", "error", "Colunas ausentes");
        setStep("validate");
        return;
      }
      updatePipeline("validate", "completed", `${report.validRows} válidas`);

      // Parse records
      let records: ParsedTarifa[];
      if (detected === "componentes") {
        records = parseComponentesTarifas(rows, hdrs);
      } else {
        records = parseTarifasHomologadas(rows, hdrs);
      }
      setParsed(records);
      
      // Mark preview as ready
      updatePipeline("preview", "active");

      setStep("validate");
    } catch (err) {
      updatePipeline("upload", "error", String(err));
      toast({ title: "Erro ao ler arquivo", description: String(err), variant: "destructive" });
      setStep("upload");
    }
  };

  // ─── Step 2→3: Proceed to preview with pre-matching ───
  const handleProceedToPreview = async () => {
    if (!validation) return;
    
    updatePipeline("match", "active", "Buscando correspondências…");

    let records: ParsedTarifa[];
    if (fileType === "componentes") {
      records = parseComponentesTarifas(rawRows, headers);
    } else {
      records = parseTarifasHomologadas(rawRows, headers);
    }
    setParsed(records);

    try {
      const [concRes, aliasRes] = await Promise.all([
        supabase.from("concessionarias").select("id, nome, sigla, nome_aneel_oficial"),
        supabase.from("concessionaria_aneel_aliases").select("concessionaria_id, alias_aneel"),
      ]);
      const concessionarias = concRes.data;
      
      if (concessionarias?.length) {
        const concById = new Map(concessionarias.map(c => [c.id, c]));
        const concByNormMatch: Record<string, typeof concessionarias[0]> = {};
        const concBySigla: Record<string, typeof concessionarias[0]> = {};
        
        for (const c of concessionarias) {
          if (c.nome_aneel_oficial) concByNormMatch[normMatch(c.nome_aneel_oficial)] = c;
          if (c.sigla) { concBySigla[norm(c.sigla)] = c; concBySigla[normMatch(c.sigla)] = c; }
          concByNormMatch[normMatch(c.nome)] = c;
          const stripped = stripSuffixes(normMatch(c.nome));
          if (stripped) concByNormMatch[stripped] = c;
        }
        
        if (aliasRes.data) {
          for (const a of aliasRes.data) {
            const c = concById.get(a.concessionaria_id);
            if (c) concByNormMatch[normMatch(a.alias_aneel)] = c;
          }
        }

        const quickFind = (agent: string) => {
          const nm = normMatch(agent);
          const nms = stripSuffixes(nm);
          if (concByNormMatch[nm]) return concByNormMatch[nm];
          if (concByNormMatch[nms]) return concByNormMatch[nms];
          if (concBySigla[nm]) return concBySigla[nm];
          const aliases = ANEEL_AGENT_ALIASES[nm] || ANEEL_AGENT_ALIASES[nms];
          if (aliases) {
            for (const a of aliases) {
              if (concByNormMatch[a]) return concByNormMatch[a];
              if (concBySigla[a]) return concBySigla[a];
              if (concBySigla[norm(a)]) return concBySigla[norm(a)];
            }
          }
          for (const c of concessionarias) {
            const nn = normMatch(c.nome);
            const nns = stripSuffixes(nn);
            if (nm.length >= 3 && (nn.includes(nm) || nns.includes(nm))) return c;
            if (nms.length >= 3 && (nn.includes(nms) || nns.includes(nms))) return c;
          }
          return null;
        };

        const uniqueAgentsInFile = [...new Set(records.map(r => r.sigAgente || r.nomAgente))];
        const matched: { agent: string; conc: string }[] = [];
        const unmatched: string[] = [];
        for (const agent of uniqueAgentsInFile) {
          const c = quickFind(agent);
          if (c) matched.push({ agent, conc: c.nome });
          else unmatched.push(agent);
        }
        setMatchedAgentsPreview(matched);
        setUnmatchedAgents(unmatched.sort());

        updatePipeline("match", "completed", `${matched.length}/${uniqueAgentsInFile.length}`);
      }
    } catch (err) {
      updatePipeline("match", "error", "Falha no match");
      console.warn("[ANEEL Import] Pre-match failed:", err);
    }

    updatePipeline("preview", "completed");
    setStep("preview");
  };

  // ─── Step 3→4: Import ───
  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    setStep("importing");
    setProgress({ current: 0, total: 0, percent: 0 });
    updatePipeline("commit", "active", "Importando registros…");

    try {
      const [concRes, aliasRes] = await Promise.all([
        supabase.from("concessionarias").select("id, nome, sigla, nome_aneel_oficial"),
        supabase.from("concessionaria_aneel_aliases").select("concessionaria_id, alias_aneel"),
      ]);
      if (concRes.error) throw concRes.error;
      const concessionarias = concRes.data;
      if (!concessionarias?.length) {
        toast({ title: "Nenhuma concessionária cadastrada", variant: "destructive" });
        setImporting(false);
        return;
      }

      const concById = new Map(concessionarias.map(c => [c.id, c]));
      const concBySigla: Record<string, typeof concessionarias[0]> = {};
      const concByNome: Record<string, typeof concessionarias[0]> = {};
      const concByNormMatch: Record<string, typeof concessionarias[0]> = {};
      for (const c of concessionarias) {
        if (c.nome_aneel_oficial) concByNormMatch[normMatch(c.nome_aneel_oficial)] = c;
        if (c.sigla) { concBySigla[norm(c.sigla)] = c; concBySigla[normMatch(c.sigla)] = c; }
        concByNome[norm(c.nome)] = c;
        concByNormMatch[normMatch(c.nome)] = c;
        const stripped = stripSuffixes(normMatch(c.nome));
        if (stripped) concByNormMatch[stripped] = c;
      }
      if (aliasRes.data) {
        for (const a of aliasRes.data) {
          const c = concById.get(a.concessionaria_id);
          if (c) concByNormMatch[normMatch(a.alias_aneel)] = c;
        }
      }

      const findConc = (sig: string, nome: string) => {
        const rawAgent = sig || nome;
        if (!rawAgent) return null;
        if (sig && concBySigla[norm(sig)]) return concBySigla[norm(sig)];
        if (nome && concByNome[norm(nome)]) return concByNome[norm(nome)];
        if (sig && concByNome[norm(sig)]) return concByNome[norm(sig)];
        const nmAgent = normMatch(rawAgent);
        if (concByNormMatch[nmAgent]) return concByNormMatch[nmAgent];
        const nmStripped = stripSuffixes(nmAgent);
        if (nmStripped && concByNormMatch[nmStripped]) return concByNormMatch[nmStripped];
        const aliases = ANEEL_AGENT_ALIASES[nmAgent] || ANEEL_AGENT_ALIASES[nmStripped];
        if (aliases) {
          for (const alias of aliases) {
            if (concByNormMatch[alias]) return concByNormMatch[alias];
            if (concBySigla[alias]) return concBySigla[alias];
            if (concBySigla[norm(alias)]) return concBySigla[norm(alias)];
          }
        }
        for (const c of concessionarias) {
          const ns = normMatch(c.sigla || "");
          const nn = normMatch(c.nome);
          const nnStripped = stripSuffixes(nn);
          if (nmAgent.length >= 3 && nn.includes(nmAgent)) return c;
          if (nmAgent.length >= 3 && nnStripped.includes(nmAgent)) return c;
          if (nmStripped.length >= 3 && nn.includes(nmStripped)) return c;
          if (ns.length >= 2 && nmAgent.includes(ns) && ns.length >= 3) return c;
          if (nmAgent.length >= 3 && ns.includes(nmAgent)) return c;
        }
        return null;
      };

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
      setUnmatchedAgents([...unmatchedSet].sort());

      const mwhToKwh = (v: number) => v / 1000;

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
      const payloads: any[] = [];

      for (const [, { conc, records }] of grouped.entries()) {
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
              updated_at: new Date().toISOString(), _isGA: true,
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
              updated_at: new Date().toISOString(), _isGA: false,
            });
          }
        } else {
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
              updated_at: new Date().toISOString(), _isGA: true,
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
              updated_at: new Date().toISOString(), _isGA: false,
            });
          }
        }
      }
      // ─── Create tariff version ───
      const uniqueConcs = new Set(payloads.map(p => p.concessionaria_id));
      const { data: versaoData, error: versaoErr } = await supabase
        .from("tarifa_versoes")
        .insert({
          origem: "import",
          notas: `Importação CSV: ${file?.name || "unknown"}`,
          status: "rascunho",
          total_registros: payloads.length,
          total_concessionarias: uniqueConcs.size,
          arquivo_nome: file?.name || null,
        } as any)
        .select("id")
        .single();

      const versaoId = versaoData?.id || null;
      if (versaoErr) {
        console.warn("[ANEEL Import] Failed to create version:", versaoErr);
      }

      const BATCH_SIZE = 50;
      for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const batch = payloads.slice(i, i + BATCH_SIZE);
        for (const p of batch) {
          if (p._isGA) grupoA++;
          else grupoB++;
        }
        const cleanBatch = batch.map(({ _isGA, ...rest }) => ({
          ...rest,
          ...(versaoId ? { versao_id: versaoId } : {}),
        }));
        
        const { error } = await supabase
          .from("concessionaria_tarifas_subgrupo")
          .upsert(cleanBatch as any[], { onConflict: "tenant_id,concessionaria_id,subgrupo,modalidade_tarifaria" });

        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          updated += cleanBatch.length;
        }

        const pct = Math.round((Math.min(i + BATCH_SIZE, payloads.length) / payloads.length) * 100);
        setProgress({ current: Math.min(i + BATCH_SIZE, payloads.length), total: payloads.length, percent: pct });
        updatePipeline("commit", "active", `${pct}% (${Math.min(i + BATCH_SIZE, payloads.length)}/${payloads.length})`);
        await new Promise(r => setTimeout(r, 30));
      }

      const matched = grouped.size;
      const skipped = parsed.length - [...grouped.values()].reduce((sum, g) => sum + g.records.length, 0);
      const finalResult: ImportResult = { matched, updated, skipped, errors, grupoA, grupoB };
      setResult(finalResult);

      updatePipeline("commit", errors.length > 0 ? "error" : "completed", `${updated} registros`);

      // Generate reports
      updatePipeline("report", "active", "Gerando relatórios…");
      const reports = generateImportReports({
        fileName: file?.name || "unknown",
        fileType: fileType!,
        validation: validation!,
        parsed,
        matchedAgents: matchedAgentsPreview,
        unmatchedAgents: [...unmatchedSet],
        importResult: finalResult,
        detectedColumns: validation?.detectedColumns || {},
        headers,
      });
      setImportReports(reports);
      updatePipeline("report", "completed");

      // Audit log
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
            taxaMapeamento: reports.resumo.taxaMapeamento,
            importedAt: new Date().toISOString(),
            versaoId,
          },
        } as any);
      } catch (auditErr) {
        console.warn("[ANEEL Import] Failed to write audit log:", auditErr);
      }

      setProgress({ current: 1, total: 1, percent: 100 });
      setStep("done");
      onImportComplete();
    } catch (err: any) {
      updatePipeline("commit", "error", err.message);
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const uniqueAgents = new Set(parsed.map(r => r.sigAgente || r.nomAgente)).size;
  const fileTypeLabel = fileType === "componentes" ? "Componentes das Tarifas" : "Tarifas Homologadas";
  const fileTypeBadge = fileType === "componentes" ? "secondary" : "default";

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

  // Show progress bar whenever we're past upload
  const showProgressBar = step !== "upload";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Importação Tarifária ANEEL
          </DialogTitle>
          <DialogDescription className="text-xs">
            Upload → Detecção → Normalização → Conversão → Match → Validação → Preview → Commit → Relatório
          </DialogDescription>
        </DialogHeader>

        {/* Pipeline Progress Bar */}
        {showProgressBar && (
          <>
            <ImportWizardProgress steps={wizardSteps} />
            <Separator />
          </>
        )}

        {/* ─── Step: Upload ─── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                Clique para selecionar o arquivo <strong>.csv</strong> ou <strong>.xlsx</strong>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Exportado do site dadosabertos.aneel.gov.br
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border text-[11px] text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
              <div className="space-y-1.5">
                <p className="font-semibold text-foreground">O sistema aceita dois tipos de arquivo:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded border bg-background">
                    <p className="font-bold text-foreground text-[10px]">📊 Tarifas Homologadas</p>
                    <p className="text-[10px]">Contém colunas TE e TUSD consolidados.</p>
                  </div>
                  <div className="p-2 rounded border bg-background">
                    <p className="font-bold text-foreground text-[10px]">🔧 Componentes Tarifários</p>
                    <p className="text-[10px]">Contém composição tarifária (Fio B, etc).</p>
                  </div>
                </div>
                <p>O tipo é detectado automaticamente. Mapeamento por <strong>nome de coluna</strong>.</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />
          </div>
        )}

        {/* ─── Step: Processing (auto-transitions) ─── */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="text-sm text-muted-foreground animate-pulse">
              Estamos lendo o arquivo e identificando a estrutura…
            </div>
          </div>
        )}

        {/* ─── Step: Validation ─── */}
        {step === "validate" && validation && (
          <ScrollArea className="flex-1 max-h-[50vh]">
            <div className="space-y-4 pr-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={fileTypeBadge as any} className="text-[10px]">{fileTypeLabel}</Badge>
                <span className="text-[11px] text-muted-foreground font-mono truncate">{file?.name}</span>
              </div>

              {/* Componentes warning */}
              {fileType === "componentes" && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    Arquivo de Componentes Tarifários
                  </div>
                  <p className="text-warning/80">
                    Este arquivo não contém TE/TUSD consolidados para proposta. Será importado apenas como composição tarifária (Fio B).
                  </p>
                </div>
              )}

              {/* Column mapping */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
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
                  <div className="pl-5 pt-1 text-[10px] text-muted-foreground space-y-0.5">
                    <p><strong>Como corrigir:</strong></p>
                    <p>• Verifique se está usando o arquivo correto do site ANEEL</p>
                    <p>• Se o arquivo tem cabeçalhos diferentes, tente renomeá-los</p>
                    <p>• Selecione a aba correta se for XLSX com múltiplas abas</p>
                  </div>
                </div>
              )}

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-center">
                  <div className="text-lg font-bold text-success font-mono">{validation.validRows.toLocaleString("pt-BR")}</div>
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

              {/* Row issues */}
              {totalIssueRows > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-warning" />
                    Problemas ({totalIssueRows} linha{totalIssueRows > 1 ? "s" : ""})
                  </h4>
                  <ScrollArea className="h-36 rounded-lg border">
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
                                  <span className="flex items-center gap-1 text-warning"><AlertTriangle className="w-3 h-3" /> Aviso</span>
                                )}
                                {row.status === "invalid" && (
                                  <span className="flex items-center gap-1 text-destructive"><XCircle className="w-3 h-3" /> Inválida</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5">
                                {row.errors.map((e, i) => <p key={`e${i}`} className="text-destructive">{e}</p>)}
                                {row.warnings.map((w, i) => <p key={`w${i}`} className="text-warning">{w}</p>)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                  {!showAllRows && totalIssueRows > 20 && (
                    <button onClick={() => setShowAllRows(true)} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                      <ChevronDown className="w-3 h-3" />
                      Mostrar todos os {totalIssueRows} problemas
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 text-[11px] text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  Todas as {validation.validRows.toLocaleString("pt-BR")} linhas são válidas.
                </div>
              )}

              {/* Discarded rows */}
              {(validation as any).discardedFooterRows?.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Descartadas ({(validation as any).discardedFooterRows.length})
                  </h4>
                  <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
                    {(validation as any).discardedFooterRows.slice(0, 5).map((d: any) => (
                      <div key={d.rowIndex} className="flex items-start gap-2 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[9px] shrink-0 font-mono">Linha {d.rowIndex}</Badge>
                        <span className="font-medium text-foreground/70">{d.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info box */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border text-[11px] text-muted-foreground">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <div className="space-y-1">
                  <p><strong>Próximo passo:</strong> os {validation.totalRows.toLocaleString("pt-BR")} registros serão agrupados por distribuidora + subgrupo + modalidade.</p>
                  <p>Apenas distribuidoras cadastradas serão atualizadas. Linhas inválidas são descartadas automaticamente.</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ─── Step: Preview ─── */}
        {step === "preview" && (
          <ScrollArea className="flex-1 max-h-[50vh]">
            <div className="space-y-3 pr-3">
              <div className="flex items-center gap-2">
                <Badge variant={fileTypeBadge as any} className="text-[10px]">{fileTypeLabel}</Badge>
                <span className="text-[10px] text-muted-foreground">{file?.name}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-lg font-bold font-mono">{parsed.length.toLocaleString("pt-BR")}</div>
                  <div className="text-[10px] text-muted-foreground">Registros</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-lg font-bold font-mono">{uniqueAgents}</div>
                  <div className="text-[10px] text-muted-foreground">No Arquivo</div>
                </div>
                <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-center">
                  <div className="text-lg font-bold text-success font-mono">{matchedAgentsPreview.length}</div>
                  <div className="text-[10px] text-success/80">Correspondidas</div>
                </div>
              </div>

              {/* Match rate */}
              {uniqueAgents > 0 && (
                <div className="p-2 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Taxa de mapeamento</span>
                    <span className="font-bold font-mono">
                      {Math.round((matchedAgentsPreview.length / uniqueAgents) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full"
                      style={{ width: `${(matchedAgentsPreview.length / uniqueAgents) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Matched list */}
              {matchedAgentsPreview.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-success flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Correspondidas ({matchedAgentsPreview.length})
                  </h4>
                  <ScrollArea className="h-24 rounded-lg border">
                    <div className="p-2 space-y-0.5">
                      {matchedAgentsPreview.map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px] py-0.5 px-2 rounded hover:bg-muted/30">
                          <span className="font-mono text-muted-foreground truncate max-w-[200px]">{m.agent}</span>
                          <span className="text-success font-medium truncate max-w-[200px]">→ {m.conc}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Unmatched */}
              {unmatchedAgents.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-warning flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Sem Correspondência ({unmatchedAgents.length})
                  </h4>
                  <ScrollArea className="h-16 rounded-lg border">
                    <div className="p-2 space-y-0.5">
                      {unmatchedAgents.map((a, i) => (
                        <div key={i} className="text-[10px] text-muted-foreground font-mono py-0.5 px-2">{a}</div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-[10px] text-muted-foreground italic">
                    Cadastre no Dicionário ANEEL para incluí-las na próxima importação.
                  </p>
                </div>
              )}

              {/* Sample data */}
              <ScrollArea className="h-28 rounded-lg border">
                <div className="p-2 space-y-0.5">
                  {parsed.slice(0, 30).map((r, i) => (
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
                  {parsed.length > 30 && (
                    <div className="text-[10px] text-muted-foreground text-center py-1">
                      … e mais {(parsed.length - 30).toLocaleString("pt-BR")} registros
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* 0 records diagnostic */}
              {parsed.length === 0 && debugInfo && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    Nenhum registro parseado — Diagnóstico
                  </div>
                  <div className="space-y-1.5 text-[10px] font-mono">
                    <div>
                      <span className="font-bold text-foreground">Cabeçalhos ({debugInfo.headers.length}):</span>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {debugInfo.headers.filter(h => h).map((h, i) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{h}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* ─── Step: Importing (progress) ─── */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Progress value={progress.percent} className="h-3 w-full max-w-md" />
            <div className="text-sm text-muted-foreground">
              Importando registros… {progress.current}/{progress.total} ({progress.percent}%)
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              Não feche esta janela durante a importação.
            </p>
          </div>
        )}

        {/* ─── Step: Done (with reports) ─── */}
        {step === "done" && result && (
          <ScrollArea className="flex-1 max-h-[55vh]">
            <div className="pr-3">
              {importReports ? (
                <ImportWizardReport
                  reports={importReports}
                  onClose={() => { reset(); onOpenChange(false); }}
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-success">
                    <CheckCircle2 className="w-5 h-5" />
                    Importação concluída
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
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {step === "validate" && (
            <>
              <Button variant="outline" size="sm" onClick={reset}>Voltar</Button>
              <Button size="sm" onClick={handleProceedToPreview} disabled={!canProceed} className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {canProceed
                  ? `Prosseguir (${validation?.validRows.toLocaleString("pt-BR") ?? 0} registros)`
                  : "Estrutura inválida — Corrija o arquivo"}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep("validate")}>Voltar</Button>
              <Button size="sm" onClick={handleImport} disabled={importing || parsed.length === 0} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Importar {parsed.length.toLocaleString("pt-BR")} registros
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
