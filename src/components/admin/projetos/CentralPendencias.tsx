import { useMemo } from "react";
import { AlertCircle, FileText, CheckCircle2, ChevronRight, LayoutGrid, Filter, Search, Info, Clock, CalendarDays, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import type { ProjetoItem } from "@/hooks/useProjetoPipeline";

interface Props {
  projetos: ProjetoItem[];
  onViewProjeto: (p: ProjetoItem, tab?: string) => void;
  loading?: boolean;
}

/**
 * CentralPendencias — Dashboard de acompanhamento para projetos em 'aguardando_documentacao'.
 * RB-107/108: Projetos salvos pendentes precisam de acompanhamento visual.
 */
export function CentralPendencias({ projetos, onViewProjeto, loading }: Props) {
  const pendentes = useMemo(() => 
    projetos.filter(p => p.status === "aguardando_documentacao"),
    [projetos]
  );

  if (pendentes.length === 0 && !loading) return null;

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Central de Pendências</h2>
            <p className="text-xs text-muted-foreground">Projetos aguardando documentação para seguir no funil</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-500/20 px-2 py-1 gap-1.5 font-bold">
          <Clock className="w-3.5 h-3.5" />
          {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pendentes.map((p) => (
          <PendenciaCard key={p.id} projeto={p} onClick={() => onViewProjeto(p, "documentos")} />
        ))}
      </div>
    </div>
  );
}

function PendenciaCard({ projeto, onClick }: { projeto: ProjetoItem; onClick: () => void }) {
  return (
    <Card 
      className="group cursor-pointer hover:border-amber-500/40 transition-all border-l-4 border-l-amber-500 shadow-sm bg-card/50 hover:bg-card"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold text-amber-600 uppercase tracking-tighter mb-0.5 opacity-80">{projeto.codigo}</p>
            <h3 className="text-sm font-bold text-foreground truncate group-hover:text-amber-700 transition-colors">
              {projeto.cliente?.nome || "Sem nome"}
            </h3>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-1.5 rounded-full bg-muted group-hover:bg-amber-500/10 transition-colors">
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-600" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Ver documentos pendentes</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 font-medium">
            <DollarSign className="w-3 h-3 text-success" />
            {formatBRL(projeto.valor_total || 0)}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {new Date(projeto.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Documentação
            </span>
            <span className="text-amber-600">Aguardando</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 w-1/4 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <span className="text-[10px] font-bold text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Resolver agora <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
