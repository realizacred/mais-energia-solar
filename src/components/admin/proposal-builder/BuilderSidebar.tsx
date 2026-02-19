/**
 * Builder Sidebar — Widget Toolbox with collapsible categories
 */

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Search, LayoutTemplate, Columns3, LayoutGrid, AlignLeft, ImageIcon, Play, RectangleHorizontal, Minus, GalleryHorizontal, ListCollapse, PanelTop, User, FileText, MapPin, Zap, Sun, Cable, Battery, Building, BarChart3, DollarSign, TrendingUp, Clock, Phone, Calendar, PiggyBank, Table2 } from "lucide-react";
import { WIDGET_CATEGORIES, WIDGET_REGISTRY } from "./widgetRegistry";
import type { WidgetRegistryEntry, BlockType, ProposalType, TemplateBlock } from "./types";
import { generateBlockId } from "./treeUtils";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutTemplate, Columns3, LayoutGrid, AlignLeft, ImageIcon, Play,
  RectangleHorizontal, Minus, GalleryHorizontal, ListCollapse, PanelTop,
  User, FileText, MapPin, Zap, Sun, Cable, Battery, Building, BarChart3,
  DollarSign, TrendingUp, Clock, Phone, Calendar, PiggyBank, Table2,
};

// System widgets (solar domain)
const SYSTEM_WIDGETS: WidgetRegistryEntry[] = [
  { key: "editor" as BlockType, label: "Dados do Cliente", icon: "User", category: "system", defaultBlock: { type: "editor", content: "<p>[nome_cliente]</p>", isVisible: true }, allowedParents: ["column", "inner_section"], requiredVariables: ["nome_cliente"] },
  { key: "editor" as BlockType, label: "Dados da Proposta", icon: "FileText", category: "system", defaultBlock: { type: "editor", content: "<p>Proposta [numero_proposta]</p>", isVisible: true }, allowedParents: ["column", "inner_section"], requiredVariables: ["numero_proposta"] },
  { key: "editor" as BlockType, label: "Localização", icon: "MapPin", category: "system", defaultBlock: { type: "editor", content: "<p>[endereco_completo]</p>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Consumo de Energia", icon: "Zap", category: "system", defaultBlock: { type: "editor", content: "<p>Consumo: [consumo_medio] kWh/mês</p>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Painéis Solares", icon: "Sun", category: "system", defaultBlock: { type: "editor", content: "<p>[qtde_modulos]x [modelo_modulo]</p>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Inversor On-Grid", icon: "Cable", category: "system", defaultBlock: { type: "editor", content: "<p>[modelo_inversor]</p>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Inversor Híbrido", icon: "Cable", category: "system", defaultBlock: { type: "editor", content: "<p>[modelo_inversor_hibrido]</p>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Banco de Baterias", icon: "Battery", category: "system", defaultBlock: { type: "editor", content: "<p>[modelo_bateria]</p>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Estrutura", icon: "Building", category: "system", defaultBlock: { type: "editor", content: "<p>[tipo_estrutura]</p>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Geração Mensal - Gráfico", icon: "BarChart3", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='chart-geracao-mensal'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Geração Mensal - Tabela", icon: "Table2", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='table-geracao-mensal'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Perfil de Consumo - Gráfico", icon: "BarChart3", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='chart-perfil-consumo'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Gráfico de Utilização", icon: "Zap", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='chart-utilizacao'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Consumo Hora a Hora - Tabela", icon: "Clock", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='table-consumo-hora'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Investimento", icon: "DollarSign", category: "system", defaultBlock: { type: "editor", content: "<p>Investimento: [valor_total]</p>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Condições de Pagamento", icon: "PiggyBank", category: "system", defaultBlock: { type: "editor", content: "<p>[condicoes_pagamento]</p>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Análise Financeira - Gráfico", icon: "TrendingUp", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='chart-analise-financeira'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Análise Financeira - Tabela", icon: "Table2", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='table-analise-financeira'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Timeline do Projeto", icon: "Calendar", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='timeline-projeto'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Próximos Passos", icon: "Phone", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='proximos-passos'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Horários Tarifa Branca", icon: "Clock", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='horarios-tarifa-branca'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Comparativo de Tarifas", icon: "DollarSign", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='comparativo-tarifas'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Comparativo Financeiro", icon: "TrendingUp", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='comparativo-financeiro'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Tabela Economia Detalhada", icon: "Table2", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='tabela-economia-detalhada'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
  { key: "editor" as BlockType, label: "Economia Total (25 Anos)", icon: "PiggyBank", category: "system", defaultBlock: { type: "editor", content: "<div data-widget='economia-total-25anos'></div>", isVisible: true }, allowedParents: ["column", "inner_section"] },
];

interface BuilderSidebarProps {
  proposalType: ProposalType;
  onAddBlock: (block: TemplateBlock, parentId: string | null) => void;
}

export function BuilderSidebar({ proposalType, onAddBlock }: BuilderSidebarProps) {
  const [search, setSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    layout: true,
    basic: true,
    advanced: false,
    system: false,
  });

  const allWidgets = useMemo(() => {
    return [...WIDGET_REGISTRY, ...SYSTEM_WIDGETS];
  }, []);

  const filteredWidgets = useMemo(() => {
    if (!search.trim()) return allWidgets;
    const q = search.toLowerCase();
    return allWidgets.filter(w => w.label.toLowerCase().includes(q));
  }, [allWidgets, search]);

  const handleDragStart = (e: React.DragEvent, widget: WidgetRegistryEntry) => {
    const block: TemplateBlock = {
      id: generateBlockId(widget.key),
      type: widget.defaultBlock.type || widget.key,
      content: widget.defaultBlock.content || "",
      style: (widget.defaultBlock.style || {}) as any,
      isVisible: true,
      parentId: null,
      order: 0,
      _proposalType: proposalType,
    };
    e.dataTransfer.setData("application/json", JSON.stringify(block));
    e.dataTransfer.effectAllowed = "copy";
  };

  const toggleCategory = (key: string) => {
    setOpenCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getIcon = (iconName: string) => {
    const IconComp = ICON_MAP[iconName];
    return IconComp ? <IconComp className="h-5 w-5 text-muted-foreground" /> : null;
  };

  return (
    <div className="w-[260px] border-r border-border bg-card flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar widget..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Widget List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {WIDGET_CATEGORIES.map(cat => {
            const widgets = filteredWidgets.filter(w => w.category === cat.key);
            if (widgets.length === 0) return null;

            return (
              <Collapsible
                key={cat.key}
                open={search.trim() ? true : openCategories[cat.key]}
                onOpenChange={() => !search.trim() && toggleCategory(cat.key)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                  <span>{cat.label}</span>
                  <ChevronDown className={cn("h-3 w-3 transition-transform", openCategories[cat.key] ? "" : "-rotate-90")} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 gap-1.5 px-1 pb-2">
                    {widgets.map((w, i) => (
                      <button
                        key={`${w.key}-${w.label}-${i}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, w)}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-border/50 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all cursor-grab active:cursor-grabbing text-center group"
                      >
                        {getIcon(w.icon)}
                        <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground leading-tight">
                          {w.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
