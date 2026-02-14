import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Zap, Plus, LayoutGrid, FileText } from "lucide-react";
import type { OwnerColumn, DealKanbanCard } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";

interface Props {
  columns: OwnerColumn[];
  onMoveProjeto: (dealId: string, ownerId: string) => void;
  onViewProjeto?: (deal: DealKanbanCard) => void;
  onCreateProjeto?: (ownerId: string) => void;
}

const formatBRL = (v: number) => {
  if (!v) return "R$ 0";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}K`;
  return `R$ ${v}`;
};

const formatKwp = (v: number) => {
  if (!v) return "0";
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(".", ",")}`;
  return v.toFixed(2).replace(".", ",");
};

const formatBRLCard = (v: number | null) => {
  if (!v) return null;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}K`;
  return `R$ ${v}`;
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
        <p className="font-medium">Nenhum responsável com projetos</p>
        <p className="text-sm mt-1">Crie um projeto para começar.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-4 px-1" style={{ minWidth: "max-content" }}>
        {columns.map(col => {
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className={cn(
                "w-[280px] flex-shrink-0 rounded-xl border border-border/50 transition-all flex flex-col",
                "bg-muted/20",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* ── Column Header ── */}
              <div className="px-4 pt-4 pb-3 border-b border-border/30">
                <h3 className="text-sm font-bold text-foreground leading-tight tracking-tight">
                  {col.nome}
                </h3>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground text-[13px]">
                    {formatBRL(col.totalValor)}
                  </span>
                  {col.totalKwp > 0 && (
                    <span className="flex items-center gap-0.5 font-medium">
                      <Zap className="h-3 w-3 text-amarelo-sol" />
                      {formatKwp(col.totalKwp)} kWp
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 ml-auto font-semibold text-muted-foreground">
                    <LayoutGrid className="h-3 w-3" />
                    {col.count} {col.count === 1 ? "projeto" : "projetos"}
                  </span>
                </div>
              </div>

              {/* ── New Project Button ── */}
              <div className="px-3 py-2">
                <button
                  onClick={() => onCreateProjeto?.(col.id)}
                  className={cn(
                    "w-full h-9 rounded-lg border-2 border-dashed border-primary/30",
                    "flex items-center justify-center gap-1.5",
                    "text-xs font-medium text-primary/70",
                    "hover:border-primary/50 hover:text-primary hover:bg-primary/5",
                    "transition-all duration-200"
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo projeto
                </button>
              </div>

              {/* ── Cards ── */}
              <div className="px-3 pb-3 min-h-[180px] space-y-2 flex-1">
                {col.deals.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50 italic">
                    Arraste projetos aqui
                  </div>
                )}
                {col.deals.map(deal => (
                  <DealCard
                    key={deal.deal_id}
                    deal={deal}
                    isDragging={draggedId === deal.deal_id}
                    onDragStart={handleDragStart}
                    onClick={() => onViewProjeto?.(deal)}
                  />
                ))}
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

interface DealCardProps {
  deal: DealKanbanCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
}

function DealCard({ deal, isDragging, onDragStart, onClick }: DealCardProps) {
  const stageInitial = deal.stage_name ? deal.stage_name.charAt(0).toUpperCase() : "";

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.deal_id)}
      onClick={onClick}
      className={cn(
        "relative bg-card rounded-lg border border-border/40 p-3 cursor-grab active:cursor-grabbing",
        "hover:shadow-md hover:border-border/70 transition-all duration-150",
        isDragging && "opacity-40 scale-95"
      )}
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      {/* Proposal count indicator */}
      <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 bg-muted rounded-full px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground border border-border/50">
        <FileText className="h-2.5 w-2.5" />
        0
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-2 pr-4">
        <p className="text-[13px] font-bold text-foreground leading-snug line-clamp-2">
          {deal.customer_name || deal.deal_title || "Sem nome"}
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {deal.deal_value > 0 && (
            <span className="font-bold text-foreground text-[12px]">
              {formatBRLCard(deal.deal_value)}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Zap className="h-3 w-3 text-amarelo-sol" />
            <span className="text-[11px] font-medium">— kWp</span>
          </span>
        </div>
        {/* Stage badge */}
        {stageInitial && (
          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground border border-border/40">
            {stageInitial}
          </span>
        )}
      </div>
    </div>
  );
}
