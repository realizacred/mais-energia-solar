import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export function DistributorImportDialog({ open, onOpenChange, existingModulos }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    imported: number; skipped: number; errors: number;
  } | null>(null);

  // Chave de dedup: fabricante|modelo (lowercase)
  const existingKeys = useMemo(
    () => new Set(existingModulos.map(m => `${m.fabricante}|${m.modelo}`.toLowerCase())),
    [existingModulos]
  );

  const newModules = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.modules.filter(
      m => !existingKeys.has(`${m.fabricante}|${m.modelo}`.toLowerCase())
    );
  }, [parseResult, existingKeys]);

  const duplicateCount = useMemo(() => {
    if (!parseResult) return 0;
    return parseResult.modules.length - newModules.length;
  }, [parseResult, newModules]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string || "";
      const result = parseDistributorCSV(text, "Módulo");
      setParseResult(result);
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    if (newModules.length === 0) return;
    setImporting(true);
    setProgress(0);

    try {
      const { tenantId } = await getCurrentTenantId();

      // Explicitly exclude area_m2 (GENERATED ALWAYS column) as safety measure
      const itemsToInsert = newModules.map(({ ...m }) => ({
        fabricante: m.fabricante,
        modelo: m.modelo,
        potencia_wp: m.potencia_wp,
        bifacial: m.bifacial,
        tipo_celula: m.tipo_celula,
        status: m.status,
        ativo: m.ativo,
        tensao_sistema: m.tensao_sistema,
        tenant_id: tenantId,
      }));

      let imported = 0;
      let errors = 0;

      for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
        const chunk = itemsToInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("modulos_solares")
          .insert(chunk as any);

        if (error) {
          console.error("Erro no batch", i, error.message);
          errors += chunk.length;
        } else {
          imported += chunk.length;
        }

        setProgress(Math.round(((i + chunk.length) / itemsToInsert.length) * 100));
      }

      qc.invalidateQueries({ queryKey: [...MODULO_QUERY_KEY] });
      setImportResult({ imported, skipped: duplicateCount, errors });

      toast({
        title: `${imported} módulos importados`,
        description: errors > 0
          ? `${errors} erros durante a importação.`
          : `${duplicateCount} duplicados ignorados.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro na importação",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setParseResult(null);
    setFileName("");
    setImportResult(null);
    setProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      {/* RB-07: w-[90vw] obrigatório */}
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header — §25 */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Importar CSV de Distribuidora
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Formato: Categoria;Item;Preços... — separa fabricante/modelo automaticamente
            </p>
          </div>
        </DialogHeader>

        {/* Corpo — §36 */}
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
                      <input
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </Button>
                </div>
                {fileName && (
                  <p className="text-sm text-muted-foreground">
                    Arquivo: <span className="font-medium text-foreground">{fileName}</span>
                  </p>
                )}
              </div>
            )}

            {/* Preview */}
            {parseResult && !importResult && (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{parseResult.modules.length}</p>
                    <p className="text-xs text-muted-foreground">Módulos detectados</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-success">{newModules.length}</p>
                    <p className="text-xs text-muted-foreground">Novos para importar</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-warning">{duplicateCount}</p>
                    <p className="text-xs text-muted-foreground">Duplicados (ignorados)</p>
                  </div>
                </div>

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
                      {parseResult.warnings.length > 20 && (
                        <p>...e mais {parseResult.warnings.length - 20} avisos</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Preview table */}
                <div className="max-h-[280px] overflow-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left text-foreground">#</th>
                        <th className="px-2 py-1.5 text-left text-foreground">Fabricante</th>
                        <th className="px-2 py-1.5 text-left text-foreground">Modelo</th>
                        <th className="px-2 py-1.5 text-left text-foreground">Wp</th>
                        <th className="px-2 py-1.5 text-left text-foreground">Tipo</th>
                        <th className="px-2 py-1.5 text-left text-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newModules.slice(0, 50).map((m, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-1 font-medium text-foreground">{m.fabricante}</td>
                          <td className="px-2 py-1 max-w-[200px] truncate text-foreground">{m.modelo}</td>
                          <td className="px-2 py-1 text-foreground">{m.potencia_wp || "—"}</td>
                          <td className="px-2 py-1">
                            <Badge variant="outline" className="text-xs">{m.tipo_celula}</Badge>
                          </td>
                          <td className="px-2 py-1">
                            {m.potencia_wp === 0 ? (
                              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                                Sem potência
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle2 className="w-3 h-3 mr-1" />Rascunho
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                      {newModules.length > 50 && (
                        <tr>
                          <td colSpan={6} className="px-2 py-2 text-center text-muted-foreground">
                            ...e mais {newModules.length - 50} módulos
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Progress */}
                {importing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      Importando... {progress}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Result */}
            {importResult && (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    Importação concluída
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {importResult.imported} importados · {importResult.skipped} duplicados ignorados
                    {importResult.errors > 0 && ` · ${importResult.errors} erros`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer — §22 */}
        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          {importResult ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : parseResult ? (
            <>
              <Button
                variant="ghost"
                onClick={() => { setParseResult(null); setFileName(""); }}
                disabled={importing}
              >
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={newModules.length === 0 || importing}
                className="gap-2"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                ) : (
                  `Importar ${newModules.length} módulos`
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
