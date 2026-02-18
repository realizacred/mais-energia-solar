import { useState } from "react";
import { Plus, Trash2, Sun, Cpu } from "lucide-react";
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
import { type KitItemRow, formatBRL } from "../types";

interface CatalogoModulo {
  id: string; fabricante: string; modelo: string; potencia_wp: number | null;
}
interface CatalogoInversor {
  id: string; fabricante: string; modelo: string; potencia_nominal_kw: number | null; fases: string | null;
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modulos: CatalogoModulo[];
  inversores: CatalogoInversor[];
  onKitCreated: (itens: KitItemRow[]) => void;
  mode: "equipamentos" | "zero";
}

const TOPOLOGIAS = ["Tradicional", "Microinversor", "Otimizador"];

function createEmptyModulo(): ModuloEntry {
  return { id: crypto.randomUUID(), selectedId: "", quantidade: 0, avulso: false, nome: "", fabricante: "", potenciaW: 0 };
}

function createEmptyInversor(): InversorEntry {
  return { id: crypto.randomUUID(), selectedId: "", quantidade: 0, avulso: false, nome: "", fabricante: "", potenciaW: 0, fases: "", tensaoLinha: 0 };
}

export function CriarKitManualModal({ open, onOpenChange, modulos, inversores, onKitCreated, mode }: Props) {
  const [distribuidorNome, setDistribuidorNome] = useState("");
  const [custo, setCusto] = useState(0);
  const [nomeKit, setNomeKit] = useState("");
  const [codigoKit, setCodigoKit] = useState("");
  const [sistema, setSistema] = useState<"on_grid" | "hibrido" | "off_grid">("on_grid");
  const [tipoKit, setTipoKit] = useState<"customizado" | "fechado">("customizado");
  const [topologia, setTopologia] = useState("");
  const [distribuidorSelect, setDistribuidorSelect] = useState("");
  const [custosEmbutidos, setCustosEmbutidos] = useState({ estruturas: false, transformador: false });

  const [moduloEntries, setModuloEntries] = useState<ModuloEntry[]>([createEmptyModulo()]);
  const [inversorEntries, setInversorEntries] = useState<InversorEntry[]>([createEmptyInversor()]);
  const [componenteEntries, setComponenteEntries] = useState<{ id: string; nome: string; quantidade: number }[]>([]);

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

    onKitCreated(itens);
    onOpenChange(false);
    toast({ title: "Kit criado manualmente", description: `${itens.length} itens adicionados` });
  };

  const title = mode === "equipamentos" ? "Criar kit manualmente" : "Criar kit manual do zero";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do distribuidor *</Label>
              <Input value={distribuidorNome} onChange={e => setDistribuidorNome(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Custo *</Label>
              <Input type="number" value={custo || ""} onChange={e => setCusto(Number(e.target.value))} className="h-8 text-xs" placeholder="R$ 0,00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Topologia *</Label>
              <Select value={topologia} onValueChange={setTopologia}>
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

            {/* Inversores */}
            {inversorEntries.map((inv, idx) => (
              <div key={inv.id} className="rounded-lg border-2 border-secondary/20 bg-secondary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-secondary">Inversor *</Label>
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
                        <Label className="text-[10px]">Nome do inversor *</Label>
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
                        {inversores.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.fabricante} {cat.modelo} ({(cat.potencia_nominal_kw || 0).toFixed(1)}kW)</SelectItem>
                        ))}
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
            {mode === "zero" && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setModuloEntries(p => [...p, createEmptyModulo()])}>
                  Otimizador
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setComponenteEntries(p => [...p, { id: crypto.randomUUID(), nome: "", quantidade: 0 }])}>
                  Componente
                </Button>
              </div>
            )}
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
