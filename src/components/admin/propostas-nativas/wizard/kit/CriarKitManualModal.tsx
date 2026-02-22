import { useState, useMemo } from "react";
import { Plus, Trash2, Sun, Cpu, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CurrencyInput } from "@/components/ui/currency-input";
import { type KitItemRow, formatBRL } from "../types";

interface CatalogoModulo {
  id: string; fabricante: string; modelo: string; potencia_wp: number | null;
}
interface CatalogoInversor {
  id: string; fabricante: string; modelo: string; potencia_nominal_kw: number | null;
  tipo: string | null; fases: string | null;
}
interface CatalogoOtimizador {
  id: string; fabricante: string; modelo: string; potencia_wp: number | null;
  eficiencia_percent: number | null; compatibilidade: string | null;
}

interface InversorEntry {
  id: string;
  selectedId: string;
  quantidade: number;
  avulso: boolean;
  nome: string;
  fabricante: string;
  potenciaW: number;
  fases: string;
  tensaoLinha: number;
}

interface ModuloEntry {
  id: string;
  selectedId: string;
  quantidade: number;
  avulso: boolean;
  nome: string;
  fabricante: string;
  potenciaW: number;
}

interface OtimizadorEntry {
  id: string;
  selectedId: string;
  quantidade: number;
  avulso: boolean;
  nome: string;
  fabricante: string;
  potenciaW: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modulos: CatalogoModulo[];
  inversores: CatalogoInversor[];
  otimizadores?: CatalogoOtimizador[];
  onKitCreated: (itens: KitItemRow[]) => void;
  mode: "equipamentos" | "zero";
  sistema?: "on_grid" | "hibrido" | "off_grid";
  topologias?: string[];
}

const TOPOLOGIAS = ["Tradicional", "Microinversor", "Otimizador"];

function createEmptyModulo(): ModuloEntry {
  return { id: crypto.randomUUID(), selectedId: "", quantidade: 0, avulso: false, nome: "", fabricante: "", potenciaW: 0 };
}

function createEmptyInversor(): InversorEntry {
  return { id: crypto.randomUUID(), selectedId: "", quantidade: 0, avulso: false, nome: "", fabricante: "", potenciaW: 0, fases: "", tensaoLinha: 0 };
}

function createEmptyOtimizador(): OtimizadorEntry {
  return { id: crypto.randomUUID(), selectedId: "", quantidade: 0, avulso: false, nome: "", fabricante: "", potenciaW: 0 };
}

/**
 * Filter inversores by topologia + sistema rules:
 * - Híbrido/Off grid sistema → only "Híbrido" type inverters
 * - Tradicional topologia → "String" type
 * - Microinversor topologia → "Microinversor" type
 * - Otimizador topologia → "String" type (otimizadores are separate)
 */
function filterInversores(
  inversores: CatalogoInversor[],
  sistema: string,
  topologia: string,
): CatalogoInversor[] {
  // Sistema override: Híbrido/Off grid → only Híbrido inverters
  if (sistema === "hibrido" || sistema === "off_grid") {
    return inversores.filter(i => i.tipo === "Híbrido");
  }

  // Topologia-based filtering for On grid
  switch (topologia) {
    case "Tradicional":
      return inversores.filter(i => i.tipo === "String");
    case "Microinversor":
      return inversores.filter(i => i.tipo === "Microinversor");
    case "Otimizador":
      return inversores.filter(i => i.tipo === "String");
    default:
      return inversores;
  }
}

export function CriarKitManualModal({ open, onOpenChange, modulos, inversores, otimizadores = [], onKitCreated, mode, sistema: sistemaProp, topologias: topologiasProp }: Props) {
  const [distribuidorNome, setDistribuidorNome] = useState("");
  const [custo, setCusto] = useState(0);
  const [nomeKit, setNomeKit] = useState("");
  const [codigoKit, setCodigoKit] = useState("");
  const [sistema, setSistema] = useState<"on_grid" | "hibrido" | "off_grid">(sistemaProp || "on_grid");
  const [tipoKit, setTipoKit] = useState<"customizado" | "fechado">("customizado");
  const [topologia, setTopologia] = useState(
    topologiasProp?.length === 1
      ? (topologiasProp[0] === "tradicional" ? "Tradicional" : topologiasProp[0] === "microinversor" ? "Microinversor" : "Otimizador")
      : ""
  );
  const [distribuidorSelect, setDistribuidorSelect] = useState("");
  const [custosEmbutidos, setCustosEmbutidos] = useState({ estruturas: false, transformador: false });

  const [moduloEntries, setModuloEntries] = useState<ModuloEntry[]>([createEmptyModulo()]);
  const [inversorEntries, setInversorEntries] = useState<InversorEntry[]>([createEmptyInversor()]);
  const [otimizadorEntries, setOtimizadorEntries] = useState<OtimizadorEntry[]>([]);
  const [componenteEntries, setComponenteEntries] = useState<{ id: string; nome: string; quantidade: number }[]>([]);

  // Filtered inversores based on sistema + topologia
  const filteredInversores = useMemo(
    () => filterInversores(inversores, sistema, topologia),
    [inversores, sistema, topologia]
  );

  // Show otimizadores section: always available (auto-added when topologia = Otimizador, optional otherwise)
  const showOtimizadores = otimizadorEntries.length > 0;

  const potenciaTotal = moduloEntries.reduce((s, m) => {
    if (m.avulso) return s + (m.potenciaW * m.quantidade) / 1000;
    const cat = modulos.find(c => c.id === m.selectedId);
    return s + ((cat?.potencia_wp || 0) * m.quantidade) / 1000;
  }, 0);

  const handleSave = () => {
    const itens: KitItemRow[] = [];

    moduloEntries.forEach(m => {
      if (m.avulso) {
        if (!m.nome) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${m.fabricante} ${m.nome} ${m.potenciaW}W`,
          fabricante: m.fabricante, modelo: m.nome, potencia_w: m.potenciaW,
          quantidade: m.quantidade, preco_unitario: 0, categoria: "modulo", avulso: true,
        });
      } else {
        const cat = modulos.find(c => c.id === m.selectedId);
        if (!cat) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${cat.fabricante} ${cat.modelo} ${cat.potencia_wp || 0}W`,
          fabricante: cat.fabricante, modelo: cat.modelo, potencia_w: cat.potencia_wp || 0,
          quantidade: m.quantidade, preco_unitario: 0, categoria: "modulo", avulso: false,
        });
      }
    });

    inversorEntries.forEach(inv => {
      if (inv.avulso) {
        if (!inv.nome) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${inv.fabricante} ${inv.nome} ${(inv.potenciaW / 1000).toFixed(1)}kW`,
          fabricante: inv.fabricante, modelo: inv.nome, potencia_w: inv.potenciaW,
          quantidade: inv.quantidade, preco_unitario: 0, categoria: "inversor", avulso: true,
        });
      } else {
        const cat = inversores.find(c => c.id === inv.selectedId);
        if (!cat) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${cat.fabricante} ${cat.modelo} ${(cat.potencia_nominal_kw || 0).toFixed(1)}kW`,
          fabricante: cat.fabricante, modelo: cat.modelo, potencia_w: (cat.potencia_nominal_kw || 0) * 1000,
          quantidade: inv.quantidade, preco_unitario: 0, categoria: "inversor", avulso: false,
        });
      }
    });

    // Otimizadores
    otimizadorEntries.forEach(ot => {
      if (ot.avulso) {
        if (!ot.nome) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${ot.fabricante} ${ot.nome} ${ot.potenciaW}W`,
          fabricante: ot.fabricante, modelo: ot.nome, potencia_w: ot.potenciaW,
          quantidade: ot.quantidade, preco_unitario: 0, categoria: "outros", avulso: true,
        });
      } else {
        const cat = otimizadores.find(c => c.id === ot.selectedId);
        if (!cat) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${cat.fabricante} ${cat.modelo} ${cat.potencia_wp || 0}W`,
          fabricante: cat.fabricante, modelo: cat.modelo, potencia_w: cat.potencia_wp || 0,
          quantidade: ot.quantidade, preco_unitario: 0, categoria: "outros", avulso: false,
        });
      }
    });

    componenteEntries.forEach(c => {
      if (!c.nome) return;
      itens.push({
        id: crypto.randomUUID(), descricao: c.nome,
        fabricante: "", modelo: c.nome, potencia_w: 0,
        quantidade: c.quantidade, preco_unitario: 0, categoria: "outros", avulso: true,
      });
    });

    if (itens.length === 0) {
      toast({ title: "Adicione pelo menos um item", variant: "destructive" });
      return;
    }

    // Distribute custo proportionally by (quantidade * potencia_w) weight
    if (custo > 0) {
      const totalWeight = itens.reduce((s, i) => s + i.quantidade * Math.max(i.potencia_w, 1), 0);
      if (totalWeight > 0) {
        itens.forEach(i => {
          const weight = i.quantidade * Math.max(i.potencia_w, 1);
          i.preco_unitario = Math.round(((weight / totalWeight) * custo / i.quantidade) * 100) / 100;
        });
      } else {
        // Equal distribution
        const perItem = custo / itens.reduce((s, i) => s + i.quantidade, 0);
        itens.forEach(i => { i.preco_unitario = Math.round(perItem * 100) / 100; });
      }
    }

    onKitCreated(itens);
    onOpenChange(false);
    toast({ title: "Kit criado manualmente", description: `${itens.length} itens adicionados` });
  };

  const title = mode === "equipamentos" ? "Criar kit manualmente" : "Criar kit manual do zero";

  // Inversor label based on topologia
  const inversorLabel = topologia === "Microinversor" ? "Microinversor" : "Inversor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do distribuidor *</Label>
              <Input value={distribuidorNome} onChange={e => setDistribuidorNome(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Custo *</Label>
              <CurrencyInput value={custo} onChange={setCusto} className="h-8 text-xs" placeholder="0,00" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do Kit *</Label>
              <Input value={nomeKit} onChange={e => setNomeKit(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Código do Kit *</Label>
              <Input value={codigoKit} onChange={e => setCodigoKit(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          {/* Sistema */}
          <div className="space-y-1">
            <Label className="text-xs">Sistema</Label>
            <RadioGroup value={sistema} onValueChange={v => setSistema(v as any)} className="flex gap-4">
              {[{ v: "on_grid", l: "On grid" }, { v: "hibrido", l: "Híbrido" }, { v: "off_grid", l: "Off grid" }].map(o => (
                <div key={o.v} className="flex items-center gap-1.5">
                  <RadioGroupItem value={o.v} id={`s-${o.v}`} className="h-3.5 w-3.5" />
                  <Label htmlFor={`s-${o.v}`} className="text-xs cursor-pointer">{o.l}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {mode === "equipamentos" && (
            <div className="space-y-1">
              <Label className="text-xs">Tipo do Kit *</Label>
              <RadioGroup value={tipoKit} onValueChange={v => setTipoKit(v as any)} className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="customizado" id="tk-c" className="h-3.5 w-3.5" />
                  <Label htmlFor="tk-c" className="text-xs cursor-pointer">Customizado</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="fechado" id="tk-f" className="h-3.5 w-3.5" />
                  <Label htmlFor="tk-f" className="text-xs cursor-pointer">Fechado</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Topologia + Custos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Topologia *</Label>
              <Select value={topologia} onValueChange={v => {
                setTopologia(v);
                // Auto-add otimizador entry when switching to Otimizador
                if (v === "Otimizador" && otimizadorEntries.length === 0) {
                  setOtimizadorEntries([createEmptyOtimizador()]);
                }
                // Clear otimizadores when switching away
                if (v !== "Otimizador") {
                  setOtimizadorEntries([]);
                }
                // Reset inversor selections since the filtered list changed
                setInversorEntries([createEmptyInversor()]);
              }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione uma topologia" /></SelectTrigger>
                <SelectContent>
                  {TOPOLOGIAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mode === "zero" && (
              <div className="space-y-1">
                <Label className="text-xs">Custos embutidos</Label>
                <div className="flex gap-4 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Checkbox checked={custosEmbutidos.estruturas} onCheckedChange={v => setCustosEmbutidos(p => ({ ...p, estruturas: !!v }))} className="h-3.5 w-3.5" />
                    <Label className="text-xs cursor-pointer">Estruturas</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Checkbox checked={custosEmbutidos.transformador} onCheckedChange={v => setCustosEmbutidos(p => ({ ...p, transformador: !!v }))} className="h-3.5 w-3.5" />
                    <Label className="text-xs cursor-pointer">Transformador</Label>
                  </div>
                </div>
              </div>
            )}
            {mode === "equipamentos" && (
              <div className="space-y-1">
                <Label className="text-xs">Distribuidor *</Label>
                <Select value={distribuidorSelect} onValueChange={setDistribuidorSelect}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o distribuidor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Filter info banner */}
          {topologia && (
            <div className="rounded-md bg-muted/50 border border-border/40 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 shrink-0" />
              <span>
                Filtro ativo: <strong className="text-foreground">{topologia}</strong>
                {(sistema === "hibrido" || sistema === "off_grid") && (
                  <> • Sistema <strong className="text-foreground">{sistema === "hibrido" ? "Híbrido" : "Off grid"}</strong> → somente inversores híbridos</>
                )}
                {" "}({filteredInversores.length} inversores disponíveis)
              </span>
            </div>
          )}

          {/* Itens */}
          <div className="space-y-3">
            <Label className="text-xs font-bold">Itens</Label>

            {/* Módulos */}
            {moduloEntries.map((m, idx) => (
              <div key={m.id} className="rounded-lg border-2 border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-primary">Módulo *</Label>
                  {moduloEntries.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60" onClick={() => setModuloEntries(p => p.filter(x => x.id !== m.id))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {m.avulso ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Nome do módulo *</Label>
                      <Input value={m.nome} onChange={e => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, nome: e.target.value } : x))} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Qtd. *</Label>
                      <Input type="number" value={m.quantidade || ""} onChange={e => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, quantidade: Number(e.target.value) } : x))} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Fabricante</Label>
                      <Input value={m.fabricante} onChange={e => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, fabricante: e.target.value } : x))} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Potência (W)</Label>
                      <Input type="number" value={m.potenciaW || ""} onChange={e => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, potenciaW: Number(e.target.value) } : x))} className="h-7 text-xs" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select value={m.selectedId} onValueChange={v => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, selectedId: v } : x))}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
                      <SelectContent>
                        {modulos.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.fabricante} {cat.modelo} ({cat.potencia_wp}W)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" value={m.quantidade || ""} onChange={e => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, quantidade: Number(e.target.value) } : x))} className="h-8 text-xs w-16" placeholder="0" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch checked={m.avulso} onCheckedChange={v => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, avulso: v } : x))} className="scale-75" />
                  <span className="text-[10px] text-muted-foreground">Avulso?</span>
                </div>
              </div>
            ))}

            {/* Inversores (filtered by topologia + sistema) */}
            {inversorEntries.map((inv, idx) => (
              <div key={inv.id} className="rounded-lg border-2 border-secondary/20 bg-secondary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-secondary">{inversorLabel} *</Label>
                  <div className="flex items-center gap-2">
                    {inversorEntries.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60" onClick={() => setInversorEntries(p => p.filter(x => x.id !== inv.id))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {inv.avulso ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Nome do {inversorLabel.toLowerCase()} *</Label>
                        <Input value={inv.nome} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, nome: e.target.value } : x))} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Qtd. *</Label>
                        <Input type="number" value={inv.quantidade || ""} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, quantidade: Number(e.target.value) } : x))} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Fabricante</Label>
                        <Input value={inv.fabricante} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, fabricante: e.target.value } : x))} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Potência (W)</Label>
                        <Input type="number" value={inv.potenciaW || ""} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, potenciaW: Number(e.target.value) } : x))} className="h-7 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Fases do inversor</Label>
                        <Select value={inv.fases} onValueChange={v => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, fases: v } : x))}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecione uma fase" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monofasico">Monofásico</SelectItem>
                            <SelectItem value="bifasico">Bifásico</SelectItem>
                            <SelectItem value="trifasico">Trifásico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Tensão de linha (V)</Label>
                        <Input type="number" value={inv.tensaoLinha || ""} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, tensaoLinha: Number(e.target.value) } : x))} className="h-7 text-xs" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select value={inv.selectedId} onValueChange={v => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, selectedId: v } : x))}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
                      <SelectContent>
                        {filteredInversores.length > 0 ? (
                          filteredInversores.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.fabricante} {cat.modelo} ({(cat.potencia_nominal_kw || 0).toFixed(1)}kW)
                              {cat.tipo && <span className="text-muted-foreground ml-1">• {cat.tipo}</span>}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            Nenhum inversor encontrado para esta topologia/sistema
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <Input type="number" value={inv.quantidade || ""} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, quantidade: Number(e.target.value) } : x))} className="h-8 text-xs w-16" placeholder="0" />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={inv.avulso} onCheckedChange={v => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, avulso: v } : x))} className="scale-75" />
                    <span className="text-[10px] text-muted-foreground">Avulso?</span>
                  </div>
                  {idx === inversorEntries.length - 1 && (
                    <button onClick={() => setInversorEntries(p => [...p, createEmptyInversor()])} className="text-[11px] text-primary font-medium hover:underline">
                      + Adicionar mais
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Otimizadores (only when topologia = Otimizador) */}
            {showOtimizadores && otimizadorEntries.map((ot, idx) => (
              <div key={ot.id} className="rounded-lg border-2 border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                    <Zap className="h-3 w-3" /> Otimizador *
                  </Label>
                  {otimizadorEntries.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60" onClick={() => setOtimizadorEntries(p => p.filter(x => x.id !== ot.id))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {ot.avulso ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Nome do otimizador *</Label>
                      <Input value={ot.nome} onChange={e => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, nome: e.target.value } : x))} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Qtd. *</Label>
                      <Input type="number" value={ot.quantidade || ""} onChange={e => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, quantidade: Number(e.target.value) } : x))} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Fabricante</Label>
                      <Input value={ot.fabricante} onChange={e => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, fabricante: e.target.value } : x))} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Potência (W)</Label>
                      <Input type="number" value={ot.potenciaW || ""} onChange={e => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, potenciaW: Number(e.target.value) } : x))} className="h-7 text-xs" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select value={ot.selectedId} onValueChange={v => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, selectedId: v } : x))}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Selecione um otimizador" /></SelectTrigger>
                      <SelectContent>
                        {otimizadores.length > 0 ? (
                          otimizadores.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.fabricante} {cat.modelo} ({cat.potencia_wp || 0}W)
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            Nenhum otimizador cadastrado
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <Input type="number" value={ot.quantidade || ""} onChange={e => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, quantidade: Number(e.target.value) } : x))} className="h-8 text-xs w-16" placeholder="0" />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={ot.avulso} onCheckedChange={v => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, avulso: v } : x))} className="scale-75" />
                    <span className="text-[10px] text-muted-foreground">Avulso?</span>
                  </div>
                  {idx === otimizadorEntries.length - 1 && (
                    <button onClick={() => setOtimizadorEntries(p => [...p, createEmptyOtimizador()])} className="text-[11px] text-amber-600 font-medium hover:underline">
                      + Adicionar mais
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Componentes extras (only in "zero" mode) */}
            {mode === "zero" && (
              <>
                {componenteEntries.map(c => (
                  <div key={c.id} className="rounded-lg border-2 border-border/40 bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold">Componente *</Label>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60" onClick={() => setComponenteEntries(p => p.filter(x => x.id !== c.id))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input value={c.nome} onChange={e => setComponenteEntries(p => p.map(x => x.id === c.id ? { ...x, nome: e.target.value } : x))} className="h-7 text-xs flex-1" placeholder="Nome do componente" />
                      <Input type="number" value={c.quantidade || ""} onChange={e => setComponenteEntries(p => p.map(x => x.id === c.id ? { ...x, quantidade: Number(e.target.value) } : x))} className="h-7 text-xs w-16" placeholder="0" />
                      <button onClick={() => setComponenteEntries(p => [...p, { id: crypto.randomUUID(), nome: "", quantidade: 0 }])} className="text-[11px] text-primary font-medium hover:underline whitespace-nowrap">
                        + Adicionar mais
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Add buttons */}
            <div className="flex gap-2">
              {otimizadorEntries.length === 0 && (
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setOtimizadorEntries(p => [...p, createEmptyOtimizador()])}>
                  <Zap className="h-3 w-3 mr-1" /> + Otimizador
                </Button>
              )}
              {mode === "zero" && (
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setComponenteEntries(p => [...p, { id: crypto.randomUUID(), nome: "", quantidade: 0 }])}>
                  + Componente
                </Button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/30">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary">
                Potência: {potenciaTotal.toFixed(2)} kWp
              </Badge>
              <Button size="sm" className="text-xs h-8" onClick={handleSave}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
