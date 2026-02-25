import { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText, Sun, Zap, Loader2, Globe, FileDown, Upload, MessageCircle, Mail,
  Download, Link2, LinkIcon, Calendar, Copy, Check, Info, Send, Bold, Italic, Underline, Code,
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
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "./types";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────

interface PropostaTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  grupo: string;
  categoria: string;
  tipo: string;
  thumbnail_url: string | null;
}

interface EmailTemplate {
  id: string;
  nome: string;
  assunto: string;
  corpo_html: string;
  ativo: boolean;
}

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
  onGenerate: () => void;
  onNewVersion: () => void;
  onViewDetail: () => void;
  customFieldValues?: Record<string, any>;
  onCustomFieldValuesChange?: (values: Record<string, any>) => void;
}

// ─── Main Component ───────────────────────────────────────

export function StepDocumento({
  clienteNome, empresaNome, clienteTelefone, clienteEmail,
  potenciaKwp, areaUtilM2 = 0, geracaoMensalKwh = 0,
  numUcs, precoFinal,
  templateSelecionado, onTemplateSelecionado,
  generating, rendering, result, htmlPreview,
  onGenerate, onNewVersion, onViewDetail,
  customFieldValues = {}, onCustomFieldValuesChange,
}: StepDocumentoProps) {
  const [templates, setTemplates] = useState<PropostaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [activeTab, setActiveTab] = useState("template");

  // WhatsApp state
  const [waDestinatario, setWaDestinatario] = useState(clienteTelefone || "");
  const [waMensagem, setWaMensagem] = useState("");

  // Email state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
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

  // ─── Load templates
  useEffect(() => {
    setLoadingTemplates(true);
    supabase
      .from("proposta_templates")
      .select("id, nome, descricao, grupo, categoria, tipo, thumbnail_url")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        const tpls = (data || []) as PropostaTemplate[];
        setTemplates(tpls);
        setLoadingTemplates(false);
        // Auto-select first template if none selected
        if (!templateSelecionado && tpls.length > 0) {
          onTemplateSelecionado(tpls[0].id);
        }
      });
  }, []);

  // ─── Load email templates
  useEffect(() => {
    supabase
      .from("proposta_email_templates" as any)
      .select("id, nome, assunto, corpo_html, ativo")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        const tpls = (data as unknown as EmailTemplate[]) || [];
        setEmailTemplates(tpls);
        if (tpls.length > 0) {
          setSelectedEmailTemplate(tpls[0].id);
          setEmailAssunto(tpls[0].assunto || "");
          setEmailCorpo(tpls[0].corpo_html || "");
        }
      });
  }, []);

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

  const selectedTemplateName = templates.find(t => t.id === templateSelecionado)?.nome || "";

  // ─── Handlers
  const handleEmailTemplateChange = (id: string) => {
    setSelectedEmailTemplate(id);
    const tpl = emailTemplates.find(t => t.id === id);
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
      const { data, error } = await supabase.functions.invoke("proposal-send", {
        body: {
          proposta_id: result.proposta_id,
          versao_id: result.versao_id,
          canal: "whatsapp",
          lead_id: undefined,
        },
      });
      if (error) throw new Error("Erro ao enviar via WhatsApp");
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      toast({ title: "Proposta enviada via WhatsApp!", description: data.whatsapp_sent ? "Mensagem entregue pela API integrada." : "Link gerado com sucesso." });
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
      const { data, error } = await supabase.functions.invoke("proposal-send", {
        body: {
          proposta_id: result.proposta_id,
          versao_id: result.versao_id,
          canal: "link",
          lead_id: undefined,
        },
      });
      if (error) throw new Error("Erro ao enviar por e-mail");
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
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
    if (generating) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Sun className="h-12 w-12 text-primary animate-spin" style={{ animationDuration: "2s" }} />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Gerando proposta comercial...</p>
        </div>
      );
    }

    // Before generation
    if (!result) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 sm:gap-6 min-h-[400px]">
          {/* Left: Template Selection */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Selecione o template</Label>
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

    // After generation
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

          <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
            <Upload className="h-3.5 w-3.5" />
            Fazer upload de arquivo doc
          </button>

          <Separator />

          {/* Action buttons */}
          <Button
            variant="default"
            size="sm"
            className="w-full gap-2 bg-success hover:bg-success/90 text-white"
            onClick={() => setActiveTab("whatsapp")}
          >
            <MessageCircle className="h-4 w-4" />
            Enviar por whatsapp
          </Button>

          <Button
            variant="default"
            size="sm"
            className="w-full gap-2 bg-info hover:bg-info/90 text-white"
            onClick={() => setActiveTab("email")}
          >
            <Mail className="h-4 w-4" />
            Enviar e-mail
          </Button>

          <div className="space-y-2">
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <Download className="h-3.5 w-3.5" />
              Download de PDF
            </button>
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <FileDown className="h-3.5 w-3.5" />
              Download de Doc
            </button>
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => handleCopyLink(true)}
            >
              {copiedTracker ? <Check className="h-3.5 w-3.5 text-success" /> : <LinkIcon className="h-3.5 w-3.5" />}
              Copiar link com rastreio
            </button>
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => handleCopyLink(false)}
            >
              {copiedDirect ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              Copiar link sem rastreio
            </button>
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <Calendar className="h-3.5 w-3.5" />
              Validade da proposta: {validade ? new Date(validade + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="min-w-0 min-h-[300px] sm:min-h-[400px]">
          {rendering ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Sun className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: "2s" }} />
              <p className="text-sm text-muted-foreground animate-pulse">Renderizando proposta...</p>
            </div>
          ) : htmlPreview ? (
            <div className="border border-border/50 rounded-xl overflow-hidden bg-white shadow-sm">
              <iframe
                srcDoc={htmlPreview}
                title="Proposta Preview"
                className="w-full border-0"
                style={{ height: 600, pointerEvents: "none" }}
              />
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
        <button
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          onClick={() => setEditHtml(!editHtml)}
        >
          <Code className="h-3.5 w-3.5" />
          {editHtml ? "Editar Visual" : "Editar HTML"}
        </button>

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
                {emailTemplates.map(t => (
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
    <button
      type="button"
      className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
      onMouseDown={e => {
        e.preventDefault();
        document.execCommand(cmd, false, value || undefined);
      }}
    >
      {icon}
    </button>
  );
}

function ToolbarSep() {
  return <div className="w-px h-5 bg-border/50 mx-1" />;
}
