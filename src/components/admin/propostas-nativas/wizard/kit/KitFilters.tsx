import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      <Button variant="ghost" onClick={onToggle} className="flex items-center justify-between w-full text-xs font-bold text-foreground h-auto p-0">
        {label}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </Button>
      {open && children}
    </div>
  );
}

export interface KitFiltersState {
  potenciaMin: number;
  potenciaMax: number;
  searchText: string;
  fabricanteInversor: string; // "" = Todos
  inversorModelo: string; // "" = Todos
  searchDistribuidor: string;
  searchModulo: string;
  searchInversor: string;
}

export const DEFAULT_FILTERS: KitFiltersState = {
  potenciaMin: 0,
  potenciaMax: 1000,
  searchText: "",
  fabricanteInversor: "",
  inversorModelo: "",
  searchDistribuidor: "",
  searchModulo: "",
  searchInversor: "",
};

/** Options extracted from catalog data for dynamic dropdowns */
export interface KitFilterOptions {
  fabricantesInversor: string[];
  modelosInversor: string[];
}

interface KitFiltersProps {
  filters: KitFiltersState;
  onFiltersChange: (f: KitFiltersState) => void;
  consumoMensal?: number;
  options?: KitFilterOptions;
}

export function KitFilters({ filters, onFiltersChange, consumoMensal, options }: KitFiltersProps) {
  const [openSections, setOpenSections] = useState({
    potencia: true, buscar: true, fabricanteInv: true,
    inversores: true, distribuidor: false, modulos: false,
  });

  const toggle = (key: keyof typeof openSections) =>
    setOpenSections(p => ({ ...p, [key]: !p[key] }));

  const update = (partial: Partial<KitFiltersState>) =>
    onFiltersChange({ ...filters, ...partial });

  const clearFilters = () => onFiltersChange({ ...DEFAULT_FILTERS });

  const hasActiveFilters = useMemo(() => {
    return (
      filters.potenciaMin > 0 ||
      filters.potenciaMax < 1000 ||
      filters.searchText.trim() !== "" ||
      filters.fabricanteInversor !== "" ||
      filters.inversorModelo !== "" ||
      filters.searchDistribuidor.trim() !== "" ||
      filters.searchModulo.trim() !== "" ||
      filters.searchInversor.trim() !== ""
    );
  }, [filters]);

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">Filtros</h4>
        {hasActiveFilters && (
          <Button variant="link" onClick={clearFilters} className="text-[11px] text-primary hover:underline font-medium h-auto p-0 gap-1">
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Potência do Kit */}
        <CollapsibleFilter label="Potência do Kit" open={openSections.potencia} onToggle={() => toggle("potencia")}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={filters.potenciaMin || ""}
              onChange={e => update({ potenciaMin: Number(e.target.value) || 0 })}
              className="h-7 text-xs flex-1"
              placeholder="0"
              min={0}
            />
            <span className="text-[10px] text-muted-foreground">a</span>
            <Input
              type="number"
              value={filters.potenciaMax || ""}
              onChange={e => update({ potenciaMax: Number(e.target.value) || 1000 })}
              className="h-7 text-xs flex-1"
              placeholder="1000"
              min={0}
            />
            <span className="text-[10px] text-muted-foreground shrink-0">kWp</span>
          </div>
        </CollapsibleFilter>

        {/* Buscar */}
        <CollapsibleFilter label="Buscar" open={openSections.buscar} onToggle={() => toggle("buscar")}>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <Input
              value={filters.searchText}
              onChange={e => update({ searchText: e.target.value })}
              placeholder="Buscar por..."
              className="h-7 text-xs pl-7"
            />
          </div>
        </CollapsibleFilter>

        {/* Fabricante Inversor */}
        <CollapsibleFilter label="Fabricante Inversor" open={openSections.fabricanteInv} onToggle={() => toggle("fabricanteInv")}>
          <Select value={filters.fabricanteInversor || "__all__"} onValueChange={v => update({ fabricanteInversor: v === "__all__" ? "" : v })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {(options?.fabricantesInversor ?? []).map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CollapsibleFilter>

        {/* Inversores */}
        <CollapsibleFilter label="Inversores" open={openSections.inversores} onToggle={() => toggle("inversores")}>
          <Select value={filters.inversorModelo || "__all__"} onValueChange={v => update({ inversorModelo: v === "__all__" ? "" : v })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {(options?.modelosInversor ?? []).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>
    </div>
  );
}
