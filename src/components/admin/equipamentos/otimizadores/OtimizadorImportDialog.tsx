/**
 * Dialog de importação de otimizadores via CSV de distribuidora.
 * Dedup unificado: fabricante|modelo|potencia_wp
 */
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
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import {
  parseDistributorOtimizadorCSV,
  type OtimizadorParseResult,
  type ParsedDistributorOtimizador,
} from "./parseOtimizadorCSV";
import type { Otimizador } from "@/hooks/useOtimizadoresCatalogo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingOtimizadores: Otimizador[];
}

const BATCH_SIZE = 50;

function dedupKey(fabricante: string, modelo: string, potencia: number): string {
  return `${fabricante}|${modelo}|${potencia}`.toLowerCase();
}

export function OtimizadorImportDialog({ open, onOpenChange, existingOtimizadores }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<OtimizadorParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [overwriteIds, setOverwriteIds] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<{
    inserted: number; updated: number; skipped: number; errors: number;
  } | null>(null);

  const existingMap = useMemo(() => {
    const map = new Map<string, string>();
    existingOtimizadores.forEach(o => map.set(dedupKey(o.fabricante, o.modelo, o.potencia_wp || 0), o.id));
    return map;
  }, [existingOtimizadores]);

  const { newItems, duplicateItems } = useMemo(() => {
    if (!parseResult) return { newItems: [] as ParsedDistributorOtimizador[], duplicateItems: [] as { item: ParsedDistributorOtimizador; idx: number; existingId: string }[] };
    const newItems: ParsedDistributorOtimizador[] = [];
    const duplicateItems: { item: ParsedDistributorOtimizador; idx: number; existingId: string }[] = [];
    parseResult.otimizadores.forEach((ot, idx) => {
      const key = dedupKey(ot.fabricante, ot.modelo, ot.potencia_wp);
      const existingId = existingMap.get(key);
      if (existingId) duplicateItems.push({ item: ot, idx, existingId });
      else newItems.push(ot);
    });
    return { newItems, duplicateItems };
  }, [parseResult, existingMap]);

  const toggleOverwrite = (idx: number, checked: boolean) => {
    setOverwriteIds(prev => { const next = new Set(prev); if (checked) next.add(idx); else next.delete(idx); return next; });
  };

  const selectAllDuplicates = () => {
    if (overwriteIds.size === duplicateItems.length) setOverwriteIds(new Set());
    else setOverwriteIds(new Set(duplicateItems.map(d => d.idx)));
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
      setParseResult(parseDistributorOtimizadorCSV(text));
    };
    reader.readAsText(file, "ISO-8859-1");
  };

  const handleImport = async () => {
    const toInsert = newItems;
    const toUpdate = duplicateItems.filter(d => overwriteIds.has(d.idx));
    if (toInsert.length === 0 && toUpdate.length === 0) return;
    setImporting(true); setProgress(0);

    try {
      const { tenantId } = await getCurrentTenantId();
      let inserted = 0, updated = 0, errors = 0;
      const insertPayloads = toInsert.map(ot => ({
        fabricante: ot.fabricante, modelo: ot.modelo,
        potencia_wp: ot.potencia_wp || null,
        status: ot.status, ativo: ot.ativo, tenant_id: tenantId,
      }));
      const totalOps = insertPayloads.length + toUpdate.length;

      for (let i = 0; i < insertPayloads.length; i += BATCH_SIZE) {
        const chunk = insertPayloads.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("otimizadores_catalogo").insert(chunk as any);
        if (error) errors += chunk.length; else inserted += chunk.length;
        setProgress(Math.round(((i + chunk.length) / totalOps) * 100));
      }

      for (const dup of toUpdate) {
        const { error } = await supabase.from("otimizadores_catalogo").update({
          potencia_wp: dup.item.potencia_wp || null,
        }).eq("id", dup.existingId);
        if (error) errors++; else updated++;
        setProgress(Math.round(((insertPayloads.length + toUpdate.indexOf(dup) + 1) / totalOps) * 100));
      }

      qc.invalidateQueries({ queryKey: ["otimizadores-catalogo"] });
      const skipped = duplicateItems.length - toUpdate.length;
      setImportResult({ inserted, updated, skipped, errors });
      toast({
        title: "Importação concluída",
        description: `${inserted} inseridos · ${updated} atualizados · ${skipped} ignorados${errors > 0 ? ` · ${errors} erros` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  const handleClose = () => {
    setParseResult(null); setFileName(""); setImportResult(null);
    setProgress(0); setOverwriteIds(new Set()); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Importar Otimizadores — CSV Distribuidora</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Formato: Categoria;Item;Preços... — detecta fabricante, modelo e potência</p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {!parseResult && !importResult && (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Selecione o arquivo CSV da distribuidora</p>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <label className="cursor-pointer">
                    <Upload className="w-4 h-4" /> Selecionar arquivo CSV
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                  </label>
                </Button>
              </div>
            )}

            {parseResult && !importResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-success">{newItems.length}</p>
                    <p className="text-xs text-muted-foreground">Novos</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-warning">{duplicateItems.length}</p>
                    <p className="text-xs text-muted-foreground">Duplicados</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{parseResult.otimizadores.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>

                {duplicateItems.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-warning">{duplicateItems.length} duplicados</p>
                      <Button variant="ghost" size="sm" onClick={selectAllDuplicates} className="text-xs h-7">
                        {overwriteIds.size === duplicateItems.length ? "Desmarcar todos" : "Selecionar todos"}
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {duplicateItems.map((d) => (
                        <label key={d.idx} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-warning/10 rounded px-1 py-0.5">
                          <Checkbox checked={overwriteIds.has(d.idx)} onCheckedChange={(c) => toggleOverwrite(d.idx, !!c)} />
                          <span className="text-foreground">{d.item.fabricante} {d.item.modelo} ({d.item.potencia_wp}Wp)</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {parseResult.warnings.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1">
                    <p className="text-sm font-medium text-warning flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{parseResult.warnings.length} avisos</p>
                    <div className="max-h-24 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                      {parseResult.warnings.slice(0, 20).map((w, i) => (<p key={i}>Linha {w.line}: {w.issue}</p>))}
                    </div>
                  </div>
                )}

                {newItems.length > 0 && (
                  <div className="max-h-[200px] overflow-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-foreground">#</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Fabricante</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Modelo</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Wp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newItems.slice(0, 50).map((ot, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                            <td className="px-2 py-1 font-medium text-foreground">{ot.fabricante}</td>
                            <td className="px-2 py-1 max-w-[200px] truncate text-foreground">{ot.modelo}</td>
                            <td className="px-2 py-1 text-foreground">{ot.potencia_wp || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  {newItems.length} novos · {duplicateItems.length} duplicados ({overwriteIds.size} para sobrescrever)
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
                  {importResult.inserted} inseridos · {importResult.updated} atualizados · {importResult.skipped} ignorados
                  {importResult.errors > 0 && ` · ${importResult.errors} erros`}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          {importResult ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : parseResult ? (
            <>
              <Button variant="ghost" onClick={() => { setParseResult(null); setFileName(""); setOverwriteIds(new Set()); }} disabled={importing}>Voltar</Button>
              <Button onClick={handleImport} disabled={(newItems.length === 0 && overwriteIds.size === 0) || importing} className="gap-2">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : `Importar ${newItems.length + overwriteIds.size} otimizadores`}
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
