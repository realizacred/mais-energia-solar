/**
 * PropostaLanding.tsx
 *
 * Landing page de alta conversão para propostas comerciais.
 * Rota: /pl/:token
 *
 * Página pública — sem AuthGuard (exceção RB-02 documentada).
 * Paleta própria (não usa design system do admin).
 * RB-16: tarifas sem formatter.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatters";
import { TemplateHtmlRenderer } from "@/components/proposal-landing/TemplateHtmlRenderer";
import type { TemplateBlock } from "@/components/admin/proposal-builder/types";
import {
  normalizeProposalSnapshot,
  type NormalizedProposalSnapshot,
} from "@/domain/proposal/normalizeProposalSnapshot";
import {
  Sun, Loader2, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { PropostaChatSection } from "@/components/proposal-landing/PropostaChatSection";
import { getLandingThemeCSS, parseModelo } from "@/components/proposal-landing/themes/landingThemes";
import { LandingThemeSwitcher } from "@/components/proposal-landing/themes/LandingThemeSwitcher";

// Section components
import { ProposalHeroSection } from "@/components/proposal-landing/sections/ProposalHeroSection";
import { ProposalProblemSection } from "@/components/proposal-landing/sections/ProposalProblemSection";
import { ProposalSolutionSection } from "@/components/proposal-landing/sections/ProposalSolutionSection";
import { ProposalEquipmentSection } from "@/components/proposal-landing/sections/ProposalEquipmentSection";
import { TemplateInterativo } from "@/components/proposal-landing/sections/TemplateInterativo";
import { ProposalFinancialSection } from "@/components/proposal-landing/sections/ProposalFinancialSection";
import { ProposalAuthoritySection } from "@/components/proposal-landing/sections/ProposalAuthoritySection";
import { ProposalSecuritySection } from "@/components/proposal-landing/sections/ProposalSecuritySection";
import { ProposalPaymentSection } from "@/components/proposal-landing/sections/ProposalPaymentSection";
import { ProposalCTASection } from "@/components/proposal-landing/sections/ProposalCTASection";
import type { CenarioData, AcceptFormData } from "@/components/proposal-landing/sections/types";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Types
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface BrandData {
  logo_url: string | null;
  logo_white_url: string | null;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Main Component
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function PropostaLanding() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const modelo = parseModelo(searchParams.get("modelo"));
  const LANDING_STYLES = getLandingThemeCSS(modelo);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"aceita" | "recusada" | null>(null);

  const [tokenId, setTokenId] = useState<string | null>(null);
  const [propostaId, setPropostaId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<NormalizedProposalSnapshot | null>(null);
  const [versaoData, setVersaoData] = useState<any>(null);
  const [cenarios, setCenarios] = useState<CenarioData[]>([]);
  const [selectedCenario, setSelectedCenario] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [tenantNome, setTenantNome] = useState<string | null>(null);
  const [consultorNome, setConsultorNome] = useState<string | null>(null);
  const [consultorTelefone, setConsultorTelefone] = useState<string | null>(null);
  const [templateBlocks, setTemplateBlocks] = useState<TemplateBlock[] | null>(null);
  const [isLegacyMigrated, setIsLegacyMigrated] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [acceptForm, setAcceptForm] = useState<AcceptFormData>({ nome: "", documento: "", obs: "" });

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // ─── Data loading (reuse existing logic) ───
  useEffect(() => {
    if (token) loadData();
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      // SEC: SELECT anon revogado em proposta_aceite_tokens — usa RPC SECURITY DEFINER
      const { data: tdRows, error: tdErr } = await (supabase as any)
        .rpc("get_proposta_token_by_value", { p_token: token! });
      const td = Array.isArray(tdRows) ? tdRows[0] : tdRows;

      if (tdErr || !td) { setError("Link inválido ou expirado."); setLoading(false); return; }
      if (td.invalidado_em) { setError("Este link não está mais disponível."); setLoading(false); return; }
      if (td.used_at) { setDecision(td.decisao || "aceita"); setTokenId(td.id); setLoading(false); return; }
      if (new Date(td.expires_at) < new Date()) { setError("Este link expirou."); setLoading(false); return; }

      setTokenId(td.id);
      setPropostaId(td.proposta_id);

      try {
        await supabase.rpc("registrar_view_proposta" as any, {
          p_token: td.token, p_user_agent: navigator.userAgent, p_referrer: document.referrer || null,
        });
      } catch { /* best-effort */ }

      if (td.tipo !== "public") {
        heartbeatRef.current = setInterval(async () => {
          try {
            await supabase.rpc("registrar_heartbeat_proposta" as any, { p_token: td.token, p_segundos: 30 });
          } catch { /* best-effort */ }
        }, 30_000);
      }

      const [versaoRes, cenariosRes, propostaRes] = await Promise.all([
        supabase.from("proposta_versoes")
          .select("id, valor_total, economia_mensal, payback_meses, potencia_kwp, snapshot, output_pdf_path, template_id_used")
          .eq("id", td.versao_id).single(),
        (supabase as any).from("proposta_cenarios")
          .select("id, ordem, nome, tipo, is_default, preco_final, entrada_valor, num_parcelas, valor_parcela, taxa_juros_mensal, payback_meses, tir_anual, roi_25_anos, economia_primeiro_ano")
          .eq("versao_id", td.versao_id).order("ordem"),
        (supabase as any).from("propostas_nativas")
          .select("tenant_id, consultor_id, titulo, proposta_num, created_at, external_source")
          .eq("id", td.proposta_id).maybeSingle(),
      ]);

      if (versaoRes.data) {
        setVersaoData(versaoRes.data);
        setSnapshot(normalizeProposalSnapshot(versaoRes.data.snapshot as Record<string, unknown> | null));

        const templateId = (versaoRes.data as any).template_id_used;
        if (templateId) {
          try {
            const { data: tplData } = await supabase
              .from("proposta_templates")
              .select("template_html")
              .eq("id", templateId)
              .maybeSingle();
            if (tplData?.template_html) {
              const parsed = typeof tplData.template_html === "string"
                ? JSON.parse(tplData.template_html)
                : tplData.template_html;
              if (Array.isArray(parsed) && parsed.length > 0) {
                setTemplateBlocks(parsed);
              }
            }
          } catch { /* fallback to component layout */ }
        }
      }

      const loadedCenarios = cenariosRes.data ?? [];
      setCenarios(loadedCenarios);
      const defaultC = loadedCenarios.find((c: CenarioData) => c.is_default) ?? loadedCenarios[0];
      if (defaultC) setSelectedCenario(defaultC.id);

      if (propostaRes.data?.tenant_id) {
        const tenantId = propostaRes.data.tenant_id;
        const src = (propostaRes.data as any).external_source;
        setIsLegacyMigrated(src === "solarmarket" || src === "solar_market");
        const [brandRes, tenantRes, consultorRes] = await Promise.all([
          supabase.from("brand_settings")
            .select("logo_url, logo_white_url")
            .eq("tenant_id", tenantId).maybeSingle(),
          supabase.from("tenants").select("nome").eq("id", tenantId).maybeSingle(),
          propostaRes.data.consultor_id
            ? (supabase as any).from("consultores").select("nome, telefone").eq("id", propostaRes.data.consultor_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (brandRes.data) setBrand(brandRes.data as any);
        if (tenantRes.data) setTenantNome(tenantRes.data.nome);
        if (consultorRes.data) {
          setConsultorNome(consultorRes.data.nome);
          setConsultorTelefone(consultorRes.data.telefone);
        }
      }
    } catch {
      setError("Erro ao carregar proposta.");
    } finally {
      setLoading(false);
    }
  };

  const activeCenario = useMemo(
    () => cenarios.find(c => c.id === selectedCenario) ?? null,
    [cenarios, selectedCenario]
  );

  // ─── Handlers ───
  const handleAccept = async () => {
    if (!tokenId || !acceptForm.nome.trim()) return;
    setSubmitting(true);
    try {
      await (supabase as any).from("proposta_aceite_tokens").update({
        used_at: new Date().toISOString(), decisao: "aceita",
        aceite_nome: acceptForm.nome, aceite_documento: acceptForm.documento || null,
        aceite_observacoes: acceptForm.obs || null, aceite_user_agent: navigator.userAgent,
        cenario_aceito_id: selectedCenario || null,
      }).eq("id", tokenId);

      // RB-47: Use proposal-public-action edge function instead of direct UPDATE
      if (token) {
        const { error: transitionErr } = await supabase.functions.invoke("proposal-public-action", {
          body: { token, action: "aceitar", user_agent: navigator.userAgent },
        });
        if (transitionErr) throw transitionErr;
      }
      setDecision("aceita");
    } catch { /* error handled by UI */ } finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!tokenId) return;
    setSubmitting(true);
    try {
      await (supabase as any).from("proposta_aceite_tokens").update({
        used_at: new Date().toISOString(), decisao: "recusada",
        recusa_motivo: rejectMotivo || null, recusa_at: new Date().toISOString(),
        aceite_user_agent: navigator.userAgent,
      }).eq("id", tokenId);

      // RB-47: Use proposal-public-action edge function instead of direct UPDATE
      if (token) {
        const { error: transitionErr } = await supabase.functions.invoke("proposal-public-action", {
          body: { token, action: "recusar", motivo: rejectMotivo || null, user_agent: navigator.userAgent },
        });
        if (transitionErr) throw transitionErr;
      }
      setDecision("recusada");
    } catch { /* error handled */ } finally { setSubmitting(false); setShowReject(false); }
  };

  const scrollToCTA = useCallback(() => {
    ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ─── Build template variables map from snapshot ───
  const templateVariables = useMemo(() => {
    if (!snapshot || !versaoData) return {};
    try {
    const s = snapshot;
    const raw = (s as any)?._raw || {};
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v !== null && v !== undefined) vars[k] = String(v);
    }

    // Recalculate valor_total from snapshot venda data as fallback
    // Must match calcPrecoFinal (wizard/types.ts) exactly:
    // custoBase = custoKit + custoServicos + custoComissao + custoOutros
    // custoParaMargem = custoKit + custoServicos + custoOutros (comissão não recebe markup)
    // precoFinal = (custoBase + margem) * (1 - desconto)
    const vendaSnap = (raw as any)?.venda;
    let snapshotValorTotal = 0;
    if (vendaSnap && typeof vendaSnap === "object") {
      const custoKit = Number(vendaSnap.custo_kit_override ?? 0) > 0
        ? Number(vendaSnap.custo_kit_override)
        : s.custoKit;
      // custo_instalacao maps to custoServicos in calcPrecoFinal
      const hasFCCosts = Number(vendaSnap.custo_instalacao ?? 0) > 0 || Number(vendaSnap.custo_comissao ?? 0) > 0 || Number(vendaSnap.custo_outros ?? 0) > 0;
      const custoServicos = hasFCCosts
        ? Number(vendaSnap.custo_instalacao ?? 0)
        : s.custoServicos ?? 0;
      const custoComissao = Number(vendaSnap.custo_comissao ?? 0);
      const custoOutros = Number(vendaSnap.custo_outros ?? 0);
      const margem = Number(vendaSnap.margem_percentual ?? 0);
      const desconto = Number(vendaSnap.desconto_percentual ?? 0);
      const custoBase = custoKit + custoServicos + custoComissao + custoOutros;
      const custoParaMargem = custoKit + custoServicos + custoOutros;
      const margemValor = custoParaMargem * (margem / 100);
      const precoComMargem = custoBase + margemValor;
      snapshotValorTotal = Math.round((precoComMargem - precoComMargem * (desconto / 100)) * 100) / 100;
    }

    // Use cenario > recalculated snapshot total > DB column > 0
    const bestValorTotal = activeCenario?.preco_final
      ?? (snapshotValorTotal > 0 ? snapshotValorTotal : null)
      ?? versaoData.valor_total
      ?? 0;

    vars["cliente_nome"] = s.clienteNome || "";
    vars["potencia_kwp"] = String(s.potenciaKwp || versaoData.potencia_kwp || 0);
    vars["valor_total"] = formatBRL(bestValorTotal);
    vars["economia_mensal"] = formatBRL(versaoData.economia_mensal ?? s.economiaMensal ?? 0);
    vars["economia_anual"] = formatBRL((versaoData.economia_mensal ?? s.economiaMensal ?? 0) * 12);
    vars["payback_meses"] = String(activeCenario?.payback_meses ?? versaoData.payback_meses ?? s.paybackMeses ?? 0);
    vars["consumo_mensal"] = String(s.consumoTotal || 0);
    vars["geracao_mensal"] = String(s.geracaoMensalEstimada || 0);
    vars["cidade"] = s.locCidade || "";
    vars["estado"] = s.locEstado || "";
    vars["empresa_nome"] = tenantNome || "";
    vars["consultor_nome"] = consultorNome || "";
    vars["consultor_telefone"] = consultorTelefone || "";
    const modulos = s.itens.filter(i => i.categoria === "modulo" || i.categoria === "modulos");
    const inversores = s.itens.filter(i => i.categoria === "inversor" || i.categoria === "inversores");
    if (modulos[0]) {
      vars["modulo_modelo"] = modulos[0].modelo || "";
      vars["modulo_fabricante"] = modulos[0].fabricante || "";
      vars["modulo_potencia_w"] = String(modulos[0].potencia_w || 0);
      vars["modulo_quantidade"] = String(modulos.reduce((a, m) => a + m.quantidade, 0));
    }
    if (inversores[0]) {
      vars["inversor_modelo"] = inversores[0].modelo || "";
      vars["inversor_fabricante"] = inversores[0].fabricante || "";
    }
    if (brand?.logo_url) vars["logo_url"] = brand.logo_url;
    if (brand?.logo_white_url) vars["logo_white_url"] = brand.logo_white_url;
    return vars;
    } catch (e) {
      console.error("[PropostaLanding] Erro ao construir variáveis do template:", e);
      return {};
    }
  }, [snapshot, versaoData, activeCenario, tenantNome, consultorNome, consultorTelefone, brand]);

  // ─── Shared section props (safe defaults) ───
  const sectionProps = useMemo(() => ({
    snapshot: snapshot!,
    versaoData: {
      valor_total: versaoData?.valor_total ?? 0,
      economia_mensal: versaoData?.economia_mensal ?? 0,
      payback_meses: versaoData?.payback_meses ?? 0,
      potencia_kwp: versaoData?.potencia_kwp ?? 0,
    },
    brand: brand ?? null,
    tenantNome: tenantNome ?? null,
    consultorNome: consultorNome ?? null,
    consultorTelefone: consultorTelefone ?? null,
  }), [snapshot, versaoData, brand, tenantNome, consultorNome, consultorTelefone]);

  // ─── Loading / Error / Done ───
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F0F4FA", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <Sun style={{ width: 48, height: 48, color: "#F07B24", animation: "pulse 2s infinite" }} />
      <Loader2 style={{ width: 24, height: 24, color: "#64748B", animation: "spin 1s linear infinite" }} />
      <p style={{ color: "#64748B", fontSize: 14 }}>Carregando proposta...</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#1B3A8C", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: "#fff" }}>
      <AlertTriangle style={{ width: 48, height: 48, color: "#F07B24" }} />
      <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "1.4rem" }}>Proposta não encontrada</h2>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{error}</p>
    </div>
  );

  if (decision) return (
    <div style={{ minHeight: "100vh", background: "#1B3A8C", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, color: "#fff", padding: 24 }}>
      {brand?.logo_white_url && <img src={brand.logo_white_url} alt="" style={{ height: 48, objectFit: "contain", opacity: 0.7 }} />}
      {decision === "aceita" ? (
        <>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(22,163,74,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 style={{ width: 40, height: 40, color: "#16A34A" }} />
          </div>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "1.6rem" }}>Proposta Aceita!</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", maxWidth: 400 }}>
            Obrigado! Sua aceitação foi registrada. A equipe comercial entrará em contato em breve.
          </p>
        </>
      ) : (
        <>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <XCircle style={{ width: 40, height: 40, color: "#ef4444" }} />
          </div>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "1.6rem" }}>Proposta Recusada</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", maxWidth: 400 }}>
            Sua resposta foi registrada. A equipe comercial será notificada.
          </p>
        </>
      )}
    </div>
  );

  if (!snapshot || !versaoData) return (
    <div style={{ minHeight: "100vh", background: "#1B3A8C", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
      <p>Dados da proposta não encontrados.</p>
    </div>
  );

  // ─── Regra de compatibilidade (revisada) ───
  // 1) Se houver template WEB vinculado → SSOT (editor = landing)
  // 2) Senão, se proposta é LEGADA migrada do SolarMarket → fallback hardcoded
  //    (preserva links públicos antigos, não quebra histórico)
  // 3) Senão (proposta nativa sem template WEB) → erro explícito,
  //    forçando seleção de modelo no editor.
  if (templateBlocks && templateBlocks.length > 0) {
    return (
      <div className="pl-landing" style={{ minHeight: "100vh" }}>
        <style>{LANDING_STYLES}</style>
        <TemplateHtmlRenderer blocks={templateBlocks} variables={templateVariables} />
      </div>
    );
  }

  if (!isLegacyMigrated) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F172A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: "center", fontFamily: "'Open Sans', sans-serif" }}>
          <AlertTriangle style={{ width: 48, height: 48, margin: "0 auto 16px", color: "#F59E0B" }} />
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "1.4rem", fontWeight: 800, margin: "0 0 12px" }}>
            Proposta indisponível
          </h1>
          <p style={{ fontSize: "0.95rem", opacity: 0.8, margin: "0 0 8px" }}>
            Esta proposta nativa ainda não tem um modelo WEB vinculado.
          </p>
          <p style={{ fontSize: "0.85rem", opacity: 0.6 }}>
            Selecione um modelo no editor (/admin/proposta-comercial?tab=modelos-proposta) e gere uma nova versão.
          </p>
        </div>
      </div>
    );
  }

  // ─── Fallback legado (somente propostas migradas do SolarMarket) ───
  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Open Sans', sans-serif", background: "#0F172A" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Open+Sans:wght@300;400;500;600&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
      `}</style>

      <ProposalHeroSection {...sectionProps} onScrollDown={scrollToCTA} activeCenario={activeCenario} />
      <ProposalProblemSection {...sectionProps} activeCenario={activeCenario} />
      <ProposalSolutionSection {...sectionProps} />
      <ProposalEquipmentSection {...sectionProps} />
      <TemplateInterativo {...sectionProps} />
      <ProposalFinancialSection {...sectionProps} activeCenario={activeCenario} />
      <ProposalAuthoritySection {...sectionProps} />
      <ProposalSecuritySection {...sectionProps} />
      <ProposalPaymentSection
        {...sectionProps}
        cenarios={cenarios}
        selectedCenario={selectedCenario}
        onSelectCenario={setSelectedCenario}
      />
      <div ref={ctaRef}>
        <ProposalCTASection
          {...sectionProps}
          acceptForm={acceptForm}
          onAcceptFormChange={setAcceptForm}
          onAccept={handleAccept}
          onReject={() => setShowReject(true)}
          submitting={submitting}
        />
      </div>

      <PropostaChatSection propostaData={templateVariables} />

      <footer style={{
        background: "#060A14", color: "rgba(255,255,255,0.3)", textAlign: "center",
        padding: "2rem 1.5rem", fontSize: "0.75rem",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        {brand?.logo_white_url && <img src={brand.logo_white_url} alt="" style={{ height: 32, objectFit: "contain", opacity: 0.3, marginBottom: 12 }} />}
        <p style={{ margin: 0, fontFamily: "'Open Sans', sans-serif" }}>
          © {new Date().getFullYear()} {tenantNome || "Energia Solar"} — Todos os direitos reservados
        </p>
      </footer>

      {showReject && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "90vw", maxWidth: 400 }}>
            <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#1B3A8C", fontSize: "1.1rem", margin: "0 0 12px" }}>
              Recusar Proposta
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: 12 }}>
              Por favor, nos conte o motivo para que possamos melhorar:
            </p>
            <textarea
              value={rejectMotivo}
              onChange={e => setRejectMotivo(e.target.value)}
              placeholder="Motivo da recusa..."
              rows={3}
              style={{
                width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px",
                fontSize: "0.85rem", outline: "none", resize: "none", fontFamily: "Open Sans, sans-serif",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowReject(false)}
                style={{
                  background: "transparent", border: "1px solid #e2e8f0", borderRadius: 8,
                  padding: "8px 16px", cursor: "pointer", fontSize: "0.85rem", color: "#64748B",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                style={{
                  background: "#ef4444", color: "#fff", border: "none", borderRadius: 8,
                  padding: "8px 16px", cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: "0.85rem", opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "Enviando..." : "Confirmar Recusa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

