import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Zap, Plus, FileText, MessageSquare, TrendingDown } from "lucide-react";
import type { DealKanbanCard, PipelineStage } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  stages: PipelineStage[];
  deals: DealKanbanCard[];
  onMoveToStage: (dealId: string, stageId: string) => void;
  onViewProjeto?: (deal: DealKanbanCard) => void;
  onNewProject?: () => void;
}

const formatBRL = (v: number) => {
  if (!v) return "R$ -";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}K`;
  return `R$ ${v}`;
};

const formatKwp = (v: number) => {
  if (!v) return "- kWp";
  return `${v.toFixed(1).replace(".", ",")} kWp`;
};

const ETIQUETA_LABELS: Record<string, string> = {
  residencial: "R",
  comercial: "C",
  industrial: "I",
  rural: "A",
};

const PROPOSTA_STATUS_MAP: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  gerada: { label: "Gerada", className: "bg-amber-100 text-amber-700" },
  generated: { label: "Gerada", className: "bg-amber-100 text-amber-700" },
  enviada: { label: "Enviada", className: "bg-blue-100 text-blue-700" },
  sent: { label: "Enviada", className: "bg-blue-100 text-blue-700" },
  aceita: { label: "Aceita", className: "bg-green-100 text-green-700" },
  accepted: { label: "Aceita", className: "bg-green-100 text-green-700" },
  recusada: { label: "Recusada", className: "bg-destructive/10 text-destructive" },
  rejected: { label: "Recusada", className: "bg-destructive/10 text-destructive" },
  expirada: { label: "Expirada", className: "bg-muted text-muted-foreground" },
  expired: { label: "Expirada", className: "bg-muted text-muted-foreground" },
};

export function ProjetoKanbanStage({ stages, deals, onMoveToStage, onViewProjeto, onNewProject }: Props) {
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
          const totalKwp = stageDeals.reduce((s, d) => s + (d.deal_kwp || 0), 0);
          const isOver = dragOverCol === stage.id;

          return (
            <div
              key={stage.id}
              className={cn(
                "w-[290px] flex-shrink-0 rounded-xl border border-border/60 transition-all flex flex-col",
                "bg-muted/30",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(stage.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, stage.id)}
            >
              {/* Column Header */}
              <div className="px-4 pt-3.5 pb-2.5">
                <h3 className="text-sm font-bold text-foreground leading-tight truncate mb-1.5">
                  {stage.name}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  <span className="font-semibold text-foreground">{formatBRL(totalValue)}</span>
                  <span className="flex items-center gap-0.5">
                    <Zap className="h-3 w-3 text-warning" />
                    {formatKwp(totalKwp)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <span className="text-muted-foreground">⊞</span>
                    {stageDeals.length} projeto{stageDeals.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* New Project Button */}
              <div className="px-3 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs font-medium border-dashed border-primary/40 text-primary hover:bg-primary/5"
                  onClick={() => onNewProject?.()}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Novo projeto
                </Button>
              </div>

              {/* Cards */}
              <div className="px-3 pb-3 min-h-[80px] space-y-2 flex-1">
                {stageDeals.length === 0 && (
                  <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/40 italic">
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

// ── Deal Card ──────────────────────────────────────────

interface StageDealCardProps {
  deal: DealKanbanCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
}

function StageDealCard({ deal, isDragging, onDragStart, onClick }: StageDealCardProps) {
  const navigate = useNavigate();
  const etiquetaLabel = deal.etiqueta ? ETIQUETA_LABELS[deal.etiqueta] || deal.etiqueta?.[0]?.toUpperCase() : null;
  const isInactive = deal.deal_status === "perdido" || deal.deal_status === "cancelado";
  const propostaInfo = deal.proposta_status ? PROPOSTA_STATUS_MAP[deal.proposta_status] : null;

  const handleGeneratePDF = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to proposals tab of the project
    onClick();
  };

  const handleSendWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.customer_phone) {
      const phone = deal.customer_phone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}`, "_blank");
    }
  };

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.deal_id)}
      onClick={onClick}
      className={cn(
        "bg-card rounded-lg border-l-[3px] border border-border/40 p-3 cursor-grab active:cursor-grabbing",
        "hover:shadow-md transition-all duration-150 relative group",
        "border-l-primary",
        isInactive && "opacity-50",
        isDragging && "opacity-30 scale-95"
      )}
      style={{ boxShadow: "0 1px 3px hsl(var(--foreground) / 0.04)" }}
    >
      {/* Name + badges */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={cn(
          "text-[13px] font-semibold leading-snug line-clamp-2",
          isInactive ? "text-muted-foreground" : "text-foreground"
        )}>
          {deal.customer_name || deal.deal_title || "Sem nome"}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {propostaInfo && (
            <Badge className={cn("text-[9px] h-5 px-1.5 font-semibold", propostaInfo.className)}>
              {propostaInfo.label}
            </Badge>
          )}
          {etiquetaLabel && (
            <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
              {etiquetaLabel}
            </span>
          )}
        </div>
      </div>

      {/* Technical badges row */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {deal.deal_kwp > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-secondary/10 text-secondary-foreground rounded px-1.5 py-0.5">
            <Zap className="h-2.5 w-2.5 text-warning" />
            {deal.deal_kwp.toFixed(2).replace(".", ",")} kWp
          </span>
        )}
        {deal.proposta_economia_mensal && deal.proposta_economia_mensal > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-green-50 text-green-700 rounded px-1.5 py-0.5">
            <TrendingDown className="h-2.5 w-2.5" />
            R$ {deal.proposta_economia_mensal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}/mês
          </span>
        )}
        {deal.deal_value > 0 && (
          <span className="text-[11px] font-bold text-primary">
            {formatBRL(deal.deal_value)}
          </span>
        )}
      </div>

      {/* Quick actions (visible on hover) */}
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={handleGeneratePDF}
            >
              <FileText className="h-3 w-3 mr-1" />
              Proposta
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver propostas do projeto</TooltipContent>
        </Tooltip>
        {deal.customer_phone && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={handleSendWhatsApp}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                WhatsApp
              </Button>
            </TooltipTrigger>
            <TooltipContent>Abrir conversa no WhatsApp</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
