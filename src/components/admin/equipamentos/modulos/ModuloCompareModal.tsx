import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitCompareArrows, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Modulo } from "./types";
import { useCallback } from "react";

interface Props {
  modulos: Modulo[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface SpecRow {
  label: string;
  key: keyof Modulo;
  unit?: string;
  higherIsBetter?: boolean;
}

const SPECS: SpecRow[] = [
  { label: "Potência", key: "potencia_wp", unit: " Wp", higherIsBetter: true },
  { label: "Eficiência", key: "eficiencia_percent", unit: "%", higherIsBetter: true },
  { label: "Nº Células", key: "num_celulas", higherIsBetter: true },
  { label: "Vmp", key: "vmp_v", unit: " V" },
  { label: "Imp", key: "imp_a", unit: " A" },
  { label: "Voc", key: "voc_v", unit: " V" },
  { label: "Isc", key: "isc_a", unit: " A" },
  { label: "Comprimento", key: "comprimento_mm", unit: " mm" },
  { label: "Largura", key: "largura_mm", unit: " mm" },
  { label: "Peso", key: "peso_kg", unit: " kg", higherIsBetter: false },
  { label: "Garantia Produto", key: "garantia_produto_anos", unit: " anos", higherIsBetter: true },
  { label: "Garantia Perf.", key: "garantia_performance_anos", unit: " anos", higherIsBetter: true },
  { label: "Tipo Célula", key: "tipo_celula" },
  
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

export function ModuloCompareModal({ modulos, open, onOpenChange }: Props) {
  const exportCSV = useCallback(() => {
    const headers = ["Spec", ...modulos.map(m => `${m.fabricante} ${m.modelo}`)];
    const rows = SPECS.map(spec => [
      spec.label,
      ...modulos.map(m => {
        const v = m[spec.key];
        return v != null ? `${v}${spec.unit || ""}` : "—";
      }),
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparacao_modulos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [modulos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <GitCompareArrows className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Comparar Módulos ({modulos.length})
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Comparação lado a lado das especificações</p>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-[140px]">Spec</TableHead>
                {modulos.map(m => (
                  <TableHead key={m.id} className="font-semibold text-center">
                    <div className="text-xs text-muted-foreground">{m.fabricante}</div>
                    <div className="text-sm truncate max-w-[180px]">{m.modelo}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SPECS.map(spec => {
                const values = modulos.map(m => {
                  const v = m[spec.key];
                  return typeof v === "number" ? v : null;
                });
                return (
                  <TableRow key={spec.key}>
                    <TableCell className="text-sm text-muted-foreground font-medium">{spec.label}</TableCell>
                    {modulos.map((m, idx) => {
                      const v = m[spec.key];
                      const cls = getHighlightClass(values, idx, spec.higherIsBetter);
                      return (
                        <TableCell key={m.id} className={`text-center text-sm tabular-nums ${cls}`}>
                          {v != null && v !== "" ? `${v}${spec.unit || ""}` : "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
