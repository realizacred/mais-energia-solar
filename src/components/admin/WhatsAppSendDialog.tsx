import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageSquare, Send, Loader2, User, Phone } from "lucide-react";

interface WhatsAppSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  telefone: string;
  nome: string;
  leadId?: string;
  tipo?: "lead" | "cliente";
}

export function WhatsAppSendDialog({
  open,
  onOpenChange,
  telefone,
  nome,
  leadId,
  tipo = "lead",
}: WhatsAppSendDialogProps) {
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!mensagem.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Digite uma mensagem para enviar",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast({
          title: "Não autenticado",
          description: "Faça login para enviar mensagens",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          telefone,
          mensagem: mensagem.trim(),
          lead_id: leadId || null,
          tipo: "manual",
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Mensagem enviada!",
          description: `Mensagem enviada para ${nome}`,
        });
        setMensagem("");
        onOpenChange(false);
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

  const templates = [
    {
      label: "Saudação",
      text: `Olá ${nome.split(" ")[0]}! Aqui é da Mais Energia Solar. Como posso ajudar você hoje?`,
    },
    {
      label: "Follow-up",
      text: `Olá ${nome.split(" ")[0]}! Tudo bem? Gostaria de saber se você teve a oportunidade de avaliar nossa proposta de energia solar. Posso esclarecer alguma dúvida?`,
    },
    {
      label: "Agradecimento",
      text: `Olá ${nome.split(" ")[0]}! Obrigado pelo contato! Estamos à disposição para qualquer dúvida sobre seu projeto de energia solar.`,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Enviar WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Destinatário */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{nome}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {telefone}
              </p>
            </div>
          </div>

          {/* Templates rápidos */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Mensagens rápidas</Label>
            <div className="flex flex-wrap gap-2">
              {templates.map((t, i) => (
                <Button
                  key={i}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setMensagem(t.text)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea
              id="mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite sua mensagem..."
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !mensagem.trim()}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
