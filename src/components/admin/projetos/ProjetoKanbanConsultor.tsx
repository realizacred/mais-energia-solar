import { formatBRLCompact as formatBRL } from "@/lib/formatters";
import { useState } from "react";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, DollarSign, User, ChevronDown, Zap } from "lucide-react";
import type { DealKanbanCard, OwnerColumn } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { StageDealCard } from "./StageDealCard";

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

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

const formatKwp = (v: number) => {
  if (!v) return null;
  return `${v.toFixed(1).replace(".", ",")} kWp`;
};

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
        {ownerColumns.map(col => {
          const totalKwp = col.deals.reduce((s, d) => s + (d.deal_kwp || 0), 0);
          return (
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
                      <StageDealCard
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
          );
        })}
      </div>
    );
  }

  // ── Desktop ──
  return (
    <ScrollArea className="w-full max-w-full">
      <div className="flex gap-3 pb-4 px-1" style={{ minWidth: "max-content" }}>
        {ownerColumns.map(col => {
          const isOver = dragOverCol === col.id;
          const totalKwp = col.deals.reduce((s, d) => s + (d.deal_kwp || 0), 0);
          const kwpStr = formatKwp(totalKwp);

          return (
            <div
              key={col.id}
              className={cn(
                "w-[260px] sm:w-[280px] xl:w-[300px] flex-shrink-0 rounded-xl border border-border/50 transition-all flex flex-col",
                "bg-card/60",
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

              {/* Cards — using StageDealCard for full visual richness */}
              <div className="flex-1 px-2.5 pb-2.5 space-y-2.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
                {col.deals.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/40 italic text-center py-6">Nenhum projeto</p>
                ) : (
                  col.deals.map(deal => (
                    <StageDealCard
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
