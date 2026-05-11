import { Bot, Clock, ShieldCheck, Zap, Power } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PreventiveScenario } from "@/hooks/usePreventiveScenarios";

interface Props {
  scenario: PreventiveScenario;
}

const dominioMeta: Record<
  PreventiveScenario["dominio"],
  { label: string; borderClass: string; badgeClass: string }
> = {
  comercial: {
    label: "Comercial",
    borderClass: "border-l-primary",
    badgeClass: "bg-primary/10 text-primary border-primary/30",
  },
  pos_venda: {
    label: "Pós-Venda",
    borderClass: "border-l-success",
    badgeClass: "bg-success/10 text-success border-success/30",
  },
  engenharia: {
    label: "Engenharia",
    borderClass: "border-l-warning",
    badgeClass: "bg-warning/10 text-warning border-warning/30",
  },
  financeiro: {
    label: "Financeiro",
    borderClass: "border-l-info",
    badgeClass: "bg-info/10 text-info border-info/30",
  },
};

export function PreventiveScenarioCard({ scenario }: Props) {
  const meta = dominioMeta[scenario.dominio] ?? dominioMeta.comercial;
  return (
    <Card
      className={cn(
        "border border-border border-l-[3px] bg-card shadow-sm hover:shadow-md transition-all",
        meta.borderClass,
        !scenario.ativo && "opacity-70"
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={cn("text-[10px]", meta.badgeClass)}>
                {meta.label}
              </Badge>
              {scenario.ativo ? (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 bg-success/10 text-success border-success/30"
                >
                  <Power className="h-2.5 w-2.5" /> Ativo
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 bg-muted text-muted-foreground"
                >
                  <Power className="h-2.5 w-2.5" /> Inativo
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-tight truncate">
              {scenario.nome}
            </h3>
            {scenario.descricao && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {scenario.descricao}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {scenario.usa_ia && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/30">
              <Bot className="h-3 w-3" /> IA
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border tabular-nums">
            <Clock className="h-3 w-3" /> {scenario.cooldown_horas}h cooldown
          </span>
          {scenario.requer_aprovacao && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/30">
              <ShieldCheck className="h-3 w-3" /> Aprovação
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border tabular-nums">
            <Zap className="h-3 w-3" /> {scenario.volume_estimado}/30d
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-2">
          <span className="truncate">
            Gatilho: <span className="font-mono">{scenario.gatilho ?? "—"}</span>
          </span>
          <span className="font-mono opacity-70">{scenario.executor}</span>
        </div>
      </CardContent>
    </Card>
  );
}
