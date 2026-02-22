import { formatBRL } from "@/lib/formatters";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, FileText, Loader2, RefreshCw, Send, CheckCircle2,
  XCircle, AlertTriangle, Clock, Download, Link2, MessageCircle,
  Copy, Smartphone, Monitor, Mail, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { renderProposal, sendProposal } from "@/services/proposalApi";
import { ProposalViewsCard } from "./ProposalViewsCard";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  rascunho: { label: "Rascunho", variant: "secondary", icon: Clock },
  gerada: { label: "Gerada", variant: "default", icon: FileText },
  enviada: { label: "Enviada", variant: "outline", icon: Send },
  aceita: { label: "Aceita", variant: "default", icon: CheckCircle2 },
  recusada: { label: "Recusada", variant: "destructive", icon: XCircle },
  expirada: { label: "Expirada", variant: "secondary", icon: AlertTriangle },
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle },
};

// formatBRL imported at file top from @/lib/formatters

export function ProposalDetail() {
  const { propostaId, versaoId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [versao, setVersao] = useState<any>(null);
  const [proposta, setProposta] = useState<any>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [recusaMotivo, setRecusaMotivo] = useState("");
  const [sending, setSending] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [generatingOs, setGeneratingOs] = useState(false);
  const [existingOs, setExistingOs] = useState<any>(null);

  useEffect(() => {
    if (versaoId) loadData();
  }, [versaoId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: v } = await supabase
        .from("proposta_versoes")
        .select("id, proposta_id, versao_numero, status, grupo, potencia_kwp, valor_total, economia_mensal, payback_meses, valido_ate, observacoes, snapshot, created_at")
        .eq("id", versaoId!)
        .single();

      setVersao(v);

      if (v?.proposta_id) {
        const { data: p } = await supabase
          .from("propostas_nativas")
          .select("id, titulo, codigo, status, origem, lead_id, cliente_id, projeto_id")
          .eq("id", v.proposta_id)
          .single();
        setProposta(p);
      }

      const { data: render } = await supabase
        .from("proposta_renders")
        .select("id, html, url")
        .eq("versao_id", versaoId!)
        .eq("tipo", "html")
        .maybeSingle();

      if (render?.html) setHtml(render.html);

      // Check if OS already exists for this version
      const { data: os } = await supabase
        .from("os_instalacao" as any)
        .select("id, numero_os, status")
        .eq("versao_id", versaoId!)
        .maybeSingle();
      setExistingOs(os);
    } catch (e) {
      console.error("Erro ao carregar proposta:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRender = async () => {
    if (!versaoId) return;
    setRendering(true);
    try {
      const result = await renderProposal(versaoId);
      setHtml(result.html);
      toast({ title: "Proposta renderizada!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setRendering(false);
    }
  };

  const updatePropostaStatus = async (newStatus: string, extra?: Record<string, any>) => {
    if (!proposta?.id) return;
    setUpdatingStatus(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "enviada") updateData.enviada_at = new Date().toISOString();
      if (newStatus === "aceita") updateData.aceita_at = new Date().toISOString();
      if (newStatus === "recusada") {
        updateData.recusada_at = new Date().toISOString();
        updateData.recusa_motivo = extra?.motivo || null;
      }

      const { error } = await supabase
        .from("propostas_nativas")
        .update(updateData)
        .eq("id", proposta.id);

      if (error) throw error;

      setProposta((prev: any) => ({ ...prev, status: newStatus }));
      toast({ title: `Proposta marcada como "${STATUS_CONFIG[newStatus]?.label || newStatus}"` });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar status", description: e.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSend = async (canal: "link" | "whatsapp") => {
    if (!proposta?.id || !versaoId) return;
    setSending(true);
    try {
      const result = await sendProposal({
        proposta_id: proposta.id,
        versao_id: versaoId,
        canal,
        lead_id: proposta.lead_id,
      });
      setPublicUrl(result.public_url);
      setProposta((prev: any) => ({ ...prev, status: "enviada" }));
      setShowSendDialog(false);

      if (canal === "whatsapp" && result.whatsapp_sent) {
        toast({ title: "Proposta enviada via WhatsApp! ✅" });
      } else {
        toast({ title: "Link gerado com sucesso!" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast({ title: "Link copiado!" });
    }
  };

  const handleDownloadPdf = async () => {
    if (!html) {
      toast({ title: "Renderize a proposta primeiro", variant: "destructive" });
      return;
    }
    setDownloadingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Create a temporary container to render HTML
      const container = document.createElement("div");
      container.innerHTML = html;
      container.style.width = "800px";
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      await doc.html(container, {
        callback: (pdf) => {
          pdf.save(`${proposta?.codigo || "proposta"}_v${versao.versao_numero}.pdf`);
          document.body.removeChild(container);
        },
        x: 10,
        y: 10,
        width: 190,
        windowWidth: 800,
      });

      toast({ title: "PDF gerado com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (!proposta?.id || !versaoId) return;
    setSending(true);
    try {
      const result = await sendProposal({
        proposta_id: proposta.id,
        versao_id: versaoId,
        canal: "email" as any,
        lead_id: proposta.lead_id,
      });
      setPublicUrl(result.public_url);
      setProposta((prev: any) => ({ ...prev, status: "enviada" }));
      setShowSendDialog(false);
      toast({ title: "Proposta enviada por email!" });
    } catch (e: any) {
      toast({ title: "Erro ao enviar email", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleGerarOs = async () => {
    if (!proposta?.id || !versaoId) return;
    setGeneratingOs(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, user_id")
        .single();

      if (!profile?.tenant_id) {
        toast({ title: "Erro", description: "Perfil não encontrado.", variant: "destructive" });
        return;
      }

      // Get snapshot data for address
      const snapshot = versao?.snapshot as any;
      const endereco = snapshot?.projectAddress;

      const { data: os, error } = await supabase
        .from("os_instalacao" as any)
        .insert({
          tenant_id: profile.tenant_id,
          proposta_id: proposta.id,
          versao_id: versaoId,
          projeto_id: proposta.projeto_id || null,
          cliente_id: proposta.cliente_id || null,
          potencia_kwp: versao?.potencia_kwp,
          valor_total: versao?.valor_total,
          endereco: endereco?.formatted || endereco?.rua || null,
          bairro: endereco?.bairro || null,
          cidade: endereco?.cidade || snapshot?.locCidade || null,
          estado: endereco?.estado || snapshot?.locEstado || null,
          created_by: profile.user_id,
        })
        .select("id, numero_os, status")
        .single();

      if (error) throw error;
      setExistingOs(os);
      toast({ title: "✅ OS de Instalação gerada", description: `Número: ${(os as any)?.numero_os}` });
    } catch (e: any) {
      toast({ title: "Erro ao gerar OS", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingOs(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  if (!versao) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Versão não encontrada.</p>
        <Button variant="link" onClick={() => navigate("/admin/propostas-nativas")}>Voltar para lista</Button>
      </div>
    );
  }

  const currentStatus = proposta?.status || versao.status || "rascunho";
  const statusInfo = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.rascunho;
  const StatusIcon = statusInfo.icon;

  const canSend = ["rascunho", "gerada"].includes(currentStatus);
  const canAccept = ["enviada", "gerada"].includes(currentStatus);
  const canReject = ["enviada", "gerada"].includes(currentStatus);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/propostas-nativas")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold truncate">{proposta?.titulo || "Proposta"}</h2>
            <Badge variant="outline" className="text-xs">v{versao.versao_numero}</Badge>
            <Badge variant={statusInfo.variant} className="text-xs gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusInfo.label}
            </Badge>
            {proposta?.origem === "imported" && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Importada</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{proposta?.codigo} • Grupo {versao.grupo}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-[3px] border-l-primary">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Investimento</p>
            <p className="text-lg font-bold">{formatBRL(versao.valor_total)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Economia/mês</p>
            <p className="text-lg font-bold">{formatBRL(versao.economia_mensal)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Payback</p>
            <p className="text-lg font-bold">{versao.payback_meses} meses</p>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-warning">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Potência</p>
            <p className="text-lg font-bold">{versao.potencia_kwp} kWp</p>
          </CardContent>
        </Card>
      </div>

      {/* Lifecycle Actions */}
      <Card className="border-border/60">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Ações</p>
            <div className="flex flex-wrap gap-2">
              {canSend && (
                <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" className="gap-1.5" disabled={sending}>
                      <Send className="h-3.5 w-3.5" /> Enviar Proposta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Enviar proposta ao cliente</AlertDialogTitle>
                      <AlertDialogDescription>
                        Escolha o canal de envio. Um link público será gerado automaticamente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-2 py-2">
                      <Button
                        className="gap-2 justify-start"
                        variant="outline"
                        onClick={() => handleSend("link")}
                        disabled={sending}
                      >
                        <Link2 className="h-4 w-4" /> Gerar Link Público
                      </Button>
                      <Button
                        className="gap-2 justify-start"
                        variant="outline"
                        onClick={() => handleSend("whatsapp")}
                        disabled={sending}
                      >
                        <MessageCircle className="h-4 w-4" /> Enviar via WhatsApp
                      </Button>
                      <Button
                        className="gap-2 justify-start"
                        variant="outline"
                        onClick={handleSendEmail}
                        disabled={sending}
                      >
                        <Mail className="h-4 w-4" /> Enviar por Email
                      </Button>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {publicUrl && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={copyLink}>
                  <Copy className="h-3.5 w-3.5" /> Copiar Link
                </Button>
              )}

              {canAccept && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => updatePropostaStatus("aceita")}
                  disabled={updatingStatus}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aceitar
                </Button>
              )}

              {canReject && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-1.5" disabled={updatingStatus}>
                      <XCircle className="h-3.5 w-3.5" /> Recusar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Recusar proposta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Informe o motivo da recusa (opcional). Essa ação será registrada no histórico.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea
                      placeholder="Motivo da recusa..."
                      value={recusaMotivo}
                      onChange={(e) => setRecusaMotivo(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => {
                          updatePropostaStatus("recusada", { motivo: recusaMotivo });
                          setRecusaMotivo("");
                        }}
                      >
                        Confirmar Recusa
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Gerar OS de Instalação — só aparece quando proposta aceita */}
              {["aceita", "accepted"].includes(currentStatus) && (
                existingOs ? (
                  <Badge variant="outline" className="gap-1.5 text-xs py-1.5 px-3">
                    <Wrench className="h-3.5 w-3.5" />
                    OS {existingOs.numero_os} • {existingOs.status}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={handleGerarOs}
                    disabled={generatingOs}
                  >
                    {generatingOs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                    Gerar OS Instalação
                  </Button>
                )
              )}
            </div>
          </div>

          {publicUrl && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-muted rounded-lg">
              <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input value={publicUrl} readOnly className="text-xs h-8 bg-background" />
              <Button size="sm" variant="ghost" onClick={copyLink}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* HTML Preview */}
      <Card className="border-border/60">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Pré-visualização
            </p>
            <div className="flex items-center gap-2">
              {html && (
                <>
                  <div className="flex items-center border rounded-md overflow-hidden">
                    <Button
                      variant={!mobilePreview ? "default" : "ghost"}
                      size="sm"
                      className="rounded-none h-7 px-2"
                      onClick={() => setMobilePreview(false)}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={mobilePreview ? "default" : "ghost"}
                      size="sm"
                      className="rounded-none h-7 px-2"
                      onClick={() => setMobilePreview(true)}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                    className="gap-1"
                  >
                    {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    PDF
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRender}
                disabled={rendering}
                className="gap-1"
              >
                {rendering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {html ? "Atualizar" : "Renderizar"}
              </Button>
            </div>
          </div>

          {rendering ? (
            <Skeleton className="h-[500px] w-full rounded-xl" />
          ) : html ? (
            <div
              className="border rounded-xl overflow-hidden bg-white shadow-sm mx-auto transition-all duration-300"
              style={{
                maxWidth: mobilePreview ? 390 : "100%",
                maxHeight: 700,
                overflow: "auto",
              }}
            >
              <iframe
                srcDoc={html}
                title="Proposta Preview"
                className="w-full border-0"
                style={{ height: 800, pointerEvents: "none" }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm">Clique em "Renderizar" para gerar a visualização.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracking Panel */}
      {proposta?.id && <ProposalViewsCard propostaId={proposta.id} versaoId={versaoId} />}
    </div>
  );
}