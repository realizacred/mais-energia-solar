import { useState } from "react";
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  CalendarCheck,
  Phone,
  Users,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useAppointments, type Appointment, type AppointmentStatus } from "@/hooks/useAppointments";
import { useAuth } from "@/hooks/useAuth";

const TYPE_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  meeting: Users,
  followup: CalendarCheck,
  visit: Calendar,
  other: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  call: "Ligação",
  meeting: "Reunião",
  followup: "Follow-up",
  visit: "Visita",
  other: "Outro",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendado", variant: "outline" },
  completed: { label: "Concluído", variant: "default" },
  cancelled: { label: "Cancelado", variant: "secondary" },
  missed: { label: "Perdido", variant: "destructive" },
};

export function VendorAppointments() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"upcoming" | "past">("upcoming");

  const now = new Date();
  const filters = statusFilter === "upcoming"
    ? { assigned_to: user?.id, from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString() }
    : { assigned_to: user?.id };

  const { appointments, isLoading, updateAppointment, cancelAppointment } = useAppointments(filters);

  const filtered = statusFilter === "upcoming"
    ? appointments.filter(a => a.status === "scheduled")
    : appointments.filter(a => a.status !== "scheduled");

  // Group upcoming by day
  const todayAppts = filtered.filter(a => isToday(new Date(a.starts_at)));
  const tomorrowAppts = filtered.filter(a => isTomorrow(new Date(a.starts_at)));
  const laterAppts = filtered.filter(a => {
    const d = new Date(a.starts_at);
    return !isToday(d) && !isTomorrow(d) && !isPast(d);
  });

  const groups = statusFilter === "upcoming"
    ? [
        { label: "📌 Hoje", items: todayAppts },
        { label: "📅 Amanhã", items: tomorrowAppts },
        { label: "📋 Próximos", items: laterAppts },
      ].filter(g => g.items.length > 0)
    : [{ label: "Histórico", items: filtered }];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
            <CalendarCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Meus Compromissos</h3>
            <p className="text-xs text-muted-foreground">
              {todayAppts.length} hoje · {tomorrowAppts.length} amanhã
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        <Button
          variant={statusFilter === "upcoming" ? "default" : "outline"}
          size="sm"
          className="text-xs h-8"
          onClick={() => setStatusFilter("upcoming")}
        >
          <Clock className="h-3 w-3 mr-1" />
          Próximos
        </Button>
        <Button
          variant={statusFilter === "past" ? "default" : "outline"}
          size="sm"
          className="text-xs h-8"
          onClick={() => setStatusFilter("past")}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Histórico
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">{todayAppts.length}</p>
            <p className="text-[10px] text-muted-foreground">Hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">{tomorrowAppts.length}</p>
            <p className="text-[10px] text-muted-foreground">Amanhã</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-success">
              {appointments.filter(a => a.status === "completed").length}
            </p>
            <p className="text-[10px] text-muted-foreground">Concluídos</p>
          </CardContent>
        </Card>
      </div>

      {/* Appointment list */}
      {groups.length === 0 || groups.every(g => g.items.length === 0) ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarCheck className="h-8 w-8 text-success mb-3" />
            <p className="text-base font-semibold">
              {statusFilter === "upcoming" ? "Nenhum compromisso agendado" : "Nenhum registro"}
            </p>
            <p className="text-sm text-muted-foreground">
              {statusFilter === "upcoming" ? "Agende compromissos pelo Inbox" : "Seus compromissos concluídos aparecerão aqui"}
            </p>
          </CardContent>
        </Card>
      ) : (
        groups.map(group => (
          <div key={group.label}>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">{group.label}</h4>
            <div className="space-y-2">
              {group.items.map(appt => {
                const Icon = TYPE_ICONS[appt.appointment_type] || FileText;
                const statusCfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.scheduled;

                return (
                  <Card key={appt.id} className="transition-all duration-200">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <Badge variant={statusCfg.variant} className="text-[10px]">
                              {statusCfg.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {TYPE_LABELS[appt.appointment_type]}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground">{appt.title}</p>
                          {appt.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{appt.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(appt.starts_at), "dd/MM · HH:mm", { locale: ptBR })}
                            {appt.ends_at && ` - ${format(new Date(appt.ends_at), "HH:mm")}`}
                          </p>
                        </div>

                        {/* Actions */}
                        {appt.status === "scheduled" && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Marcar como concluído"
                              onClick={() => updateAppointment({ id: appt.id, status: "completed" })}
                            >
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Cancelar"
                              onClick={() => cancelAppointment(appt.id)}
                            >
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default VendorAppointments;
