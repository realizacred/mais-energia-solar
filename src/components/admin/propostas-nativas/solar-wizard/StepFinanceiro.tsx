import { useMemo } from "react";
import { DollarSign, AlertTriangle, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MOCK_BANCOS, formatBRL } from "./mockData";
import {
  type WizFinanceiroData,
  calcPrecoFinal, calcLucro, calcMargemLiquida, calcParcela,
} from "./wizardState";

interface Props {
  financeiro: WizFinanceiroData;
  onFinanceiroChange: (f: WizFinanceiroData) => void;
  kwp: number;
}

export function StepFinanceiro({ financeiro, onFinanceiroChange, kwp }: Props) {
  const update = (field: keyof WizFinanceiroData, value: any) => {
    onFinanceiroChange({ ...financeiro, [field]: value });
  };

  const precoFinal = calcPrecoFinal(financeiro);
  const lucro = calcLucro(financeiro);
  const margemLiq = calcMargemLiquida(financeiro);
  const rsKwp = kwp > 0 ? precoFinal / kwp : 0;

  const zone = margemLiq < 10 ? "danger" : margemLiq < 20 ? "warning" : "success";
  const zoneStyles = {
    danger: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive" },
    warning: { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning" },
    success: { bg: "bg-success/10", border: "border-success/30", text: "text-success" },
  };
  const z = zoneStyles[zone];

  // Financing calc
  const banco = MOCK_BANCOS.find(b => b.id === financeiro.bancoId);
  const principal = precoFinal - financeiro.entrada;
  const parcela = banco ? calcParcela(principal, banco.taxa_mensal, financeiro.numParcelas) : 0;

  return (
    <div className="space-y-4">
      {/* ── MARGIN SLIDER ── */}
      <div className={cn("rounded-md border-2 p-4 space-y-3 transition-colors", z.bg, z.border)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold">Margem de Lucro</p>
            <p className={cn("text-3xl font-bold font-mono", z.text)}>{financeiro.margemPercent}%</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground uppercase">Lucro</p>
            <p className={cn("text-lg font-bold font-mono", z.text)}>{formatBRL(lucro)}</p>
          </div>
        </div>
        <Slider
          value={[financeiro.margemPercent]}
          onValueChange={v => update("margemPercent", v[0])}
          min={0} max={80} step={1}
          className="py-2"
        />
        <div className="flex justify-between text-[8px] text-muted-foreground">
          <span className="text-destructive font-medium">🔴 0%</span>
          <span className="text-destructive">10%</span>
          <span className="text-warning font-medium">🟡 20%</span>
          <span className="text-success font-medium">🟢 40%</span>
          <span>60%</span>
          <span>80%</span>
        </div>
        {margemLiq < 10 && (
          <div className="flex items-center gap-1 text-[10px] text-destructive">
            <AlertTriangle className="h-3 w-3" />
            Margem líquida perigosamente baixa ({margemLiq.toFixed(1)}%)
          </div>
        )}
      </div>

      {/* ── LIVE PRICES ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-md border border-border/50 bg-card text-center">
          <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Preço Final</p>
          <p className="text-lg font-bold font-mono text-primary">{formatBRL(precoFinal)}</p>
        </div>
        <div className="p-3 rounded-md border border-border/50 bg-card text-center">
          <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Margem Líquida</p>
          <p className={cn("text-lg font-bold font-mono", z.text)}>{margemLiq.toFixed(1)}%</p>
        </div>
        <div className="p-3 rounded-md border border-border/50 bg-card text-center">
          <p className="text-[8px] text-muted-foreground uppercase tracking-wider">R$/kWp</p>
          <p className="text-lg font-bold font-mono">{formatBRL(rsKwp)}</p>
        </div>
      </div>

      {/* ── COST BREAKDOWN ── */}
      <div className="rounded-md border border-border/50 overflow-hidden text-xs">
        <div className="bg-muted/30 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Composição de Custo</div>
        <div className="divide-y divide-border/30">
          <CostRow label="Equipamentos" value={financeiro.custoEquipamentos} />
          <div className="grid grid-cols-2 gap-2 px-3 py-1.5">
            <div className="space-y-0.5">
              <Label className="text-[9px]">Instalação (R$)</Label>
              <Input type="number" min={0} value={financeiro.custoInstalacao || ""} onChange={e => update("custoInstalacao", Number(e.target.value))} className="h-7 text-[10px]" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px]">Comissão (R$)</Label>
              <Input type="number" min={0} value={financeiro.custoComissao || ""} onChange={e => update("custoComissao", Number(e.target.value))} className="h-7 text-[10px]" />
            </div>
          </div>
          <div className="px-3 py-1.5 space-y-0.5">
            <Label className="text-[9px]">Impostos (R$)</Label>
            <Input type="number" min={0} value={financeiro.custoImpostos || ""} onChange={e => update("custoImpostos", Number(e.target.value))} className="h-7 text-[10px]" />
          </div>
          <CostRow label={`Margem (${financeiro.margemPercent}%)`} value={lucro} className="text-success" />
          <div className="px-3 py-1.5 space-y-0.5">
            <Label className="text-[9px]">Desconto (%)</Label>
            <Input type="number" min={0} max={50} value={financeiro.descontoPercent || ""} onChange={e => update("descontoPercent", Math.min(Number(e.target.value), 50))} className="h-7 text-[10px]" />
          </div>
          <div className="flex justify-between px-3 py-2 bg-primary/5 font-bold text-sm">
            <span>Preço Final</span>
            <span className="font-mono text-primary">{formatBRL(precoFinal)}</span>
          </div>
        </div>
      </div>

      {/* ── FINANCING ── */}
      <div className="rounded-md border border-border/50 p-3 space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Building2 className="h-3 w-3" /> Financiamento
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-0.5">
            <Label className="text-[9px]">Banco</Label>
            <Select value={financeiro.bancoId} onValueChange={v => update("bancoId", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {MOCK_BANCOS.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nome} ({b.taxa_mensal}%/mês)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[9px]">Entrada (R$)</Label>
            <Input type="number" min={0} value={financeiro.entrada || ""} onChange={e => update("entrada", Number(e.target.value))} className="h-8 text-xs" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[9px]">Parcelas</Label>
            <Input type="number" min={1} max={240} value={financeiro.numParcelas} onChange={e => update("numParcelas", Number(e.target.value))} className="h-8 text-xs" />
          </div>
        </div>

        {banco && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/30">
            {[24, 36, 48, 60].map(n => {
              const p = calcParcela(principal, banco.taxa_mensal, n);
              return (
                <button
                  key={n}
                  onClick={() => update("numParcelas", n)}
                  className={cn(
                    "p-2 rounded-md border text-center transition-colors",
                    financeiro.numParcelas === n ? "border-primary bg-primary/5" : "border-border/30 hover:border-border/60"
                  )}
                >
                  <p className="text-[9px] text-muted-foreground">{n}x de</p>
                  <p className="text-xs font-bold font-mono">{formatBRL(p)}</p>
                </button>
              );
            })}
          </div>
        )}

        {banco && financeiro.numParcelas > 0 && (
          <div className="p-2.5 rounded-md bg-muted/30 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-muted-foreground">{banco.nome} • {financeiro.numParcelas}x</p>
              <p className="text-sm font-bold font-mono text-primary">{formatBRL(parcela)}/mês</p>
            </div>
            {financeiro.entrada > 0 && (
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground">Entrada</p>
                <p className="text-xs font-mono">{formatBRL(financeiro.entrada)}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CostRow({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex justify-between px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-medium", className)}>{formatBRL(value)}</span>
    </div>
  );
}
