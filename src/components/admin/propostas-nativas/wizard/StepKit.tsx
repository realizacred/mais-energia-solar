import { useState } from "react";
import { Plus, Trash2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type KitItemRow, formatBRL } from "./types";

const CATEGORIAS = [
  { value: "modulo", label: "Módulo" },
  { value: "inversor", label: "Inversor" },
  { value: "estrutura", label: "Estrutura" },
  { value: "string_box", label: "String Box" },
  { value: "cabos", label: "Cabos" },
  { value: "conectores", label: "Conectores" },
  { value: "mao_obra", label: "Mão de obra" },
  { value: "outros", label: "Outros" },
];

// Unified catalog types (modulos_solares + inversores_catalogo)
interface CatalogoModuloUnificado {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_wp: number | null;
  tipo_celula: string | null;
  eficiencia_percent: number | null;
}

interface CatalogoInversorUnificado {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_nominal_kw: number | null;
  tipo: string | null;
  mppt_count: number | null;
  fases: string | null;
}

interface StepKitProps {
  itens: KitItemRow[];
  onItensChange: (itens: KitItemRow[]) => void;
  modulos: CatalogoModuloUnificado[];
  inversores: CatalogoInversorUnificado[];
  loadingEquip: boolean;
  potenciaKwp: number;
}

export function StepKit({ itens, onItensChange, modulos, inversores, loadingEquip, potenciaKwp }: StepKitProps) {
  const [searchMod, setSearchMod] = useState("");
  const [searchInv, setSearchInv] = useState("");

  const addItem = () => {
    onItensChange([...itens, {
      id: crypto.randomUUID(), descricao: "", fabricante: "", modelo: "",
      potencia_w: 0, quantidade: 1, preco_unitario: 0, categoria: "modulo", avulso: true,
    }]);
  };

  const removeItem = (id: string) => onItensChange(itens.filter(i => i.id !== id));

  const updateItem = (id: string, field: keyof KitItemRow, value: any) => {
    onItensChange(itens.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const addModulo = (mod: CatalogoModuloUnificado) => {
    const potW = mod.potencia_wp || 0;
    const numPlacas = potenciaKwp > 0 && potW > 0 ? Math.ceil((potenciaKwp * 1000) / potW) : 10;
    onItensChange([...itens, {
      id: crypto.randomUUID(), descricao: `${mod.fabricante} ${mod.modelo} ${potW}W`,
      fabricante: mod.fabricante, modelo: mod.modelo, potencia_w: potW,
      quantidade: numPlacas, preco_unitario: 0, categoria: "modulo", avulso: false,
    }]);
    toast({ title: `${mod.modelo} adicionado`, description: `${numPlacas} unidades` });
  };

  const addInversor = (inv: CatalogoInversorUnificado) => {
    const potKw = inv.potencia_nominal_kw || 0;
    onItensChange([...itens, {
      id: crypto.randomUUID(), descricao: `${inv.fabricante} ${inv.modelo} ${potKw.toFixed(1)}kW`,
      fabricante: inv.fabricante, modelo: inv.modelo, potencia_w: potKw * 1000,
      quantidade: 1, preco_unitario: 0, categoria: "inversor", avulso: false,
    }]);
    toast({ title: `${inv.modelo} adicionado` });
  };

  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);

  const filteredMod = modulos.filter(m =>
    !searchMod || `${m.fabricante} ${m.modelo}`.toLowerCase().includes(searchMod.toLowerCase())
  );
  const filteredInv = inversores.filter(i =>
    !searchInv || `${i.fabricante} ${i.modelo}`.toLowerCase().includes(searchInv.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" /> Kit e Equipamentos
        </h3>
        <Badge variant="secondary" className="text-xs">
          Subtotal: {formatBRL(subtotal)}
        </Badge>
      </div>

      {loadingEquip ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Módulos Catálogo Unificado */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Módulos ({modulos.length})
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={searchMod} onChange={e => setSearchMod(e.target.value)} placeholder="Buscar módulo..." className="h-8 text-xs pl-8" />
            </div>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredMod.map(m => (
                <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 hover:border-primary/30 transition-colors bg-card text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-xs truncate">{m.fabricante} {m.modelo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.potencia_wp}W
                      {m.tipo_celula && <span className="ml-1.5 opacity-70">• {m.tipo_celula}</span>}
                      {m.eficiencia_percent && <span className="ml-1.5 opacity-70">• {m.eficiencia_percent}%</span>}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={() => addModulo(m)}>
                    <Plus className="h-3 w-3 mr-0.5" /> Add
                  </Button>
                </div>
              ))}
              {filteredMod.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Nenhum módulo encontrado</p>}
            </div>
          </div>

          {/* Inversores Catálogo Unificado */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Inversores ({inversores.length})
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={searchInv} onChange={e => setSearchInv(e.target.value)} placeholder="Buscar inversor..." className="h-8 text-xs pl-8" />
            </div>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredInv.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 hover:border-primary/30 transition-colors bg-card text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-xs truncate">{inv.fabricante} {inv.modelo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(inv.potencia_nominal_kw || 0).toFixed(1)}kW
                      {inv.tipo && <span className="ml-1.5 opacity-70">• {inv.tipo}</span>}
                      {inv.fases && <span className="ml-1.5 opacity-70">• {inv.fases}</span>}
                      {inv.mppt_count && <span className="ml-1.5 opacity-70">• {inv.mppt_count} MPPT</span>}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={() => addInversor(inv)}>
                    <Plus className="h-3 w-3 mr-0.5" /> Add
                  </Button>
                </div>
              ))}
              {filteredInv.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Nenhum inversor encontrado</p>}
            </div>
          </div>

          {/* Kit Selecionado */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kit Selecionado ({itens.length})</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addItem}>
                <Plus className="h-3 w-3" /> Item manual
              </Button>
            </div>
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
              {itens.map(item => (
                <div key={item.id} className="p-2 rounded-lg bg-muted/30 border border-border/30 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Input value={item.descricao} onChange={e => updateItem(item.id, "descricao", e.target.value)} placeholder="Descrição" className="h-7 text-xs flex-1" />
                    {itens.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60" onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <Input type="number" min={1} value={item.quantidade || ""} onChange={e => updateItem(item.id, "quantidade", Number(e.target.value))} placeholder="Qtd" className="h-7 text-xs" />
                    <Input type="number" min={0} step={0.01} value={item.preco_unitario || ""} onChange={e => updateItem(item.id, "preco_unitario", Number(e.target.value))} placeholder="R$ unit." className="h-7 text-xs" />
                    <Select value={item.categoria} onValueChange={v => updateItem(item.id, "categoria", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="text-right text-[10px] text-muted-foreground">
                    Total: {formatBRL(item.quantidade * item.preco_unitario)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
