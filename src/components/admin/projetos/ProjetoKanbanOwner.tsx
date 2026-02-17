import { formatBRLCompact as formatBRL, formatBRLCompact as formatBRLCard } from "@/lib/formatters";
import { getEtiquetaConfig } from "@/lib/etiquetas";
import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Zap, Plus, LayoutGrid, Phone } from "lucide-react";
import type { OwnerColumn, DealKanbanCard } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Props {
  columns: OwnerColumn[];
  onMoveProjeto: (dealId: string, ownerId: string) => void;
  onViewProjeto?: (deal: DealKanbanCard) => void;
  onCreateProjeto?: (ownerId: string) => void;
}

// formatBRL & formatBRLCard imported at file top from @/lib/formatters

const formatKwp = (v: number) => {
  if (!v) return "0";
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(".", ",")}`;
  return v.toFixed(2).replace(".", ",");
};

// Etiqueta config now from @/lib/etiquetas

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
      <div className="flex gap-4 pb-4 px-1" style={{ minWidth: "max-content" }}>
        {columns.map(col => {
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className={cn(
                "w-[320px] flex-shrink-0 rounded-2xl border border-border/60 transition-all flex flex-col",
                "bg-card",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              style={{ boxShadow: "var(--shadow-sm)" }}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* ── Column Header ── */}
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

              {/* ── New Project Button ── */}
              <div className="px-3 py-2">
                <button
                  onClick={() => onCreateProjeto?.(col.id)}
                  className={cn(
                    "w-full h-9 rounded-xl border-2 border-dashed border-primary/30",
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
              <div className="px-3 pb-3 min-h-[120px] space-y-2 flex-1">
                {col.deals.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50 italic">
                    Arraste projetos aqui
                  </div>
                )}
                {col.deals.map(deal => (
                  <OwnerDealCard
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
        "relative bg-card rounded-xl border border-border/50 p-3.5 cursor-grab active:cursor-grabbing",
        "hover:border-primary/30 transition-all duration-150",
        isDragging && "opacity-40 scale-95"
      )}
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[13px] font-bold text-foreground leading-snug line-clamp-2">
          {deal.customer_name || deal.deal_title || "Sem nome"}
        </p>
        {etiquetaCfg && (
          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0", etiquetaCfg.className)}>
            {etiquetaCfg.short || etiquetaCfg.label}
          </span>
        )}
      </div>

      {/* Phone */}
      {deal.customer_phone && deal.customer_phone !== "" && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
          <Phone className="h-3 w-3" />
          <span>{deal.customer_phone}</span>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {deal.deal_value > 0 && (
            <span className="font-bold text-foreground text-[12px]">
              {formatBRLCard(deal.deal_value)}
            </span>
          )}
        </div>
        {/* Stage badge */}
        <Badge variant="outline" className="text-[10px] h-5 px-2 font-medium border-border/60 bg-muted/50 rounded-lg">
          {deal.stage_name}
        </Badge>
      </div>
    </div>
  );
}
