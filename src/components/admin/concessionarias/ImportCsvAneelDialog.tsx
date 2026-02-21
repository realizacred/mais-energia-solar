import { useState, useRef } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type ParsedTarifa,
  type ImportResult,
  type FileType,
  parseCSVLine,
  detectFileType,
  parseNumber,
  norm,
  stripSuffixes,
  parseTarifasHomologadas,
  parseComponentesTarifas,
  parseXlsxFile,
} from "./importCsvAneelUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportCsvAneelDialog({ open, onOpenChange, onImportComplete }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedTarifa[]>([]);
  const [fileType, setFileType] = useState<FileType | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const reset = () => {
    setFile(null);
    setParsed([]);
    setResult(null);
    setFileType(null);
    setProgress({ current: 0, total: 0, percent: 0 });
    setStep("upload");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    try {
      const isXlsx = f.name.toLowerCase().endsWith(".xlsx") || f.name.toLowerCase().endsWith(".xls");
      
      let headers: string[];
      let data: string[] | string[][];
      
      if (isXlsx) {
        const buffer = await f.arrayBuffer();
        const result = parseXlsxFile(buffer);
        headers = result.headers;
        data = result.rows; // pre-parsed string[][]
      } else {
        const text = await f.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        headers = parseCSVLine(lines[0]);
        data = lines; // raw CSV strings
      }
      
      if ((isXlsx && (data as string[][]).length < 1) || (!isXlsx && (data as string[]).length < 2)) {
        toast({ title: "Arquivo vazio ou inválido", variant: "destructive" });
        return;
      }

      const detected = detectFileType(headers);
      setFileType(detected);

      // Debug: log headers and detected columns for troubleshooting
      console.log("[ANEEL Import] Headers:", headers);
      console.log("[ANEEL Import] Detected type:", detected);
      const { detectColumns } = await import("./importCsvAneelUtils");
      const colMap = detectColumns(headers);
      console.log("[ANEEL Import] Column map:", colMap);
      
      // Preview first few rows for debugging
      if (Array.isArray(data[0])) {
        console.log("[ANEEL Import] First row data:", (data as string[][])[0]);
      }

      let records: ParsedTarifa[];
      if (detected === "componentes") {
        records = parseComponentesTarifas(data, headers);
      } else {
        records = parseTarifasHomologadas(data, headers);
      }

      if (records.length === 0) {
        const colMapStr = Object.entries(colMap).map(([k,v]) => `${k}(${v})`).join(", ");
        // Show first data row for diagnosis
        const firstRow = Array.isArray(data[0]) 
          ? (data as string[][])[0]?.slice(0, 6).join(" | ") 
          : "";
        toast({ 
          title: "Nenhum registro válido encontrado", 
          description: `Tipo: ${detected}. Colunas mapeadas: ${colMapStr || "NENHUMA"}. Primeira linha: ${firstRow || "vazio"}. Confira console (F12) para detalhes.`,
          variant: "destructive",
          duration: 20000,
        });
        return;
      }

      setParsed(records);
      setStep("preview");
      toast({ title: `${records.length} registros encontrados (${detected === "componentes" ? "Componentes" : "Tarifas Homologadas"})` });
    } catch (err) {
      toast({ title: "Erro ao ler arquivo", description: String(err), variant: "destructive" });
    }
  };

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
        // Try exact sigla match
        if (sig && concBySigla[norm(sig)]) return concBySigla[norm(sig)];
        // Try exact nome match
        if (nome && concByNome[norm(nome)]) return concByNome[norm(nome)];
        // Try sig as nome (some files put full name in "Sigla" column)
        if (sig && concByNome[norm(sig)]) return concByNome[norm(sig)];
        // Fuzzy matching
        const normSig = stripSuffixes(norm(sig));
        const normNome = stripSuffixes(norm(nome || sig));
        for (const c of concessionarias) {
          const ns = stripSuffixes(norm(c.sigla || ""));
          const nn = stripSuffixes(norm(c.nome));
          if (normSig && (ns.includes(normSig) || normSig.includes(ns))) return c;
          if (normNome && (nn.includes(normNome) || normNome.includes(nn))) return c;
          // Also try sig against nome for fuzzy
          if (normSig && (nn.includes(normSig) || normSig.includes(nn))) return c;
        }
        return null;
      };

      if (fileType === "componentes") {
        // Componentes: update fio_b fields
        const grouped = new Map<string, { conc: typeof concessionarias[0]; records: ParsedTarifa[] }>();
        for (const r of parsed) {
          const conc = findConc(r.sigAgente, r.nomAgente);
          if (!conc) continue;
          const key = `${conc.id}|${r.subgrupo}|${r.modalidade}`;
          if (!grouped.has(key)) grouped.set(key, { conc, records: [] });
          grouped.get(key)!.records.push(r);
        }

        let updated = 0;
        const errors: string[] = [];
        const entries = [...grouped.entries()];
        const totalEntries = entries.length;

        for (let idx = 0; idx < entries.length; idx++) {
          const [, { conc, records }] = entries[idx];
          const first = records[0];
          const sub = first.subgrupo;
          const isGrupoA = sub.startsWith("A");

          if (isGrupoA) {
            let fio_b_ponta = 0, fio_b_fora_ponta = 0;
            for (const r of records) {
              const isPonta = r.posto.toLowerCase().includes("ponta") && !r.posto.toLowerCase().includes("fora");
              if (isPonta) {
                fio_b_ponta = r.vlrFioB || 0;
              } else {
                fio_b_fora_ponta = r.vlrFioB || 0;
              }
            }

            // Use upsert - update fio_b fields on existing rows
            const { error } = await supabase
              .from("concessionaria_tarifas_subgrupo")
              .upsert({
                concessionaria_id: conc.id,
                subgrupo: sub,
                modalidade_tarifaria: first.modalidade || null,
                fio_b_ponta, fio_b_fora_ponta,
                origem: "CSV_ANEEL_COMP",
                is_active: true,
                updated_at: new Date().toISOString(),
              } as any, { onConflict: "concessionaria_id,subgrupo,tenant_id" });

            if (error) errors.push(`${conc.nome} ${sub}: ${error.message}`);
            else updated++;
          } else {
            const r = records[0];
            const { error } = await supabase
              .from("concessionaria_tarifas_subgrupo")
              .upsert({
                concessionaria_id: conc.id,
                subgrupo: sub,
                modalidade_tarifaria: first.modalidade || "Convencional",
                tarifa_fio_b: r.vlrFioB || 0,
                origem: "CSV_ANEEL_COMP",
                is_active: true,
                updated_at: new Date().toISOString(),
              } as any, { onConflict: "concessionaria_id,subgrupo,tenant_id" });

            if (error) errors.push(`${conc.nome} ${sub}: ${error.message}`);
            else updated++;
          }
          setProgress({ current: idx + 1, total: totalEntries, percent: Math.round(((idx + 1) / totalEntries) * 100) });
          if (idx % 5 === 0) await new Promise(r => setTimeout(r, 10));
        }

        const matched = grouped.size;
        const skipped = parsed.length - [...grouped.values()].reduce((sum, g) => sum + g.records.length, 0);
        setResult({ matched, updated, skipped, errors });
      } else {
        // Tarifas homologadas (existing logic)
        const grouped = new Map<string, { conc: typeof concessionarias[0]; records: ParsedTarifa[] }>();
        for (const r of parsed) {
          const conc = findConc(r.sigAgente, r.nomAgente);
          if (!conc) continue;
          const key = `${conc.id}|${r.subgrupo}|${r.modalidade}`;
          if (!grouped.has(key)) grouped.set(key, { conc, records: [] });
          grouped.get(key)!.records.push(r);
        }

        let updated = 0;
        const errors: string[] = [];
        const entries2 = [...grouped.entries()];
        const totalEntries2 = entries2.length;

        for (let idx = 0; idx < entries2.length; idx++) {
          const [, { conc, records }] = entries2[idx];
          const first = records[0];
          const sub = first.subgrupo;

          if (sub.startsWith("A")) {
            let te_ponta = 0, te_fora_ponta = 0, tusd_ponta = 0, tusd_fora_ponta = 0;
            let demanda_consumo_rs = 0, demanda_geracao_rs = 0;
            for (const r of records) {
              const isPonta = r.posto.toLowerCase().includes("ponta") && !r.posto.toLowerCase().includes("fora");
              const isEnergy = norm(r.unidade).includes("mwh");
              const isDemand = norm(r.unidade).includes("kw") && !norm(r.unidade).includes("kwh");
              const isGeracao = norm(r.modalidade).includes("gera");
              
              if (isDemand) {
                if (isGeracao) {
                  demanda_geracao_rs = r.vlrTUSD || r.vlrTE;
                } else if (isPonta) {
                  // Demand values - store the higher (ponta) as reference
                  demanda_consumo_rs = Math.max(demanda_consumo_rs, r.vlrTUSD);
                } else {
                  demanda_consumo_rs = demanda_consumo_rs || r.vlrTUSD;
                }
              } else if (isEnergy) {
                if (isPonta) {
                  te_ponta = r.vlrTE;
                  tusd_ponta = r.vlrTUSD;
                } else {
                  te_fora_ponta = r.vlrTE;
                  tusd_fora_ponta = r.vlrTUSD;
                }
              }
            }

            const upsertData: any = {
              concessionaria_id: conc.id,
              subgrupo: sub,
              modalidade_tarifaria: first.modalidade || null,
              te_ponta, te_fora_ponta, tusd_ponta, tusd_fora_ponta,
              origem: "CSV_ANEEL",
              is_active: true,
              updated_at: new Date().toISOString(),
            };
            if (demanda_consumo_rs) upsertData.demanda_consumo_rs = demanda_consumo_rs;
            if (demanda_geracao_rs) upsertData.demanda_geracao_rs = demanda_geracao_rs;

            const { error } = await supabase
              .from("concessionaria_tarifas_subgrupo")
              .upsert(upsertData, { onConflict: "concessionaria_id,subgrupo,tenant_id" });

            if (error) errors.push(`${conc.nome} ${sub}: ${error.message}`);
            else updated++;
          } else {
            // BT: use R$/MWh energy rows
            const energyRows = records.filter(r => norm(r.unidade).includes("mwh"));
            const r = energyRows.length > 0 ? energyRows[0] : records[0];
            const { error } = await supabase
              .from("concessionaria_tarifas_subgrupo")
              .upsert({
                concessionaria_id: conc.id,
                subgrupo: sub,
                modalidade_tarifaria: first.modalidade || "Convencional",
                tarifa_energia: r.vlrTE,
                tarifa_fio_b: r.vlrTUSD,
                origem: "CSV_ANEEL",
                is_active: true,
                updated_at: new Date().toISOString(),
              } as any, { onConflict: "concessionaria_id,subgrupo,tenant_id" });

            if (error) errors.push(`${conc.nome} ${sub}: ${error.message}`);
            else updated++;
          }
          setProgress({ current: idx + 1, total: totalEntries2, percent: Math.round(((idx + 1) / totalEntries2) * 100) });
          if (idx % 5 === 0) await new Promise(r => setTimeout(r, 10));
        }

        const matched = grouped.size;
        const skipped = parsed.length - [...grouped.values()].reduce((sum, g) => sum + g.records.length, 0);
        setResult({ matched, updated, skipped, errors });
      }

      setProgress({ current: 1, total: 1, percent: 100 });
      setStep("done");
      if (result?.updated || true) {
        onImportComplete();
      }
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Upload className="w-4 h-4 text-primary" />
            Importar CSV da ANEEL
          </DialogTitle>
          <DialogDescription className="text-xs">
            Suporta <strong>Tarifas Homologadas</strong> (TE + TUSD) e <strong>Componentes das Tarifas</strong> (Fio B). O tipo é detectado automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}>
              <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Clique para selecionar o arquivo <strong>.csv</strong> ou <strong>.xlsx</strong>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Exportado do site dadosabertos.aneel.gov.br
              </p>
            </div>
            <div className="flex items-start gap-2 p-2 rounded bg-muted/50 border text-[11px] text-muted-foreground">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Importe primeiro as <strong>Tarifas Homologadas</strong> (TE/TUSD), depois as <strong>Componentes</strong> (Fio B) para complementar os dados.</span>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={fileTypeBadge as any} className="text-[10px]">
                {fileTypeLabel}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{file?.name}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-lg font-bold">{parsed.length}</div>
                <div className="text-[10px] text-muted-foreground">Registros</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-lg font-bold">{uniqueAgents}</div>
                <div className="text-[10px] text-muted-foreground">Distribuidoras</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-lg font-bold">{uniqueSubgrupos}</div>
                <div className="text-[10px] text-muted-foreground">Subgrupos</div>
              </div>
            </div>

            <ScrollArea className="h-48 rounded border">
              <div className="p-2 space-y-0.5">
                {parsed.slice(0, 50).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] py-1 px-2 rounded hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] font-mono">{r.subgrupo}</Badge>
                      <span className="text-muted-foreground truncate max-w-[140px]">{r.sigAgente || r.nomAgente}</span>
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
                    ... e mais {parsed.length - 50} registros
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex items-start gap-2 p-2 rounded bg-warning/10 border border-warning/30 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
              <span>Apenas distribuidoras já cadastradas no sistema serão atualizadas. Registros sem correspondência serão ignorados.</span>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="w-5 h-5" />
              Importação concluída!
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-success/10 p-3 text-center">
                <div className="text-lg font-bold text-success">{result.updated}</div>
                <div className="text-[10px] text-muted-foreground">Atualizados</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-lg font-bold">{result.matched}</div>
                <div className="text-[10px] text-muted-foreground">Correspondidos</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-lg font-bold text-muted-foreground">{result.skipped}</div>
                <div className="text-[10px] text-muted-foreground">Ignorados</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <ScrollArea className="h-24 rounded border p-2">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-[10px] text-destructive">{e}</div>
                ))}
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
        {step === "preview" && (
            <>
              {importing && (
                <div className="flex-1 flex items-center gap-3">
                  <Progress value={progress.percent} className="h-2 flex-1" />
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {progress.percent}%
                  </span>
                </div>
              )}
              {!importing && <Button variant="outline" size="sm" onClick={reset}>Voltar</Button>}
              <Button size="sm" onClick={handleImport} disabled={importing}>
                {importing ? `Importando… ${progress.percent}%` : `Importar ${parsed.length} registros`}
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
