import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Servico } from "./types";

interface ReagendarDialogProps {
  servico: Servico | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReagendarDialog({ servico, isOpen, onClose, onSuccess }: ReagendarDialogProps) {
  const [novaData, setNovaData] = useState<Date | undefined>();
  const [novaHora, setNovaHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!servico || !novaData) {
      toast({
        title: "Selecione a nova data",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("servicos_agendados")
        .update({
          data_agendada: format(novaData, "yyyy-MM-dd"),
          hora_inicio: novaHora || null,
          status: "reagendado",
          observacoes: motivo ? `Reagendado: ${motivo}` : null,
        })
        .eq("id", servico.id);

      if (error) throw error;

      toast({ title: "Serviço reagendado com sucesso!" });
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error rescheduling:", error);
      toast({
        title: "Erro ao reagendar serviço",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNovaData(undefined);
    setNovaHora("");
    setMotivo("");
    onClose();
  };

  if (!servico) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar Serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            Data atual: <strong>{format(new Date(servico.data_agendada), "dd/MM/yyyy", { locale: ptBR })}</strong>
            {servico.hora_inicio && ` às ${servico.hora_inicio.slice(0, 5)}`}
          </div>

          <div className="space-y-2">
            <Label>Nova Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !novaData && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {novaData ? format(novaData, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={novaData}
                  onSelect={setNovaData}
                  locale={ptBR}
                  disabled={(date) => date < new Date()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Novo Horário</Label>
            <Input
              type="time"
              value={novaHora}
              onChange={(e) => setNovaHora(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Motivo do Reagendamento</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !novaData}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Reagendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
