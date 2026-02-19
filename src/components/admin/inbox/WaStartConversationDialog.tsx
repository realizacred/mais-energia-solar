import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCirclePlus } from "lucide-react";

interface WaInstance {
  id: string;
  nome: string;
  status: string;
}

interface WaStartConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: WaInstance[];
  onConversationStarted: (conversationId: string) => void;
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
  const [instanceId, setInstanceId] = useState<string>("auto");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const connectedInstances = instances.filter((i) => i.status === "connected");

  const handleSubmit = async () => {
    if (!phone.trim()) {
      toast({ title: "Telefone obrigatório", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        p_phone_raw: phone.trim(),
      };
      if (name.trim()) params.p_name_optional = name.trim();
      if (message.trim()) params.p_message_optional = message.trim();
      if (instanceId !== "auto") params.p_instance_preference = instanceId;

      const { data, error } = await (supabase.rpc as any)(
        "start_conversation_by_phone",
        params
      );

      if (error) throw error;

      const result = data as { conversation_id: string };
      toast({ title: "Conversa iniciada" });
      onConversationStarted(result.conversation_id);
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error("[StartConversation] Error:", err);
      toast({
        title: "Erro ao iniciar conversa",
        description: err.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPhone("");
    setName("");
    setMessage("");
    setInstanceId("auto");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCirclePlus className="h-5 w-5 text-success" />
            Iniciar Conversa
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
            />
            <p className="text-xs text-muted-foreground">
              DDD + número. O sistema normaliza automaticamente para E.164.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sc-name">Nome (opcional)</Label>
            <Input
              id="sc-name"
              placeholder="Nome do contato"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sc-message">Mensagem inicial (opcional)</Label>
            <Textarea
              id="sc-message"
              placeholder="Digite uma mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              className="min-h-[80px]"
            />
          </div>

          {connectedInstances.length > 1 && (
            <div className="space-y-2">
              <Label>Instância</Label>
              <Select value={instanceId} onValueChange={setInstanceId} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Automático" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  {connectedInstances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !phone.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
