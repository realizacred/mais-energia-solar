import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info } from "lucide-react";
import type { TenantPremises } from "@/hooks/useTenantPremises";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
}

function NumField({ label, suffix, value, step, onChange }: {
  label: string; suffix: string; value: number; step?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step={step || "0.01"}
          value={value}
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
            <Label className="text-xs font-medium text-muted-foreground">Base de Irradiância</Label>
            <Select value={premises.base_irradiancia} onValueChange={(v) => set("base_irradiancia", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inpe_2009">Brazil Solar Global 10KM (INPE 2009)</SelectItem>
                <SelectItem value="inpe_2017">Atlas Brasileiro 2ª Edição (INPE 2017 - SUNDATA - CRESESB)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NumField label="Sobredimensionamento Padrão" suffix="%" value={premises.sobredimensionamento_padrao} onChange={(v) => set("sobredimensionamento_padrao", v)} />
          <div /> {/* placeholder */}
        </div>

        {/* Linha 2 - Eficiência */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Perda de Eficiência Anual (Tradicional)" suffix="%" value={premises.perda_eficiencia_tradicional} onChange={(v) => set("perda_eficiencia_tradicional", v)} />
          <NumField label="Perda de Eficiência Anual (MicroInversor)" suffix="%" value={premises.perda_eficiencia_microinversor} onChange={(v) => set("perda_eficiencia_microinversor", v)} />
          <NumField label="Perda de Eficiência Anual (Otimizador)" suffix="%" value={premises.perda_eficiencia_otimizador} onChange={(v) => set("perda_eficiencia_otimizador", v)} />
        </div>

        {/* Linha 3 - Troca inversor */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Troca de Inversor - Após (Tradicional)" suffix="Anos" step="1" value={premises.troca_inversor_anos_tradicional} onChange={(v) => set("troca_inversor_anos_tradicional", v)} />
          <NumField label="Troca de Inversor - Após (MicroInversor)" suffix="Anos" step="1" value={premises.troca_inversor_anos_microinversor} onChange={(v) => set("troca_inversor_anos_microinversor", v)} />
          <NumField label="Troca de Inversor - Após (Otimizador)" suffix="Anos" step="1" value={premises.troca_inversor_anos_otimizador} onChange={(v) => set("troca_inversor_anos_otimizador", v)} />
        </div>

        {/* Linha 4 - Custo troca */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Custo da Troca de Inversor (Tradicional)" suffix="%" value={premises.custo_troca_inversor_tradicional} onChange={(v) => set("custo_troca_inversor_tradicional", v)} />
          <NumField label="Custo da Troca de Inversor (MicroInversor)" suffix="%" value={premises.custo_troca_inversor_microinversor} onChange={(v) => set("custo_troca_inversor_microinversor", v)} />
          <NumField label="Custo da Troca de Inversor (Otimizador)" suffix="%" value={premises.custo_troca_inversor_otimizador} onChange={(v) => set("custo_troca_inversor_otimizador", v)} />
        </div>

        {/* Linha 5 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Margem para potência ideal" suffix="%" value={premises.margem_potencia_ideal} onChange={(v) => set("margem_potencia_ideal", v)} />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Considerar custo de disponibilidade?</Label>
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
