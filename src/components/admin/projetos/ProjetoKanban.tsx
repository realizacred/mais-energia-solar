import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, User, Zap } from "lucide-react";
import type { ProjetoEtapa, ProjetoItem } from "@/hooks/useProjetoPipeline";
import { cn } from "@/lib/utils";

interface Props {
  etapas: ProjetoEtapa[];
  projetosByEtapa: Map<string | null, ProjetoItem[]>;
  onMoveProjeto: (projetoId: string, etapaId: string) => void;
  onViewProjeto?: (projeto: ProjetoItem) => void;
}

const formatBRL = (v: number | null) => {
  if (!v) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
};

const CATEGORIA_ICON: Record<string, string> = {
  aberto: "🔵",
  ganho: "🟢",
  perdido: "🔴",
  excluido: "⚫",
};

export function ProjetoKanban({ etapas, projetosByEtapa, onMoveProjeto, onViewProjeto }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, projetoId: string) => {
    setDraggedId(projetoId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, etapaId: string) => {
    e.preventDefault();
    if (draggedId) {
      onMoveProjeto(draggedId, etapaId);
      setDraggedId(null);
    }
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
        {etapas.map(etapa => {
          const items = projetosByEtapa.get(etapa.id) || [];
          return (
            <div
              key={etapa.id}
              className="w-72 flex-shrink-0"
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, etapa.id)}
            >
              {/* Column header */}
              <div
                className="rounded-t-lg px-4 py-3 font-semibold text-sm flex items-center justify-between"
                style={{ backgroundColor: etapa.cor, color: "white" }}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-xs">{CATEGORIA_ICON[etapa.categoria] || ""}</span>
                  {etapa.nome}
                </span>
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                  {items.length}
                </Badge>
              </div>

              {/* Column body */}
              <div className="bg-muted/30 rounded-b-lg p-2 min-h-[400px] space-y-2 border border-t-0">
                {items.map(projeto => (
                  <Card
                    key={projeto.id}
                    draggable
                    onDragStart={e => handleDragStart(e, projeto.id)}
                    onClick={() => onViewProjeto?.(projeto)}
                    className={cn(
                      "cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-border/60",
                      draggedId === projeto.id && "opacity-50"
                    )}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-tight">
                          {projeto.cliente?.nome || projeto.codigo || "Projeto sem nome"}
                        </p>
                        {projeto.codigo && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {projeto.codigo}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
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
                        <p className="text-sm font-bold text-right">{formatBRL(projeto.valor_total)}</p>
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
