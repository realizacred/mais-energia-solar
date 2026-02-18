import { useState, useMemo } from "react";
import { Package, Zap, LayoutGrid, List, Settings2, Loader2, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type KitItemRow, formatBRL } from "./types";
import { toast } from "@/hooks/use-toast";

import { KitFilters, DEFAULT_FILTERS, type KitFiltersState } from "./kit/KitFilters";
import { KitCard, type KitCardData } from "./kit/KitCard";
import { CriarKitManualModal } from "./kit/CriarKitManualModal";

interface CatalogoModuloUnificado {
  id: string; fabricante: string; modelo: string; potencia_wp: number | null;
  tipo_celula: string | null; eficiencia_percent: number | null;
}

interface CatalogoInversorUnificado {
  id: string; fabricante: string; modelo: string; potencia_nominal_kw: number | null;
  tipo: string | null; mppt_count: number | null; fases: string | null;
}

interface Props {
  itens: KitItemRow[];
  onItensChange: (itens: KitItemRow[]) => void;
  modulos: CatalogoModuloUnificado[];
  inversores: CatalogoInversorUnificado[];
  loadingEquip: boolean;
  potenciaKwp: number;
}

type TabType = "customizado" | "fechado" | "manual";

function kitItemsToCardData(itens: KitItemRow[]): KitCardData | null {
  const modItem = itens.find(i => i.categoria === "modulo");
  const invItem = itens.find(i => i.categoria === "inversor");
  if (!modItem && !invItem) return null;

  const moduloQtd = modItem?.quantidade || 0;
  const moduloPotW = modItem?.potencia_w || 0;
  const totalKwp = (moduloQtd * moduloPotW) / 1000;
  const invPotKw = invItem ? (invItem.potencia_w || 0) / 1000 : 0;
  const precoTotal = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const precoWp = totalKwp > 0 ? precoTotal / (totalKwp * 1000) : 0;

  return {
    id: `manual-${Date.now()}`,
    distribuidorNome: modItem?.fabricante || invItem?.fabricante || "",
    moduloDescricao: modItem ? `${modItem.fabricante} ${modItem.modelo}`.trim() : "—",
    moduloQtd,
    moduloPotenciaKwp: totalKwp,
    inversorDescricao: invItem ? `${invItem.fabricante} ${invItem.modelo}`.trim() : "—",
    inversorQtd: invItem?.quantidade || 0,
    inversorPotenciaKw: invPotKw * (invItem?.quantidade || 1),
    topologia: "Inversor com otimizador",
    precoTotal,
    precoWp,
    updatedAt: new Date().toLocaleDateString("pt-BR"),
  };
}

function generateMockKits(modulos: CatalogoModuloUnificado[], inversores: CatalogoInversorUnificado[], potenciaKwp: number): KitCardData[] {
  const kits: KitCardData[] = [];
  const topologias = ["Microinversor", "Tradicional", "Otimizador"];

  for (let i = 0; i < Math.min(modulos.length, 8); i++) {
    const mod = modulos[i];
    const inv = inversores[i % inversores.length] || inversores[0];
    if (!mod || !inv) continue;

    const potW = mod.potencia_wp || 550;
    const numMod = potenciaKwp > 0 ? Math.ceil((potenciaKwp * 1000) / potW) : 4;
    const totalKwp = (numMod * potW) / 1000;
    const potInvKw = inv.potencia_nominal_kw || 2;
    const topo = topologias[i % topologias.length];

    kits.push({
      id: `gen-${mod.id}-${inv.id}`,
      distribuidorNome: mod.fabricante.toUpperCase(),
      moduloDescricao: `${mod.fabricante} ${mod.modelo}`,
      moduloQtd: numMod,
      moduloPotenciaKwp: totalKwp,
      inversorDescricao: `${inv.fabricante} ${inv.modelo}`,
      inversorQtd: 1,
      inversorPotenciaKw: potInvKw,
      topologia: topo,
      precoTotal: totalKwp * 3200,
      precoWp: 3.2,
      updatedAt: new Date().toLocaleDateString("pt-BR"),
    });
  }
  return kits;
}

export function StepKitSelection({ itens, onItensChange, modulos, inversores, loadingEquip, potenciaKwp }: Props) {
  const [tab, setTab] = useState<TabType>("customizado");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<KitFiltersState>({ ...DEFAULT_FILTERS, buscarValor: 0 });
  const [orderBy, setOrderBy] = useState("menor_preco");
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [manualMode, setManualMode] = useState<"equipamentos" | "zero" | null>(null);
  const [manualKits, setManualKits] = useState<{ card: KitCardData; itens: KitItemRow[] }[]>([]);
  const [editingKitIndex, setEditingKitIndex] = useState<number | null>(null);

  const consumoTotal = filters.buscarValor;

  const mockKits = useMemo(() => generateMockKits(modulos, inversores, potenciaKwp), [modulos, inversores, potenciaKwp]);

  const handleSelectKit = (kit: KitCardData) => {
    const newItens: KitItemRow[] = [
      {
        id: crypto.randomUUID(), descricao: `${kit.moduloQtd}x ${kit.moduloDescricao}`,
        fabricante: kit.distribuidorNome, modelo: kit.moduloDescricao, potencia_w: (kit.moduloPotenciaKwp * 1000) / kit.moduloQtd,
        quantidade: kit.moduloQtd, preco_unitario: 0, categoria: "modulo", avulso: false,
      },
      {
        id: crypto.randomUUID(), descricao: `${kit.inversorQtd}x ${kit.inversorDescricao}`,
        fabricante: kit.distribuidorNome, modelo: kit.inversorDescricao, potencia_w: kit.inversorPotenciaKw * 1000,
        quantidade: kit.inversorQtd, preco_unitario: 0, categoria: "inversor", avulso: false,
      },
    ];
    onItensChange(newItens);
    toast({ title: "Kit selecionado", description: `${kit.moduloPotenciaKwp.toFixed(2)} kWp • ${kit.topologia}` });
  };

  const handleSelectManualKit = (entry: { card: KitCardData; itens: KitItemRow[] }) => {
    onItensChange(entry.itens);
    toast({ title: "Kit selecionado", description: `${entry.card.moduloPotenciaKwp.toFixed(2)} kWp` });
  };

  const handleManualKitCreated = (newItens: KitItemRow[]) => {
    const card = kitItemsToCardData(newItens);
    if (card) {
      if (editingKitIndex !== null) {
        setManualKits(prev => prev.map((k, i) => i === editingKitIndex ? { card, itens: newItens } : k));
        setEditingKitIndex(null);
      } else {
        setManualKits(prev => [...prev, { card, itens: newItens }]);
      }
    }
    setManualMode(null);
    setTab("manual");
  };

  const handleDeleteManualKit = (index: number) => {
    setManualKits(prev => prev.filter((_, i) => i !== index));
    toast({ title: "Kit removido" });
  };

  const handleEditManualKit = (index: number) => {
    setEditingKitIndex(index);
    setManualMode("zero");
  };

  if (loadingEquip) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  const activeKits = tab === "manual" ? [] : mockKits;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Kit Gerador
        </h3>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
            <Settings2 className="h-3 w-3" /> Editar premissas
          </Button>
          {itens.length > 0 && itens.some(i => i.descricao) && (
            <Badge variant="secondary" className="text-[10px] font-mono bg-success/10 text-success border-success/20">
              Kit selecionado • {itens.length} itens
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border/50">
        {([
          { key: "customizado" as const, label: "Customizado" },
          { key: "fechado" as const, label: "Fechado" },
          { key: "manual" as const, label: "Manual" },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content: Filters + Grid */}
      <div className="flex gap-4">
        {/* Sidebar Filters */}
        <div className="w-48 shrink-0 hidden lg:block">
          <KitFilters filters={filters} onFiltersChange={setFilters} consumoMensal={consumoTotal} />
        </div>

        {/* Main Area */}
        <div className="flex-1 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Tipo de Preço:</span>
                <Select defaultValue="equipamentos">
                  <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipamentos">Equipamentos</SelectItem>
                    <SelectItem value="total">Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Ordenar por:</span>
                <Select value={orderBy} onValueChange={setOrderBy}>
                  <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="menor_preco">Menor Preço</SelectItem>
                    <SelectItem value="maior_preco">Maior Preço</SelectItem>
                    <SelectItem value="potencia">Potência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5 rounded", viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-1.5 rounded", viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Manual Tab Content */}
          {tab === "manual" ? (
            <div className="space-y-3">
              {/* Manual Kit Cards */}
              {manualKits.map((entry, index) => (
                <ManualKitRow
                  key={entry.card.id}
                  entry={entry}
                  onSelect={() => handleSelectManualKit(entry)}
                  onEdit={() => handleEditManualKit(index)}
                  onDelete={() => handleDeleteManualKit(index)}
                />
              ))}

              {manualKits.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum kit manual criado</p>
                  <p className="text-xs text-muted-foreground/70 mt-1 mb-4">Crie um kit manualmente para começar</p>
                  <Button size="sm" className="gap-1.5" onClick={() => setShowChoiceModal(true)}>
                    <Plus className="h-3.5 w-3.5" /> Criar kit manualmente
                  </Button>
                </div>
              )}

              {manualKits.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowChoiceModal(true)}>
                  <Plus className="h-3 w-3" /> Criar outro kit
                </Button>
              )}
            </div>
          ) : (
            /* Customizado / Fechado Tabs */
            activeKits.length > 0 ? (
              viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {activeKits.map(kit => (
                    <KitCard key={kit.id} kit={kit} onSelect={handleSelectKit} viewMode="grid" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {activeKits.map(kit => (
                    <KitCard key={kit.id} kit={kit} onSelect={handleSelectKit} viewMode="list" />
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum kit encontrado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou crie manualmente</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Choice Modal: equipamentos vs zero */}
      <Dialog open={showChoiceModal} onOpenChange={setShowChoiceModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base text-center">Escolha uma opção para prosseguir</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <button
              onClick={() => { setShowChoiceModal(false); setManualMode("equipamentos"); }}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all text-center"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <p className="text-xs leading-tight">
                Criar a partir de <strong className="text-primary">equipamentos disponíveis</strong> nos distribuidores
              </p>
            </button>
            <button
              onClick={() => { setShowChoiceModal(false); setManualMode("zero"); }}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/40 hover:bg-muted/30 transition-all text-center"
            >
              <div className="h-12 w-12 rounded-lg bg-muted/50 flex items-center justify-center">
                <Settings2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-xs leading-tight">
                <strong>Criar do zero,</strong> informando o nome dos equipamentos e distribuidores
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Kit Modal */}
      {manualMode && (
        <CriarKitManualModal
          open={!!manualMode}
          onOpenChange={(v) => { if (!v) { setManualMode(null); setEditingKitIndex(null); } }}
          modulos={modulos}
          inversores={inversores}
          onKitCreated={handleManualKitCreated}
          mode={manualMode}
        />
      )}
    </div>
  );
}

/* ── Manual Kit Row (list-style card matching reference screenshot) ── */

function ManualKitRow({ entry, onSelect, onEdit, onDelete }: {
  entry: { card: KitCardData; itens: KitItemRow[] };
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { card } = entry;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-border/40 hover:border-primary/30 transition-all bg-card">
      {/* Distributor placeholder */}
      <div className="w-20 h-16 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-muted-foreground uppercase text-center leading-tight px-1">
          {card.distribuidorNome || "—"}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-xs font-bold">
          {card.moduloQtd} {card.moduloDescricao} + {card.inversorQtd} {card.inversorDescricao}
        </p>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>{card.moduloQtd} {card.moduloDescricao}</span>
          <span>Total {card.moduloPotenciaKwp.toFixed(2)} kWp</span>
          <span>{card.inversorQtd} {card.inversorDescricao}</span>
          <span>Total {card.inversorPotenciaKw.toFixed(2)} kW</span>
          <span>Topologia</span>
          <span>{card.topologia}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">{formatBRL(card.precoTotal)}</span>
          <Badge variant="outline" className="text-[10px] h-5 bg-primary/5 border-primary/20 text-primary">
            {formatBRL(card.precoWp)} / Wp
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" className="gap-1 h-8 text-xs" onClick={onSelect}>
          <Plus className="h-3 w-3" /> Selecionar
        </Button>
      </div>
    </div>
  );
}
