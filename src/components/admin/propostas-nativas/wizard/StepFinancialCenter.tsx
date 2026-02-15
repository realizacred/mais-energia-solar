import { useState, useEffect, useMemo } from "react";
import { DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { type VendaData, type KitItemRow, type ServicoItem, formatBRL } from "./types";

interface Props {
  venda: VendaData;
  onVendaChange: (venda: VendaData) => void;
  itens: KitItemRow[];
  servicos: ServicoItem[];
  potenciaKwp: number;
}

export function StepFinancialCenter({ venda, onVendaChange, itens, servicos, potenciaKwp }: Props) {
  const [loadedDefaults, setLoadedDefaults] = useState(false);
  const [descontoMax, setDescontoMax] = useState(100);

  useEffect(() => {
    if (loadedDefaults) return;
    supabase
      .from("pricing_config")
      .select("margem_minima_percent, comissao_padrao_percent, desconto_maximo_percent")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          if (venda.margem_percentual === 20 && d.margem_minima_percent) {
            onVendaChange({ ...venda, margem_percentual: d.margem_minima_percent });
          }
          if (d.desconto_maximo_percent) setDescontoMax(d.desconto_maximo_percent);
        }
        setLoadedDefaults(true);
      });
  }, []);

  const update = (field: keyof VendaData, value: any) => {
    onVendaChange({ ...venda, [field]: value });
  };

  const custoKit = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const custoServicos = servicos.filter(s => s.incluso_no_preco).reduce((s, i) => s + i.valor, 0);
  const custoBase = custoKit + custoServicos + venda.custo_comissao + venda.custo_outros;
  const margemValor = custoBase * (venda.margem_percentual / 100);
  const precoComMargem = custoBase + margemValor;
  const descontoValor = precoComMargem * (venda.desconto_percentual / 100);
  const precoFinal = precoComMargem - descontoValor;
  const margemLiquida = custoBase > 0 ? ((precoFinal - custoBase) / precoFinal) * 100 : 0;
  const lucroLiquido = precoFinal - custoBase;
  const rsKwp = potenciaKwp > 0 ? precoFinal / potenciaKwp : 0;

  // Color zone
  const marginZone = margemLiquida < 10 ? "danger" : margemLiquida < 20 ? "warning" : "success";
  const zoneColors = {
    danger: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive", slider: "destructive" },
    warning: { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", slider: "warning" },
    success: { bg: "bg-success/10", border: "border-success/30", text: "text-success", slider: "success" },
  };
  const zone = zoneColors[marginZone];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" /> Centro de Controle Financeiro
        </h3>
        {potenciaKwp > 0 && (
          <Badge variant="outline" className="text-[10px] font-mono">
            R$ {rsKwp.toFixed(0)}/kWp
          </Badge>
        )}
      </div>

      {/* LARGE Margin Slider */}
      <div className={cn("rounded-md border-2 p-4 space-y-3 transition-colors", zone.bg, zone.border)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold">Margem de Lucro</p>
            <p className={cn("text-3xl font-bold font-mono", zone.text)}>{venda.margem_percentual}%</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Lucro estimado</p>
            <p className={cn("text-lg font-bold font-mono", zone.text)}>{formatBRL(lucroLiquido)}</p>
          </div>
        </div>
        <Slider
          value={[venda.margem_percentual]}
          onValueChange={v => update("margem_percentual", v[0])}
          min={0}
          max={80}
          step={1}
          className="py-2"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span className="text-destructive font-medium">🔴 0%</span>
          <span className="text-warning font-medium">🟡 20%</span>
          <span className="text-success font-medium">🟢 40%</span>
          <span>60%</span>
          <span>80%</span>
        </div>
        {margemLiquida < 10 && (
          <div className="flex items-center gap-1.5 text-[11px] text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Margem líquida perigosamente baixa ({margemLiquida.toFixed(1)}%)
          </div>
        )}
      </div>

      {/* Live price display */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-md border border-border/50 bg-card text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Preço Final</p>
          <p className="text-xl font-bold font-mono text-primary">{formatBRL(precoFinal)}</p>
        </div>
        <div className="p-3 rounded-md border border-border/50 bg-card text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Margem Líquida</p>
          <p className={cn("text-xl font-bold font-mono", zone.text)}>{margemLiquida.toFixed(1)}%</p>
        </div>
      </div>

      {/* Pricing breakdown table */}
      <div className="rounded-md border border-border/50 overflow-hidden text-sm">
        <div className="bg-muted/30 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Composição de Custo</div>
        <div className="divide-y divide-border/30">
          <Row label="Equipamentos" value={custoKit} />
          <Row label="Serviços (inclusos)" value={custoServicos} />
          <div className="grid grid-cols-2 gap-2 px-3 py-2">
            <div className="space-y-0.5">
              <Label className="text-[10px]">Comissão (R$)</Label>
              <Input type="number" min={0} value={venda.custo_comissao || ""} onChange={e => update("custo_comissao", Number(e.target.value))} className="h-7 text-xs" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">Outros custos (R$)</Label>
              <Input type="number" min={0} value={venda.custo_outros || ""} onChange={e => update("custo_outros", Number(e.target.value))} className="h-7 text-xs" />
            </div>
          </div>
          <Row label={`Margem (${venda.margem_percentual}%)`} value={margemValor} className="text-success" />
          <div className="px-3 py-2">
            <div className="space-y-0.5">
              <Label className="text-[10px]">Desconto (%) <span className="text-muted-foreground">máx {descontoMax}%</span></Label>
              <Input
                type="number"
                min={0}
                max={descontoMax}
                value={venda.desconto_percentual || ""}
                onChange={e => update("desconto_percentual", Math.min(Number(e.target.value), descontoMax))}
                className="h-7 text-xs"
              />
            </div>
          </div>
          {venda.desconto_percentual > 0 && <Row label={`Desconto (${venda.desconto_percentual}%)`} value={-descontoValor} className="text-destructive" />}
          <div className="flex justify-between px-3 py-2.5 bg-primary/5 font-bold">
            <span>Preço Final</span>
            <span className="font-mono text-primary">{formatBRL(precoFinal)}</span>
          </div>
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-1">
        <Label className="text-xs">Observações</Label>
        <Textarea value={venda.observacoes} onChange={e => update("observacoes", e.target.value)} placeholder="Condições especiais..." rows={2} className="text-xs" />
      </div>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex justify-between px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-medium", className)}>{formatBRL(value)}</span>
    </div>
  );
}

/** Helper to calculate precoFinal from outside */
export function calcPrecoFinal(itens: KitItemRow[], servicos: ServicoItem[], venda: VendaData): number {
  const custoKit = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const custoServicos = servicos.filter(s => s.incluso_no_preco).reduce((s, i) => s + i.valor, 0);
  const custoBase = custoKit + custoServicos + venda.custo_comissao + venda.custo_outros;
  const margemValor = custoBase * (venda.margem_percentual / 100);
  const precoComMargem = custoBase + margemValor;
  return precoComMargem - precoComMargem * (venda.desconto_percentual / 100);
}
