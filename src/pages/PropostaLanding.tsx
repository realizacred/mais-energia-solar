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
import { formatBRL, formatNumberBR } from "@/lib/formatters";
import { getCanonicalProposalTotal } from "@/services/proposal/proposalTotals";
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
  const [clienteData, setClienteData] = useState<any>(null);
  const [tenantNome, setTenantNome] = useState<string | null>(null);
  const [consultorNome, setConsultorNome] = useState<string | null>(null);
  const [consultorTelefone, setConsultorTelefone] = useState<string | null>(null);
  const [templateBlocks, setTemplateBlocks] = useState<TemplateBlock[] | null>(null);
  const [isLegacyMigrated, setIsLegacyMigrated] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [acceptForm, setAcceptForm] = useState<AcceptFormData>({ nome: "", documento: "", obs: "" });
  const [propostaStatus, setPropostaStatus] = useState<string | null>(null);


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

      if (tdErr || !td) { setError("Esta proposta não está mais disponível. Entre em contato com nossa equipe."); setLoading(false); return; }
      if (td.invalidado_em) { setError("Esta proposta não está mais disponível. Entre em contato com nossa equipe."); setLoading(false); return; }
      if (td.used_at) { setDecision(td.decisao || "aceita"); setTokenId(td.id); setLoading(false); return; }
      if (new Date(td.expires_at) < new Date()) { setError("Esta proposta expirou. Entre em contato com nossa equipe."); setLoading(false); return; }

      setTokenId(td.id);
      setPropostaId(td.proposta_id);

      try {
        const sw = window.innerWidth || null;
        const deviceType = sw ? (sw < 768 ? "Mobile" : sw < 1024 ? "Tablet" : "Desktop") : null;
        // PostgREST resolve overload por args nomeados — passar TODOS os 6 evita 404
        await supabase.rpc("registrar_view_proposta" as any, {
          p_token: td.token,
          p_user_agent: navigator.userAgent,
          p_referrer: document.referrer || null,
          p_ip: null,
          p_device_type: deviceType,
          p_screen_width: sw,
        });
      } catch { /* best-effort: tracking nunca bloqueia abertura */ }

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
          .select("tenant_id, consultor_id, titulo, proposta_num, created_at, external_source, cliente_id, status")
          .eq("id", td.proposta_id).maybeSingle(),

      ]);

      if (versaoRes.data) {
        setVersaoData(versaoRes.data);
        setSnapshot(normalizeProposalSnapshot(versaoRes.data.snapshot as Record<string, unknown> | null));

        // Resolução determinística do template WEB via RPC SECURITY DEFINER
        // (anon não consegue ler proposta_templates por RLS — RB-02 exceção pública).
        // 1) tenta template_id_used (se html válido)
        // 2) fallback: default HTML do tenant
        // 3) erro explícito
        const templateId = (versaoRes.data as any).template_id_used;
        const tenantIdForTpl = (propostaRes as any)?.data?.tenant_id ?? null;
        let webUsable = false;
        try {
          const { data: tplRows } = await (supabase as any).rpc(
            "get_proposal_template_for_landing",
            { _template_id: templateId ?? null, _tenant_id: tenantIdForTpl }
          );
          const tpl = Array.isArray(tplRows) ? tplRows[0] : tplRows;
          const tplHtml = tpl?.template_html;
          if (tplHtml) {
            const parsed = typeof tplHtml === "string" ? JSON.parse(tplHtml) : tplHtml;
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTemplateBlocks(parsed);
              webUsable = true;
            }
          }
        } catch (e) {
          console.error("[PropostaLanding] RPC get_proposal_template_for_landing falhou:", e);
        }

        if (!webUsable) {
          setError("Modelo web não configurado. Defina um template WEB padrão na área de Modelos de Proposta.");
          setLoading(false);
          return;
        }
      }

      const loadedCenarios = cenariosRes.data ?? [];
      setCenarios(loadedCenarios);
      const defaultC = loadedCenarios.find((c: CenarioData) => c.is_default) ?? loadedCenarios[0];
      if (defaultC) setSelectedCenario(defaultC.id);

      if (propostaRes.data?.tenant_id) {
        setPropostaStatus(propostaRes.data.status);

        const tenantId = propostaRes.data.tenant_id;
        const src = (propostaRes.data as any).external_source;
        setIsLegacyMigrated(src === "solarmarket" || src === "solar_market");
        const [brandRes, tenantRes, consultorRes, clienteRes] = await Promise.all([
          (supabase as any).rpc("get_public_brand_settings", { _tenant_id: tenantId }),
          supabase.from("tenants").select("nome").eq("id", tenantId).maybeSingle(),
          propostaRes.data.consultor_id
            ? (supabase as any).from("consultores").select("nome, telefone").eq("id", propostaRes.data.consultor_id).maybeSingle()
            : Promise.resolve({ data: null }),
          propostaRes.data.cliente_id
            ? supabase.from("clientes").select("nome, cidade, estado").eq("id", propostaRes.data.cliente_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        const brandRow = Array.isArray(brandRes.data) ? brandRes.data[0] : brandRes.data;
        if (brandRow) setBrand(brandRow as any);
        if (tenantRes.data) setTenantNome(tenantRes.data.nome);
        if (clienteRes.data) setClienteData(clienteRes.data);
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
      // RB-47: aceite vai TODO pela edge (sem UPDATE anon direto)
      if (token) {
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
      }
      setDecision("aceita");
    } catch { /* error handled by UI */ } finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!tokenId) return;
    setSubmitting(true);
    try {
      // RB-47: recusa vai TODA pela edge (sem UPDATE anon direto)
      if (token) {
        const { error: transitionErr } = await supabase.functions.invoke("proposal-public-action", {
          body: {
            token,
            action: "recusar",
            motivo: rejectMotivo || null,
            user_agent: navigator.userAgent,
          },
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
      
      // Mapeamento inicial de campos brutos
      for (const [k, v] of Object.entries(raw)) {
        if (v !== null && v !== undefined) vars[k] = String(v);
      }

      // SSOT: total canônico recomposto via getCanonicalProposalTotal
      const snapshotValorTotal = getCanonicalProposalTotal({
        valor_total: versaoData.valor_total,
        snapshot: raw,
      });

      // Use cenario > canonical total > DB column > 0
      const bestValorTotal = activeCenario?.preco_final
        ?? (snapshotValorTotal > 0 ? snapshotValorTotal : null)
        ?? versaoData.valor_total
        ?? 0;

      const economiaMensalNum = Number(versaoData.economia_mensal ?? s.economiaMensal ?? 0);
      const eco25Num = economiaMensalNum * 12 * 25;

      // ─── Variáveis Principais (Sem R$ para evitar duplicação) ───
      vars["valor_total"] = formatNumberBR(bestValorTotal);
      vars["economia_mensal"] = formatNumberBR(economiaMensalNum);
      vars["economia_anual"] = formatNumberBR(economiaMensalNum * 12);
      vars["economia_25_anos"] = formatNumberBR(eco25Num);
      vars["lucro_25_anos"] = formatNumberBR(eco25Num);
      vars["roi_25_anos"] = formatNumberBR(eco25Num);

      // ─── Variantes com R$ (para templates que não têm o prefixo no HTML) ───
      vars["valor_total_rs"] = formatBRL(bestValorTotal);
      vars["economia_mensal_rs"] = formatBRL(economiaMensalNum);
      vars["economia_anual_rs"] = formatBRL(economiaMensalNum * 12);
      vars["economia_25_anos_rs"] = formatBRL(eco25Num);

      // ─── Identificação e Localização ───
      vars["cliente_nome"] = s.clienteNome || clienteData?.nome || "";
      vars["cliente_cidade"] = s.locCidade || clienteData?.cidade || "";
      vars["cliente_estado"] = s.locEstado || clienteData?.estado || "";
      vars["cidade"] = vars["cliente_cidade"]; // Alias
      vars["estado"] = vars["cliente_estado"]; // Alias

      vars["empresa_nome"] = tenantNome || "";
      vars["consultor_nome"] = consultorNome || "";
      vars["consultor_telefone"] = consultorTelefone || "";

      // ─── Payback Aliases ───
      const pbMeses = Number(activeCenario?.payback_meses ?? versaoData.payback_meses ?? s.paybackMeses ?? 0);
      vars["payback_meses"] = String(pbMeses);
      vars["payback"] = String(pbMeses); // Alias comum em templates
      vars["payback_anos"] = String(Math.floor(pbMeses / 12));

      // ─── Técnica e Fallbacks de Coluna Viva ───
      vars["potencia_kwp"] = String(s.potenciaKwp || versaoData.potencia_kwp || 0);
      vars["consumo_mensal"] = String(s.consumoTotal || 0);
      vars["geracao_mensal"] = String(s.geracaoMensalEstimada || versaoData.geracao_mensal || 0);

      // ─── Equipamentos ───
      const modulos = s.itens.filter(i => i.categoria === "modulo" || i.categoria === "modulos");
      const inversores = s.itens.filter(i => i.categoria === "inversor" || i.categoria === "inversores");
      
      if (modulos[0]) {
        vars["modulo_modelo"] = modulos[0].modelo || "";
        vars["modulo_fabricante"] = modulos[0].fabricante || "";
        vars["modulo_potencia_w"] = String(modulos[0].potencia_w || 0);
        vars["modulo_potencia"] = vars["modulo_potencia_w"]; // Alias
        vars["modulo_quantidade"] = String(modulos.reduce((a, m) => a + m.quantidade, 0));
      }
      if (inversores[0]) {
        vars["inversor_modelo"] = inversores[0].modelo || "";
        vars["inversor_fabricante"] = inversores[0].fabricante || "";
        vars["inversor_garantia"] = String(inversores[0].garantia_anos || "");
      }

      // ─── Branding ───
      if (brand?.logo_url) vars["logo_url"] = brand.logo_url;
      if (brand?.logo_white_url) vars["logo_white_url"] = brand.logo_white_url;

      return vars;
    } catch (e) {
      console.error("[PropostaLanding] Erro ao construir variáveis do template:", e);
      return {};
    }
  }, [snapshot, versaoData, activeCenario, tenantNome, consultorNome, consultorTelefone, brand, clienteData]);

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
        <div ref={ctaRef} style={{ width: "100%" }}>
          {(propostaStatus === "vista" || propostaStatus === "viewed") && (
            <ProposalCTASection
              {...sectionProps}
              acceptForm={acceptForm}
              onAcceptFormChange={setAcceptForm}
              onAccept={handleAccept}
              onReject={() => setShowReject(true)}
              submitting={submitting}
            />
          )}
        </div>
      </div>
    );

  }

  if (!isLegacyMigrated) {
    // Log técnico apenas em console (admin/devtools), nunca exposto ao cliente final
    console.error("[PropostaLanding] Proposta nativa sem template WEB vinculado", { propostaId, tokenId });
    return (
      <div style={{ minHeight: "100vh", background: "#0F172A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: "center", fontFamily: "'Open Sans', sans-serif" }}>
          <AlertTriangle style={{ width: 48, height: 48, margin: "0 auto 16px", color: "#F59E0B" }} />
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "1.4rem", fontWeight: 800, margin: "0 0 12px" }}>
            Proposta temporariamente indisponível
          </h1>
          <p style={{ fontSize: "0.95rem", opacity: 0.8, margin: "0 0 8px" }}>
            Entre em contato com nossa equipe para receber o atendimento comercial.
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
        {(propostaStatus === "vista" || propostaStatus === "viewed") && (
          <ProposalCTASection
            {...sectionProps}
            acceptForm={acceptForm}
            onAcceptFormChange={setAcceptForm}
            onAccept={handleAccept}
            onReject={() => setShowReject(true)}
            submitting={submitting}
          />
        )}
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

