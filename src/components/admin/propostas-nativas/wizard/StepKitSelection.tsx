import { useState, useMemo, useRef, useEffect } from "react";
import { Package, Zap, LayoutGrid, List, Settings2, Loader2, Pencil, Trash2, Plus, AlertCircle, BookOpen, Sun, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type KitItemRow, type LayoutArranjo, type PreDimensionamentoData, type TopologiaConfig,
  SOMBREAMENTO_OPTIONS, DESVIO_AZIMUTAL_OPTIONS, INCLINACAO_OPTIONS,
  TOPOLOGIA_LABELS, DEFAULT_TOPOLOGIA_CONFIGS,
  formatBRL,
} from "./types";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { fetchActiveKits, snapshotCatalogKitToKitItemRows, fetchKitsSummary, type CatalogKit, type CatalogKitSummary } from "@/services/kitCatalogService";

import { KitFilters, DEFAULT_FILTERS, type KitFiltersState } from "./kit/KitFilters";
import { KitCard, type KitCardData } from "./kit/KitCard";
import { CriarKitManualModal, type KitMeta } from "./kit/CriarKitManualModal";
import { EditarKitFechadoModal, type SelectedKit } from "./kit/EditarKitFechadoModal";
import { EditarLayoutModal } from "./kit/EditarLayoutModal";

interface CatalogoModuloUnificado {
  id: string; fabricante: string; modelo: string; potencia_wp: number | null;
  tipo_celula: string | null; eficiencia_percent: number | null;
}

interface CatalogoInversorUnificado {
  id: string; fabricante: string; modelo: string; potencia_nominal_kw: number | null;
  tipo: string | null; mppt_count: number | null; fases: string | null;
}

interface CatalogoOtimizador {
  id: string; fabricante: string; modelo: string; potencia_wp: number | null;
  eficiencia_percent: number | null; compatibilidade: string | null;
}

interface Props {
  itens: KitItemRow[];
  onItensChange: (itens: KitItemRow[]) => void;
  modulos: CatalogoModuloUnificado[];
  inversores: CatalogoInversorUnificado[];
  otimizadores?: CatalogoOtimizador[];
  loadingEquip: boolean;
  potenciaKwp: number;
  layouts?: LayoutArranjo[];
  onLayoutsChange?: (layouts: LayoutArranjo[]) => void;
  preDimensionamento?: PreDimensionamentoData;
  onPreDimensionamentoChange?: (pd: PreDimensionamentoData) => void;
  consumoTotal?: number;
  manualKits?: { card: KitCardData; itens: KitItemRow[]; meta?: KitMeta }[];
  onManualKitsChange?: (kits: { card: KitCardData; itens: KitItemRow[]; meta?: KitMeta }[]) => void;
}

type TabType = "customizado" | "fechado" | "manual" | "catalogo";

function kitItemsToCardData(itens: KitItemRow[], topologia?: string): KitCardData | null {
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
    topologia: topologia || "Tradicional",
    precoTotal,
    precoWp,
    updatedAt: new Date().toLocaleDateString("pt-BR"),
  };
}

// Mock kits removed — manual mode only for now

export function StepKitSelection({ itens, onItensChange, modulos, inversores, otimizadores = [], loadingEquip, potenciaKwp, layouts = [], onLayoutsChange, preDimensionamento: pd, onPreDimensionamentoChange: setPd, consumoTotal: consumoTotalProp = 0, manualKits: manualKitsProp = [], onManualKitsChange }: Props) {
  const [tab, setTab] = useState<TabType>("catalogo");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<KitFiltersState>({ ...DEFAULT_FILTERS, buscarValor: 0 });
  const [orderBy, setOrderBy] = useState("menor_preco");
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [manualMode, setManualMode] = useState<"equipamentos" | "zero" | null>(null);
  // Use lifted state if provided, fallback to local
  const [localManualKits, setLocalManualKits] = useState<{ card: KitCardData; itens: KitItemRow[]; meta?: KitMeta }[]>([]);
  const manualKits = onManualKitsChange ? manualKitsProp : localManualKits;
  const setManualKits = onManualKitsChange || setLocalManualKits;
  const [editingKitIndex, setEditingKitIndex] = useState<number | null>(null);
  const [showEditKitFechado, setShowEditKitFechado] = useState(false);
  const [showEditLayout, setShowEditLayout] = useState(false);
  const [showPremissas, setShowPremissas] = useState(false);
  const [premissasTab, setPremissasTab] = useState<"fator" | "sistema">("fator");

  // ── Catálogo state ──
  // SSOT: itens do catálogo são importados como KitItemRow[] e persistidos via snapshot JSONB.
  // proposta_kits/proposta_kit_itens NÃO são populados neste fluxo (legado).
  const [catalogKits, setCatalogKits] = useState<CatalogKit[]>([]);
  const [catalogSummaries, setCatalogSummaries] = useState<Map<string, CatalogKitSummary>>(new Map());
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState<string | null>(null); // kitId being loaded
  const [confirmReplace, setConfirmReplace] = useState<{ kitId: string; kitName: string } | null>(null);
  const catalogLoaded = useRef(false);

  // Load catalog kits when tab switches to "catalogo"
  useEffect(() => {
    if (tab !== "catalogo" || catalogLoaded.current) return;
    setCatalogLoading(true);
    setCatalogError(null);
    fetchActiveKits()
      .then(async (kits) => {
        setCatalogKits(kits);
        catalogLoaded.current = true;
        // Fetch summaries in parallel
        if (kits.length > 0) {
          const summaries = await fetchKitsSummary(kits.map(k => k.id));
          setCatalogSummaries(summaries);
        }
      })
      .catch((err) => setCatalogError(err.message))
      .finally(() => setCatalogLoading(false));
  }, [tab]);

  const handleSelectCatalogKit = async (kitId: string, kitName: string) => {
    // If items already exist, ask for confirmation
    if (itens.length > 0 && itens.some(i => i.descricao)) {
      setConfirmReplace({ kitId, kitName });
      return;
    }
    await applyCatalogSnapshot(kitId, kitName);
  };

  const applyCatalogSnapshot = async (kitId: string, kitName: string) => {
    setSnapshotLoading(kitId);
    try {
      const rows = await snapshotCatalogKitToKitItemRows(kitId);
      if (rows.length === 0) {
        toast({ title: "Kit vazio", description: "Este kit não possui itens cadastrados.", variant: "destructive" });
        return;
      }
      onItensChange(rows);
      toast({ title: "Kit importado do catálogo", description: `${kitName} — ${rows.length} item(ns) carregados` });
    } catch (err: any) {
      toast({ title: "Erro ao importar kit", description: err.message, variant: "destructive" });
    } finally {
      setSnapshotLoading(null);
      setConfirmReplace(null);
    }
  };

  const consumoTotal = filters.buscarValor;

  const mockKits: KitCardData[] = []; // Manual mode only for now


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

  const handleManualKitCreated = (newItens: KitItemRow[], meta?: KitMeta) => {
    const topoLabel = meta?.topologia || pd?.topologias?.[0] || "Tradicional";
    const card = kitItemsToCardData(newItens, topoLabel);
    if (card) {
      if (meta?.distribuidorNome) card.distribuidorNome = meta.distribuidorNome;
      if (meta?.custo) card.precoTotal = meta.custo;

      if (editingKitIndex !== null) {
        setManualKits(manualKits.map((k, i) => i === editingKitIndex ? { card, itens: newItens, meta } : k));
        setEditingKitIndex(null);
      } else {
        setManualKits([...manualKits, { card, itens: newItens, meta }]);
      }
    }
    setManualMode(null);
    setTab("manual");
  };

  const handleDeleteManualKit = (index: number) => {
    setManualKits(manualKits.filter((_, i) => i !== index));
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
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={() => { setShowPremissas(true); setPremissasTab("fator"); }}>
            <Settings2 className="h-3 w-3" /> Editar Premissas
          </Button>
          {(itens.length > 0 && itens.some(i => i.descricao)) || manualKits.length > 0 ? (
            <>
              <Button variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => setShowEditLayout(true)}>
                <LayoutGrid className="h-3 w-3" /> Editar layout
              </Button>
              <Badge variant="secondary" className="text-[10px] font-mono bg-success/10 text-success border-success/20">
                Kit selecionado • {itens.length > 0 ? itens.length : manualKits.reduce((s, k) => s + k.itens.length, 0)} itens
              </Badge>
            </>
          ) : null}
        </div>
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex gap-5 min-h-[500px]">
        {/* ── Sidebar Filters ── */}
        <aside className="w-[200px] shrink-0 hidden lg:block overflow-y-auto max-h-[calc(100vh-240px)] pr-1">
          <KitFilters filters={filters} onFiltersChange={setFilters} consumoMensal={consumoTotal} />
        </aside>

        {/* ── Main Content Area ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tabs: Customizado | Fechado | + Criar manualmente */}
          <div className="flex items-center border-b border-border/50">
            {([
              { key: "catalogo" as const, label: "📦 Catálogo", icon: true },
              { key: "customizado" as const, label: "Customizado" },
              { key: "fechado" as const, label: "Fechado" },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => { setTab("manual"); setShowChoiceModal(true); }}
              className={cn(
                "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
                tab === "manual"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              + Criar manualmente
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
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

          {/* Tab Content */}
          {tab === "catalogo" ? (
            /* ── Catálogo Tab ── */
            <div className="space-y-3">
              {catalogLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              ) : catalogError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="h-10 w-10 text-destructive/50 mb-3" />
                  <p className="text-sm font-medium text-destructive">{catalogError}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => { catalogLoaded.current = false; setTab("catalogo"); }}>
                    Tentar novamente
                  </Button>
                </div>
              ) : catalogKits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum kit ativo no catálogo</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Cadastre kits em Configurações → Catálogo de Kits</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {catalogKits.map(kit => {
                    const summary = catalogSummaries.get(kit.id);
                    return (
                      <div
                        key={kit.id}
                        className="rounded-xl border-2 border-border/40 bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all flex flex-col justify-between min-h-[200px]"
                      >
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-bold truncate">{kit.name}</p>
                            {kit.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{kit.description}</p>
                            )}
                          </div>

                          {/* Module info */}
                          {summary && summary.moduloQtd > 0 && (
                            <div className="flex items-start gap-2 text-xs">
                              <Sun className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                              <div>
                                <p className="font-medium">{summary.moduloQtd}x {summary.moduloDescricao}</p>
                                {summary.moduloPotenciaKwp > 0 && (
                                  <p className="text-[10px] text-muted-foreground">Total {summary.moduloPotenciaKwp.toFixed(2)} kWp</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Inverter info */}
                          {summary && summary.inversorQtd > 0 && (
                            <div className="flex items-start gap-2 text-xs">
                              <Cpu className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                              <div>
                                <p className="font-medium">{summary.inversorQtd}x {summary.inversorDescricao}</p>
                                {summary.inversorPotenciaKw > 0 && (
                                  <p className="text-[10px] text-muted-foreground">Total {summary.inversorPotenciaKw.toFixed(2)} kW</p>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-wrap">
                            {kit.estimated_kwp != null && kit.estimated_kwp > 0 && (
                              <Badge variant="secondary" className="text-[10px]">{kit.estimated_kwp} kWp</Badge>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {kit.pricing_mode === "fixed" ? `Fixo ${kit.fixed_price ? formatBRL(kit.fixed_price) : ""}` : "Calculado"}
                            </Badge>
                            {summary && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                {summary.totalItens} itens
                              </Badge>
                            )}
                          </div>

                          {kit.fixed_price != null && kit.fixed_price > 0 && (
                            <p className="text-sm font-bold text-primary">{formatBRL(kit.fixed_price)}</p>
                          )}
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            className="gap-1.5 h-8 text-xs"
                            disabled={snapshotLoading === kit.id}
                            onClick={() => handleSelectCatalogKit(kit.id, kit.name)}
                          >
                            {snapshotLoading === kit.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            Selecionar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : tab === "manual" ? (
            <div className="space-y-3">
              {/* Manual Kit Cards in grid like reference */}
              {manualKits.length > 0 && (
                <div className={viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3"
                  : "space-y-2"
                }>
                  {manualKits.map((entry, index) => (
                    <ManualKitCard
                      key={entry.card.id}
                      entry={entry}
                      viewMode={viewMode}
                      onSelect={() => handleSelectManualKit(entry)}
                      onEdit={() => handleEditManualKit(index)}
                      onDelete={() => handleDeleteManualKit(index)}
                    />
                  ))}
                </div>
              )}

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
          otimizadores={otimizadores}
          onKitCreated={handleManualKitCreated}
          mode={manualMode}
          sistema={pd?.sistema}
          topologias={pd?.topologias}
          initialItens={editingKitIndex !== null ? manualKits[editingKitIndex]?.itens : undefined}
          initialCardData={editingKitIndex !== null && manualKits[editingKitIndex] ? manualKits[editingKitIndex].meta || {
            distribuidorNome: manualKits[editingKitIndex].card.distribuidorNome,
            topologia: manualKits[editingKitIndex].card.topologia,
          } : undefined}
        />
      )}

      {/* Edit Kit Fechado Modal */}
      <EditarKitFechadoModal
        open={showEditKitFechado}
        onOpenChange={setShowEditKitFechado}
        kits={mockKits.filter(k => itens.some(i => i.descricao.includes(k.moduloDescricao)))}
        onSave={(selected) => {
          // Re-build itens from selected kits
          const newItens: KitItemRow[] = selected.flatMap(({ kit, quantidade }) => [
            {
              id: crypto.randomUUID(), descricao: `${kit.moduloQtd * quantidade}x ${kit.moduloDescricao}`,
              fabricante: kit.distribuidorNome, modelo: kit.moduloDescricao, potencia_w: (kit.moduloPotenciaKwp * 1000) / kit.moduloQtd,
              quantidade: kit.moduloQtd * quantidade, preco_unitario: 0, categoria: "modulo" as const, avulso: false,
            },
            {
              id: crypto.randomUUID(), descricao: `${kit.inversorQtd * quantidade}x ${kit.inversorDescricao}`,
              fabricante: kit.distribuidorNome, modelo: kit.inversorDescricao, potencia_w: kit.inversorPotenciaKw * 1000,
              quantidade: kit.inversorQtd * quantidade, preco_unitario: 0, categoria: "inversor" as const, avulso: false,
            },
          ]);
          onItensChange(newItens);
          toast({ title: "Kit atualizado" });
        }}
      />

      {/* Edit Layout Modal */}
      <EditarLayoutModal
        open={showEditLayout}
        onOpenChange={setShowEditLayout}
        layouts={layouts}
        totalModulos={
          itens.filter(i => i.categoria === "modulo").reduce((s, i) => s + i.quantidade, 0) ||
          manualKits.reduce((s, k) => s + k.itens.filter(i => i.categoria === "modulo").reduce((ss, i) => ss + i.quantidade, 0), 0)
        }
        onSave={(newLayouts) => {
          onLayoutsChange?.(newLayouts);
          toast({ title: "Layout atualizado" });
        }}
      />

      {/* Premissas Modal */}
      {pd && setPd && (
        <PremissasModal
          open={showPremissas}
          onOpenChange={setShowPremissas}
          pd={pd}
          setPd={setPd}
          activeTab={premissasTab}
          onTabChange={setPremissasTab}
          consumoTotal={consumoTotalProp}
        />
      )}

      {/* Confirm Replace Dialog (Catálogo) */}
      <AlertDialog open={!!confirmReplace} onOpenChange={(open) => { if (!open) setConfirmReplace(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir itens do kit?</AlertDialogTitle>
            <AlertDialogDescription>
              Você já possui {itens.length} item(ns) no kit atual. Ao selecionar <strong>{confirmReplace?.kitName}</strong> do catálogo, os itens atuais serão substituídos. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmReplace && applyCatalogSnapshot(confirmReplace.kitId, confirmReplace.kitName)}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Manual Kit Card (grid/list matching reference) ── */

function ManualKitCard({ entry, viewMode, onSelect, onEdit, onDelete }: {
  entry: { card: KitCardData; itens: KitItemRow[] };
  viewMode: "grid" | "list";
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { card } = entry;

  if (viewMode === "list") {
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 transition-all bg-card">
        <div className="w-20 h-16 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase text-center leading-tight px-1">
            {card.distribuidorNome || "—"}
          </span>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-xs font-bold truncate">
            {card.moduloQtd}x {card.moduloDescricao}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Total {card.moduloPotenciaKwp.toFixed(2)} kWp • {card.inversorQtd}x {card.inversorDescricao} • {card.topologia}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-foreground">{formatBRL(card.precoWp)} / Wp</span>
            <span className="text-xs text-muted-foreground">Total: <strong className="text-foreground">{formatBRL(card.precoTotal)}</strong></span>
          </div>
        </div>
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

  // Grid card (similar to reference screenshot)
  return (
    <div
      className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all flex flex-col justify-between min-h-[220px] cursor-pointer"
      onClick={onSelect}
    >
      {/* Distributor header */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            {card.distribuidorNome || "Manual"}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">KIT</span>
        </div>

        {/* Module info */}
        <div className="flex items-start gap-2 mb-1.5">
          <Package className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">{card.moduloQtd}x {card.moduloDescricao}</p>
            <p className="text-[10px] text-muted-foreground">Total {card.moduloPotenciaKwp.toFixed(2)} kWp</p>
          </div>
        </div>

        {/* Inverter info */}
        <div className="flex items-start gap-2 mb-3">
          <Zap className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">{card.inversorQtd}x {card.inversorDescricao}</p>
            <p className="text-[10px] text-muted-foreground">Total {card.inversorPotenciaKw.toFixed(2)} kW</p>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground mb-1">
          <span className="font-medium text-foreground">Topologia</span><br />
          {card.topologia}
        </div>
      </div>

      {/* Footer: price + actions */}
      <div className="border-t border-border/40 pt-3 mt-2">
        <p className="text-sm font-bold text-primary mb-1">{formatBRL(card.precoWp)} / Wp</p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Total: <strong className="text-foreground">{formatBRL(card.precoTotal)}</strong></p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Premissas Modal ── */

function PremissasModal({ open, onOpenChange, pd, setPd, activeTab, onTabChange, consumoTotal }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pd: PreDimensionamentoData;
  setPd: (pd: PreDimensionamentoData) => void;
  activeTab: "fator" | "sistema";
  onTabChange: (t: "fator" | "sistema") => void;
  consumoTotal: number;
}) {
  const pdRef = useRef(pd);
  pdRef.current = pd;
  const pdUpdate = <K extends keyof PreDimensionamentoData>(field: K, value: PreDimensionamentoData[K]) => {
    setPd({ ...pdRef.current, [field]: value });
  };

  const getTopoConfig = (topo: string): TopologiaConfig => {
    return pd.topologia_configs?.[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo] || DEFAULT_TOPOLOGIA_CONFIGS.tradicional;
  };

  const updateTopoConfig = (topo: string, field: keyof TopologiaConfig, value: any) => {
    const configs = { ...pd.topologia_configs };
    configs[topo] = { ...(configs[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo]), [field]: value };
    const updated: PreDimensionamentoData = { ...pd, topologia_configs: configs };
    if (topo === "tradicional") {
      updated.desempenho = configs.tradicional.desempenho;
      updated.fator_geracao = configs.tradicional.fator_geracao;
      updated.fator_geracao_meses = configs.tradicional.fator_geracao_meses;
    }
    setPd(updated);
  };

  const allTopos = ["tradicional", "microinversor", "otimizador"];

  const potenciaIdealByTopo = useMemo(() => {
    const result: Record<string, number> = {};
    for (const topo of allTopos) {
      const cfg = getTopoConfig(topo);
      result[topo] = cfg.fator_geracao > 0 ? Math.round((consumoTotal / cfg.fator_geracao) * 100) / 100 : 0;
    }
    return result;
  }, [consumoTotal, pd.topologia_configs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Premissas</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-border">
          <button
            onClick={() => onTabChange("fator")}
            className={cn(
              "text-sm font-medium pb-2 border-b-2 transition-colors",
              activeTab === "fator" ? "border-secondary text-secondary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Fator Geração
          </button>
          <button
            onClick={() => onTabChange("sistema")}
            className={cn(
              "text-sm font-medium pb-2 border-b-2 transition-colors",
              activeTab === "sistema" ? "border-secondary text-secondary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Sistema Solar
          </button>
        </div>

        {activeTab === "fator" ? (
          <div className="space-y-4 pt-1">
            {/* Sombreamento */}
            <div className="space-y-1.5">
              <Label className="text-[11px] flex items-center gap-1">
                Sombreamento <span className="text-destructive">*</span>
                <TooltipProvider><Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="text-xs">Nível de sombreamento no local</p></TooltipContent></Tooltip></TooltipProvider>
              </Label>
              <Select value={pd.sombreamento} onValueChange={v => pdUpdate("sombreamento", v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{SOMBREAMENTO_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Desvio / Inclinação */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Desvio Azimutal <span className="text-destructive">*</span></Label>
                <Select value={String(pd.desvio_azimutal)} onValueChange={v => pdUpdate("desvio_azimutal", Number(v))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{DESVIO_AZIMUTAL_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d}°</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Inclinação <span className="text-destructive">*</span></Label>
                <Select value={String(pd.inclinacao)} onValueChange={v => pdUpdate("inclinacao", Number(v))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{INCLINACAO_OPTIONS.map(i => <SelectItem key={i} value={String(i)}>{i}°</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* 3-column topology grid */}
            <div className="grid grid-cols-3 gap-4">
              {allTopos.map(topo => {
                const cfg = getTopoConfig(topo);
                const potIdeal = potenciaIdealByTopo[topo] || 0;
                const isActive = pd.topologias.includes(topo);
                return (
                  <div key={topo} className={`space-y-3 ${!isActive ? "opacity-40 pointer-events-none" : ""}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold">{TOPOLOGIA_LABELS[topo]}</p>
                      <Badge variant="outline" className="text-[10px] font-mono border-secondary text-secondary">
                        Pot. ideal: {potIdeal.toFixed(2)} kWp
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] flex items-center gap-1">
                        Desempenho <span className="text-destructive">*</span>
                        <TooltipProvider><Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="text-xs">Performance Ratio</p></TooltipContent></Tooltip></TooltipProvider>
                      </Label>
                      <div className="relative">
                        <Input type="number" step="0.01" value={cfg.desempenho || ""} onChange={e => updateTopoConfig(topo, "desempenho", Number(e.target.value))} className="h-9 text-xs pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px]">Fator de Geração <span className="text-destructive">*</span></Label>
                        <button className="text-[10px] text-secondary hover:underline flex items-center gap-0.5">mês a mês <Pencil className="h-2.5 w-2.5" /></button>
                      </div>
                      <div className="relative">
                        <Input type="number" step="0.01" value={cfg.fator_geracao || ""} onChange={e => updateTopoConfig(topo, "fator_geracao", Number(e.target.value))} className="h-9 text-xs pr-16" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kWh/kWp</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Sistema Solar tab */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Sobredimensionamento</Label>
                <div className="relative">
                  <Input type="number" step="0.01" value={pd.sobredimensionamento || ""} onChange={e => pdUpdate("sobredimensionamento", Number(e.target.value))} className="h-9 text-xs pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Margem para Pot. Ideal</Label>
                <div className="relative">
                  <Input type="number" step="0.01" value={pd.margem_pot_ideal || ""} onChange={e => pdUpdate("margem_pot_ideal", Number(e.target.value))} className="h-9 text-xs pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Label className="text-xs">Considerar kits que necessitam de transformador</Label>
              <Switch checked={pd.considerar_transformador} onCheckedChange={v => pdUpdate("considerar_transformador", v)} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button size="sm" onClick={() => onOpenChange(false)} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
