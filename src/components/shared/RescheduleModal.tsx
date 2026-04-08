import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Calendar, Clock, MessageCircle, CalendarClock } from "lucide-react";
import { useReagendamentos } from "@/hooks/useReagendamento";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  currentStartsAt: string;
}

export function RescheduleModal({ open, onOpenChange, appointmentId, currentStartsAt }: Props) {
  const { reagendar, isReagendando } = useReagendamentos();

  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [motivo, setMotivo] = useState("");
  const [notificarWa, setNotificarWa] = useState(true);

  const currentDate = new Date(currentStartsAt);
  const currentFormatted = currentDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const currentTime = currentDate.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSubmit = () => {
    if (!date || !motivo.trim()) return;

    const novaData = new Date(`${date}T${time}:00`).toISOString();

    reagendar(
      {
        appointment_id: appointmentId,
        nova_data: novaData,
        motivo: motivo.trim(),
        notificar_wa: notificarWa,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setDate("");
          setTime("09:00");
          setMotivo("");
          setNotificarWa(true);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-warning/10 shrink-0">
              <CalendarClock className="w-5 h-5 text-warning" />
            </div>
            Reagendar Instalação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Data atual */}
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Data atual</p>
            <p className="text-sm font-medium text-foreground">
              {currentFormatted} às {currentTime}
            </p>
          </div>

          {/* Nova data e hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Nova data *
              </Label>
              <DateInput value={date} onChange={setDate} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Novo horário *
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Motivo do reagendamento *</Label>
            <Textarea
              placeholder="Informe o motivo do reagendamento..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Toggle WA */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-success" />
              <div>
                <p className="text-xs font-medium text-foreground">Notificar cliente via WhatsApp</p>
                <p className="text-xs text-muted-foreground">Envia mensagem com nova data e motivo</p>
              </div>
            </div>
            <Switch checked={notificarWa} onCheckedChange={setNotificarWa} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isReagendando}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isReagendando || !date || !motivo.trim()}
              className="gap-1.5"
            >
              {isReagendando ? <Spinner size="sm" /> : <CalendarClock className="h-3.5 w-3.5" />}
              {isReagendando ? "Reagendando..." : "Confirmar Reagendamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
