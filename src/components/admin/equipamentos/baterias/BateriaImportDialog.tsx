/**
 * Dialog de importação de baterias via CSV.
 * Dedup normalizado + detecção de suspeitos via Levenshtein + verificação IA
 */
import { useState, useMemo, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle, CheckCircle2, Upload, Loader2, FileSpreadsheet, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import {
  dedupKeyNormalized,
  findSuspects,
  type SuspectMatch,
} from "@/utils/equipmentDedupUtils";
import {
  parseDistributorCSV,
} from "../modulos/parseDistributorCSV";

interface Bateria {
  id: string;
  fabricante: string;
  modelo: string;
  energia_kwh: number | null;
  tipo_bateria: string | null;
  tensao_nominal_v: number | null;
  ativo: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingBaterias: Bateria[];
}

interface ParsedBateria {
  fabricante: string;
  modelo: string;
  energia_kwh: number;
  tipo_bateria: string;
  tensao_nominal_v: number | null;
}

const BATCH_SIZE = 50;

function parseNumber(val: string | undefined): number | null {
  if (!val || val.trim() === "" || val === "-") return null;
  const cleaned = val.replace(",", ".").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split("\n")[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  if (tabCount >= semiCount && tabCount >= commaCount) return "\t";
  if (semiCount >= commaCount) return ";";
  return ",";
}

/** Detecta se o CSV é formato distribuidora (Categoria;Item;...) ou simples */
function isDistributorFormat(text: string): boolean {
  const firstLine = text.split("\n")[0]?.toLowerCase() || "";
  return firstLine.includes("categoria") && firstLine.includes("item");
}

/** Extrai energia em kWh do nome do modelo de bateria */
function extractEnergyFromModel(item: string): number | null {
  // Padrão: número com decimal seguido de kWh ou KWH
  const kwhMatch = item.match(/(\d+\.?\d*)\s*[Kk][Ww][Hh]/);
  if (kwhMatch) return parseFloat(kwhMatch[1]);

  // Padrão: número decimal isolado que parece capacidade (ex: "HVS 10.2" → 10.2)
  const decimalMatch = item.match(/\b(\d+\.\d+)\b/);
  if (decimalMatch) {
    const val = parseFloat(decimalMatch[1]);
    if (val >= 1 && val <= 500) return val;
  }

  // Padrão: US3000C → 3000 Wh = 3 kWh
  const whMatch = item.match(/(\d{4,5})[A-Za-z]/);
  if (whMatch) {
    const wh = parseInt(whMatch[1]);
    if (wh >= 1000 && wh <= 50000) return wh / 1000;
  }

  return null;
}

function extractCsvCategories(text: string): string[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const categories = [...new Set(lines.slice(1).map(line => line.split(";")[0]?.trim()).filter(Boolean))];
  console.log("[parseCSV] Categorias encontradas:", categories);
  return categories;
}

/** Parse formato distribuidora para baterias */
function parseDistributorBateria(text: string): { baterias: ParsedBateria[]; warnings: { line: number; issue: string }[]; categories: string[] } {
  const categories = extractCsvCategories(text);
  const batteryCategories = ["bateria", "armazenamento", "storage", "battery", "acumulador", "banco de energia"];
  const matchingCategories = categories.filter(category => batteryCategories.some(term => category.toLowerCase().includes(term)));

  let base = parseDistributorCSV(text, "Bateria" as any);
  if (base.modules.length === 0) {
    base = parseDistributorCSV(text, "Armazenamento" as any);
  }

  const baterias: ParsedBateria[] = [];
  const warnings: { line: number; issue: string }[] = base.warnings.map(w => ({
    line: w.line, issue: w.issue,
  }));

  if (matchingCategories.length === 0) {
    warnings.push({ line: 0, issue: `Nenhuma bateria encontrada. Categorias no arquivo: ${categories.join(", ") || "nenhuma"}` });
  }

  const seenKeys = new Set<string>();

  base.modules.forEach((m, idx) => {
    const key = `${m.fabricante}|${m.modelo}`.toLowerCase();
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    const fullName = `${m.fabricante} ${m.modelo}`;
    const energia_kwh = extractEnergyFromModel(fullName) ?? 0;

    if (energia_kwh <= 0) {
      warnings.push({ line: idx + 2, issue: `Energia não detectada: "${fullName}"` });
    }

    baterias.push({
      fabricante: m.fabricante,
      modelo: m.modelo,
      energia_kwh,
      tipo_bateria: "LFP",
      tensao_nominal_v: null,
    });
  });

  return { baterias, warnings, categories };
}

function parseBateriaCSV(text: string): { baterias: ParsedBateria[]; warnings: { line: number; issue: string }[]; categories: string[] } {
  if (isDistributorFormat(text)) {
    return parseDistributorBateria(text);
  }

  const lines = text.split("\n").filter(l => l.trim());
  const categories = extractCsvCategories(text);
  if (lines.length < 2) return { baterias: [], warnings: [], categories };

  const delim = detectDelimiter(text);
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase());

  const findCol = (...names: string[]) =>
    headers.findIndex(h => names.some(n => h.includes(n)));

  const colFab = findCol("fabricante", "manufacturer", "marca");
  const colMod = findCol("modelo", "model");
  const colEnergy = findCol("energia", "energy", "kwh", "capacidade");
  const colType = findCol("tipo", "type", "tecnologia");
  const colVoltage = findCol("tensao", "tensão", "voltage", "nominal");

  const baterias: ParsedBateria[] = [];
  const warnings: { line: number; issue: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(c => c.trim());
    const get = (idx: number) => idx >= 0 ? cols[idx] : undefined;

    const fabricante = get(colFab) || "";
    const modelo = get(colMod) || "";
    let energia_kwh = parseNumber(get(colEnergy)) ?? 0;
    const tipo_bateria = get(colType) || "LFP";
    const tensao_nominal_v = parseNumber(get(colVoltage));

    if (!fabricante || !modelo) {
      warnings.push({ line: i + 1, issue: "Fabricante ou modelo vazio" });
      continue;
    }

    if (energia_kwh <= 0) {
      energia_kwh = extractEnergyFromModel(`${fabricante} ${modelo}`) ?? 0;
    }

    if (energia_kwh <= 0) {
      warnings.push({ line: i + 1, issue: `Energia não detectada: "${fabricante} ${modelo}"` });
    }

    baterias.push({ fabricante, modelo, energia_kwh, tipo_bateria, tensao_nominal_v });
  }

  return { baterias, warnings, categories };
}

export function BateriaImportDialog({ open, onOpenChange, existingBaterias }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<{ baterias: ParsedBateria[]; warnings: { line: number; issue: string }[]; categories: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [overwriteIds, setOverwriteIds] = useState<Set<number>>(new Set());
  const [importSuspectIds, setImportSuspectIds] = useState<Set<number>>(new Set());
  const [verifyingAI, setVerifyingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{
    inserted: number; updated: number; skipped: number; errors: number;
  } | null>(null);

  const existingMap = useMemo(() => {
    const map = new Map<string, string>();
    existingBaterias.forEach(b => map.set(dedupKeyNormalized(b.fabricante, b.modelo, b.energia_kwh ?? 0), b.id));
    return map;
  }, [existingBaterias]);

  const existingForSuspects = useMemo(() =>
    existingBaterias.map(b => ({ id: b.id, fabricante: b.fabricante, modelo: b.modelo, potencia: b.energia_kwh ?? 0 })),
    [existingBaterias]
  );

  const { newItems, suspectItems, duplicateItems } = useMemo(() => {
    if (!parseResult) return {
      newItems: [] as ParsedBateria[],
      suspectItems: [] as { item: ParsedBateria; idx: number; match: SuspectMatch }[],
      duplicateItems: [] as { item: ParsedBateria; idx: number; existingId: string }[],
    };
    const newItems: ParsedBateria[] = [];
    const suspectItems: { item: ParsedBateria; idx: number; match: SuspectMatch }[] = [];
    const duplicateItems: { item: ParsedBateria; idx: number; existingId: string }[] = [];
    parseResult.baterias.forEach((b, idx) => {
      const key = dedupKeyNormalized(b.fabricante, b.modelo, b.energia_kwh);
      const existingId = existingMap.get(key);
      if (existingId) {
        duplicateItems.push({ item: b, idx, existingId });
      } else {
        const suspect = findSuspects(b.fabricante, b.modelo, b.energia_kwh, existingForSuspects);
        if (suspect) suspectItems.push({ item: b, idx, match: suspect });
        else newItems.push(b);
      }
    });
    return { newItems, suspectItems, duplicateItems };
  }, [parseResult, existingMap, existingForSuspects]);

  const toggleOverwrite = (idx: number, checked: boolean) => {
    setOverwriteIds(prev => { const next = new Set(prev); if (checked) next.add(idx); else next.delete(idx); return next; });
  };
  const toggleSuspect = (idx: number, checked: boolean) => {
    setImportSuspectIds(prev => { const next = new Set(prev); if (checked) next.add(idx); else next.delete(idx); return next; });
  };
  const selectAllDuplicates = () => {
    if (overwriteIds.size === duplicateItems.length) setOverwriteIds(new Set());
    else setOverwriteIds(new Set(duplicateItems.map(d => d.idx)));
  };

  const handleVerifyWithAI = useCallback(async () => {
    if (suspectItems.length === 0) return;
    setVerifyingAI(true);
    setAiProgress({ current: 0, total: suspectItems.length });
    const newImport = new Set(importSuspectIds);
    for (let i = 0; i < suspectItems.length; i++) {
      const s = suspectItems[i];
      try {
        const { data } = await supabase.functions.invoke("ai-generate", {
          body: {
            systemPrompt: "Você é um especialista em equipamentos solares. Responda APENAS: SIM ou NAO.",
            userPrompt: `São a mesma bateria?\nItem 1: ${s.item.fabricante} ${s.item.modelo} ${s.item.energia_kwh}kWh\nItem 2: ${s.match.existingFabricante} ${s.match.existingModelo} ${s.match.existingPotencia}kWh\nResponda APENAS: SIM ou NAO`,
            functionName: "import-dedup-verify", userId: "system", tenantId: "system",
          },
        });
        if (data?.content && !data.content.trim().toUpperCase().includes("SIM")) newImport.add(s.idx);
      } catch { /* keep as suspect */ }
      setAiProgress(prev => ({ ...prev, current: prev.current + 1 }));
      if (i < suspectItems.length - 1 && (i + 1) % 5 === 0) await new Promise(r => setTimeout(r, 1000));
    }
    setImportSuspectIds(newImport);
    setVerifyingAI(false);
    toast({ title: "Verificação IA concluída" });
  }, [suspectItems, importSuspectIds, toast]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);
    setOverwriteIds(new Set());
    setImportSuspectIds(new Set());
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string || "";
      setParseResult(parseBateriaCSV(text));
    };
    reader.readAsText(file, "ISO-8859-1");
  };

  const handleImport = async () => {
    const suspectsToImport = suspectItems.filter(s => importSuspectIds.has(s.idx));
    const toInsert = [...newItems, ...suspectsToImport.map(s => s.item)];
    const toUpdate = duplicateItems.filter(d => overwriteIds.has(d.idx));
    if (toInsert.length === 0 && toUpdate.length === 0) return;
    setImporting(true); setProgress(0);

    try {
      const { tenantId } = await getCurrentTenantId();
      let inserted = 0, updated = 0, errors = 0;
      const insertPayloads = toInsert.map(b => ({
        fabricante: b.fabricante, modelo: b.modelo,
        energia_kwh: b.energia_kwh || null,
        tipo_bateria: b.tipo_bateria || null,
        tensao_nominal_v: b.tensao_nominal_v,
        ativo: true, tenant_id: tenantId,
      }));
      const totalOps = insertPayloads.length + toUpdate.length;

      for (let i = 0; i < insertPayloads.length; i += BATCH_SIZE) {
        const chunk = insertPayloads.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("baterias").insert(chunk as any);
        if (error) errors += chunk.length; else inserted += chunk.length;
        setProgress(Math.round(((i + chunk.length) / totalOps) * 100));
      }

      for (const dup of toUpdate) {
        const { error } = await supabase.from("baterias").update({
          energia_kwh: dup.item.energia_kwh || null,
          tipo_bateria: dup.item.tipo_bateria || null,
          tensao_nominal_v: dup.item.tensao_nominal_v,
        }).eq("id", dup.existingId);
        if (error) errors++; else updated++;
        setProgress(Math.round(((insertPayloads.length + toUpdate.indexOf(dup) + 1) / totalOps) * 100));
      }

      qc.invalidateQueries({ queryKey: ["baterias"] });
      const skipped = duplicateItems.length - toUpdate.length + suspectItems.length - suspectsToImport.length;
      setImportResult({ inserted, updated, skipped, errors });
      toast({
        title: "Importação concluída",
        description: [
          `${inserted} inseridas`, `${updated} atualizadas`, `${skipped} ignoradas`,
          errors > 0 ? `${errors} erros` : null,
        ].filter(Boolean).join(" · "),
      });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  const handleClose = () => {
    setParseResult(null); setFileName(""); setImportResult(null);
    setProgress(0); setOverwriteIds(new Set()); setImportSuspectIds(new Set()); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="w-[90vw] max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Importar Baterias — CSV</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Colunas: Fabricante, Modelo, Energia (kWh), Tipo, Tensão (V)</p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {!parseResult && !importResult && (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Selecione o arquivo CSV com as baterias</p>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <label className="cursor-pointer">
                    <Upload className="w-4 h-4" /> Selecionar arquivo CSV
                    <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileUpload} />
                  </label>
                </Button>
              </div>
            )}

            {parseResult && !importResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-success">{newItems.length}</p>
                    <p className="text-xs text-muted-foreground">Novas</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-500">{suspectItems.length}</p>
                    <p className="text-xs text-muted-foreground">Suspeitas</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-warning">{duplicateItems.length}</p>
                    <p className="text-xs text-muted-foreground">Duplicadas</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{parseResult.baterias.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>

                {suspectItems.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">🟡 {suspectItems.length} suspeitas</p>
                      <Button variant="outline" size="sm" onClick={handleVerifyWithAI} disabled={verifyingAI} className="text-xs h-7 gap-1">
                        {verifyingAI ? <><Loader2 className="w-3 h-3 animate-spin" /> {aiProgress.current}/{aiProgress.total}</> : <><Sparkles className="w-3 h-3" /> Verificar com IA</>}
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {suspectItems.map((s) => (
                        <label key={s.idx} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-yellow-500/10 rounded px-1 py-0.5">
                          <Checkbox checked={importSuspectIds.has(s.idx)} onCheckedChange={(c) => toggleSuspect(s.idx, !!c)} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground">{s.item.fabricante} {s.item.modelo} ({s.item.energia_kwh}kWh)</span>
                            <p className="text-muted-foreground text-[10px] truncate">Similar a: {s.match.existingFabricante} {s.match.existingModelo} ({Math.round(s.match.score * 100)}%)</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {duplicateItems.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-warning">{duplicateItems.length} duplicadas</p>
                      <Button variant="ghost" size="sm" onClick={selectAllDuplicates} className="text-xs h-7">
                        {overwriteIds.size === duplicateItems.length ? "Desmarcar todas" : "Selecionar todas"}
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {duplicateItems.map((d) => (
                        <label key={d.idx} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-warning/10 rounded px-1 py-0.5">
                          <Checkbox checked={overwriteIds.has(d.idx)} onCheckedChange={(c) => toggleOverwrite(d.idx, !!c)} />
                          <span className="text-foreground">{d.item.fabricante} {d.item.modelo} ({d.item.energia_kwh}kWh)</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {parseResult.baterias.length === 0 && parseResult.categories.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1">
                    <p className="text-sm font-medium text-warning">Nenhuma bateria encontrada</p>
                    <p className="text-xs text-muted-foreground">Categorias no arquivo: {parseResult.categories.join(", ")}</p>
                  </div>
                )}

                {parseResult.warnings.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1">
                    <p className="text-sm font-medium text-warning flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{parseResult.warnings.length} avisos</p>
                    <div className="max-h-24 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                      {parseResult.warnings.slice(0, 20).map((w, i) => (<p key={i}>{w.line > 0 ? `Linha ${w.line}: ` : ""}{w.issue}</p>))}
                    </div>
                  </div>
                )}

                {newItems.length > 0 && (
                  <div className="max-h-[200px] overflow-x-auto overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-foreground">#</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Fabricante</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Modelo</th>
                          <th className="px-2 py-1.5 text-left text-foreground">kWh</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newItems.slice(0, 50).map((b, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                            <td className="px-2 py-1 font-medium text-foreground">{b.fabricante}</td>
                            <td className="px-2 py-1 max-w-[200px] truncate text-foreground">{b.modelo}</td>
                            <td className="px-2 py-1 text-foreground">{b.energia_kwh || "—"}</td>
                            <td className="px-2 py-1"><Badge variant="outline" className="text-xs">{b.tipo_bateria}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  {newItems.length} novas · {suspectItems.length} suspeitas ({importSuspectIds.size} para importar) · {duplicateItems.length} duplicadas ({overwriteIds.size} para sobrescrever)
                </p>

                {importing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">Importando... {progress}%</p>
                  </div>
                )}
              </div>
            )}

            {importResult && (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                <p className="text-lg font-semibold text-foreground">Importação concluída</p>
                <p className="text-sm text-muted-foreground">
                  {importResult.inserted} inseridas · {importResult.updated} atualizadas · {importResult.skipped} ignoradas
                  {importResult.errors > 0 && ` · ${importResult.errors} erros`}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
          {importResult ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : parseResult ? (
            <>
              <Button variant="ghost" onClick={() => { setParseResult(null); setFileName(""); setOverwriteIds(new Set()); setImportSuspectIds(new Set()); }} disabled={importing}>Voltar</Button>
              <Button onClick={handleImport} disabled={(newItems.length === 0 && overwriteIds.size === 0 && importSuspectIds.size === 0) || importing} className="gap-2">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : `Importar ${newItems.length + overwriteIds.size + importSuspectIds.size} baterias`}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
