import { useState, useEffect } from "react";
import { SlidersHorizontal, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { type VendaData, type KitItemRow, type ServicoItem, formatBRL } from "./types";

interface StepVendaProps {
  venda: VendaData;
  onVendaChange: (venda: VendaData) => void;
  itens: KitItemRow[];
  servicos: ServicoItem[];
}

export function StepVenda({ venda, onVendaChange, itens, servicos }: StepVendaProps) {
  const [loadedDefaults, setLoadedDefaults] = useState(false);
  const [descontoMax, setDescontoMax] = useState(100);

  // Load pricing_config defaults once
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
          // Only apply defaults if user hasn't touched them
          if (venda.margem_percentual === 20 && d.margem_minima_percent) {
            onVendaChange({
              ...venda,
              margem_percentual: d.margem_minima_percent,
            });
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

  return (
    <div className="space-y-5">
      <h3 className="text-base font-bold flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-primary" /> Precificação
      </h3>

      {/* Margem */}
      <div className="space-y-3 p-4 rounded-xl border border-border/50 bg-muted/10">
        <div className="flex items-center justify-between">
          <Label className="font-semibold">Margem de Lucro</Label>
          <Badge variant="secondary" className="text-sm font-bold">{venda.margem_percentual}%</Badge>
        </div>
        <Slider value={[venda.margem_percentual]} onValueChange={v => update("margem_percentual", v[0])} min={0} max={80} step={1} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0%</span><span>20%</span><span>40%</span><span>60%</span><span>80%</span>
        </div>
      </div>

      {/* Custos adicionais + desconto */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Comissão (R$)</Label>
          <Input type="number" min={0} value={venda.custo_comissao || ""} onChange={e => update("custo_comissao", Number(e.target.value))} placeholder="0,00" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Outros custos (R$)</Label>
          <Input type="number" min={0} value={venda.custo_outros || ""} onChange={e => update("custo_outros", Number(e.target.value))} placeholder="0,00" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Desconto (%) <span className="text-muted-foreground font-normal">máx {descontoMax}%</span></Label>
          <Input type="number" min={0} max={descontoMax} value={venda.desconto_percentual || ""} onChange={e => update("desconto_percentual", Math.min(Number(e.target.value), descontoMax))} placeholder="0" className="h-9" />
        </div>
      </div>

      {/* Resumo */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo de Custos</div>
        <div className="divide-y divide-border/30">
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Custo Equipamentos</span>
            <span className="font-medium">{formatBRL(custoKit)}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Custo Serviços (inclusos)</span>
            <span className="font-medium">{formatBRL(custoServicos)}</span>
          </div>
          {venda.custo_comissao > 0 && (
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Comissão</span>
              <span className="font-medium">{formatBRL(venda.custo_comissao)}</span>
            </div>
          )}
          {venda.custo_outros > 0 && (
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Outros custos</span>
              <span className="font-medium">{formatBRL(venda.custo_outros)}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Margem ({venda.margem_percentual}%)</span>
            <span className="font-medium text-success">{formatBRL(margemValor)}</span>
          </div>
          {venda.desconto_percentual > 0 && (
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Desconto ({venda.desconto_percentual}%)</span>
              <span className="font-medium text-destructive">-{formatBRL(descontoValor)}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-3 bg-primary/5">
            <div>
              <span className="text-base font-bold">Preço Final</span>
              <span className="text-xs text-muted-foreground ml-2">
                Margem líq. {margemLiquida.toFixed(1)}%
              </span>
            </div>
            <span className="text-base font-bold text-primary">{formatBRL(precoFinal)}</span>
          </div>
        </div>
      </div>

      {/* R$/kWp indicator */}
      {custoKit > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            R$/kWp não disponível (potência vem do wizard)
          </Badge>
        </div>
      )}

      {/* Observações */}
      <div className="space-y-2">
        <Label>Observações (opcional)</Label>
        <Textarea value={venda.observacoes} onChange={e => update("observacoes", e.target.value)} placeholder="Notas, condições especiais..." rows={3} />
      </div>
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
