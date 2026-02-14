import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, FileText, Loader2, RefreshCw, Send, CheckCircle2,
  XCircle, AlertTriangle, Clock, Download, Link2, MessageCircle,
  Copy,
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
import { renderProposal } from "@/services/proposalApi";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  rascunho: { label: "Rascunho", variant: "secondary", icon: Clock },
  gerada: { label: "Gerada", variant: "default", icon: FileText },
  enviada: { label: "Enviada", variant: "outline", icon: Send },
  aceita: { label: "Aceita", variant: "default", icon: CheckCircle2 },
  recusada: { label: "Recusada", variant: "destructive", icon: XCircle },
  expirada: { label: "Expirada", variant: "secondary", icon: AlertTriangle },
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle },
  // Legacy english
  draft: { label: "Rascunho", variant: "secondary", icon: Clock },
  generated: { label: "Gerada", variant: "default", icon: FileText },
  sent: { label: "Enviada", variant: "outline", icon: Send },
  accepted: { label: "Aceita", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Recusada", variant: "destructive", icon: XCircle },
  expired: { label: "Expirada", variant: "secondary", icon: AlertTriangle },
};

const formatBRL = (v: number | null) => {
  if (!v) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

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
          .select("id, titulo, codigo, status, origem")
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

  const canSend = ["rascunho", "gerada", "generated", "draft"].includes(currentStatus);
  const canAccept = ["enviada", "sent", "gerada", "generated"].includes(currentStatus);
  const canReject = ["enviada", "sent", "gerada", "generated"].includes(currentStatus);

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
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => updatePropostaStatus("enviada")}
                  disabled={updatingStatus}
                >
                  <Send className="h-3.5 w-3.5" /> Marcar como Enviada
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HTML Preview */}
      <Card className="border-border/60">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Pré-visualização
            </p>
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

          {rendering ? (
            <Skeleton className="h-[500px] w-full rounded-xl" />
          ) : html ? (
            <div className="border rounded-xl overflow-hidden bg-white shadow-sm" style={{ maxHeight: 700, overflow: "auto" }}>
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
    </div>
  );
}