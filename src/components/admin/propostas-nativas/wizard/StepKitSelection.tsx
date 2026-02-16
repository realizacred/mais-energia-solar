import { useState, useMemo } from "react";
import { Package, Check, LayoutGrid, Search, Plus, Trash2, Edit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type KitItemRow, formatBRL } from "./types";
import { toast } from "@/hooks/use-toast";

const CATEGORIAS = [
  { value: "modulo", label: "Módulo" },
  { value: "inversor", label: "Inversor" },
  { value: "estrutura", label: "Estrutura" },
  { value: "string_box", label: "String Box" },
  { value: "cabos", label: "Cabos" },
  { value: "conectores", label: "Conectores" },
  { value: "outros", label: "Outros" },
];

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

interface Props {
  itens: KitItemRow[];
  onItensChange: (itens: KitItemRow[]) => void;
  modulos: CatalogoModuloUnificado[];
  inversores: CatalogoInversorUnificado[];
  loadingEquip: boolean;
  potenciaKwp: number;
}

// Mock kit presets for dramatic reveal
function generateKitOptions(potenciaKwp: number, modulos: CatalogoModuloUnificado[], inversores: CatalogoInversorUnificado[]) {
  if (modulos.length === 0 && inversores.length === 0) return [];

  const mod = modulos[0];
  const inv = inversores[0];
  const potW = mod?.potencia_wp || 550;
  const numMod = Math.ceil((potenciaKwp * 1000) / potW);

  return [
    {
      id: "economy",
      label: "Econômico",
      potencia: potenciaKwp,
      modulo: mod ? `${mod.fabricante} ${mod.modelo}` : "Módulo 550W",
      inversor: inv ? `${inv.fabricante} ${inv.modelo}` : "Inversor On-Grid",
      numModulos: numMod,
      geracaoMensal: Math.round(potenciaKwp * 130 * 0.78),
      degradacao25: 14.2,
      roiAnos: 4.8,
      precoEstimado: potenciaKwp * 3200,
    },
    {
      id: "performance",
      label: "Performance",
      potencia: potenciaKwp * 1.05,
      modulo: modulos[1] ? `${modulos[1].fabricante} ${modulos[1].modelo}` : (mod ? `${mod.fabricante} ${mod.modelo}` : "Módulo 580W"),
      inversor: inversores[1] ? `${inversores[1].fabricante} ${inversores[1].modelo}` : (inv ? `${inv.fabricante} ${inv.modelo}` : "Inversor Premium"),
      numModulos: Math.ceil((potenciaKwp * 1050) / (modulos[1]?.potencia_wp || potW)),
      geracaoMensal: Math.round(potenciaKwp * 1.05 * 130 * 0.82),
      degradacao25: 12.8,
      roiAnos: 4.2,
      precoEstimado: potenciaKwp * 3800,
      recommended: true,
    },
    {
      id: "premium",
      label: "Premium",
      potencia: potenciaKwp * 1.1,
      modulo: modulos[2] ? `${modulos[2].fabricante} ${modulos[2].modelo}` : (mod ? `${mod.fabricante} ${mod.modelo}` : "Módulo 600W"),
      inversor: inversores[2] ? `${inversores[2].fabricante} ${inversores[2].modelo}` : (inv ? `${inv.fabricante} ${inv.modelo}` : "Microinversor"),
      numModulos: Math.ceil((potenciaKwp * 1100) / (modulos[2]?.potencia_wp || potW)),
      geracaoMensal: Math.round(potenciaKwp * 1.1 * 130 * 0.85),
      degradacao25: 11.5,
      roiAnos: 4.5,
      precoEstimado: potenciaKwp * 4500,
    },
  ];
}

export function StepKitSelection({ itens, onItensChange, modulos, inversores, loadingEquip, potenciaKwp }: Props) {
  const [selectedKit, setSelectedKit] = useState<string | null>(null);
  const [searchMod, setSearchMod] = useState("");
  const [searchInv, setSearchInv] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutRows, setLayoutRows] = useState(2);
  const [layoutCols, setLayoutCols] = useState(5);

  const kitOptions = useMemo(() => generateKitOptions(potenciaKwp, modulos, inversores), [potenciaKwp, modulos, inversores]);
  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);

  const filteredMod = modulos.filter(m => !searchMod || `${m.fabricante} ${m.modelo}`.toLowerCase().includes(searchMod.toLowerCase()));
  const filteredInv = inversores.filter(i => !searchInv || `${i.fabricante} ${i.modelo}`.toLowerCase().includes(searchInv.toLowerCase()));

  const selectKitOption = (kitId: string) => {
    setSelectedKit(kitId);
    const kit = kitOptions.find(k => k.id === kitId);
    if (!kit) return;

    const mod = modulos.find(m => kit.modulo.includes(m.modelo));
    const inv = inversores.find(i => kit.inversor.includes(i.modelo));

    const newItens: KitItemRow[] = [
      {
        id: crypto.randomUUID(),
        descricao: mod ? `${mod.fabricante} ${mod.modelo} ${mod.potencia_wp}W` : kit.modulo,
        fabricante: mod?.fabricante || "",
        modelo: mod?.modelo || "",
        potencia_w: mod?.potencia_wp || 550,
        quantidade: kit.numModulos,
        preco_unitario: 0,
        categoria: "modulo",
        avulso: false,
      },
      {
        id: crypto.randomUUID(),
        descricao: inv ? `${inv.fabricante} ${inv.modelo} ${(inv.potencia_nominal_kw || 0).toFixed(1)}kW` : kit.inversor,
        fabricante: inv?.fabricante || "",
        modelo: inv?.modelo || "",
        potencia_w: (inv?.potencia_nominal_kw || 0) * 1000,
        quantidade: 1,
        preco_unitario: 0,
        categoria: "inversor",
        avulso: false,
      },
    ];
    onItensChange(newItens);
    toast({ title: `Kit ${kit.label} selecionado`, description: `${kit.numModulos} módulos • ${kit.potencia.toFixed(1)} kWp` });
  };

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

  if (loadingEquip) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" /> Seleção de Kit
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] font-mono">
            Subtotal: {formatBRL(subtotal)}
          </Badge>
          <Dialog open={layoutOpen} onOpenChange={setLayoutOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1">
                <LayoutGrid className="h-3 w-3" /> Layout Telhado
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm">Layout dos Painéis</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Linhas</Label>
                    <Input type="number" min={1} max={10} value={layoutRows} onChange={e => setLayoutRows(Number(e.target.value))} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Módulos por linha</Label>
                    <Input type="number" min={1} max={20} value={layoutCols} onChange={e => setLayoutCols(Number(e.target.value))} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="border rounded-md p-3 bg-muted/30">
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${layoutCols}, 1fr)` }}>
                    {Array.from({ length: layoutRows * layoutCols }).map((_, i) => (
                      <div key={i} className="aspect-[2/3] bg-primary/20 border border-primary/30 rounded-sm flex items-center justify-center">
                        <span className="text-[8px] font-mono text-primary/60">{i + 1}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    {layoutRows * layoutCols} módulos • {layoutRows} x {layoutCols}
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kit Option Cards */}
      {kitOptions.length > 0 && !showCustom && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {kitOptions.map((kit) => (
            <button
              key={kit.id}
              onClick={() => selectKitOption(kit.id)}
              className={cn(
                "relative p-3 rounded-md border-2 text-left transition-all",
                selectedKit === kit.id
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border bg-card",
                kit.recommended && "ring-1 ring-primary/20",
              )}
            >
              {kit.recommended && (
                <Badge className="absolute -top-2 right-2 text-[9px] h-4">Recomendado</Badge>
              )}
              {selectedKit === kit.id && (
                <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
              )}
              <p className="text-xs font-bold">{kit.label}</p>
              <p className="text-lg font-bold font-mono mt-1">{kit.potencia.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">kWp</span></p>

              <div className="mt-2 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Módulos</span>
                  <span className="font-mono font-medium">{kit.numModulos} un</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geração</span>
                  <span className="font-mono font-medium">{kit.geracaoMensal} kWh/mês</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Degradação 25a</span>
                  <span className="font-mono font-medium">{kit.degradacao25}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROI</span>
                  <span className="font-mono font-medium text-success">~{kit.roiAnos} anos</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-border/30">
                <p className="text-[9px] text-muted-foreground truncate">{kit.modulo}</p>
                <p className="text-[9px] text-muted-foreground truncate">{kit.inversor}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          className="text-[11px]"
          onClick={() => setShowCustom(!showCustom)}
        >
          {showCustom ? "← Voltar para kits" : "Montar kit customizado →"}
        </Button>
      </div>

      {/* Custom Kit Builder */}
      {showCustom && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Modules catalog */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Módulos ({modulos.length})</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input value={searchMod} onChange={e => setSearchMod(e.target.value)} placeholder="Buscar..." className="h-7 text-[11px] pl-7" />
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin">
              {filteredMod.map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-md border border-border/30 hover:border-primary/30 transition-colors text-[11px]">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.fabricante} {m.modelo}</p>
                    <p className="text-[10px] text-muted-foreground">{m.potencia_wp}W {m.eficiencia_percent && `• ${m.eficiencia_percent}%`}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-primary" onClick={() => addModulo(m)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Inverters catalog */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inversores ({inversores.length})</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input value={searchInv} onChange={e => setSearchInv(e.target.value)} placeholder="Buscar..." className="h-7 text-[11px] pl-7" />
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin">
              {filteredInv.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-2 rounded-md border border-border/30 hover:border-primary/30 transition-colors text-[11px]">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{inv.fabricante} {inv.modelo}</p>
                    <p className="text-[10px] text-muted-foreground">{(inv.potencia_nominal_kw || 0).toFixed(1)}kW {inv.tipo && `• ${inv.tipo}`} {inv.mppt_count && `• ${inv.mppt_count} MPPT`}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-primary" onClick={() => addInversor(inv)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Selected items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kit ({itens.length})</Label>
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={addItem}>
                <Plus className="h-2.5 w-2.5" /> Manual
              </Button>
            </div>
            <div className="space-y-1 max-h-[240px] overflow-y-auto scrollbar-thin">
              {itens.map(item => (
                <div key={item.id} className="p-2 rounded-md bg-muted/30 border border-border/30 text-[11px] space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <Input value={item.descricao} onChange={e => updateItem(item.id, "descricao", e.target.value)} placeholder="Descrição" className="h-6 text-[11px] flex-1" />
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive/60" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <Input type="number" min={1} value={item.quantidade || ""} onChange={e => updateItem(item.id, "quantidade", Number(e.target.value))} placeholder="Qtd" className="h-6 text-[10px]" />
                    <Input type="number" min={0} step={0.01} value={item.preco_unitario || ""} onChange={e => updateItem(item.id, "preco_unitario", Number(e.target.value))} placeholder="R$ unit." className="h-6 text-[10px]" />
                    <Select value={item.categoria} onValueChange={v => updateItem(item.id, "categoria", v)}>
                      <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <p className="text-right text-[9px] text-muted-foreground font-mono">
                    {formatBRL(item.quantidade * item.preco_unitario)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
