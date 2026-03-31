import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Loader2, CheckCircle2, Clock, Download, Link2,
  MessageCircle, Mail, Pencil, Eye, Settings2, Wrench,
  CalendarDays,
} from "lucide-react";
import { ActionLink } from "./ActionLink";
import { cn } from "@/lib/utils";
import { useWhatsAppTemplates } from "@/hooks/useProposalTemplates";
import { renderTemplate, SAMPLE_TEMPLATE_VARS } from "@/utils/templateRenderer";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";

interface ProposalActionCardsProps {
  // Dimensionamento
  navigateToEdit: () => void;
  isFinalized: boolean;
  cloning: boolean;
  lastEditDate: string | null;
  // Arquivo
  html: string | null;
  rendering: boolean;
  onGenerateFile: () => void;
  onCopyLink: (withTracking: boolean) => void;
  onDownloadPdf: () => void;
  onRender: () => void;
  publicUrl: string | null;
  downloadingPdf: boolean;
  validoAte: string | null;
  onEditValidade: () => void;
  lastGeneratedAt: string | null;
  // Envio
  currentStatus: string;
  sending: boolean;
  onSendWhatsapp: (opts?: { template_id?: string; mensagem_custom?: string }) => void;
  onSendEmail: () => void;
  onScrollToTracking: () => void;
  // Shared
  formattedDate: (d: string | null) => string | null;
  // Template vars from real proposal data
  templateVars?: Record<string, string>;
}

export function ProposalActionCards({
  navigateToEdit, isFinalized, cloning, lastEditDate,
  html, rendering, onGenerateFile, onCopyLink, onDownloadPdf, onRender,
  publicUrl, downloadingPdf, validoAte, onEditValidade, lastGeneratedAt,
  currentStatus, sending, onSendWhatsapp, onSendEmail, onScrollToTracking,
  formattedDate, templateVars,
}: ProposalActionCardsProps) {
  const { data: waTemplates } = useWhatsAppTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [mensagemEditada, setMensagemEditada] = useState<string>("");
  const [mensagemOriginal, setMensagemOriginal] = useState<string>("");

  // When templates load, auto-select default
  useEffect(() => {
    if (waTemplates && waTemplates.length > 0 && !selectedTemplateId) {
      const defaultTpl = waTemplates.find((t) => t.is_default) || waTemplates[0];
      if (defaultTpl) {
        setSelectedTemplateId(defaultTpl.id);
      }
    }
  }, [waTemplates, selectedTemplateId]);

  // Render template when selection or vars change
  useEffect(() => {
    if (!selectedTemplateId || !waTemplates) return;
    const tpl = waTemplates.find((t) => t.id === selectedTemplateId);
    if (!tpl?.corpo_texto) {
      setMensagemEditada("");
      setMensagemOriginal("");
      return;
    }
    const vars = templateVars || SAMPLE_TEMPLATE_VARS;
    const rendered = renderTemplate(tpl.corpo_texto, vars);
    setMensagemEditada(rendered);
    setMensagemOriginal(rendered);
  }, [selectedTemplateId, waTemplates, templateVars]);

  const handleSendWhatsapp = useCallback(() => {
    const isEdited = mensagemEditada !== mensagemOriginal;
    onSendWhatsapp({
      template_id: selectedTemplateId || undefined,
      mensagem_custom: isEdited ? mensagemEditada : undefined,
    });
  }, [onSendWhatsapp, selectedTemplateId, mensagemEditada, mensagemOriginal]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* ─── DIMENSIONAMENTO ─── */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="h-1 bg-primary" />
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Dimensionamento</h3>
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>

          <Button size="sm" variant="outline" className="gap-2 w-full justify-start border-primary/30 text-primary hover:bg-primary/5" onClick={navigateToEdit} disabled={cloning}>
            <Pencil className="h-3.5 w-3.5" /> Editar Dimensionamento
          </Button>

          <Separator />

          <div className="space-y-0.5">
            <ActionLink icon={Eye} label="Visualizar Dimensionamento" onClick={navigateToEdit} />
            <ActionLink icon={Settings2} label="Visualizar Campos Customizados" onClick={navigateToEdit} />
            <ActionLink icon={Wrench} label="Visualizar Serviços" onClick={navigateToEdit} />
          </div>

          <p className="text-[10px] text-muted-foreground pt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Última edição em {formattedDate(lastEditDate) || "—"}
          </p>
        </CardContent>
      </Card>

      {/* ─── ARQUIVO ─── */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className={cn("h-1", html ? "bg-success" : "bg-muted-foreground/30")} />
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Arquivo</h3>
            {html ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
          </div>

          <Button
            size="sm"
            variant="outline"
            className={cn("gap-2 w-full justify-start border-primary/30 text-primary hover:bg-primary/5")}
            onClick={onGenerateFile}
            disabled={rendering}
          >
            {rendering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {html ? "Gerar outro arquivo" : "Gerar arquivo"}
          </Button>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2">
            <ActionLink icon={Link2} label="Copiar link com rastreio" onClick={() => onCopyLink(true)} />
            <ActionLink icon={Link2} label="Copiar link sem rastreio" onClick={() => onCopyLink(false)} />
            <ActionLink icon={Download} label="Download de PDF" onClick={onDownloadPdf} disabled={downloadingPdf || !html} />
            <ActionLink icon={Download} label="Download de Doc" onClick={onDownloadPdf} disabled={downloadingPdf || !html} iconColor="text-info" />
            <ActionLink icon={Eye} label="Pré-visualizar template web" onClick={onRender} disabled={!html} />
          </div>

          {validoAte && (
            <Button
              variant="ghost"
              onClick={onEditValidade}
              className="text-[10px] text-muted-foreground h-auto p-0 pt-1 flex items-center gap-1 hover:text-primary transition-colors"
            >
              <CalendarDays className="h-3 w-3" />
              Validade da proposta: {formatDate(validoAte)}
            </Button>
          )}

          {lastGeneratedAt && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Última geração em {formattedDate(lastGeneratedAt)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── ENVIO ─── */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className={cn("h-1", currentStatus === "enviada" ? "bg-info" : "bg-muted-foreground/30")} />
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Envio</h3>
            {currentStatus === "enviada" ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
          </div>

          {/* Template Select */}
          {waTemplates && waTemplates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Template de resumo</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  {waTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome} {t.is_default ? "(padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Editable Message */}
          {mensagemEditada && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Mensagem (editável)</Label>
              <Textarea
                value={mensagemEditada}
                onChange={(e) => setMensagemEditada(e.target.value)}
                className="min-h-[120px] text-[11px] leading-relaxed"
              />
              {mensagemEditada !== mensagemOriginal && (
                <p className="text-[10px] text-warning">Mensagem editada — será enviada como texto customizado.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button size="sm" className="gap-2 w-full justify-start bg-success hover:bg-success/90 text-success-foreground" onClick={handleSendWhatsapp} disabled={sending}>
              <MessageCircle className="h-3.5 w-3.5" /> Enviar WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="gap-2 w-full justify-start" onClick={onSendEmail} disabled={sending}>
              <Mail className="h-3.5 w-3.5" /> Enviar E-mail
            </Button>
          </div>

          <Separator />

          <ActionLink icon={Eye} label="Ver histórico de visualizações" onClick={onScrollToTracking} />

          {publicUrl && (
            <p className="text-[10px] text-muted-foreground break-all flex items-center gap-1">
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{publicUrl}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
