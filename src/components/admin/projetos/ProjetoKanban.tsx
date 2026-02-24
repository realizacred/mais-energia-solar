import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, Zap } from "lucide-react";
import type { ProjetoEtapa, ProjetoItem } from "@/hooks/useProjetoPipeline";
import { cn } from "@/lib/utils";

interface Props {
  etapas: ProjetoEtapa[];
  projetosByEtapa: Map<string | null, ProjetoItem[]>;
  onMoveProjeto: (projetoId: string, etapaId: string) => void;
  onViewProjeto?: (projeto: ProjetoItem) => void;
}

// formatBRL imported at file top from @/lib/formatters

const CATEGORIA_DOT: Record<string, string> = {
  aberto: "bg-info",
  ganho: "bg-success",
  perdido: "bg-destructive",
  excluido: "bg-muted-foreground",
};

export function ProjetoKanban({ etapas, projetosByEtapa, onMoveProjeto, onViewProjeto }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverEtapa, setDragOverEtapa] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, projetoId: string) => {
    setDraggedId(projetoId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, etapaId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverEtapa(etapaId);
  };

  const handleDragLeave = () => {
    setDragOverEtapa(null);
  };

  const handleDrop = (e: React.DragEvent, etapaId: string) => {
    e.preventDefault();
    if (draggedId) {
      onMoveProjeto(draggedId, etapaId);
      setDraggedId(null);
      setDragOverEtapa(null);
    }
  };

  if (etapas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="font-medium">Nenhuma etapa configurada</p>
        <p className="text-sm mt-1">Crie um funil para começar.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-4" style={{ minWidth: "min-content" }}>
        {etapas.map(etapa => {
          const items = projetosByEtapa.get(etapa.id) || [];
          const isOver = dragOverEtapa === etapa.id;

          return (
            <div
              key={etapa.id}
              className={cn(
                "w-[240px] sm:w-[260px] xl:w-[280px] flex-shrink-0 rounded-xl border border-border/60 bg-card transition-colors",
                isOver && "ring-2 ring-primary/30 bg-primary/5"
              )}
              onDragOver={e => handleDragOver(e, etapa.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, etapa.id)}
            >
              {/* Column header */}
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: etapa.cor }}
                  />
                  <span className="text-sm font-semibold text-foreground">{etapa.nome}</span>
                </div>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                  {items.length}
                </Badge>
              </div>

              {/* Column body */}
              <div className="p-2 min-h-[350px] space-y-2">
                {items.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/60">
                    Arraste projetos aqui
                  </div>
                )}
                {items.map(projeto => (
                  <Card
                    key={projeto.id}
                    draggable
                    onDragStart={e => handleDragStart(e, projeto.id)}
                    onClick={() => onViewProjeto?.(projeto)}
                    className={cn(
                      "cursor-grab active:cursor-grabbing hover:shadow-sm transition-all border-border/40 hover:border-border",
                      draggedId === projeto.id && "opacity-40 scale-95"
                    )}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-tight text-foreground">
                          {projeto.cliente?.nome || projeto.codigo || "Projeto sem nome"}
                        </p>
                        {projeto.codigo && (
                          <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                            {projeto.codigo}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {projeto.consultor?.nome && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {projeto.consultor.nome}
                          </span>
                        )}
                        {projeto.potencia_kwp && (
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {projeto.potencia_kwp} kWp
                          </span>
                        )}
                      </div>

                      {projeto.valor_total && (
                        <p className="text-sm font-bold text-foreground text-right pt-0.5">
                          {formatBRL(projeto.valor_total)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
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
