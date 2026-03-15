import { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText, Sun, Zap, Loader2, Globe, FileDown, Upload, MessageCircle, Mail,
  Download, Link2, LinkIcon, Calendar, Copy, Check, Info, Send, Bold, Italic, Underline, Code,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useProposalTemplates, useEmailTemplates } from "@/hooks/useProposalTemplates";
import { formatBRL } from "./types";
import { toast } from "@/hooks/use-toast";

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
  generationStatus?: "idle" | "generating_docx" | "converting_pdf" | "saving" | "ready" | "docx_only" | "error";
  generationError?: string | null;
  missingVars?: string[];
  onGenerate: () => void;
  onNewVersion: () => void;
  onViewDetail: () => void;
  customFieldValues?: Record<string, any>;
  onCustomFieldValuesChange?: (values: Record<string, any>) => void;
  docxBlob?: Blob | null;
}

// ─── Main Component ───────────────────────────────────────

export function StepDocumento({
  clienteNome, empresaNome, clienteTelefone, clienteEmail,
  potenciaKwp, areaUtilM2 = 0, geracaoMensalKwh = 0,
  numUcs, precoFinal,
  templateSelecionado, onTemplateSelecionado,
  generating, rendering, result, htmlPreview, pdfBlobUrl,
  outputDocxPath, outputPdfPath,
  generationStatus = "idle", generationError,
  missingVars = [],
  onGenerate, onNewVersion, onViewDetail,
  customFieldValues = {}, onCustomFieldValuesChange,
  docxBlob,
}: StepDocumentoProps) {
  // ─── Queries via hooks (§16 AGENTS.md) ──────────────────
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

  // Link copy state
  const [copiedTracker, setCopiedTracker] = useState(false);
  const [copiedDirect, setCopiedDirect] = useState(false);

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

  // Update WA message when result is available
  useEffect(() => {
    if (result) {
      const link = result.link_rastreio || result.link_publico || "";
      setWaMensagem(`Olá,\nSegue o link de acesso para a sua proposta comercial:\n${link}`);
    }
  }, [result]);

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

  const handleCopyLink = (withTracker: boolean) => {
    const link = withTracker
      ? (result?.link_rastreio || result?.link_publico || "")
      : (result?.link_publico || "");
    navigator.clipboard.writeText(link);
    if (withTracker) {
      setCopiedTracker(true);
      setTimeout(() => setCopiedTracker(false), 2000);
    } else {
      setCopiedDirect(true);
      setTimeout(() => setCopiedDirect(false), 2000);
    }
    toast({ title: "Link copiado!" });
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

  const wpPerKwp = potenciaKwp > 0 ? (precoFinal / potenciaKwp / 1000).toFixed(2) : "0.00";

  // ─── METRICS HEADER ─────────────────────────────────────

  const MetricsHeader = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-base font-bold text-foreground">Proposta</h3>
      </div>

      <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none">Potência</p>
            <p className="text-sm font-bold">{potenciaKwp.toFixed(2)} kWp</p>
          </div>
        </div>
        {areaUtilM2 > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none">Área Útil</p>
            <p className="text-sm font-bold">{areaUtilM2} m²</p>
          </div>
        )}
        {geracaoMensalKwh > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none">Geração</p>
            <p className="text-sm font-bold">{geracaoMensalKwh} kWh</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground leading-none">Preço</p>
          <p className="text-sm font-bold">
            {formatBRL(precoFinal)}{" "}
            <span className="text-[10px] font-normal text-muted-foreground">R$ {wpPerKwp}/Wp</span>
          </p>
        </div>
      </div>
    </div>
  );

  // ─── TAB: TEMPLATE ──────────────────────────────────────

  const renderTemplateTab = () => {
    // ── Generation in progress
    if (generating) {
      const statusMsg = generationStatus === "generating_docx" ? "Gerando documento DOCX..."
        : generationStatus === "converting_pdf" ? "Convertendo para PDF..."
        : generationStatus === "saving" ? "Salvando artefatos..."
        : "Gerando proposta comercial...";
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Sun className="h-12 w-12 text-primary animate-spin" style={{ animationDuration: "2s" }} />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">{statusMsg}</p>
          <div className="flex items-center gap-2">
            {["generating_docx", "converting_pdf", "saving"].map((s, i) => (
              <div key={s} className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                generationStatus === s ? "bg-primary animate-pulse" :
                ["generating_docx", "converting_pdf", "saving"].indexOf(generationStatus) > i ? "bg-primary" : "bg-muted"
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
            <Button onClick={onGenerate} disabled={!templateSelecionado} className="w-full gap-2">
              <Zap className="h-4 w-4" />
              Tentar Novamente
            </Button>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Info className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-semibold text-destructive mb-2">Erro na geração do documento</p>
            <p className="text-xs text-muted-foreground max-w-md">{generationError}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-2 border-destructive text-destructive hover:bg-destructive/10" onClick={onGenerate}>
              <Zap className="h-3.5 w-3.5" />
              Regenerar Proposta
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
            <Button onClick={onGenerate} disabled={!templateSelecionado} className="w-full gap-2">
              <Zap className="h-4 w-4" />
              Regenerar com PDF
            </Button>
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={async () => {
              const { data } = await supabase.storage.from("proposta-documentos").createSignedUrl(outputDocxPath, 3600);
              if (data?.signedUrl) {
                const resp = await fetch(data.signedUrl);
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "proposta.docx";
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

    // ── Before generation
    if (!result) {
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

            <Button onClick={onGenerate} disabled={!templateSelecionado || generating} className="w-full gap-2">
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
      // Fallback to pdfBlobUrl (signed URL already available)
      if (pdfBlobUrl) {
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

          <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-xs text-primary hover:underline p-0 h-auto">
            <Upload className="h-3.5 w-3.5" />
            Fazer upload de arquivo doc
          </Button>

          <Separator />

          {/* Generation status badge */}
          {generationStatus === "ready" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success/10 border border-success/20">
              <Check className="h-3.5 w-3.5 text-success" />
              <span className="text-xs font-medium text-success">Documento pronto</span>
            </div>
          )}

          {/* Missing variables warning */}
          {missingVars.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                <span className="text-xs font-semibold text-warning">Placeholders não resolvidos</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {missingVars.map(v => (
                  <Badge key={v} variant="outline" className="text-[10px] border-warning/30 text-warning bg-warning/10">
                    {v.replace(/[\[\]{}]/g, "")}
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
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start p-0 h-auto"
              onClick={() => handleCopyLink(true)}
            >
              {copiedTracker ? <Check className="h-3.5 w-3.5 text-success" /> : <LinkIcon className="h-3.5 w-3.5" />}
              Copiar link com rastreio
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start p-0 h-auto"
              onClick={() => handleCopyLink(false)}
            >
              {copiedDirect ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              Copiar link sem rastreio
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Validade da proposta: {validade ? new Date(validade + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
            </div>
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
            <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
              <iframe
                src={pdfBlobUrl}
                title="Proposta PDF Preview"
                className="w-full border-0"
                style={{ height: 800 }}
              />
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
              <Button variant="outline" size="sm" className="mt-3 gap-2 border-destructive text-destructive hover:bg-destructive/10" onClick={onGenerate}>
                <Zap className="h-3.5 w-3.5" />
                Regenerar
              </Button>
            </div>
          ) : (
            <div className="border border-border/50 rounded-xl flex items-center justify-center h-[400px] bg-muted/20">
              <p className="text-sm text-muted-foreground">Preview indisponível</p>
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
          <Input
            value={waDestinatario}
            onChange={e => setWaDestinatario(e.target.value)}
            placeholder="(00) 00000-0000"
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
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline p-0 h-auto"
          onClick={() => setEditHtml(!editHtml)}
        >
          <Code className="h-3.5 w-3.5" />
          {editHtml ? "Editar Visual" : "Editar HTML"}
        </Button>

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
      <MetricsHeader />

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
