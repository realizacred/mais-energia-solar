/**
 * EstimateReportDialog — Dialog for creating estimated (approximate) financial reports.
 * Shows period selector, tariff/credit inputs, and a live preview of the calculation.
 */
import { useState, useEffect, useCallback } from "react";
import { formatBRL, formatDecimalBR } from "@/lib/formatters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FileBarChart } from "lucide-react";
import { toast } from "sonner";
import { useCreateEstimatedReport, fetchGenerationForPeriod } from "@/hooks/useEstimatedReports";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantId: string;
  capacityKwp: number;
  totalInvestido: number | null;
}

export function EstimateReportDialog({
  open,
  onOpenChange,
  plantId,
  capacityKwp,
  totalInvestido,
}: Props) {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [tarifa, setTarifa] = useState("0.5");
  const [credito, setCredito] = useState("0");

  // Calculated values
  const [geracao, setGeracao] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const createMutation = useCreateEstimatedReport();

  // Fetch generation when period changes
  const fetchGeneration = useCallback(async () => {
    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      setGeracao(null);
      return;
    }
    setLoading(true);
    try {
      const total = await fetchGenerationForPeriod(plantId, periodStart, periodEnd);
      setGeracao(Math.round(total * 10) / 10);
    } catch {
      setGeracao(null);
    } finally {
      setLoading(false);
    }
  }, [plantId, periodStart, periodEnd]);

  useEffect(() => {
    if (open && periodStart && periodEnd) {
      fetchGeneration();
    }
  }, [open, periodStart, periodEnd, fetchGeneration]);

  // Derived calculations
  const tarifaNum = parseFloat(tarifa) || 0;
  const creditoNum = parseFloat(credito) || 0;
  const geracaoLiquida = (geracao ?? 0) - creditoNum;
  const retornoEstimado = geracaoLiquida > 0 ? geracaoLiquida * tarifaNum : 0;
  const investimento = totalInvestido ?? 0;
  const retornoPct = investimento > 0 ? (retornoEstimado / investimento) * 100 : 0;

  // Prognosis-based performance (simple: capacity * 4.5 HSP * days)
  const AVG_HSP = 4.5;
  const daysDiff =
    periodStart && periodEnd
      ? Math.max(1, Math.ceil((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000) + 1)
      : 0;
  const prognosisKwh = capacityKwp * AVG_HSP * daysDiff;
  const desempenho = prognosisKwh > 0 && geracao !== null ? (geracao / prognosisKwh) * 100 : 0;

  const handleCreate = async () => {
    if (!periodStart || !periodEnd || !tarifaNum) {
      toast.error("Preencha período e tarifa");
      return;
    }

    try {
      await createMutation.mutateAsync({
        plant_id: plantId,
        period_start: periodStart,
        period_end: periodEnd,
        tarifa_kwh: tarifaNum,
        credito_kwh: creditoNum,
        total_investido: investimento || null,
        geracao_periodo_kwh: geracao,
        desempenho_pct: Math.round(desempenho * 100) / 100,
        retorno_estimado: Math.round(retornoEstimado * 100) / 100,
        retorno_pct: Math.round(retornoPct * 100) / 100,
      });
      toast.success("Relatório estimado criado com sucesso");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar relatório");
    }
  };

  // Reset on open
  useEffect(() => {
    if (open) {
      setPeriodStart("");
      setPeriodEnd("");
      setTarifa("0.5");
      setCredito("0");
      setGeracao(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileBarChart className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Estimar relatórios antigos
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gere relatórios com dados aproximados para períodos sem fatura
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            {/* Period */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Período *</Label>
              <div className="flex items-center gap-2">
                <DateInput
                  value={periodStart}
                  onChange={setPeriodStart}
                  className="flex-1"
                />
                <span className="text-muted-foreground text-sm">→</span>
                <DateInput
                  value={periodEnd}
                  onChange={setPeriodEnd}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Tariff + Credit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tarifa (R$) estimada por kWh *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tarifa}
                  onChange={(e) => setTarifa(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Crédito (kWh)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={credito}
                  onChange={(e) => setCredito(e.target.value)}
                />
              </div>
            </div>

            {/* Calculated preview */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
              {investimento > 0 && (
                <p className="text-muted-foreground">
                  Total investido: <span className="font-semibold text-foreground">{formatBRL(investimento)}</span>
                </p>
              )}
              <p className="text-muted-foreground">
                Geração no período:{" "}
                {loading ? (
                  <Skeleton className="inline-block h-4 w-20" />
                ) : geracao !== null ? (
                  <span className="font-semibold text-foreground">{formatDecimalBR(geracao, 1)} kWh</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
              {geracao !== null && (
                <>
                  <p className="text-muted-foreground">
                    Desempenho: <span className="font-semibold text-foreground">{desempenho.toFixed(0)}%</span>
                  </p>
                  <p className="text-muted-foreground">
                    Retorno estimado no período com essa tarifa:{" "}
                    <span className="font-semibold text-foreground">
                      R$ {retornoEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    {investimento > 0 && (
                      <span className="text-foreground">
                        {" "}ou {retornoPct.toFixed(2)}% do valor investido
                      </span>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || !periodStart || !periodEnd || !tarifaNum || loading}
          >
            {createMutation.isPending ? "Criando..." : "Criar Relatório"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
