import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, CheckCircle2, Upload, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MODULO_QUERY_KEY } from "./types";
import type { Modulo } from "./types";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import {
  dedupKeyNormalized,
  findSuspects,
  type SuspectMatch,
} from "@/utils/equipmentDedupUtils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingModulos: Modulo[];
}

interface ParsedRow {
  fabricante: string;
  modelo: string;
  potencia_wp: number;
  tipo_celula: string;
  num_celulas: number | null;
  eficiencia_percent: number | null;
  comprimento_mm: number | null;
  largura_mm: number | null;
  profundidade_mm: number | null;
  peso_kg: number | null;
  bifacial: boolean;
  vmp_v: number | null;
  imp_a: number | null;
  voc_v: number | null;
  isc_a: number | null;
  temp_coeff_pmax: number | null;
  temp_coeff_voc: number | null;
  temp_coeff_isc: number | null;
  status: string;
  errors: string[];
  warnings: string[];
}

function parseNumber(val: string | undefined): number | null {
  if (!val || val.trim() === "" || val === "-" || val === "N/A") return null;
  const cleaned = val.replace(",", ".").replace("%", "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseInt2(val: string | undefined): number | null {
  const n = parseNumber(val);
  return n !== null ? Math.round(n) : null;
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

function detectBifacial(modelo: string): boolean {
  return /bifacial/i.test(modelo);
}

function detectCellType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("topcon") || lower.includes("n-type topcon")) return "N-Type TOPCon";
  if (lower.includes("hjt")) return "N-Type HJT";
  if (lower.includes("hpbc")) return "N-Type HPBC";
  if (lower.includes("perc") || lower.includes("mono perc")) return "Mono PERC";
  if (lower.includes("poli") || lower.includes("poly")) return "Policristalino";
  if (lower.includes("mono")) return "Mono PERC";
  return raw || "Mono PERC";
}

function parseRows(text: string): ParsedRow[] {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const delim = detectDelimiter(text);
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase());

  const findCol = (...names: string[]) =>
    headers.findIndex(h => names.some(n => h.includes(n)));

  const colFab = findCol("fabricante", "manufacturer", "marca");
  const colMod = findCol("modelo", "model");
  const colPot = findCol("potencia", "potência", "power", "wp");
  const colTipo = findCol("tipo", "cell", "celula", "célula", "tecnologia", "technology");
  const colCells = findCol("celulas", "células", "cells", "nº");
  const colEff = findCol("eficiencia", "eficiência", "efficiency");
  const colComp = findCol("comprimento", "length", "comp");
  const colLarg = findCol("largura", "width", "larg");
  const colProf = findCol("profundidade", "depth", "prof", "espessura", "thickness");
  const colPeso = findCol("peso", "weight");
  const colVmp = findCol("vmp");
  const colImp = findCol("imp");
  const colVoc = findCol("voc");
  const colIsc = findCol("isc");
  const colTpmax = findCol("coeff_pmax", "pmax", "temp_pmax");
  const colTvoc = findCol("coeff_voc", "temp_voc");
  const colTisc = findCol("coeff_isc", "temp_isc");

  return lines.slice(1).map(line => {
    const cols = line.split(delim).map(c => c.trim());
    const get = (i: number) => i >= 0 ? cols[i] : undefined;

    const fabricante = get(colFab) || "";
    const modelo = get(colMod) || "";
    const potencia_wp = parseInt2(get(colPot)) || 0;
    const tipo_celula = detectCellType(get(colTipo) || "");
    const bifacial = detectBifacial(modelo);
    const vmp_v = parseNumber(get(colVmp));
    const imp_a = parseNumber(get(colImp));
    const voc_v = parseNumber(get(colVoc));
    const isc_a = parseNumber(get(colIsc));
    const comprimento_mm = parseInt2(get(colComp));
    const largura_mm = parseInt2(get(colLarg));

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!fabricante) errors.push("Fabricante vazio");
    if (!modelo) errors.push("Modelo vazio");
    if (!potencia_wp || potencia_wp < 100 || potencia_wp > 1000) errors.push("Potência inválida");

    const hasElectrical = vmp_v != null && imp_a != null && voc_v != null && isc_a != null;
    const hasDimensions = comprimento_mm != null && largura_mm != null;
    if (!hasElectrical) warnings.push("Dados elétricos incompletos → Rascunho");
    if (!hasDimensions) warnings.push("Dimensões incompletas → Rascunho");

    const status = (!hasElectrical || !hasDimensions) ? "rascunho" : "publicado";

    return {
      fabricante, modelo, potencia_wp, tipo_celula,
      num_celulas: parseInt2(get(colCells)),
      eficiencia_percent: parseNumber(get(colEff)),
      comprimento_mm, largura_mm,
      profundidade_mm: parseInt2(get(colProf)),
      peso_kg: parseNumber(get(colPeso)),
      bifacial,
      vmp_v, imp_a, voc_v, isc_a,
      temp_coeff_pmax: parseNumber(get(colTpmax)),
      temp_coeff_voc: parseNumber(get(colTvoc)),
      temp_coeff_isc: parseNumber(get(colTisc)),
      status, errors, warnings,
    };
  });
}

export function ModuloImportDialog({ open, onOpenChange, existingModulos }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [importSuspectIds, setImportSuspectIds] = useState<Set<number>>(new Set());
  const [verifyingAI, setVerifyingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });

  // Existing map with normalized keys
  const existingMap = useMemo(() => {
    const map = new Map<string, string>();
    existingModulos.forEach(m => map.set(dedupKeyNormalized(m.fabricante, m.modelo, m.potencia_wp), m.id));
    return map;
  }, [existingModulos]);

  const existingForSuspects = useMemo(() =>
    existingModulos.map(m => ({ id: m.id, fabricante: m.fabricante, modelo: m.modelo, potencia: m.potencia_wp })),
    [existingModulos]
  );

  const handleParse = () => {
    const rows = parseRows(rawText);
    if (rows.length === 0) {
      toast({ title: "Nenhum dado encontrado", description: "Verifique o formato (cabeçalho + linhas).", variant: "destructive" });
      return;
    }
    setParsed(rows);
    setImportSuspectIds(new Set());
  };

  // Classify with normalized dedup + suspect detection
  const { validRows, errorRows, dupeRows, suspectRows } = useMemo(() => {
    if (!parsed) return { validRows: [] as ParsedRow[], errorRows: [] as ParsedRow[], dupeRows: [] as ParsedRow[], suspectRows: [] as { row: ParsedRow; idx: number; match: SuspectMatch }[] };

    const validRows: ParsedRow[] = [];
    const errorRows: ParsedRow[] = [];
    const dupeRows: ParsedRow[] = [];
    const suspectRows: { row: ParsedRow; idx: number; match: SuspectMatch }[] = [];

    parsed.forEach((r, idx) => {
      if (r.errors.length > 0) {
        errorRows.push(r);
        return;
      }
      const key = dedupKeyNormalized(r.fabricante, r.modelo, r.potencia_wp);
      if (existingMap.has(key)) {
        dupeRows.push(r);
      } else {
        const suspect = findSuspects(r.fabricante, r.modelo, r.potencia_wp, existingForSuspects);
        if (suspect) {
          suspectRows.push({ row: r, idx, match: suspect });
        } else {
          validRows.push(r);
        }
      }
    });

    return { validRows, errorRows, dupeRows, suspectRows };
  }, [parsed, existingMap, existingForSuspects]);

  const handleVerifyWithAI = useCallback(async () => {
    if (suspectRows.length === 0) return;
    setVerifyingAI(true);
    setAiProgress({ current: 0, total: suspectRows.length });
    const newImport = new Set(importSuspectIds);

    for (let i = 0; i < suspectRows.length; i++) {
      const s = suspectRows[i];
      try {
        const { data } = await supabase.functions.invoke("ai-generate", {
          body: {
            systemPrompt: "Você é um especialista em equipamentos solares. Responda APENAS: SIM ou NAO.",
            userPrompt: `São o mesmo produto solar?\nItem 1: ${s.row.fabricante} ${s.row.modelo} ${s.row.potencia_wp}Wp\nItem 2: ${s.match.existingFabricante} ${s.match.existingModelo} ${s.match.existingPotencia}Wp\nResponda APENAS: SIM ou NAO`,
            functionName: "import-dedup-verify",
            userId: "system",
            tenantId: "system",
          },
        });
        if (data?.content) {
          const answer = data.content.trim().toUpperCase();
          if (!answer.includes("SIM")) newImport.add(s.idx);
        }
      } catch { /* keep as suspect */ }
      setAiProgress(prev => ({ ...prev, current: prev.current + 1 }));
      if (i < suspectRows.length - 1 && (i + 1) % 5 === 0) await new Promise(r => setTimeout(r, 1000));
    }

    setImportSuspectIds(newImport);
    setVerifyingAI(false);
    toast({ title: "Verificação IA concluída" });
  }, [suspectRows, importSuspectIds, toast]);

  const handleImport = async () => {
    const suspectsToImport = suspectRows.filter(s => importSuspectIds.has(s.idx)).map(s => s.row);
    const allToInsert = [...validRows, ...suspectsToImport];
    if (allToInsert.length === 0) return;
    setImporting(true);
    try {
      const { tenantId } = await getCurrentTenantId();
      const batch = allToInsert.map(({ errors, warnings, ...row }) => ({
        ...row,
        tenant_id: tenantId,
      }));
      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        const { error } = await supabase.from("modulos_solares").insert(chunk as any);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: [...MODULO_QUERY_KEY] });
      toast({ title: `${allToInsert.length} módulos importados com sucesso` });
      onOpenChange(false);
      setParsed(null);
      setRawText("");
      setImportSuspectIds(new Set());
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawText(ev.target?.result as string || "");
      setParsed(null);
      setImportSuspectIds(new Set());
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (!rawText.trim()) {
      toast({ title: "Cole os dados primeiro", variant: "destructive" });
      return;
    }
    setBulkImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-import-modules", {
        body: { raw_text: rawText },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro na importação");
      qc.invalidateQueries({ queryKey: [...MODULO_QUERY_KEY] });
      toast({
        title: `${data.imported} módulos importados`,
        description: `${data.skipped_duplicates} duplicados ignorados. ${data.errors} erros.`,
      });
      onOpenChange(false);
      setParsed(null);
      setRawText("");
    } catch (err: any) {
      toast({ title: "Erro na importação em massa", description: err.message, variant: "destructive" });
    } finally {
      setBulkImporting(false);
    }
  };

  const toggleSuspect = (idx: number, checked: boolean) => {
    setImportSuspectIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(idx); else next.delete(idx);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setParsed(null); setRawText(""); setImportSuspectIds(new Set()); } onOpenChange(v); }}>
      <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Colar Planilha de Módulos</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Cole uma tabela (TSV/CSV) ou faça upload de um arquivo</p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {!parsed ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <label>
                      <Upload className="w-4 h-4" /> Upload CSV
                      <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </Button>
                </div>
                <Textarea
                  placeholder={"Fabricante\tModelo\tPotencia\tTipo\tEficiencia\t...\nCanadian Solar\tCS7N-665MS\t665\tMono PERC\t22.5\t..."}
                  rows={12}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{parsed.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-success">{validRows.length}</p>
                    <p className="text-xs text-muted-foreground">Novos</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-warning">{suspectRows.length}</p>
                    <p className="text-xs text-muted-foreground">Suspeitos</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-warning">{dupeRows.length}</p>
                    <p className="text-xs text-muted-foreground">Duplicados</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{errorRows.length}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                </div>

                {/* Suspects */}
                {suspectRows.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-warning">
                        🟡 {suspectRows.length} suspeitos (similaridade ≥85%)
                      </p>
                      <Button variant="outline" size="sm" onClick={handleVerifyWithAI} disabled={verifyingAI} className="text-xs h-7 gap-1 shrink-0">
                        {verifyingAI ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> {aiProgress.current}/{aiProgress.total}</>
                        ) : (
                          <><Sparkles className="w-3 h-3" /> Verificar com IA</>
                        )}
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {suspectRows.map((s) => (
                        <label key={s.idx} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-warning/10 rounded px-1 py-0.5">
                          <Checkbox checked={importSuspectIds.has(s.idx)} onCheckedChange={(c) => toggleSuspect(s.idx, !!c)} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground">{s.row.fabricante} {s.row.modelo} ({s.row.potencia_wp}Wp)</span>
                            <p className="text-muted-foreground text-[10px] truncate">
                              Similar a: {s.match.existingFabricante} {s.match.existingModelo} ({Math.round(s.match.score * 100)}%)
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20 shrink-0">Suspeito</Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {dupeRows.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <p className="text-sm font-medium text-warning">
                      {dupeRows.length} duplicados detectados (serão ignorados)
                    </p>
                  </div>
                )}

                {/* Preview table */}
                <div className="max-h-[300px] overflow-x-auto overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left">#</th>
                        <th className="px-2 py-1.5 text-left">Fabricante</th>
                        <th className="px-2 py-1.5 text-left">Modelo</th>
                        <th className="px-2 py-1.5 text-left">W</th>
                        <th className="px-2 py-1.5 text-left">Status</th>
                        <th className="px-2 py-1.5 text-left">Problemas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.slice(0, 50).map((r, i) => {
                        const key = dedupKeyNormalized(r.fabricante, r.modelo, r.potencia_wp);
                        const isDupe = existingMap.has(key);
                        return (
                          <tr key={i} className={r.errors.length > 0 ? "bg-destructive/5" : isDupe ? "bg-warning/5" : ""}>
                            <td className="px-2 py-1">{i + 1}</td>
                            <td className="px-2 py-1">{r.fabricante}</td>
                            <td className="px-2 py-1 max-w-[200px] truncate">{r.modelo}</td>
                            <td className="px-2 py-1">{r.potencia_wp}</td>
                            <td className="px-2 py-1">
                              {r.errors.length > 0 ? (
                                <Badge variant="destructive" className="text-xs">Erro</Badge>
                              ) : isDupe ? (
                                <Badge variant="outline" className="text-xs text-warning">Duplicado</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />{r.status}
                                </Badge>
                              )}
                            </td>
                            <td className="px-2 py-1 text-muted-foreground">
                              {[...r.errors, ...r.warnings].join("; ")}
                            </td>
                          </tr>
                        );
                      })}
                      {parsed.length > 50 && (
                        <tr>
                          <td colSpan={6} className="px-2 py-2 text-center text-muted-foreground">
                            ...e mais {parsed.length - 50} linhas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {validRows.length} novos · {suspectRows.length} suspeitos ({importSuspectIds.size} para importar) · {dupeRows.length} duplicados · {errorRows.length} erros
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          {!parsed ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button variant="secondary" onClick={handleBulkImport} disabled={!rawText.trim() || bulkImporting} className="gap-2">
                {bulkImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {bulkImporting ? "Importando..." : "Importação Rápida"}
              </Button>
              <Button onClick={handleParse} disabled={!rawText.trim()}>Analisar Dados</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => { setParsed(null); setImportSuspectIds(new Set()); }}>Voltar</Button>
              <Button onClick={handleImport} disabled={(validRows.length === 0 && importSuspectIds.size === 0) || importing} className="gap-2">
                {importing ? "Importando..." : `Importar ${validRows.length + importSuspectIds.size} módulos`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
