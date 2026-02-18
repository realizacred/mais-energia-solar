import { formatBRLCompact as formatBRL } from "@/lib/formatters";
import { useState, useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, DollarSign, Clock, Phone, User, ChevronDown, MessageSquare, StickyNote, FileText, Zap } from "lucide-react";
import type { DealKanbanCard, OwnerColumn } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { differenceInDays, differenceInHours } from "date-fns";

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
  onNewProject?: (consultorId: string) => void;
  onMoveDealToOwner?: (dealId: string, ownerId: string) => void;
  dynamicEtiquetas?: DynamicEtiqueta[];
}

function getTimeInStage(lastChange: string) {
  const hours = differenceInHours(new Date(), new Date(lastChange));
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(new Date(), new Date(lastChange));
  return `${days}d`;
}

function getStagnationLevel(lastChange: string) {
  const hours = differenceInHours(new Date(), new Date(lastChange));
  if (hours >= 168) return "critical";
  if (hours >= 72) return "warning";
  return null;
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

export function ProjetoKanbanConsultor({ ownerColumns, allDeals, onViewProjeto, onNewProject, onMoveDealToOwner, dynamicEtiquetas = [] }: Props) {
  const isMobile = useIsMobile();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedId(dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, ownerId: string) => {
    e.preventDefault();
    if (draggedId) {
      onMoveDealToOwner?.(draggedId, ownerId);
      setDraggedId(null);
      setDragOverCol(null);
    }
  };

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
        {ownerColumns.map(col => (
          <Collapsible key={col.id} defaultOpen={col.count > 0}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors">
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
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 pt-2 pb-1">
                {col.deals.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 italic text-center py-4">Nenhum projeto</p>
                ) : (
                  col.deals.map(deal => (
                    <OwnerDealCard
                      key={deal.deal_id}
                      deal={deal}
                      isDragging={false}
                      onDragStart={() => {}}
                      onClick={() => onViewProjeto?.(deal)}
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
        ))}
      </div>
    );
  }

  // ── Desktop ──
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2.5 pb-4 px-1" style={{ minWidth: "max-content" }}>
        {ownerColumns.map(col => {
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className={cn(
                "w-[272px] flex-shrink-0 rounded-xl border border-border/40 transition-all flex flex-col",
                "bg-muted/30",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Header */}
              <div className={cn("px-3 pt-3 pb-2 border-b-2", isOrphanColumn(col.id) ? "border-warning/40" : "border-primary/20")}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar className={cn("h-6 w-6 border", isOrphanColumn(col.id) ? "border-warning/30" : "border-primary/30")}>
                    <AvatarFallback className={cn("text-[9px] font-bold", isOrphanColumn(col.id) ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}>
                      {isOrphanColumn(col.id) ? "?" : getInitials(col.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className={cn("text-[11px] font-semibold leading-tight truncate uppercase tracking-wider", isOrphanColumn(col.id) ? "text-warning" : "text-foreground")}>
                    {col.nome}
                  </h3>
                </div>
                <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5 font-bold text-[11px] font-mono text-success">
                    <DollarSign className="h-3 w-3" />
                    {formatBRL(col.totalValor)}
                  </span>
                  <Badge variant="secondary" className={cn("text-[9px] h-4 px-1.5 font-bold ml-auto rounded-full border-0", isOrphanColumn(col.id) ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}>
                    {col.count}
                  </Badge>
                </div>
              </div>

              {/* New Project Button - hide for orphan column */}
              {!isOrphanColumn(col.id) && (
                <div className="px-2.5 py-1.5">
                  <button
                    onClick={() => onNewProject?.(col.id)}
                    className={cn(
                      "w-full h-7 rounded-lg border border-primary/40",
                      "flex items-center justify-center gap-1.5",
                      "text-[10px] font-semibold text-primary",
                      "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                      "transition-all duration-200"
                    )}
                  >
                    <Plus className="h-3 w-3" />
                    Novo projeto
                  </button>
                </div>
              )}

              {/* Cards */}
              <div className="flex-1 px-2.5 pb-2.5 space-y-1.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
                {col.deals.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/40 italic text-center py-6">Nenhum projeto</p>
                ) : (
                  col.deals.map(deal => (
                    <OwnerDealCard
                      key={deal.deal_id}
                      deal={deal}
                      isDragging={draggedId === deal.deal_id}
                      onDragStart={e => handleDragStart(e, deal.deal_id)}
                      onClick={() => onViewProjeto?.(deal)}
                      dynamicEtiquetas={dynamicEtiquetas}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ── Deal Card ──
function OwnerDealCard({
  deal,
  isDragging,
  onDragStart,
  onClick,
  dynamicEtiquetas,
}: {
  deal: DealKanbanCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
  dynamicEtiquetas: DynamicEtiqueta[];
}) {
  const stagnation = getStagnationLevel(deal.last_stage_change);
  const etiquetaInfo = deal.etiqueta
    ? dynamicEtiquetas.find(e => e.id === deal.etiqueta || e.nome === deal.etiqueta)
    : null;

  const handleSendWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.customer_phone) {
      const phone = deal.customer_phone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}`, "_blank");
    }
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.customer_phone) {
      window.open(`tel:${deal.customer_phone}`, "_self");
    }
  };

  const hasNotas = !!deal.notas?.trim();
  const hasProposta = !!deal.proposta_id;
  const isOpen = deal.deal_status !== "won" && deal.deal_status !== "lost";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "group relative bg-card rounded-xl border border-border/40 p-2.5 cursor-pointer",
        "shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all duration-150",
        isDragging && "opacity-40 scale-95",
        // Status-based card styling with VIVID colors
        deal.deal_status === "won" && "bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500",
        deal.deal_status === "lost" && "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500 opacity-70",
        isOpen && stagnation === "critical" && "border-l-4 border-l-red-500",
        isOpen && stagnation === "warning" && "border-l-4 border-l-amber-400",
        isOpen && !stagnation && !deal.proposta_id && "border-l-4 border-l-orange-400",
        isOpen && !stagnation && deal.proposta_id && etiquetaInfo && "border-l-4",
        isOpen && !stagnation && deal.proposta_id && !etiquetaInfo && "border-l-4 border-l-primary/40",
      )}
      style={{
        ...(etiquetaInfo && isOpen && !stagnation ? { borderLeftColor: etiquetaInfo.cor } : {}),
      }}
    >
      {/* Row 1: Etiqueta + Stage + Time */}
      <div className="flex items-center gap-1.5 mb-1">
        {etiquetaInfo && (
          <span
            className="text-[8px] font-bold rounded-full px-1.5 py-0.5 text-white leading-none shadow-sm"
            style={{ backgroundColor: etiquetaInfo.cor }}
          >
            {etiquetaInfo.icon ? `${etiquetaInfo.icon} ` : ""}{etiquetaInfo.short || etiquetaInfo.nome.substring(0, 3).toUpperCase()}
          </span>
        )}
        <span className="text-[9px] text-muted-foreground font-medium truncate">
          {deal.stage_name}
        </span>
        <span className={cn(
          "ml-auto text-[9px] flex items-center gap-0.5 font-medium",
          stagnation === "critical" && "text-red-500 font-bold",
          stagnation === "warning" && "text-amber-500 font-bold",
          !stagnation && "text-muted-foreground",
        )}>
          <Clock className="h-2.5 w-2.5" />
          {getTimeInStage(deal.last_stage_change)}
        </span>
      </div>

      {/* Row 2: Customer name */}
      <h4 className={cn(
        "text-[13px] font-bold leading-tight truncate mb-1",
        deal.deal_status === "lost" ? "text-muted-foreground line-through" : "text-foreground"
      )}>
        {deal.customer_name || deal.deal_title}
      </h4>

      {/* Row 3: Phone + quick actions */}
      {deal.customer_phone && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
          <Phone className="h-2.5 w-2.5" />
          <span>{deal.customer_phone}</span>
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-5 w-5 p-0 rounded-full"
                  onClick={handleSendWhatsApp}
                >
                  <MessageSquare className="h-2.5 w-2.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">WhatsApp</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={handleCall}
                >
                  <Phone className="h-2.5 w-2.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Ligar</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Row 4: Value + kWp */}
      <div className="flex items-center gap-2 mb-1">
        {deal.deal_value > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold font-mono text-success">
            <DollarSign className="h-3 w-3" />
            {formatBRL(deal.deal_value)}
          </span>
        )}
        {deal.deal_kwp > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold font-mono text-info">
            <Zap className="h-2.5 w-2.5" />
            {deal.deal_kwp.toFixed(1).replace(".", ",")} kWp
          </span>
        )}
      </div>

      {/* Row 5: Indicators (proposal, notes) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {hasProposta ? (
          <Badge variant="outline" className="text-[8px] h-4 px-1.5 gap-0.5 bg-success/10 text-success border-success/30">
            <FileText className="h-2.5 w-2.5" />
            Proposta
          </Badge>
        ) : isOpen ? (
          <Badge variant="outline" className="text-[8px] h-4 px-1.5 gap-0.5 bg-orange-50 dark:bg-orange-950/20 text-orange-600 border-orange-300/50">
            <FileText className="h-2.5 w-2.5" />
            Sem proposta
          </Badge>
        ) : null}
        {hasNotas && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[8px] h-4 px-1.5 gap-0.5 bg-info/10 text-info border-info/30">
                <StickyNote className="h-2.5 w-2.5" />
                Notas
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-[200px]">
              <p className="line-clamp-3">{deal.notas}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
