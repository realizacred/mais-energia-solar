import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCirclePlus } from "lucide-react";

interface WaStartConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: Array<{ id: string; nome: string; status: string }>;
  onConversationStarted: (conversationId: string) => void;
}

function canonicalizePreview(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  let phone = digits.startsWith("55") ? digits : "55" + digits;
  if (phone.length === 12) phone = phone.substring(0, 4) + "9" + phone.substring(4);
  if (phone.length !== 13) return null;
  return phone;
}

export function WaStartConversationDialog({
  open,
  onOpenChange,
  instances,
  onConversationStarted,
}: WaStartConversationDialogProps) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const phonePreview = canonicalizePreview(phone);
  const isValid = !!phonePreview;

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setPhone("");
      setName("");
      setMessage("");
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = { p_phone_raw: phone.trim() };
      if (name.trim()) params.p_name_optional = name.trim();
      if (message.trim()) params.p_message_optional = message.trim();

      const { data, error } = await (supabase.rpc as any)(
        "rpc_recall_or_start_conversation",
        params
      );
      if (error) throw error;

      const result = data as { conversation_id: string; reused: boolean };
      toast({ title: result.reused ? "Conversa reaberta" : "Nova conversa criada" });
      onConversationStarted(result.conversation_id);
      handleOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erro ao iniciar conversa",
        description: err.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCirclePlus className="h-5 w-5 text-success" />
            Nova conversa
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem para um número novo ou reabra uma conversa existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sc-phone">Telefone *</Label>
            <Input
              id="sc-phone"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              autoComplete="off"
              name="sc-phone-field"
            />
            {phone.length >= 10 && (
              <p className={`text-xs ${isValid ? "text-success" : "text-destructive"}`}>
                {isValid
                  ? `✓ Normalizado: +${phonePreview}`
                  : "✗ Formato inválido — use DDD + número"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sc-name">Nome (opcional)</Label>
            <Input
              id="sc-name"
              placeholder="Nome do contato"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoComplete="off"
              name="sc-name-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sc-message">Mensagem inicial (opcional)</Label>
            <Textarea
              id="sc-message"
              placeholder="Olá! Gostaria de..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              className="min-h-[80px]"
              autoComplete="off"
              name="sc-message-field"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isValid}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
