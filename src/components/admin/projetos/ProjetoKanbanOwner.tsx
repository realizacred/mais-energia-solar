import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Zap, Plus, LayoutGrid } from "lucide-react";
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
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}.${((v % 1_000) / 100).toFixed(0)}`;
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
      <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
        {columns.map(col => {
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className={cn(
                "w-[260px] flex-shrink-0 rounded-lg bg-muted/30 border border-border/40 transition-colors flex flex-col",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* ── Column Header ── */}
              <div className="px-4 pt-4 pb-2 space-y-1.5">
                <h3 className="text-base font-bold text-foreground leading-tight">
                  {col.nome}
                </h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {formatBRL(col.totalValor)}
                  </span>
                  {col.totalKwp > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Zap className="h-3 w-3 text-warning" />
                      {formatKwp(col.totalKwp)} kWp
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <LayoutGrid className="h-3 w-3" />
                    {col.count} projetos
                  </span>
                </div>
              </div>

              {/* ── New Project Button ── */}
              <div className="px-3 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9 text-sm font-medium text-primary border-primary/40 hover:bg-primary/5 hover:text-primary gap-1"
                  onClick={() => onCreateProjeto?.(col.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo projeto
                </Button>
              </div>

              {/* ── Cards ── */}
              <div className="px-3 pb-3 min-h-[200px] space-y-2 flex-1">
                {col.deals.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/60">
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
  // Get first letter of stage category for the badge
  const stageInitial = deal.stage_name ? deal.stage_name.charAt(0).toUpperCase() : "";

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.deal_id)}
      onClick={onClick}
      className={cn(
        "relative bg-card rounded-lg border border-border/50 p-3 cursor-grab active:cursor-grabbing",
        "hover:shadow-md hover:border-border transition-all",
        "border-l-[3px] border-l-primary",
        isDragging && "opacity-40 scale-95"
      )}
    >
      {/* Title row with badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
          {deal.customer_name || deal.deal_title || "Sem nome"}
        </p>
        <span className="shrink-0 flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
          0
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {deal.deal_value > 0 && (
            <span className="font-bold text-foreground">
              {formatBRLCard(deal.deal_value)}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Zap className="h-3 w-3 text-warning" />
            - kWp
          </span>
        </div>
        {stageInitial && (
          <span className="font-semibold text-foreground/70 text-xs">
            {stageInitial}
          </span>
        )}
      </div>
    </div>
  );
}
