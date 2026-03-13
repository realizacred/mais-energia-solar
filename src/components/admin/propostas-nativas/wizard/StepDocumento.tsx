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
import { sendProposal } from "@/services/proposalApi";
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
  generating, rendering, result, htmlPreview,
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

          <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-xs text-primary hover:underline p-0 h-auto">
            <Upload className="h-3.5 w-3.5" />
            Fazer upload de arquivo doc
          </Button>

          <Separator />

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
              onClick={async () => {
                let htmlToRender = htmlPreview;
                if (!htmlToRender && docxBlob) {
                  try {
                    const mammoth = await import("mammoth");
                    const arrayBuffer = await docxBlob.arrayBuffer();
                    const mammothResult = await (mammoth as any).convertToHtml({
                      arrayBuffer,
                      convertImage: (mammoth as any).images.imgElement((image: any) =>
                        image.read("base64").then((imageBuffer: string) => ({
                          src: `data:${image.contentType};base64,${imageBuffer}`,
                        }))
                      ),
                    });
                    htmlToRender = `<!DOCTYPE html><html><head><style>
                      * { box-sizing: border-box; }
                      body { font-family: 'Segoe UI', Arial, sans-serif; width: 794px; margin: 0 auto; padding: 60px; color: #333; line-height: 1.6; font-size: 12px; background: #fff; }
                      table { border-collapse: collapse; width: 100%; margin: 12px 0; }
                      td, th { border: 1px solid #ddd; padding: 6px 10px; vertical-align: middle; }
                      th { background: #f5f5f5; font-weight: 600; }
                      img { max-width: 100%; height: auto; display: block; margin: 8px 0; clear: both; position: relative; }
                      p img, span img { display: inline; margin: 0 4px; vertical-align: middle; max-height: 1.5em; }
                      h1 { font-size: 20px; } h2 { font-size: 17px; } h3 { font-size: 15px; }
                      p { margin: 6px 0; }
                    </style></head><body>${mammothResult.value}</body></html>`;
                  } catch (convErr: any) {
                    toast({ title: "Erro ao preparar preview para PDF", description: convErr?.message || "Conversão DOCX falhou", variant: "destructive" });
                    return;
                  }
                }
                if (!htmlToRender) { toast({ title: "Preview não disponível para PDF", variant: "destructive" }); return; }
                try {
                  const html2canvas = (await import("html2canvas")).default;
                  const { jsPDF } = await import("jspdf");

                  // A4 dimensions
                  const A4_W_MM = 210;
                  const A4_H_MM = 297;
                  const MARGIN_MM = 10;
                  const CONTENT_W_MM = A4_W_MM - MARGIN_MM * 2;
                  const CONTENT_W_PX = 794; // ~A4 at 96dpi

                  // Render HTML in hidden iframe
                  const iframe = document.createElement("iframe");
                  iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${CONTENT_W_PX}px;height:auto;border:none;`;
                  document.body.appendChild(iframe);
                  iframe.contentDocument?.open();
                  iframe.contentDocument?.write(htmlToRender);
                  iframe.contentDocument?.close();
                  await new Promise(r => setTimeout(r, 800));

                  // Auto-size iframe to content
                  const bodyEl = iframe.contentDocument!.body;
                  iframe.style.height = `${bodyEl.scrollHeight + 100}px`;
                  await new Promise(r => setTimeout(r, 200));

                  // Capture full content
                  const canvas = await html2canvas(bodyEl, {
                    scale: 2,
                    useCORS: true,
                    width: CONTENT_W_PX,
                    windowWidth: CONTENT_W_PX,
                    backgroundColor: "#ffffff",
                  });
                  document.body.removeChild(iframe);

                  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                  const scaleFactor = CONTENT_W_MM / (canvas.width / 2);
                  const totalHeightMM = (canvas.height / 2) * scaleFactor;
                  const pageContentH = A4_H_MM - MARGIN_MM * 2;

                  // Slice canvas into A4 pages
                  const totalPages = Math.ceil(totalHeightMM / pageContentH);
                  for (let page = 0; page < totalPages; page++) {
                    if (page > 0) pdf.addPage();

                    const srcY = Math.round((page * pageContentH / scaleFactor) * 2);
                    const srcH = Math.round((pageContentH / scaleFactor) * 2);
                    const sliceH = Math.min(srcH, canvas.height - srcY);

                    if (sliceH <= 0) break;

                    // Create slice canvas for this page
                    const sliceCanvas = document.createElement("canvas");
                    sliceCanvas.width = canvas.width;
                    sliceCanvas.height = sliceH;
                    const ctx = sliceCanvas.getContext("2d")!;
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                    ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

                    const sliceImgData = sliceCanvas.toDataURL("image/png");
                    const sliceHMM = (sliceH / 2) * scaleFactor;
                    pdf.addImage(sliceImgData, "PNG", MARGIN_MM, MARGIN_MM, CONTENT_W_MM, sliceHMM);
                  }

                  const safeName = clienteNome.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
                  pdf.save(`Proposta_${safeName}_${new Date().toISOString().split("T")[0]}.pdf`);
                  toast({ title: "PDF baixado com sucesso!" });
                } catch (err: any) {
                  toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
                }
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Download de PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start p-0 h-auto"
              onClick={() => {
                if (!docxBlob) { toast({ title: "DOCX não disponível", variant: "destructive" }); return; }
                const url = URL.createObjectURL(docxBlob);
                const a = document.createElement("a");
                a.href = url;
                const safeName = clienteNome.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
                a.download = `Proposta_${safeName}_${new Date().toISOString().split("T")[0]}.docx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast({ title: "DOCX baixado!" });
              }}
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

        {/* Right: Preview */}
        <div className="min-w-0 min-h-[300px] sm:min-h-[400px]">
          {rendering ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Sun className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: "2s" }} />
              <p className="text-sm text-muted-foreground animate-pulse">Renderizando proposta...</p>
            </div>
          ) : htmlPreview ? (
            <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
              <iframe
                srcDoc={htmlPreview}
                title="Proposta Preview"
                className="w-full border-0"
                style={{ height: 800, background: "#fff" }}
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
