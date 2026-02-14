import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus, LayoutGrid } from "lucide-react";
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
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}mil`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
};

const formatBRLFull = (v: number | null) => {
  if (!v) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Aberto", variant: "outline" },
  won: { label: "Ganho", variant: "default" },
  lost: { label: "Perdido", variant: "destructive" },
  archived: { label: "Arquivado", variant: "secondary" },
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
      <div className="flex gap-3 pb-4" style={{ minWidth: "max-content" }}>
        {columns.map(col => {
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className={cn(
                "w-72 flex-shrink-0 rounded-xl border border-border/60 bg-card transition-colors flex flex-col",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="px-3 py-3 border-b border-border/40 space-y-2">
                <p className="text-sm font-bold text-foreground">{col.nome}</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-success" />
                    {formatBRL(col.totalValor)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                    <LayoutGrid className="h-2.5 w-2.5 mr-0.5" />
                    {col.count} projetos
                  </Badge>
                </div>
              </div>

              {/* Cards */}
              <div className="p-2 min-h-[300px] space-y-2 flex-1">
                {col.deals.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/60">
                    Arraste projetos aqui
                  </div>
                )}
                {col.deals.map(deal => {
                  const statusInfo = STATUS_LABELS[deal.deal_status] || { label: deal.deal_status, variant: "outline" as const };
                  return (
                    <Card
                      key={deal.deal_id}
                      draggable
                      onDragStart={e => handleDragStart(e, deal.deal_id)}
                      onClick={() => onViewProjeto?.(deal)}
                      className={cn(
                        "cursor-grab active:cursor-grabbing hover:shadow-sm transition-all border-border/40 hover:border-border",
                        draggedId === deal.deal_id && "opacity-40 scale-95"
                      )}
                    >
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm leading-tight text-foreground">
                            {deal.customer_name || deal.deal_title || "Sem nome"}
                          </p>
                          <Badge variant={statusInfo.variant} className="text-[9px] shrink-0 px-1.5 h-4">
                            {statusInfo.label}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {deal.deal_value > 0 && (
                            <span className="font-semibold text-foreground">
                              {formatBRLFull(deal.deal_value)}
                            </span>
                          )}
                          {deal.stage_name && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                              {deal.stage_name}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground gap-1 border border-dashed border-border/60 hover:border-primary/40"
                  onClick={() => onCreateProjeto?.(col.id)}
                >
                  <Plus className="h-3 w-3" />
                  Novo projeto
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
