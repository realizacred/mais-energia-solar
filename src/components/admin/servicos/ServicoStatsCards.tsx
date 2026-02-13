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

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <CalendarClock className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.agendados}</p>
              <p className="text-xs text-muted-foreground">Agendados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Play className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.emAndamento}</p>
              <p className="text-xs text-muted-foreground">Em Andamento</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.concluidos}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10">
              <ClipboardCheck className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendentesValidacao}</p>
              <p className="text-xs text-muted-foreground">Pend. Validação</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.atrasados}</p>
              <p className="text-xs text-muted-foreground">Atrasados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
