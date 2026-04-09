import { formatBRLCompact as formatBRL } from "@/lib/formatters";
import { useState, useCallback, useEffect, useMemo } from "react";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, DollarSign, User, ChevronDown, Zap, GripVertical, MoreVertical, ArrowUpDown, SortAsc, SortDesc, Calendar, Type } from "lucide-react";
import type { DealKanbanCard, OwnerColumn } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { StageDealCard } from "./StageDealCard";

type SortOption = "default" | "nome_asc" | "nome_desc" | "valor_desc" | "valor_asc" | "data_desc" | "data_asc";

function sortDeals(deals: DealKanbanCard[], sort: SortOption): DealKanbanCard[] {
  if (sort === "default") return deals;
  const sorted = [...deals];
  switch (sort) {
    case "nome_asc": return sorted.sort((a, b) => (a.customer_name || "").localeCompare(b.customer_name || ""));
    case "nome_desc": return sorted.sort((a, b) => (b.customer_name || "").localeCompare(a.customer_name || ""));
    case "valor_desc": return sorted.sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0));
    case "valor_asc": return sorted.sort((a, b) => (a.deal_value || 0) - (b.deal_value || 0));
    case "data_desc": return sorted.sort((a, b) => new Date(b.last_stage_change).getTime() - new Date(a.last_stage_change).getTime());
    case "data_asc": return sorted.sort((a, b) => new Date(a.last_stage_change).getTime() - new Date(b.last_stage_change).getTime());
    default: return sorted;
  }
}

const SORT_LABELS: Record<SortOption, string> = {
  default: "Padrão",
  nome_asc: "Nome A→Z",
  nome_desc: "Nome Z→A",
  valor_desc: "Maior valor",
  valor_asc: "Menor valor",
  data_desc: "Mais recente",
  data_asc: "Mais antigo",
};

interface DynamicEtiqueta {
  id: string;
  nome: string;
  cor: string;
  grupo: string;
  short: string | null;
  icon: string | null;
}

interface Props {
  ownerColumns: OwnerColumn[];
  allDeals: DealKanbanCard[];
  onViewProjeto?: (deal: DealKanbanCard) => void;
  onViewProjetoTab?: (deal: DealKanbanCard, tab: string) => void;
  onNewProject?: (consultorId: string) => void;
  onMoveDealToOwner?: (dealId: string, ownerId: string) => void;
  dynamicEtiquetas?: DynamicEtiqueta[];
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

import { formatKwp as _formatKwp } from "@/lib/formatters/index";
const formatKwp = (v: number) => {
  if (!v) return null;
  return _formatKwp(v, 1);
};

const COLUMN_ORDER_KEY = "kanban_consultor_order";

function loadColumnOrder(): string[] {
  try {
    const stored = localStorage.getItem(COLUMN_ORDER_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveColumnOrder(order: string[]) {
  try {
    localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order));
  } catch { /* ignore */ }
}

function sortColumnsByOrder(columns: OwnerColumn[], order: string[]): OwnerColumn[] {
  if (order.length === 0) return columns;
  const orderMap = new Map(order.map((id, idx) => [id, idx]));
  return [...columns].sort((a, b) => {
    const aIdx = orderMap.get(a.id) ?? 9999;
    const bIdx = orderMap.get(b.id) ?? 9999;
    return aIdx - bIdx;
  });
}

const INITIAL_CARDS = 8;

function ProgressiveCardList({
  deals, draggedId, onDragStart, onViewProjeto, onViewProjetoTab, dynamicEtiquetas,
}: {
  deals: DealKanbanCard[];
  draggedId: string | null;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onViewProjeto?: (deal: DealKanbanCard) => void;
  onViewProjetoTab?: (deal: DealKanbanCard, tab: string) => void;
  dynamicEtiquetas: DynamicEtiqueta[];
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? deals : deals.slice(0, INITIAL_CARDS);
  const remaining = deals.length - INITIAL_CARDS;

  return (
    <div className="flex-1 min-h-0 px-2 pb-2 space-y-0 overflow-y-auto divide-y divide-border/40" style={{ maxHeight: "calc(100vh - 340px)" }}>
      {deals.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/40 italic text-center py-6">Nenhum projeto</p>
      ) : (
        <>
          {visible.map(deal => (
            <div key={deal.deal_id} className="py-1.5">
              <StageDealCard
                deal={deal}
                isDragging={draggedId === deal.deal_id}
                onDragStart={e => onDragStart(e, deal.deal_id)}
                onClick={() => onViewProjeto?.(deal)}
                onProposalClick={() => onViewProjetoTab?.(deal, "propostas")}
                dynamicEtiquetas={dynamicEtiquetas}
              />
            </div>
          ))}
          {!showAll && remaining > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-2 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Mostrar mais {remaining} projetos
            </button>
          )}
        </>
      )}
    </div>
  );
}


  const isMobile = useIsMobile();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [columnSorts, setColumnSorts] = useState<Record<string, SortOption>>({});

  const setColumnSort = (colId: string, sort: SortOption) => {
    setColumnSorts(prev => ({ ...prev, [colId]: sort }));
  };

  // Column reorder state
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColReorder, setDragOverColReorder] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>(loadColumnOrder);

  // Apply stored order to columns
  const sortedColumns = sortColumnsByOrder(ownerColumns, columnOrder);

  // Persist order when columns change (new consultores added)
  useEffect(() => {
    const currentIds = ownerColumns.map(c => c.id);
    const storedOrder = loadColumnOrder();
    const newIds = currentIds.filter(id => !storedOrder.includes(id));
    if (newIds.length > 0) {
      const merged = [...storedOrder.filter(id => currentIds.includes(id)), ...newIds];
      setColumnOrder(merged);
      saveColumnOrder(merged);
    }
  }, [ownerColumns]);

  // Deal drag (move deal between consultors)
  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedId(dealId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", "deal");
  };

  const handleDrop = (e: React.DragEvent, ownerId: string) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");
    if (type === "column" && draggedColId) {
      // Column reorder
      handleColumnDrop(ownerId);
    } else if (draggedId) {
      onMoveDealToOwner?.(draggedId, ownerId);
    }
    setDraggedId(null);
    setDragOverCol(null);
    setDraggedColId(null);
    setDragOverColReorder(null);
  };

  // Column drag (reorder columns)
  const handleColumnDragStart = (e: React.DragEvent, colId: string) => {
    e.stopPropagation();
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", "column");
  };

  const handleColumnDrop = useCallback((targetColId: string) => {
    if (!draggedColId || draggedColId === targetColId) return;
    const currentOrder = sortedColumns.map(c => c.id);
    const fromIdx = currentOrder.indexOf(draggedColId);
    const toIdx = currentOrder.indexOf(targetColId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedColId);
    setColumnOrder(newOrder);
    saveColumnOrder(newOrder);
  }, [draggedColId, sortedColumns]);

  if (ownerColumns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <User className="h-8 w-8 mb-2 opacity-40" />
        <p className="font-medium">Nenhum consultor ativo</p>
        <p className="text-sm mt-1">Cadastre consultores para visualizar por consultor.</p>
      </div>
    );
  }

  const isOrphanColumn = (colId: string) => colId === "__sem_atribuicao__";

  // ── Mobile ──
  if (isMobile) {
    return (
      <div className="space-y-2 px-1">
        {sortedColumns.map(col => {
          const totalKwp = col.deals.reduce((s, d) => s + (d.deal_kwp || 0), 0);
          return (
            <Collapsible key={col.id} defaultOpen={col.count > 0}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors h-auto">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-6 w-6 border border-primary/30">
                      <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                        {getInitials(col.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-sm font-bold text-foreground truncate">{col.nome}</h3>
                    <Badge variant="outline" className="text-[10px] h-5 font-semibold rounded-lg">
                      {col.count}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono font-semibold text-success">{formatBRL(col.totalValor)}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 pt-2 pb-1">
                  {col.deals.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 italic text-center py-4">Nenhum projeto</p>
                  ) : (
                    col.deals.map(deal => (
                      <StageDealCard
                        key={deal.deal_id}
                        deal={deal}
                        isDragging={false}
                        onDragStart={() => {}}
                        onClick={() => onViewProjeto?.(deal)}
                        onProposalClick={() => onViewProjetoTab?.(deal, "propostas")}
                        dynamicEtiquetas={dynamicEtiquetas}
                      />
                    ))
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs font-medium border-dashed border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => onNewProject?.(col.id)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Novo projeto
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  }

  // ── Desktop ──
  return (
    <div className="w-full max-w-full overflow-x-auto">
      <div
        className="grid gap-3 pb-4 px-1"
        style={{
          gridTemplateColumns: `repeat(${sortedColumns.length}, minmax(220px, 1fr))`,
          minWidth: sortedColumns.length > 4 ? `${sortedColumns.length * 230}px` : undefined,
        }}
      >
        {sortedColumns.map(col => {
          const isOver = dragOverCol === col.id;
          const isColDragging = draggedColId === col.id;
          const isColOver = dragOverColReorder === col.id && draggedColId !== col.id;
          const totalKwp = col.deals.reduce((s, d) => s + (d.deal_kwp || 0), 0);
          const kwpStr = formatKwp(totalKwp);

          return (
            <div
              key={col.id}
              className={cn(
                "rounded-xl border border-border/50 transition-all flex flex-col min-w-0",
                "bg-card/60",
                isOver && "ring-2 ring-primary/30 bg-primary/5",
                isColDragging && "opacity-50 scale-95",
                isColOver && "ring-2 ring-warning/50 border-warning/40"
              )}
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (draggedColId) {
                  setDragOverColReorder(col.id);
                } else {
                  setDragOverCol(col.id);
                }
              }}
              onDragLeave={() => { setDragOverCol(null); setDragOverColReorder(null); }}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Header */}
              <div
                className={cn(
                  "px-3 pt-3 pb-2 border-b-2 cursor-grab active:cursor-grabbing",
                  isOrphanColumn(col.id) ? "border-warning/40" : "border-primary/20"
                )}
                draggable={!isOrphanColumn(col.id)}
                onDragStart={e => handleColumnDragStart(e, col.id)}
                onDragEnd={() => { setDraggedColId(null); setDragOverColReorder(null); }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {!isOrphanColumn(col.id) && (
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  )}
                  <Avatar className={cn("h-6 w-6 border", isOrphanColumn(col.id) ? "border-warning/30" : "border-primary/30")}>
                    <AvatarFallback className={cn("text-[9px] font-bold", isOrphanColumn(col.id) ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}>
                      {isOrphanColumn(col.id) ? "?" : getInitials(col.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className={cn("text-[11px] font-bold leading-tight truncate uppercase tracking-wider", isOrphanColumn(col.id) ? "text-warning" : "text-secondary")}>
                    {col.nome}
                  </h3>
                </div>
                <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5 font-bold text-[11px] font-mono text-success">
                    <DollarSign className="h-3 w-3" />
                    {formatBRL(col.totalValor)}
                  </span>
                  {kwpStr && (
                    <span className="flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground">
                      <Zap className="h-3 w-3" />
                      {kwpStr}
                    </span>
                  )}
                  <Badge variant="secondary" className={cn("text-[9px] h-4 px-1.5 font-bold ml-auto rounded-full border-0", isOrphanColumn(col.id) ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}>
                    {col.count}
                  </Badge>

                  {/* Sort Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Ordenar por</DropdownMenuLabel>
                      {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                        <DropdownMenuItem
                          key={key}
                          className={cn("text-xs", columnSorts[col.id] === key && "font-bold text-primary")}
                          onClick={() => setColumnSort(col.id, key)}
                        >
                          {key.includes("nome") ? <Type className="h-3 w-3 mr-2" /> :
                           key.includes("valor") ? <DollarSign className="h-3 w-3 mr-2" /> :
                           key.includes("data") ? <Calendar className="h-3 w-3 mr-2" /> :
                           <ArrowUpDown className="h-3 w-3 mr-2" />}
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* New Project Button - hide for orphan column */}
              {!isOrphanColumn(col.id) && (
                <div className="px-2.5 py-1.5">
                  <Button
                    variant="outline"
                    onClick={() => onNewProject?.(col.id)}
                    className="w-full h-7 rounded-lg border-dashed border-primary/40 text-[10px] font-semibold text-primary hover:bg-primary/5 hover:border-primary transition-all duration-200"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Novo projeto
                  </Button>
                </div>
              )}

              {/* Cards — progressive rendering for performance */}
              <ProgressiveCardList
                deals={sortDeals(col.deals, columnSorts[col.id] || "default")}
                draggedId={draggedId}
                onDragStart={handleDragStart}
                onViewProjeto={onViewProjeto}
                onViewProjetoTab={onViewProjetoTab}
                dynamicEtiquetas={dynamicEtiquetas}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
