
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TemplateHtmlRenderer } from "@/components/proposal-landing/TemplateHtmlRenderer";
import {
  Sun, Loader2, AlertTriangle, CheckCircle2, XCircle, FileText, Download, ChevronRight, MessageCircle
} from "lucide-react";
import { PropostaChatSection } from "@/components/proposal-landing/PropostaChatSection";
import { getLandingThemeCSS, parseModelo } from "@/components/proposal-landing/themes/landingThemes";
import { resolvePublicProposal, type PublicProposalResolution } from "@/services/proposal/publicProposalResolver";
import { ProposalCTASection } from "@/components/proposal-landing/sections/ProposalCTASection";
import type { CenarioData, AcceptFormData } from "@/components/proposal-landing/sections/types";
import { formatBRL, formatNumberBR } from "@/lib/formatters";
import { getCanonicalProposalTotal } from "@/services/proposal/proposalTotals";
import { getMaskedPdfUrl } from "@/services/proposal/proposalLinks";

export default function PropostaLanding() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const modelo = parseModelo(searchParams.get("modelo"));
  const LANDING_STYLES = getLandingThemeCSS(modelo);

  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState<PublicProposalResolution | null>(null);
  const [decision, setDecision] = useState<"aceita" | "recusada" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [acceptForm, setAcceptForm] = useState<AcceptFormData>({ nome: "", documento: "", obs: "" });
  const [brand, setBrand] = useState<any>(null);
  const [tenantNome, setTenantNome] = useState<string | null>(null);
  const [consultorData, setConsultorData] = useState<any>(null);
  const [clienteData, setClienteData] = useState<any>(null);
  const [cenarios, setCenarios] = useState<CenarioData[]>([]);
  const [selectedCenario, setSelectedCenario] = useState<string | null>(null);

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token) loadData();
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await resolvePublicProposal(token!);
      setResolution(res);

      if (res.mode === "error") {
        setLoading(false);
        return;
      }

      if (res.tokenData?.used_at) {
        setDecision(res.tokenData.decisao || "aceita");
      }

      // Tracking & Heartbeat
      try {
        const sw = window.innerWidth || null;
        const deviceType = sw ? (sw < 768 ? "Mobile" : sw < 1024 ? "Tablet" : "Desktop") : null;
        await supabase.rpc("registrar_view_proposta", {
          p_token: token!,
          p_user_agent: navigator.userAgent,
          p_referrer: document.referrer || null,
          p_ip: null,
          p_device_type: deviceType,
          p_screen_width: sw,
        });

        if (res.tokenData?.tipo !== "public") {
          heartbeatRef.current = setInterval(async () => {
            await supabase.rpc("registrar_heartbeat_proposta", { p_token: token!, p_segundos: 30 });
          }, 30_000);
        }
      } catch { /* best effort */ }

      // Complementary data
      if (res.tokenData?.tenant_id) {
        const clienteId = (res.snapshot as any)?.clienteId;
        const [brandRes, tenantRes, consultorRes, clienteRes, cenariosRes] = await Promise.all([
          supabase.rpc("get_public_brand_settings", { _tenant_id: res.tokenData.tenant_id }),
          supabase.from("tenants").select("nome").eq("id", res.tokenData.tenant_id).maybeSingle(),
          res.tokenData.consultor_id ? supabase.from("consultores").select("nome, telefone, avatar_url").eq("id", res.tokenData.consultor_id).maybeSingle() : Promise.resolve({ data: null }),
          clienteId ? supabase.from("clientes").select("nome, cidade, estado").eq("id", clienteId).maybeSingle() : Promise.resolve({ data: null }),
          supabase.from("proposta_cenarios").select("*").eq("versao_id", res.versaoId).order("ordem")
        ]);

        setBrand(Array.isArray(brandRes.data) ? brandRes.data[0] : brandRes.data);
        setTenantNome(tenantRes.data?.nome || null);
        setConsultorData(consultorRes.data);
        setClienteData(clienteRes.data);
        
        const loadedCenarios = (cenariosRes.data || []) as CenarioData[];
        setCenarios(loadedCenarios);
        const defaultC = loadedCenarios.find(c => c.is_default) ?? loadedCenarios[0];
        if (defaultC) setSelectedCenario(defaultC.id);
      }
    } catch (e) {
      console.error("[PropostaLanding] loadData error:", e);
    } finally {
      setLoading(false);
    }
  };

  const activeCenario = useMemo(
    () => cenarios.find(c => c.id === selectedCenario) ?? null,
    [cenarios, selectedCenario]
  );

  const handleAccept = async () => {
    if (!resolution?.tokenData?.id || !acceptForm.nome.trim()) return;
    setSubmitting(true);
    try {
      const { error: transitionErr } = await supabase.functions.invoke("proposal-public-action", {
        body: {
          token,
          action: "aceitar",
          nome: acceptForm.nome,
          documento: acceptForm.documento || null,
          observacoes: acceptForm.obs || null,
          cenario_id: selectedCenario || null,
          user_agent: navigator.userAgent,
        },
      });
      if (transitionErr) throw transitionErr;
      setDecision("aceita");
    } catch { /* error handled by UI */ } finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      const { error: transitionErr } = await supabase.functions.invoke("proposal-public-action", {
        body: {
          token,
          action: "recusar",
          motivo: rejectMotivo || null,
          user_agent: navigator.userAgent,
        },
      });
      if (transitionErr) throw transitionErr;
      setDecision("recusada");
    } catch { /* error handled */ } finally { setSubmitting(false); setShowReject(false); }
  };

  const templateVariables = useMemo(() => {
    if (!resolution?.snapshot) return {};
    const s = resolution.snapshot;
    const raw = (s as any)?._raw || {};
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) { vars[k] = String(v); }

    const bestValorTotal = activeCenario?.preco_final ?? (s as any)?.valorTotal ?? 0;
    const ecoMensal = (s as any)?.economiaMensal ?? 0;

    vars["valor_total"] = formatNumberBR(bestValorTotal);
    vars["valor_total_rs"] = formatBRL(bestValorTotal);
    vars["economia_mensal"] = formatNumberBR(ecoMensal);
    vars["economia_mensal_rs"] = formatBRL(ecoMensal);
    vars["cliente_nome"] = s.clienteNome || clienteData?.nome || "";
    vars["empresa_nome"] = tenantNome || "";
    vars["consultor_nome"] = consultorData?.nome || "";

    return vars;
  }, [resolution, activeCenario, tenantNome, consultorData, clienteData]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <Sun className="h-12 w-12 text-primary animate-pulse" />
      <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
      <p className="text-slate-500 text-sm font-medium">Carregando proposta...</p>
    </div>
  );

  if (resolution?.mode === "error") return (
    <div className="min-h-screen bg-[#1B3A8C] flex flex-col items-center justify-center p-6 text-white text-center">
      <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Ops! Algo deu errado</h2>
      <p className="text-white/60 max-w-md">{resolution.error}</p>
    </div>
  );

  if (resolution?.mode === "pending") return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <FileText className="h-8 w-8 text-primary animate-bounce" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Documento em preparação</h2>
        <p className="text-slate-500 text-sm mb-6">
          Estamos gerando os arquivos finais da sua proposta solar. Isso leva apenas alguns segundos.
        </p>
        <button onClick={() => window.location.reload()} className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Atualizar agora
        </button>
      </div>
    </div>
  );

  if (decision) return (
    <div className="min-h-screen bg-[#1B3A8C] flex flex-col items-center justify-center p-6 text-white text-center">
      {brand?.logo_white_url && <img src={brand.logo_white_url} alt="" className="h-12 mb-8 object-contain opacity-80" />}
      {decision === "aceita" ? (
        <div className="flex flex-col items-center gap-4">
          <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold">Proposta Aceita!</h2>
          <p className="text-white/60 max-w-sm">Obrigado! Sua aceitação foi registrada com sucesso. Nossa equipe entrará em contato em breve.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="h-20 w-20 bg-red-500/20 rounded-full flex items-center justify-center">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold">Proposta Recusada</h2>
          <p className="text-white/60 max-w-sm">Sua resposta foi registrada. Agradecemos pelo feedback.</p>
        </div>
      )}
    </div>
  );

  // Render Modo PDF Premium
  if (resolution?.mode === "pdf") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* PDF Header */}
        <header className="bg-white/5 backdrop-blur-md border-b border-white/10 p-4 sticky top-0 z-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {brand?.logo_white_url ? (
              <img src={brand.logo_white_url} alt="" className="h-8 object-contain" />
            ) : (
              <FileText className="h-8 w-8 text-primary" />
            )}
            <div className="hidden sm:block">
              <h1 className="text-white text-sm font-bold leading-tight">Proposta Solar</h1>
              <p className="text-white/40 text-[10px] uppercase tracking-wider">{resolution.snapshot?.clienteNome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href={getMaskedPdfUrl(token!)} 
              download={`Proposta_${resolution.snapshot?.clienteNome}.pdf`}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
              title="Baixar PDF"
            >
              <Download className="h-5 w-5" />
            </a>
            <button 
              onClick={() => ctaRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              Aceitar Proposta <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center gap-8">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden min-h-[800px] border border-white/5">
             <iframe 
                src={getMaskedPdfUrl(token!)} 
                className="w-full h-full min-h-[800px] border-0"
                title="Visualizador de Proposta"
             />
          </div>

          <div ref={ctaRef} className="w-full max-w-5xl">
            <ProposalCTASection
              snapshot={resolution.snapshot!}
              versaoData={{
                valor_total: (resolution.snapshot as any)?.valorTotal || 0,
                economia_mensal: (resolution.snapshot as any)?.economiaMensal || 0,
                payback_meses: (resolution.snapshot as any)?.paybackMeses || 0,
                potencia_kwp: resolution.snapshot?.potenciaKwp || 0,
              }}
              brand={brand}
              tenantNome={tenantNome}
              consultorNome={consultorData?.nome}
              consultorTelefone={consultorData?.telefone}
              acceptForm={acceptForm}
              onAcceptFormChange={setAcceptForm}
              onAccept={handleAccept}
              onReject={() => setShowReject(true)}
              submitting={submitting}
            />
          </div>
        </main>

        <footer className="p-8 text-center text-white/20 text-xs">
          © {new Date().getFullYear()} {tenantNome} — Todos os direitos reservados
        </footer>
        
        {/* Floating Chat */}
        <div className="fixed bottom-6 right-6 z-[60]">
           <button 
            className="w-14 h-14 bg-green-500 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
            onClick={() => window.open(`https://wa.me/55${consultorData?.telefone?.replace(/\D/g, '')}`, '_blank')}
           >
             <MessageCircle className="h-6 w-6" />
           </button>
        </div>

        {showReject && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
             <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Recusar Proposta</h3>
                <p className="text-slate-500 text-sm mb-6">Sua opinião é importante para nós. Por favor, nos conte o motivo da recusa:</p>
                <textarea 
                  value={rejectMotivo}
                  onChange={e => setRejectMotivo(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all mb-6 min-h-[120px]"
                  placeholder="Ex: Preço elevado, prazo de entrega, etc..."
                />
                <div className="flex gap-3">
                   <button onClick={() => setShowReject(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                   <button onClick={handleReject} disabled={submitting} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">
                     {submitting ? 'Enviando...' : 'Confirmar Recusa'}
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  // Render Modo Web (Landing Page)
  return (
    <div className="pl-landing min-h-screen">
      <style>{LANDING_STYLES}</style>
      <TemplateHtmlRenderer blocks={resolution?.webTemplateHtml} variables={templateVariables} />
      <div ref={ctaRef} className="w-full">
        <ProposalCTASection
          snapshot={resolution?.snapshot!}
          versaoData={{
            valor_total: (resolution?.snapshot as any)?.valorTotal || 0,
            economia_mensal: (resolution?.snapshot as any)?.economiaMensal || 0,
            payback_meses: (resolution?.snapshot as any)?.paybackMeses || 0,
            potencia_kwp: resolution?.snapshot?.potenciaKwp || 0,
          }}
          brand={brand}
          tenantNome={tenantNome}
          consultorNome={consultorData?.nome}
          consultorTelefone={consultorData?.telefone}
          acceptForm={acceptForm}
          onAcceptFormChange={setAcceptForm}
          onAccept={handleAccept}
          onReject={() => setShowReject(true)}
          submitting={submitting}
        />
      </div>
      <PropostaChatSection propostaData={templateVariables} />
      {showReject && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
             <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Recusar Proposta</h3>
                <p className="text-slate-500 text-sm mb-6">Sua opinião é importante para nós. Por favor, nos conte o motivo da recusa:</p>
                <textarea 
                  value={rejectMotivo}
                  onChange={e => setRejectMotivo(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all mb-6 min-h-[120px]"
                  placeholder="Ex: Preço elevado, prazo de entrega, etc..."
                />
                <div className="flex gap-3">
                   <button onClick={() => setShowReject(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                   <button onClick={handleReject} disabled={submitting} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">
                     {submitting ? 'Enviando...' : 'Confirmar Recusa'}
                   </button>
                </div>
             </div>
          </div>
        )}
    </div>
  );
}
