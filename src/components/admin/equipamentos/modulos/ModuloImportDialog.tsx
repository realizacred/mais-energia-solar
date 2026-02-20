import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MODULO_QUERY_KEY } from "./types";
import type { Modulo } from "./types";

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
  tensao_sistema: string;
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
  isDuplicate: boolean;
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

function parseRows(text: string, existing: Modulo[]): ParsedRow[] {
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
  const colTensao = findCol("tensao", "tensão", "voltage", "system");

  const existingKeys = new Set(
    existing.map(m => `${m.fabricante}|${m.modelo}|${m.potencia_wp}`.toLowerCase())
  );

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
    if (!potencia_wp || potencia_wp < 100 || potencia_wp > 900) errors.push("Potência inválida");

    const hasElectrical = vmp_v != null && imp_a != null && voc_v != null && isc_a != null;
    const hasDimensions = comprimento_mm != null && largura_mm != null;
    if (!hasElectrical) warnings.push("Dados elétricos incompletos → Rascunho");
    if (!hasDimensions) warnings.push("Dimensões incompletas → Rascunho");

    const key = `${fabricante}|${modelo}|${potencia_wp}`.toLowerCase();
    const isDuplicate = existingKeys.has(key);
    if (isDuplicate) warnings.push("Duplicado (já existe)");

    const status = (!hasElectrical || !hasDimensions) ? "rascunho" : "publicado";

    return {
      fabricante, modelo, potencia_wp, tipo_celula,
      num_celulas: parseInt2(get(colCells)),
      tensao_sistema: get(colTensao) || "1500V",
      eficiencia_percent: parseNumber(get(colEff)),
      comprimento_mm, largura_mm,
      profundidade_mm: parseInt2(get(colProf)),
      peso_kg: parseNumber(get(colPeso)),
      bifacial,
      vmp_v, imp_a, voc_v, isc_a,
      temp_coeff_pmax: parseNumber(get(colTpmax)),
      temp_coeff_voc: parseNumber(get(colTvoc)),
      temp_coeff_isc: parseNumber(get(colTisc)),
      status, errors, warnings, isDuplicate,
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

  const handleParse = () => {
    const rows = parseRows(rawText, existingModulos);
    if (rows.length === 0) {
      toast({ title: "Nenhum dado encontrado", description: "Verifique o formato (cabeçalho + linhas).", variant: "destructive" });
      return;
    }
    setParsed(rows);
  };

  const validRows = parsed?.filter(r => r.errors.length === 0 && !r.isDuplicate) || [];
  const errorRows = parsed?.filter(r => r.errors.length > 0) || [];
  const dupeRows = parsed?.filter(r => r.isDuplicate && r.errors.length === 0) || [];

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const batch = validRows.map(({ errors, warnings, isDuplicate, ...row }) => row);
      // Insert in batches of 100
      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        const { error } = await supabase.from("modulos_solares").insert(chunk as any);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: [...MODULO_QUERY_KEY] });
      toast({ title: `${validRows.length} módulos importados com sucesso` });
      onOpenChange(false);
      setParsed(null);
      setRawText("");
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

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setParsed(null); setRawText(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Módulos em Massa</DialogTitle>
        </DialogHeader>

        {!parsed ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cole uma tabela (TSV/CSV) ou faça upload de um arquivo CSV.
              A primeira linha deve conter os cabeçalhos.
            </p>
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
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button variant="secondary" onClick={handleBulkImport} disabled={!rawText.trim() || bulkImporting} className="gap-2">
                {bulkImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {bulkImporting ? "Importando..." : "Importação Rápida (servidor)"}
              </Button>
              <Button onClick={handleParse} disabled={!rawText.trim()}>Analisar Dados</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{parsed.length}</p>
                <p className="text-xs text-muted-foreground">Total de linhas</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{validRows.length}</p>
                <p className="text-xs text-muted-foreground">Válidos para importar</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{errorRows.length}</p>
                <p className="text-xs text-muted-foreground">Com erros</p>
              </div>
            </div>

            {dupeRows.length > 0 && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/10 p-3">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                  {dupeRows.length} duplicados detectados (serão ignorados)
                </p>
              </div>
            )}

            {/* Preview table */}
            <div className="max-h-[300px] overflow-auto border rounded-lg">
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
                  {parsed.slice(0, 50).map((r, i) => (
                    <tr key={i} className={r.errors.length > 0 ? "bg-destructive/5" : r.isDuplicate ? "bg-yellow-50 dark:bg-yellow-900/5" : ""}>
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1">{r.fabricante}</td>
                      <td className="px-2 py-1 max-w-[200px] truncate">{r.modelo}</td>
                      <td className="px-2 py-1">{r.potencia_wp}</td>
                      <td className="px-2 py-1">
                        {r.errors.length > 0 ? (
                          <Badge variant="destructive" className="text-xs">Erro</Badge>
                        ) : r.isDuplicate ? (
                          <Badge variant="outline" className="text-xs text-yellow-600">Duplicado</Badge>
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
                  ))}
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

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setParsed(null)}>Voltar</Button>
              <Button onClick={handleImport} disabled={validRows.length === 0 || importing}>
                {importing ? "Importando..." : `Importar ${validRows.length} módulos`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
