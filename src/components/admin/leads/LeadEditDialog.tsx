import { useState, useEffect } from "react";
import { Pencil, Send, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui-kit/Spinner";
import { FormModalTemplate, FormGrid, FormSection } from "@/components/ui-kit/FormModalTemplate";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getConsultorWaSettings,
  buildAutoMessage,
  sendAutoWelcomeMessage,
} from "@/lib/waAutoMessage";

interface LeadEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  initialData: {
    nome: string;
    telefone: string;
    consultor_id: string | null;
    consultor_nome: string | null;
    cidade?: string;
    estado?: string;
    media_consumo?: number;
    tipo_telhado?: string;
    observacoes?: string | null;
  };
  onSuccess?: () => void;
}

interface Consultor {
  id: string;
  nome: string;
  codigo: string | null;
  ativo: boolean;
}

export function LeadEditDialog({
  open,
  onOpenChange,
  leadId,
  initialData,
  onSuccess,
}: LeadEditDialogProps) {
  const { toast } = useToast();
  const [nome, setNome] = useState(initialData.nome);
  const [telefone, setTelefone] = useState(initialData.telefone);
  const [consultorId, setConsultorId] = useState(initialData.consultor_id || "");
  const [observacoes, setObservacoes] = useState(initialData.observacoes || "");
  const [consultores, setConsultores] = useState<Consultor[]>([]);
  const [loadingConsultores, setLoadingConsultores] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [phoneChanged, setPhoneChanged] = useState(false);

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      setNome(initialData.nome);
      setTelefone(initialData.telefone);
      setConsultorId(initialData.consultor_id || "");
      setObservacoes(initialData.observacoes || "");
      setPhoneChanged(false);
    }
  }, [open, initialData]);

  // Load consultores
  useEffect(() => {
    if (!open) return;
    setLoadingConsultores(true);
    supabase
      .from("consultores" as any)
      .select("id, nome, codigo, ativo")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        setConsultores((data || []) as any as Consultor[]);
        setLoadingConsultores(false);
      });
  }, [open]);

  const handlePhoneChange = (value: string) => {
    setTelefone(value);
    if (value !== initialData.telefone) {
      setPhoneChanged(true);
    }
  };

  const handleSave = async () => {
    if (!nome.trim() || !telefone.trim()) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const selectedConsultor = consultores.find((c) => c.id === consultorId);

      // Update lead
      const leadUpdate: Record<string, unknown> = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        consultor_id: consultorId || null,
        consultor: selectedConsultor?.nome || null,
        observacoes: observacoes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (consultorId && consultorId !== initialData.consultor_id) {
        leadUpdate.distribuido_em = new Date().toISOString();
      }

      const { error: leadErr } = await supabase
        .from("leads")
        .update(leadUpdate)
        .eq("id", leadId);

      if (leadErr) throw leadErr;

      // Also update orcamentos consultor field for consistency
      if (consultorId !== initialData.consultor_id) {
        await supabase
          .from("orcamentos")
          .update({ consultor: selectedConsultor?.nome || null })
          .eq("lead_id", leadId);
      }

      toast({ title: "Lead atualizado ✅" });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResendWelcome = async () => {
    setSendingWa(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        toast({ title: "Não autenticado", variant: "destructive" });
        return;
      }

      // Get consultant settings for template
      const selectedConsultor = consultores.find((c) => c.id === consultorId);
      let template: string | undefined;

      if (consultorId) {
        const settings = await getConsultorWaSettings(consultorId);
        if (!settings.wa_auto_message_enabled) {
          toast({
            title: "Mensagem automática desativada",
            description: "O consultor selecionado desativou mensagens automáticas.",
            variant: "destructive",
          });
          return;
        }
        template = settings.wa_auto_message_template;
      }

      const mensagem = buildAutoMessage({
        nome: nome.trim(),
        cidade: initialData.cidade,
        estado: initialData.estado,
        consumo: initialData.media_consumo,
        tipo_telhado: initialData.tipo_telhado,
        consultor_nome: selectedConsultor?.nome,
        template,
      });

      const result = await sendAutoWelcomeMessage({
        telefone: telefone.trim(),
        leadId,
        mensagem,
        userId,
        forceResend: true,
      });

      if (result.sent) {
        // Update wa_welcome_status
        await supabase
          .from("leads")
          .update({ wa_welcome_status: "sent", wa_welcome_error: null } as any)
          .eq("id", leadId);

        toast({ title: "WhatsApp enviado ✅", description: `Mensagem enviada para ${nome.split(" ")[0]}` });
        onSuccess?.();
      } else {
        toast({
          title: "Falha no envio",
          description: result.reason || "Não foi possível enviar",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro ao enviar WhatsApp",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSendingWa(false);
    }
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Lead"
      submitLabel="Salvar"
      onSubmit={handleSave}
      saving={saving}
      disabled={!nome.trim() || !telefone.trim()}
      className="w-[90vw] max-w-[700px]"
    >
      <FormSection title="Dados do Lead">
        <FormGrid>
          <div className="space-y-2">
            <Label htmlFor="lead-nome">Nome</Label>
            <Input
              id="lead-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-telefone">Telefone</Label>
            <PhoneInput
              id="lead-telefone"
              value={telefone}
              onChange={handlePhoneChange}
              disabled={saving}
            />
            {phoneChanged && (
              <p className="text-xs text-warning">Telefone alterado — reenvie a mensagem de boas-vindas abaixo</p>
            )}
          </div>
        </FormGrid>
      </FormSection>

      <FormSection title="Consultor">
        {loadingConsultores ? (
          <div className="flex items-center gap-2 py-2">
            <Spinner size="sm" />
            <span className="text-sm text-muted-foreground">Carregando consultores...</span>
          </div>
        ) : (
          <Select value={consultorId} onValueChange={setConsultorId}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Selecione um consultor..." />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover border border-border shadow-lg">
              {consultores.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {c.nome}
                    {c.codigo && (
                      <span className="text-xs text-muted-foreground">({c.codigo})</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormSection>

      <FormSection title="Observações">
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações sobre o lead..."
          rows={3}
          className="resize-none"
          disabled={saving}
        />
      </FormSection>

      {/* Reenviar WhatsApp */}
      <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-success" />
          <span className="text-sm text-foreground">Mensagem de boas-vindas</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResendWelcome}
          disabled={sendingWa || saving || !telefone.trim()}
          className="gap-1.5 border-success/40 text-success hover:bg-success/10 hover:text-success"
        >
          {sendingWa ? (
            <>
              <Spinner size="sm" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              {phoneChanged ? "Enviar para novo número" : "Reenviar WhatsApp"}
            </>
          )}
        </Button>
      </div>
    </FormModalTemplate>
  );
}
