import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { getPublicUrl } from "@/lib/getPublicUrl";
import type { GenerationAuditReport } from "@/services/generationAudit";
import {
  FileText, Sun, Zap, Loader2, Globe, FileDown, Upload, MessageCircle, Mail,
  Download, Link2, LinkIcon, Calendar, Copy, Check, Info, Send, Bold, Italic, Underline, Code,
  AlertTriangle, ExternalLink, Sparkles, RefreshCw,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { cn } from "@/lib/utils";
import { sendProposal } from "@/services/proposalApi";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { useProposalTemplates, useEmailTemplates } from "@/hooks/useProposalTemplates";
import { useQueryClient } from "@tanstack/react-query";
import { formatBRL } from "./types";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";

// ─── Types ────────────────────────────────────────────────

interface StepDocumentoProps {
  clienteNome: string;
  empresaNome?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  potenciaKwp: number;
  areaUtilM2?: number;
  geracaoMensalKwh?: number;
  numUcs: number;
  precoFinal: number;
  templateSelecionado: string;
  onTemplateSelecionado: (id: string) => void;
  generating: boolean;
  rendering: boolean;
  result: any;
  htmlPreview: string | null;
  pdfBlobUrl?: string | null;
  outputDocxPath?: string | null;
  outputPdfPath?: string | null;
  externalPdfUrl?: string | null;
  generationStatus?: "idle" | "calculating" | "generating_docx" | "converting_pdf" | "saving" | "ready" | "docx_only" | "error";
  generationError?: string | null;
  missingVars?: string[];
  onGenerate: () => void;
  onNewVersion: () => void;
  onViewDetail: () => void;
  customFieldValues?: Record<string, any>;
  onCustomFieldValuesChange?: (values: Record<string, any>) => void;
  docxBlob?: Blob | null;
  generationAuditReport?: GenerationAuditReport | null;
  /** When true, all "Gerar Proposta" buttons are disabled (estimativa not accepted) */
  estimativaBlocked?: boolean;
  /** When true, skip auto-selecting the first template */
  skipTemplateAutoSelect?: boolean;
}

// ─── Main Component ───────────────────────────────────────

export function StepDocumento({
  clienteNome, empresaNome, clienteTelefone, clienteEmail,
  potenciaKwp, areaUtilM2 = 0, geracaoMensalKwh = 0,
  numUcs, precoFinal,
  templateSelecionado, onTemplateSelecionado,
  generating, rendering, result, htmlPreview, pdfBlobUrl,
  outputDocxPath, outputPdfPath,
  externalPdfUrl,
  generationStatus = "idle", generationError,
  missingVars = [],
  onGenerate, onNewVersion, onViewDetail,
  customFieldValues = {}, onCustomFieldValuesChange,
  docxBlob,
  generationAuditReport,
  estimativaBlocked = false,
  skipTemplateAutoSelect = false,
}: StepDocumentoProps) {
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

  // Proposal validity
  const [validade, setValidade] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split("T")[0];
  });

  // Auto-select first template
  useEffect(() => {
    if (!templateSelecionado && templates.length > 0) {
      onTemplateSelecionado(templates[0].id);
    }
  }, [templates, templateSelecionado, onTemplateSelecionado]);

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
        // Try to get existing tracked token
        const { data: existing } = await supabase
          .from("proposta_aceite_tokens" as any)
          .select("token")
          .eq("proposta_id", result.proposta_id)
          .eq("versao_id", result.versao_id)
          .eq("tipo", "tracked")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let token = (existing as any)?.token as string | undefined;

        // Create if not exists
        if (!token) {
          const { tenantId } = await getCurrentTenantId();
          const { data: created } = await supabase
            .from("proposta_aceite_tokens" as any)
            .insert({
              proposta_id: result.proposta_id,
              versao_id: result.versao_id,
              tenant_id: tenantId,
              tipo: "tracked",
            } as any)
            .select("token")
            .single();
          token = (created as any)?.token;
        }

        if (cancelled) return;

        const url = token ? `${getPublicUrl()}/proposta/${token}` : "";
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
    const directPdfUrl = outputPdfPath
      ? null
      : (externalPdfUrl || pdfBlobUrl || null);

    if (!outputPdfPath && !directPdfUrl) {
      toast({ title: "Gere a proposta primeiro para copiar o link do PDF", variant: "destructive" });
      return;
    }

    try {
      let url = directPdfUrl;

      if (!url && outputPdfPath) {
        const { data: signedData, error: signErr } = await supabase.storage
          .from("proposta-documentos")
          .createSignedUrl(outputPdfPath, 604800); // 7 days

        if (signErr || !signedData?.signedUrl) {
          toast({ title: "Erro ao gerar link do PDF", description: signErr?.message, variant: "destructive" });
          return;
        }

        url = signedData.signedUrl;
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
          ? "Link do PDF copiado (com rastreio)! 🔗"
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

      const url = `${getPublicUrl()}/proposta/${token}?view=simulacao`;
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
    if (generating) {
      const statusMsg = generationStatus === "calculating" ? "Calculando dimensionamento..."
        : generationStatus === "generating_docx" ? "Gerando documento..."
        : generationStatus === "converting_pdf" ? "Convertendo para PDF..."
        : generationStatus === "saving" ? "Finalizando..."
        : "Gerando proposta comercial...";
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Sun className="h-12 w-12 text-primary animate-spin" style={{ animationDuration: "2s" }} />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">{statusMsg}</p>
          <div className="flex items-center gap-2">
            {["calculating", "generating_docx", "converting_pdf", "saving"].map((s, i) => (
              <div key={s} className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                generationStatus === s ? "bg-primary animate-pulse" :
                ["calculating", "generating_docx", "converting_pdf", "saving"].indexOf(generationStatus) > i ? "bg-primary" : "bg-muted"
              )} />
            ))}
          </div>
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
              Gerar Proposta
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
              Gerar Proposta
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
              Gerar Proposta
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
              <Info className="h-6 w-6 text-warning" />
            </div>
            <p className="text-sm font-semibold text-warning mb-2">DOCX gerado com sucesso</p>
            <p className="text-xs text-muted-foreground max-w-md">
              {generationError || "A conversão para PDF não foi possível. O DOCX está disponível para download."}
            </p>
          </div>
        </div>
      );
    }

    // ── Before generation (no result AND no restored PDF)
    const hasRestoredPreview = !result && (!!pdfBlobUrl || !!outputPdfPath);
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

            <Button onClick={onGenerate} disabled={!templateSelecionado || generating || estimativaBlocked} title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : undefined} className="w-full gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Gerar Proposta
            </Button>
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
    const handleDownloadPdf = async () => {
      // Build a good filename from backend response or local fallback
      const backendFileName = result?.file_name;
      const fallbackName = (() => {
        const safeName = clienteNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").substring(0, 60);
        return `Proposta_${safeName}_${new Date().toISOString().split("T")[0]}.pdf`;
      })();
      const downloadName = backendFileName || fallbackName;

      if (outputPdfPath) {
        // Fetch from storage via signed URL (fetch-to-blob for cross-origin download)
        const { data } = await supabase.storage.from("proposta-documentos").createSignedUrl(outputPdfPath, 300);
        if (data?.signedUrl) {
          const resp = await fetch(data.signedUrl);
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = downloadName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast({ title: "PDF baixado com sucesso!" });
          return;
        }
      }
      if (externalPdfUrl) {
        window.open(externalPdfUrl, "_blank", "noopener,noreferrer");
        toast({ title: "PDF aberto em nova aba!" });
        return;
      }
      // Fallback to pdfBlobUrl (signed URL already available)
      if (pdfBlobUrl) {
        try {
          const resp = await fetch(pdfBlobUrl);
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = downloadName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast({ title: "PDF baixado com sucesso!" });
          return;
        } catch {
          window.open(pdfBlobUrl, "_blank", "noopener,noreferrer");
          toast({ title: "PDF aberto em nova aba!" });
          return;
        }
      }
      toast({ title: "PDF não disponível", description: "Gere a proposta primeiro.", variant: "destructive" });
    };

    const handleDownloadDocx = async () => {
      const backendDocxName = result?.file_name_docx;
      const fallbackDocxName = (() => {
        const safeName = clienteNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").substring(0, 60);
        return `Proposta_${safeName}_${new Date().toISOString().split("T")[0]}.docx`;
      })();
      const downloadName = backendDocxName || fallbackDocxName;

      if (outputDocxPath) {
        const { data } = await supabase.storage.from("proposta-documentos").createSignedUrl(outputDocxPath, 300);
        if (data?.signedUrl) {
          const resp = await fetch(data.signedUrl);
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = downloadName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast({ title: "DOCX baixado!" });
          return;
        }
      }
      // Fallback to local blob
      if (docxBlob) {
        const url = URL.createObjectURL(docxBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "DOCX baixado!" });
        return;
      }
      toast({ title: "DOCX não disponível", variant: "destructive" });
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 sm:gap-6 min-h-[400px]">
        {/* Left: Sidebar with actions */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Template</Label>
            <Select value={templateSelecionado} onValueChange={onTemplateSelecionado}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
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
          </div>

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
            className="flex items-center gap-1.5 text-xs text-primary hover:underline p-0 h-auto"
            onClick={() => docxUploadRef.current?.click()}
            disabled={uploadingDocx}
          >
            {uploadingDocx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploadingDocx ? "Enviando..." : "Fazer upload de arquivo doc"}
          </Button>

          <Separator />

          {/* Generation status badge */}
          {generationStatus === "ready" && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success/10 border border-success/20">
                <Check className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-medium text-success">Documento pronto</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={onGenerate}
                disabled={generating || rendering || !templateSelecionado || estimativaBlocked}
                title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : undefined}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Gerar Proposta
              </Button>
            </div>
          )}

          {/* Generation Quality Score + Missing variables */}
          {generationAuditReport && (
            <div className={cn(
              "rounded-lg border p-2.5 space-y-2",
              generationAuditReport.health === "critica"
                ? "border-destructive/30 bg-destructive/5"
                : generationAuditReport.health === "atencao"
                  ? "border-warning/30 bg-warning/5"
                  : "border-success/30 bg-success/5"
            )}>
              {/* Health badge */}
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
                    Qualidade da Geração: {generationAuditReport.health === "saudavel" ? "Saudável" : generationAuditReport.health === "atencao" ? "Atenção" : "Crítica"}
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
              {/* Summary stats */}
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span>{generationAuditReport.resolved} resolvidas</span>
                {generationAuditReport.errorCount > 0 && (
                  <span className="text-destructive font-medium">{generationAuditReport.errorCount} erro(s)</span>
                )}
                {generationAuditReport.warningCount > 0 && (
                  <span className="text-warning font-medium">{generationAuditReport.warningCount} aviso(s)</span>
                )}
              </div>
              {/* Unresolved placeholders */}
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
              {/* Null values */}
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
              {/* Custom var expression errors */}
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
              {generationAuditReport.items.filter(i => i.suggestion).length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Esses campos ficaram em branco no documento. Verifique os dados nas etapas anteriores.
                </p>
              )}
            </div>
          )}
          {/* Fallback: show simple missing vars if no audit report yet */}
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
              <p className="text-[10px] text-muted-foreground">
                Esses campos ficaram em branco no documento. Verifique os dados nas etapas anteriores.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <Button
            variant="success"
            size="sm"
            className="w-full gap-2"
            onClick={() => setActiveTab("whatsapp")}
          >
            <MessageCircle className="h-4 w-4" />
            Enviar por whatsapp
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-info text-info hover:bg-info/10"
            onClick={() => setActiveTab("email")}
          >
            <Mail className="h-4 w-4" />
            Enviar e-mail
          </Button>

          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start p-0 h-auto"
              onClick={handleDownloadPdf}
            >
              <Download className="h-3.5 w-3.5" />
              Download de PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start p-0 h-auto"
              onClick={handleDownloadDocx}
            >
              <FileDown className="h-3.5 w-3.5" />
              Download de Doc
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start p-0 h-auto"
                  onClick={() => handleCopyLink(true)}
                  disabled={!outputPdfPath && !externalPdfUrl && !pdfBlobUrl}
                >
                  {copiedTracker ? <Check className="h-3.5 w-3.5 text-success" /> : <LinkIcon className="h-3.5 w-3.5" />}
                  Copiar link com rastreio
                </Button>
              </TooltipTrigger>
              {!outputPdfPath && !externalPdfUrl && !pdfBlobUrl && <TooltipContent>Gere a proposta primeiro</TooltipContent>}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start p-0 h-auto"
                  onClick={() => handleCopyLink(false)}
                  disabled={!outputPdfPath && !externalPdfUrl && !pdfBlobUrl}
                >
                  {copiedDirect ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar link sem rastreio
                </Button>
              </TooltipTrigger>
              {!outputPdfPath && !externalPdfUrl && !pdfBlobUrl && <TooltipContent>Gere a proposta primeiro</TooltipContent>}
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start p-0 h-auto"
              onClick={handleCopySimulacaoLink}
            >
              {copiedSimulacao ? <Check className="h-3.5 w-3.5 text-success" /> : <LinkIcon className="h-3.5 w-3.5" />}
              Copiar link simulação financeira
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start p-0 h-auto"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Validade da proposta: {validade ? formatDate(validade + "T12:00:00") : "—"}
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

        {/* Right: Preview — PDF real only, no HTML fallback */}
        <div className="min-w-0 min-h-[300px] sm:min-h-[400px]">
          {rendering ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Sun className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: "2s" }} />
              <p className="text-sm text-muted-foreground animate-pulse">
                {generationStatus === "converting_pdf" ? "Convertendo para PDF..." :
                 generationStatus === "saving" ? "Salvando artefatos..." :
                 "Processando documento..."}
              </p>
            </div>
          ) : pdfBlobUrl ? (
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
                  src={pdfBlobUrl}
                  title="Proposta PDF Preview"
                  className="w-full border-0"
                  style={{ height: 800 }}
                />
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
                Gerar Proposta
              </Button>
            </div>
          ) : outputPdfPath ? (
            <div className="border border-border/50 rounded-xl flex flex-col items-center justify-center h-[400px] bg-muted/20 gap-3">
              <Info className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Não foi possível carregar o preview</p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  const { data } = await supabase.storage
                    .from("proposta-documentos")
                    .createSignedUrl(outputPdfPath, 3600);
                  if (data?.signedUrl) {
                    // Force re-render by opening in iframe via parent state
                    window.open(data.signedUrl, "_blank");
                  } else {
                    toast({ title: "Erro ao carregar preview", variant: "destructive" });
                  }
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Abrir PDF em nova aba
              </Button>
            </div>
          ) : (
            <div className="border border-border/50 rounded-xl flex flex-col items-center justify-center h-[400px] bg-muted/20 gap-3">
              <Zap className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">Nenhuma proposta gerada ainda</p>
              <Button variant="default" size="sm" className="gap-2" onClick={onGenerate} disabled={estimativaBlocked} title={estimativaBlocked ? "Marque o aceite de estimativa acima para continuar" : undefined}>
                <Zap className="h-3.5 w-3.5" />
                Gerar Proposta
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
