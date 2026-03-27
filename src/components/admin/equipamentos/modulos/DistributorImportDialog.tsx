import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle, CheckCircle2, Upload, Loader2, FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MODULO_QUERY_KEY } from "./types";
import type { Modulo } from "./types";
import {
  parseDistributorCSV,
  type ParseResult,
  type ParsedDistributorModule,
} from "./parseDistributorCSV";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingModulos: Modulo[];
}

const BATCH_SIZE = 50;

function extractDistributors(headerLine: string): string[] {
  const cols = headerLine.split(";").map(c => c.trim());
  const names: string[] = [];
  for (let i = 2; i < cols.length; i++) {
    const col = cols[i];
    const match = col.match(/^\d+\s*-\s*(.+)$/);
    if (match) names.push(match[1].trim());
    else if (col && col !== "") names.push(col);
  }
  return [...new Set(names)];
}

/** Dedup key: fabricante|modelo|potencia_wp (lowercase) */
function dedupKey(fabricante: string, modelo: string, potencia: number): string {
  return `${fabricante}|${modelo}|${potencia}`.toLowerCase();
}

export function DistributorImportDialog({ open, onOpenChange, existingModulos }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [distributorNames, setDistributorNames] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [overwriteIds, setOverwriteIds] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<{
    inserted: number; updated: number; skipped: number; errors: number; fornecedores: number;
  } | null>(null);

  // Existing dedup map: key → existing record id
  const existingMap = useMemo(() => {
    const map = new Map<string, string>();
    existingModulos.forEach(m => map.set(dedupKey(m.fabricante, m.modelo, m.potencia_wp), m.id));
    return map;
  }, [existingModulos]);

  // Classify parsed items
  const { newItems, duplicateItems, errorItems } = useMemo(() => {
    if (!parseResult) return { newItems: [] as ParsedDistributorModule[], duplicateItems: [] as { item: ParsedDistributorModule; idx: number; existingId: string }[], errorItems: [] as { item: ParsedDistributorModule; idx: number; issue: string }[] };

    const newItems: ParsedDistributorModule[] = [];
    const duplicateItems: { item: ParsedDistributorModule; idx: number; existingId: string }[] = [];
    const errorItems: { item: ParsedDistributorModule; idx: number; issue: string }[] = [];

    parseResult.modules.forEach((m, idx) => {
      if (!m.fabricante || !m.modelo) {
        errorItems.push({ item: m, idx, issue: "Fabricante ou modelo vazio" });
        return;
      }
      const key = dedupKey(m.fabricante, m.modelo, m.potencia_wp);
      const existingId = existingMap.get(key);
      if (existingId) {
        duplicateItems.push({ item: m, idx, existingId });
      } else {
        newItems.push(m);
      }
    });

    return { newItems, duplicateItems, errorItems };
  }, [parseResult, existingMap]);

  const toggleOverwrite = (idx: number, checked: boolean) => {
    setOverwriteIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(idx); else next.delete(idx);
      return next;
    });
  };

  const selectAllDuplicates = () => {
    if (overwriteIds.size === duplicateItems.length) {
      setOverwriteIds(new Set());
    } else {
      setOverwriteIds(new Set(duplicateItems.map(d => d.idx)));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);
    setOverwriteIds(new Set());

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string || "";
      const firstLine = text.split("\n")[0] || "";
      setDistributorNames(extractDistributors(firstLine));
      const result = parseDistributorCSV(text, "Módulo");
      setParseResult(result);
    };
    reader.readAsText(file, "ISO-8859-1");
  };

  const importFornecedores = async (tenantId: string): Promise<number> => {
    if (distributorNames.length === 0) return 0;
    const { data: existing } = await supabase
      .from("fornecedores").select("nome").eq("tenant_id", tenantId).eq("tipo", "distribuidor");
    const existingNames = new Set((existing || []).map(f => f.nome.toLowerCase()));
    const toCreate = distributorNames.filter(name => !existingNames.has(name.toLowerCase()));
    if (toCreate.length === 0) return 0;
    const { error } = await supabase.from("fornecedores").insert(toCreate.map(nome => ({
      nome, tipo: "distribuidor", tenant_id: tenantId, ativo: true,
    })));
    if (error) { console.error("Erro ao criar fornecedores:", error.message); return 0; }
    return toCreate.length;
  };

  const handleImport = async () => {
    const toInsert = newItems;
    const toUpdate = duplicateItems.filter(d => overwriteIds.has(d.idx));
    if (toInsert.length === 0 && toUpdate.length === 0) return;

    setImporting(true);
    setProgress(0);

    try {
      const { tenantId } = await getCurrentTenantId();
      const fornecedoresCriados = await importFornecedores(tenantId);

      let inserted = 0;
      let updated = 0;
      let errors = 0;

      // Insert new items
      const insertPayloads = toInsert.map(m => ({
        fabricante: m.fabricante, modelo: m.modelo, potencia_wp: m.potencia_wp,
        bifacial: m.bifacial, tipo_celula: m.tipo_celula,
        status: m.status, ativo: m.ativo, tenant_id: tenantId,
      }));

      const totalOps = insertPayloads.length + toUpdate.length;

      for (let i = 0; i < insertPayloads.length; i += BATCH_SIZE) {
        const chunk = insertPayloads.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("modulos_solares").insert(chunk as any);
        if (error) { console.error("Erro no batch", i, error.message); errors += chunk.length; }
        else inserted += chunk.length;
        setProgress(Math.round(((i + chunk.length) / totalOps) * 100));
      }

      // Update duplicates marked for overwrite
      for (const dup of toUpdate) {
        const { error } = await supabase.from("modulos_solares").update({
          bifacial: dup.item.bifacial, tipo_celula: dup.item.tipo_celula,
          potencia_wp: dup.item.potencia_wp,
        }).eq("id", dup.existingId);
        if (error) { console.error("Erro update", dup.existingId, error.message); errors++; }
        else updated++;
        setProgress(Math.round(((insertPayloads.length + toUpdate.indexOf(dup) + 1) / totalOps) * 100));
      }

      qc.invalidateQueries({ queryKey: [...MODULO_QUERY_KEY] });
      const skipped = duplicateItems.length - toUpdate.length;
      setImportResult({ inserted, updated, skipped, errors, fornecedores: fornecedoresCriados });

      toast({
        title: "Importação concluída",
        description: [
          `${inserted} inseridos`, `${updated} atualizados`, `${skipped} ignorados`,
          errors > 0 ? `${errors} erros` : null,
          fornecedoresCriados > 0 ? `${fornecedoresCriados} fornecedores criados` : null,
        ].filter(Boolean).join(" · "),
      });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setParseResult(null); setFileName(""); setImportResult(null);
    setDistributorNames([]); setProgress(0); setOverwriteIds(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Importar CSV de Distribuidora
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Formato: Categoria;Item;Preços... — encoding ISO-8859-1 (latin1)
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {/* Upload */}
            {!parseResult && !importResult && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecione o arquivo CSV da distribuidora (separado por ponto-e-vírgula)
                  </p>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <label className="cursor-pointer">
                      <Upload className="w-4 h-4" /> Selecionar arquivo CSV
                      <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </Button>
                </div>
              </div>
            )}

            {/* Preview */}
            {parseResult && !importResult && (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{parseResult.modules.length}</p>
                    <p className="text-xs text-muted-foreground">Detectados</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-success">{newItems.length}</p>
                    <p className="text-xs text-muted-foreground">Novos</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-warning">{duplicateItems.length}</p>
                    <p className="text-xs text-muted-foreground">Duplicados</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{errorItems.length}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                </div>

                {/* Distributors found */}
                {distributorNames.length > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {distributorNames.length} distribuidora(s) detectadas
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {distributorNames.slice(0, 10).map((name, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{name}</Badge>
                      ))}
                      {distributorNames.length > 10 && (
                        <Badge variant="outline" className="text-xs">+{distributorNames.length - 10}</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Duplicate overwrite section */}
                {duplicateItems.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-warning">
                        {duplicateItems.length} duplicados encontrados
                      </p>
                      <Button variant="ghost" size="sm" onClick={selectAllDuplicates} className="text-xs h-7">
                        {overwriteIds.size === duplicateItems.length ? "Desmarcar todos" : "Selecionar todos"}
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {duplicateItems.map((d) => (
                        <label key={d.idx} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-warning/10 rounded px-1 py-0.5">
                          <Checkbox
                            checked={overwriteIds.has(d.idx)}
                            onCheckedChange={(c) => toggleOverwrite(d.idx, !!c)}
                          />
                          <span className="text-foreground">{d.item.fabricante} {d.item.modelo} ({d.item.potencia_wp}Wp)</span>
                          <Badge variant="outline" className="text-[10px] ml-auto bg-warning/10 text-warning border-warning/20">Sobrescrever</Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {parseResult.warnings.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1">
                    <p className="text-sm font-medium text-warning flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {parseResult.warnings.length} avisos durante o parse
                    </p>
                    <div className="max-h-24 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                      {parseResult.warnings.slice(0, 20).map((w, i) => (
                        <p key={i}>Linha {w.line}: {w.issue} — "{w.raw}"</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview table - new items */}
                {newItems.length > 0 && (
                  <div className="max-h-[200px] overflow-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-foreground">#</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Fabricante</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Modelo</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Wp</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newItems.slice(0, 50).map((m, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                            <td className="px-2 py-1 font-medium text-foreground">{m.fabricante}</td>
                            <td className="px-2 py-1 max-w-[200px] truncate text-foreground">{m.modelo}</td>
                            <td className="px-2 py-1 text-foreground">{m.potencia_wp || "—"}</td>
                            <td className="px-2 py-1"><Badge variant="outline" className="text-xs">{m.tipo_celula}</Badge></td>
                          </tr>
                        ))}
                        {newItems.length > 50 && (
                          <tr><td colSpan={5} className="px-2 py-2 text-center text-muted-foreground">...e mais {newItems.length - 50} módulos</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer summary */}
                <p className="text-xs text-muted-foreground text-center">
                  {newItems.length} novos · {duplicateItems.length} duplicados ({overwriteIds.size} para sobrescrever) · {errorItems.length} erros
                </p>

                {importing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">Importando... {progress}%</p>
                  </div>
                )}
              </div>
            )}

            {/* Result */}
            {importResult && (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                <div>
                  <p className="text-lg font-semibold text-foreground">Importação concluída</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {importResult.inserted} inseridos · {importResult.updated} atualizados · {importResult.skipped} ignorados
                    {importResult.errors > 0 && ` · ${importResult.errors} erros`}
                    {importResult.fornecedores > 0 && ` · ${importResult.fornecedores} fornecedores criados`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          {importResult ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : parseResult ? (
            <>
              <Button variant="ghost" onClick={() => { setParseResult(null); setFileName(""); setDistributorNames([]); setOverwriteIds(new Set()); }} disabled={importing}>
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={(newItems.length === 0 && overwriteIds.size === 0) || importing}
                className="gap-2"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                ) : (
                  `Importar ${newItems.length + overwriteIds.size} módulos`
                )}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
