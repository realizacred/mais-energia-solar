import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactSignatureCanvas from "react-signature-canvas";

type TokenData = {
  id: string;
  proposta_id: string;
  versao_id: string;
  expires_at: string;
  used_at: string | null;
  aceite_nome: string | null;
};

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [versaoData, setVersaoData] = useState<any>(null);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const sigRef = useRef<ReactSignatureCanvas | null>(null);

  useEffect(() => {
    if (token) loadProposal();
  }, [token]);

  const trackView = async (td: TokenData) => {
    try {
      // Get proposta to find tenant_id
      const { data: proposta } = await supabase
        .from("propostas_nativas")
        .select("tenant_id")
        .eq("id", td.proposta_id)
        .single();

      if (proposta?.tenant_id) {
        await (supabase as any).from("proposta_views").insert({
          tenant_id: proposta.tenant_id,
          token_id: td.id,
          proposta_id: td.proposta_id,
          versao_id: td.versao_id,
          user_agent: navigator.userAgent,
        });

        // Increment view count
        await (supabase as any)
          .from("proposta_aceite_tokens")
          .update({
            view_count: (td as any).view_count ? (td as any).view_count + 1 : 1,
            first_viewed_at: (td as any).first_viewed_at || new Date().toISOString(),
            last_viewed_at: new Date().toISOString(),
          })
          .eq("id", td.id);
      }
    } catch {
      // Silent - tracking shouldn't block UX
    }
  };

  const loadProposal = async () => {
    setLoading(true);
    try {
      const { data: td, error: tdErr } = await (supabase as any)
        .from("proposta_aceite_tokens")
        .select("id, proposta_id, versao_id, expires_at, used_at, aceite_nome, view_count, first_viewed_at")
        .eq("token", token!)
        .maybeSingle();

      if (tdErr || !td) {
        setError("Link inválido ou expirado.");
        setLoading(false);
        return;
      }

      if (td.used_at) {
        setAccepted(true);
        setTokenData(td);
        setLoading(false);
        return;
      }

      if (new Date(td.expires_at) < new Date()) {
        setError("Este link expirou.");
        setLoading(false);
        return;
      }

      setTokenData(td);

      // Track view
      trackView(td);

      // Load rendered HTML
      const { data: render } = await supabase
        .from("proposta_renders")
        .select("html")
        .eq("versao_id", td.versao_id)
        .eq("tipo", "html")
        .maybeSingle();

      if (render?.html) setHtml(render.html);

      // Load versão data for financing display
      const { data: versao } = await supabase
        .from("proposta_versoes")
        .select("id, valor_total, economia_mensal, payback_meses, potencia_kwp, snapshot")
        .eq("id", td.versao_id)
        .single();

      if (versao) setVersaoData(versao);
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

      // Upload signature if drawn
      if (sigRef.current && !sigRef.current.isEmpty()) {
        const dataUrl = sigRef.current.toDataURL("image/png");
        const blob = await (await fetch(dataUrl)).blob();
        const path = `${tokenData.id}/assinatura.png`;

        const { error: uploadErr } = await supabase.storage
          .from("proposal-signatures")
          .upload(path, blob, { contentType: "image/png", upsert: true });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from("proposal-signatures")
            .getPublicUrl(path);
          assinaturaUrl = urlData?.publicUrl || null;
        }
      }

      const { error: updateErr } = await (supabase as any)
        .from("proposta_aceite_tokens")
        .update({
          used_at: new Date().toISOString(),
          aceite_nome: nome,
          aceite_documento: documento || null,
          aceite_observacoes: observacoes || null,
          assinatura_url: assinaturaUrl,
          aceite_ip: "client",
          aceite_user_agent: navigator.userAgent,
        })
        .eq("id", tokenData.id);

      if (updateErr) throw updateErr;

      // Update proposta status
      await supabase
        .from("propostas_nativas")
        .update({ status: "aceita", aceita_at: new Date().toISOString() })
        .eq("id", tokenData.proposta_id);

      setAccepted(true);
      toast({ title: "Proposta aceita com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao aceitar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-14 w-14 text-success" />
            <h2 className="text-xl font-semibold">Proposta Aceita!</h2>
            <p className="text-sm text-muted-foreground text-center">
              {tokenData?.aceite_nome ? `Obrigado, ${tokenData.aceite_nome}!` : "Obrigado!"} Sua aceitação foi registrada com sucesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatBRL = (v: number | null) => {
    if (!v) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  };

  // Extract payment options from snapshot
  const pagamentoOpcoes = versaoData?.snapshot?.pagamento_opcoes || [];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Proposal Preview */}
      {html && (
        <div className="max-w-4xl mx-auto py-6 px-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <iframe
              srcDoc={html}
              title="Proposta"
              className="w-full border-0"
              style={{ height: 700 }}
            />
          </div>
        </div>
      )}

      {/* Financing Summary (Read-only) */}
      {versaoData && (
        <div className="max-w-lg mx-auto px-4 pb-4">
          <Card className="border-border/60">
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-3">📊 Resumo Financeiro</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Investimento</p>
                  <p className="text-sm font-bold">{formatBRL(versaoData.valor_total)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Economia/mês</p>
                  <p className="text-sm font-bold text-success">{formatBRL(versaoData.economia_mensal)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Payback</p>
                  <p className="text-sm font-bold">{versaoData.payback_meses} meses</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Potência</p>
                  <p className="text-sm font-bold">{versaoData.potencia_kwp} kWp</p>
                </div>
              </div>

              {pagamentoOpcoes.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Opções de Pagamento</h4>
                  <div className="space-y-2">
                    {pagamentoOpcoes.map((op: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <p className="text-xs font-semibold">{op.nome}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          {op.entrada > 0 && <span>Entrada: {formatBRL(op.entrada)}</span>}
                          {op.num_parcelas > 0 && (
                            <span>{op.num_parcelas}x de {formatBRL(op.valor_parcela)}</span>
                          )}
                          {op.taxa_mensal > 0 && <span>Taxa: {(op.taxa_mensal * 100).toFixed(2)}%</span>}
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

      {/* Acceptance Form */}
      <div className="max-w-lg mx-auto px-4 pb-12">
        <Card className="border-border/60">
          <CardContent className="py-6 space-y-4">
            <h3 className="text-lg font-semibold text-center">Aceitar Proposta</h3>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc">CPF / CNPJ</Label>
              <Input
                id="doc"
                value={documento}
                onChange={e => setDocumento(e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Alguma observação? (opcional)"
                className="min-h-[60px]"
              />
            </div>

            {/* Signature toggle */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Assinatura Digital</p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowSignature(!showSignature)}
              >
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
                      width: 440,
                      height: 160,
                      className: "w-full rounded",
                      style: { width: "100%", height: 160 },
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => sigRef.current?.clear()}
                >
                  Limpar assinatura
                </Button>
              </div>
            )}

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleAccept}
              disabled={submitting || !nome.trim()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Aceitar Proposta
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              Ao aceitar, você concorda com os termos desta proposta. Seu IP e data/hora serão registrados.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
