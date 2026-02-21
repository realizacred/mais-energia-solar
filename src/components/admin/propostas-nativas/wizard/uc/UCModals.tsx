import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { type UCData, MESES } from "../types";

const MONTH_LABELS: Record<string, string> = {
  jan: "Jan", fev: "Fev", mar: "Mar", abr: "Abr", mai: "Mai", jun: "Jun",
  jul: "Jul", ago: "Ago", set: "Set", out: "Out", nov: "Nov", dez: "Dez",
};

// ─── UC Config Modal ──────────────────────────────────────
interface UCConfigProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  uc: UCData | null;
  index: number;
  onSave: (uc: UCData) => void;
}

export function UCConfigModal({ open, onOpenChange, uc, index, onSave }: UCConfigProps) {
  const [local, setLocal] = useState<UCData | null>(null);

  useEffect(() => { if (uc) setLocal({ ...uc }); }, [uc]);

  if (!local) return null;

  const update = (field: keyof UCData, value: any) => setLocal({ ...local, [field]: value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{index + 1}. {index === 0 ? "(Geradora)" : "Unidade"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Imposto Energia Compensada</Label>
            <div className="relative">
              <Input type="number" step="0.01" value={local.imposto_energia || ""} onChange={e => update("imposto_energia", Number(e.target.value))} className="h-9 pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Custo de Disponibilidade <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input type="number" min={0} value={local.custo_disponibilidade_kwh || ""} onChange={e => update("custo_disponibilidade_kwh", Number(e.target.value))} className="h-9 pr-10" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kWh</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Encargos Atual</Label>
              <Input type="number" step="0.01" value={local.outros_encargos_atual || ""} onChange={e => update("outros_encargos_atual", Number(e.target.value))} className="h-9" placeholder="R$ 0,00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Encargos Novo</Label>
              <Input type="number" step="0.01" value={local.outros_encargos_novo || ""} onChange={e => update("outros_encargos_novo", Number(e.target.value))} className="h-9" placeholder="R$ 0,00" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => { onSave(local); onOpenChange(false); }} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Credit Distribution Engine ──────────────────────────
interface DistributionResult {
  allocated: number[];   // kWh allocated per UC
  percentual: number[];  // effective % per UC
  excedente: number;     // unallocated kWh
}

/**
 * Distributes generation credits respecting consumption caps.
 * Excess from capped UCs is redistributed to remaining UCs.
 */
function distributeCredits(
  geracaoTotal: number,
  consumos: number[],
  percentuais: number[],
  allowGeneradora: boolean,
  geradoraIndex: number,
): DistributionResult {
  const n = consumos.length;
  const allocated = new Array(n).fill(0);
  let remaining = geracaoTotal;

  // Initial allocation by percentage
  const initialAlloc = percentuais.map(p => (p / 100) * geracaoTotal);

  // Track which UCs can still receive credits
  const locked = new Array(n).fill(false);

  // Block geradora unless allowed
  if (!allowGeneradora && geradoraIndex >= 0) {
    locked[geradoraIndex] = true;
    remaining -= 0; // geradora gets 0
  }

  // Iterative redistribution loop
  let maxIter = 10;
  let pool = remaining;
  const effectivePercent = [...percentuais];

  // Zero out geradora percentage if not allowed
  if (!allowGeneradora && geradoraIndex >= 0) {
    effectivePercent[geradoraIndex] = 0;
    const sumOthers = effectivePercent.reduce((a, b) => a + b, 0);
    if (sumOthers > 0) {
      effectivePercent.forEach((_, i) => {
        if (i !== geradoraIndex) effectivePercent[i] = (effectivePercent[i] / sumOthers) * 100;
      });
    }
  }

  while (maxIter-- > 0 && pool > 0.01) {
    const activeSum = effectivePercent.reduce((s, p, i) => s + (locked[i] ? 0 : p), 0);
    if (activeSum <= 0) break;

    let excess = 0;
    for (let i = 0; i < n; i++) {
      if (locked[i]) continue;
      const share = (effectivePercent[i] / activeSum) * pool;
      const maxCredit = Math.max(0, consumos[i] - allocated[i]);
      if (share <= maxCredit) {
        allocated[i] += share;
      } else {
        allocated[i] += maxCredit;
        excess += share - maxCredit;
        locked[i] = true;
      }
    }
    pool = excess;
  }

  const totalAlloc = allocated.reduce((a, b) => a + b, 0);
  const resultPercent = geracaoTotal > 0
    ? allocated.map(a => Math.round((a / geracaoTotal) * 100))
    : new Array(n).fill(0);

  return {
    allocated,
    percentual: resultPercent,
    excedente: Math.max(0, geracaoTotal - totalAlloc),
  };
}

// ─── Rateio Credits Modal ─────────────────────────────────
interface RateioProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ucs: UCData[];
  geracaoMensal: number; // total monthly generation kWh
  onSave: (ucs: UCData[]) => void;
}

export function RateioCreditsModal({ open, onOpenChange, ucs, geracaoMensal, onSave }: RateioProps) {
  const [manual, setManual] = useState(false);
  const [values, setValues] = useState<number[]>([]);
  const [allowGeneradora, setAllowGeneradora] = useState(false);

  const geradoraIndex = ucs.findIndex(u => u.is_geradora);
  const consumos = ucs.map(u => u.consumo_mensal || 0);
  const totalConsumo = consumos.reduce((a, b) => a + b, 0);

  const calcProportional = (units: UCData[]): number[] => {
    const cons = units.map(u => u.consumo_mensal || 0);
    const total = cons.reduce((a, b) => a + b, 0);
    if (total === 0) {
      const equal = Math.round(100 / units.length);
      return units.map((_, i) => i === 0 ? 100 - equal * (units.length - 1) : equal);
    }
    const raw = cons.map(c => (c / total) * 100);
    const rounded = raw.map(v => Math.round(v));
    const diff = 100 - rounded.reduce((a, b) => a + b, 0);
    rounded[0] += diff;
    return rounded;
  };

  useEffect(() => {
    if (!open) return;
    const suggested = calcProportional(ucs);
    // Zero geradora by default
    if (geradoraIndex >= 0 && !allowGeneradora) {
      suggested[geradoraIndex] = 0;
      const sumOthers = suggested.reduce((a, b) => a + b, 0);
      if (sumOthers > 0) {
        const factor = 100 / sumOthers;
        suggested.forEach((v, i) => { suggested[i] = Math.round(v * factor); });
        const diff = 100 - suggested.reduce((a, b) => a + b, 0);
        const firstActive = suggested.findIndex((_, i) => i !== geradoraIndex);
        if (firstActive >= 0) suggested[firstActive] += diff;
      }
    }
    setValues(suggested);
    setManual(false);
  }, [open, ucs.length]);

  const total = values.reduce((a, b) => a + b, 0);

  // Run distribution engine for preview
  const preview = useMemo(() => {
    if (geracaoMensal <= 0 || total !== 100) return null;
    return distributeCredits(geracaoMensal, consumos, values, allowGeneradora, geradoraIndex);
  }, [geracaoMensal, consumos, values, allowGeneradora, geradoraIndex, total]);

  const handleSave = () => {
    const updated = ucs.map((u, i) => ({
      ...u,
      rateio_creditos: preview ? preview.percentual[i] : values[i] || 0,
      rateio_sugerido_creditos: values[i] || 0,
    }));
    onSave(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rateio de Créditos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
          {/* Summary bar */}
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-medium">Resumo</p>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
              <span>Consumo total: <strong>{totalConsumo.toLocaleString("pt-BR")} kWh</strong></span>
              <span>Geração mensal: <strong>{geracaoMensal.toLocaleString("pt-BR")} kWh</strong></span>
            </div>
          </div>

          {/* Generator toggle */}
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label className="text-xs font-medium">Permitir crédito na geradora</Label>
              <p className="text-[11px] text-muted-foreground">A UC geradora normalmente não recebe créditos</p>
            </div>
            <Switch checked={allowGeneradora} onCheckedChange={(v) => {
              setAllowGeneradora(v);
              // Recalculate proportional
              const suggested = calcProportional(ucs);
              if (!v && geradoraIndex >= 0) {
                suggested[geradoraIndex] = 0;
                const sumOthers = suggested.reduce((a, b) => a + b, 0);
                if (sumOthers > 0) {
                  const factor = 100 / sumOthers;
                  suggested.forEach((val, i) => { suggested[i] = Math.round(val * factor); });
                  const diff = 100 - suggested.reduce((a, b) => a + b, 0);
                  const firstActive = suggested.findIndex((_, i) => i !== geradoraIndex);
                  if (firstActive >= 0) suggested[firstActive] += diff;
                }
              }
              if (!manual) setValues(suggested);
            }} />
          </div>

          {/* Manual toggle */}
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">Ajustar percentuais manualmente</Label>
            <Switch checked={manual} onCheckedChange={(v) => {
              setManual(v);
              if (!v) {
                const suggested = calcProportional(ucs);
                if (!allowGeneradora && geradoraIndex >= 0) {
                  suggested[geradoraIndex] = 0;
                  const sumOthers = suggested.reduce((a, b) => a + b, 0);
                  if (sumOthers > 0) {
                    const factor = 100 / sumOthers;
                    suggested.forEach((val, i) => { suggested[i] = Math.round(val * factor); });
                    const diff = 100 - suggested.reduce((a, b) => a + b, 0);
                    const firstActive = suggested.findIndex((_, i) => i !== geradoraIndex);
                    if (firstActive >= 0) suggested[firstActive] += diff;
                  }
                }
                setValues(suggested);
              }
            }} />
          </div>

          {/* Percentage inputs */}
          {manual && (
            <div className="border-t pt-3">
              <p className="text-[11px] text-muted-foreground mb-2">
                Total: <strong className={total !== 100 ? "text-destructive" : "text-secondary"}>{total}%</strong>
                {total !== 100 && <span className="text-destructive ml-1">(deve somar 100%)</span>}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {ucs.map((uc, i) => {
                  const isGeradora = i === geradoraIndex;
                  const disabled = isGeradora && !allowGeneradora;
                  return (
                    <div key={uc.id} className="space-y-1">
                      <Label className="text-xs">
                        UC{i + 1} {isGeradora ? "(Geradora)" : ""}
                        <span className="text-muted-foreground ml-1 text-[10px]">{consumos[i]} kWh</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={values[i] ?? 0}
                          onChange={e => {
                            const v = [...values];
                            v[i] = Number(e.target.value);
                            setValues(v);
                          }}
                          disabled={disabled}
                          className="h-9 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview — always show when valid */}
          {preview && total === 100 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                Preview da distribuição
              </p>
              <div className="rounded-md border divide-y">
                {ucs.map((uc, i) => {
                  const isGeradora = i === geradoraIndex;
                  const alloc = Math.round(preview.allocated[i]);
                  const cap = consumos[i];
                  const isCapped = alloc >= cap && cap > 0;
                  return (
                    <div key={uc.id} className="flex items-center justify-between px-3 py-2 text-[11px]">
                      <span className="font-medium">
                        UC{i + 1} {isGeradora ? "(Geradora)" : ""}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          {alloc.toLocaleString("pt-BR")} / {cap.toLocaleString("pt-BR")} kWh
                        </span>
                        <span className={`font-semibold ${isCapped ? "text-warning" : "text-secondary"}`}>
                          {preview.percentual[i]}%
                        </span>
                        {isCapped && (
                          <span className="text-[10px] text-warning">(cap)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {preview.excedente > 0.5 && (
                <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/30 p-2.5">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-warning">Geração excedente no período</p>
                    <p className="text-[11px] text-muted-foreground">
                      {Math.round(preview.excedente).toLocaleString("pt-BR")} kWh não foram alocados a nenhuma UC.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button
            onClick={handleSave}
            disabled={total !== 100}
            className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mês a Mês Dialog ─────────────────────────────────────
interface MesAMesProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  values: Record<string, number>;
  onSave: (values: Record<string, number>) => void;
}

export function MesAMesDialog({ open, onOpenChange, title, values, onSave }: MesAMesProps) {
  const [local, setLocal] = useState<Record<string, number>>({});

  useEffect(() => { setLocal({ ...values }); }, [values]);

  const total = MESES.reduce((s, m) => s + (local[m] || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title} — Mês a mês</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">Total: <strong>{total.toLocaleString("pt-BR")} kWh</strong> • Média: <strong>{Math.round(total / 12)} kWh/mês</strong></p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {MESES.map(m => (
              <div key={m} className="space-y-0.5">
                <Label className="text-[9px] text-muted-foreground uppercase text-center block">{MONTH_LABELS[m]}</Label>
                <Input
                  type="number"
                  min={0}
                  value={local[m] || ""}
                  onChange={e => setLocal({ ...local, [m]: Number(e.target.value) })}
                  className="h-8 text-xs text-center px-1"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => { onSave(local); onOpenChange(false); }} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
