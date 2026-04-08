import { useState, useEffect, useCallback } from "react";
import { Send, MessageSquare, UserPen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui-kit/Spinner";
import { FormModalTemplate, FormGrid, FormSection } from "@/components/ui-kit/FormModalTemplate";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { AddressFields, type AddressData } from "@/components/shared/AddressFields";
import { useConsultoresAtivos } from "@/hooks/useConsultoresAtivos";
import { useLeadOrigensAtivas } from "@/hooks/useLeadOrigens";
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

interface LeadEditInitialData {
  nome: string;
  telefone: string;
  consultor_id: string | null;
  consultor_nome: string | null;
  cep?: string | null;
  cidade?: string;
  estado?: string;
  bairro?: string | null;
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  area?: string;
  tipo_telhado?: string;
  rede_atendimento?: string;
  media_consumo?: number;
  consumo_previsto?: number;
  observacoes?: string | null;
  lead_origem_id?: string | null;
  origem?: string | null;
}

interface LeadEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  initialData: LeadEditInitialData;
  onSuccess?: () => void;
}

const TIPOS_TELHADO = [
  "Cerâmico",
  "Metálico",
  "Fibrocimento",
  "Laje",
  "Solo",
  "Outro",
];

const REDES_ATENDIMENTO = [
  "Monofásica",
  "Bifásica",
  "Trifásica",
];

export function LeadEditDialog({
  open,
  onOpenChange,
  leadId,
  initialData,
  onSuccess,
}: LeadEditDialogProps) {
  const { toast } = useToast();
  const { data: consultores = [], isLoading: loadingConsultores } = useConsultoresAtivos();
  const { data: origens = [] } = useLeadOrigensAtivas();

  const [nome, setNome] = useState(initialData.nome);
  const [telefone, setTelefone] = useState(initialData.telefone);
  const [consultorId, setConsultorId] = useState(initialData.consultor_id || "");
  const [address, setAddress] = useState<AddressData>({
    cep: initialData.cep || "",
    rua: initialData.rua || "",
    numero: initialData.numero || "",
    complemento: initialData.complemento || "",
    bairro: initialData.bairro || "",
    cidade: initialData.cidade || "",
    estado: initialData.estado || "",
  });
  const [area, setArea] = useState(initialData.area || "");
  const [tipoTelhado, setTipoTelhado] = useState(initialData.tipo_telhado || "");
  const [redeAtendimento, setRedeAtendimento] = useState(initialData.rede_atendimento || "");
  const [mediaConsumo, setMediaConsumo] = useState(String(initialData.media_consumo ?? ""));
  const [consumoPrevisto, setConsumoPrevisto] = useState(String(initialData.consumo_previsto ?? ""));
  const [observacoes, setObservacoes] = useState(initialData.observacoes || "");
  const [leadOrigemId, setLeadOrigemId] = useState(initialData.lead_origem_id || "");
  const [saving, setSaving] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [phoneChanged, setPhoneChanged] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNome(initialData.nome);
      setTelefone(initialData.telefone);
      setConsultorId(initialData.consultor_id || "");
      setAddress({
        cep: initialData.cep || "",
        rua: initialData.rua || "",
        numero: initialData.numero || "",
        complemento: initialData.complemento || "",
        bairro: initialData.bairro || "",
        cidade: initialData.cidade || "",
        estado: initialData.estado || "",
      });
      setArea(initialData.area || "");
      setTipoTelhado(initialData.tipo_telhado || "");
      setRedeAtendimento(initialData.rede_atendimento || "");
      setMediaConsumo(String(initialData.media_consumo ?? ""));
      setConsumoPrevisto(String(initialData.consumo_previsto ?? ""));
      setObservacoes(initialData.observacoes || "");
      setLeadOrigemId(initialData.lead_origem_id || "");
      setPhoneChanged(false);
    }
  }, [open, initialData]);

  const handlePhoneChange = useCallback((value: string) => {
    setTelefone(value);
    if (value !== initialData.telefone) {
      setPhoneChanged(true);
    }
  }, [initialData.telefone]);

  const handleSave = async () => {
    if (!nome.trim() || !telefone.trim()) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const selectedConsultor = consultores.find((c) => c.id === consultorId);

      const leadUpdate: Record<string, unknown> = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        consultor_id: consultorId || null,
        consultor: selectedConsultor?.nome || null,
        cep: address.cep.trim() || null,
        cidade: address.cidade.trim(),
        estado: address.estado.trim(),
        bairro: address.bairro.trim() || null,
        rua: address.rua.trim() || null,
        numero: address.numero.trim() || null,
        complemento: address.complemento.trim() || null,
        area: area.trim(),
        tipo_telhado: tipoTelhado,
        rede_atendimento: redeAtendimento,
        media_consumo: mediaConsumo ? Number(mediaConsumo) : 0,
        consumo_previsto: consumoPrevisto ? Number(consumoPrevisto) : 0,
        observacoes: observacoes.trim() || null,
        lead_origem_id: leadOrigemId || null,
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

      // Also update orcamentos for consistency
      const orcUpdate: Record<string, unknown> = {
        consultor: selectedConsultor?.nome || null,
        cep: address.cep.trim() || null,
        cidade: address.cidade.trim(),
        estado: address.estado.trim(),
        bairro: address.bairro.trim() || null,
        rua: address.rua.trim() || null,
        numero: address.numero.trim() || null,
        area: area.trim(),
        tipo_telhado: tipoTelhado,
        rede_atendimento: redeAtendimento,
        media_consumo: mediaConsumo ? Number(mediaConsumo) : 0,
        consumo_previsto: consumoPrevisto ? Number(consumoPrevisto) : 0,
        observacoes: observacoes.trim() || null,
      };

      await supabase
        .from("orcamentos")
        .update(orcUpdate)
        .eq("lead_id", leadId);

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
        cidade: address.cidade.trim(),
        estado: address.estado.trim(),
        consumo: mediaConsumo ? Number(mediaConsumo) : undefined,
        tipo_telhado: tipoTelhado,
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
      icon={UserPen}
      subtitle="Edite os dados do lead"
      submitLabel="Salvar"
      onSubmit={handleSave}
      saving={saving}
      disabled={!nome.trim() || !telefone.trim()}
      className="w-[90vw] max-w-4xl"
    >
      {/* Dados pessoais */}
      <FormSection title="Dados do Lead">
        <FormGrid>
          <div className="space-y-2">
            <Label htmlFor="lead-nome">Nome</Label>
            <Input id="lead-nome" value={nome} onChange={(e) => setNome(e.target.value)} disabled={saving} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-telefone">Telefone</Label>
            <PhoneInput id="lead-telefone" value={telefone} onChange={handlePhoneChange} disabled={saving} />
            {phoneChanged && (
              <p className="text-xs text-warning">Telefone alterado — reenvie a mensagem de boas-vindas abaixo</p>
            )}
          </div>
        </FormGrid>
      </FormSection>

      {/* Endereço — §13/RB-09: Usa AddressFields com auto-busca CEP */}
      <FormSection title="Endereço">
        <AddressFields
          value={address}
          onChange={setAddress}
          disabled={saving}
        />
      </FormSection>

      {/* Dados técnicos */}
      <FormSection title="Dados Técnicos">
        <FormGrid>
          <div className="space-y-2">
            <Label htmlFor="lead-area">Área</Label>
            <Select value={area} onValueChange={setArea} disabled={saving}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Urbana">Urbana</SelectItem>
                <SelectItem value="Rural">Rural</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-tipo-telhado">Tipo de Telhado</Label>
            <Select value={tipoTelhado} onValueChange={setTipoTelhado} disabled={saving}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_TELHADO.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-rede">Rede de Atendimento</Label>
            <Select value={redeAtendimento} onValueChange={setRedeAtendimento} disabled={saving}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {REDES_ATENDIMENTO.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-consumo">Consumo Médio (kWh)</Label>
            <Input
              id="lead-consumo"
              type="number"
              value={mediaConsumo}
              onChange={(e) => setMediaConsumo(e.target.value)}
              disabled={saving}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-consumo-prev">Consumo Previsto (kWh)</Label>
            <Input
              id="lead-consumo-prev"
              type="number"
              value={consumoPrevisto}
              onChange={(e) => setConsumoPrevisto(e.target.value)}
              disabled={saving}
              placeholder="0"
            />
          </div>
        </FormGrid>
      </FormSection>

      {/* Consultor — §16: usa useConsultoresAtivos */}
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
            <SelectContent>
              {consultores.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {c.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormSection>

      {/* Observações */}
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
