/**
 * Dialog de importação de fornecedores via CSV.
 * Suporta dois formatos:
 * 1. Distribuidora: Categoria;Item;19646 - WEG;19647 - SICES;...
 * 2. Simples: Nome;Tipo;CNPJ;Email;Telefone;Cidade;UF
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
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

interface Fornecedor {
  id: string;
  nome: string;
  tipo: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
}

interface ParsedFornecedor {
  nome: string;
  tipo: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingFornecedores: Fornecedor[];
  onImported?: () => void;
}

function normalizeForDedup(str: string): string {
  return str.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Detect if CSV is distributor format (Categoria;Item;ID - Name;...) */
function isDistributorFormat(text: string): boolean {
  const firstLine = text.split("\n")[0]?.toLowerCase() || "";
  return firstLine.includes("categoria") && firstLine.includes("item");
}

/** Extract distributor names from header columns */
function extractDistributorsFromHeader(headerLine: string): ParsedFornecedor[] {
  const cols = headerLine.split(";").map(c => c.trim());
  const names: string[] = [];
  for (let i = 2; i < cols.length; i++) {
    const col = cols[i];
    if (!col) continue;
    const match = col.match(/^\d+\s*-\s*(.+)$/);
    if (match) names.push(match[1].trim());
    else names.push(col);
  }
  const unique = [...new Set(names)];
  return unique.map(nome => ({
    nome,
    tipo: "distribuidor",
    cnpj: null,
    email: null,
    telefone: null,
    cidade: null,
    estado: null,
  }));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split("\n")[0] || "";
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  if (tabCount >= semiCount && tabCount >= commaCount) return "\t";
  if (semiCount >= commaCount) return ";";
  return ",";
}

/** Parse simple CSV format */
function parseSimpleCSV(text: string): ParsedFornecedor[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const delim = detectDelimiter(text);
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase());
  const findCol = (...names: string[]) =>
    headers.findIndex(h => names.some(n => h.includes(n)));

  const colNome = findCol("nome", "name", "razao");
  const colTipo = findCol("tipo", "type");
  const colCnpj = findCol("cnpj");
  const colEmail = findCol("email", "e-mail");
  const colTel = findCol("telefone", "tel", "phone", "fone");
  const colCidade = findCol("cidade", "city");
  const colUF = findCol("uf", "estado", "state");

  const results: ParsedFornecedor[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(c => c.trim());
    const get = (idx: number) => idx >= 0 ? cols[idx] || null : null;
    const nome = get(colNome);
    if (!nome) continue;
    results.push({
      nome,
      tipo: get(colTipo) || "distribuidor",
      cnpj: get(colCnpj),
      email: get(colEmail),
      telefone: get(colTel),
      cidade: get(colCidade),
      estado: get(colUF),
    });
  }
  return results;
}

function parseFornecedorCSV(text: string): ParsedFornecedor[] {
  if (isDistributorFormat(text)) {
    const firstLine = text.split("\n")[0] || "";
    return extractDistributorsFromHeader(firstLine);
  }
  return parseSimpleCSV(text);
}

export function FornecedorImportDialog({ open, onOpenChange, existingFornecedores, onImported }: Props) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedFornecedor[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [overwriteIds, setOverwriteIds] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<{
    inserted: number; updated: number; skipped: number; errors: number;
    errorItems?: { nome: string; motivo: string }[];
  } | null>(null);

  const existingMap = useMemo(() => {
    const map = new Map<string, string>();
    existingFornecedores.forEach(f => map.set(normalizeForDedup(f.nome), f.id));
    return map;
  }, [existingFornecedores]);

  const { newItems, duplicateItems } = useMemo(() => {
    if (!parsed) return { newItems: [] as ParsedFornecedor[], duplicateItems: [] as { item: ParsedFornecedor; idx: number; existingId: string }[] };
    const newItems: ParsedFornecedor[] = [];
    const duplicateItems: { item: ParsedFornecedor; idx: number; existingId: string }[] = [];
    parsed.forEach((f, idx) => {
      const key = normalizeForDedup(f.nome);
      const existingId = existingMap.get(key);
      if (existingId) duplicateItems.push({ item: f, idx, existingId });
      else newItems.push(f);
    });
    return { newItems, duplicateItems };
  }, [parsed, existingMap]);

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
      setParsed(parseFornecedorCSV(text));
    };
    reader.readAsText(file, "ISO-8859-1");
  };

  const handleImport = async () => {
    const toUpdate = duplicateItems.filter(d => overwriteIds.has(d.idx));
    if (newItems.length === 0 && toUpdate.length === 0) return;
    setImporting(true);
    setProgress(0);

    try {
      const { tenantId } = await getCurrentTenantId();
      let inserted = 0, updated = 0, errors = 0;
      const errorItems: { nome: string; motivo: string }[] = [];
      const totalOps = newItems.length + toUpdate.length;

      // Insert new
      if (newItems.length > 0) {
        const payloads = newItems.map(f => ({
          nome: f.nome, tipo: f.tipo,
          cnpj: f.cnpj, email: f.email, telefone: f.telefone,
          cidade: f.cidade, estado: f.estado,
          ativo: true, tenant_id: tenantId,
        }));
        const BATCH = 50;
        for (let i = 0; i < payloads.length; i += BATCH) {
          const chunk = payloads.slice(i, i + BATCH);
          const { error } = await supabase.from("fornecedores").insert(chunk as any);
          if (error) {
            // Fallback: try one by one
            for (const item of chunk) {
              const { error: se } = await supabase.from("fornecedores").insert(item as any);
              if (se) {
                errors++;
                errorItems.push({ nome: item.nome, motivo: se.message });
              } else {
                inserted++;
              }
            }
          } else {
            inserted += chunk.length;
          }
          setProgress(Math.round(((i + chunk.length) / totalOps) * 100));
        }
      }

      // Update duplicates
      for (const dup of toUpdate) {
        const updatePayload: Record<string, any> = {};
        if (dup.item.cnpj) updatePayload.cnpj = dup.item.cnpj;
        if (dup.item.email) updatePayload.email = dup.item.email;
        if (dup.item.telefone) updatePayload.telefone = dup.item.telefone;
        if (dup.item.cidade) updatePayload.cidade = dup.item.cidade;
        if (dup.item.estado) updatePayload.estado = dup.item.estado;
        if (dup.item.tipo) updatePayload.tipo = dup.item.tipo;
        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase.from("fornecedores").update(updatePayload).eq("id", dup.existingId);
          if (error) { errors++; errorItems.push({ nome: dup.item.nome, motivo: error.message }); }
          else updated++;
        } else {
          updated++;
        }
        setProgress(Math.round(((newItems.length + toUpdate.indexOf(dup) + 1) / totalOps) * 100));
      }

      const skipped = duplicateItems.length - toUpdate.length;
      setImportResult({ inserted, updated, skipped, errors, errorItems });
      toast({
        title: "Importação concluída",
        description: `${inserted} criados · ${updated} atualizados · ${skipped} ignorados${errors > 0 ? ` · ${errors} erros` : ""}`,
      });
      onImported?.();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setParsed(null);
    setFileName("");
    setImportResult(null);
    setProgress(0);
    setOverwriteIds(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="w-[90vw] max-w-3xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Importar Fornecedores — CSV</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Formato simples (Nome;Tipo;CNPJ;...) ou CSV de distribuidora (Categoria;Item;Dist1;Dist2;...)
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {!parsed && !importResult && (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Selecione o arquivo CSV</p>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <label className="cursor-pointer">
                    <Upload className="w-4 h-4" /> Selecionar arquivo CSV
                    <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileUpload} />
                  </label>
                </Button>
              </div>
            )}

            {parsed && !importResult && (
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
                    <p className="text-2xl font-bold text-foreground">{parsed.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>

                {duplicateItems.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-warning">{duplicateItems.length} duplicados</p>
                      <Button variant="ghost" size="sm" onClick={selectAllDuplicates} className="text-xs h-7">
                        {overwriteIds.size === duplicateItems.length ? "Desmarcar" : "Selecionar todos"}
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {duplicateItems.map((d) => (
                        <label key={d.idx} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-warning/10 rounded px-1 py-0.5">
                          <Checkbox checked={overwriteIds.has(d.idx)} onCheckedChange={(c) => toggleOverwrite(d.idx, !!c)} />
                          <span className="text-foreground">{d.item.nome}</span>
                          <Badge variant="outline" className="text-[10px] ml-auto">{d.item.tipo}</Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {newItems.length > 0 && (
                  <div className="max-h-[200px] overflow-x-auto overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-foreground">Nome</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Tipo</th>
                          <th className="px-2 py-1.5 text-left text-foreground">Cidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newItems.map((f, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1 text-foreground">{f.nome}</td>
                            <td className="px-2 py-1">
                              <Badge variant="outline" className="text-[10px]">{f.tipo}</Badge>
                            </td>
                            <td className="px-2 py-1 text-muted-foreground">{f.cidade || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {importResult && (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
                <p className="text-lg font-semibold text-foreground mb-2">Importação concluída</p>
                <div className="flex justify-center gap-4 text-sm text-muted-foreground">
                  <span>{importResult.inserted} criados</span>
                  <span>{importResult.updated} atualizados</span>
                  <span>{importResult.skipped} ignorados</span>
                  {importResult.errors > 0 && <span className="text-destructive">{importResult.errors} erros</span>}
                </div>
              </div>
            )}

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-center text-muted-foreground">Importando... {progress}%</p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            {importResult ? "Fechar" : "Cancelar"}
          </Button>
          {parsed && !importResult && (
            <Button
              onClick={handleImport}
              disabled={importing || (newItems.length === 0 && overwriteIds.size === 0)}
              className="gap-2"
            >
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : `Importar ${newItems.length + overwriteIds.size}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
