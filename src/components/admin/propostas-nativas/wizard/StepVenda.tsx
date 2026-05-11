import { useState, useEffect } from "react";
import { Loader2, Sparkles, AlertTriangle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { type VendaData, type KitItemRow, type ServicoItem, formatBRL } from "./types";
import { roundCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { usePricingDefaults } from "./hooks/usePricingDefaults";
import { toast } from "@/hooks/use-toast";

interface StepVendaProps {
  venda: VendaData;
  onVendaChange: (venda: VendaData) => void;
  itens: KitItemRow[];
  servicos: ServicoItem[];
  potenciaKwp?: number;
}

export function StepVenda({ venda, onVendaChange, itens, servicos, potenciaKwp = 0 }: StepVendaProps) {
  const [loadedDefaults, setLoadedDefaults] = useState(false);
  const [descontoMax, setDescontoMax] = useState(100);

  const { suggested, loading: loadingHistory, hasHistory } = usePricingDefaults(potenciaKwp);

  // Load pricing_config defaults once (SSOT for initial margin)
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

  const custoKit = roundCurrency(itens.reduce((s, i) => s + roundCurrency(i.quantidade * i.preco_unitario), 0));
  const custoServicos = roundCurrency(servicos.filter(s => s.incluso_no_preco).reduce((s, i) => s + i.valor, 0));
  const custoBase = roundCurrency(custoKit + custoServicos + venda.custo_comissao + venda.custo_outros);
  // Margem aplicada sobre custos SEM comissão (comissão não recebe markup)
  const custoParaMargem = roundCurrency(custoKit + custoServicos + venda.custo_outros);
  const margemValor = roundCurrency(custoParaMargem * (venda.margem_percentual / 100));
  const precoComMargem = roundCurrency(custoBase + margemValor);
  const precoSlider = precoComMargem; // Preço alvo sem o desconto
  const margemMeta = precoSlider > 0 ? ((precoSlider - custoBase) / precoSlider) * 100 : 0;

  const descontoValor = roundCurrency(precoComMargem * (venda.desconto_percentual / 100));
  const precoFinal = roundCurrency(precoComMargem - descontoValor);
  const margemLiquida = precoFinal > 0 ? ((precoFinal - custoBase) / precoFinal) * 100 : 0;
  const isMargemOk = margemLiquida >= margemMeta - 0.01; // tolerance for rounding

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* ── Left: Controls ── */}
      <div className="flex-1 min-w-0 space-y-5">
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
          {/* Indicador de margem sugerida/histórica */}
          <p className="text-xs text-muted-foreground mt-1">
            💡 {hasHistory ? "Sua margem histórica média" : "Margem sugerida"}: {hasHistory && suggested?.margem_percentual != null ? (Math.round(suggested.margem_percentual * 10) / 10) : "20"}%
            <span className="mx-2">|</span>
            <span className="inline-flex items-center gap-1">
              Meta: <span className="font-semibold text-foreground">{margemMeta.toFixed(1)}%</span>
              <span className="mx-1">|</span>
              Atual: <span className={cn("font-bold flex items-center gap-0.5", isMargemOk ? "text-success" : "text-destructive")}>
                {margemLiquida.toFixed(1)}%
                {isMargemOk ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              </span>
            </span>
          </p>
        </div>

        {/* Custos adicionais + desconto */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Comissão</Label>
            <CurrencyInput value={venda.custo_comissao || 0} onChange={v => update("custo_comissao", v)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Outros custos</Label>
            <CurrencyInput value={venda.custo_outros || 0} onChange={v => update("custo_outros", v)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Desconto (%) <span className="text-muted-foreground font-normal">máx {descontoMax}%</span></Label>
            <Input 
              type="number" 
              min={0} 
              max={descontoMax} 
              value={venda.desconto_percentual === 0 ? "" : venda.desconto_percentual} 
              onChange={e => {
                const val = e.target.value === "" ? 0 : Number(e.target.value);
                update("desconto_percentual", Math.min(val, descontoMax));
              }} 
              placeholder="0" 
              className="h-9" 
            />
          </div>
        </div>

        {/* Observações */}
        <div className="space-y-2">
          <Label>Observações (opcional)</Label>
          <Textarea value={venda.observacoes} onChange={e => update("observacoes", e.target.value)} placeholder="Notas, condições especiais..." rows={3} />
        </div>
      </div>

      {/* ── Right: Summary (sticky sidebar) ── */}
      <div className="hidden lg:block">
        <div className="rounded-xl border border-border/50 overflow-hidden sticky top-4">
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
                  Margem líq. {(Number(margemLiquida) || 0).toFixed(1)}%
                </span>
              </div>
              <span className="text-base font-bold text-primary">{formatBRL(precoFinal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// calcPrecoFinal movido para types.ts (SSOT) — re-export para compatibilidade
export { calcPrecoFinal } from "./types";
