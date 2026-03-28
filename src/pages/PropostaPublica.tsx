import { formatBRL } from "@/lib/formatters";
import { formatTaxaMensal } from "@/services/paymentComposition/financingMath";
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle, Pencil, Sun, Zap, TrendingUp, Clock, XCircle, ThumbsDown, CreditCard, Smartphone, FileText, Banknote, Wallet, DollarSign, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactSignatureCanvas from "react-signature-canvas";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";

type TokenData = {
  id: string;
  token: string;
  proposta_id: string;
  versao_id: string;
  expires_at: string;
  used_at: string | null;
  aceite_nome: string | null;
  decisao: string | null;
  view_count: number;
  first_viewed_at: string | null;
};

type CenarioData = {
  id: string;
  ordem: number;
  nome: string;
  tipo: string;
  is_default: boolean;
  preco_final: number;
  entrada_valor: number;
  num_parcelas: number;
  valor_parcela: number;
  taxa_juros_mensal: number;
  cet_anual: number;
  payback_meses: number;
  tir_anual: number;
  roi_25_anos: number;
  economia_primeiro_ano: number;
};

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get("view"); // "simulacao" = financial only
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<"aceita" | "recusada" | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [versaoData, setVersaoData] = useState<any>(null);
  const [cenarios, setCenarios] = useState<CenarioData[]>([]);
  const [selectedCenario, setSelectedCenario] = useState<string | null>(null);

  // Accept fields
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Reject fields
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [recusaMotivo, setRecusaMotivo] = useState("");

  // Payment method selection
  const [formaEscolhida, setFormaEscolhida] = useState<string | null>(null);
  const [parcelaEscolhida, setParcelaEscolhida] = useState<number>(1);
  const [bancoEscolhido, setBancoEscolhido] = useState<string | null>(null);

  const sigRef = useRef<ReactSignatureCanvas | null>(null);

  useEffect(() => {
    if (token) loadProposal();
  }, [token]);

  const trackView = async (td: TokenData) => {
    try {
      await supabase.rpc("registrar_view_proposta" as any, {
        p_token: td.token ?? token,
        p_user_agent: navigator.userAgent,
        p_referrer: document.referrer || null,
      });
    } catch {
      // Silent — view tracking is best-effort
    }
  };

  const loadProposal = async () => {
    setLoading(true);
    try {
      const { data: td, error: tdErr } = await (supabase as any)
        .from("proposta_aceite_tokens")
        .select("id, token, proposta_id, versao_id, expires_at, used_at, aceite_nome, decisao, view_count, first_viewed_at")
        .eq("token", token!)
        .maybeSingle();

      if (tdErr || !td) { setError("Link inválido ou expirado."); setLoading(false); return; }
      if (td.used_at) {
        setDecision(td.decisao || "aceita");
        setTokenData(td);
        setLoading(false);
        return;
      }
      if (new Date(td.expires_at) < new Date()) { setError("Este link expirou."); setLoading(false); return; }

      setTokenData(td);
      trackView(td);

      const [renderRes, versaoRes, cenariosRes] = await Promise.all([
        supabase.from("proposta_renders")
          .select("html").eq("versao_id", td.versao_id).eq("tipo", "html").maybeSingle(),
        supabase.from("proposta_versoes")
          .select("id, valor_total, economia_mensal, payback_meses, potencia_kwp, snapshot, output_pdf_path")
          .eq("id", td.versao_id).single(),
        (supabase as any).from("proposta_cenarios")
          .select("id, ordem, nome, tipo, is_default, preco_final, entrada_valor, num_parcelas, valor_parcela, taxa_juros_mensal, cet_anual, payback_meses, tir_anual, roi_25_anos, economia_primeiro_ano")
          .eq("versao_id", td.versao_id).order("ordem"),
      ]);

      if (renderRes.data?.html) setHtml(renderRes.data.html);
      if (versaoRes.data) {
        setVersaoData(versaoRes.data);
        // If no HTML render but PDF exists, generate signed URL for PDF viewing
        if (!renderRes.data?.html && versaoRes.data.output_pdf_path) {
          const { data: signedData } = await supabase.storage
            .from("proposta-documentos")
            .createSignedUrl(versaoRes.data.output_pdf_path, 3600);
          if (signedData?.signedUrl) setPdfUrl(signedData.signedUrl);
        }
      }

      const loadedCenarios = cenariosRes.data ?? [];
      setCenarios(loadedCenarios);
      const defaultC = loadedCenarios.find((c: CenarioData) => c.is_default) ?? loadedCenarios[0];
      if (defaultC) setSelectedCenario(defaultC.id);
    } catch {
      setError("Erro ao carregar proposta.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!tokenData || !nome.trim()) {
      toast({ title: "Informe seu nome para aceitar", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let assinaturaUrl: string | null = null;

      if (sigRef.current && !sigRef.current.isEmpty()) {
        const dataUrl = sigRef.current.toDataURL("image/png");
        const blob = await (await fetch(dataUrl)).blob();
        const path = `${tokenData.id}/assinatura.png`;

        const { error: uploadErr } = await supabase.storage
          .from("proposal-signatures")
          .upload(path, blob, { contentType: "image/png", upsert: true });

        if (!uploadErr) {
          const { data: urlData } = await supabase.storage
            .from("proposal-signatures").createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days signed URL
          assinaturaUrl = urlData?.signedUrl || null;
        }
      }

      const { error: updateErr } = await (supabase as any)
        .from("proposta_aceite_tokens")
        .update({
          used_at: new Date().toISOString(),
          decisao: "aceita",
          aceite_nome: nome,
          aceite_documento: documento || null,
          aceite_observacoes: observacoes || null,
          assinatura_url: assinaturaUrl,
          aceite_ip: "client",
          aceite_user_agent: navigator.userAgent,
          cenario_aceito_id: selectedCenario || null,
        })
        .eq("id", tokenData.id);

      if (updateErr) throw updateErr;

      await supabase.from("propostas_nativas")
        .update({ status: "aceita", aceita_at: new Date().toISOString() })
        .eq("id", tokenData.proposta_id);

      // Fire-and-forget notification to consultant/admin
      supabase.functions.invoke("proposal-decision-notify", {
        body: { token_id: tokenData.id, decisao: "aceita" },
      }).catch(() => {});

      setDecision("aceita");
      toast({ title: "Proposta aceita com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao aceitar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!tokenData) return;

    setSubmitting(true);
    try {
      const { error: updateErr } = await (supabase as any)
        .from("proposta_aceite_tokens")
        .update({
          used_at: new Date().toISOString(),
          decisao: "recusada",
          recusa_motivo: recusaMotivo || null,
          recusa_at: new Date().toISOString(),
          aceite_user_agent: navigator.userAgent,
        })
        .eq("id", tokenData.id);

      if (updateErr) throw updateErr;

      await supabase.from("propostas_nativas")
        .update({
          status: "recusada",
          recusada_at: new Date().toISOString(),
          recusa_motivo: recusaMotivo || null,
        })
        .eq("id", tokenData.proposta_id);

      // Fire-and-forget notification
      supabase.functions.invoke("proposal-decision-notify", {
        body: { token_id: tokenData.id, decisao: "recusada" },
      }).catch(() => {});

      setDecision("recusada");
      setShowRejectConfirm(false);
      toast({ title: "Resposta registrada" });
    } catch (e: any) {
      toast({ title: "Erro ao registrar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // formatBRL imported from @/lib/formatters at file top

  const activeCenario = useMemo(
    () => cenarios.find(c => c.id === selectedCenario) ?? null,
    [cenarios, selectedCenario]
  );

  // ── LOADING ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Sun className="h-10 w-10 text-primary animate-pulse" />
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Carregando proposta...</p>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <AlertTriangle className="h-12 w-12 text-warning" />
            <h2 className="text-lg font-semibold">Proposta Indisponível</h2>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── DECISION MADE ─────────────────────────────────────
  if (decision) {
    const isAccepted = decision === "aceita";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            {isAccepted ? (
              <>
                <CheckCircle2 className="h-14 w-14 text-success" />
                <h2 className="text-xl font-semibold">Proposta Aceita!</h2>
                <p className="text-sm text-muted-foreground text-center">
                  {tokenData?.aceite_nome ? `Obrigado, ${tokenData.aceite_nome}!` : "Obrigado!"} Sua aceitação foi registrada com sucesso.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-14 w-14 text-destructive" />
                <h2 className="text-xl font-semibold">Proposta Recusada</h2>
                <p className="text-sm text-muted-foreground text-center">
                  Sua resposta foi registrada. A equipe comercial será notificada.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasCenarios = cenarios.length > 0;
  const pagamentoOpcoes = !hasCenarios ? (versaoData?.snapshot?.pagamento_opcoes || []) : [];
  const isSimulacaoView = viewMode === "simulacao";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Proposal Preview — hidden on simulacao view */}
      {html && !isSimulacaoView && (
        <div className="flex-1 w-full">
          <iframe
            srcDoc={html}
            title="Proposta"
            sandbox="allow-same-origin allow-popups allow-scripts"
            className="w-full border-0"
            style={{ width: "100%", height: "calc(100vh - 56px)" }}
          />
        </div>
      )}

      {/* PDF Preview — when DOCX template was used (no HTML render) */}
      {!html && pdfUrl && !isSimulacaoView && (
        <div className="flex-1 w-full">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=0&view=FitH`}
            title="Proposta PDF"
            className="w-full border-0"
            style={{ width: "100%", height: "calc(100vh - 56px)" }}
          />
        </div>
      )}

      {/* ── CENÁRIOS INTERATIVOS — only on simulacao view ── */}
      {hasCenarios && isSimulacaoView && (
        <div className="max-w-3xl mx-auto px-4 pb-4">
          <h3 className="text-base font-semibold mb-3 text-center">
            Escolha a melhor opção para você
          </h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {cenarios.map(c => {
              const isSelected = c.id === selectedCenario;
              const tipoLabel = c.tipo === "a_vista" ? "À Vista" : c.tipo === "financiamento" ? "Financiamento" : "Parcelado";
              return (
                <Button
                  key={c.id}
                  variant="ghost"
                  onClick={() => setSelectedCenario(c.id)}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all h-auto block w-full ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  {c.is_default && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ★ RECOMENDADO
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground uppercase font-medium">{tipoLabel}</p>
                  <p className="font-bold text-sm mt-1">{c.nome}</p>
                  <p className="text-xl font-extrabold text-primary mt-2">
                    {c.tipo === "a_vista"
                      ? formatBRL(c.preco_final)
                      : `${c.num_parcelas}x ${formatBRL(c.valor_parcela)}`}
                  </p>
                  {c.entrada_valor > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">+ Entrada: {formatBRL(c.entrada_valor)}</p>
                  )}
                  {c.taxa_juros_mensal > 0 && (
                    <p className="text-xs text-muted-foreground">{Number.isFinite(c.taxa_juros_mensal) ? c.taxa_juros_mensal.toFixed(2) : "0.00"}% a.m.</p>
                  )}

                  <div className="grid grid-cols-3 gap-1 mt-3 pt-3 border-t border-border/50">
                    <div className="text-center">
                      <Clock className="h-3 w-3 mx-auto mb-0.5 text-muted-foreground" />
                      <p className="text-xs font-bold">{Number.isFinite(c.payback_meses) ? c.payback_meses : "—"}m</p>
                      <p className="text-[9px] text-muted-foreground">Payback</p>
                    </div>
                    <div className="text-center">
                      <TrendingUp className="h-3 w-3 mx-auto mb-0.5 text-muted-foreground" />
                      <p className="text-xs font-bold">{Number.isFinite(c.tir_anual) ? c.tir_anual.toFixed(1) : "—"}%</p>
                      <p className="text-[9px] text-muted-foreground">TIR</p>
                    </div>
                    <div className="text-center">
                      <Zap className="h-3 w-3 mx-auto mb-0.5 text-muted-foreground" />
                      <p className="text-xs font-bold">{Number.isFinite(c.roi_25_anos) ? formatBRL(c.roi_25_anos) : "—"}</p>
                      <p className="text-[9px] text-muted-foreground">ROI 25a</p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Financial Summary — only on simulacao view */}
      {versaoData && isSimulacaoView && (
        <div className="max-w-lg mx-auto px-4 pb-4">
          <Card className="border-border/60">
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-3">📊 Resumo Financeiro{activeCenario ? ` — ${activeCenario.nome}` : ""}</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Investimento</p>
                  <p className="text-sm font-bold">{formatBRL(activeCenario?.preco_final ?? versaoData.valor_total)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Economia/mês</p>
                  <p className="text-sm font-bold text-success">{formatBRL(versaoData.economia_mensal)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Payback</p>
                  <p className="text-sm font-bold">{activeCenario?.payback_meses ?? versaoData.payback_meses} meses</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Potência</p>
                  <p className="text-sm font-bold">{versaoData.potencia_kwp} kWp</p>
                </div>
              </div>

              {/* Legacy fallback */}
              {pagamentoOpcoes.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Opções de Pagamento</h4>
                  <div className="space-y-2">
                    {pagamentoOpcoes.map((op: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <p className="text-xs font-semibold">{op.nome}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          {op.entrada > 0 && <span>Entrada: {formatBRL(op.entrada)}</span>}
                          {op.num_parcelas > 0 && <span>{op.num_parcelas}x de {formatBRL(op.valor_parcela)}</span>}
                          {op.taxa_mensal > 0 && <span>Taxa: {formatTaxaMensal(op.taxa_mensal)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ACCEPTANCE / REJECTION FORM ──────────────── */}
      <div className="max-w-lg mx-auto px-4 pb-12">
        <Card className="border-border/60">
          <CardContent className="py-6 space-y-4">
            <h3 className="text-lg font-semibold text-center">Sua Decisão</h3>

            {hasCenarios && activeCenario && (
              <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-lg py-2 px-3">
                Cenário selecionado: <strong className="text-foreground">{activeCenario.nome}</strong>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" maxLength={100} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc">CPF / CNPJ</Label>
              <CpfCnpjInput id="doc" value={documento} onChange={setDocumento} label="" showValidation={false} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea id="obs" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Alguma observação? (opcional)" className="min-h-[60px]" maxLength={500} />
            </div>

            {/* Signature toggle */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Assinatura Digital</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowSignature(!showSignature)}>
                <Pencil className="h-3.5 w-3.5" />
                {showSignature ? "Ocultar" : "Assinar"}
              </Button>
            </div>

            {showSignature && (
              <div className="space-y-2">
                <div className="border rounded-lg bg-white p-1" style={{ touchAction: "none" }}>
                  <ReactSignatureCanvas
                    ref={sigRef}
                    penColor="#1a1a2e"
                    canvasProps={{
                      width: 440, height: 160,
                      className: "w-full rounded",
                      style: { width: "100%", height: 160 },
                    }}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => sigRef.current?.clear()}>
                  Limpar assinatura
                </Button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 gap-2"
                size="lg"
                onClick={handleAccept}
                disabled={submitting || !nome.trim()}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Aceitar Proposta
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/5"
                onClick={() => setShowRejectConfirm(true)}
                disabled={submitting}
              >
                <ThumbsDown className="h-4 w-4" />
                Recusar
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Ao aceitar, você concorda com os termos desta proposta. Seu IP e data/hora serão registrados.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar esta proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua decisão será registrada e a equipe comercial será notificada. Se desejar, informe o motivo abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="recusa-motivo">Motivo da recusa (opcional)</Label>
            <Textarea
              id="recusa-motivo"
              value={recusaMotivo}
              onChange={e => setRecusaMotivo(e.target.value)}
              placeholder="Preço alto, optei por outro fornecedor, etc."
              className="min-h-[80px]"
              maxLength={500}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReject}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Recusa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
