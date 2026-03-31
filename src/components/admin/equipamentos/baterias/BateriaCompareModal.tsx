import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GitCompareArrows, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCallback } from "react";

interface Bateria {
  id: string;
  fabricante: string;
  modelo: string;
  tipo_bateria: string | null;
  energia_kwh: number | null;
  tensao_nominal_v: number | null;
  potencia_max_saida_kw: number | null;
  corrente_max_descarga_a: number | null;
  corrente_max_carga_a: number | null;
  dimensoes_mm: string | null;
  ativo: boolean;
}

interface Props { baterias: Bateria[]; open: boolean; onOpenChange: (v: boolean) => void; }

interface SpecRow { label: string; key: keyof Bateria; unit?: string; higherIsBetter?: boolean; }

const SPECS: SpecRow[] = [
  { label: "Capacidade", key: "energia_kwh", unit: " kWh", higherIsBetter: true },
  { label: "Tensão Nominal", key: "tensao_nominal_v", unit: " V" },
  { label: "Potência Máx Saída", key: "potencia_max_saida_kw", unit: " kW", higherIsBetter: true },
  { label: "Corrente Máx Descarga", key: "corrente_max_descarga_a", unit: " A", higherIsBetter: true },
  { label: "Corrente Máx Carga", key: "corrente_max_carga_a", unit: " A", higherIsBetter: true },
];

function getHighlightClass(values: (number | null)[], idx: number, higherIsBetter?: boolean): string {
  if (higherIsBetter === undefined) return "";
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return "";
  const val = values[idx];
  if (val == null) return "";
  const best = higherIsBetter ? Math.max(...nums) : Math.min(...nums);
  const worst = higherIsBetter ? Math.min(...nums) : Math.max(...nums);
  if (val === best && best !== worst) return "text-success font-semibold";
  if (val === worst && best !== worst) return "text-destructive";
  return "";
}

export function BateriaCompareModal({ baterias, open, onOpenChange }: Props) {
  const exportCSV = useCallback(() => {
    const headers = ["Spec", ...baterias.map(b => `${b.fabricante} ${b.modelo}`)];
    const rows = SPECS.map(s => [s.label, ...baterias.map(b => { const v = b[s.key]; return v != null ? `${v}${s.unit || ""}` : "—"; })]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `comparacao_baterias_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }, [baterias]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><GitCompareArrows className="w-5 h-5 text-primary" /></div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Comparar Baterias ({baterias.length})</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Comparação lado a lado</p>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-[160px]">Spec</TableHead>
                {baterias.map(b => (
                  <TableHead key={b.id} className="font-semibold text-center">
                    <div className="text-xs text-muted-foreground">{b.fabricante}</div>
                    <div className="text-sm truncate max-w-[180px]">{b.modelo}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-sm text-muted-foreground font-medium">Tipo</TableCell>
                {baterias.map(b => (
                  <TableCell key={b.id} className="text-center text-sm">{b.tipo_bateria || "—"}</TableCell>
                ))}
              </TableRow>
              {SPECS.map(spec => {
                const values = baterias.map(b => { const v = b[spec.key]; return typeof v === "number" ? v : null; });
                return (
                  <TableRow key={spec.key}>
                    <TableCell className="text-sm text-muted-foreground font-medium">{spec.label}</TableCell>
                    {baterias.map((b, idx) => {
                      const v = b[spec.key];
                      const cls = getHighlightClass(values, idx, spec.higherIsBetter);
                      return <TableCell key={b.id} className={`text-center text-sm tabular-nums ${cls}`}>{v != null && v !== "" ? `${v}${spec.unit || ""}` : "—"}</TableCell>;
                    })}
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell className="text-sm text-muted-foreground font-medium">Dimensões</TableCell>
                {baterias.map(b => (
                  <TableCell key={b.id} className="text-center text-sm">{b.dimensoes_mm || "—"}</TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}><Download className="w-4 h-4" /> Exportar CSV</Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
