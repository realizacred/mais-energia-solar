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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
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
  /** Versão ID da proposta ativa */
  versaoId: string;
  /** Proposta ID */
  propostaId: string;
  /** Projeto (deal) ID */
  projetoId: string;
  /** Cliente ID */
  clienteId?: string | null;
  /** Tenant ID for config lookup */
  tenantId?: string;
  /** Dados básicos já disponíveis (evita refetch) */
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
  /** Pre-filled contact info */
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
  // Read tenant config (templates, blocks, defaults)
  const { data: tenantConfig } = useProposalMessageConfig(tenantId);

  // Defaults from tenant config (applied once on open)
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

  // Apply tenant defaults when config loads and drawer opens
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

  // Pre-fill destinatário when drawer opens
  useEffect(() => {
    if (open) {
      setDestinatarioTelefone(clienteTelefone || "");
      setDestinatarioEmail(clienteEmail || "");
    }
  }, [open, clienteTelefone, clienteEmail]);

  // Fetch snapshot via hook (§16 compliant)
  const { data: snapshot, isLoading: loadingSnapshot } = useProposalVersionSnapshot(
    open ? versaoId : null
  );

  // Build context from snapshot + versao data
  const msgContext = useMemo<ProposalMessageContext | null>(() => {
    if (!snapshot) return null;
    return extractMessageContext(snapshot, versaoData, propostaData);
  }, [snapshot, versaoData, propostaData]);

  // Resolve template and blocks from tenant config
  const generateOptions = useMemo(() => {
    if (!tenantConfig) return {};
    const templateKey = `${mode}_${style}`;
    const customTemplate = tenantConfig.templates[templateKey] || undefined;
    return {
      customTemplate,
      blocksConfig: tenantConfig.blocks_config,
    };
  }, [tenantConfig, mode, style]);

  // Generate message on mode/style/context change
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
      // Log copy action
      sendMutation.mutate(buildPayload("copy", ""), {
        onError: () => {/* silent — copy still worked */},
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
      <SheetContent className="w-[90vw] max-w-lg flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="p-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-base font-semibold text-foreground">
                Mensagem da Proposta
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                Gere, edite e envie ao cliente ou consultor
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          {/* Mode selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Destinatário</p>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as MessageMode)}
              className="justify-start"
            >
              <ToggleGroupItem value="cliente" aria-label="Cliente" className="gap-1.5 text-xs">
                <User className="h-3.5 w-3.5" />
                Cliente
              </ToggleGroupItem>
              <ToggleGroupItem value="consultor" aria-label="Consultor" className="gap-1.5 text-xs">
                <Briefcase className="h-3.5 w-3.5" />
                Consultor
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Style selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estilo</p>
            <ToggleGroup
              type="single"
              value={style}
              onValueChange={(v) => v && setStyle(v as MessageStyle)}
              className="justify-start"
            >
              <ToggleGroupItem value="curta" aria-label="Curta" className="gap-1.5 text-xs">
                <AlignLeft className="h-3.5 w-3.5" />
                Curta
              </ToggleGroupItem>
              <ToggleGroupItem value="completa" aria-label="Completa" className="gap-1.5 text-xs">
                <AlignJustify className="h-3.5 w-3.5" />
                Completa
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Current mode badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {mode === "cliente" ? "👤 Cliente" : "📋 Consultor"} • {style === "curta" ? "Resumida" : "Completa"}
            </Badge>
          </div>

          {/* Destinatário fields */}
          <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato para envio</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> Telefone (WhatsApp)
                </Label>
                <Input
                  value={destinatarioTelefone}
                  onChange={(e) => setDestinatarioTelefone(e.target.value)}
                  placeholder="5511999998888"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <AtSign className="h-3 w-3" /> E-mail
                </Label>
                <Input
                  value={destinatarioEmail}
                  onChange={(e) => setDestinatarioEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Message area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensagem</p>
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
                className="min-h-[220px] text-sm font-mono leading-relaxed resize-y"
                placeholder="A mensagem será gerada automaticamente..."
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="flex flex-col gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <div className="flex gap-2 w-full">
            <Button
              variant={copied ? "default" : "outline"}
              className={cn("flex-1 gap-1.5", copied && "bg-success text-success-foreground hover:bg-success/90")}
              onClick={handleCopy}
              disabled={!message || loadingSnapshot || isSending}
            >
              {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={handleSendWhatsApp}
                  disabled={!message || loadingSnapshot || isSending}
                >
                  {isSending && sendMutation.variables?.canal === "whatsapp" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="h-4 w-4 text-success" />
                  )}
                  <span className="hidden sm:inline text-xs">WhatsApp</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar via WhatsApp (real)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={handleSendEmail}
                  disabled={!message || loadingSnapshot || isSending}
                >
                  {isSending && sendMutation.variables?.canal === "email" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 text-info" />
                  )}
                  <span className="hidden sm:inline text-xs">E-mail</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar via e-mail (real)</TooltipContent>
            </Tooltip>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
