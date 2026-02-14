import { SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { type VendaData, type KitItemRow, type ServicoItem, formatBRL } from "./types";

interface StepVendaProps {
  venda: VendaData;
  onVendaChange: (venda: VendaData) => void;
  itens: KitItemRow[];
  servicos: ServicoItem[];
}

export function StepVenda({ venda, onVendaChange, itens, servicos }: StepVendaProps) {
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
          <Label className="text-xs">Desconto (%)</Label>
          <Input type="number" min={0} max={100} value={venda.desconto_percentual || ""} onChange={e => update("desconto_percentual", Number(e.target.value))} placeholder="0" className="h-9" />
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
          <div className="flex justify-between px-4 py-3 text-base font-bold bg-primary/5">
            <span>Preço Final</span>
            <span className="text-primary">{formatBRL(precoFinal)}</span>
          </div>
        </div>
      </div>

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
