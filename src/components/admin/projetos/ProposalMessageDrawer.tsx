/**
 * ProposalMessageDrawer.tsx
 * 
 * Drawer para gerar, editar e enviar mensagem da proposta.
 * Usa a proposta ativa/principal do projeto.
 * Lê configuração enterprise do tenant (templates, blocos, defaults).
 * Envia via WhatsApp real, Email real, ou apenas copia.
 */

import { useState, useEffect, useMemo } from "react";
import {
  MessageCircle, Mail, Copy, RefreshCw, User, Briefcase,
  AlignLeft, AlignJustify, CheckCircle, Loader2, Phone, AtSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { EmailInput } from "@/components/ui/EmailInput";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useProposalVersionSnapshot } from "@/hooks/useProposalVersionSnapshot";
import { useProposalMessageConfig } from "@/hooks/useProposalMessageConfig";
import { useSendProposalMessage } from "@/hooks/useSendProposalMessage";
import {
  generateProposalMessage,
  extractMessageContext,
  type MessageMode,
  type MessageStyle,
  type ProposalMessageContext,
} from "@/services/proposalMessageGenerator";

// ─── Types ──────────────────────────────────────────

interface ProposalMessageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versaoId: string;
  propostaId: string;
  projetoId: string;
  clienteId?: string | null;
  tenantId?: string;
  propostaData: {
    cliente_nome: string | null;
    codigo: string | null;
    status: string;
  };
  versaoData: {
    valor_total: number | null;
    potencia_kwp: number | null;
    economia_mensal: number | null;
    payback_meses: number | null;
    geracao_mensal: number | null;
    public_slug: string | null;
  };
  clienteTelefone?: string | null;
  clienteEmail?: string | null;
}

// ─── Component ──────────────────────────────────────

export function ProposalMessageDrawer({
  open,
  onOpenChange,
  versaoId,
  propostaId,
  projetoId,
  clienteId,
  tenantId,
  propostaData,
  versaoData,
  clienteTelefone,
  clienteEmail,
}: ProposalMessageDrawerProps) {
  const { data: tenantConfig } = useProposalMessageConfig(tenantId);

  const configMode = tenantConfig?.defaults?.mode || "cliente";
  const configStyle = tenantConfig?.defaults?.style || "completa";

  const [mode, setMode] = useState<MessageMode>(configMode);
  const [style, setStyle] = useState<MessageStyle>(configStyle);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [destinatarioTelefone, setDestinatarioTelefone] = useState("");
  const [destinatarioEmail, setDestinatarioEmail] = useState("");

  const sendMutation = useSendProposalMessage();

  useEffect(() => {
    if (open && tenantConfig && !defaultsApplied) {
      setMode(tenantConfig.defaults.mode || "cliente");
      setStyle(tenantConfig.defaults.style || "completa");
      setDefaultsApplied(true);
    }
    if (!open) {
      setDefaultsApplied(false);
    }
  }, [open, tenantConfig, defaultsApplied]);

  useEffect(() => {
    if (open) {
      setDestinatarioTelefone(clienteTelefone || "");
      setDestinatarioEmail(clienteEmail || "");
    }
  }, [open, clienteTelefone, clienteEmail]);

  const { data: snapshot, isLoading: loadingSnapshot } = useProposalVersionSnapshot(
    open ? versaoId : null
  );

  const msgContext = useMemo<ProposalMessageContext | null>(() => {
    if (!snapshot) return null;
    return extractMessageContext(snapshot, versaoData, propostaData);
  }, [snapshot, versaoData, propostaData]);

  const generateOptions = useMemo(() => {
    if (!tenantConfig) return {};
    const templateKey = `${mode}_${style}`;
    const customTemplate = tenantConfig.templates[templateKey] || undefined;
    return {
      customTemplate,
      blocksConfig: tenantConfig.blocks_config,
    };
  }, [tenantConfig, mode, style]);

  useEffect(() => {
    if (!msgContext) return;
    const text = generateProposalMessage(msgContext, mode, style, generateOptions);
    setMessage(text);
    setCopied(false);
  }, [msgContext, mode, style, generateOptions]);

  const handleRegenerate = () => {
    if (!msgContext) return;
    const text = generateProposalMessage(msgContext, mode, style, generateOptions);
    setMessage(text);
    setCopied(false);
    toast({ title: "Mensagem regenerada" });
  };

  const buildPayload = (canal: "whatsapp" | "email" | "copy", destValor: string) => ({
    canal,
    conteudo: message,
    destinatario_valor: destValor,
    destinatario_tipo: mode as "cliente" | "consultor",
    tipo_mensagem: mode as "cliente" | "consultor",
    estilo: style as "curta" | "completa",
    proposta_id: propostaId,
    versao_id: versaoId,
    projeto_id: projetoId,
    cliente_id: clienteId,
    cliente_nome: propostaData.cliente_nome,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      sendMutation.mutate(buildPayload("copy", ""), {
        onError: () => {},
      });
      toast({ title: "Mensagem copiada! 📋" });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleSendWhatsApp = () => {
    const phone = destinatarioTelefone.replace(/\D/g, "");
    if (!phone) {
      toast({ title: "Informe o telefone do destinatário", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Mensagem vazia", variant: "destructive" });
      return;
    }

    sendMutation.mutate(buildPayload("whatsapp", phone), {
      onSuccess: () => {
        toast({ title: "✅ Mensagem enviada via WhatsApp" });
      },
      onError: (err) => {
        toast({
          title: "Erro ao enviar via WhatsApp",
          description: err instanceof Error ? err.message : "Erro desconhecido",
          variant: "destructive",
        });
      },
    });
  };

  const handleSendEmail = () => {
    const email = destinatarioEmail.trim();
    if (!email || !email.includes("@")) {
      toast({ title: "Informe um e-mail válido", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Mensagem vazia", variant: "destructive" });
      return;
    }

    sendMutation.mutate(buildPayload("email", email), {
      onSuccess: () => {
        toast({ title: "✅ Mensagem enviada via e-mail" });
      },
      onError: (err) => {
        toast({
          title: "Erro ao enviar via e-mail",
          description: err instanceof Error ? err.message : "Erro desconhecido",
          variant: "destructive",
        });
      },
    });
  };

  const isSending = sendMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[90vw] max-w-md flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header — §25: ícone + título + subtítulo */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold text-foreground leading-tight">
                Mensagem da Proposta
              </SheetTitle>
              <SheetDescription className="text-[11px] text-muted-foreground mt-0.5">
                Gere, edite e envie ao cliente ou consultor
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Body — §36: flex-1 min-h-0 scroll interno */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            {/* Destinatário + Estilo — layout compacto lado a lado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Destinatário
                </p>
                <ToggleGroup
                  type="single"
                  value={mode}
                  onValueChange={(v) => v && setMode(v as MessageMode)}
                  className="justify-start"
                >
                  <ToggleGroupItem value="cliente" aria-label="Cliente" className="gap-1 text-[11px] h-8 px-2.5">
                    <User className="h-3.5 w-3.5" />
                    Cliente
                  </ToggleGroupItem>
                  <ToggleGroupItem value="consultor" aria-label="Consultor" className="gap-1 text-[11px] h-8 px-2.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    Consultor
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Estilo
                </p>
                <ToggleGroup
                  type="single"
                  value={style}
                  onValueChange={(v) => v && setStyle(v as MessageStyle)}
                  className="justify-start"
                >
                  <ToggleGroupItem value="curta" aria-label="Curta" className="gap-1 text-[11px] h-8 px-2.5">
                    <AlignLeft className="h-3.5 w-3.5" />
                    Curta
                  </ToggleGroupItem>
                  <ToggleGroupItem value="completa" aria-label="Completa" className="gap-1 text-[11px] h-8 px-2.5">
                    <AlignJustify className="h-3.5 w-3.5" />
                    Completa
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Badge modo ativo */}
            <Badge variant="outline" className="text-[10px] font-medium">
              {mode === "cliente" ? "👤 Cliente" : "📋 Consultor"} • {style === "curta" ? "Resumida" : "Completa"}
            </Badge>

            <Separator />

            {/* Contato para envio */}
            <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Contato para envio
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3 w-3" /> Telefone (WhatsApp)
                  </Label>
                  <PhoneInput
                    value={destinatarioTelefone}
                    onChange={setDestinatarioTelefone}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] flex items-center gap-1.5 text-muted-foreground">
                    <AtSign className="h-3 w-3" /> E-mail
                  </Label>
                  <EmailInput
                    value={destinatarioEmail}
                    onChange={setDestinatarioEmail}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Mensagem */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Mensagem
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleRegenerate}
                      disabled={loadingSnapshot || isSending}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Regenerar mensagem</TooltipContent>
                </Tooltip>
              </div>

              {loadingSnapshot ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <Textarea
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setCopied(false);
                  }}
                  className="min-h-[200px] text-xs font-mono leading-relaxed resize-y border-border"
                  placeholder="A mensagem será gerada automaticamente..."
                />
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer — §22: botões alinhados */}
        <div className="flex gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button
            variant={copied ? "default" : "outline"}
            className={cn(
              "flex-1 gap-1.5 text-xs h-9",
              copied && "bg-success text-success-foreground hover:bg-success/90"
            )}
            onClick={handleCopy}
            disabled={!message || loadingSnapshot || isSending}
          >
            {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="gap-1.5 text-xs h-9"
                onClick={handleSendWhatsApp}
                disabled={!message || loadingSnapshot || isSending}
              >
                {isSending && sendMutation.variables?.canal === "whatsapp" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MessageCircle className="h-3.5 w-3.5 text-success" />
                )}
                WhatsApp
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar via WhatsApp</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="gap-1.5 text-xs h-9"
                onClick={handleSendEmail}
                disabled={!message || loadingSnapshot || isSending}
              >
                {isSending && sendMutation.variables?.canal === "email" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5 text-info" />
                )}
                E-mail
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar via e-mail</TooltipContent>
          </Tooltip>
        </div>
      </SheetContent>
    </Sheet>
  );
}
