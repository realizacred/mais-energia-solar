import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  Clock, 
  AlertTriangle, 
  Lock, 
  ChevronRight, 
  TrendingUp,
  CircleDollarSign,
  UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { calculateOperationalScore } from "@/lib/operational-score";
import type { ProjetoItem, ProjetoEtapa } from "@/hooks/useProjetoPipeline";
import { differenceInDays } from "date-fns";

interface Props {
  projetos: ProjetoItem[];
  etapas: ProjetoEtapa[];
  onViewProjeto: (p: ProjetoItem) => void;
}

export function OperationalQueue({ projetos, etapas, onViewProjeto }: Props) {
  const etapaMap = useMemo(() => new Map(etapas.map(e => [e.id, e])), [etapas]);

  const prioritizedProjetos = useMemo(() => {
    return projetos
      .map(p => {
        const stage = p.etapa_id ? etapaMap.get(p.etapa_id) : null;
        const score = calculateOperationalScore({
          ...p,
          sla_days: stage?.sla_days || 0,
          stage_name: stage?.nome || ""
        });
        return { ...p, operational_score: score };
      })
      .filter(p => p.operational_score > 0)
      .sort((a, b) => b.operational_score - a.operational_score)
      .slice(0, 10);
  }, [projetos, etapaMap]);

  if (prioritizedProjetos.length === 0) return null;

  return (
    <Card className="border-border/60 shadow-sm bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <CardTitle className="text-base font-bold">PRIORIDADE AGORA</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-background">
            Fila Inteligente
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="divide-y divide-border/40">
          {prioritizedProjetos.map((p) => (
            <QueueItem 
              key={p.id} 
              projeto={p} 
              etapa={p.etapa_id ? etapaMap.get(p.etapa_id) : undefined}
              onClick={() => onViewProjeto(p)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QueueItem({ projeto, etapa, onClick }: { projeto: any, etapa?: ProjetoEtapa, onClick: () => void }) {
  const isBlocked = (projeto.observacoes?.toLowerCase().includes("bloqueado")) || projeto.pendencias?.some((pend: any) => pend.bloqueia_fluxo);
  const score = projeto.operational_score;
  const slaDays = etapa?.sla_days || 0;
  const daysInStage = differenceInDays(new Date(), new Date(projeto.data_entrada_etapa || projeto.updated_at));
  const isOverdue = slaDays > 0 && daysInStage >= slaDays;

  return (
    <div 
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex flex-col items-center justify-center min-w-[40px]">
        <span className={cn(
          "text-sm font-black tabular-nums",
          score > 150 ? "text-destructive" : score > 100 ? "text-orange-600" : "text-primary"
        )}>
          {score}
        </span>
        <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Score</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-bold text-foreground truncate">{projeto.cliente?.nome || "Sem nome"}</p>
          {isBlocked && (
            <Badge variant="destructive" className="h-4 text-[8px] px-1 font-bold animate-pulse">
              <Lock className="w-2 h-2 mr-0.5" /> BLOQUEADO
            </Badge>
          )}
          {isOverdue && (
            <Badge variant="outline" className="h-4 text-[8px] px-1 font-bold border-destructive text-destructive bg-destructive/5">
              SLA VENCIDO
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
          <span className="truncate">{etapa?.nome || "Sem etapa"}</span>
          <span>•</span>
          <span className="flex items-center gap-1 shrink-0">
            <CircleDollarSign className="w-3 h-3 text-success" />
            {formatBRL(projeto.valor_total || 0)}
          </span>
          {projeto.responsavel_operacional && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 shrink-0 font-bold uppercase text-[9px]">
                <UserCog className="w-2.5 h-2.5" />
                {projeto.responsavel_operacional}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 gap-1">
        <div className="flex items-center gap-1 text-[10px] font-bold text-foreground">
          <Clock className="w-3 h-3 text-muted-foreground" />
          {daysInStage}d
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
      </div>
    </div>
  );
}
