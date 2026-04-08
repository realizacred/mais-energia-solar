import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Clock } from "lucide-react";
import { useReagendamentos, type Reagendamento } from "@/hooks/useReagendamento";

interface Props {
  appointmentId: string;
}

export function ReagendamentoTimeline({ appointmentId }: Props) {
  const { reagendamentos, isLoading } = useReagendamentos(appointmentId);

  if (isLoading || reagendamentos.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
        <CalendarClock className="h-3 w-3" />
        Reagendamentos ({reagendamentos.length})
      </p>
      <div className="space-y-1.5 pl-2 border-l-2 border-warning/30">
        {reagendamentos.map((r) => (
          <div key={r.id} className="pl-3 py-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span>
                {format(new Date(r.data_anterior), "dd/MM · HH:mm", { locale: ptBR })}
                {" → "}
                <span className="text-foreground font-medium">
                  {format(new Date(r.nova_data), "dd/MM · HH:mm", { locale: ptBR })}
                </span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 italic">"{r.motivo}"</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {r.notificou_wa && " · WA enviado ✓"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
