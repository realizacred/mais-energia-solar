import { useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface FilterSection {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleFilter({ label, open, onToggle, children }: FilterSection) {
  return (
    <div className="space-y-2">
      <button onClick={onToggle} className="flex items-center justify-between w-full text-xs font-bold text-foreground">
        {label}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && children}
    </div>
  );
}

export interface KitFiltersState {
  tipoSistema: "on_grid" | "hibrido" | "off_grid";
  buscarPor: "consumo" | "potencia" | "quantidade" | "area";
  buscarValor: number;
  tipoKit: { customizado: boolean; fechado: boolean };
  topologia: { microinversor: boolean; otimizador: boolean; tradicional: boolean };
  searchDistribuidor: string;
  searchModulo: string;
  searchInversor: string;
}

export const DEFAULT_FILTERS: KitFiltersState = {
  tipoSistema: "on_grid",
  buscarPor: "consumo",
  buscarValor: 0,
  tipoKit: { customizado: true, fechado: true },
  topologia: { microinversor: true, otimizador: true, tradicional: true },
  searchDistribuidor: "",
  searchModulo: "",
  searchInversor: "",
};

interface KitFiltersProps {
  filters: KitFiltersState;
  onFiltersChange: (f: KitFiltersState) => void;
  consumoMensal?: number;
}

export function KitFilters({ filters, onFiltersChange, consumoMensal }: KitFiltersProps) {
  const [openSections, setOpenSections] = useState({
    sistema: true, buscar: true, tipo: true, topologia: true,
    distribuidor: true, modulos: false, inversores: false,
  });

  const toggle = (key: keyof typeof openSections) =>
    setOpenSections(p => ({ ...p, [key]: !p[key] }));

  const update = (partial: Partial<KitFiltersState>) =>
    onFiltersChange({ ...filters, ...partial });

  const clearFilters = () => onFiltersChange({ ...DEFAULT_FILTERS, buscarValor: consumoMensal || 0 });

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">Filtros</h4>
        <button onClick={clearFilters} className="text-[11px] text-primary hover:underline font-medium">
          Limpar filtro
        </button>
      </div>

      <div className="rounded-lg border border-info/30 bg-info/5 px-3 py-2">
        <p className="text-[10px] text-info leading-tight">
          ⓘ Aplicar um filtro poderá afetar outros filtros
        </p>
      </div>

      <div className="space-y-4">
        {/* Tipo de Sistema */}
        <CollapsibleFilter label="Tipo de Sistema" open={openSections.sistema} onToggle={() => toggle("sistema")}>
          <RadioGroup value={filters.tipoSistema} onValueChange={(v) => update({ tipoSistema: v as any })} className="space-y-1.5">
            {[
              { value: "on_grid", label: "On grid" },
              { value: "hibrido", label: "Híbrido" },
              { value: "off_grid", label: "Off grid" },
            ].map(o => (
              <div key={o.value} className="flex items-center gap-2">
                <RadioGroupItem value={o.value} id={`sys-${o.value}`} className="h-3.5 w-3.5" />
                <Label htmlFor={`sys-${o.value}`} className="text-xs cursor-pointer">{o.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </CollapsibleFilter>

        {/* Buscar kits por */}
        <CollapsibleFilter label="Buscar kits por" open={openSections.buscar} onToggle={() => toggle("buscar")}>
          <RadioGroup value={filters.buscarPor} onValueChange={(v) => update({ buscarPor: v as any })} className="space-y-1.5">
            {[
              { value: "consumo", label: "Consumo médio mensal" },
              { value: "potencia", label: "Potência do sistema" },
              { value: "quantidade", label: "Quantidade de módulos" },
              { value: "area", label: "Área útil" },
            ].map(o => (
              <div key={o.value} className="flex items-center gap-2">
                <RadioGroupItem value={o.value} id={`bp-${o.value}`} className="h-3.5 w-3.5" />
                <Label htmlFor={`bp-${o.value}`} className="text-xs cursor-pointer">{o.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex items-center gap-2 mt-2">
            <Input
              type="number"
              value={filters.buscarValor || ""}
              onChange={e => update({ buscarValor: Number(e.target.value) })}
              className="h-7 text-xs w-24"
              placeholder="0"
            />
            <span className="text-[10px] text-muted-foreground">
              {filters.buscarPor === "consumo" ? "kWh/mês" : filters.buscarPor === "potencia" ? "kWp" : filters.buscarPor === "quantidade" ? "módulos" : "m²"}
            </span>
          </div>
        </CollapsibleFilter>

        {/* Tipo de kit */}
        <CollapsibleFilter label="Tipo de kit" open={openSections.tipo} onToggle={() => toggle("tipo")}>
          <div className="space-y-1.5">
            {(["customizado", "fechado"] as const).map(key => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`tk-${key}`}
                  checked={filters.tipoKit[key]}
                  onCheckedChange={(v) => update({ tipoKit: { ...filters.tipoKit, [key]: !!v } })}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor={`tk-${key}`} className="text-xs cursor-pointer capitalize">{key}</Label>
              </div>
            ))}
          </div>
        </CollapsibleFilter>

        {/* Topologia */}
        <CollapsibleFilter label="Topologia" open={openSections.topologia} onToggle={() => toggle("topologia")}>
          <div className="space-y-1.5">
            {([
              { key: "microinversor" as const, label: "Microinversor" },
              { key: "otimizador" as const, label: "Otimizador" },
              { key: "tradicional" as const, label: "Tradicional" },
            ]).map(o => (
              <div key={o.key} className="flex items-center gap-2">
                <Checkbox
                  id={`tp-${o.key}`}
                  checked={filters.topologia[o.key]}
                  onCheckedChange={(v) => update({ topologia: { ...filters.topologia, [o.key]: !!v } })}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor={`tp-${o.key}`} className="text-xs cursor-pointer">{o.label}</Label>
              </div>
            ))}
          </div>
        </CollapsibleFilter>

        {/* Distribuidor */}
        <CollapsibleFilter label="Distribuidor" open={openSections.distribuidor} onToggle={() => toggle("distribuidor")}>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <Input
              value={filters.searchDistribuidor}
              onChange={e => update({ searchDistribuidor: e.target.value })}
              placeholder="Buscar..."
              className="h-7 text-xs pl-7"
            />
          </div>
        </CollapsibleFilter>

        {/* Módulos */}
        <CollapsibleFilter label="Módulos" open={openSections.modulos} onToggle={() => toggle("modulos")}>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <Input
              value={filters.searchModulo}
              onChange={e => update({ searchModulo: e.target.value })}
              placeholder="Buscar..."
              className="h-7 text-xs pl-7"
            />
          </div>
        </CollapsibleFilter>

        {/* Inversores */}
        <CollapsibleFilter label="Inversores" open={openSections.inversores} onToggle={() => toggle("inversores")}>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <Input
              value={filters.searchInversor}
              onChange={e => update({ searchInversor: e.target.value })}
              placeholder="Buscar..."
              className="h-7 text-xs pl-7"
            />
          </div>
        </CollapsibleFilter>
      </div>
    </div>
  );
}
