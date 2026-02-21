import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import type { TenantPremises } from "@/hooks/useTenantPremises";
import { NumField } from "./shared";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
}

const TIPO_KIT_OPTIONS = [
  { value: "fechados", label: "Fechados" },
  { value: "customizados", label: "Customizados" },
];

export function KitsSection({ premises, onChange }: Props) {
  const set = (key: keyof TenantPremises, value: any) =>
    onChange((p) => ({ ...p, [key]: value }));

  const toggleArrayItem = (key: "topologias" | "tipo_kits", item: string) => {
    onChange((p) => {
      const arr = p[key] as string[];
      return { ...p, [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] };
    });
  };

  return (
    <>
      {/* Desempenho */}
      <div className="rounded-xl border-2 border-success/30 bg-success/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-success" />
          <p className="text-xs font-semibold uppercase tracking-wider text-success">Taxa de desempenho (PR)</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="Tradicional (String)" suffix="%" value={premises.taxa_desempenho_tradicional} tooltip="Performance Ratio (PR) do sistema com inversor string. Típico: 65-75%." onChange={(v) => set("taxa_desempenho_tradicional", v)} />
          <NumField label="Microinversor" suffix="%" value={premises.taxa_desempenho_microinversor} tooltip="Performance Ratio para microinversores. Típico: 70-78%." onChange={(v) => set("taxa_desempenho_microinversor", v)} />
          <NumField label="Otimizador" suffix="%" value={premises.taxa_desempenho_otimizador} tooltip="Performance Ratio para otimizadores DC. Típico: 72-80%." onChange={(v) => set("taxa_desempenho_otimizador", v)} />
        </div>
      </div>

      {/* Kits */}
      <div className="rounded-xl border-2 border-info/30 bg-info/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-info" />
          <p className="text-xs font-semibold uppercase tracking-wider text-info">Configuração de kits e sistema</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tipo de Kits</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {TIPO_KIT_OPTIONS.map((o) => (
                <Badge
                  key={o.value}
                  variant={(premises.tipo_kits || []).includes(o.value) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => toggleArrayItem("tipo_kits", o.value)}
                >
                  {o.label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background p-3">
            <Label className="text-xs font-medium text-muted-foreground">Considerar kits que necessitam de transformador</Label>
            <Switch
              checked={premises.considerar_kits_transformador}
              onCheckedChange={(v) => set("considerar_kits_transformador", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tipo de Preço</Label>
            <Select value={premises.tipo_preco} onValueChange={(v) => set("tipo_preco", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="equipamentos">Equipamentos</SelectItem>
                <SelectItem value="venda_total">Venda total</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField
            label="DoD (Profundidade de Descarga)"
            suffix="%"
            value={premises.dod}
            tooltip="Depth of Discharge — percentual máximo da bateria por ciclo."
            onChange={(v) => set("dod", v)}
          />
        </div>
      </div>

      {/* Fornecedores */}
      <div className="rounded-xl border-2 border-border/50 bg-muted/30 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fornecedores</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{premises.fornecedor_filtro === "qualquer" ? "Qualquer fornecedor" : "Fornecedores específicos"}</span>
            <Switch
              checked={premises.fornecedor_filtro === "escolher"}
              onCheckedChange={(v) => set("fornecedor_filtro", v ? "escolher" : "qualquer")}
            />
          </div>
        </div>
      </div>
    </>
  );
}
