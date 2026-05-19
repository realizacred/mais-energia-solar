import { useState, useEffect, useMemo, useRef, useCallback } from "react";

import type { GenerationAuditReport } from "@/services/generationAudit";
import {
  FileText, Sun, Zap, Loader2, Globe, FileDown, Upload, MessageCircle, Mail,
  Download, Link2, LinkIcon, Calendar, Copy, Check, Info, Send, Bold, Italic, Underline, Code,
  AlertTriangle, ExternalLink, Sparkles, RefreshCw, AlertCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { EmailInput } from "@/components/ui/EmailInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { sendProposal } from "@/services/proposalApi";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { useProposalTemplates, useEmailTemplates } from "@/hooks/useProposalTemplates";
import { useQueryClient } from "@tanstack/react-query";
import { formatBRL } from "./types";
import { useWizardContext } from "./WizardContext";
import { toast } from "@/hooks/use-toast";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { QRCodeCanvas } from "qrcode.react";
import { getOrCreateProposalToken } from "@/services/proposal/proposalDetail.service";
import {
  getProposalWebUrl,
  getTrackedPdfUrl,
  getDirectPdfUrl,
  getSimulationUrl,
} from "@/services/proposal/proposalLinks";

// ─── Types ────────────────────────────────────────────────

interface StepDocumentoProps {
  onBack?: () => void;
  onNext?: () => void;
  onViewDetail?: () => void;
  /** When true, all "Gerar Proposta" buttons are disabled (estimativa not accepted) */
  estimativaBlocked?: boolean;
  /** When true, skip auto-selecting the first template */
  skipTemplateAutoSelect?: boolean;
  // Generation state/handlers (passed by ProposalWizard — not in WizardContext)
  onGenerate?: () => void;
  onNewVersion?: () => void;
  generating?: boolean;
  rendering?: boolean;
  result?: any;
  htmlPreview?: string | null;
  pdfBlobUrl?: string | null;
  outputDocxPath?: string | null;
  outputPdfPath?: string | null;
  externalPdfUrl?: string | null;
  generationError?: string | null;
  generationStatusOverride?: string | null;
  missingVars?: string[];
  docxBlob?: Blob | null;
  generationAuditReport?: any;
  hasUnpublishedChanges?: boolean;
  officialTotal?: number;
  draftTotal?: number;
}

// ─── Main Component ───────────────────────────────────────

export function StepDocumento({
  onBack, onNext, onViewDetail,
  estimativaBlocked = false,
  skipTemplateAutoSelect = false,
  onGenerate,
  onNewVersion,
  generating = false,
  rendering = false,
  result = null,
  htmlPreview = null,
  pdfBlobUrl = null,
  outputDocxPath = null,
  outputPdfPath = null,
  externalPdfUrl = null,
  generationError = null,
  generationStatusOverride = null,
  missingVars = [],
  docxBlob = null,
  generationAuditReport = null,
  hasUnpublishedChanges = false,
  officialTotal = 0,
  draftTotal = 0,
}: StepDocumentoProps) {
  const {
    cliente, selectedLead,
    potenciaKwp, ucs,
    templateSelecionado, setTemplateSelecionado: onTemplateSelecionado,
    generationStatus: contextGenerationStatus,
    pagamentoOpcoes,
    customFieldValues, setCustomFieldValues: onCustomFieldValuesChange,
  } = useWizardContext() as any;
  const generationStatus = generationStatusOverride || contextGenerationStatus;

  const clienteNome = cliente.nome || selectedLead?.nome || "";
  const empresaNome = cliente.empresa;
  const clienteTelefone = cliente.celular || selectedLead?.telefone;
  const clienteEmail = cliente.email || selectedLead?.email;
  const numUcs = ucs.length;
  // Simulação financeira só faz sentido se há pelo menos 1 opção tipo "financiamento"
  const hasFinancing = useMemo(
    () => Array.isArray(pagamentoOpcoes) && pagamentoOpcoes.some((o: any) => o?.tipo === "financiamento"),
    [pagamentoOpcoes],
  );
  // Calculate areaUtilM2 and precoFinal if needed, or get from context
  const areaUtilM2 = 0; 
  const precoFinal = 0;
  const geracaoMensalKwh = 0;

  // ─── Queries via hooks (§16 AGENTS.md) ──────────────────
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading: loadingTemplates } = useProposalTemplates();
  const { data: emailTemplatesData = [] } = useEmailTemplates();

  const [activeTab, setActiveTab] = useState("template");

  // WhatsApp state
  const [waDestinatario, setWaDestinatario] = useState(clienteTelefone || "");
  const [waMensagem, setWaMensagem] = useState("");

  // Email state
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("");
  const [emailDestinatario, setEmailDestinatario] = useState(clienteEmail || "");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailAssunto, setEmailAssunto] = useState("");
  const [emailReplyTo, setEmailReplyTo] = useState("");
  const [emailCorpo, setEmailCorpo] = useState("");
  const [emailAnexarPdf, setEmailAnexarPdf] = useState(false);
  const [editHtml, setEditHtml] = useState(false);
  const emailEditorRef = useRef<HTMLDivElement>(null);
  const docxUploadRef = useRef<HTMLInputElement>(null);
  const [uploadingDocx, setUploadingDocx] = useState(false);

  // Link copy state
  const [copiedTracker, setCopiedTracker] = useState(false);
  const [copiedDirect, setCopiedDirect] = useState(false);
  const [copiedSimulacao, setCopiedSimulacao] = useState(false);
  const [resolvedPublicUrl, setResolvedPublicUrl] = useState<string | null>(null);
  // Signed URL gerada localmente quando temos outputPdfPath mas não temos pdfBlobUrl
  const [resolvedPdfPreviewUrl, setResolvedPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);
  const [showConfirmPublishDialog, setShowConfirmPublishDialog] = useState<{ open: boolean; action: () => void } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let timer: number | null = null;
    if (generating || rendering) {
      setElapsedTime(0);
      timer = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [generating, rendering]);

  useEffect(() => {
    let cancelled = false;
    setPdfPreviewError(null);
    if (pdfBlobUrl) {
      setResolvedPdfPreviewUrl(null);
      return;
    }
    if (!outputPdfPath) {
      setResolvedPdfPreviewUrl(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase.storage
        .from("proposta-documentos")
        .createSignedUrl(outputPdfPath, 3600);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setPdfPreviewError(error?.message || "Falha ao gerar link assinado do PDF");
        setResolvedPdfPreviewUrl(null);
        return;
      }
      // #toolbar=0 para visual mais limpo; #view=FitH ajuda no fit horizontal
      setResolvedPdfPreviewUrl(`${data.signedUrl}#toolbar=1&view=FitH`);
    })();
    return () => { cancelled = true; };
  }, [outputPdfPath, pdfBlobUrl]);

  // Proposal validity
  const [validade, setValidade] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split("T")[0];
  });

  // Auto-select first template (skip when used in read-only detail view)
  useEffect(() => {
    if (skipTemplateAutoSelect) return;
    if (!templateSelecionado && templates.length > 0) {
      const defaultTpl = templates.find(t => t.is_default);
      const firstTpl = templates[0];
      onTemplateSelecionado(defaultTpl?.id || firstTpl.id);
    }
  }, [templates, templateSelecionado, onTemplateSelecionado, skipTemplateAutoSelect]);

  // Auto-select first email template
  useEffect(() => {
    if (emailTemplatesData.length > 0 && !selectedEmailTemplate) {
      const first = emailTemplatesData[0];
      setSelectedEmailTemplate(first.id);
      setEmailAssunto(first.assunto || "");
      setEmailCorpo(first.corpo_html || "");
    }
  }, [emailTemplatesData, selectedEmailTemplate]);

  // Auto-resolve tracked link when result is available
  useEffect(() => {
    if (!result?.proposta_id || !result?.versao_id) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await getOrCreateProposalToken(result.proposta_id, result.versao_id, "tracked");

        if (cancelled) return;

        const url = getProposalWebUrl(token);
        setResolvedPublicUrl(url);

        // Set WA default message with link
        setWaMensagem(
          `Olá ${clienteNome || ""},\n\n` +
          `Segue o link de acesso para a sua proposta comercial de energia solar:\n\n` +
          `${url}\n\n` +
          `Qualquer dúvida, estou à disposição!`
        );
      } catch (err) {
        console.warn("[StepDocumento] Erro ao resolver link público:", err);
        setWaMensagem(`Olá,\nSegue a sua proposta comercial de energia solar.`);
      }
    })();

    return () => { cancelled = true; };
  }, [result?.proposta_id, result?.versao_id, clienteNome]);

  // Update WA destinatario when prop changes
  useEffect(() => {
    if (clienteTelefone && !waDestinatario) setWaDestinatario(clienteTelefone);
  }, [clienteTelefone]);

  useEffect(() => {
    if (clienteEmail && !emailDestinatario) setEmailDestinatario(clienteEmail);
  }, [clienteEmail]);

  // Template grouping
  const webTemplates = templates.filter(t => t.tipo === "html");
  const docTemplates = templates.filter(t => t.tipo === "docx");

  const selectedTpl = templates.find(t => t.id === templateSelecionado);
  const selectedTemplateName = selectedTpl?.nome || "";
  const isDocxSelected = selectedTpl?.tipo === "docx";

  // ─── Handlers
  const handleEmailTemplateChange = (id: string) => {
    setSelectedEmailTemplate(id);
    const tpl = emailTemplatesData.find(t => t.id === id);
    if (tpl) {
      setEmailAssunto(tpl.assunto || "");
      setEmailCorpo(tpl.corpo_html || "");
    }
  };
  // ─── DOCX Upload Handler ─────────────────────────────────
  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".docx")) {
      toast({ title: "Apenas arquivos .docx são aceitos", variant: "destructive" });
      return;
    }

    const MAX_SIZE_MB = 50;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: `Arquivo excede o limite de ${MAX_SIZE_MB}MB`, variant: "destructive" });
      return;
    }

    setUploadingDocx(true);
    try {
      const { tenantId } = await getCurrentTenantId();
      const fileName = `${tenantId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("proposta-templates")
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("proposta-templates")
        .getPublicUrl(fileName);

      // Create template record
      const templateNome = file.name.replace(/\.docx$/i, "").replace(/^\d+_/, "");
      const { data: newTemplate, error: insertError } = await supabase
        .from("proposta_templates")
        .insert({
          nome: templateNome,
          descricao: `Upload via wizard - ${file.name}`,
          grupo: "B",
          categoria: "geral",
          tipo: "docx",
          file_url: urlData.publicUrl,
          ativo: true,
          tenant_id: tenantId,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      toast({ title: "Template enviado com sucesso!" });

      // Refresh templates list & auto-select
      await queryClient.invalidateQueries({ queryKey: ["proposta-templates-active"] });
      if (newTemplate?.id) {
        onTemplateSelecionado(newTemplate.id);
      }
    } catch (err: any) {
      console.error("[StepDocumento] Upload error:", err);
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploadingDocx(false);
      if (docxUploadRef.current) docxUploadRef.current.value = "";
    }
  };

  const handleCopyLink = async (withTracker: boolean) => {
    if (hasUnpublishedChanges && !result) {
      setShowConfirmPublishDialog({
        open: true,
        action: () => handleCopyLink(withTracker),
      });
      return;
    }
    const propostaId = result?.proposta_id as string | undefined;
    const versaoId = result?.versao_id as string | undefined;
    const directPdfUrl = outputPdfPath
      ? null
      : (externalPdfUrl || pdfBlobUrl || null);

    if (withTracker && (!propostaId || !versaoId)) {
      toast({ title: "Gere a proposta primeiro para copiar o link rastreável", variant: "destructive" });
      return;
    }

    if (!withTracker && !outputPdfPath && !directPdfUrl) {
      toast({ title: "Gere a proposta primeiro para copiar o link do PDF", variant: "destructive" });
      return;
    }

    try {
      let url: string | null = null;

      if (withTracker) {
        const token = await getOrCreateProposalToken(propostaId!, versaoId!, "tracked");
        url = getTrackedPdfUrl(token);
        setResolvedPublicUrl(url);
      } else {
        url = await getDirectPdfUrl(outputPdfPath, directPdfUrl);
        if (!url) {
          toast({ title: "Erro ao gerar link do PDF", variant: "destructive" });
          return;
        }
      }

      if (!url) {
        toast({ title: "Link do PDF indisponível", variant: "destructive" });
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt("Copie o link abaixo:", url);
      }

      if (withTracker) {
        setCopiedTracker(true);
        setTimeout(() => setCopiedTracker(false), 2000);
      } else {
        setCopiedDirect(true);
        setTimeout(() => setCopiedDirect(false), 2000);
      }

      toast({
        title: withTracker
          ? "Link rastreável da proposta copiado! 🔗"
          : "Link do PDF copiado! 🔗",
      });
    } catch (err: any) {
      console.error("[handleCopyLink] Erro:", err);
      toast({ title: `Erro ao gerar link: ${err?.message || "desconhecido"}`, variant: "destructive" });
    }
  };

  const handleCopySimulacaoLink = async () => {
    const propostaId = result?.proposta_id;
    const versaoId = result?.versao_id;
    if (!propostaId || !versaoId) {
      toast({ title: "Gere a proposta primeiro", variant: "destructive" });
      return;
    }
    try {
      // Reuse the same token logic as tracked link
      const { data: existing } = await supabase
        .from("proposta_aceite_tokens" as any)
        .select("token")
        .eq("proposta_id", propostaId)
        .eq("versao_id", versaoId)
        .eq("tipo", "tracked")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let token = (existing as any)?.token as string | undefined;

      if (!token) {
        const { tenantId } = await getCurrentTenantId();
        const { data: created, error: createErr } = await supabase
          .from("proposta_aceite_tokens" as any)
          .insert({
            proposta_id: propostaId,
            versao_id: versaoId,
            tenant_id: tenantId,
            tipo: "tracked",
          } as any)
          .select("token")
          .single();

        if (createErr || !created) {
          toast({ title: `Erro ao criar link: ${createErr?.message || "desconhecido"}`, variant: "destructive" });
          return;
        }
        token = (created as any).token;
      }

      const url = getSimulationUrl(token, true)!; // botão só aparece quando hasFinancing
      try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copie o link:", url); }
      setCopiedSimulacao(true);
      setTimeout(() => setCopiedSimulacao(false), 2000);
      toast({ title: "Link da simulação financeira copiado! 💰" });
    } catch (err: any) {
      toast({ title: `Erro ao gerar link: ${err?.message || "desconhecido"}`, variant: "destructive" });
    }
  };

  const [sendingWa, setSendingWa] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // ─── Send via proposalApi (§33 — centralizar chamadas de edge function) ───
  const handleSendWhatsapp = async () => {
    if (hasUnpublishedChanges && !result) {
      setShowConfirmPublishDialog({
        open: true,
        action: handleSendWhatsapp,
      });
      return;
    }
    if (!result?.proposta_id || !result?.versao_id) {
      toast({ title: "Gere a proposta primeiro", variant: "destructive" });
      return;
    }
    if (!waDestinatario) {
      toast({ title: "Informe o destinatário", variant: "destructive" });
      return;
    }
    setSendingWa(true);
    try {
      const data = await sendProposal({
        proposta_id: result.proposta_id,
        versao_id: result.versao_id,
        canal: "whatsapp",
      });
      toast({
        title: "Proposta enviada via WhatsApp!",
        description: data.whatsapp_sent
          ? "Mensagem entregue pela API integrada."
          : "Link gerado com sucesso.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSendingWa(false);
    }
  };

  const handleSendEmail = async () => {
    if (hasUnpublishedChanges && !result) {
      setShowConfirmPublishDialog({
        open: true,
        action: handleSendEmail,
      });
      return;
    }
    if (!result?.proposta_id || !result?.versao_id) {
      toast({ title: "Gere a proposta primeiro", variant: "destructive" });
      return;
    }
    if (!emailDestinatario) {
      toast({ title: "Informe o e-mail do destinatário", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      const data = await sendProposal({
        proposta_id: result.proposta_id,
        versao_id: result.versao_id,
        canal: "link",
      });
      toast({ title: "Link da proposta gerado!", description: `URL: ${data.public_url}` });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  // MetricsHeader removed — metrics are now shown in the wizard sticky header (ProposalWizard.tsx)

  // ─── TAB: TEMPLATE ──────────────────────────────────────

  const renderTemplateTab = () => {
    // ── Generation in progress
    if (generating || rendering) {
      let statusMsg = generationStatus === "calculating" ? "Calculando dimensionamento..."
        : generationStatus === "publishing" ? "Publicando versão oficial no CRM..."
        : generationStatus === "published" ? "Versão publicada com sucesso!"
        : "Gerando proposta em PDF...";

      if (elapsedTime > 30 && (generating || rendering)) {
        statusMsg = "Aguarde, a geração está levando mais tempo que o normal...";
      }
      
      if (elapsedTime > 120 && (generating || rendering)) {
        statusMsg = "O tempo limite foi atingido. Verifique sua conexão ou tente novamente.";
      }

      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
          <div className="relative">
            <Sun className="h-14 w-14 text-primary animate-spin" style={{ animationDuration: "3s" }} />
            <Loader2 className="h-6 w-6 text-primary animate-spin absolute -bottom-1 -right-1" />
          </div>
          <div className="space-y-2 max-w-sm">
            <p className="text-sm font-semibold text-foreground">{statusMsg}</p>
            <p className="text-xs text-muted-foreground">Isso pode levar até 2 minutos.</p>
            {elapsedTime > 0 && <p className="text-[10px] text-muted-foreground/60">{elapsedTime}s decorridos</p>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {["calculating", "publishing", "rendering_pdf"].map((s, i) => (
              <div key={s} className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                generationStatus === s ? "bg-primary animate-pulse" :
                ["calculating", "publishing", "rendering_pdf"].indexOf(generationStatus) > i ? "bg-primary" : "bg-muted"
              )} />
            ))}
          </div>
          {elapsedTime > 120 && (
            <Button variant="outline" size="sm" onClick={onGenerate} className="mt-4">
              Tentar novamente
            </Button>
          )}
        </div>
      );
    }

    // ── Error state
    if (generationStatus === "error" && generationError) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 sm:gap-6 min-h-[400px]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Selecione o template</Label>
              {loadingTemplates ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={templateSelecionado} onValueChange={onTemplateSelecionado}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione o template" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-bold">Template Web</SelectLabel>
                      {webTemplates.map(t => (<SelectItem key={t.id} value={t.id} className="text-sm">{t.nome}</SelectItem>))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-bold">Template Doc</SelectLabel>
                      {docTemplates.map(t => (<SelectItem key={t.id} value={t.id} className="text-sm">{t.nome}</SelectItem>))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={onGenerate} disabled={!templateSelecionado || estimativaBlocked} title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : undefined} className="w-full gap-2">
              <Zap className="h-4 w-4" />
              Publicar nova versão
            </Button>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Info className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-semibold text-destructive mb-2">Erro na geração do documento</p>
            <p className="text-xs text-muted-foreground max-w-md">{generationError}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-2 border-destructive text-destructive hover:bg-destructive/10" onClick={onGenerate} disabled={estimativaBlocked} title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : undefined}>
              <Zap className="h-3.5 w-3.5" />
              Publicar nova versão
            </Button>
          </div>
        </div>
      );
    }

    // ── DOCX only state (PDF conversion failed but DOCX is available)
    if (generationStatus === "docx_only" && outputDocxPath) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 sm:gap-6 min-h-[400px]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Selecione o template</Label>
              {loadingTemplates ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={templateSelecionado} onValueChange={onTemplateSelecionado}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione o template" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-bold">Template Web</SelectLabel>
                      {webTemplates.map(t => (<SelectItem key={t.id} value={t.id} className="text-sm">{t.nome}</SelectItem>))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-bold">Template Doc</SelectLabel>
                      {docTemplates.map(t => (<SelectItem key={t.id} value={t.id} className="text-sm">{t.nome}</SelectItem>))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={onGenerate} disabled={!templateSelecionado || estimativaBlocked} title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : undefined} className="w-full gap-2">
              <Zap className="h-4 w-4" />
              Publicar nova versão
            </Button>
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={async () => {
              const { data } = await supabase.storage.from("proposta-documentos").createSignedUrl(outputDocxPath, 3600);
              if (data?.signedUrl) {
                const resp = await fetch(data.signedUrl);
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const docxName = result?.file_name_docx || `Proposta_${clienteNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").substring(0, 40)}.docx`;
                a.download = docxName;
                a.click();
                URL.revokeObjectURL(url);
              }
            }}>
              <FileDown className="h-3.5 w-3.5" />
              Baixar DOCX
            </Button>
          </div>
          <div className="rounded-xl border border-warning/30 bg-warning/5 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <p className="text-sm font-semibold text-warning mb-1">Proposta parcialmente gerada</p>
            <p className="text-xs text-muted-foreground mb-1">DOCX salvo · Conversão PDF falhou</p>
            <p className="text-[11px] text-muted-foreground/80 max-w-md mb-4">
              {generationError || "A conversão para PDF não foi possível. O DOCX está disponível para download."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-warning text-warning hover:bg-warning/10"
              onClick={onGenerate}
              disabled={estimativaBlocked || generating || rendering}
              title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : "Refaz a geração e tenta converter o PDF novamente"}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", (generating || rendering) && "animate-spin")} />
              Tentar gerar PDF novamente
            </Button>
          </div>
        </div>
      );
    }

    // ── Before generation (no result AND no restored PDF)
    const hasRestoredPreview = !result && (!!pdfBlobUrl || !!outputPdfPath || !!externalPdfUrl);
    if (!result && !hasRestoredPreview) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 sm:gap-6 min-h-[400px]">
          {/* Left: Template Selection */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Selecione o template</Label>
              {loadingTemplates ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={templateSelecionado} onValueChange={onTemplateSelecionado}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione o template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-bold">Template Web</SelectLabel>
                      {webTemplates.length > 0 ? (
                        webTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id} className="text-sm">{t.nome}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="_no_web" disabled className="text-xs text-muted-foreground">Nenhum template</SelectItem>
                      )}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-bold">Template Doc</SelectLabel>
                      {docTemplates.length > 0 ? (
                        docTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id} className="text-sm">{t.nome}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="_no_doc" disabled className="text-xs text-muted-foreground">Nenhum template</SelectItem>
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onGenerate} disabled={!templateSelecionado || generating || rendering || estimativaBlocked} title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : undefined} className="w-full gap-2">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Publicar nova versão
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Documento gerado e disponível para envio
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

          </div>

          {/* Right: Preview placeholder */}
          <div className="rounded-xl border border-border/50 bg-muted/20 flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
            <div className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Selecione um template e gere a proposta</p>
              <p className="text-xs mt-1">A pré-visualização aparecerá aqui</p>
            </div>
          </div>
        </div>
      );
    }

    // After generation — download helpers using storage-persisted files
    const triggerAnchorDownload = (href: string, fileName: string) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName;
      a.rel = "noopener";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const handleDownloadPdf = async () => {
      if (hasUnpublishedChanges && !result) {
        setShowConfirmPublishDialog({
          open: true,
          action: handleDownloadPdf,
        });
        return;
      }
      try {
        const backendFileName = result?.file_name;
        const fallbackName = (() => {
          const safeName = clienteNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").substring(0, 60);
          return `Proposta_${safeName}_${new Date().toISOString().split("T")[0]}.pdf`;
        })();
        const downloadName = backendFileName || fallbackName;

        if (outputPdfPath) {
          const { data, error } = await supabase.storage
            .from("proposta-documentos")
            .createSignedUrl(outputPdfPath, 300, { download: downloadName });
          if (error) throw error;
          if (!data?.signedUrl) throw new Error("URL assinada não disponível");
          triggerAnchorDownload(data.signedUrl, downloadName);
          toast({ title: "PDF baixado com sucesso!" });
          return;
        }
        if (externalPdfUrl) {
          triggerAnchorDownload(externalPdfUrl, downloadName);
          toast({ title: "PDF aberto em nova aba!" });
          return;
        }
        if (pdfBlobUrl) {
          triggerAnchorDownload(pdfBlobUrl, downloadName);
          toast({ title: "PDF baixado com sucesso!" });
          return;
        }
        toast({ title: "PDF não disponível", description: "Gere a proposta primeiro.", variant: "destructive" });
      } catch (e: any) {
        toast({ title: "Erro ao baixar PDF", description: e?.message ?? String(e), variant: "destructive" });
      }
    };

    const handleDownloadDocx = async () => {
      try {
        const backendDocxName = result?.file_name_docx;
        const fallbackDocxName = (() => {
          const safeName = clienteNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").substring(0, 60);
          return `Proposta_${safeName}_${new Date().toISOString().split("T")[0]}.docx`;
        })();
        const downloadName = backendDocxName || fallbackDocxName;

        if (outputDocxPath) {
          const { data, error } = await supabase.storage
            .from("proposta-documentos")
            .createSignedUrl(outputDocxPath, 300, { download: downloadName });
          if (error) throw error;
          if (!data?.signedUrl) throw new Error("URL assinada não disponível");
          triggerAnchorDownload(data.signedUrl, downloadName);
          toast({ title: "DOCX baixado!" });
          return;
        }
        toast({ title: "DOCX não disponível", variant: "destructive" });
      } catch (e: any) {
        toast({ title: "Erro ao baixar DOCX", description: e?.message ?? String(e), variant: "destructive" });
      }
    };

    const isBusy = generating || rendering;
    // ─────────────────────────────────────────────────────────────────────────
    // SSOT de "Proposta pronta" — NÃO ALTERAR sem auditar AMBOS os contextos:
    //   1) ProposalWizard (fluxo nativo de criação/edição) — alimenta
    //      generationStatus no WizardContext durante geração.
    //   2) ProjetoDetalhe → StepDocumentoBridge (fluxo de visualização/regen
    //      dentro do projeto) — NÃO usa WizardContext, então generationStatus
    //      permanece "idle" mesmo após gerar/regenerar com sucesso.
    //
    // Por isso a fonte canônica de prontidão é o ARTEFATO PERSISTIDO na
    // versão (output_pdf_path | external_pdf_url | output_docx_path),
    // refletido aqui via props vindas do hook de versão ativa.
    // generationStatus === "ready" é apenas um sinal transitório auxiliar.
    //
    // ❌ NUNCA voltar isReady para depender SÓ de generationStatus.
    // ❌ NUNCA esconder QR/WhatsApp/e-mail/links/downloads quando há artefato.
    // ❌ NUNCA criar estado paralelo de "pronta" — esta é a única regra.
    // ─────────────────────────────────────────────────────────────────────────
    const hasArtifact = !!outputPdfPath || !!externalPdfUrl || !!outputDocxPath;
    const isReady = !isBusy && (generationStatus === "ready" || hasArtifact);
    const statusLabel = isReady
      ? "Proposta pronta"
      : generationStatus === "rendering_pdf"
        ? "PDF sendo processado..."
        : generationStatus === "published"
          ? "Versão publicada"
          : isBusy
            ? "Gerando proposta..."
            : generationStatus === "error"
              ? "Erro na geração"
              : "Proposta desatualizada";
    const statusTone = isReady
      ? "success"
      : (isBusy || generationStatus === "published" || generationStatus === "rendering_pdf")
        ? "info"
        : generationStatus === "error"
          ? "destructive"
          : "warning";
    const statusClasses: Record<string, string> = {
      success: "border-success/30 bg-success/5 text-success",
      info: "border-info/30 bg-info/5 text-info",
      warning: "border-warning/30 bg-warning/5 text-warning",
      destructive: "border-destructive/30 bg-destructive/5 text-destructive",
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 sm:gap-6 min-h-[400px]">
        {/* Left: Operational + commercial control panel */}
        <div className="space-y-3">
          {/* 1. STATUS HEADER */}
          <div className={cn("rounded-lg border p-2.5 space-y-1", statusClasses[statusTone])}>
            <div className="flex items-center gap-2">
              {isReady ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : generationStatus === "error" ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <RefreshCw className="h-4 w-4 shrink-0" />
              )}
              <span className="text-xs font-semibold">{statusLabel}</span>
            </div>
            <p className="text-[10px] leading-tight text-muted-foreground pl-6">
              {isReady
                ? "PDF, link público e QR Code prontos para envio"
                : generationStatus === "rendering_pdf"
                  ? "A versão oficial foi salva. O PDF está sendo gerado em background."
                  : generationStatus === "published"
                    ? "Versão oficial sincronizada com o CRM. Iniciando geração do documento..."
                    : isBusy
                      ? "Aguarde, isso pode levar alguns segundos"
                      : generationStatus === "error"
                        ? "Revise os dados e tente regenerar"
                        : "Gere a proposta para liberar envio e link público"}
            </p>
            {isReady && (
              <div className="flex items-center gap-1.5 pl-6 pt-0.5 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Validade: {validade ? formatDate(validade + "T12:00:00") : "—"}</span>
              </div>
            )}
          </div>

          {/* 2. TEMPLATE SELECTOR + UPLOAD .docx */}
          <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-2">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Template do documento</Label>
            <Select value={templateSelecionado} onValueChange={onTemplateSelecionado}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-xs font-bold">Template Web</SelectLabel>
                  {webTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-sm">{t.nome}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-xs font-bold">Template Doc</SelectLabel>
                  {docTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-sm">{t.nome}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <input
              ref={docxUploadRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleDocxUpload}
            />
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground p-0 h-auto"
              onClick={() => docxUploadRef.current?.click()}
              disabled={uploadingDocx}
            >
              {uploadingDocx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploadingDocx ? "Enviando..." : "Upload .docx personalizado"}
            </Button>
          </div>

          {/* 3. PRIMARY GENERATE / REGENERATE CTA */}
          <Button
            variant={isReady ? "outline" : "default"}
            size="lg"
            className="w-full gap-2 h-11"
            onClick={onGenerate}
            disabled={isBusy || !templateSelecionado || estimativaBlocked}
            title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : undefined}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isReady ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
            {isBusy ? "Gerando..." : isReady ? "Regenerar proposta" : "Gerar proposta"}
          </Button>

          {/* 4. COMMERCIAL CTAs — WhatsApp (primary) + Email (secondary) */}
          {isReady && (
            <div className="space-y-2">
              <Button
                variant="success"
                size="lg"
                className="w-full gap-2 h-12 text-sm font-semibold shadow-sm"
                onClick={() => setActiveTab("whatsapp")}
              >
                <MessageCircle className="h-4 w-4" />
                Enviar por WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 h-9"
                onClick={() => setActiveTab("email")}
              >
                <Mail className="h-4 w-4" />
                Enviar por e-mail
              </Button>
            </div>
          )}

          {/* 5. SHARING & TRACKING — sempre visível quando ready */}
          {isReady && (
            <div className="rounded-lg border border-border/50 bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Compartilhar e rastrear
                </Label>
              </div>

              {/* QR Code + URL */}
              {resolvedPublicUrl && (
                <div className="rounded-md border border-border/40 bg-background p-2 flex items-center gap-2.5">
                  <div className="rounded bg-background p-1 border border-border/40 shrink-0">
                    <QRCodeCanvas value={resolvedPublicUrl} size={88} includeMargin={false} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-medium text-foreground">Link público</p>
                    <p className="break-all text-[9px] leading-tight text-muted-foreground">{resolvedPublicUrl}</p>
                  </div>
                </div>
              )}

              {/* Action buttons grid */}
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 h-8 text-xs"
                      onClick={() => handleCopyLink(true)}
                      disabled={!result?.proposta_id || !result?.versao_id}
                    >
                      {copiedTracker ? <Check className="h-3.5 w-3.5 text-success" /> : <LinkIcon className="h-3.5 w-3.5" />}
                      Copiar link com rastreio
                    </Button>
                  </TooltipTrigger>
                  {(!result?.proposta_id || !result?.versao_id) && <TooltipContent>Gere a proposta primeiro</TooltipContent>}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 h-8 text-xs"
                      onClick={() => handleCopyLink(false)}
                      disabled={!outputPdfPath && !externalPdfUrl && !pdfBlobUrl}
                    >
                      {copiedDirect ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      Copiar link direto
                    </Button>
                  </TooltipTrigger>
                  {!outputPdfPath && !externalPdfUrl && !pdfBlobUrl && <TooltipContent>Gere a proposta primeiro</TooltipContent>}
                </Tooltip>
                {hasFinancing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 h-8 text-xs"
                    onClick={handleCopySimulacaoLink}
                  >
                    {copiedSimulacao ? <Check className="h-3.5 w-3.5 text-success" /> : <LinkIcon className="h-3.5 w-3.5" />}
                    Simulação financeira
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-8 text-xs opacity-50 pointer-events-none"
                          disabled
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          Simulação financeira
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Adicione uma opção de financiamento para liberar a simulação</TooltipContent>
                  </Tooltip>
                )}
                <div className="h-px bg-border/40 my-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-8 text-xs"
                  onClick={handleDownloadPdf}
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-8 text-xs"
                  onClick={handleDownloadDocx}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Baixar DOC
                </Button>
                <div className="h-px bg-border/40 my-1" />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 h-8 text-xs"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Validade: {validade ? formatDate(validade + "T12:00:00") : "—"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Alterar validade</Label>
                    <DateInput
                      value={validade}
                      onChange={setValidade}
                      className="h-8 text-xs w-44"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* 6. QUALITY / AUDIT */}
          {generationAuditReport && (
            <div className={cn(
              "rounded-lg border p-2.5 space-y-2",
              generationAuditReport.health === "critica"
                ? "border-destructive/30 bg-destructive/5"
                : generationAuditReport.health === "atencao"
                  ? "border-warning/30 bg-warning/5"
                  : "border-success/30 bg-success/5"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {generationAuditReport.health === "critica" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  ) : generationAuditReport.health === "atencao" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-success shrink-0" />
                  )}
                  <span className={cn(
                    "text-xs font-semibold",
                    generationAuditReport.health === "critica" ? "text-destructive"
                      : generationAuditReport.health === "atencao" ? "text-warning"
                        : "text-success"
                  )}>
                    Qualidade: {generationAuditReport.health === "saudavel" ? "Saudável" : generationAuditReport.health === "atencao" ? "Atenção" : "Crítica"}
                  </span>
                </div>
                <Badge variant="outline" className={cn(
                  "text-[10px]",
                  generationAuditReport.healthScore >= 90 ? "bg-success/10 text-success border-success/20"
                    : generationAuditReport.healthScore >= 70 ? "bg-warning/10 text-warning border-warning/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                )}>
                  {generationAuditReport.healthScore}%
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span>{generationAuditReport.resolved} resolvidas</span>
                {generationAuditReport.errorCount > 0 && (
                  <span className="text-destructive font-medium">{generationAuditReport.errorCount} erro(s)</span>
                )}
                {generationAuditReport.warningCount > 0 && (
                  <span className="text-warning font-medium">{generationAuditReport.warningCount} aviso(s)</span>
                )}
              </div>
              {generationAuditReport.unresolvedPlaceholders.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-foreground">Placeholders não resolvidos:</span>
                  <div className="flex flex-wrap gap-1">
                    {generationAuditReport.unresolvedPlaceholders.map(v => (
                      <Badge key={v} variant="outline" className="text-[10px] border-destructive/30 text-destructive bg-destructive/10">
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {generationAuditReport.nullValues.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-foreground">Variáveis com valor vazio:</span>
                  <div className="flex flex-wrap gap-1">
                    {generationAuditReport.nullValues.map(v => (
                      <Badge key={v} variant="outline" className="text-[10px] border-warning/30 text-warning bg-warning/10">
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {generationAuditReport.items.filter(i => i.status === "error_expression").length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-foreground">Variáveis custom com erro:</span>
                  <div className="flex flex-wrap gap-1">
                    {generationAuditReport.items.filter(i => i.status === "error_expression").map(i => (
                      <Tooltip key={i.variable}>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive bg-destructive/10 cursor-help">
                            {i.variable}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[200px]">{i.message}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {!generationAuditReport && missingVars.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                <span className="text-xs font-semibold text-warning">Placeholders não resolvidos</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {missingVars.map(v => (
                  <Badge key={v} variant="outline" className="text-[10px] border-warning/30 text-warning bg-warning/10">
                    {v.replace(/[[\]{}]/g, "")}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* Right: Preview — PDF real only, no HTML fallback */}
        <div className="min-w-0 min-h-[300px] sm:min-h-[400px]">
          {rendering && !(pdfBlobUrl || resolvedPdfPreviewUrl) ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <Sun className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: "2s" }} />
                <Loader2 className="h-5 w-5 text-primary absolute -bottom-1 -right-1 animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {generationStatus === "converting_pdf" ? "Convertendo para PDF..." :
                   generationStatus === "saving" ? "Salvando artefatos..." :
                   generationStatus === "ready" ? "Carregando documento gerado..." :
                   "Processando documento..."}
                </p>
                <p className="text-xs text-muted-foreground animate-pulse">Isso pode levar alguns segundos</p>
              </div>
            </div>
          ) : (pdfBlobUrl || resolvedPdfPreviewUrl) ? (
            <div className="space-y-3">
              {hasRestoredPreview && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  <p className="text-xs text-warning">
                    Esta proposta foi editada. Gere uma nova versão para atualizar o documento.
                  </p>
                </div>
              )}
              <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
                <iframe
                  src={pdfBlobUrl || resolvedPdfPreviewUrl || ""}
                  title="Proposta PDF Preview"
                  className="w-full border-0"
                  style={{ height: 800 }}
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(pdfBlobUrl || resolvedPdfPreviewUrl || "", "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir em nova aba
                </Button>
              </div>
            </div>
          ) : htmlPreview && !isDocxSelected ? (
            /* HTML preview ONLY for HTML/web templates — never for DOCX */
            <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
              <iframe
                srcDoc={htmlPreview}
                title="Proposta Preview"
                className="w-full border-0"
                style={{ height: 800, background: "#fff" }}
              />
            </div>
          ) : generationStatus === "error" ? (
            <div className="border border-destructive/30 rounded-xl flex flex-col items-center justify-center h-[400px] bg-destructive/5 p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                <Info className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-sm font-medium text-destructive mb-1">Erro ao gerar preview</p>
              <p className="text-xs text-muted-foreground max-w-sm">{generationError}</p>
              <Button variant="outline" size="sm" className="mt-3 gap-2 border-destructive text-destructive hover:bg-destructive/10" onClick={onGenerate} disabled={estimativaBlocked} title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : undefined}>
                <Zap className="h-3.5 w-3.5" />
                Publicar nova versão
              </Button>
            </div>
          ) : outputPdfPath ? (
            <div className="border border-border/50 rounded-xl flex flex-col items-center justify-center h-[400px] bg-muted/20 gap-3 p-6 text-center">
              <Info className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {pdfPreviewError ? "Não foi possível carregar o preview" : "Carregando preview do PDF…"}
              </p>
              {pdfPreviewError && (
                <p className="text-xs text-destructive max-w-sm">{pdfPreviewError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={async () => {
                    setPdfPreviewError(null);
                    const { data, error } = await supabase.storage
                      .from("proposta-documentos")
                      .createSignedUrl(outputPdfPath, 3600);
                    if (data?.signedUrl) {
                      setResolvedPdfPreviewUrl(`${data.signedUrl}#toolbar=1&view=FitH`);
                    } else {
                      setPdfPreviewError(error?.message || "Falha ao gerar link");
                      toast({ title: "Erro ao carregar preview", description: error?.message, variant: "destructive" });
                    }
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tentar novamente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={async () => {
                    const { data } = await supabase.storage
                      .from("proposta-documentos")
                      .createSignedUrl(outputPdfPath, 3600);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir em nova aba
                </Button>
              </div>
            </div>
          ) : externalPdfUrl && !outputPdfPath ? (
            // Fase 1 — PDF original migrado do SolarMarket (link_pdf). Fallback quando não há PDF regenerado.
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                    PDF original SolarMarket
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => window.open(externalPdfUrl, "_blank", "noopener,noreferrer")}
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar PDF original
                </Button>
              </div>
              <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
                <iframe
                  src={externalPdfUrl}
                  title="PDF Original SolarMarket"
                  className="w-full border-0"
                  style={{ height: 800, background: "#fff" }}
                  onError={() => toast({ title: "Não foi possível incorporar o PDF — use 'Baixar PDF original'.", variant: "destructive" })}
                />
              </div>
            </div>
          ) : (generationStatus === "ready" || rendering) ? (
            /* Fallback visual para quando o status já é ready mas os links ainda estão hidratando */
            <div className="border border-border/50 rounded-xl flex flex-col items-center justify-center h-[400px] bg-muted/20 gap-4 p-6 text-center">
              <div className="relative">
                <FileText className="h-10 w-10 text-primary/40" />
                <Loader2 className="h-5 w-5 text-primary absolute -bottom-1 -right-1 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Carregando visualização...</p>
                <p className="text-xs text-muted-foreground">A proposta foi gerada com sucesso e está sendo preparada.</p>
              </div>
            </div>
          ) : (
            <div className="border border-border/50 rounded-xl flex flex-col items-center justify-center h-[400px] bg-muted/20 gap-3">
              <Zap className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">Nenhuma proposta gerada ainda</p>
              <Button variant="default" size="sm" className="gap-2" onClick={onGenerate} disabled={estimativaBlocked} title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : undefined}>
                <Zap className="h-3.5 w-3.5" />
                Publicar nova versão
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── TAB: WHATSAPP ──────────────────────────────────────

  const renderWhatsappTab = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="space-y-1.5 w-44 shrink-0">
          <Label className="text-xs text-muted-foreground">Destinatário</Label>
          <PhoneInput
            value={waDestinatario}
            onChange={setWaDestinatario}
            className="h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 pt-5 flex-1">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border border-border/40">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Para utilizar essa funcionalidade é necessário ter o WhatsApp web
            </span>
          </div>
        </div>

        <div className="pt-5 shrink-0">
          <Button size="sm" className="gap-2" onClick={handleSendWhatsapp} disabled={sendingWa || !result}>
            {sendingWa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sendingWa ? "Enviando..." : "Enviar proposta"}
          </Button>
        </div>
      </div>

      <Textarea
        value={waMensagem}
        onChange={e => setWaMensagem(e.target.value)}
        className="min-h-[200px] text-sm resize-y"
        placeholder="Mensagem para o cliente..."
      />
    </div>
  );

  // ─── TAB: EMAIL ─────────────────────────────────────────

  const renderEmailTab = () => (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline p-0 h-auto"
            onClick={() => setEditHtml(!editHtml)}
          >
            <Code className="h-3.5 w-3.5" />
            {editHtml ? "Editar Visual" : "Editar HTML"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={!resolvedPublicUrl}
            onClick={() => {
              if (!resolvedPublicUrl) return;
              const msgHtml = `<p>Olá ${clienteNome || ""},</p>` +
                `<p>Segue o link de acesso para a sua proposta comercial de energia solar:</p>` +
                `<p><a href="${resolvedPublicUrl}">${resolvedPublicUrl}</a></p>` +
                `<p>Qualquer dúvida, estou à disposição!</p>`;
              setEmailCorpo(msgHtml);
              setEmailAssunto(`Proposta Comercial - Energia Solar${potenciaKwp > 0 ? ` ${potenciaKwp.toFixed(2)} kWp` : ""}`);
              toast({ title: "Mensagem gerada com link da proposta ✉️" });
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Gerar mensagem
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={emailAnexarPdf}
              onCheckedChange={(v) => setEmailAnexarPdf(!!v)}
            />
            Anexar versão em PDF
          </label>
          <Button size="sm" className="gap-2" onClick={handleSendEmail} disabled={sendingEmail || !result}>
            {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sendingEmail ? "Enviando..." : "Enviar proposta"}
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: Form fields */}
        <div className="w-44 shrink-0 space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Template</Label>
            <Select value={selectedEmailTemplate} onValueChange={handleEmailTemplateChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {emailTemplatesData.map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Destinatário</Label>
            <EmailInput
              value={emailDestinatario}
              onChange={setEmailDestinatario}
              placeholder="email@exemplo.com"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Cópia visível</Label>
            <Input
              value={emailCc}
              onChange={e => setEmailCc(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Cópia oculta</Label>
            <Input
              value={emailBcc}
              onChange={e => setEmailBcc(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Assunto do e-mail</Label>
            <Input
              value={emailAssunto}
              onChange={e => setEmailAssunto(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Responder a</Label>
            <EmailInput
              value={emailReplyTo}
              onChange={setEmailReplyTo}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Right: Editor */}
        <div className="flex-1 min-w-0">
          {editHtml ? (
            <Textarea
              value={emailCorpo}
              onChange={e => setEmailCorpo(e.target.value)}
              className="min-h-[350px] text-xs font-mono resize-y"
              placeholder="<html>...</html>"
            />
          ) : (
            <div className="border border-border/50 rounded-lg overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/40 bg-muted/30 flex-wrap">
                <ToolbarButton icon={<Bold className="h-3.5 w-3.5" />} cmd="bold" />
                <ToolbarButton icon={<Italic className="h-3.5 w-3.5" />} cmd="italic" />
                <ToolbarButton icon={<Underline className="h-3.5 w-3.5" />} cmd="underline" />
                <ToolbarSep />
                <select
                  className="h-7 text-xs border border-border/40 rounded px-1 bg-background"
                  onChange={e => document.execCommand("formatBlock", false, e.target.value)}
                >
                  <option value="p">Format Block</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                  <option value="p">Paragraph</option>
                  <option value="blockquote">Quote</option>
                </select>
                <select
                  className="h-7 text-xs border border-border/40 rounded px-1 bg-background"
                  onChange={e => document.execCommand("fontName", false, e.target.value)}
                >
                  <option value="">Font</option>
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Verdana">Verdana</option>
                </select>
                <ToolbarSep />
                <ToolbarButton icon={<span className="text-xs font-bold">A</span>} cmd="foreColor" value="#000000" />
                <ToolbarButton cmd="justifyLeft" icon={<span className="text-[10px]">≡</span>} />
                <ToolbarButton cmd="justifyCenter" icon={<span className="text-[10px]">≡</span>} />
                <ToolbarButton cmd="justifyRight" icon={<span className="text-[10px]">≡</span>} />
                <ToolbarButton cmd="insertUnorderedList" icon={<span className="text-[10px]">•≡</span>} />
                <ToolbarButton cmd="insertOrderedList" icon={<span className="text-[10px]">1≡</span>} />
              </div>

              {/* Editable area */}
              <div
                ref={emailEditorRef}
                contentEditable
                className="min-h-[300px] p-4 text-sm focus:outline-none prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: emailCorpo }}
                onBlur={() => {
                  if (emailEditorRef.current) {
                    setEmailCorpo(emailEditorRef.current.innerHTML);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── RENDER ─────────────────────────────────────────────

  return (
    <div className="space-y-0">

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-transparent border-b border-border/40 rounded-none h-auto p-0 gap-4 w-full justify-start">
          <TabsTrigger
            value="template"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 text-sm"
          >
            Template
          </TabsTrigger>
          <TabsTrigger
            value="whatsapp"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 text-sm"
          >
            Enviar Por Whatsapp
          </TabsTrigger>
          <TabsTrigger
            value="email"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 text-sm"
          >
            Enviar Por E-Mail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="mt-4">
          {renderTemplateTab()}
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          {renderWhatsappTab()}
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          {renderEmailTab()}
        </TabsContent>
      </Tabs>
      <AlertDialog open={!!showConfirmPublishDialog} onOpenChange={(open) => !open && setShowConfirmPublishDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              Publicar rascunho divergente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Existe um rascunho mais recente que a versão oficial. Deseja publicar a nova versão antes de enviar?</p>
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                <div className="flex justify-between text-xs items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Badge variant="outline" className="text-[9px] px-1 py-0 h-4 uppercase">Oficial</Badge> atual</span>
                  <span className="font-semibold">{formatBRL(officialTotal)}</span>
                </div>
                <div className="flex justify-between text-xs items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Badge variant="default" className="text-[9px] px-1 py-0 h-4 uppercase bg-amber-500 text-white border-0">Rascunho</Badge> novo</span>
                  <span className="font-bold text-amber-600">{formatBRL(draftTotal)}</span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <div className="flex flex-col sm:flex-row gap-2 w-full justify-between">
              <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
              <div className="flex flex-col sm:flex-row gap-2">
                <AlertDialogAction
                  className="bg-transparent text-foreground border border-input hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    if (showConfirmPublishDialog?.action) {
                      showConfirmPublishDialog.action();
                    }
                    setShowConfirmPublishDialog(null);
                  }}
                >
                  Enviar oficial atual
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={async () => {
                    const action = showConfirmPublishDialog?.action;
                    setShowConfirmPublishDialog(null);
                    if (onGenerate) {
                      await onGenerate();
                      // After generating, the user usually wants to see the result.
                      // We'll let them click send again on the new official version.
                    }
                  }}
                >
                  Publicar e enviar
                </AlertDialogAction>
              </div>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Toolbar Helpers ──────────────────────────────────────

function ToolbarButton({ icon, cmd, value }: { icon: React.ReactNode; cmd: string; value?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      onMouseDown={e => {
        e.preventDefault();
        document.execCommand(cmd, false, value || undefined);
      }}
    >
      {icon}
    </Button>
  );
}

function ToolbarSep() {
  return <div className="w-px h-5 bg-border/50 mx-1" />;
}
