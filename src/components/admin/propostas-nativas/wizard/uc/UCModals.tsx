import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

// ─── Rateio Credits Modal ─────────────────────────────────
interface RateioProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ucs: UCData[];
  onSave: (ucs: UCData[]) => void;
}

export function RateioCreditsModal({ open, onOpenChange, ucs, onSave }: RateioProps) {
  const [manual, setManual] = useState(false);
  const [values, setValues] = useState<number[]>([]);

  const calcProportional = (units: UCData[]): number[] => {
    const consumos = units.map(u => u.consumo_mensal || 0);
    const totalConsumo = consumos.reduce((a, b) => a + b, 0);
    if (totalConsumo === 0) {
      const equal = Math.round(100 / units.length);
      return units.map((_, i) => i === 0 ? 100 - equal * (units.length - 1) : equal);
    }
    const raw = consumos.map(c => (c / totalConsumo) * 100);
    const rounded = raw.map(v => Math.round(v));
    const diff = 100 - rounded.reduce((a, b) => a + b, 0);
    rounded[0] += diff;
    return rounded;
  };

  // Always recalculate from consumption when modal opens
  useEffect(() => {
    setValues(calcProportional(ucs));
    setManual(false);
  }, [ucs]);

  const suggested = calcProportional(ucs);
  const total = values.reduce((a, b) => a + b, 0);
  const consumos = ucs.map(u => u.consumo_mensal || 0);
  const totalConsumo = consumos.reduce((a, b) => a + b, 0);

  const handleSave = () => {
    const updated = ucs.map((u, i) => ({
      ...u,
      rateio_creditos: values[i] || 0,
      rateio_sugerido_creditos: suggested[i] || 0,
    }));
    onSave(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rateio de Créditos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-medium">Cálculo baseado no consumo</p>
            <p className="text-[11px] text-muted-foreground">
              Consumo total: <strong>{totalConsumo.toLocaleString("pt-BR")} kWh</strong>
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {ucs.map((uc, i) => (
                <span key={uc.id} className="text-[11px] bg-background rounded px-2 py-0.5 border">
                  UC{i + 1}: {consumos[i].toLocaleString("pt-BR")} kWh → <strong>{suggested[i]}%</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">Ajustar percentuais manualmente</Label>
            <Switch checked={manual} onCheckedChange={(v) => {
              setManual(v);
              if (!v) setValues(calcProportional(ucs));
            }} />
          </div>

          {manual && (
            <div className="border-t pt-3">
              <p className="text-[11px] text-muted-foreground mb-2">
                Total: <strong className={total !== 100 ? "text-destructive" : "text-secondary"}>{total}%</strong>
                {total !== 100 && <span className="text-destructive ml-1">(deve somar 100%)</span>}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {ucs.map((uc, i) => (
                  <div key={uc.id} className="space-y-1">
                    <Label className="text-xs">
                      UC{i + 1} {i === 0 ? "(Geradora)" : ""} 
                      <span className="text-muted-foreground ml-1">sugerido: {suggested[i]}%</span>
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
                        className="h-9 pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!manual && (
            <p className="text-[11px] text-muted-foreground italic">
              Os percentuais acima serão aplicados automaticamente com base no consumo de cada UC.
            </p>
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
