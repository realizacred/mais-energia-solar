import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 to 20:00

export function AgendaSheet() {
  const [date, setDate] = useState(new Date());
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  const isViewingToday = isToday(date);

  const formattedDate = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Calendar className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[360px] sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">Agenda do dia</SheetTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setDate(subDays(date, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={isViewingToday ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5 rounded-md"
                onClick={() => setDate(new Date())}
              >
                Hoje
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setDate(addDays(date, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground capitalize">{formattedDate}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-2">
          <div className="relative">
            {/* Current time marker */}
            {isViewingToday && currentHour >= 8 && currentHour <= 20 && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{
                  top: `${((currentHour - 8) * 56) + (currentMinute / 60 * 56)}px`,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                  <div className="h-px flex-1 bg-destructive/60" />
                </div>
              </div>
            )}

            {/* Timeline */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className={cn(
                  "flex gap-3 h-14 border-t border-border/30 group",
                  isViewingToday && hour === currentHour && "bg-primary/5"
                )}
              >
                <span className="text-[10px] font-medium text-muted-foreground w-10 pt-1 shrink-0 tabular-nums">
                  {String(hour).padStart(2, "0")}:00
                </span>
                <div className="flex-1 py-1 min-h-0">
                  {/* Placeholder for events - can be wired to appointments table */}
                </div>
              </div>
            ))}
          </div>

          {/* Empty state */}
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground">Nenhum compromisso agendado</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Os agendamentos aparecerão aqui
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
