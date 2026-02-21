import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, TrendingUp, Calculator, Shield } from "lucide-react";
import type { TenantPremises } from "@/hooks/useTenantPremises";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { FieldTooltip } from "./valores-padroes/shared";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
}

export function TabFinanceiras({ premises, onChange }: Props) {
  const set = (key: keyof TenantPremises, value: any) =>
    onChange((p) => ({ ...p, [key]: value }));

  return (
    <div className="space-y-5">
      {/* Inflação */}
      <SectionCard icon={TrendingUp} title="Índices de inflação" variant="neutral">
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
      </SectionCard>

      {/* Economia & Investimento */}
      <SectionCard icon={Calculator} title="Economia e investimento" variant="green">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Percentual de economia
              <FieldTooltip text="Percentual estimado de economia na conta de energia com o sistema solar. Usado na calculadora pública e nas propostas." />
            </Label>
            <div className="relative">
              <Input
                type="number"
                step="1"
                value={premises.percentual_economia}
                onChange={(e) => set("percentual_economia", Number(e.target.value))}
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Custo por kWp
              <FieldTooltip text="Custo estimado por kWp instalado. Usado na calculadora pública para estimar o investimento total." />
            </Label>
            <div className="relative">
              <Input
                type="number"
                step="100"
                value={premises.custo_por_kwp}
                onChange={(e) => set("custo_por_kwp", Number(e.target.value))}
                className="pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">R$/kWp</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Vida útil do sistema
              <FieldTooltip text="Vida útil estimada do sistema solar em anos. Usado para cálculo de economia total e payback." />
            </Label>
            <div className="relative">
              <Input
                type="number"
                step="1"
                value={premises.vida_util_sistema}
                onChange={(e) => set("vida_util_sistema", Number(e.target.value))}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">anos</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Custo de disponibilidade */}
      <SectionCard icon={Shield} title="Custo de disponibilidade" variant="blue">
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
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3" />
            Afeta somente na Regra Anterior
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
