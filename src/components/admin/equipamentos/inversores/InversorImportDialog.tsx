/**
 * Dialog de importação de inversores via CSV de distribuidora.
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
import { importFornecedoresFromHeader } from "@/utils/importFornecedoresFromHeader";
import {
  parseDistributorInversorCSV,
  type InversorParseResult,
  type ParsedDistributorInversor,
} from "./parseInversorCSV";
import type { Inversor } from "@/hooks/useInversoresCatalogo";
import {
  dedupKeyNormalized,
  findSuspects,
  type SuspectMatch,
} from "@/utils/equipmentDedupUtils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingInversores: Inversor[];
}

const BATCH_SIZE = 50;

export function InversorImportDialog({ open, onOpenChange, existingInversores }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [fileName, setFileName] = useState("");
  const [csvHeaderLine, setCsvHeaderLine] = useState("");
  const [parseResult, setParseResult] = useState<InversorParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [overwriteIds, setOverwriteIds] = useState<Set<number>>(new Set());
  const [importSuspectIds, setImportSuspectIds] = useState<Set<number>>(new Set());
  const [verifyingAI, setVerifyingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{
    inserted: number; updated: number; skipped: number; errors: number; fornecedores: number;
  } | null>(null);

  const existingMap = useMemo(() => {
    const map = new Map<string, string>();
    existingInversores.forEach(i => map.set(dedupKeyNormalized(i.fabricante, i.modelo, i.potencia_nominal_kw), i.id));
    return map;
  }, [existingInversores]);

  const existingForSuspects = useMemo(() =>
    existingInversores.map(i => ({ id: i.id, fabricante: i.fabricante, modelo: i.modelo, potencia: i.potencia_nominal_kw })),
    [existingInversores]
  );

  const { newItems, suspectItems, duplicateItems } = useMemo(() => {
    if (!parseResult) return {
      newItems: [] as ParsedDistributorInversor[],
      suspectItems: [] as { item: ParsedDistributorInversor; idx: number; match: SuspectMatch }[],
      duplicateItems: [] as { item: ParsedDistributorInversor; idx: number; existingId: string }[],
    };
    const newItems: ParsedDistributorInversor[] = [];
    const suspectItems: { item: ParsedDistributorInversor; idx: number; match: SuspectMatch }[] = [];
    const duplicateItems: { item: ParsedDistributorInversor; idx: number; existingId: string }[] = [];
    parseResult.inversores.forEach((inv, idx) => {
      const key = dedupKeyNormalized(inv.fabricante, inv.modelo, inv.potencia_nominal_kw);
      const existingId = existingMap.get(key);
      if (existingId) {
        duplicateItems.push({ item: inv, idx, existingId });
      } else {
        const suspect = findSuspects(inv.fabricante, inv.modelo, inv.potencia_nominal_kw, existingForSuspects);
        if (suspect) suspectItems.push({ item: inv, idx, match: suspect });
        else newItems.push(inv);
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
            userPrompt: `São o mesmo inversor solar?\nItem 1: ${s.item.fabricante} ${s.item.modelo} ${s.item.potencia_nominal_kw}kW\nItem 2: ${s.match.existingFabricante} ${s.match.existingModelo} ${s.match.existingPotencia}kW\nResponda APENAS: SIM ou NAO`,
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
      setCsvHeaderLine(text.split("\n")[0] || "");
      setParseResult(parseDistributorInversorCSV(text));
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
      const fornecedoresCriados = await importFornecedoresFromHeader(csvHeaderLine, tenantId);
      let inserted = 0, updated = 0, errors = 0;
      const insertPayloads = toInsert.map(inv => ({
        fabricante: inv.fabricante, modelo: inv.modelo,
        potencia_nominal_kw: inv.potencia_nominal_kw, tipo: inv.tipo,
        status: inv.status, ativo: inv.ativo, tenant_id: tenantId,
      }));
      const totalOps = insertPayloads.length + toUpdate.length;

      for (let i = 0; i < insertPayloads.length; i += BATCH_SIZE) {
        const chunk = insertPayloads.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("inversores_catalogo").insert(chunk as any);
        if (error) errors += chunk.length; else inserted += chunk.length;
        setProgress(Math.round(((i + chunk.length) / totalOps) * 100));
      }

      for (const dup of toUpdate) {
        const { error } = await supabase.from("inversores_catalogo").update({
          potencia_nominal_kw: dup.item.potencia_nominal_kw, tipo: dup.item.tipo,
        }).eq("id", dup.existingId);
        if (error) errors++; else updated++;
        setProgress(Math.round(((insertPayloads.length + toUpdate.indexOf(dup) + 1) / totalOps) * 100));
      }

      qc.invalidateQueries({ queryKey: ["inversores-catalogo"] });
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      const skipped = duplicateItems.length - toUpdate.length + suspectItems.length - suspectsToImport.length;
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
    } finally { setImporting(false); }
  };

  const handleClose = () => {
    setParseResult(null); setFileName(""); setCsvHeaderLine(""); setImportResult(null);
    setProgress(0); setOverwriteIds(new Set()); setImportSuspectIds(new Set()); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Importar Inversores — CSV Distribuidora</DialogTitle>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-success">{newItems.length}</p>
                    <p className="text-xs text-muted-foreground">Novos</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-500">{suspectItems.length}</p>
                    <p className="text-xs text-muted-foreground">Suspeitos</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-warning">{duplicateItems.length}</p>
                    <p className="text-xs text-muted-foreground">Duplicados</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{parseResult.inversores.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>

                {/* Suspects */}
                {suspectItems.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">🟡 {suspectItems.length} suspeitos</p>
                      <Button variant="outline" size="sm" onClick={handleVerifyWithAI} disabled={verifyingAI} className="text-xs h-7 gap-1">
                        {verifyingAI ? <><Loader2 className="w-3 h-3 animate-spin" /> {aiProgress.current}/{aiProgress.total}</> : <><Sparkles className="w-3 h-3" /> Verificar com IA</>}
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {suspectItems.map((s) => (
                        <label key={s.idx} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-yellow-500/10 rounded px-1 py-0.5">
                          <Checkbox checked={importSuspectIds.has(s.idx)} onCheckedChange={(c) => toggleSuspect(s.idx, !!c)} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground">{s.item.fabricante} {s.item.modelo} ({s.item.potencia_nominal_kw}kW)</span>
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
                      <p className="text-sm font-medium text-warning">{duplicateItems.length} duplicados</p>
                      <Button variant="ghost" size="sm" onClick={selectAllDuplicates} className="text-xs h-7">
                        {overwriteIds.size === duplicateItems.length ? "Desmarcar todos" : "Selecionar todos"}
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {duplicateItems.map((d) => (
                        <label key={d.idx} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-warning/10 rounded px-1 py-0.5">
                          <Checkbox checked={overwriteIds.has(d.idx)} onCheckedChange={(c) => toggleOverwrite(d.idx, !!c)} />
                          <span className="text-foreground">{d.item.fabricante} {d.item.modelo} ({d.item.potencia_nominal_kw}kW)</span>
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
                          <th className="px-2 py-1.5 text-left text-foreground">kW</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newItems.slice(0, 50).map((inv, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                            <td className="px-2 py-1 font-medium text-foreground">{inv.fabricante}</td>
                            <td className="px-2 py-1 max-w-[200px] truncate text-foreground">{inv.modelo}</td>
                            <td className="px-2 py-1 text-foreground">{inv.potencia_nominal_kw || "—"}</td>
                            <td className="px-2 py-1"><Badge variant="outline" className="text-xs">{inv.tipo}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  {newItems.length} novos · {suspectItems.length} suspeitos ({importSuspectIds.size} para importar) · {duplicateItems.length} duplicados ({overwriteIds.size} para sobrescrever)
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
              <Button variant="ghost" onClick={() => { setParseResult(null); setFileName(""); setOverwriteIds(new Set()); setImportSuspectIds(new Set()); }} disabled={importing}>Voltar</Button>
              <Button onClick={handleImport} disabled={(newItems.length === 0 && overwriteIds.size === 0 && importSuspectIds.size === 0) || importing} className="gap-2">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : `Importar ${newItems.length + overwriteIds.size + importSuspectIds.size} inversores`}
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
