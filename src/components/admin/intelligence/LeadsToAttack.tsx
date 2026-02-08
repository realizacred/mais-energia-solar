import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Phone, Clock, Zap, ArrowRight, TrendingUp } from "lucide-react";
import type { Lead } from "@/types/lead";
import type { LeadScore } from "@/hooks/useLeadScoring";

interface LeadsToAttackProps {
  leads: Lead[];
  scores: LeadScore[];
  onLeadClick?: (lead: Lead) => void;
}

const NIVEL_CONFIG = {
  hot: { label: "Quente", color: "bg-destructive/10 text-destructive border-destructive/20", icon: Flame },
  warm: { label: "Morno", color: "bg-warning/10 text-warning border-warning/20", icon: TrendingUp },
  cold: { label: "Frio", color: "bg-info/10 text-info border-info/20", icon: Clock },
} as const;

export function LeadsToAttack({ leads, scores, onLeadClick }: LeadsToAttackProps) {
  const leadsParaAtacar = useMemo(() => {
    const scoreMap = new Map(scores.map(s => [s.lead_id, s]));
    
    return leads
      .map(lead => ({ lead, score: scoreMap.get(lead.id) }))
      .filter(({ score }) => score && score.nivel !== "cold")
      .sort((a, b) => (b.score?.score || 0) - (a.score?.score || 0))
      .slice(0, 10);
  }, [leads, scores]);

  const hotCount = scores.filter(s => s.nivel === "hot").length;
  const warmCount = scores.filter(s => s.nivel === "warm").length;

  return (
    <Card className="border-destructive/20 bg-gradient-to-br from-card to-destructive/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-destructive/10">
              <Flame className="h-4 w-4 text-destructive" />
            </div>
            Leads para Atacar Hoje
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
              🔥 {hotCount} quentes
            </Badge>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
              ⚡ {warmCount} mornos
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {leadsParaAtacar.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <p>Nenhum lead com score calculado.</p>
            <p className="text-xs mt-1">Clique em "Recalcular Scores" para analisar seus leads.</p>
          </div>
        ) : (
          leadsParaAtacar.map(({ lead, score }) => {
            if (!score) return null;
            const nivelConfig = NIVEL_CONFIG[score.nivel];
            const NivelIcon = nivelConfig.icon;

            return (
              <div
                key={lead.id}
                onClick={() => onLeadClick?.(lead)}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/80 hover:bg-accent/50 cursor-pointer transition-all group"
              >
                {/* Score badge */}
                <div className="flex flex-col items-center min-w-[48px]">
                  <span className="text-lg font-bold text-foreground">{score.score}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${nivelConfig.color}`}>
                    <NivelIcon className="h-2.5 w-2.5 mr-0.5" />
                    {nivelConfig.label}
                  </Badge>
                </div>

                {/* Lead info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{lead.nome}</p>
                    {lead.lead_code && (
                      <span className="text-[10px] text-muted-foreground font-mono">{lead.lead_code}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {lead.media_consumo}kWh
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lead.cidade}/{lead.estado}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(score.probabilidade_fechamento * 100)}% chance
                    </span>
                  </div>
                  {score.recomendacao && (
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {score.recomendacao}
                    </p>
                  )}
                </div>

                {/* Action */}
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
