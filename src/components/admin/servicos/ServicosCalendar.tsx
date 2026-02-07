import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Servico, Instalador, tipoOptions, statusConfig } from "./types";
import { cn } from "@/lib/utils";

interface ServicosCalendarProps {
  servicos: Servico[];
  instaladores: Instalador[];
  onSelectServico: (servico: Servico) => void;
}

export function ServicosCalendar({ servicos, instaladores, onSelectServico }: ServicosCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getInstaladorNome = (id: string) => {
    return instaladores.find((i) => i.id === id)?.nome || "—";
  };

  const renderHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <h3 className="text-lg font-semibold capitalize">
        {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
      </h3>
      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );

  const renderDays = () => {
    const days = [];
    const dateFormat = "EEEEEE";
    const startDate = startOfWeek(currentMonth, { locale: ptBR });

    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-medium text-muted-foreground text-sm py-2">
          {format(addDays(startDate, i), dateFormat, { locale: ptBR })}
        </div>
      );
    }
    return <div className="grid grid-cols-7">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: ptBR });
    const endDate = endOfWeek(monthEnd, { locale: ptBR });

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const dayServicos = servicos.filter((s) =>
          isSameDay(parseISO(s.data_agendada), day)
        );
        const isCurrentMonth = isSameMonth(day, currentMonth);
        const isToday = isSameDay(day, new Date());

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[100px] border border-border/50 p-1",
              !isCurrentMonth && "bg-muted/30 text-muted-foreground",
              isToday && "bg-primary/5 border-primary/50"
            )}
          >
            <div className={cn(
              "text-sm font-medium mb-1",
              isToday && "text-primary"
            )}>
              {format(day, "d")}
            </div>
            <div className="space-y-1 overflow-hidden max-h-[80px] overflow-y-auto">
              {dayServicos.slice(0, 3).map((servico) => (
                <div
                  key={servico.id}
                  onClick={() => onSelectServico(servico)}
                  className={cn(
                    "text-[10px] p-1 rounded cursor-pointer truncate",
                    servico.status === "concluido" && "bg-green-500/20 text-green-700 dark:text-green-400",
                    servico.status === "em_andamento" && "bg-amber-500/20 text-amber-700 dark:text-amber-400",
                    servico.status === "agendado" && "bg-blue-500/20 text-blue-700 dark:text-blue-400",
                    servico.status === "cancelado" && "bg-red-500/20 text-red-700 dark:text-red-400",
                    servico.status === "reagendado" && "bg-purple-500/20 text-purple-700 dark:text-purple-400"
                  )}
                >
                  {servico.hora_inicio?.slice(0, 5)} {servico.cliente?.nome || tipoOptions.find(t => t.value === servico.tipo)?.label}
                </div>
              ))}
              {dayServicos.length > 3 && (
                <div className="text-[10px] text-muted-foreground text-center">
                  +{dayServicos.length - 3} mais
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
          {days}
        </div>
      );
      days = [];
    }
    return <div>{rows}</div>;
  };

  return (
    <Card>
      <CardContent className="p-4">
        {renderHeader()}
        {renderDays()}
        {renderCells()}
        
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {Object.entries(statusConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1 text-xs">
              <div className={cn(
                "w-3 h-3 rounded",
                key === "agendado" && "bg-blue-500/40",
                key === "em_andamento" && "bg-amber-500/40",
                key === "concluido" && "bg-green-500/40",
                key === "cancelado" && "bg-red-500/40",
                key === "reagendado" && "bg-purple-500/40"
              )} />
              {config.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
