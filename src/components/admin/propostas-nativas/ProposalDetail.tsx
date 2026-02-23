import { formatBRL } from "@/lib/formatters";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, FileText, Loader2, RefreshCw, Send, CheckCircle2,
  XCircle, AlertTriangle, Clock, Download, Link2, MessageCircle,
  Copy, Mail, Wrench, Zap, DollarSign, TrendingUp,
  Pencil, Eye, BarChart3, Info, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { renderProposal, sendProposal } from "@/services/proposalApi";
import { ProposalViewsCard } from "./ProposalViewsCard";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  rascunho: { label: "Rascunho", variant: "secondary", icon: Clock },
  gerada: { label: "Gerada", variant: "default", icon: FileText },
  enviada: { label: "Enviada", variant: "outline", icon: Send },
  aceita: { label: "Aceita", variant: "default", icon: CheckCircle2 },
  vista: { label: "Vista", variant: "outline", icon: Eye },
  recusada: { label: "Recusada", variant: "destructive", icon: XCircle },
  expirada: { label: "Expirada", variant: "secondary", icon: AlertTriangle },
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle },
};

export function ProposalDetail() {
  const { propostaId, versaoId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [versao, setVersao] = useState<any>(null);
  const [proposta, setProposta] = useState<any>(null);
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [recusaMotivo, setRecusaMotivo] = useState("");
  const [sending, setSending] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);
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
          .select("id, titulo, codigo, status, origem, lead_id, cliente_id, projeto_id, deal_id")
          .eq("id", v.proposta_id)
          .single();
        setProposta(p);

        if (p?.cliente_id) {
          const { data: c } = await supabase
            .from("clientes")
            .select("nome")
            .eq("id", p.cliente_id)
            .single();
          setClienteNome(c?.nome || null);
        }
      }

      const { data: render } = await supabase
        .from("proposta_renders")
        .select("id, html, url")
        .eq("versao_id", versaoId!)
        .eq("tipo", "html")
        .maybeSingle();

      if (render?.html) setHtml(render.html);
      if (render?.url) setPublicUrl(render.url);

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
      toast({ title: canal === "whatsapp" && result.whatsapp_sent ? "Proposta enviada via WhatsApp! ✅" : "Link gerado com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
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

  const copyLink = (withTracking = true) => {
    if (!publicUrl) {
      toast({ title: "Gere o link primeiro", variant: "destructive" });
      return;
    }
    const url = withTracking ? publicUrl : publicUrl.replace(/\?.*$/, "");
    navigator.clipboard.writeText(url);
    toast({ title: `Link ${withTracking ? "com" : "sem"} rastreio copiado!` });
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
        x: 10, y: 10, width: 190, windowWidth: 800,
      });
      toast({ title: "PDF gerado com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
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
      <div className="space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  if (!versao) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Versão não encontrada.</p>
        <Button variant="link" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  const snapshot = (versao.snapshot || {}) as any;
  const currentStatus = proposta?.status || versao.status || "rascunho";
  const statusInfo = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.rascunho;
  const StatusIcon = statusInfo.icon;
  const canSend = ["rascunho", "gerada"].includes(currentStatus);
  const canAccept = ["enviada", "gerada", "vista"].includes(currentStatus);
  const canReject = ["enviada", "gerada", "vista"].includes(currentStatus);

  // Build items table from snapshot
  const kitItems = snapshot.itens || [];
  const venda = snapshot.venda || {};
  const totalFinal = versao.valor_total || 0;
  const custoKit = kitItems.reduce((s: number, i: any) => s + (i.preco_unitario || 0) * (i.quantidade || 1), 0);
  const custoInstalacao = venda.custo_instalacao || 0;
  const custoComissao = venda.custo_comissao || 0;
  const custoTotal = custoKit + custoInstalacao + custoComissao;
  const lucroTotal = totalFinal - custoTotal;
  const margemPct = totalFinal > 0 ? ((lucroTotal / totalFinal) * 100) : 0;

  // Geração mensal from UCs
  const geracaoMensal = (snapshot.ucs || []).reduce((s: number, uc: any) => s + (uc.geracao_mensal_estimada || 0), 0);
  const geracaoPorKwp = versao.potencia_kwp > 0 ? (geracaoMensal / versao.potencia_kwp).toFixed(0) : "—";

  // Financial metrics
  const wpPrice = versao.potencia_kwp > 0 ? (totalFinal / (versao.potencia_kwp * 1000)).toFixed(2) : null;

  const displayName = clienteNome || proposta?.titulo || proposta?.codigo || "Proposta";

  // Payback formatting
  const paybackText = versao.payback_meses
    ? versao.payback_meses >= 12
      ? `${Math.floor(versao.payback_meses / 12)} anos e ${versao.payback_meses % 12} ${versao.payback_meses % 12 === 1 ? "mês" : "meses"}`
      : `${versao.payback_meses} meses`
    : "—";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Header ──────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">{displayName}</h1>
            <Badge variant={statusInfo.variant} className="text-xs gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusInfo.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 ml-9 text-xs text-muted-foreground">
            {clienteNome && <span>👤 {clienteNome}</span>}
            {proposta?.codigo && <span>📄 {proposta.codigo}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canAccept && (
            <Button
              size="sm"
              className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
              onClick={() => updatePropostaStatus("aceita")}
              disabled={updatingStatus}
            >
              Aceitar
            </Button>
          )}
          {canReject && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="gap-1.5" disabled={updatingStatus}>
                  Rejeitar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Recusar proposta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Informe o motivo da recusa (opcional).
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
                    onClick={() => { updatePropostaStatus("recusada", { motivo: recusaMotivo }); setRecusaMotivo(""); }}
                  >
                    Confirmar Recusa
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {["aceita", "accepted"].includes(currentStatus) && (
            existingOs ? (
              <Badge variant="outline" className="gap-1.5 text-xs py-1.5 px-3">
                <Wrench className="h-3.5 w-3.5" />
                OS {existingOs.numero_os} • {existingOs.status}
              </Badge>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 text-primary" onClick={handleGerarOs} disabled={generatingOs}>
                {generatingOs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                Gerar OS
              </Button>
            )
          )}
        </div>
      </div>

      {/* ── Alert banner ──────────────────────── */}
      {snapshot._snapshotChanged && (
        <div className="flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-lg px-4 py-3">
          <Info className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-semibold text-warning">Atenção</p>
            <p className="text-xs text-warning/80">O dimensionamento foi atualizado após a geração do arquivo. É possível que a proposta e o arquivo não sejam mais compatíveis. Gere um novo arquivo se necessário.</p>
          </div>
        </div>
      )}

      {/* ── 3-column cards: Dimensionamento | Arquivo | Envio ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dimensionamento */}
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Dimensionamento</p>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
              const params = new URLSearchParams();
              if (proposta?.deal_id) params.set("deal_id", proposta.deal_id);
              if (proposta?.cliente_id) params.set("customer_id", proposta.cliente_id);
              params.set("orc_id", proposta?.id);
              navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
            }}>
              <Pencil className="h-3 w-3" /> Editar Dimensionamento
            </Button>
            <div className="space-y-1 text-xs text-primary">
              <button className="flex items-center gap-1.5 hover:underline" onClick={() => {
                const params = new URLSearchParams();
                if (proposta?.deal_id) params.set("deal_id", proposta.deal_id);
                if (proposta?.cliente_id) params.set("customer_id", proposta.cliente_id);
                params.set("orc_id", proposta?.id);
                navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
              }}>
                <ExternalLink className="h-3 w-3" /> Visualizar Dimensionamento
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Arquivo */}
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Arquivo</p>
              {html ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleRender} disabled={rendering}>
              {rendering ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {html ? "Gerar outro arquivo" : "Gerar arquivo"}
            </Button>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-primary">
              <button className="flex items-center gap-1.5 hover:underline text-left" onClick={() => copyLink(true)}>
                <Link2 className="h-3 w-3 shrink-0" /> Copiar link com rastreio
              </button>
              <button className="flex items-center gap-1.5 hover:underline text-left" onClick={() => copyLink(false)}>
                <Link2 className="h-3 w-3 shrink-0" /> Copiar link sem rastreio
              </button>
              <button className="flex items-center gap-1.5 hover:underline text-left" onClick={handleDownloadPdf} disabled={downloadingPdf || !html}>
                <Download className="h-3 w-3 shrink-0" /> Download do PDF
              </button>
            </div>
            {versao.valido_ate && (
              <p className="text-[10px] text-muted-foreground">
                📅 Validade da proposta: {new Date(versao.valido_ate).toLocaleDateString("pt-BR")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Envio */}
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Envio</p>
              {currentStatus === "enviada" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" className="gap-1.5 text-xs bg-success hover:bg-success/90 text-success-foreground justify-start" onClick={() => handleSend("whatsapp")} disabled={sending}>
                <MessageCircle className="h-3 w-3" /> Enviar whatsapp
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs justify-start" onClick={handleSendEmail} disabled={sending}>
                <Mail className="h-3 w-3" /> Enviar e-mail
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Clique aqui para ver o histórico de visualizações.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Análise da Proposta ──────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3">Análise da Proposta</h2>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-border/50">
            <CardContent className="py-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
                <Zap className="h-4 w-4" />
                <p className="text-sm font-medium">Potência</p>
              </div>
              <p className="text-xl font-bold">{versao.potencia_kwp?.toFixed(2) || "0"} kWp</p>
              <p className="text-xs text-muted-foreground">
                {geracaoMensal > 0 ? `${geracaoMensal.toFixed(0)} kWh (${geracaoPorKwp} por kWp)` : "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="py-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
                <DollarSign className="h-4 w-4" />
                <p className="text-sm font-medium">Preço de Venda</p>
              </div>
              <p className="text-xl font-bold">{formatBRL(totalFinal)}</p>
              <p className="text-xs text-muted-foreground">
                {wpPrice ? `R$ ${wpPrice} / Wp` : "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="py-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-success mb-1">
                <TrendingUp className="h-4 w-4" />
                <p className="text-sm font-medium">Lucro</p>
              </div>
              <p className="text-xl font-bold">{formatBRL(lucroTotal)}</p>
              <p className="text-xs text-muted-foreground">
                Margem: {margemPct.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Items table */}
        {(kitItems.length > 0 || custoInstalacao > 0 || custoComissao > 0) && (
          <Card className="border-border/50 mb-6">
            <CardContent className="py-0 px-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px] uppercase tracking-wider">
                    <TableHead>Categoria</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">QTD</TableHead>
                    <TableHead className="text-right">Custo Unitário</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Kit row */}
                  {custoKit > 0 && (
                    <>
                      <TableRow className="bg-muted/30 font-medium">
                        <TableCell className="text-xs">
                          KIT <Badge variant="outline" className="text-[9px] ml-1">Fechado</Badge>
                        </TableCell>
                        <TableCell className="text-xs">Kit</TableCell>
                        <TableCell className="text-center text-xs">1</TableCell>
                        <TableCell className="text-right text-xs">{formatBRL(custoKit)}</TableCell>
                        <TableCell className="text-right text-xs">{formatBRL(custoKit)}</TableCell>
                        <TableCell className="text-right text-xs">{formatBRL(0)}</TableCell>
                        <TableCell className="text-right text-xs">{formatBRL(custoKit)}</TableCell>
                      </TableRow>
                      {kitItems.map((item: any, idx: number) => (
                        <TableRow key={idx} className="text-muted-foreground">
                          <TableCell className="text-[11px] pl-6">
                            {item.categoria === "modulos" ? "☐ Módulo" : item.categoria === "inversores" ? "☐ Inversor" : `☐ ${item.categoria}`}
                          </TableCell>
                          <TableCell className="text-[11px]">{`${item.fabricante || ""} ${item.modelo || item.descricao || ""}`.trim()}</TableCell>
                          <TableCell className="text-center text-[11px]">{item.quantidade}</TableCell>
                          <TableCell className="text-right text-[11px]">{formatBRL(item.preco_unitario || 0)}</TableCell>
                          <TableCell className="text-right text-[11px]">{formatBRL(0)}</TableCell>
                          <TableCell className="text-right text-[11px]">{formatBRL(0)}</TableCell>
                          <TableCell className="text-right text-[11px]">{formatBRL(0)}</TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                  {/* Instalação */}
                  {custoInstalacao > 0 && (
                    <TableRow>
                      <TableCell className="text-xs">Instalação</TableCell>
                      <TableCell className="text-xs">Instalação</TableCell>
                      <TableCell className="text-center text-xs">1</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(custoInstalacao)}</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(custoInstalacao)}</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(0)}</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(custoInstalacao)}</TableCell>
                    </TableRow>
                  )}
                  {/* Comissão */}
                  {custoComissao > 0 && (
                    <TableRow>
                      <TableCell className="text-xs">Comissão</TableCell>
                      <TableCell className="text-xs">Comissão</TableCell>
                      <TableCell className="text-center text-xs">1</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(custoComissao)}</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(custoComissao)}</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(0)}</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(custoComissao)}</TableCell>
                    </TableRow>
                  )}
                  {/* Total */}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={4} />
                    <TableCell className="text-right text-xs">{formatBRL(custoTotal)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBRL(lucroTotal)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBRL(totalFinal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Economia cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-border/50">
            <CardContent className="py-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
                <Zap className="h-3.5 w-3.5" />
                <p className="text-xs font-medium">Gasto com Energia</p>
              </div>
              <p className="text-sm font-bold">
                {formatBRL(snapshot.gastoEnergiaSem || 0)} | {formatBRL(snapshot.gastoEnergiaCom || 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="py-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-info mb-1">
                <BarChart3 className="h-3.5 w-3.5" />
                <p className="text-xs font-medium">Gasto com Demanda</p>
              </div>
              <p className="text-sm font-bold">
                {formatBRL(snapshot.gastoDemandaSem || 0)} | {formatBRL(snapshot.gastoDemandaCom || 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="py-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-destructive mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                <p className="text-xs font-medium">Outros Encargos</p>
              </div>
              <p className="text-sm font-bold">
                {formatBRL(snapshot.outrosEncargosSem || 0)} | {formatBRL(snapshot.outrosEncargosCom || 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="py-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-success mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <p className="text-xs font-medium">Economia Mensal</p>
              </div>
              <p className="text-sm font-bold">
                {formatBRL(versao.economia_mensal || 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ROI metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="py-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
                <TrendingUp className="h-4 w-4" />
                <p className="text-sm font-medium">Taxa Interna de Retorno</p>
              </div>
              <p className="text-2xl font-bold text-warning">
                {snapshot.tir ? `${(snapshot.tir * 100).toFixed(2)}%` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="py-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
                <DollarSign className="h-4 w-4" />
                <p className="text-sm font-medium">Valor Presente Líquido</p>
              </div>
              <p className="text-2xl font-bold text-warning">
                {snapshot.vpl ? formatBRL(snapshot.vpl) : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="py-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
                <Clock className="h-4 w-4" />
                <p className="text-sm font-medium">Payback</p>
              </div>
              <p className="text-2xl font-bold text-warning">{paybackText}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Tracking Panel ──────────────────── */}
      {proposta?.id && <ProposalViewsCard propostaId={proposta.id} versaoId={versaoId} />}
    </div>
  );
}
