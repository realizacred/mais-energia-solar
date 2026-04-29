import { Button } from "@/components/ui/button";
import { formatBRLCompact as formatBRL } from "@/lib/formatters";
import { getEtiquetaConfig } from "@/lib/etiquetas";
import { useState, useEffect, useRef } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Zap, Plus, LayoutGrid, Phone, DollarSign } from "lucide-react";
import type { OwnerColumn, DealKanbanCard } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const INITIAL_OWNER_CARDS = 50;
const OWNER_CARDS_INCREMENT = 50;

interface Props {
  columns: OwnerColumn[];
  onMoveProjeto: (dealId: string, ownerId: string) => void;
  onViewProjeto?: (deal: DealKanbanCard) => void;
  onCreateProjeto?: (ownerId: string) => void;
}

const formatKwp = (v: number) => {
  if (!v) return "0";
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(".", ",")}`;
  return v.toFixed(2).replace(".", ",");
};

export function ProjetoKanbanOwner({ columns, onMoveProjeto, onViewProjeto, onCreateProjeto }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedId(dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
  };

  const handleDragLeave = () => setDragOverCol(null);

  const handleDrop = (e: React.DragEvent, ownerId: string) => {
    e.preventDefault();
    if (draggedId) {
      onMoveProjeto(draggedId, ownerId);
      setDraggedId(null);
      setDragOverCol(null);
    }
  };

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="font-medium">Nenhum consultor com projetos</p>
        <p className="text-sm mt-1">Crie um projeto para começar.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full max-w-full">
      <div className="flex gap-3 pb-4 px-1" style={{ minWidth: "min-content", width: "100%" }}>
        {columns.map(col => {
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className={cn(
                "rounded-xl border border-border/60 transition-all flex flex-col",
                "bg-card",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              style={{ flex: "1 0 240px", minWidth: 240, maxWidth: 400, boxShadow: "var(--shadow-sm)" }}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Column Header */}
              <div className="px-4 pt-4 pb-3 border-b border-border/40">
                <h3 className="text-sm font-bold text-foreground leading-tight tracking-tight">
                  {col.nome}
                </h3>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground text-[13px]">
                    {formatBRL(col.totalValor)}
                  </span>
                  {col.totalKwp > 0 && (
                    <span className="flex items-center gap-0.5 font-medium">
                      <Zap className="h-3 w-3 text-warning" />
                      {formatKwp(col.totalKwp)} kWp
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 ml-auto font-semibold text-muted-foreground">
                    <LayoutGrid className="h-3 w-3" />
                    {col.count} {col.count === 1 ? "projeto" : "projetos"}
                  </span>
                </div>
              </div>

              {/* New Project Button */}
              <div className="px-3 py-2">
                <Button
                  variant="outline"
                  onClick={() => onCreateProjeto?.(col.id)}
                  className="w-full h-8 rounded-lg border border-dashed border-primary/30 text-xs font-medium text-primary/70 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-200"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Novo projeto
                </Button>
              </div>

              {/* Cards */}
              <div className="px-3 pb-3 min-h-[80px] space-y-2 flex-1 overflow-y-auto">
                {col.deals.length === 0 && (
                  <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/50 italic">
                    Arraste projetos aqui
                  </div>
                )}
                <OwnerProgressiveList
                  deals={col.deals}
                  draggedId={draggedId}
                  onDragStart={handleDragStart}
                  onViewProjeto={onViewProjeto}
                />
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ── Deal Card Component ──────────────────────────────────────

interface OwnerDealCardProps {
  deal: DealKanbanCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
}

function OwnerDealCard({ deal, isDragging, onDragStart, onClick }: OwnerDealCardProps) {
  const etiquetaCfg = getEtiquetaConfig(deal.etiqueta);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.deal_id)}
      onClick={onClick}
      className={cn(
        "relative bg-card rounded-lg border border-border/50 cursor-grab active:cursor-grabbing",
        "hover:border-border transition-all duration-150",
        isDragging && "opacity-30 scale-95"
      )}
      style={{ boxShadow: isDragging ? "var(--shadow-md)" : "var(--shadow-xs)" }}
    >
      <div className="p-2.5 space-y-1">
        {/* HEADER: Name + Value */}
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-[12px] font-semibold text-foreground leading-tight line-clamp-1 flex-1">
            {deal.customer_name || deal.deal_title || "Sem nome"}
          </p>
          <span className="text-[11px] font-bold text-foreground whitespace-nowrap tabular-nums shrink-0">
            {deal.deal_value > 0 ? formatBRL(deal.deal_value) : "R$ —"}
          </span>
        </div>

        {/* SUBHEADER: Phone + kWp */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {deal.customer_phone && (
            <span className="flex items-center gap-0.5 font-mono truncate">
              <Phone className="h-2.5 w-2.5 shrink-0" />
              {deal.customer_phone}
            </span>
          )}
        </div>

        {/* STATUS: Stage + etiqueta */}
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-[9px] h-[16px] px-1.5 font-medium">
            {deal.stage_name}
          </Badge>
          {etiquetaCfg && (
            <span className={cn("text-[8px] font-medium px-1.5 py-px rounded border shrink-0", etiquetaCfg.className)}>
              {etiquetaCfg.short || etiquetaCfg.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Progressive list with infinite scroll sentinel ──────────

interface OwnerProgressiveListProps {
  deals: DealKanbanCard[];
  draggedId: string | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onViewProjeto?: (deal: DealKanbanCard) => void;
}

function OwnerProgressiveList({ deals, draggedId, onDragStart, onViewProjeto }: OwnerProgressiveListProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_OWNER_CARDS);
  const visible = deals.slice(0, visibleCount);
  const remaining = deals.length - visibleCount;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (remaining <= 0 || !sentinelRef.current) return;
    const node = sentinelRef.current;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(prev => prev + OWNER_CARDS_INCREMENT);
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [remaining]);

  return (
    <>
      {visible.map(deal => (
        <OwnerDealCard
          key={deal.deal_id}
          deal={deal}
          isDragging={draggedId === deal.deal_id}
          onDragStart={onDragStart}
          onClick={() => onViewProjeto?.(deal)}
        />
      ))}
      {remaining > 0 && (
        <div
          ref={sentinelRef}
          className="w-full py-2 text-center text-[10px] font-medium text-muted-foreground/60"
        >
          Carregando mais {Math.min(remaining, OWNER_CARDS_INCREMENT)} de {remaining}…
        </div>
      )}
    </>
  );
}
