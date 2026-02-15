import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Zap, Phone, ChevronRight } from "lucide-react";
import type { DealKanbanCard, PipelineStage } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";

interface Props {
  stages: PipelineStage[];
  deals: DealKanbanCard[];
  onMoveToStage: (dealId: string, stageId: string) => void;
  onViewProjeto?: (deal: DealKanbanCard) => void;
}

const formatBRL = (v: number) => {
  if (!v) return "R$ 0";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}K`;
  return `R$ ${v}`;
};

const formatBRLCard = (v: number | null) => {
  if (!v) return null;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}K`;
  return `R$ ${v}`;
};

const ETIQUETA_COLORS: Record<string, string> = {
  residencial: "bg-info/10 text-info dark:bg-info/20",
  comercial: "bg-warning/10 text-warning dark:bg-warning/20",
  industrial: "bg-secondary/10 text-secondary dark:bg-secondary/20",
  rural: "bg-success/10 text-success dark:bg-success/20",
};

export function ProjetoKanbanStage({ stages, deals, onMoveToStage, onViewProjeto }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedId(dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedId) {
      onMoveToStage(draggedId, stageId);
      setDraggedId(null);
      setDragOverCol(null);
    }
  };

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  if (sortedStages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="font-medium">Nenhuma etapa configurada</p>
        <p className="text-sm mt-1">Configure as etapas do funil primeiro.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 px-1" style={{ minWidth: "max-content" }}>
        {sortedStages.map(stage => {
          const stageDeals = deals.filter(d => d.stage_id === stage.id);
          const totalValue = stageDeals.reduce((s, d) => s + (d.deal_value || 0), 0);
          const totalKwp = stageDeals.reduce((s, d) => s + (d.deal_kwp || 0), 0);
          const isOver = dragOverCol === stage.id;

          return (
            <div
              key={stage.id}
              className={cn(
                "w-[320px] flex-shrink-0 rounded-2xl border border-border/60 transition-all flex flex-col",
                "bg-card",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              style={{ boxShadow: "var(--shadow-sm)" }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(stage.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, stage.id)}
            >
              {/* ── Column Header ── */}
              <ColumnHeader
                name={stage.name}
                totalValue={totalValue}
                totalKwp={totalKwp}
                count={stageDeals.length}
                isWon={stage.is_won}
                isClosed={stage.is_closed}
              />

              {/* ── Cards ── */}
              <div className="px-3 pb-3 min-h-[120px] space-y-2 flex-1">
                {stageDeals.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50 italic">
                    Arraste projetos aqui
                  </div>
                )}
                {stageDeals.map(deal => (
                  <StageDealCard
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

// ── Column Header ──────────────────────────────────────────

interface ColumnHeaderProps {
  name: string;
  totalValue: number;
  totalKwp: number;
  count: number;
  isWon: boolean;
  isClosed: boolean;
}

function ColumnHeader({ name, totalValue, totalKwp, count, isWon, isClosed }: ColumnHeaderProps) {
  const dotClass = isWon
    ? "bg-success"
    : isClosed
    ? "bg-destructive"
    : "bg-primary";

  return (
    <div className="px-4 pt-4 pb-3 border-b border-border/40">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotClass)} />
        <h3 className="text-sm font-bold text-foreground leading-tight tracking-tight truncate">
          {name}
        </h3>
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="font-bold text-foreground text-[13px]">
          {formatBRL(totalValue)}
        </span>
        {totalKwp > 0 && (
          <span className="flex items-center gap-0.5 font-semibold">
            <Zap className="h-3 w-3 text-warning" />
            {totalKwp.toFixed(1)} kWp
          </span>
        )}
      </div>
    </div>
  );
}

// ── Deal Card ──────────────────────────────────────────

interface StageDealCardProps {
  deal: DealKanbanCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
}

function StageDealCard({ deal, isDragging, onDragStart, onClick }: StageDealCardProps) {
  const etiquetaClass = deal.etiqueta ? ETIQUETA_COLORS[deal.etiqueta] : null;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.deal_id)}
      onClick={onClick}
      className={cn(
        "bg-card rounded-xl border border-border/50 p-3.5 cursor-grab active:cursor-grabbing",
        "hover:border-primary/30 transition-all duration-150",
        isDragging && "opacity-40 scale-95"
      )}
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[13px] font-bold text-foreground leading-snug line-clamp-2">
          {deal.customer_name || deal.deal_title || "Sem nome"}
        </p>
        {etiquetaClass && (
          <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0", etiquetaClass)}>
            {deal.etiqueta}
          </span>
        )}
      </div>

      {/* Phone */}
      {deal.customer_phone && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
          <Phone className="h-3 w-3" /> {deal.customer_phone}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {deal.deal_value > 0 && (
          <span className="font-bold text-foreground text-[12px]">{formatBRLCard(deal.deal_value)}</span>
        )}
        <span className="text-[10px] font-medium truncate ml-auto">{deal.owner_name}</span>
      </div>
    </div>
  );
}
