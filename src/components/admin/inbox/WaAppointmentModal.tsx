import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Phone, Users, FileText, Bell, CalendarCheck } from "lucide-react";
import { useAppointments, type AppointmentType, type CreateAppointmentInput } from "@/hooks/useAppointments";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Badge } from "@/components/ui/badge";

const TYPE_OPTIONS: { value: AppointmentType; label: string; icon: typeof Phone }[] = [
  { value: "call", label: "Ligação", icon: Phone },
  { value: "meeting", label: "Reunião", icon: Users },
  { value: "followup", label: "Follow-up", icon: CalendarCheck },
  { value: "visit", label: "Visita", icon: Calendar },
  { value: "other", label: "Outro", icon: FileText },
];

const REMINDER_OPTIONS = [
  { value: 0, label: "Sem lembrete" },
  { value: 5, label: "5 minutos antes" },
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 dia antes" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
  leadId?: string;
  clienteId?: string;
  clienteNome?: string;
}

export function WaAppointmentModal({
  open,
  onOpenChange,
  conversationId,
  leadId,
  clienteId,
  clienteNome,
}: Props) {
  const { createAppointment, isCreating, agendaConfig } = useAppointments();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [appointmentType, setAppointmentType] = useState<AppointmentType>("call");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [reminderMinutes, setReminderMinutes] = useState(15);

  const handleSubmit = () => {
    if (!title.trim() || !date) return;

    const startsAt = new Date(`${date}T${time}:00`).toISOString();
    const endsAt = new Date(
      new Date(`${date}T${time}:00`).getTime() + parseInt(duration) * 60 * 1000
    ).toISOString();

    const input: CreateAppointmentInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      appointment_type: appointmentType,
      starts_at: startsAt,
      ends_at: endsAt,
      reminder_minutes: reminderMinutes,
      conversation_id: conversationId,
      lead_id: leadId,
      cliente_id: clienteId,
    };

    createAppointment(input, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAppointmentType("call");
    setDate("");
    setTime("09:00");
    setDuration("60");
    setReminderMinutes(15);
  };

  const googleSyncActive = agendaConfig?.google_sync_enabled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            Agendar Compromisso
            {clienteNome && (
              <Badge variant="outline" className="text-xs font-normal">
                {clienteNome}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Título *</Label>
            <Input
              placeholder="Ex: Ligar para agendar visita"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tipo</Label>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = appointmentType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAppointmentType(opt.value)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                      ${isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                      }
                    `}
                  >
                    <Icon className="h-3 w-3" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data *
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Hora
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Duration & Reminder */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Duração</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Bell className="h-3 w-3" />
                Lembrete
              </Label>
              <Select
                value={String(reminderMinutes)}
                onValueChange={(v) => setReminderMinutes(Number(v))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notas</Label>
            <Textarea
              placeholder="Observações sobre o compromisso..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Google sync indicator */}
          {googleSyncActive && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/50">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>Será sincronizado com Google Calendar</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isCreating || !title.trim() || !date}
              className="gap-1.5"
            >
              {isCreating ? (
                <Spinner size="sm" />
              ) : (
                <CalendarCheck className="h-3.5 w-3.5" />
              )}
              {isCreating ? "Agendando..." : "Agendar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
