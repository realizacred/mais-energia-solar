import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Zap, Plus, LayoutGrid, Phone } from "lucide-react";
import type { DealKanbanCard, PipelineStage } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
  residencial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  comercial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  industrial: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  rural: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
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
      <div className="flex gap-3 pb-4 px-1" style={{ minWidth: "max-content" }}>
        {sortedStages.map(stage => {
          const stageDeals = deals.filter(d => d.stage_id === stage.id);
          const totalValue = stageDeals.reduce((s, d) => s + (d.deal_value || 0), 0);
          const isOver = dragOverCol === stage.id;
          const stageColor = stage.is_won ? "border-t-success" : stage.is_closed ? "border-t-destructive" : "border-t-primary";

          return (
            <div
              key={stage.id}
              className={cn(
                "w-[300px] flex-shrink-0 rounded-xl border border-border/50 transition-all flex flex-col border-t-[3px]",
                stageColor,
                "bg-muted/20",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(stage.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, stage.id)}
            >
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground leading-tight tracking-tight">
                    {stage.name}
                  </h3>
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {stage.probability}%
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground text-[13px]">
                    {formatBRL(totalValue)}
                  </span>
                  <span className="flex items-center gap-0.5 ml-auto font-semibold text-muted-foreground">
                    <LayoutGrid className="h-3 w-3" />
                    {stageDeals.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="px-3 py-3 min-h-[180px] space-y-2 flex-1">
                {stageDeals.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50 italic">
                    Arraste projetos aqui
                  </div>
                )}
                {stageDeals.map(deal => {
                  const etiquetaClass = deal.etiqueta ? ETIQUETA_COLORS[deal.etiqueta] : null;
                  return (
                    <div
                      key={deal.deal_id}
                      draggable
                      onDragStart={e => handleDragStart(e, deal.deal_id)}
                      onClick={() => onViewProjeto?.(deal)}
                      className={cn(
                        "bg-card rounded-lg border border-border/40 p-3.5 cursor-grab active:cursor-grabbing",
                        "hover:shadow-md hover:border-primary/30 transition-all duration-150",
                        draggedId === deal.deal_id && "opacity-40 scale-95"
                      )}
                    >
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
                      {deal.customer_phone && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
                          <Phone className="h-3 w-3" /> {deal.customer_phone}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {deal.deal_value > 0 && (
                          <span className="font-bold text-foreground text-[12px]">{formatBRLCard(deal.deal_value)}</span>
                        )}
                        <span className="text-[10px] font-medium truncate ml-auto">{deal.owner_name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
