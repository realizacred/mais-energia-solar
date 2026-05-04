import { formatBRL } from "@/lib/formatters";
import { formatTaxaMensal } from "@/services/paymentComposition/financingMath";
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useSearchParams, Navigate } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle, Pencil, Sun, Zap, TrendingUp, Clock, XCircle, ThumbsDown, CreditCard, Smartphone, FileText, Banknote, Wallet, DollarSign, Building2, MessageCircle } from "lucide-react";
import EconomiaDetailCards from "@/components/proposta-publica/EconomiaDetailCards";
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
import { cn } from "@/lib/utils";


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
  invalidado_em: string | null;
  motivo_invalidacao: string | null;
  tipo: string;
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
  const [redirectToLanding, setRedirectToLanding] = useState(false);
  const [invalidatedInfo, setInvalidatedInfo] = useState<{
    invalidado_em: string;
    empresaNome: string | null;
    empresaLogo: string | null;
    empresaTelefone: string | null;
    motivo_invalidacao: string | null;
    latestTokenUrl: string | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<"aceita" | "recusada" | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [versaoData, setVersaoData] = useState<any>(null);
  const [cenarios, setCenarios] = useState<CenarioData[]>([]);
  const [selectedCenario, setSelectedCenario] = useState<string | null>(null);
  const [postDecisionInfo, setPostDecisionInfo] = useState<{
    termoUrl: string | null;
    consultorNome: string | null;
    consultorTelefone: string | null;
  } | null>(null);

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

  // ─── Heartbeat for duration tracking (tracked tokens only) ─────
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTokenRef = useRef<string | null>(null);

  const startHeartbeat = (tokenValue: string) => {
    if (heartbeatRef.current) return; // already running
    heartbeatTokenRef.current = tokenValue;
    heartbeatRef.current = setInterval(async () => {
      if (heartbeatTokenRef.current) {
        try {
          await supabase.rpc("registrar_heartbeat_proposta" as any, {
            p_token: heartbeatTokenRef.current,
            p_segundos: 30,
          });
        } catch { /* best-effort */ }
      }
    }, 30_000); // every 30 seconds
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    heartbeatTokenRef.current = null;
  };

  // Stop heartbeat on unmount or visibility hidden
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === "hidden") {
        // Send final heartbeat before pausing
        if (heartbeatTokenRef.current) {
          try {
            await supabase.rpc("registrar_heartbeat_proposta" as any, {
              p_token: heartbeatTokenRef.current,
              p_segundos: 15,
            });
          } catch { /* best-effort */ }
        }
        stopHeartbeat();
      } else if (document.visibilityState === "visible" && tokenData?.token) {
        // Resume heartbeat when page becomes visible again
        const td = tokenData;
        if (td && !td.used_at && td.token) {
          startHeartbeat(td.token);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stopHeartbeat();
    };
  }, [tokenData]);

  useEffect(() => {
    if (token) loadProposal();
  }, [token]);

  const trackView = async (td: TokenData) => {
    try {
      // Detect device type from screen width
      const sw = window.screen?.width || window.innerWidth;
      let deviceType = "Desktop";
      if (sw < 768) deviceType = "Mobile";
      else if (sw < 1024) deviceType = "Tablet";

      // IMPORTANTE: passar TODOS os parâmetros nomeados (inclusive p_ip=null).
      // O supabase-js resolve a função por assinatura — omitir um arg nomeado
      // faz o Postgres procurar uma sobrecarga inexistente e falha silenciosa
      // (No function matches the given name and argument types).
      await supabase.rpc("registrar_view_proposta" as any, {
        p_token: td.token ?? token,
        p_user_agent: navigator.userAgent,
        p_referrer: document.referrer || null,
        p_ip: null,
        p_device_type: deviceType,
        p_screen_width: sw,
      });

      // Notificar consultor SOMENTE no primeiro acesso (view_count vem ANTES do increment)
      if ((td.view_count ?? 0) === 0) {
        try {
          await supabase.functions.invoke("proposal-decision-notify", {
            body: { token_id: td.id, decisao: "visualizada" },
          });
        } catch {
          // Silent — notify é best-effort, não pode travar a abertura
        }
      }
    } catch {
      // Silent — view tracking is best-effort
    }
  };

  const loadProposal = async () => {
    setLoading(true);
    try {
      // SEC: SELECT anon revogado em proposta_aceite_tokens — usa RPC SECURITY DEFINER
      const { data: tdRows, error: tdErr } = await (supabase as any)
        .rpc("get_proposta_token_by_value", { p_token: token! });
      const td = Array.isArray(tdRows) ? tdRows[0] : tdRows;

      if (tdErr || !td) { setError("Link inválido ou expirado."); setLoading(false); return; }

      // Check if token was invalidated (new version created or proposal deleted)
      if (td.invalidado_em) {
        try {
          const { data: proposta } = await (supabase as any)
            .from("propostas_nativas")
            .select("tenant_id")
            .eq("id", td.proposta_id)
            .maybeSingle();

          let latestTokenUrl: string | null = null;
          // Only look for latest token if invalidated by new version (not deletion)
          if (td.motivo_invalidacao === 'nova_versao_criada') {
            const { data: latestRows } = await (supabase as any)
              .rpc("get_latest_valid_token_for_proposta", { p_proposta_id: td.proposta_id });
            const latestToken = Array.isArray(latestRows) ? latestRows[0] : latestRows;
            if (latestToken?.token) {
              latestTokenUrl = `/proposta/${latestToken.token}`;
            }
          }

          if (proposta?.tenant_id) {
            const [tenantRes, brandRes, consultorRes] = await Promise.all([
              supabase.from("tenants").select("nome").eq("id", proposta.tenant_id).maybeSingle(),
              supabase.from("brand_settings").select("logo_url").eq("tenant_id", proposta.tenant_id).maybeSingle(),
              (supabase as any).from("consultores").select("telefone").eq("tenant_id", proposta.tenant_id).eq("ativo", true).limit(1).maybeSingle(),
            ]);
            setInvalidatedInfo({
              invalidado_em: td.invalidado_em,
              empresaNome: tenantRes.data?.nome || null,
              empresaLogo: brandRes.data?.logo_url || null,
              empresaTelefone: consultorRes.data?.telefone || null,
              motivo_invalidacao: td.motivo_invalidacao || null,
              latestTokenUrl,
            });
            setLoading(false);
            return;
          }
        } catch { /* fallback to generic error */ }
        setError(
          td.motivo_invalidacao === 'proposta_excluida'
            ? "Esta proposta foi removida e o link não está mais disponível."
            : "Este link não está mais disponível. Uma nova versão da proposta foi gerada."
        );
        setLoading(false);
        return;
      }
      if (td.used_at) {
        setDecision(td.decisao || "aceita");
        setTokenData(td);
        loadPostDecisionInfo(td.id, td.proposta_id);
        setLoading(false);
        return;
      }
      if (new Date(td.expires_at) < new Date()) { setError("Este link expirou."); setLoading(false); return; }

      setTokenData(td);
      trackView(td);
      // Start heartbeat for tracked tokens
      if (td.tipo !== "public") {
        startHeartbeat(td.token);
      }

      const [renderRes, versaoRes, cenariosRes] = await Promise.all([
        supabase.from("proposta_renders")
          .select("html").eq("versao_id", td.versao_id).eq("tipo", "html").maybeSingle(),
        supabase.from("proposta_versoes")
          .select("id, valor_total, economia_mensal, payback_meses, potencia_kwp, snapshot, output_pdf_path, template_id_used")
          .eq("id", td.versao_id).single(),
        (supabase as any).from("proposta_cenarios")
          .select("id, ordem, nome, tipo, is_default, preco_final, entrada_valor, num_parcelas, valor_parcela, taxa_juros_mensal, cet_anual, payback_meses, tir_anual, roi_25_anos, economia_primeiro_ano")
          .eq("versao_id", td.versao_id).order("ordem"),
      ]);

      if (renderRes.data?.html) setHtml(renderRes.data.html);
      if (versaoRes.data) {
        setVersaoData(versaoRes.data);

        // If template_id_used exists (HTML web template), redirect to landing page
        if ((versaoRes.data as any).template_id_used) {
          setRedirectToLanding(true);
          setLoading(false);
          return;
        }

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

      // Build payment choice object
      const formaParaSalvar = formaEscolhida
        ? {
            tipo: "forma_propria",
            forma_id: formaEscolhida,
            forma_nome: FORMA_LABELS[formasProprias.find((f: any) => f.id === formaEscolhida)?.forma_pagamento ?? "outro"] ?? "Outro",
            num_parcelas: parcelaEscolhida,
          }
        : bancoEscolhido
          ? { tipo: "financiamento_bancario", banco_nome: bancoEscolhido }
          : null;

      // RB-47: aceite vai TODO pela edge (sem UPDATE anon direto em proposta_aceite_tokens)
      const { error: transitionErr } = await supabase.functions.invoke("proposal-public-action", {
        body: {
          token: tokenData.token,
          action: "aceitar",
          nome,
          documento: documento || null,
          observacoes: observacoes || null,
          cenario_id: selectedCenario || null,
          assinatura_url: assinaturaUrl,
          forma_pagamento_escolhida: formaParaSalvar,
          user_agent: navigator.userAgent,
        },
      });
      if (transitionErr) throw transitionErr;

      setDecision("aceita");
      // Buscar termo PDF + consultor para tela pós-aceite (com pequeno delay para PDF)
      setTimeout(() => loadPostDecisionInfo(tokenData.id, tokenData.proposta_id), 2500);
      toast({ title: "Proposta aceita com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao aceitar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const loadPostDecisionInfo = async (tokenId: string, propostaId: string) => {
    try {
      const { data: tok } = await (supabase as any)
        .from("proposta_aceite_tokens")
        .select("termo_aceite_pdf_url")
        .eq("id", tokenId)
        .maybeSingle();
      const { data: prop } = await (supabase as any)
        .from("propostas_nativas")
        .select("consultor_id, tenant_id")
        .eq("id", propostaId)
        .maybeSingle();
      let consultorNome: string | null = null;
      let consultorTelefone: string | null = null;
      if (prop?.consultor_id) {
        const { data: cons } = await (supabase as any)
          .from("profiles")
          .select("nome, telefone")
          .eq("user_id", prop.consultor_id)
          .maybeSingle();
        consultorNome = cons?.nome ?? null;
        consultorTelefone = cons?.telefone ?? null;
      }
      setPostDecisionInfo({
        termoUrl: tok?.termo_aceite_pdf_url ?? null,
        consultorNome,
        consultorTelefone,
      });
    } catch { /* best-effort */ }
  };

  const handleReject = async () => {
    if (!tokenData) return;

    setSubmitting(true);
    try {
      // RB-47: recusa vai TODA pela edge (sem UPDATE anon direto em proposta_aceite_tokens)
      const { error: transitionErr } = await supabase.functions.invoke("proposal-public-action", {
        body: {
          token: tokenData.token,
          action: "recusar",
          motivo: recusaMotivo || null,
          user_agent: navigator.userAgent,
        },
      });
      if (transitionErr) throw transitionErr;

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

  // ── REDIRECT TO LANDING PAGE (template WEB) ────────────
  if (redirectToLanding && token) {
    return <Navigate to={`/pl/${token}`} replace />;
  }

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

  // ── INVALIDATED TOKEN (new version created) ─────────
  if (invalidatedInfo) {
    const isDeleted = invalidatedInfo.motivo_invalidacao === 'proposta_excluida';
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <div className="max-w-md w-full text-center space-y-6">
          {invalidatedInfo.empresaLogo && (
            <img
              src={invalidatedInfo.empresaLogo}
              alt={invalidatedInfo.empresaNome || "Empresa"}
              className="h-16 mx-auto object-contain"
            />
          )}

          <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">
              {isDeleted ? "Proposta removida" : "Este link não está mais disponível"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isDeleted
                ? "Esta proposta foi removida e o link não está mais ativo."
                : "Uma nova versão desta proposta foi gerada."}
              {!isDeleted && invalidatedInfo.empresaNome && !invalidatedInfo.latestTokenUrl && (
                <>
                  {" "}Entre em contato com{" "}
                  <span className="font-medium text-foreground">
                    {invalidatedInfo.empresaNome}
                  </span>{" "}
                  para receber o link atualizado.
                </>
              )}
            </p>
          </div>

          {invalidatedInfo.latestTokenUrl && (
            <a
              href={invalidatedInfo.latestTokenUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition"
            >
              <Zap className="w-4 h-4" />
              Ver versão atualizada
            </a>
          )}

          {invalidatedInfo.empresaTelefone && (
            <a
              href={`https://wa.me/55${invalidatedInfo.empresaTelefone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-success text-success-foreground font-medium text-sm hover:opacity-90 transition"
            >
              <MessageCircle className="w-4 h-4" />
              Falar com {invalidatedInfo.empresaNome || "a empresa"}
            </a>
          )}

          <p className="text-xs text-muted-foreground">
            Link expirado em{" "}
            {new Date(invalidatedInfo.invalidado_em).toLocaleDateString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </p>
        </div>
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
    const primeiroNome = (tokenData?.aceite_nome || "").split(" ")[0];
    return (
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {isAccepted ? (
            <>
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="h-9 w-9 text-success" />
                  </div>
                  <h2 className="text-2xl font-bold">
                    Parabéns{primeiroNome ? `, ${primeiroNome}` : ""}! 🎉
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Sua aceitação foi registrada com sucesso. Estamos muito felizes
                    em começar essa jornada de economia e energia limpa com você.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-6">
                  <h3 className="font-semibold mb-4 text-center">Próximos passos</h3>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { icon: Building2, title: "Visita técnica", prazo: "Em até 5 dias úteis", desc: "Avaliação do local da instalação" },
                      { icon: Zap, title: "Instalação", prazo: "15 a 30 dias", desc: "Montagem do sistema fotovoltaico" },
                      { icon: Sun, title: "Ativação", prazo: "Após vistoria da concessionária", desc: "Sistema gerando energia" },
                    ].map((step, idx) => (
                      <div key={idx} className="rounded-lg border bg-card p-4 flex flex-col items-center text-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <step.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="font-medium text-sm">{step.title}</div>
                        <div className="text-xs text-primary font-semibold">{step.prazo}</div>
                        <div className="text-xs text-muted-foreground">{step.desc}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {(postDecisionInfo?.consultorNome || postDecisionInfo?.consultorTelefone) && (
                <Card>
                  <CardContent className="py-5">
                    <h3 className="font-semibold mb-3 text-sm">Seu consultor</h3>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {postDecisionInfo.consultorNome && (
                          <div className="font-medium text-sm">{postDecisionInfo.consultorNome}</div>
                        )}
                        {postDecisionInfo.consultorTelefone && (
                          <a
                            href={`https://wa.me/${postDecisionInfo.consultorTelefone.replace(/\D/g, "")}`}
                            target="_blank" rel="noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {postDecisionInfo.consultorTelefone}
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {postDecisionInfo?.termoUrl && (
                <div className="flex justify-center">
                  <Button asChild size="lg">
                    <a href={postDecisionInfo.termoUrl} target="_blank" rel="noreferrer" download>
                      <FileText className="h-4 w-4 mr-2" />
                      Baixar comprovante de aceite
                    </a>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card className="max-w-md w-full mx-auto">
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <XCircle className="h-14 w-14 text-destructive" />
                <h2 className="text-xl font-semibold">Proposta Recusada</h2>
                <p className="text-sm text-muted-foreground">
                  Sua resposta foi registrada. A equipe comercial será notificada.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const hasCenarios = cenarios.length > 0;
  const pagamentoOpcoes = !hasCenarios ? (versaoData?.snapshot?.pagamento_opcoes || []) : [];
  const isSimulacaoView = viewMode === "simulacao";

  // Payment methods from snapshot (admin-configured)
  const formasProprias: any[] = versaoData?.snapshot?.formas_pagamento_proprias ?? [];
  const valorTotal = activeCenario?.preco_final ?? versaoData?.valor_total ?? 0;
  const temEscolha = formaEscolhida !== null || bancoEscolhido !== null;

  const FORMA_LABELS: Record<string, string> = {
    pix: "Pix", dinheiro: "Dinheiro", transferencia: "Transferência",
    boleto: "Boleto", cartao_credito: "Cartão de Crédito",
    cartao_debito: "Cartão Débito", cheque: "Cheque",
    financiamento: "Financiamento", crediario: "Crediário", outro: "Outro",
  };

  const FORMA_ICONS_MAP: Record<string, React.ReactNode> = {
    pix: <Smartphone className="h-5 w-5 text-primary" />,
    dinheiro: <Banknote className="h-5 w-5 text-primary" />,
    transferencia: <Wallet className="h-5 w-5 text-primary" />,
    boleto: <FileText className="h-5 w-5 text-primary" />,
    cartao_credito: <CreditCard className="h-5 w-5 text-primary" />,
    cartao_debito: <CreditCard className="h-5 w-5 text-primary" />,
    cheque: <FileText className="h-5 w-5 text-primary" />,
    financiamento: <Building2 className="h-5 w-5 text-primary" />,
    crediario: <Wallet className="h-5 w-5 text-primary" />,
    outro: <DollarSign className="h-5 w-5 text-primary" />,
  };

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
        <div className="max-w-lg mx-auto px-4 pb-4">
          <Card className="border-border/60">
            <CardContent className="py-4 space-y-3">
              <h3 className="text-sm font-semibold text-center text-foreground">Escolha a melhor opção</h3>
              {cenarios.map((c) => {
                const isSelected = selectedCenario === c.id;
                const isAVista = /avista|à vista|a_vista/i.test(`${c.tipo} ${c.nome}`) || c.num_parcelas <= 1;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "rounded-xl border-2 p-4 transition-all cursor-pointer",
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                    )}
                    onClick={() => setSelectedCenario(c.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{c.nome}</p>
                        <p className="text-lg font-bold text-primary mt-0.5">{formatBRL(c.preco_final)}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {c.entrada_valor > 0 && c.num_parcelas > 1 && !isAVista && (
                            <span>Entrada: {formatBRL(c.entrada_valor)}</span>
                          )}
                          {c.num_parcelas > 1 && <span>{c.num_parcelas}x de {formatBRL(c.valor_parcela)}</span>}
                          {c.taxa_juros_mensal > 0 && <span>Taxa: {formatTaxaMensal(c.taxa_juros_mensal)}</span>}
                          {!isAVista && c.num_parcelas <= 1 && <span>Pagamento único</span>}
                          {isAVista && <span>Pagamento à vista</span>}
                        </div>
                      </div>
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0", isSelected ? "border-primary bg-primary" : "border-border")}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border/50">
                        <div className="text-center">
                          <p className="text-xs font-bold text-foreground">{Number.isFinite(c.payback_meses) ? `${c.payback_meses}m` : "—"}</p>
                          <p className="text-[9px] text-muted-foreground">Payback</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-foreground">{Number.isFinite(c.tir_anual) ? `${c.tir_anual.toFixed(1)}%` : "—"}</p>
                          <p className="text-[9px] text-muted-foreground">TIR</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-foreground">{Number.isFinite(c.roi_25_anos) ? formatBRL(c.roi_25_anos) : "—"}</p>
                          <p className="text-[9px] text-muted-foreground">ROI 25a</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Financial Summary — only on simulacao view */}
      {versaoData && isSimulacaoView && (
        <div className="max-w-lg mx-auto px-4 pb-4">
          <Card className="border-border/60">
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-3">📊 Resumo Financeiro{activeCenario ? ` — ${activeCenario.nome}` : ""}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
                          {op.entrada > 0 && !/avista|à vista|a_vista/i.test(`${op.tipo ?? ""} ${op.nome ?? ""}`) && op.num_parcelas > 1 && <span>Entrada: {formatBRL(op.entrada)}</span>}
                          {op.num_parcelas > 1 && <span>{op.num_parcelas}x de {formatBRL(op.valor_parcela)}</span>}
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
      {/* ── ECONOMY DETAIL CARDS — always visible ──────── */}
      {versaoData && (
        <div className="max-w-lg mx-auto px-4 pb-4">
          <EconomiaDetailCards
            snapshot={versaoData.snapshot}
            economiaMensal={versaoData.economia_mensal ?? 0}
            potenciaKwp={versaoData.potencia_kwp ?? 0}
          />
        </div>
      )}


      {formasProprias.length > 0 && (
        <div className="max-w-lg mx-auto px-4 pb-4">
          <Card className="border-border/60">
            <CardContent className="py-6 space-y-4">
              <h3 className="text-base font-semibold text-center">Como prefere pagar?</h3>
              <p className="text-sm text-muted-foreground text-center">
                Escolha a forma de pagamento. Nossa equipe confirmará os detalhes.
              </p>

              {formasProprias.map((forma: any) => {
                const isSelected = formaEscolhida === forma.id;
                const taxa = forma.juros_tipo === "percentual" ? (forma.juros_valor ?? 0) / 100 : 0;
                const maxParcelas = forma.parcelas_padrao ?? 1;
                const formaPag = forma.forma_pagamento ?? "outro";

                const calcParcela = (n: number) =>
                  taxa === 0 ? valorTotal / n : valorTotal * taxa / (1 - Math.pow(1 + taxa, -n));

                const opcoes = Array.from({ length: maxParcelas }, (_, i) => {
                  const n = i + 1;
                  const vp = calcParcela(n);
                  return { n, valorParcela: Math.round(vp * 100) / 100, total: Math.round(vp * n * 100) / 100, semJuros: taxa === 0 };
                });

                return (
                  <div
                    key={forma.id}
                    className={cn(
                      "rounded-xl border-2 transition-all overflow-hidden cursor-pointer",
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                    )}
                    onClick={() => {
                      setFormaEscolhida(isSelected ? null : forma.id);
                      setBancoEscolhido(null);
                      setParcelaEscolhida(1);
                    }}
                  >
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isSelected ? "bg-primary/10" : "bg-muted")}>
                          {FORMA_ICONS_MAP[formaPag] ?? <DollarSign className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{FORMA_LABELS[formaPag] ?? formaPag}</p>
                          <p className="text-xs text-muted-foreground">
                            {taxa === 0 ? `Até ${maxParcelas}x sem juros` : `Até ${maxParcelas}x · ${(forma.juros_valor ?? 0)}% a.m.`}
                          </p>
                        </div>
                      </div>
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0", isSelected ? "border-primary bg-primary" : "border-border")}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                    </div>

                    {isSelected && maxParcelas > 1 && (
                      <div className="border-t border-primary/20">
                        <div className="grid grid-cols-3 px-4 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                          <span>Parcelas</span><span>Valor/mês</span><span>Total</span>
                        </div>
                        {opcoes.map(op => (
                          <div
                            key={op.n}
                            className={cn(
                              "grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-4 py-3 cursor-pointer border-t border-primary/10 transition-colors",
                              parcelaEscolhida === op.n ? "bg-primary/15" : "hover:bg-primary/5"
                            )}
                            onClick={e => { e.stopPropagation(); setParcelaEscolhida(op.n); }}
                          >
                            <span className="text-sm font-medium text-foreground">{op.n}x</span>
                            <span className="text-sm text-foreground">
                              {formatBRL(op.valorParcela)}
                              {op.semJuros && <Badge variant="outline" className="ml-1 text-[10px] bg-success/10 text-success border-success/30">s/ juros</Badge>}
                            </span>
                            <span className="text-sm text-muted-foreground">{formatBRL(op.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isSelected && maxParcelas === 1 && (
                      <div className="border-t border-primary/20 px-4 py-3 bg-primary/5">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Total à vista</span>
                          <span className="text-lg font-bold text-foreground">{formatBRL(valorTotal)}</span>
                        </div>
                        {forma.observacoes && <p className="text-xs text-muted-foreground mt-1">{forma.observacoes}</p>}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Separator for bank financing */}
              {pagamentoOpcoes.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">ou Financiamento Bancário</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              {pagamentoOpcoes.map((op: any, idx: number) => {
                const isSelected = bancoEscolhido === (op.nome ?? `banco-${idx}`);
                return (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-xl border-2 p-4 transition-all cursor-pointer",
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                    )}
                    onClick={() => {
                      setBancoEscolhido(isSelected ? null : (op.nome ?? `banco-${idx}`));
                      setFormaEscolhida(null);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isSelected ? "bg-primary/10" : "bg-muted")}>
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{op.nome}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {op.entrada > 0 && !/avista|à vista|a_vista/i.test(`${op.tipo ?? ""} ${op.nome ?? ""}`) && op.num_parcelas > 1 && <span>Entrada: {formatBRL(op.entrada)}</span>}
                            {op.num_parcelas > 0 && <span>{op.num_parcelas}x de {formatBRL(op.valor_parcela)}</span>}
                            {op.taxa_mensal > 0 && <span>Taxa: {formatTaxaMensal(op.taxa_mensal)}</span>}
                          </div>
                        </div>
                      </div>
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0", isSelected ? "border-primary bg-primary" : "border-border")}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                    </div>
                  </div>
                );
              })}
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
                disabled={submitting || !nome.trim() || (formasProprias.length > 0 && !temEscolha)}
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
