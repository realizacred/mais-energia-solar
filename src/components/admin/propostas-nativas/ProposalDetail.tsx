import { formatBRL } from "@/lib/formatters";
import { formatKwp, formatKwhValue } from "@/lib/formatters/index";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, FileText, Loader2, Send, CheckCircle2,
  XCircle, AlertTriangle, Clock,
  Wrench, Zap, DollarSign, TrendingUp,
  Eye, BarChart3, Info, SunMedium,
  User, MapPin, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { renderProposal, sendProposal } from "@/services/proposalApi";
import { ProposalViewsCard } from "./ProposalViewsCard";
import { GenerateFileDialog } from "./GenerateFileDialog";
import { InfoPill } from "./InfoPill";
import { ProposalAnalysis } from "./ProposalAnalysis";
import { ProposalActionCards } from "./ProposalActionCards";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any; color: string }> = {
  rascunho: { label: "Rascunho", variant: "secondary", icon: Clock, color: "text-muted-foreground" },
  gerada: { label: "Gerada", variant: "default", icon: FileText, color: "text-primary" },
  enviada: { label: "Enviada", variant: "outline", icon: Send, color: "text-info" },
  aceita: { label: "Aceita", variant: "default", icon: CheckCircle2, color: "text-success" },
  vista: { label: "Vista", variant: "outline", icon: Eye, color: "text-warning" },
  recusada: { label: "Recusada", variant: "destructive", icon: XCircle, color: "text-destructive" },
  expirada: { label: "Expirada", variant: "secondary", icon: AlertTriangle, color: "text-muted-foreground" },
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle, color: "text-destructive" },
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
  const [aceiteMotivo, setAceiteMotivo] = useState("");
  const [aceiteDialogOpen, setAceiteDialogOpen] = useState(false);
  const [aceiteDate, setAceiteDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [recusaDate, setRecusaDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [sending, setSending] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [generatingOs, setGeneratingOs] = useState(false);
  const [existingOs, setExistingOs] = useState<any>(null);
  const [lastEditor, setLastEditor] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [validadeDialogOpen, setValidadeDialogOpen] = useState(false);
  const [validadeDate, setValidadeDate] = useState("");
  const [savingValidade, setSavingValidade] = useState(false);

  const handleSaveValidade = useCallback(async () => {
    if (!validadeDate || !versaoId) return;
    setSavingValidade(true);
    try {
      const { error } = await supabase
        .from("proposta_versoes")
        .update({ valido_ate: validadeDate })
        .eq("id", versaoId);
      if (error) throw error;
      toast({ title: "Validade atualizada!" });
      setValidadeDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setSavingValidade(false);
    }
  }, [validadeDate, versaoId]);

  useEffect(() => {
    if (versaoId) loadData(!!versao);
  }, [versaoId]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: v } = await supabase
        .from("proposta_versoes")
        .select("id, proposta_id, versao_numero, status, grupo, potencia_kwp, valor_total, economia_mensal, geracao_mensal, payback_meses, valido_ate, observacoes, snapshot, final_snapshot, snapshot_locked, finalized_at, public_slug, created_at, updated_at, gerado_em")
        .eq("id", versaoId!)
        .single();

      setVersao(v);
      if (v?.gerado_em) setLastGeneratedAt(v.gerado_em);

      if (v?.proposta_id) {
        const { data: p } = await supabase
          .from("propostas_nativas")
          .select("id, titulo, codigo, status, origem, lead_id, cliente_id, projeto_id, deal_id, updated_at")
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
      if (newStatus === "aceita") {
        updateData.aceita_at = extra?.data || new Date().toISOString();
        updateData.aceite_motivo = extra?.motivo || null;
      }
      if (newStatus === "recusada") {
        updateData.recusada_at = extra?.data || new Date().toISOString();
        updateData.recusa_motivo = extra?.motivo || null;
      }
      // When reverting to a previous status, clear acceptance/rejection data
      if (newStatus !== "aceita") {
        updateData.aceita_at = null;
        updateData.aceite_motivo = null;
      }
      if (newStatus !== "recusada") {
        updateData.recusada_at = null;
        updateData.recusa_motivo = null;
      }
      const { error } = await supabase
        .from("propostas_nativas")
        .update(updateData)
        .eq("id", proposta.id);
      if (error) throw error;

      // ── Gerar comissão ao aceitar proposta ──
      if (newStatus === "aceita" && versao && proposta.cliente_id) {
        try {
          // Buscar consultor via lead → consultor_id
          let consultorId: string | null = null;
          if (proposta.lead_id) {
            const { data: lead } = await supabase
              .from("leads")
              .select("consultor_id")
              .eq("id", proposta.lead_id)
              .single();
            consultorId = lead?.consultor_id || null;
          }

          if (consultorId && versao.valor_total > 0) {
            // Buscar plano de comissão ativo do consultor ou usar default
            const { data: plan } = await supabase
              .from("commission_plans")
              .select("parameters")
              .eq("is_active", true)
              .limit(1)
              .maybeSingle();

            const percentual = (plan?.parameters as any)?.percentual ?? 5;
            const now = new Date();

            await supabase.from("comissoes").insert({
              consultor_id: consultorId,
              cliente_id: proposta.cliente_id,
              projeto_id: proposta.projeto_id || null,
              descricao: `Proposta aceita - ${clienteNome || "Cliente"} (${versao.potencia_kwp || 0}kWp)`,
              valor_base: versao.valor_total,
              percentual_comissao: percentual,
              valor_comissao: (versao.valor_total * percentual) / 100,
              mes_referencia: now.getMonth() + 1,
              ano_referencia: now.getFullYear(),
              status: "pendente",
            });

            toast({ title: "Comissão gerada automaticamente!", description: `${percentual}% sobre ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(versao.valor_total)}` });
          }
        } catch (comErr: any) {
          console.error("Erro ao gerar comissão:", comErr);
          toast({ title: "Proposta aceita, mas erro na comissão", description: comErr.message, variant: "destructive" });
        }
      }

      // ── Cancelar comissão pendente se proposta recusada/cancelada ──
      if ((newStatus === "recusada" || newStatus === "cancelada") && proposta.projeto_id) {
        await supabase.from("comissoes")
          .update({ status: "cancelada", observacoes: `Proposta ${newStatus}` })
          .eq("projeto_id", proposta.projeto_id)
          .eq("status", "pendente");
      }

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

  const isFinalized = !!versao?.finalized_at || !!versao?.snapshot_locked;
  const [cloning, setCloning] = useState(false);

  const navigateToEdit = useCallback(async () => {
    // If version is finalized/locked, clone it first
    if (isFinalized) {
      setCloning(true);
      try {
        const { data, error } = await supabase.rpc(
          "clone_proposta_versao" as any,
          { p_from_versao_id: versaoId }
        );
        if (error) throw error;
        const result = data as any;
        toast({ title: "✅ Nova versão criada", description: "A versão finalizada foi clonada para edição." });
        const params = new URLSearchParams();
        if (proposta?.deal_id) params.set("deal_id", proposta.deal_id);
        if (proposta?.cliente_id) params.set("customer_id", proposta.cliente_id);
        params.set("proposta_id", result.proposta_id);
        params.set("versao_id", result.new_versao_id);
        navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
      } catch (e: any) {
        toast({ title: "Erro ao clonar versão", description: e.message, variant: "destructive" });
      } finally {
        setCloning(false);
      }
      return;
    }

    const params = new URLSearchParams();
    if (proposta?.deal_id) params.set("deal_id", proposta.deal_id);
    if (proposta?.cliente_id) params.set("customer_id", proposta.cliente_id);
    if (proposta?.id) params.set("proposta_id", proposta.id);
    if (versaoId) params.set("versao_id", versaoId);
    navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
  }, [isFinalized, versaoId, proposta, navigate]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!versao) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Versão não encontrada.</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  const snapshot = (versao.snapshot || {}) as any;
  const currentStatus = proposta?.status || versao.status || "rascunho";
  const statusInfo = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.rascunho;
  const StatusIcon = statusInfo.icon;
  const canSend = ["rascunho", "gerada"].includes(currentStatus);
  const isActionable = ["enviada", "gerada", "vista", "aceita", "recusada"].includes(currentStatus);
  const isAccepted = currentStatus === "aceita";
  const isRejected = currentStatus === "recusada";
  const previousStatus = proposta?.status_anterior || "enviada";

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

  // Geração & potência from version or snapshot fallback
  let potenciaKwp = versao.potencia_kwp || 0;
  if ((!potenciaKwp || potenciaKwp === 0) && snapshot.itens) {
    const mods = (snapshot.itens as any[]).filter((i: any) => i.categoria === "modulo" || i.categoria === "modulos");
    potenciaKwp = mods.reduce((s: number, m: any) => s + ((m.potencia_w || 0) * (m.quantidade || 1)) / 1000, 0);
  }

  let geracaoMensal = (snapshot.ucs || []).reduce((s: number, uc: any) => s + (uc.geracao_mensal_estimada || 0), 0);
  // Fallback: coluna dedicada (propostas migradas armazenam aqui)
  if ((!geracaoMensal || geracaoMensal === 0) && versao.geracao_mensal > 0) {
    geracaoMensal = versao.geracao_mensal;
  }
  // Fallback: cálculo estimado via irradiação
  if ((!geracaoMensal || geracaoMensal === 0) && potenciaKwp > 0 && snapshot.locIrradiacao > 0) {
    geracaoMensal = Math.round(potenciaKwp * snapshot.locIrradiacao * 30 * 0.80);
  }

  const wpPrice = potenciaKwp > 0 ? (totalFinal / (potenciaKwp * 1000)).toFixed(2) : null;
  const displayName = clienteNome || proposta?.titulo || proposta?.codigo || "Proposta";
  const paybackText = versao.payback_meses
    ? versao.payback_meses >= 12
      ? `${Math.floor(versao.payback_meses / 12)}a ${versao.payback_meses % 12}m`
      : `${versao.payback_meses} meses`
    : "—";

  const formattedDate = (d: string | null) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return null; }
  };

  return (
    <div className="space-y-6">
      {/* ══════════ HEADER ══════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
              <Badge variant={statusInfo.variant} className="text-[10px] gap-1 px-2">
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {proposta?.codigo && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{proposta.codigo}</span>}
              {clienteNome && <span className="flex items-center gap-1"><User className="h-3 w-3" />{clienteNome}</span>}
              {snapshot.locCidade && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{snapshot.locCidade}/{snapshot.locEstado}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Aceitar / Remover Aceite toggle */}
          {isActionable && !isRejected && (
            isAccepted ? (
              <Button size="sm" variant="destructive" className="gap-1.5 border-success/40 text-success" onClick={() => updatePropostaStatus("enviada")} disabled={updatingStatus}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Remover Aceite
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={() => { setAceiteDate(new Date().toISOString().slice(0, 16)); setAceiteMotivo(""); setAceiteDialogOpen(true); }} disabled={updatingStatus}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Aceitar
              </Button>
            )
          )}

          {/* Rejeitar / Remover Rejeição toggle */}
          {isActionable && !isAccepted && (
            isRejected ? (
              <Button size="sm" variant="destructive" className="gap-1.5 border-destructive/40 text-destructive" onClick={() => updatePropostaStatus("enviada")} disabled={updatingStatus}>
                <XCircle className="h-3.5 w-3.5" /> Remover Rejeição
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="gap-1.5" disabled={updatingStatus} onClick={() => setRecusaDate(new Date().toISOString().slice(0, 16))}>
                    <XCircle className="h-3.5 w-3.5" /> Rejeitar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Recusar proposta?</AlertDialogTitle>
                    <AlertDialogDescription>Informe o motivo e a data da recusa.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Data da recusa</label>
                      <Input type="datetime-local" value={recusaDate} onChange={(e) => setRecusaDate(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Motivo (opcional)</label>
                      <Textarea placeholder="Motivo da recusa..." value={recusaMotivo} onChange={(e) => setRecusaMotivo(e.target.value)} className="min-h-[80px]" />
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { updatePropostaStatus("recusada", { motivo: recusaMotivo, data: new Date(recusaDate).toISOString() }); setRecusaMotivo(""); }}>
                      Confirmar Recusa
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          )}

          {/* Aceite Dialog */}
          <AlertDialog open={aceiteDialogOpen} onOpenChange={setAceiteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Aceitar proposta?</AlertDialogTitle>
                <AlertDialogDescription>Informe o motivo e a data do aceite.</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Data do aceite</label>
                  <Input type="datetime-local" value={aceiteDate} onChange={(e) => setAceiteDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Motivo / Observação (opcional)</label>
                  <Textarea placeholder="Motivo do aceite..." value={aceiteMotivo} onChange={(e) => setAceiteMotivo(e.target.value)} className="min-h-[80px]" />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-success text-success-foreground hover:bg-success/90" onClick={() => { updatePropostaStatus("aceita", { motivo: aceiteMotivo, data: new Date(aceiteDate).toISOString() }); setAceiteMotivo(""); setAceiteDialogOpen(false); }}>
                  Confirmar Aceite
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {["aceita", "accepted"].includes(currentStatus) && (
            existingOs ? (
              <Badge variant="outline" className="gap-1.5 text-xs py-1.5 px-3"><Wrench className="h-3.5 w-3.5" /> OS {existingOs.numero_os} • {existingOs.status}</Badge>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 text-primary" onClick={handleGerarOs} disabled={generatingOs}>
                {generatingOs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />} Gerar OS
              </Button>
            )
          )}
        </div>
      </div>

      {/* ══════════ SNAPSHOT CHANGED ALERT ══════════ */}
      {snapshot._snapshotChanged && (
        <div className="flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-lg px-4 py-3">
          <Info className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-semibold text-warning">Atenção</p>
            <p className="text-xs text-warning/80">O dimensionamento foi atualizado após a geração do arquivo. Gere um novo arquivo se necessário.</p>
          </div>
        </div>
      )}

      {/* ══════════ KPI STRIP ══════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoPill icon={Zap} label="Potência" value={formatKwp(potenciaKwp)} />
        <InfoPill icon={SunMedium} label="Geração Mensal" value={geracaoMensal > 0 ? `${formatKwhValue(geracaoMensal)} kWh` : "—"} />
        <InfoPill icon={DollarSign} label="Valor Total" value={formatBRL(totalFinal)} />
        <InfoPill icon={TrendingUp} label="R$/Wp" value={wpPrice ? `R$ ${wpPrice}` : "—"} />
      </div>

      {/* ══════════ 3-COL ACTION CARDS ══════════ */}
      <ProposalActionCards
        navigateToEdit={navigateToEdit}
        isFinalized={isFinalized}
        cloning={cloning}
        lastEditDate={proposta?.updated_at || versao.updated_at}
        html={html}
        rendering={rendering}
        onGenerateFile={() => setGenerateDialogOpen(true)}
        onCopyLink={copyLink}
        onDownloadPdf={handleDownloadPdf}
        onRender={handleRender}
        publicUrl={publicUrl}
        downloadingPdf={downloadingPdf}
        validoAte={versao.valido_ate}
        onEditValidade={() => {
          setValidadeDate(versao.valido_ate ? new Date(versao.valido_ate).toISOString().split("T")[0] : "");
          setValidadeDialogOpen(true);
        }}
        lastGeneratedAt={lastGeneratedAt}
        currentStatus={currentStatus}
        sending={sending}
        onSendWhatsapp={() => handleSend("whatsapp")}
        onSendEmail={handleSendEmail}
        onScrollToTracking={() => {
          const el = document.getElementById("proposal-tracking");
          el?.scrollIntoView({ behavior: "smooth" });
        }}
        formattedDate={formattedDate}
      />

      {/* ══════════ ANÁLISE DA PROPOSTA ══════════ */}
      <ProposalAnalysis
        potenciaKwp={potenciaKwp}
        geracaoMensal={geracaoMensal}
        totalFinal={totalFinal}
        wpPrice={wpPrice}
        custoKit={custoKit}
        custoInstalacao={custoInstalacao}
        custoComissao={custoComissao}
        custoTotal={custoTotal}
        lucroTotal={lucroTotal}
        margemPct={margemPct}
        kitItems={kitItems}
        snapshot={snapshot}
        paybackText={paybackText}
        economiaMensal={versao.economia_mensal || 0}
      />

      {/* ══════════ TRACKING PANEL ══════════ */}
      <div id="proposal-tracking">
        {proposta?.id && <ProposalViewsCard propostaId={proposta.id} versaoId={versaoId} />}
      </div>

      {/* ══════════ GENERATE FILE DIALOG ══════════ */}
      {versaoId && proposta?.id && (
        <GenerateFileDialog
          open={generateDialogOpen}
          onOpenChange={setGenerateDialogOpen}
          versaoId={versaoId}
          propostaId={proposta.id}
          onGenerated={(generatedHtml) => {
            if (generatedHtml) setHtml(generatedHtml);
            loadData();
          }}
        />
      )}

      {/* ══════════ VALIDADE DIALOG ══════════ */}
      <Dialog open={validadeDialogOpen} onOpenChange={setValidadeDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Alterar validade da proposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              type="date"
              value={validadeDate}
              onChange={(e) => setValidadeDate(e.target.value)}
              className="text-sm"
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" onClick={() => setValidadeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveValidade} disabled={!validadeDate || savingValidade}>
                {savingValidade ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Alterar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
