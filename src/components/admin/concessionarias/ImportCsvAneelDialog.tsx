import { useState, useRef } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ParsedTarifa {
  sigAgente: string;
  nomAgente: string;
  subgrupo: string;
  modalidade: string;
  posto: string;
  vlrTUSD: number;
  vlrTE: number;
  unidade: string;
  baseTarifaria: string;
  detalhe: string;
  vigencia: string;
}

interface ImportResult {
  matched: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// Normalise string for fuzzy matching
function norm(s: string): string {
  return s.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function stripSuffixes(s: string): string {
  return s.replace(/\b(s\.?a\.?|s\/a|ltda|cia|distribui[cç][aã]o|energia|el[eé]trica|distribuidora|de)\b/gi, "").trim().replace(/\s+/g, " ");
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ";" || char === ",") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const patterns: Record<string, RegExp> = {
    sigAgente: /sig\s*agente/i,
    nomAgente: /nom\s*agente/i,
    subgrupo: /sub\s*grupo/i,
    modalidade: /modalidade/i,
    posto: /posto/i,
    vlrTUSD: /tusd/i,
    vlrTE: /\bte\b/i,
    unidade: /unidade/i,
    baseTarifaria: /base\s*tarif/i,
    detalhe: /detalhe/i,
    vigencia: /inicio\s*vig|dat.*inicio/i,
  };
  
  for (const [key, re] of Object.entries(patterns)) {
    const idx = headers.findIndex(h => re.test(h));
    if (idx >= 0) map[key] = idx;
  }
  return map;
}

function parseNumber(s: string): number {
  if (!s) return 0;
  // Handle Brazilian number format: 10,36 -> 10.36
  return parseFloat(s.replace(",", ".")) || 0;
}

export function ImportCsvAneelDialog({ open, onOpenChange, onImportComplete }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedTarifa[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const reset = () => {
    setFile(null);
    setParsed([]);
    setResult(null);
    setStep("upload");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    try {
      const text = await f.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: "Arquivo vazio ou inválido", variant: "destructive" });
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const cols = detectColumns(headers);

      if (!cols.sigAgente && !cols.nomAgente) {
        toast({ title: "Colunas não reconhecidas", description: "O CSV precisa ter colunas SigAgente ou NomAgente", variant: "destructive" });
        return;
      }

      const records: ParsedTarifa[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i]);
        if (cells.length < 3) continue;

        const baseTarifaria = cols.baseTarifaria !== undefined ? cells[cols.baseTarifaria] || "" : "";
        // Only import "Tarifa de Aplicação" records
        if (baseTarifaria && !baseTarifaria.toLowerCase().includes("aplica")) continue;

        const subgrupo = cols.subgrupo !== undefined ? cells[cols.subgrupo] || "" : "";
        if (!subgrupo) continue;

        records.push({
          sigAgente: cols.sigAgente !== undefined ? cells[cols.sigAgente] || "" : "",
          nomAgente: cols.nomAgente !== undefined ? cells[cols.nomAgente] || "" : "",
          subgrupo,
          modalidade: cols.modalidade !== undefined ? cells[cols.modalidade] || "" : "",
          posto: cols.posto !== undefined ? cells[cols.posto] || "" : "",
          vlrTUSD: cols.vlrTUSD !== undefined ? parseNumber(cells[cols.vlrTUSD]) : 0,
          vlrTE: cols.vlrTE !== undefined ? parseNumber(cells[cols.vlrTE]) : 0,
          unidade: cols.unidade !== undefined ? cells[cols.unidade] || "" : "",
          baseTarifaria,
          detalhe: cols.detalhe !== undefined ? cells[cols.detalhe] || "" : "",
          vigencia: cols.vigencia !== undefined ? cells[cols.vigencia] || "" : "",
        });
      }

      setParsed(records);
      setStep("preview");
      toast({ title: `${records.length} registros encontrados no CSV` });
    } catch (err) {
      toast({ title: "Erro ao ler arquivo", description: String(err), variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);

    try {
      // Fetch concessionárias do tenant
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
        if (sig && concBySigla[norm(sig)]) return concBySigla[norm(sig)];
        if (nome && concByNome[norm(nome)]) return concByNome[norm(nome)];
        // Fuzzy match
        const normSig = stripSuffixes(norm(sig));
        const normNome = stripSuffixes(norm(nome));
        for (const c of concessionarias) {
          const ns = stripSuffixes(norm(c.sigla || ""));
          const nn = stripSuffixes(norm(c.nome));
          if (normSig && (ns.includes(normSig) || normSig.includes(ns))) return c;
          if (normNome && (nn.includes(normNome) || normNome.includes(nn))) return c;
        }
        return null;
      };

      // Group records by concessionária + subgrupo to aggregate ponta/fora ponta
      const grouped = new Map<string, { conc: typeof concessionarias[0]; records: ParsedTarifa[] }>();

      for (const r of parsed) {
        const conc = findConc(r.sigAgente, r.nomAgente);
        if (!conc) continue;

        const key = `${conc.id}|${r.subgrupo}|${r.modalidade}`;
        if (!grouped.has(key)) grouped.set(key, { conc, records: [] });
        grouped.get(key)!.records.push(r);
      }

      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];
      const isGrupoA = (s: string) => s.startsWith("A");

      for (const [, { conc, records }] of grouped) {
        const first = records[0];
        const sub = first.subgrupo;

        if (isGrupoA(sub)) {
          // Grupo A: aggregate ponta / fora ponta
          let te_ponta = 0, te_fora_ponta = 0, tusd_ponta = 0, tusd_fora_ponta = 0;
          for (const r of records) {
            const isPonta = r.posto.toLowerCase().includes("ponta") && !r.posto.toLowerCase().includes("fora");
            if (isPonta) {
              te_ponta = r.vlrTE;
              tusd_ponta = r.vlrTUSD;
            } else {
              te_fora_ponta = r.vlrTE;
              tusd_fora_ponta = r.vlrTUSD;
            }
          }

          const { error } = await supabase
            .from("concessionaria_tarifas_subgrupo")
            .upsert({
              concessionaria_id: conc.id,
              subgrupo: sub,
              modalidade_tarifaria: first.modalidade || null,
              te_ponta, te_fora_ponta, tusd_ponta, tusd_fora_ponta,
              origem: "CSV_ANEEL",
              is_active: true,
              updated_at: new Date().toISOString(),
            } as any, { onConflict: "concessionaria_id,subgrupo,tenant_id" });

          if (error) {
            errors.push(`${conc.nome} ${sub}: ${error.message}`);
          } else {
            updated++;
          }
        } else {
          // Grupo B: use TUSD as tarifa_fio_b, TE as tarifa_energia
          const r = records[0]; // BT has one record per subgrupo
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

          if (error) {
            errors.push(`${conc.nome} ${sub}: ${error.message}`);
          } else {
            updated++;
          }
        }
      }

      const matched = grouped.size;
      skipped = parsed.length - [...grouped.values()].reduce((sum, g) => sum + g.records.length, 0);

      setResult({ matched, updated, skipped, errors });
      setStep("done");

      if (updated > 0) {
        toast({ title: `${updated} subgrupo(s) atualizado(s) com sucesso!` });
        onImportComplete();
      }
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // Stats for preview
  const uniqueAgents = new Set(parsed.map(r => r.sigAgente || r.nomAgente)).size;
  const uniqueSubgrupos = new Set(parsed.map(r => r.subgrupo)).size;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Upload className="w-4 h-4 text-primary" />
            Importar CSV da ANEEL
          </DialogTitle>
          <DialogDescription className="text-xs">
            Baixe o CSV do site da ANEEL e faça upload aqui para atualizar as tarifas.
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
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
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
                      <span className="text-muted-foreground truncate max-w-[180px]">{r.sigAgente || r.nomAgente}</span>
                    </div>
                    <div className="flex gap-3 font-mono text-[10px]">
                      <span>TE: {r.vlrTE.toFixed(4)}</span>
                      <span>TUSD: {r.vlrTUSD.toFixed(4)}</span>
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
              <Button variant="outline" size="sm" onClick={reset}>Voltar</Button>
              <Button size="sm" onClick={handleImport} disabled={importing}>
                {importing ? "Importando..." : `Importar ${parsed.length} registros`}
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
