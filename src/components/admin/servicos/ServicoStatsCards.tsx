import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, Play, CheckCircle2, AlertTriangle, ClipboardCheck } from "lucide-react";
import { Servico } from "./types";

interface ServicoStatsCardsProps {
  servicos: Servico[];
}

export function ServicoStatsCards({ servicos }: ServicoStatsCardsProps) {
  const stats = {
    agendados: servicos.filter(s => s.status === "agendado").length,
    emAndamento: servicos.filter(s => s.status === "em_andamento").length,
    concluidos: servicos.filter(s => s.status === "concluido").length,
    pendentesValidacao: servicos.filter(s => s.status === "concluido" && !s.validado).length,
    atrasados: servicos.filter(s => {
      const dataAgendada = new Date(s.data_agendada);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return s.status === "agendado" && dataAgendada < hoje;
    }).length,
  };

  const cards = [
    { label: "Agendados", value: stats.agendados, icon: CalendarClock, color: "info" },
    { label: "Em andamento", value: stats.emAndamento, icon: Play, color: "warning" },
    { label: "Concluídos", value: stats.concluidos, icon: CheckCircle2, color: "success" },
    { label: "Pend. validação", value: stats.pendentesValidacao, icon: ClipboardCheck, color: "secondary" },
    { label: "Atrasados", value: stats.atrasados, icon: AlertTriangle, color: "destructive" },
  ] as const;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className={`card-stat-elevated border-2 border-${card.color}/40 bg-${card.color}/5`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-${card.color}/10`}>
                  <Icon className={`h-5 w-5 text-${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
