import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Info, TrendingUp, Calculator, Shield } from "lucide-react";
import type { TenantPremises } from "@/hooks/useTenantPremises";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
}

function FieldTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary cursor-help inline-block ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TabFinanceiras({ premises, onChange }: Props) {
  const set = (key: keyof TenantPremises, value: any) =>
    onChange((p) => ({ ...p, [key]: value }));

  return (
    <div className="space-y-6">
      {/* Inflação */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Índices de inflação</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Inflação energética
              <FieldTooltip text="Reajuste anual estimado da tarifa de energia elétrica. Historicamente acima do IPCA." />
            </Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={premises.inflacao_energetica.toFixed(2)}
                onChange={(e) => set("inflacao_energetica", Number(e.target.value))}
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">%/ano</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              VPL — Taxa de desconto
              <FieldTooltip text="Taxa utilizada para calcular o Valor Presente Líquido (VPL) do investimento solar. Geralmente baseada na taxa Selic ou custo de oportunidade do capital." />
            </Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={premises.vpl_taxa_desconto.toFixed(2)}
                onChange={(e) => set("vpl_taxa_desconto", Number(e.target.value))}
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Custo de disponibilidade */}
      <div className="rounded-xl border-2 border-info/30 bg-info/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-info" />
          <p className="text-xs font-semibold uppercase tracking-wider text-info">Custo de disponibilidade</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Considerar custo de disponibilidade?
            <FieldTooltip text="Se habilitado, subtrai o custo mínimo de disponibilidade (taxa de conexão à rede) do cálculo de economia." />
          </Label>
          <Select
            value={premises.considerar_custo_disponibilidade ? "sim" : "nao"}
            onValueChange={(v) => set("considerar_custo_disponibilidade", v === "sim")}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
          <p className="flex items-center gap-1 text-[11px] text-primary">
            <Info className="h-3 w-3" />
            Afeta somente na Regra Anterior
          </p>
        </div>
      </div>
    </div>
  );
}
