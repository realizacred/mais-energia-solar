import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { calcFatorGeracao, calcEffectiveIrrad } from "@/services/solar/fatorGeracaoService";
import { DEFAULT_SOMBREAMENTO_CONFIG, type SombreamentoConfig } from "@/hooks/useTenantPremises";
import { formatDate } from "@/lib/dateUtils";
import { Package, Zap, LayoutGrid, List, Settings2, Loader2, Pencil, Trash2, Plus, AlertCircle, BookOpen, Sun, Cpu, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
  TOPOLOGIA_LABELS, DEFAULT_TOPOLOGIA_CONFIGS, MESES,
  formatBRL,
} from "./types";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { fetchActiveKits, snapshotCatalogKitToKitItemRows, fetchKitsSummary, type CatalogKit, type CatalogKitSummary } from "@/services/kitCatalogService";
import { formatNumberBR } from "@/lib/formatters";

import { KitFilters, DEFAULT_FILTERS, type KitFiltersState, type KitFilterOptions } from "./kit/KitFilters";
import { KitCard, type KitCardData } from "./kit/KitCard";
import { CriarKitManualModal, type KitMeta } from "./kit/CriarKitManualModal";
import { EditarKitFechadoModal, type SelectedKit } from "./kit/EditarKitFechadoModal";
import { EditarLayoutModal } from "./kit/EditarLayoutModal";
import { MesAMesDialog } from "./uc/UCModals";
import { SolaryumTab } from "./SolaryumTab";
import type { ProdutoSolaryum } from "@/hooks/useSolaryumKits";

interface CatalogoModuloUnificado {
  id: string; fabricante: string; modelo: string; potencia_wp: number | null;
  tipo_celula: string | null; eficiencia_percent: number | null;
  garantia_produto_anos?: number | null; garantia_performance_anos?: number | null;
}

interface CatalogoInversorUnificado {
  id: string; fabricante: string; modelo: string; potencia_nominal_kw: number | null;
  tipo: string | null; mppt_count: number | null; fases: string | null;
  garantia_anos?: number | null;
}

interface CatalogoOtimizador {
  id: string; fabricante: string; modelo: string; potencia_wp: number | null;
  eficiencia_percent: number | null; compatibilidade: string | null;
}

interface CatalogoBateria {
  id: string; fabricante: string; modelo: string; energia_kwh: number | null;
  tensao_nominal_v: number | null; tipo_bateria: string | null;
}

interface Props {
  itens: KitItemRow[];
  onItensChange: (itens: KitItemRow[]) => void;
  modulos: CatalogoModuloUnificado[];
  inversores: CatalogoInversorUnificado[];
  otimizadores?: CatalogoOtimizador[];
  baterias?: CatalogoBateria[];
  loadingEquip: boolean;
  potenciaKwp: number;
  layouts?: LayoutArranjo[];
  onLayoutsChange?: (layouts: LayoutArranjo[]) => void;
  preDimensionamento?: PreDimensionamentoData;
  onPreDimensionamentoChange?: (pd: PreDimensionamentoData) => void;
  consumoTotal?: number;
  manualKits?: { card: KitCardData; itens: KitItemRow[]; meta?: KitMeta }[];
  onManualKitsChange?: (kits: { card: KitCardData; itens: KitItemRow[]; meta?: KitMeta }[]) => void;
  selectedManualIdx?: number | null;
  onSelectedManualIdxChange?: (idx: number | null) => void;
  irradiacao?: number;
  latitude?: number | null;
  ghiSeries?: Record<string, number> | null;
  somenteGhi?: boolean;
  /** Override de custo do kit definido no Centro Financeiro */
  custoKitOverride?: number | null;
  /** Código IBGE do município do cliente — usado para integrações (Solaryum frete) */
  ibgeCodigo?: string | null;
}

type TabType = "customizado" | "fechado" | "catalogo" | "solaryum";

function kitItemsToCardData(itens: KitItemRow[], topologia?: string, custoOverride?: number | null): KitCardData | null {
  // Filter only items with meaningful data (non-empty description or potencia > 0)
  const meaningfulItems = itens.filter(i => (i.descricao && i.descricao.trim() !== "") || i.potencia_w > 0 || i.preco_unitario > 0);
  if (meaningfulItems.length === 0) return null;
  const modItems = meaningfulItems.filter(i => i.categoria === "modulo");
  const invItems = meaningfulItems.filter(i => i.categoria === "inversor");

  const totalModQtd = modItems.reduce((s, m) => s + m.quantidade, 0);
  const totalModKwp = modItems.reduce((s, m) => s + (m.potencia_w * m.quantidade) / 1000, 0);
  const totalInvQtd = invItems.reduce((s, i) => s + i.quantidade, 0);
  const totalInvKw = invItems.reduce((s, i) => s + (i.potencia_w * i.quantidade) / 1000, 0);
  const precoFromItems = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const precoTotal = (custoOverride != null && custoOverride > 0) ? custoOverride : precoFromItems;
  const precoWp = totalModKwp > 0 ? precoTotal / (totalModKwp * 1000) : 0;

  const modDesc = modItems.length > 0
    ? modItems.map(m => `${m.fabricante} ${m.modelo}`.trim()).filter(Boolean).join(" + ") || "—"
    : "—";
  const invDesc = invItems.length > 0
    ? invItems.map(i => `${i.fabricante} ${i.modelo}`.trim()).filter(Boolean).join(" + ") || "—"
    : "—";

  return {
    id: `manual-${Date.now()}`,
    distribuidorNome: modItems[0]?.fabricante || invItems[0]?.fabricante || "",
    moduloDescricao: modDesc,
    moduloQtd: totalModQtd,
    moduloPotenciaKwp: totalModKwp,
    inversorDescricao: invDesc,
    inversorQtd: totalInvQtd,
    inversorPotenciaKw: totalInvKw,
    topologia: topologia || (invItems.length > 0 ? "Tradicional" : "Sem inversor"),
    precoTotal,
    precoWp,
    updatedAt: formatDate(new Date()),
  };
}

// Mock kits removed — manual mode only for now

export function StepKitSelection({ itens, onItensChange, modulos, inversores, otimizadores = [], baterias = [], loadingEquip, potenciaKwp, layouts = [], onLayoutsChange, preDimensionamento: pd, onPreDimensionamentoChange: setPd, consumoTotal: consumoTotalProp = 0, manualKits: manualKitsProp = [], onManualKitsChange, selectedManualIdx: selectedManualIdxProp, onSelectedManualIdxChange, irradiacao, latitude, ghiSeries, somenteGhi, custoKitOverride, ibgeCodigo }: Props) {
  // If returning to this step with a kit already restored, auto-switch to "customizado" tab
  const [tab, setTab] = useState<TabType>(() => {
    if (manualKitsProp.length > 0) return "customizado";
    return "catalogo";
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<KitFiltersState>({ ...DEFAULT_FILTERS });
  const [orderBy, setOrderBy] = useState("melhor_kwp");
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [manualMode, setManualMode] = useState<"equipamentos" | "zero" | null>(null);
  // Use lifted state if provided, fallback to local
  const [localManualKits, setLocalManualKits] = useState<{ card: KitCardData; itens: KitItemRow[]; meta?: KitMeta }[]>([]);
  const persistedManualKits = onManualKitsChange ? manualKitsProp : localManualKits;
  const manualKits = useMemo(() => {
    if (persistedManualKits.length > 0) return persistedManualKits;
    if (itens.length === 0) return [];
    const restoredCard = kitItemsToCardData(itens, pd?.topologias?.[0], custoKitOverride ?? null);
    if (!restoredCard) return [];
    return [{
      card: { ...restoredCard, distribuidorNome: restoredCard.distribuidorNome || "Importado SM" },
      itens,
      meta: { distribuidorNome: "Importado SM", nomeKit: "Kit restaurado" },
    }];
  }, [persistedManualKits, itens, pd?.topologias, custoKitOverride]);
  const setManualKits = onManualKitsChange || setLocalManualKits;
  const [editingKitIndex, setEditingKitIndex] = useState<number | null>(null);
  const [selectedManualIdx, setSelectedManualIdx] = useState<number | null>(() => {
    // If returning with itens already set from a manual kit, detect which one
    if (manualKitsProp.length > 0 && itens.length > 0) {
      const idx = manualKitsProp.findIndex(mk => mk.itens.length === itens.length && mk.itens.every((mi, i) => mi.modelo === itens[i]?.modelo));
      return idx >= 0 ? idx : null;
    }
    return null;
  });
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
  const [includeComponents, setIncludeComponents] = useState(false);
  const catalogLoaded = useRef(false);
  const [selectedSolaryumKitId, setSelectedSolaryumKitId] = useState<number | null>(null);

  // Derive selected catalog kit ID from manualKits meta
  const selectedCatalogKitId = useMemo(() => {
    if (manualKits.length > 0 && manualKits[0]?.meta?.catalogKitId) {
      return manualKits[0].meta.catalogKitId;
    }
    return null;
  }, [manualKits]);

  // Load catalog kits when tab switches to "catalogo" — fetch all, filter client-side
  useEffect(() => {
    if (tab !== "catalogo" || catalogLoaded.current) return;
    setCatalogLoading(true);
    setCatalogError(null);
    fetchActiveKits(false) // fetch all products; generator filter applied client-side via includeComponents toggle
      .then(async (kits) => {
        setCatalogKits(kits);
        catalogLoaded.current = true;
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

      // Find catalog kit for full metadata
      const catalogKit = catalogKits.find(k => k.id === kitId);

      // For integrated kits (with source + external_id), allow selection even without
      // legacy solar_kit_catalog_items — the canonical catalog data IS the kit.
      const isIntegratedKit = !!catalogKit?.source && !!catalogKit?.external_data;

      if (rows.length === 0 && !isIntegratedKit) {
        toast({ title: "Kit vazio", description: "Este kit não possui itens cadastrados.", variant: "destructive" });
        return;
      }

      onItensChange(rows);

      const summary = catalogSummaries.get(kitId);
      const extData = catalogKit?.external_data;

      // Determine topology: provider-agnostic from external_data
      let topoLabel = "Tradicional";
      if (extData?.sistema === "hibrido" || extData?.inversorHibrido === true) topoLabel = "Híbrido";
      else if (extData?.tipoDeProduto?.toLowerCase?.()?.includes?.("micro")) topoLabel = "Microinversor";

      const card = kitItemsToCardData(rows, topoLabel);

      // Cost: prefer fixed_price from catalog, then calculated from item unit_prices
      const calculatedCost = rows.reduce((s, r) => s + r.quantidade * r.preco_unitario, 0);
      const kitCost = catalogKit?.fixed_price || summary?.custoTotal || calculatedCost;

      // Determine source label — provider-agnostic (capitalize source)
      const sourceLabel = catalogKit?.source
        ? catalogKit.source.charAt(0).toUpperCase() + catalogKit.source.slice(1)
        : "";
      const distribLabel = sourceLabel || kitName;

      // Build provider-agnostic KitMeta with full snapshot
      const meta: KitMeta = {
        distribuidorNome: distribLabel,
        nomeKit: catalogKit?.name || kitName,
        codigoKit: kitId.slice(0, 8).toUpperCase(),
        catalogKitId: kitId,
        topologia: topoLabel,
        custo: kitCost,
        sistema: extData?.sistema || "on_grid",
        // Provider-agnostic snapshot enrichment for any integrated kit
        ...(catalogKit?.source ? {
          source: catalogKit.source,
          external_id: catalogKit?.external_data?.id ?? extData?.external_id ?? null,
          fabricante: catalogKit.fabricante || null,
          potencia_kwp: catalogKit.estimated_kwp || null,
          potencia_inversor: catalogKit.potencia_inversor || null,
          fase: catalogKit.fase || null,
          tensao: catalogKit.tensao || null,
          estrutura: catalogKit.estrutura || null,
          preco_integrador: catalogKit.fixed_price || null,
          disponivel: catalogKit.disponivel ?? null,
          permite_compra_sem_estoque: catalogKit.permite_compra_sem_estoque ?? null,
          previsao: catalogKit.previsao || null,
          external_data: extData || null,
          selected_at: new Date().toISOString(),
        } : {}),
      };

      // For integrated kits, build fallback card from catalog metadata if rows-based card fails
      let finalCard = card;
      if (!finalCard && isIntegratedKit && catalogKit) {
        const estKwp = catalogKit.estimated_kwp || 0;
        const invKw = catalogKit.potencia_inversor || 0;
        finalCard = {
          id: `catalog-${kitId}`,
          distribuidorNome: distribLabel,
          moduloDescricao: catalogKit.potencia_modulo
            ? `${catalogKit.fabricante || "Módulo"} ${catalogKit.potencia_modulo}W`
            : catalogKit.name,
          moduloQtd: estKwp > 0 && catalogKit.potencia_modulo
            ? Math.round((estKwp * 1000) / catalogKit.potencia_modulo)
            : 1,
          moduloPotenciaKwp: estKwp,
          inversorDescricao: invKw > 0
            ? `${catalogKit.fabricante || "Inversor"} ${invKw}kW`
            : "—",
          inversorQtd: invKw > 0 ? 1 : 0,
          inversorPotenciaKw: invKw,
          topologia: topoLabel,
          precoTotal: meta.custo || 0,
          precoWp: estKwp > 0 ? (meta.custo || 0) / (estKwp * 1000) : 0,
          updatedAt: formatDate(new Date()),
        };
      }
      if (finalCard) {
        finalCard.distribuidorNome = distribLabel;
        if (meta.custo) finalCard.precoTotal = meta.custo;
        setManualKits([{ card: finalCard, itens: rows, meta }]);
      }

      const itemLabel = rows.length > 0 ? `${rows.length} item(ns).` : "Kit integrado selecionado.";
      toast({ title: "Kit importado do catálogo", description: `${kitName} — ${itemLabel}` });
      // Stay on catalogo tab — the selected kit banner shows at the top
    } catch (err: any) {
      toast({ title: "Erro ao importar kit", description: err.message, variant: "destructive" });
    } finally {
      setSnapshotLoading(null);
      setConfirmReplace(null);
    }
  };

  const consumoTotal = 0;

  // Build KitCardData from current itens for the Edit Kit Fechado modal
  const currentKitCards = useMemo(() => {
    if (!itens || itens.length === 0) return [];
    const card = kitItemsToCardData(itens, undefined, custoKitOverride);
    return card ? [card] : [];
  }, [itens, custoKitOverride]);

  // Extract dynamic filter options from catalog data
  const filterOptions = useMemo<KitFilterOptions>(() => {
    const fabricantesSet = new Set<string>();
    const modelosSet = new Set<string>();

    catalogKits.forEach(kit => {
      // Fabricante from catalog or summary inversor
      if (kit.fabricante) fabricantesSet.add(kit.fabricante);
      const summary = catalogSummaries.get(kit.id);
      if (summary?.inversorDescricao) {
        modelosSet.add(summary.inversorDescricao);
        // Try to extract fabricante from inversor description (first word)
        const parts = summary.inversorDescricao.split(" ");
        if (parts.length > 0 && parts[0].length > 2) fabricantesSet.add(parts[0]);
      }
    });

    return {
      fabricantesInversor: Array.from(fabricantesSet).sort(),
      modelosInversor: Array.from(modelosSet).sort(),
    };
  }, [catalogKits, catalogSummaries]);

  // Filter & sort catalog kits based on sidebar filters
  const filteredCatalogKits = useMemo(() => {
    // Default: show only generators unless "includeComponents" toggle is on
    let result = includeComponents
      ? [...catalogKits]
      : catalogKits.filter(k => k.is_generator);

    // Potência range filter
    if (filters.potenciaMin > 0 || filters.potenciaMax < 1000) {
      result = result.filter(k => {
        const kwp = k.estimated_kwp ?? 0;
        return kwp >= filters.potenciaMin && kwp <= filters.potenciaMax;
      });
    }

    // General text search (name, description, fabricante)
    if (filters.searchText.trim()) {
      const q = filters.searchText.toLowerCase();
      result = result.filter(k =>
        k.name.toLowerCase().includes(q) ||
        (k.description || "").toLowerCase().includes(q) ||
        (k.fabricante || "").toLowerCase().includes(q)
      );
    }

    // Fabricante Inversor dropdown
    if (filters.fabricanteInversor) {
      const q = filters.fabricanteInversor.toLowerCase();
      result = result.filter(k => {
        if (k.fabricante?.toLowerCase() === q) return true;
        const summary = catalogSummaries.get(k.id);
        return summary ? summary.inversorDescricao.toLowerCase().includes(q) : false;
      });
    }

    // Inversor modelo dropdown
    if (filters.inversorModelo) {
      const q = filters.inversorModelo.toLowerCase();
      result = result.filter(k => {
        const summary = catalogSummaries.get(k.id);
        return summary ? summary.inversorDescricao.toLowerCase().includes(q) : false;
      });
    }

    // Text search by distributor name
    if (filters.searchDistribuidor.trim()) {
      const q = filters.searchDistribuidor.toLowerCase();
      result = result.filter(k => k.name.toLowerCase().includes(q) || (k.description || "").toLowerCase().includes(q));
    }

    // Text search by module description
    if (filters.searchModulo.trim()) {
      const q = filters.searchModulo.toLowerCase();
      result = result.filter(k => {
        const summary = catalogSummaries.get(k.id);
        return summary ? summary.moduloDescricao.toLowerCase().includes(q) : true;
      });
    }

    // Sort
    if (orderBy === "melhor_kwp") {
      result.sort((a, b) => (a.preco_por_kwp || Infinity) - (b.preco_por_kwp || Infinity));
    } else if (orderBy === "menor_preco") {
      result.sort((a, b) => {
        const pa = a.fixed_price || catalogSummaries.get(a.id)?.custoTotal || 0;
        const pb = b.fixed_price || catalogSummaries.get(b.id)?.custoTotal || 0;
        return pa - pb;
      });
    } else if (orderBy === "maior_preco") {
      result.sort((a, b) => {
        const pa = a.fixed_price || catalogSummaries.get(a.id)?.custoTotal || 0;
        const pb = b.fixed_price || catalogSummaries.get(b.id)?.custoTotal || 0;
        return pb - pa;
      });
    } else if (orderBy === "potencia") {
      result.sort((a, b) => (b.estimated_kwp || 0) - (a.estimated_kwp || 0));
    } else if (orderBy === "disponibilidade") {
      result.sort((a, b) => {
        const scoreA = a.disponivel ? 0 : a.permite_compra_sem_estoque ? 1 : 2;
        const scoreB = b.disponivel ? 0 : b.permite_compra_sem_estoque ? 1 : 2;
        return scoreA - scoreB;
      });
    }

    return result;
  }, [catalogKits, catalogSummaries, filters, orderBy, includeComponents]);


  const handleSelectKit = (kit: KitCardData) => {
    const totalPreco = kit.precoTotal || 0;
    // Distribute price proportionally by potencia_w weight
    const moduloPotW = ((kit.moduloPotenciaKwp * 1000) / kit.moduloQtd) * kit.moduloQtd;
    const inversorPotW = kit.inversorPotenciaKw * 1000 * kit.inversorQtd;
    const totalWeight = moduloPotW + inversorPotW;

    const moduloPreco = totalWeight > 0 && totalPreco > 0
      ? Math.round((moduloPotW / totalWeight * totalPreco / kit.moduloQtd) * 100) / 100
      : 0;
    const inversorPreco = totalWeight > 0 && totalPreco > 0
      ? Math.round(((totalPreco - moduloPreco * kit.moduloQtd) / kit.inversorQtd) * 100) / 100
      : 0;

    const newItens: KitItemRow[] = [
      {
        id: crypto.randomUUID(), descricao: `${kit.moduloQtd}x ${kit.moduloDescricao}`,
        fabricante: kit.distribuidorNome, modelo: kit.moduloDescricao, potencia_w: (kit.moduloPotenciaKwp * 1000) / kit.moduloQtd,
        quantidade: kit.moduloQtd, preco_unitario: moduloPreco, categoria: "modulo", avulso: false,
      },
      {
        id: crypto.randomUUID(), descricao: `${kit.inversorQtd}x ${kit.inversorDescricao}`,
        fabricante: kit.distribuidorNome, modelo: kit.inversorDescricao, potencia_w: kit.inversorPotenciaKw * 1000,
        quantidade: kit.inversorQtd, preco_unitario: inversorPreco, categoria: "inversor", avulso: false,
      },
    ];
    onItensChange(newItens);
    toast({ title: "Kit selecionado", description: `${kit.moduloPotenciaKwp.toFixed(2)} kWp • ${kit.topologia}` });
  };

  const handleSelectManualKit = (entry: { card: KitCardData; itens: KitItemRow[] }, index: number) => {
    onItensChange(entry.itens);
    setSelectedManualIdx(index);
    toast({ title: "Kit selecionado", description: `${entry.card.moduloPotenciaKwp.toFixed(2)} kWp` });
  };

  const handleManualKitCreated = (newItens: KitItemRow[], meta?: KitMeta) => {
    const topoLabel = meta?.topologia || pd?.topologias?.[0] || "Tradicional";
    const card = kitItemsToCardData(newItens, topoLabel);
    if (card) {
      if (meta?.distribuidorNome) card.distribuidorNome = meta.distribuidorNome;
      if (meta?.custo != null && meta.custo > 0) card.precoTotal = meta.custo;

      if (editingKitIndex !== null) {
        const updatedKits = manualKits.map((k, i) => i === editingKitIndex ? { card, itens: newItens, meta } : k);
        setManualKits(updatedKits);
        // If the edited kit was the selected one, propagate updated items to parent
        if (selectedManualIdx === editingKitIndex) {
          onItensChange(newItens);
        }
        setEditingKitIndex(null);
      } else {
        const newKits = [...manualKits, { card, itens: newItens, meta }];
        setManualKits(newKits);
        // Auto-select the newly created kit
        const newIdx = newKits.length - 1;
        setSelectedManualIdx(newIdx);
        onItensChange(newItens);
      }
    }
    setManualMode(null);
    setTab("customizado");
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

  const activeKits = tab === "customizado" ? [] : currentKitCards;

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
      <div className="flex gap-5 min-h-0">
        {/* ── Sidebar Filters ── */}
        <aside className="w-[200px] shrink-0 hidden lg:flex lg:flex-col overflow-hidden pr-1">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <KitFilters filters={filters} onFiltersChange={setFilters} consumoMensal={consumoTotal} options={filterOptions} />
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tabs: Catálogo | Customizado | Fechado */}
          <div className="flex items-center border-b border-border/50">
            {([
              { key: "catalogo" as const, label: "📦 Catálogo" },
              { key: "solaryum" as const, label: "🔌 Solaryum" },
              { key: "customizado" as const, label: `Customizado${manualKits.length > 0 ? ` (${manualKits.length})` : ""}` },
              { key: "fechado" as const, label: "Fechado" },
            ]).map(t => (
              <Button
                key={t.key}
                variant="ghost"
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-5 py-2.5 text-sm font-medium border-b-2 rounded-none transition-colors",
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Button>
            ))}
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
                    <SelectItem value="melhor_kwp">Melhor R$/kWp</SelectItem>
                    <SelectItem value="menor_preco">Menor Preço</SelectItem>
                    <SelectItem value="maior_preco">Maior Preço</SelectItem>
                    <SelectItem value="potencia">Potência</SelectItem>
                    <SelectItem value="disponibilidade">Disponibilidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Visualização em grid"
                onClick={() => setViewMode("grid")}
                className={cn("h-8 w-8", viewMode === "grid" && "bg-primary/10 text-primary")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Visualização em lista"
                onClick={() => setViewMode("list")}
                className={cn("h-8 w-8", viewMode === "list" && "bg-primary/10 text-primary")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── Selected Kit Banner (visible on all tabs when kit is selected) ── */}
          {manualKits.length > 0 && (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">Kit Selecionado</span>
                  {manualKits[0]?.meta?.source && (
                    <Badge variant="outline" className="text-[10px] bg-info/10 text-info border-info/30">
                      {(manualKits[0].meta.source as string).charAt(0).toUpperCase() + (manualKits[0].meta.source as string).slice(1)}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                    {manualKits[0]?.meta?.source ? "Fechado" : "Customizado"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditingKitIndex(0); setManualMode("zero"); }}>
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteManualKit(0)}>
                    <Trash2 className="h-3 w-3" /> Remover
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-6 flex-wrap text-xs text-foreground">
                <div className="flex items-center gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{manualKits[0].card.moduloQtd}x {manualKits[0].card.moduloDescricao}</span>
                  <span className="text-muted-foreground">({manualKits[0].card.moduloPotenciaKwp.toFixed(2)} kWp)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{manualKits[0].card.inversorQtd}x {manualKits[0].card.inversorDescricao}</span>
                  <span className="text-muted-foreground">({manualKits[0].card.inversorPotenciaKw.toFixed(2)} kW)</span>
                </div>
                {manualKits[0].card.precoTotal > 0 && (
                  <span className="font-bold text-primary">{formatBRL(manualKits[0].card.precoTotal)}</span>
                )}
              </div>
              {manualKits[0]?.meta?.fabricante && (
                <p className="text-[10px] text-muted-foreground">
                  Fabricante: {manualKits[0].meta.fabricante as string}
                  {manualKits[0]?.meta?.fase && <> • {manualKits[0].meta.fase as string}</>}
                  {manualKits[0]?.meta?.tensao && <> • {manualKits[0].meta.tensao as string}</>}
                  {manualKits[0]?.meta?.estrutura && <> • {manualKits[0].meta.estrutura as string}</>}
                </p>
              )}
            </div>
          )}

          {/* Tab Content */}
          {tab === "catalogo" ? (
            /* ── Catálogo Tab ── */
            <div className="space-y-3">
              {/* Toggle para incluir componentes avulsos */}
              <div className="flex items-center justify-end gap-2">
                <Label htmlFor="include-components" className="text-xs text-muted-foreground cursor-pointer">
                  Incluir componentes
                </Label>
                <Switch
                  id="include-components"
                  checked={includeComponents}
                  onCheckedChange={setIncludeComponents}
                />
              </div>
              {catalogLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border p-4 space-y-3 animate-pulse">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
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
              ) : filteredCatalogKits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum kit corresponde aos filtros</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou limpe para ver todos</p>
                </div>
              ) : (
                <div className={viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
                  : "space-y-2"
                }>
                  {filteredCatalogKits.map(kit => {
                    const summary = catalogSummaries.get(kit.id);
                    const isSelected = selectedCatalogKitId === kit.id;

                    const kitPrice = kit.fixed_price || summary?.custoTotal || 0;

                    if (viewMode === "list") {
                      return (
                        <div
                          key={kit.id}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-xl border-2 transition-all bg-card cursor-pointer",
                            isSelected
                              ? "border-primary shadow-md ring-2 ring-primary/20"
                              : "border-border/40 hover:border-primary/30"
                          )}
                          onClick={() => handleSelectCatalogKit(kit.id, kit.name)}
                        >
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold truncate">{kit.name}</p>
                              {kit.fabricante && <span className="text-[10px] text-muted-foreground">({kit.fabricante})</span>}
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                              {kit.estimated_kwp != null && <span><Sun className="h-3 w-3 inline mr-0.5" />{kit.estimated_kwp} kWp</span>}
                              {kit.potencia_inversor != null && kit.potencia_inversor > 0 && <span><Cpu className="h-3 w-3 inline mr-0.5" />{kit.potencia_inversor}kW</span>}
                              {kit.fase && <span>{kit.fase}</span>}
                              {kit.tensao && <span>{kit.tensao}</span>}
                              {kit.estrutura && <span>{kit.estrutura}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {!!kit.fornecedor_id && (
                                kit.disponivel ? (
                                  <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">Em estoque</Badge>
                                ) : kit.permite_compra_sem_estoque ? (
                                  <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">Sob encomenda</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">Indisponível</Badge>
                                )
                              )}
                              {!!kit.fornecedor_id && kit.source && (
                                <Badge variant="outline" className="text-[10px] bg-info/10 text-info border-info/30">{kit.source.charAt(0).toUpperCase() + kit.source.slice(1)}</Badge>
                              )}
                              {kit.preco_por_kwp != null && kit.preco_por_kwp > 0 && (
                                <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary">
                                  {formatBRL(kit.preco_por_kwp)} / kWp
                                </Badge>
                              )}
                              {kitPrice > 0 && (
                                <span className="text-sm font-bold text-primary">{formatBRL(kitPrice)}</span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isSelected ? "outline" : "default"}
                            className={cn("gap-1.5 h-8 text-xs shrink-0", isSelected && "border-primary text-primary")}
                            disabled={snapshotLoading === kit.id}
                            onClick={(e) => { e.stopPropagation(); handleSelectCatalogKit(kit.id, kit.name); }}
                          >
                            {snapshotLoading === kit.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isSelected ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            {isSelected ? "Selecionado" : "Selecionar"}
                          </Button>
                        </div>
                      );
                    }

                    // Availability badge helper
                    const availBadge = !!kit.fornecedor_id ? (
                      kit.disponivel ? (
                        <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">Em estoque</Badge>
                      ) : kit.permite_compra_sem_estoque ? (
                        <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">Sob encomenda</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">Indisponível</Badge>
                      )
                    ) : null;

                    return (
                      <div
                        key={kit.id}
                        className={cn(
                          "rounded-xl border-2 bg-card p-4 hover:shadow-md transition-all flex flex-col justify-between h-auto cursor-pointer relative",
                          isSelected
                            ? "border-primary shadow-md ring-2 ring-primary/20"
                            : "border-border/40 hover:border-primary/30"
                        )}
                        onClick={() => handleSelectCatalogKit(kit.id, kit.name)}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                              <Check className="h-3 w-3" /> Selecionado
                            </Badge>
                          </div>
                        )}

                        <div className="space-y-2.5">
                          {/* Name + fabricante */}
                          <div>
                            <p className="text-sm font-bold truncate pr-20">{kit.name}</p>
                            {kit.fabricante && (
                              <p className="text-[11px] text-muted-foreground font-medium">{kit.fabricante}</p>
                            )}
                          </div>

                          {/* Potência + Inversor */}
                          <div className="flex items-start gap-2 text-xs">
                            <Sun className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium">{kit.estimated_kwp ?? 0} kWp</p>
                              {kit.potencia_modulo != null && kit.potencia_modulo > 0 && (
                                <p className="text-[10px] text-muted-foreground">Módulo {kit.potencia_modulo}W</p>
                              )}
                            </div>
                          </div>

                          {kit.potencia_inversor != null && kit.potencia_inversor > 0 && (
                            <div className="flex items-start gap-2 text-xs">
                              <Cpu className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                              <p className="font-medium">Inversor {kit.potencia_inversor}kW</p>
                            </div>
                          )}

                          {/* Technical details */}
                          <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                            {kit.fase && <span>{kit.fase}</span>}
                            {kit.tensao && <span>• {kit.tensao}</span>}
                            {kit.estrutura && <span>• {kit.estrutura}</span>}
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {availBadge}
                            {!!kit.fornecedor_id && kit.source && (
                              <Badge variant="outline" className="text-[10px] bg-info/10 text-info border-info/30">
                                {kit.source.charAt(0).toUpperCase() + kit.source.slice(1)}
                              </Badge>
                            )}
                            {kit.preco_por_kwp != null && kit.preco_por_kwp > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary">
                                {formatBRL(kit.preco_por_kwp)} / kWp
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Footer: price + action */}
                        <div className="border-t border-border/40 pt-3 mt-2 flex items-center justify-between">
                          <div>
                            {kitPrice > 0 && (
                              <p className="text-sm font-bold text-primary">{formatBRL(kitPrice)}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={isSelected ? "outline" : "default"}
                            className={cn("gap-1.5 h-8 text-xs", isSelected && "border-primary text-primary")}
                            disabled={snapshotLoading === kit.id}
                            onClick={(e) => { e.stopPropagation(); handleSelectCatalogKit(kit.id, kit.name); }}
                          >
                            {snapshotLoading === kit.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isSelected ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            {isSelected ? "Selecionado" : "Selecionar"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : tab === "customizado" ? (
            /* ── Customizado Tab — manual kits + imported catalog kits ── */
            <div className="space-y-3">
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
                      isSelected={selectedManualIdx === index}
                      onSelect={() => handleSelectManualKit(entry, index)}
                      onEdit={() => handleEditManualKit(index)}
                      onDelete={() => handleDeleteManualKit(index)}
                    />
                  ))}
                </div>
              )}

              {manualKits.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum kit customizado</p>
                  <p className="text-xs text-muted-foreground/70 mt-1 mb-4">Crie um kit manualmente ou selecione do catálogo</p>
                  <Button size="sm" className="gap-1.5" onClick={() => setShowChoiceModal(true)}>
                    <Plus className="h-3.5 w-3.5" /> Criar kit manualmente
                  </Button>
                </div>
              )}

              {manualKits.length > 0 && (
                <Button variant="default" size="sm" className="gap-1.5 text-xs" onClick={() => setShowChoiceModal(true)}>
                  <Plus className="h-3 w-3" /> Criar outro kit
                </Button>
              )}
            </div>
          ) : tab === "solaryum" ? (
            /* ── Solaryum Tab ── */
            <SolaryumTab
              ibgeCodigo={ibgeCodigo ?? null}
              potenciaKwp={potenciaKwp}
              onSelectKit={(solKit: ProdutoSolaryum) => {
                setSelectedSolaryumKitId(solKit.idProduto);
                const potKwp = solKit.potencia >= 100 ? solKit.potencia / 1000 : solKit.potencia;
                const modComps = (solKit.composicao ?? []).filter(c =>
                  c.idCategoria === 1 || c.categoria?.toLowerCase()?.includes("painel") || c.categoria?.toLowerCase()?.includes("modulo") || c.categoria?.toLowerCase()?.includes("módulo")
                );
                const invComps = (solKit.composicao ?? []).filter(c =>
                  c.idCategoria === 2 || c.categoria?.toLowerCase()?.includes("inversor")
                );
                const newItens: KitItemRow[] = [];
                if (modComps.length > 0) {
                  modComps.forEach(c => {
                    newItens.push({
                      id: crypto.randomUUID(), descricao: c.descricao || "Módulo",
                      fabricante: c.marca || solKit.marcaPainel || "", modelo: c.descricao || "",
                      potencia_w: c.potencia || 0, quantidade: c.qtd || 1,
                      preco_unitario: 0, categoria: "modulo", avulso: false,
                    });
                  });
                } else {
                  newItens.push({
                    id: crypto.randomUUID(), descricao: solKit.descricao || "Módulo Solar",
                    fabricante: solKit.marcaPainel || "", modelo: solKit.descricao || "",
                    potencia_w: potKwp * 1000, quantidade: 1,
                    preco_unitario: 0, categoria: "modulo", avulso: false,
                  });
                }
                if (invComps.length > 0) {
                  invComps.forEach(c => {
                    newItens.push({
                      id: crypto.randomUUID(), descricao: c.descricao || "Inversor",
                      fabricante: c.marca || solKit.marcaInversor || "", modelo: c.descricao || "",
                      potencia_w: c.potencia || 0, quantidade: c.qtd || 1,
                      preco_unitario: 0, categoria: "inversor", avulso: false,
                    });
                  });
                }
                const totalPot = newItens.reduce((s, i) => s + i.potencia_w * i.quantidade, 0);
                if (totalPot > 0 && solKit.precoVenda > 0) {
                  newItens.forEach(i => {
                    i.preco_unitario = Math.round(((i.potencia_w * i.quantidade) / totalPot * solKit.precoVenda / i.quantidade) * 100) / 100;
                  });
                }
                onItensChange(newItens);
                const card = kitItemsToCardData(newItens);
                if (card) {
                  card.precoTotal = solKit.precoVenda;
                  card.distribuidorNome = "Solaryum";
                  const meta: KitMeta = {
                    distribuidorNome: "Solaryum",
                    nomeKit: solKit.descricao || "Kit Solaryum",
                    codigoKit: String(solKit.idProduto),
                    topologia: solKit.tipoInv === 1 ? "Microinversor" : solKit.tipoInv === 2 ? "Híbrido" : "Tradicional",
                    custo: solKit.precoVenda,
                  };
                  setManualKits([{ card, itens: newItens, meta }]);
                }
                toast({ title: "Kit Solaryum selecionado", description: `${potKwp.toFixed(2)} kWp • ${formatBRL(solKit.precoVenda)}` });
              }}
              selectedKitId={selectedSolaryumKitId}
            />
          ) : (
            /* ── Fechado Tab ── */
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
                <p className="text-sm font-medium text-muted-foreground">Nenhum kit fechado encontrado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou selecione do catálogo</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Choice Modal: equipamentos vs zero */}
      <Dialog open={showChoiceModal} onOpenChange={setShowChoiceModal}>
        <DialogContent className="w-[90vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base text-center">Escolha uma opção para prosseguir</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <Button
              variant="default"
              onClick={() => { setShowChoiceModal(false); setManualMode("equipamentos"); }}
              className="h-auto min-h-[120px] flex flex-col items-center justify-center gap-3 p-6 rounded-xl transition-all text-center border-2 border-primary bg-primary text-primary-foreground"
            >
              <div className="h-12 w-12 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                <Package className="h-6 w-6" />
              </div>
              <p className="text-sm leading-tight whitespace-normal">
                Criar a partir de <strong>equipamentos disponíveis</strong> nos distribuidores
              </p>
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowChoiceModal(false); setManualMode("zero"); }}
              className="h-auto min-h-[120px] flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-primary text-primary hover:bg-primary/10 transition-all text-center"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Settings2 className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm leading-tight whitespace-normal">
                <strong>Criar do zero,</strong> informando o nome dos equipamentos e distribuidores
              </p>
            </Button>
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
          baterias={baterias}
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
        kits={currentKitCards}
        onSave={(selected) => {
          // Preserve existing prices from current itens
          const existingModPrice = itens.find(i => i.categoria === "modulo")?.preco_unitario || 0;
          const existingInvPrice = itens.find(i => i.categoria === "inversor")?.preco_unitario || 0;
          const newItens: KitItemRow[] = selected.flatMap(({ kit, quantidade }) => {
            // Distribute precoTotal proportionally if available
            const totalPreco = kit.precoTotal || 0;
            const moduloQtd = kit.moduloQtd * quantidade;
            const inversorQtd = kit.inversorQtd * quantidade;
            const moduloPotW = kit.moduloPotenciaKwp * 1000;
            const inversorPotW = kit.inversorPotenciaKw * 1000 * kit.inversorQtd;
            const totalWeight = moduloPotW + inversorPotW;

            const moduloPreco = totalPreco > 0 && totalWeight > 0
              ? Math.round((moduloPotW / totalWeight * totalPreco / moduloQtd) * 100) / 100
              : existingModPrice;
            const inversorPreco = totalPreco > 0 && totalWeight > 0
              ? Math.round(((totalPreco - moduloPreco * moduloQtd) / inversorQtd) * 100) / 100
              : existingInvPrice;

            return [
              {
                id: crypto.randomUUID(), descricao: `${moduloQtd}x ${kit.moduloDescricao}`,
                fabricante: kit.distribuidorNome, modelo: kit.moduloDescricao, potencia_w: (kit.moduloPotenciaKwp * 1000) / kit.moduloQtd,
                quantidade: moduloQtd, preco_unitario: moduloPreco, categoria: "modulo" as const, avulso: false,
              },
              {
                id: crypto.randomUUID(), descricao: `${inversorQtd}x ${kit.inversorDescricao}`,
                fabricante: kit.distribuidorNome, modelo: kit.inversorDescricao, potencia_w: kit.inversorPotenciaKw * 1000,
                quantidade: inversorQtd, preco_unitario: inversorPreco, categoria: "inversor" as const, avulso: false,
              },
            ];
          });
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
        mpptCount={(() => {
          const allItens = itens.length > 0 ? itens : manualKits.flatMap(k => k.itens);
          const invItens = allItens.filter(i => i.categoria === "inversor");
          // Sum up quantities of inverters as proxy for string count
          return invItens.reduce((s, i) => s + i.quantidade, 0) || 1;
        })()}
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
          irradiacao={irradiacao}
          latitude={latitude}
          ghiSeries={ghiSeries}
          somenteGhi={somenteGhi}
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

function ManualKitCard({ entry, viewMode, isSelected, onSelect, onEdit, onDelete }: {
  entry: { card: KitCardData; itens: KitItemRow[]; meta?: KitMeta };
  viewMode: "grid" | "list";
  isSelected?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { card, meta } = entry;
  const originSource = meta?.source;

  if (viewMode === "list") {
    return (
      <div className={cn(
        "flex items-center gap-4 p-4 rounded-xl border-2 transition-all bg-card",
        isSelected
          ? "border-primary shadow-md ring-2 ring-primary/20"
          : "border-border/40 hover:border-primary/30"
      )}>
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
          <Button
            size="sm"
            variant={isSelected ? "outline" : "default"}
            className={cn("gap-1 h-8 text-xs", isSelected && "border-primary text-primary")}
            onClick={onSelect}
          >
            {isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {isSelected ? "Selecionado" : "Selecionar"}
          </Button>
        </div>
      </div>
    );
  }

  // Grid card (similar to reference screenshot)
  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-card p-4 hover:shadow-md transition-all flex flex-col justify-between h-auto cursor-pointer relative",
        isSelected
          ? "border-primary shadow-md ring-2 ring-primary/20"
          : "border-border/40 hover:border-primary/30"
      )}
      onClick={onSelect}
    >
      {/* Selected badge */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
            <Check className="h-3 w-3" /> Selecionado
          </Badge>
        </div>
      )}
      {/* Distributor header */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              {card.distribuidorNome || "Manual"}
            </span>
            {originSource && (
              <Badge variant="outline" className="text-[9px] bg-info/10 text-info border-info/30">
                {originSource.charAt(0).toUpperCase() + originSource.slice(1)}
              </Badge>
            )}
          </div>
          {!isSelected && <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">KIT</span>}
        </div>

        {/* Module info */}
        <div className="flex items-start gap-2 mb-1.5">
          <Sun className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">{card.moduloQtd}x {card.moduloDescricao}</p>
            <p className="text-[10px] text-muted-foreground">Total {card.moduloPotenciaKwp.toFixed(2)} kWp</p>
          </div>
        </div>

        {/* Inverter info */}
        <div className="flex items-start gap-2 mb-3">
          <Cpu className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
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

const MONTH_LABELS: Record<string, string> = {
  jan: "Janeiro",
  fev: "Fevereiro",
  mar: "Março",
  abr: "Abril",
  mai: "Maio",
  jun: "Junho",
  jul: "Julho",
  ago: "Agosto",
  set: "Setembro",
  out: "Outubro",
  nov: "Novembro",
  dez: "Dezembro",
};

function PremissasModal({ open, onOpenChange, pd, setPd, activeTab, onTabChange, consumoTotal, irradiacao, latitude, ghiSeries, somenteGhi }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pd: PreDimensionamentoData;
  setPd: (pd: PreDimensionamentoData) => void;
  activeTab: "fator" | "sistema";
  onTabChange: (t: "fator" | "sistema") => void;
  consumoTotal: number;
  irradiacao?: number;
  latitude?: number | null;
  ghiSeries?: Record<string, number> | null;
  somenteGhi?: boolean;
}) {
  const pdRef = useRef(pd);
  pdRef.current = pd;
  const [topoMesAMes, setTopoMesAMes] = useState<{ open: boolean; topo: string }>({ open: false, topo: "tradicional" });

  // Store base desempenho (without shading) for sombreamento recalc
  const [baseDesempenho] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    for (const topo of ["tradicional", "microinversor", "otimizador"]) {
      const cfg = pd.topologia_configs?.[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo];
      base[topo] = cfg.desempenho;
    }
    return base;
  });

  // In PremissasModal, ALWAYS use POA transposition when latitude is available.
  // The user is explicitly setting tilt/azimuth here, so these must affect the result.
  // somente_ghi: false is safe — calcEffectiveIrrad falls back to GHI if latitude is null.
  const effectiveSomenteGhi = false;

  // Compute effective irradiance for fator_geracao calc
  const effectiveIrrad = useMemo(() => {
    if (!irradiacao || irradiacao <= 0) return 0;
    return calcEffectiveIrrad({
      ghiSeries: ghiSeries as Record<string, number> | null | undefined,
      ghiMediaAnual: irradiacao,
      latitude,
      tilt_deg: pd.inclinacao ?? 10,
      azimuth_deviation_deg: pd.desvio_azimutal ?? 0,
      somente_ghi: effectiveSomenteGhi,
    });
  }, [irradiacao, latitude, ghiSeries, pd.inclinacao, pd.desvio_azimutal]);

  // Recalculate fator_geracao via SSOT service when tilt/azimuth change
  const recalcFatorGeracao = useCallback((updatedPd: PreDimensionamentoData) => {
    if (!irradiacao || irradiacao <= 0) return updatedPd;

    const configs = { ...updatedPd.topologia_configs };
    for (const topo of ["tradicional", "microinversor", "otimizador"]) {
      const cfg = configs[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo];
      const newFator = calcFatorGeracao({
        ghiSeries: ghiSeries as Record<string, number> | null | undefined,
        ghiMediaAnual: irradiacao,
        latitude,
        tilt_deg: updatedPd.inclinacao ?? 10,
        azimuth_deviation_deg: updatedPd.desvio_azimutal ?? 0,
        desempenho: cfg.desempenho,
        somente_ghi: effectiveSomenteGhi,
      });
      configs[topo] = { ...cfg, fator_geracao: newFator };
    }

    return {
      ...updatedPd,
      topologia_configs: configs,
      fator_geracao: configs.tradicional?.fator_geracao ?? updatedPd.fator_geracao,
    };
  }, [irradiacao, latitude, ghiSeries]);

  // Apply sombreamento: adjusts desempenho per topology, then recalculates fator_geracao
  const applySombreamento = useCallback((sombreamentoLevel: string, currentPd: PreDimensionamentoData) => {
    const sombConfig: SombreamentoConfig = currentPd.sombreamento_config || DEFAULT_SOMBREAMENTO_CONFIG;
    const levelKey = sombreamentoLevel === "Pouco" ? "pouco" : sombreamentoLevel === "Médio" ? "medio" : sombreamentoLevel === "Alto" ? "alto" : null;

    const configs = { ...currentPd.topologia_configs };
    for (const topo of ["tradicional", "microinversor", "otimizador"]) {
      const baseD = baseDesempenho[topo] || (configs[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo]).desempenho;
      const lossPct = levelKey ? (sombConfig[levelKey] as any)?.[topo] ?? 0 : 0;
      const factor = 1 - lossPct / 100;
      const adjustedDesempenho = Math.round(baseD * factor * 100) / 100;
      const adjustedFatorGeracao = effectiveIrrad > 0
        ? Math.round(effectiveIrrad * 30 * (adjustedDesempenho / 100) * 100) / 100
        : Math.round((configs[topo]?.fator_geracao || DEFAULT_TOPOLOGIA_CONFIGS[topo].fator_geracao) * factor * 100) / 100;
      configs[topo] = {
        ...(configs[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo]),
        desempenho: adjustedDesempenho,
        fator_geracao: adjustedFatorGeracao,
      };
    }

    const updated: PreDimensionamentoData = {
      ...currentPd,
      sombreamento: sombreamentoLevel,
      topologia_configs: configs,
      desempenho: configs.tradicional?.desempenho ?? currentPd.desempenho,
      fator_geracao: configs.tradicional?.fator_geracao ?? currentPd.fator_geracao,
    };
    setPd(updated);
  }, [baseDesempenho, effectiveIrrad, setPd]);

  const pdUpdate = <K extends keyof PreDimensionamentoData>(field: K, value: PreDimensionamentoData[K]) => {
    if (field === "sombreamento") {
      applySombreamento(value as string, pdRef.current);
      return;
    }
    let updated = { ...pdRef.current, [field]: value };
    if (field === "inclinacao" || field === "desvio_azimutal") {
      updated = recalcFatorGeracao(updated);
    }
    setPd(updated);
  };

  const getTopoConfig = (topo: string): TopologiaConfig => {
    return pd.topologia_configs?.[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo] || DEFAULT_TOPOLOGIA_CONFIGS.tradicional;
  };

  const updateTopoConfig = (topo: string, field: keyof TopologiaConfig, value: any) => {
    const configs = { ...pd.topologia_configs };
    configs[topo] = { ...(configs[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo]), [field]: value };

    // When desempenho changes, recalculate fator_geracao (match StepConsumptionIntelligence behavior)
    if (field === "desempenho" && irradiacao && irradiacao > 0) {
      const newDesempenho = value as number;
      const newFator = calcFatorGeracao({
        ghiSeries: ghiSeries as Record<string, number> | null | undefined,
        ghiMediaAnual: irradiacao,
        latitude,
        tilt_deg: pd.inclinacao ?? 10,
        azimuth_deviation_deg: pd.desvio_azimutal ?? 0,
        desempenho: newDesempenho,
        somente_ghi: effectiveSomenteGhi,
      });
      configs[topo] = { ...configs[topo], fator_geracao: newFator };
    }

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
      <DialogContent className="w-[90vw] max-w-3xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">Premissas</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-border shrink-0">
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

        <div className="flex-1 min-h-0 overflow-y-auto">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allTopos.map(topo => {
                const cfg = getTopoConfig(topo);
                const potIdeal = potenciaIdealByTopo[topo] || 0;
                const isActive = (pd.topologias || []).includes(topo);
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
                        <Button variant="link" onClick={() => setTopoMesAMes({ open: true, topo })} className="text-[10px] text-secondary hover:underline flex items-center gap-0.5 h-auto p-0">mês a mês <Pencil className="h-2.5 w-2.5" /></Button>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button size="sm" onClick={() => onOpenChange(false)} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">Salvar</Button>
        </div>

        <MesAMesDialog
          open={topoMesAMes.open}
          onOpenChange={o => setTopoMesAMes({ ...topoMesAMes, open: o })}
          title={`Fator de Geração — ${TOPOLOGIA_LABELS[topoMesAMes.topo] || topoMesAMes.topo}`}
          values={(() => {
            const cfg = getTopoConfig(topoMesAMes.topo);
            const meses = cfg.fator_geracao_meses || {};
            const hasValues = Object.values(meses).some(v => Number(v) > 0);
            if (!hasValues && cfg.fator_geracao > 0) {
              const PESOS_IRRADIACAO = [1.23, 1.27, 1.06, 0.92, 0.77, 0.73, 0.76, 0.92, 1.0, 1.06, 1.03, 1.21];
              const soma = PESOS_IRRADIACAO.reduce((a, b) => a + b, 0);
              const norm = PESOS_IRRADIACAO.map(p => p * 12 / soma);
              return Object.fromEntries(MESES.map((m, i) => [m, Math.round(cfg.fator_geracao * norm[i] * 100) / 100]));
            }
            return meses;
          })()}
          onSave={(values) => {
            const vals = Object.values(values).map(v => Number(v)).filter(v => v > 0);
            const media = vals.length > 0
              ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
              : getTopoConfig(topoMesAMes.topo).fator_geracao;
            updateTopoConfig(topoMesAMes.topo, "fator_geracao_meses", values);
            updateTopoConfig(topoMesAMes.topo, "fator_geracao", media);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
