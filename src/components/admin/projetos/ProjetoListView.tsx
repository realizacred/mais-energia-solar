import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, Zap, ChevronRight } from "lucide-react";
import type { ProjetoItem, ProjetoEtapa } from "@/hooks/useProjetoPipeline";

interface Props {
  projetos: ProjetoItem[];
  etapas: ProjetoEtapa[];
  onViewProjeto?: (projeto: ProjetoItem) => void;
}

const formatBRL = (v: number | null) => {
  if (!v) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
};

export function ProjetoListView({ projetos, etapas, onViewProjeto }: Props) {
  const etapaMap = new Map(etapas.map(e => [e.id, e]));

  if (projetos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="font-medium">Nenhum projeto encontrado</p>
          <p className="text-sm mt-1">Crie um novo projeto ou ajuste os filtros.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {projetos.map(projeto => {
        const etapa = projeto.etapa_id ? etapaMap.get(projeto.etapa_id) : null;
        return (
          <Card
            key={projeto.id}
            className="hover:shadow-md transition-shadow cursor-pointer border-border/60"
            onClick={() => onViewProjeto?.(projeto)}
          >
            <CardContent className="flex items-center gap-4 py-3 px-4">
              {etapa && (
                <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: etapa.cor }} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">
                    {projeto.cliente?.nome || projeto.codigo || "Sem nome"}
                  </p>
                  {etapa && (
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: etapa.cor, color: etapa.cor }}>
                      {etapa.nome}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {projeto.codigo && <span>{projeto.codigo}</span>}
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
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">{formatBRL(projeto.valor_total)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
