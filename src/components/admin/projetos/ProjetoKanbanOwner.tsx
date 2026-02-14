import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
                "w-[272px] flex-shrink-0 rounded-xl border border-border/50 transition-all flex flex-col",
                "bg-muted/20",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* ── Column Header ── */}
              <div className="px-4 pt-4 pb-3">
                <h3 className="text-sm font-bold text-foreground leading-tight tracking-tight">
                  {col.nome}
                </h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
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
                    {col.count}
                  </span>
                </div>
              </div>

              {/* ── New Project Button (dashed) ── */}
              <div className="px-3 pb-2">
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

  // Determine left border color based on status
  const borderColor = deal.deal_status === "won"
    ? "border-l-success"
    : deal.deal_status === "lost"
      ? "border-l-destructive"
      : "border-l-primary";

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.deal_id)}
      onClick={onClick}
      className={cn(
        "relative bg-card rounded-lg border border-border/40 p-3 cursor-grab active:cursor-grabbing",
        "hover:shadow-md hover:border-border/70 transition-all duration-150",
        "border-l-[3px]",
        borderColor,
        isDragging && "opacity-40 scale-95"
      )}
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      {/* Title row with stage badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">
          {deal.customer_name || deal.deal_title || "Sem nome"}
        </p>
        {stageInitial && (
          <span className="shrink-0 flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
            {stageInitial}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2.5">
          {deal.deal_value > 0 && (
            <span className="font-bold text-foreground text-[12px]">
              {formatBRLCard(deal.deal_value)}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Zap className="h-3 w-3 text-warning" />
            <span className="text-[11px]">— kWp</span>
          </span>
        </div>
      </div>
    </div>
  );
}
