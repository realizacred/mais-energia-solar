import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, MessageCircle, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types/lead";

interface MinimalLead {
  id?: string;
  nome: string;
  telefone: string;
}

export interface OrcamentoContext {
  orc_code: string | null;
  cidade: string;
  estado: string;
  media_consumo: number;
  created_at: string;
}

interface ScheduleWhatsAppDialogProps {
  lead: MinimalLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendedorNome?: string;
  onSuccess?: () => void;
  /** Optional: pass orcamento context for proposal-specific messages */
  orcamentoContext?: OrcamentoContext | null;
}

const getTemplates = (hasOrcamento: boolean) => [
  {
    id: "followup",
    label: "Follow-up Padrão",
    message: "Olá {nome}! Tudo bem? Passando para saber se ainda tem interesse em energia solar. Posso te enviar uma proposta personalizada?",
  },
  {
    id: "proposta",
    label: "Envio de Proposta",
    message: hasOrcamento
      ? "Olá {nome}! Sua proposta {orc_code} para {cidade}/{estado} com consumo de {consumo} kWh está pronta. Posso te enviar os detalhes?"
      : "Olá {nome}! Preparei uma proposta especial para você economizar na conta de luz. Posso te enviar agora?",
  },
  {
    id: "urgente",
    label: "Oferta Urgente",
    message: "Olá {nome}! Estamos com uma condição especial por tempo limitado. Gostaria de saber mais sobre energia solar?",
  },
  ...(hasOrcamento ? [{
    id: "referencia",
    label: "Referência à Proposta",
    message: "Olá {nome}! Vi que você solicitou um orçamento ({orc_code}) para {cidade}/{estado}. Posso te ajudar com mais informações?",
  }] : []),
];

export function ScheduleWhatsAppDialog({
  lead,
  open,
  onOpenChange,
  vendedorNome,
  onSuccess,
  orcamentoContext,
}: ScheduleWhatsAppDialogProps) {
  const [message, setMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const hasOrcamento = !!orcamentoContext;
  const TEMPLATES = getTemplates(hasOrcamento);

  // Replace placeholders in template
  const processTemplate = (template: string) => {
    let result = template
      .replace("{nome}", lead?.nome.split(" ")[0] || "")
      .replace("{vendedor}", vendedorNome || "");
    
    if (orcamentoContext) {
      result = result
        .replace("{orc_code}", orcamentoContext.orc_code || "s/n")
        .replace("{cidade}", orcamentoContext.cidade)
        .replace("{estado}", orcamentoContext.estado)
        .replace("{consumo}", String(orcamentoContext.media_consumo));
    }
    
    return result;
  };

  const handleSelectTemplate = (templateMessage: string) => {
    setMessage(processTemplate(templateMessage));
  };

  // Send immediately via API (same as admin)
  const handleSendNow = async () => {
    if (!lead || !message) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          telefone: lead.telefone,
          mensagem: message.trim(),
          lead_id: lead.id || null,
          tipo: "manual",
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Mensagem enviada!",
          description: `Mensagem enviada para ${lead.nome}`,
        });

        // Update ultimo_contato
        if (lead.id) {
          await supabase
            .from("leads")
            .update({ ultimo_contato: new Date().toISOString() })
            .eq("id", lead.id);
        }

        setMessage("");
        onOpenChange(false);
        onSuccess?.();
      } else {
        throw new Error(data?.error || "Falha ao enviar mensagem");
      }
    } catch (error: any) {
      console.error("Error sending WhatsApp:", error);
      toast({
        title: "Erro ao enviar",
        description: error?.message || "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Schedule for later
  const handleSchedule = async () => {
    if (!lead || !message || !selectedDate) {
      toast({
        title: "Dados incompletos",
        description: "Selecione uma data e escreva a mensagem.",
        variant: "destructive",
      });
      return;
    }

    setScheduling(true);

    try {
      // Combine date and time
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledDate = new Date(selectedDate);
      scheduledDate.setHours(hours, minutes, 0, 0);

      const { error } = await supabase.from("whatsapp_reminders").insert({
        lead_id: lead.id,
        vendedor_nome: vendedorNome,
        data_agendada: scheduledDate.toISOString(),
        tipo: "customizado",
        mensagem: message,
        status: "pendente",
      });

      if (error) throw error;

      toast({
        title: "Lembrete agendado!",
        description: `Mensagem será enviada em ${format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error scheduling reminder:", error);
      toast({
        title: "Erro ao agendar",
        description: "Não foi possível agendar o lembrete.",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Enviar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem para {lead.nome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Templates */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Templates Rápidos</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((template) => (
                <Badge
                  key={template.id}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => handleSelectTemplate(template.message)}
                >
                  {template.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Mensagem</p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Digite sua mensagem..."
            />
          </div>

          {/* Schedule Options */}
          <div className="space-y-2 p-3 rounded-lg border bg-muted/50">
            <p className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Agendar para depois (opcional)
            </p>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={ptBR}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="px-3 py-2 rounded-md border text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => 
                  ["00", "30"].map(m => `${h.toString().padStart(2, "0")}:${m}`)
                ).flat().map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {selectedDate ? (
            <Button 
              onClick={handleSchedule} 
              disabled={!message || scheduling}
              className="w-full sm:w-auto"
            >
              {scheduling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Clock className="h-4 w-4 mr-2" />
              )}
              Agendar Envio
            </Button>
          ) : (
            <Button 
              onClick={handleSendNow} 
              disabled={!message || sending}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Agora
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
