import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Info } from "lucide-react";
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

function NumField({ label, suffix, value, step, tooltip, onChange }: {
  label: string; suffix: string; value: number; step?: string; tooltip?: string;
  onChange: (v: number) => void;
}) {
  const isPercent = suffix === "%";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {tooltip && <FieldTooltip text={tooltip} />}
      </Label>
      <div className="relative">
        <Input
          type="number"
          step={step || "0.01"}
          value={isPercent ? value.toFixed(2) : value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="pr-14"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">{suffix}</span>
      </div>
    </div>
  );
}

export function TabSistemaSolar({ premises, onChange }: Props) {
  const set = (key: keyof TenantPremises, value: any) =>
    onChange((p) => ({ ...p, [key]: value }));

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Base de Irradiância
              <FieldTooltip text="Fonte dos dados de irradiação solar. INPE 2017 é mais recente e recomendado. INPE 2009 pode ser usado para comparação histórica." />
            </Label>
            <Select value={premises.base_irradiancia} onValueChange={(v) => set("base_irradiancia", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inpe_2017">Atlas Brasileiro 2ª Edição (INPE 2017 - SUNDATA)</SelectItem>
                <SelectItem value="inpe_2009">Brazil Solar Global 10KM (INPE 2009)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NumField label="Sobredimensionamento Padrão" suffix="%" value={premises.sobredimensionamento_padrao} tooltip="Margem extra sobre a potência calculada para compensar perdas reais e garantir a geração esperada. Típico: 10-30%." onChange={(v) => set("sobredimensionamento_padrao", v)} />
          <div />
        </div>

        {/* Linha 2 - Eficiência */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Perda de Eficiência Anual (Tradicional)" suffix="%" value={premises.perda_eficiencia_tradicional} tooltip="Degradação anual dos módulos com inversor string. Fabricantes garantem ~0.5-0.7%/ano. Módulos Tier 1 tendem a degradar menos." onChange={(v) => set("perda_eficiencia_tradicional", v)} />
          <NumField label="Perda de Eficiência Anual (MicroInversor)" suffix="%" value={premises.perda_eficiencia_microinversor} tooltip="Degradação anual com microinversores. Pode ser menor pois cada módulo opera no seu ponto ótimo de potência (MPPT individual)." onChange={(v) => set("perda_eficiencia_microinversor", v)} />
          <NumField label="Perda de Eficiência Anual (Otimizador)" suffix="%" value={premises.perda_eficiencia_otimizador} tooltip="Degradação anual com otimizadores DC. Similar ao microinversor por ter MPPT individual, mas com inversor centralizado." onChange={(v) => set("perda_eficiencia_otimizador", v)} />
        </div>

        {/* Linha 3 - Troca inversor */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Troca de Inversor - Após (Tradicional)" suffix="Anos" step="1" value={premises.troca_inversor_anos_tradicional} tooltip="Vida útil estimada do inversor string antes da troca. Inversores de qualidade duram 10-15 anos." onChange={(v) => set("troca_inversor_anos_tradicional", v)} />
          <NumField label="Troca de Inversor - Após (MicroInversor)" suffix="Anos" step="1" value={premises.troca_inversor_anos_microinversor} tooltip="Microinversores geralmente têm garantia de 25 anos, podendo não precisar de troca durante a vida útil do sistema." onChange={(v) => set("troca_inversor_anos_microinversor", v)} />
          <NumField label="Troca de Inversor - Após (Otimizador)" suffix="Anos" step="1" value={premises.troca_inversor_anos_otimizador} tooltip="Otimizadores DC têm garantia de 20-25 anos, mas o inversor central pode precisar de troca em ~10-15 anos." onChange={(v) => set("troca_inversor_anos_otimizador", v)} />
        </div>

        {/* Linha 4 - Custo troca */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Custo da Troca de Inversor (Tradicional)" suffix="%" value={premises.custo_troca_inversor_tradicional} tooltip="Custo estimado da troca como percentual do valor total do sistema. Inclui equipamento + mão de obra." onChange={(v) => set("custo_troca_inversor_tradicional", v)} />
          <NumField label="Custo da Troca de Inversor (MicroInversor)" suffix="%" value={premises.custo_troca_inversor_microinversor} onChange={(v) => set("custo_troca_inversor_microinversor", v)} />
          <NumField label="Custo da Troca de Inversor (Otimizador)" suffix="%" value={premises.custo_troca_inversor_otimizador} onChange={(v) => set("custo_troca_inversor_otimizador", v)} />
        </div>

        {/* Linha 5 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Margem para potência ideal" suffix="%" value={premises.margem_potencia_ideal} tooltip="Margem de tolerância para considerar a potência do sistema como 'ideal'. Usado no dimensionamento para evitar sub/sobredimensionamento excessivo." onChange={(v) => set("margem_potencia_ideal", v)} />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Considerar custo de disponibilidade?
              <FieldTooltip text="Se habilitado, subtrai o custo mínimo de disponibilidade (taxa de conexão à rede) do cálculo de economia. Afeta apenas clientes que migraram antes da Lei 14.300." />
            </Label>
            <Select
              value={premises.considerar_custo_disponibilidade_solar ? "sim" : "nao"}
              onValueChange={(v) => set("considerar_custo_disponibilidade_solar", v === "sim")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
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
          <div />
        </div>
      </CardContent>
    </Card>
  );
}