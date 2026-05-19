import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Clock,
  Lock,
  ChevronRight,
  CircleDollarSign,
  UserCog,
  TrendingUp,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRLCompact as formatBRL } from "@/lib/formatters";
import { calculateOperationalScore } from "@/lib/operational-score";
import { isProjetoTerminalForOperationalQueue } from "@/lib/isProjetoTerminal";
import type { ProjetoItem, ProjetoEtapa } from "@/hooks/useProjetoPipeline";
import { differenceInDays } from "date-fns";

interface Props {
  projetos: ProjetoItem[];
  etapas: ProjetoEtapa[];
  onViewProjeto: (p: ProjetoItem) => void;
}

export function OperationalQueue({ projetos, etapas, onViewProjeto }: Props) {
  const etapaMap = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);

  const prioritizedProjetos = useMemo(() => {
    return projetos
      .filter((p) => {
        const stage = p.etapa_id ? etapaMap.get(p.etapa_id) : null;
        return !isProjetoTerminalForOperationalQueue({
          ...p,
          is_terminal: stage?.is_terminal,
          stage_name: stage?.nome || "",
          categoria: (stage as any)?.categoria,
        });
      })
      .map((p) => {
        const stage = p.etapa_id ? etapaMap.get(p.etapa_id) : null;
        const score = calculateOperationalScore({
          ...p,
          sla_days: stage?.sla_days || 0,
          stage_name: stage?.nome || "",
          categoria: (stage as any)?.categoria,
          is_terminal: stage?.is_terminal,
        });
        return { ...p, operational_score: score };
      })
      .filter((p) => p.operational_score > 0)
      .sort((a, b) => b.operational_score - a.operational_score)
      .slice(0, 8);
  }, [projetos, etapaMap]);

  if (prioritizedProjetos.length === 0) return null;

  return (
    <Card className="border border-border bg-card border-l-[3px] border-l-primary shadow-sm">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Flame className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Prioridade Agora</CardTitle>
              <p className="text-[11px] text-muted-foreground font-medium">
                Fila inteligente — ordenada por score operacional
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-background gap-1">
            <TrendingUp className="h-3 w-3" />
            {prioritizedProjetos.length} ativos
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 pt-0 pb-0">
        <div className="divide-y divide-border/60">
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

function QueueItem({
  projeto,
  etapa,
  onClick,
}: {
  projeto: any;
  etapa?: ProjetoEtapa;
  onClick: () => void;
}) {
  const isBlocked =
    projeto.observacoes?.toLowerCase().includes("bloqueado") ||
    projeto.pendencias?.some((pend: any) => pend.bloqueia_fluxo);
  const score: number = projeto.operational_score;
  const slaDays = etapa?.sla_days || 0;
  const daysInStage = differenceInDays(
    new Date(),
    new Date(projeto.data_entrada_etapa || projeto.updated_at),
  );
  const isOverdue = slaDays > 0 && daysInStage >= slaDays;

  const scoreTone =
    score > 150 ? "text-destructive bg-destructive/10 border-destructive/30"
    : score > 100 ? "text-warning bg-warning/10 border-warning/30"
    : "text-primary bg-primary/10 border-primary/30";

  // Motivo do score (primeira razão dominante)
  const reasons: string[] = [];
  if (isBlocked) reasons.push("Bloqueado");
  if (isOverdue) reasons.push(`SLA +${daysInStage - slaDays}d`);
  if (daysInStage >= 7 && !isOverdue) reasons.push(`${daysInStage}d parado`);
  if ((projeto.valor_total || 0) > 50000) reasons.push("Alto valor");
  const motivo = reasons[0] || "Atenção operacional";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors group focus:outline-none focus:bg-muted/40"
    >
      {/* Score */}
      <div
        className={cn(
          "flex flex-col items-center justify-center min-w-[52px] h-12 rounded-lg border tabular-nums",
          scoreTone,
        )}
      >
        <span className="text-base font-bold leading-none">{score}</span>
        <span className="text-[8px] uppercase font-bold tracking-tighter opacity-70 mt-0.5">Score</span>
      </div>

      {/* Cliente + Etapa */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-bold text-foreground truncate">
            {projeto.cliente?.nome || "Sem nome"}
          </p>
          {isBlocked && (
            <Badge variant="destructive" className="h-4 text-[9px] px-1.5 font-bold gap-0.5">
              <Lock className="w-2.5 h-2.5" /> BLOQUEADO
            </Badge>
          )}
          {isOverdue && (
            <Badge variant="outline" className="h-4 text-[9px] px-1.5 font-bold border-warning text-warning bg-warning/10">
              SLA VENCIDO
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
          <span className="truncate">{etapa?.nome || "Sem etapa"}</span>
          <span aria-hidden>•</span>
          <span className="text-foreground/80 font-semibold truncate">{motivo}</span>
        </div>
      </div>

      {/* Valor */}
      <div className="hidden sm:flex flex-col items-end min-w-[80px]">
        <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-foreground">
          <CircleDollarSign className="w-3.5 h-3.5 text-success" />
          {formatBRL(projeto.valor_total || 0)}
        </span>
        <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Valor</span>
      </div>

      {/* Responsável */}
      <div className="hidden sm:flex flex-col items-end min-w-[90px] max-w-[140px]">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground truncate">
          <UserCog className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="truncate">{projeto.responsavel_operacional || projeto.consultor?.nome || "—"}</span>
        </span>
        <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground inline-flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {daysInStage}d na etapa
        </span>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0.5" />
    </button>
  );
}
