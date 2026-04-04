/**
 * PropostaLanding.tsx
 *
 * Landing page de alta conversão para propostas comerciais.
 * Rota: /pl/:token
 *
 * Página pública — sem AuthGuard (exceção RB-02 documentada).
 * Paleta própria (não usa design system do admin).
 * RB-17: sem console.log ativo.
 * RB-16: tarifas sem formatter.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import { TemplateHtmlRenderer } from "@/components/proposal-landing/TemplateHtmlRenderer";
import type { TemplateBlock } from "@/components/admin/proposal-builder/types";
import {
  normalizeProposalSnapshot,
  type NormalizedProposalSnapshot,
  type NormalizedKitItem,
} from "@/domain/proposal/normalizeProposalSnapshot";
import {
  Sun, Zap, TrendingUp, MapPin, Building2, Bolt,
  Wrench, Truck, Shield, Wifi, ClipboardCheck, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Phone, ArrowRight,
  BarChart3, Calendar, CreditCard, Banknote, TreePine,
  Activity, Clock, Factory, FileText, Users,
} from "lucide-react";
import { PropostaChatSection } from "@/components/proposal-landing/PropostaChatSection";
import { getLandingThemeCSS, parseModelo } from "@/components/proposal-landing/themes/landingThemes";
import { LandingThemeSwitcher } from "@/components/proposal-landing/themes/LandingThemeSwitcher";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CSS is now loaded from themes/landingThemes.ts
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Types
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface BrandData {
  logo_url: string | null;
  logo_white_url: string | null;
}

interface CenarioData {
  id: string; ordem: number; nome: string; tipo: string; is_default: boolean;
  preco_final: number; entrada_valor: number; num_parcelas: number;
  valor_parcela: number; taxa_juros_mensal: number; payback_meses: number;
  tir_anual: number; roi_25_anos: number; economia_primeiro_ano: number;
}

const TABS = ["Capa", "Empresa", "Sistema", "Equip.", "Financeiro", "Geração", "Cronograma", "Pagamento"] as const;

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

  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [acceptForm, setAcceptForm] = useState({ nome: "", documento: "", obs: "" });

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // ─── Data loading (reuse existing logic) ───
  useEffect(() => {
    if (token) loadData();
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: td, error: tdErr } = await (supabase as any)
        .from("proposta_aceite_tokens")
        .select("id, token, proposta_id, versao_id, expires_at, used_at, aceite_nome, decisao, invalidado_em, tipo")
        .eq("token", token!)
        .maybeSingle();

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
          .select("tenant_id, consultor_id, titulo, proposta_num, created_at")
          .eq("id", td.proposta_id).maybeSingle(),
      ]);

      if (versaoRes.data) {
        setVersaoData(versaoRes.data);
        setSnapshot(normalizeProposalSnapshot(versaoRes.data.snapshot as Record<string, unknown> | null));

        // Fetch template HTML from Visual Editor if linked
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
          } catch {
            // fallback to hardcoded layout
          }
        }
      }

      const loadedCenarios = cenariosRes.data ?? [];
      setCenarios(loadedCenarios);
      const defaultC = loadedCenarios.find((c: CenarioData) => c.is_default) ?? loadedCenarios[0];
      if (defaultC) setSelectedCenario(defaultC.id);

      if (propostaRes.data?.tenant_id) {
        const tenantId = propostaRes.data.tenant_id;
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

      if (propostaId) {
        await supabase.from("propostas_nativas")
          .update({ status: "aceita", aceita_at: new Date().toISOString() })
          .eq("id", propostaId);
        supabase.functions.invoke("proposal-decision-notify", {
          body: { token_id: tokenId, decisao: "aceita" },
        }).catch(() => {});
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

      if (propostaId) {
        await supabase.from("propostas_nativas")
          .update({ status: "recusada", recusada_at: new Date().toISOString(), recusa_motivo: rejectMotivo || null })
          .eq("id", propostaId);
        supabase.functions.invoke("proposal-decision-notify", {
          body: { token_id: tokenId, decisao: "recusada" },
        }).catch(() => {});
      }
      setDecision("recusada");
    } catch { /* error handled */ } finally { setSubmitting(false); setShowReject(false); }
  };

  const scrollToSection = useCallback((idx: number) => {
    setActiveTab(idx);
    sectionRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ─── Build template variables map from snapshot (must be before early returns) ───
  const templateVariables = useMemo(() => {
    if (!snapshot || !versaoData) return {};
    const s = snapshot;
    const raw = s._raw || {};
    const vars: Record<string, string> = {};

    // Flatten raw snapshot keys
    for (const [k, v] of Object.entries(raw)) {
      if (v !== null && v !== undefined) {
        vars[k] = String(v);
      }
    }

    // Standard proposal variables
    vars["cliente_nome"] = s.clienteNome || "";
    vars["cliente.nome"] = s.clienteNome || "";
    vars["potencia_kwp"] = String(s.potenciaKwp || versaoData.potencia_kwp || 0);
    vars["sistema.potencia_kwp"] = vars["potencia_kwp"];
    vars["valor_total"] = formatBRL(activeCenario?.preco_final ?? versaoData.valor_total ?? 0);
    vars["financeiro.valor_total"] = vars["valor_total"];
    vars["economia_mensal"] = formatBRL(versaoData.economia_mensal ?? s.economiaMensal ?? 0);
    vars["financeiro.economia_mensal"] = vars["economia_mensal"];
    vars["payback_meses"] = String(activeCenario?.payback_meses ?? versaoData.payback_meses ?? s.paybackMeses ?? 0);
    vars["financeiro.payback_meses"] = vars["payback_meses"];
    vars["consumo_mensal"] = String(s.consumoTotal || 0);
    vars["sistema.consumo_mensal"] = vars["consumo_mensal"];
    vars["geracao_mensal"] = String(s.geracaoMensalEstimada || 0);
    vars["sistema.geracao_mensal"] = vars["geracao_mensal"];
    vars["cidade"] = s.locCidade || "";
    vars["cliente.cidade"] = vars["cidade"];
    vars["estado"] = s.locEstado || "";
    vars["cliente.estado"] = vars["estado"];
    vars["empresa_nome"] = tenantNome || "";
    vars["empresa.nome"] = vars["empresa_nome"];
    vars["consultor_nome"] = consultorNome || "";
    vars["consultor.nome"] = vars["consultor_nome"];
    vars["consultor_telefone"] = consultorTelefone || "";
    vars["consultor.telefone"] = vars["consultor_telefone"];
    vars["tipo_telhado"] = String(raw.locTipoTelhado ?? raw.loc_tipo_telhado ?? s.locTipoTelhado ?? "");
    vars["sistema.tipo_telhado"] = vars["tipo_telhado"];

    // Module/inverter info
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
      vars["inversor_potencia_w"] = String(inversores[0].potencia_w || 0);
      vars["inversor_quantidade"] = String(inversores.reduce((a, m) => a + m.quantidade, 0));
    }

    // Tarifa
    if (s.ucs[0]?.tarifa_distribuidora) {
      vars["tarifa"] = String(s.ucs[0].tarifa_distribuidora);
    }

    // Logo
    if (brand?.logo_url) vars["logo_url"] = brand.logo_url;
    if (brand?.logo_white_url) vars["logo_white_url"] = brand.logo_white_url;

    return vars;
  }, [snapshot, versaoData, activeCenario, tenantNome, consultorNome, consultorTelefone, brand]);

  // ─── Loading / Error / Done ───
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--fundo, #F0F4FA)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <style>{LANDING_STYLES}</style>
      <Sun style={{ width: 48, height: 48, color: "var(--la, #F07B24)", animation: "pulse 2s infinite" }} />
      <Loader2 style={{ width: 24, height: 24, color: "var(--cinza, #64748B)", animation: "spin 1s linear infinite" }} />
      <p style={{ color: "var(--cinza, #64748B)", fontSize: 14 }}>Carregando proposta...</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "var(--nav-bg, #1B3A8C)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: "var(--hero-text, #fff)" }}>
      <style>{LANDING_STYLES}</style>
      <AlertTriangle style={{ width: 48, height: 48, color: "var(--la, #F07B24)" }} />
      <h2 style={{ fontFamily: "var(--font-heading, Montserrat, sans-serif)", fontWeight: 800, fontSize: "1.4rem" }}>Proposta não encontrada</h2>
      <p style={{ color: "var(--hero-muted, rgba(255,255,255,0.6))", fontSize: 14 }}>{error}</p>
    </div>
  );

  if (decision) return (
    <div style={{ minHeight: "100vh", background: "var(--nav-bg, #1B3A8C)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, color: "var(--hero-text, #fff)", padding: 24 }}>
      <style>{LANDING_STYLES}</style>
      {brand?.logo_white_url && <img src={brand.logo_white_url} alt="" style={{ height: 48, objectFit: "contain", opacity: 0.7 }} />}
      {decision === "aceita" ? (
        <>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(22,163,74,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 style={{ width: 40, height: 40, color: "#16A34A" }} />
          </div>
          <h2 style={{ fontFamily: "var(--font-heading, Montserrat, sans-serif)", fontWeight: 800, fontSize: "1.6rem" }}>Proposta Aceita!</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", maxWidth: 400 }}>
            Obrigado! Sua aceitação foi registrada. A equipe comercial entrará em contato em breve.
          </p>
        </>
      ) : (
        <>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <XCircle style={{ width: 40, height: 40, color: "#ef4444" }} />
          </div>
          <h2 style={{ fontFamily: "var(--font-heading, Montserrat, sans-serif)", fontWeight: 800, fontSize: "1.6rem" }}>Proposta Recusada</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", maxWidth: 400 }}>
            Sua resposta foi registrada. A equipe comercial será notificada.
          </p>
        </>
      )}
    </div>
  );

  if (!snapshot || !versaoData) return (
    <div style={{ minHeight: "100vh", background: "var(--nav-bg, #1B3A8C)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--hero-text, #fff)" }}>
      <style>{LANDING_STYLES}</style>
      <p>Dados da proposta não encontrados.</p>
    </div>
  );

  // ─── If Visual Editor template exists, render it ───
  if (templateBlocks && templateBlocks.length > 0) {
    return (
      <div className="pl-landing" style={{ minHeight: "100vh" }}>
        <style>{LANDING_STYLES}</style>
        <TemplateHtmlRenderer blocks={templateBlocks} variables={templateVariables} />
      </div>
    );
  }

  // ─── Computed values (fallback hardcoded layout) ───
  const s = snapshot;
  const raw = s._raw || {};
  const wizardState = (raw._wizard_state || raw.wizardState || {}) as Record<string, any>;
  const rawInputs = (raw.inputs || {}) as Record<string, any>;
  const rawUc0 = (Array.isArray(raw.ucs) ? raw.ucs[0] : null) || {} as Record<string, any>;
  const rawLead = (raw.selectedLead || {}) as Record<string, any>;

  const valorTotal = activeCenario?.preco_final ?? versaoData.valor_total ?? 0;
  const economiaMensal = versaoData.economia_mensal ?? s.economiaMensal ?? 0;
  const paybackMeses = activeCenario?.payback_meses ?? versaoData.payback_meses ?? s.paybackMeses ?? 0;

  // ─── Capa fallbacks (Correção 2) ───
  const clienteNomeFinal = s.clienteNome
    || rawLead.nome || rawInputs.cliente_nome || wizardState.clienteNome
    || (raw.cliente_nome as string) || "—";

  const cidadeFinal = s.locCidade
    || rawLead.cidade || rawInputs.cidade || rawUc0.cidade
    || (raw.cidade as string) || (raw.loc_cidade as string) || "";

  const estadoFinal = s.locEstado
    || rawLead.estado || rawInputs.estado || rawUc0.estado
    || (raw.estado as string) || (raw.loc_estado as string) || "";

  const concessionariaFinal = s.locDistribuidoraNome
    || (raw.dis_energia as string) || (raw.concessionaria as string)
    || rawUc0.distribuidora || rawUc0.dis_energia || rawUc0.concessionaria_nome || "—";

  const estruturaFinal = s.locTipoTelhado
    || (raw.tipo_telhado as string) || rawUc0.tipo_telhado || rawInputs.tipo_telhado || "—";

  const tensaoRede = String(raw.tensaoRede ?? raw.tensao_rede ?? rawUc0.fase ?? rawInputs.tensao_rede ?? "220V");

  const grupoFinal = s.grupo
    || (raw.subgrupo as string) || rawUc0.subgrupo || (raw.grupo_tarifario as string) || "B";

  // ─── Geração fallback (Correção 1) ───
  // Irradiação média por mês (padrão Brasil Central)
  const IRRAD_MEDIA_MES = [5.4, 5.1, 4.8, 4.4, 4.1, 3.9, 4.2, 4.7, 5.0, 5.2, 5.3, 5.5];
  const potKwp = s.potenciaKwp || versaoData.potencia_kwp || 0;
  const geracaoBase = s.geracaoMensalEstimada > 0
    ? s.geracaoMensalEstimada
    : (potKwp > 0 ? Math.round(potKwp * 4.5 * 30 * 0.8) : 0);
  const geracaoAnual = geracaoBase * 12;
  const economiaAnual = economiaMensal * 12;
  const aumento = s.consumoTotal > 0 ? ((geracaoBase / s.consumoTotal) * 100) : 0;

  const modulos = s.itens.filter(i => i.categoria === "modulo" || i.categoria === "modulos");
  const inversores = s.itens.filter(i => i.categoria === "inversor" || i.categoria === "inversores");
  const outrosItens = s.itens.filter(i => !["modulo", "modulos", "inversor", "inversores"].includes(i.categoria));

  const arvoresEq = Math.round(geracaoAnual / 20);

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // Geração mensal: usar irradiação por mês se tiver potência, senão fatores proporcionais
  const geracaoMensal = meses.map((_, i) => {
    // Tentar pegar do snapshot
    const snapKey = `geracao_${meses[i].toLowerCase()}`;
    const snapVal = raw[snapKey] ?? (Array.isArray(raw.geracao_mensal_kwh) ? (raw.geracao_mensal_kwh as number[])[i] : null);
    if (snapVal && Number(snapVal) > 0) return Math.round(Number(snapVal));
    // Fallback: calcular pela irradiação mensal
    if (potKwp > 0) {
      return Math.round(potKwp * IRRAD_MEDIA_MES[i] * 30 * 0.8);
    }
    return 0;
  });
  const maxGeracao = Math.max(...geracaoMensal, 1);
  const fatoresMensais = [1.1, 1.05, 1.0, 0.9, 0.8, 0.75, 0.78, 0.88, 0.95, 1.05, 1.1, 1.15];
  const somaFatores = fatoresMensais.reduce((a, b) => a + b, 0);

  const tarifa = s.ucs[0]?.tarifa_distribuidora ?? 0;

  const roiTable = Array.from({ length: 10 }, (_, i) => {
    const ano = i + 1;
    const eco = economiaAnual * Math.pow(1.06, i);
    const acumulado = Array.from({ length: ano }, (_, j) => economiaAnual * Math.pow(1.06, j)).reduce((a, b) => a + b, 0) - valorTotal;
    return { ano, economia: eco, acumulado };
  });

  return (
    <div className="pl-landing" style={{ minHeight: "100vh" }}>
      <style>{LANDING_STYLES}</style>

      {/* ━━━ NAV ━━━ */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--nav-bg)", borderBottom: "3px solid var(--nav-border)",
        display: "flex", alignItems: "center", gap: 8,
        padding: "0 16px", height: 56, overflowX: "auto",
      }}>
        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, color: "#fff", fontSize: "1rem", whiteSpace: "nowrap", marginRight: 16 }}>
          {brand?.logo_white_url ? (
            <img src={brand.logo_white_url} alt={tenantNome || ""} style={{ height: 32, objectFit: "contain" }} />
          ) : (
            <span>MA<span style={{ color: "var(--la)" }}>+</span>S SOLAR</span>
          )}
        </div>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => scrollToSection(i)}
            style={{
              background: activeTab === i ? "var(--la)" : "transparent",
              color: activeTab === i ? "#fff" : "rgba(255,255,255,0.7)",
              border: activeTab === i ? "none" : "1px solid rgba(255,255,255,0.2)",
              borderRadius: 6, padding: "6px 14px", fontSize: "0.75rem",
              fontFamily: "Montserrat, sans-serif", fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* ━━━ SEÇÃO 0: CAPA ━━━ */}
      <section ref={el => { sectionRefs.current[0] = el; }} style={{
        background: "var(--hero-bg)",
        color: "var(--hero-text, #fff)", padding: "3rem 1.5rem 2rem", minHeight: "90vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          background: "var(--la)", color: "#fff", padding: "4px 16px", borderRadius: 20,
          fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.7rem",
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 24,
        }}>
          PROPOSTA COMERCIAL
        </div>

        <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: "1.8rem", textAlign: "center", margin: 0, lineHeight: 1.2 }}>
          SISTEMA <span style={{ color: "var(--la)" }}>FOTOVOLTAICO</span>
        </h1>

        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginTop: 8 }}>
          Proposta • {new Date().toLocaleDateString("pt-BR")}
        </p>

        {/* Box potência */}
        <div style={{
          background: "linear-gradient(135deg, var(--la), var(--la2))",
          borderRadius: 16, padding: "1.5rem 2.5rem", margin: "2rem 0",
          textAlign: "center",
        }}>
          <p style={{ fontSize: "2rem", fontFamily: "Montserrat, sans-serif", fontWeight: 900, margin: 0 }}>
            {s.potenciaKwp.toFixed(2)} kWp
          </p>
          <p style={{ fontSize: "0.75rem", opacity: 0.85, marginTop: 4 }}>Potência do Sistema</p>
        </div>

        {/* Grid info 2 cols */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 600 }}>
          {[
            { label: "Cliente", value: clienteNomeFinal },
            { label: "Cidade", value: cidadeFinal && estadoFinal ? `${cidadeFinal}/${estadoFinal}` : cidadeFinal || estadoFinal || "—" },
            { label: "Concessionária", value: concessionariaFinal },
            { label: "Grupo Tarifário", value: grupoFinal },
            { label: "Estrutura", value: estruturaFinal },
            { label: "Tensão", value: tensaoRede },
          ].map(item => (
            <div key={item.label} style={{
              background: "var(--hero-overlay)", border: "1px solid var(--hero-overlay-border)",
              borderRadius: 10, padding: "10px 14px",
            }}>
              <p style={{ fontSize: "0.65rem", color: "var(--hero-muted)", textTransform: "uppercase", margin: 0 }}>{item.label}</p>
              <p style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.85rem", margin: "4px 0 0" }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Grid 4 cols métricas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, width: "100%", maxWidth: 600, marginTop: 20 }}>
          {[
            { label: "Consumo", value: `${s.consumoTotal} kWh` },
            { label: "Geração", value: `${geracaoBase} kWh` },
            { label: "Aumento", value: `${aumento.toFixed(0)}%` },
            { label: "Área", value: `${s.areaUtil.toFixed(1)} m²` },
          ].map(item => (
            <div key={item.label} style={{
              background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 8px", textAlign: "center",
            }}>
              <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", margin: 0 }}>{item.label}</p>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "var(--la)", margin: "4px 0 0" }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Responsável comercial */}
        {consultorNome && (
          <div style={{
            marginTop: 32, padding: "10px 20px", background: "rgba(255,255,255,0.06)",
            borderRadius: 8, display: "flex", alignItems: "center", gap: 10,
          }}>
            <Users style={{ width: 18, height: 18, color: "var(--la)" }} />
            <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)" }}>Responsável: <strong style={{ color: "#fff" }}>{consultorNome}</strong></span>
          </div>
        )}

        {/* Sumário */}
        <div style={{ marginTop: 40, width: "100%", maxWidth: 500 }}>
          <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Sumário</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {TABS.map((tab, i) => (
              <button key={tab} onClick={() => scrollToSection(i)} style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer", transition: "all 0.2s", color: "rgba(255,255,255,0.7)", fontSize: "0.8rem",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--la)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: "50%", background: "var(--az2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
                }}>{i + 1}</span>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>

        {/* ━━━ SEÇÃO 1: EMPRESA ━━━ */}
        <section ref={el => { sectionRefs.current[1] = el; }} style={{ marginBottom: 32 }}>
          <div className="section-header">
            <div className="icon-circle"><Building2 style={{ width: 20, height: 20, color: "#fff" }} /></div>
            <h2>Quem Somos</h2>
          </div>
          <div className="card-body">
            <div style={{ textAlign: "center", padding: "1rem 0 1.5rem" }}>
              {brand?.logo_url && <img src={brand.logo_url} alt={tenantNome || ""} style={{ height: 60, objectFit: "contain", marginBottom: 16 }} />}
              <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "var(--az)", fontSize: "1.2rem", margin: 0 }}>
                {tenantNome || "Empresa Solar"}
              </h3>
              <p style={{ color: "var(--cinza)", fontSize: "0.85rem", marginTop: 8, maxWidth: 500, margin: "8px auto 0" }}>
                Empresa especializada em soluções de energia solar fotovoltaica, oferecendo projetos personalizados com equipamentos de alta qualidade e suporte completo.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { emoji: "🏆", title: "EXPERIÊNCIA", desc: "Anos de expertise em projetos fotovoltaicos residenciais e comerciais" },
                { emoji: "⚡", title: "QUALIDADE", desc: "Equipamentos de primeira linha com certificação e garantia de fábrica" },
                { emoji: "🛡️", title: "GARANTIA", desc: "Garantia completa sobre equipamentos e serviço de instalação" },
                { emoji: "📞", title: "SUPORTE", desc: "Suporte técnico dedicado e monitoramento remoto do sistema" },
              ].map(card => (
                <div key={card.title} style={{
                  background: "rgba(27,58,140,0.04)", border: "1px solid rgba(27,58,140,0.1)",
                  borderRadius: 10, padding: "1rem", textAlign: "center",
                }}>
                  <span style={{ fontSize: "1.8rem", display: "block", marginBottom: 8 }}>{card.emoji}</span>
                  <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "var(--az)", fontSize: "0.8rem", margin: "0 0 4px", letterSpacing: "0.05em" }}>{card.title}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--cinza)", margin: 0, lineHeight: 1.4 }}>{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━ SEÇÃO 2: SISTEMA ━━━ */}
        <section ref={el => { sectionRefs.current[2] = el; }} style={{ marginBottom: 32 }}>
          <div className="section-header">
            <div className="icon-circle"><Sun style={{ width: 20, height: 20, color: "#fff" }} /></div>
            <h2>Sistema Fotovoltaico</h2>
          </div>
          <div className="card-body">
            {/* Box destaque potência */}
            <div style={{
              background: "var(--az)", color: "#fff", borderRadius: 12, padding: "1.5rem",
              textAlign: "center", marginBottom: 20,
            }}>
              <p style={{ fontSize: "2rem", fontFamily: "Montserrat, sans-serif", fontWeight: 900, margin: 0 }}>
                {s.potenciaKwp.toFixed(2)} <span style={{ fontSize: "1rem", fontWeight: 600 }}>kWp</span>
              </p>
              <p style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: 4 }}>Potência Instalada</p>
            </div>

            <div className="info-grid">
              <div className="info-box">
                <p className="info-label">Consumo Médio</p>
                <p className="info-value">{s.consumoTotal} kWh/mês</p>
              </div>
              <div className="info-box">
                <p className="info-label">Geração Prevista</p>
                <p className="info-value">{geracaoBase} kWh/mês</p>
              </div>
              <div className="info-box">
                <p className="info-label">Aumento</p>
                <p className="info-value" style={{ color: "var(--verde)" }}>{aumento.toFixed(0)}%</p>
              </div>
              <div className="info-box">
                <p className="info-label">Área Útil</p>
                <p className="info-value">{s.areaUtil.toFixed(1)} m²</p>
              </div>
            </div>

            {/* Dimensionamento card */}
            <div style={{
              background: "var(--fundo)", borderRadius: 10, padding: "1.25rem", marginTop: 20,
              border: "1px solid #e2e8f0",
            }}>
              <h4 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "var(--az)", fontSize: "0.9rem", margin: "0 0 12px" }}>
                Como dimensionamos sua proposta
              </h4>
              <ol style={{ paddingLeft: 20, color: "var(--cinza)", fontSize: "0.82rem", lineHeight: 1.8, margin: 0 }}>
                <li>Analisamos seu consumo médio de <strong style={{ color: "var(--az)" }}>{s.consumoTotal} kWh/mês</strong></li>
                <li>Verificamos a irradiação solar em <strong style={{ color: "var(--az)" }}>{s.locCidade}/{s.locEstado}</strong></li>
                <li>Calculamos o sistema ideal de <strong style={{ color: "var(--la)" }}>{s.potenciaKwp.toFixed(2)} kWp</strong></li>
                <li>Estimamos geração de <strong style={{ color: "var(--verde)" }}>{geracaoBase} kWh/mês</strong></li>
              </ol>
            </div>
          </div>
        </section>

        {/* ━━━ SEÇÃO 3: EQUIPAMENTOS ━━━ */}
        <section ref={el => { sectionRefs.current[3] = el; }} style={{ marginBottom: 32 }}>
          <div className="section-header">
            <div className="icon-circle"><Wrench style={{ width: 20, height: 20, color: "#fff" }} /></div>
            <h2>Equipamentos</h2>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {s.itens.map((item, idx) => (
              <div key={item.id} style={{
                border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden",
              }}>
                <div style={{
                  background: "var(--az)", color: "#fff", padding: "10px 16px",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%", background: "var(--la)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0,
                  }}>{idx + 1}</span>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.85rem" }}>
                    {item.categoria === "modulo" || item.categoria === "modulos" ? "Módulo Fotovoltaico" :
                     item.categoria === "inversor" || item.categoria === "inversores" ? "Inversor Solar" :
                     item.descricao || item.categoria}
                  </span>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  {[
                    { label: "Fabricante", value: item.fabricante },
                    { label: "Modelo", value: item.modelo },
                    { label: "Potência", value: item.potencia_w > 0 ? `${item.potencia_w}W` : "—" },
                    { label: "Quantidade", value: String(item.quantidade) },
                  ].filter(row => row.value && row.value !== "—" && row.value !== "0W").map(row => (
                    <div key={row.label} style={{
                      display: "flex", justifyContent: "space-between", padding: "6px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}>
                      <span style={{ color: "var(--cinza)", fontSize: "0.8rem" }}>{row.label}</span>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "var(--az)", fontSize: "0.85rem" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Inclusos */}
            {s.servicos.filter(sv => sv.incluso_no_preco).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "var(--verde)", fontSize: "0.85rem", margin: "0 0 8px" }}>
                  ✓ Inclusos na proposta:
                </p>
                {s.servicos.filter(sv => sv.incluso_no_preco).map(sv => (
                  <p key={sv.id} style={{ color: "var(--verde)", fontSize: "0.8rem", margin: "4px 0", paddingLeft: 16 }}>
                    • {sv.descricao}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ━━━ SEÇÃO 4: FINANCEIRO ━━━ */}
        <section ref={el => { sectionRefs.current[4] = el; }} style={{ marginBottom: 32 }}>
          <div className="section-header">
            <div className="icon-circle"><BarChart3 style={{ width: 20, height: 20, color: "#fff" }} /></div>
            <h2>Análise Financeira</h2>
          </div>
          <div className="card-body">
            {/* Investimento destaque */}
            <div style={{
              background: "var(--az)", color: "#fff", borderRadius: 12, padding: "1.5rem",
              textAlign: "center", marginBottom: 20,
            }}>
              <p style={{ fontSize: "0.75rem", opacity: 0.6, margin: 0 }}>Investimento Total</p>
              <p style={{ fontSize: "2rem", fontFamily: "Montserrat, sans-serif", fontWeight: 900, color: "var(--la)", margin: "8px 0 0" }}>
                {formatBRL(valorTotal)}
              </p>
            </div>

            {/* Grid 3 cols */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div className="info-box" style={{ textAlign: "center" }}>
                <p className="info-label">Retorno 10 anos</p>
                <p className="info-value" style={{ color: "var(--verde)" }}>
                  {formatBRLInteger(roiTable[9]?.acumulado ? roiTable[9].acumulado + valorTotal : economiaAnual * 10)}
                </p>
              </div>
              <div className="info-box" style={{ textAlign: "center" }}>
                <p className="info-label">Payback</p>
                <p className="info-value">{paybackMeses > 0 ? `${Math.ceil(paybackMeses / 12)} anos` : "—"}</p>
              </div>
              <div className="info-box" style={{ textAlign: "center" }}>
                <p className="info-label">Economia/mês</p>
                <p className="info-value" style={{ color: "var(--verde)" }}>{formatBRL(economiaMensal)}</p>
              </div>
            </div>

            {/* ROI Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ background: "var(--az)", color: "#fff" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>Ano</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>Economia</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {roiTable.map(row => {
                    const isPayback = row.acumulado >= 0 && (row.ano === 1 || roiTable[row.ano - 2]?.acumulado < 0);
                    return (
                      <tr key={row.ano} style={{
                        background: isPayback ? "rgba(22,163,74,0.1)" : row.ano % 2 === 0 ? "#f8fafc" : "#fff",
                        borderBottom: "1px solid #e2e8f0",
                      }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                          {row.ano}º
                          {isPayback && <span style={{ marginLeft: 8, color: "var(--verde)", fontSize: "0.7rem", fontWeight: 700 }}>← PAYBACK</span>}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--verde)", fontWeight: 600 }}>{formatBRL(row.economia)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: row.acumulado >= 0 ? "var(--verde)" : "#ef4444", fontWeight: 700 }}>
                          {formatBRL(row.acumulado)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ━━━ SEÇÃO 5: GERAÇÃO ━━━ */}
        <section ref={el => { sectionRefs.current[5] = el; }} style={{ marginBottom: 32 }}>
          <div className="section-header">
            <div className="icon-circle"><Zap style={{ width: 20, height: 20, color: "#fff" }} /></div>
            <h2>Geração de Energia</h2>
          </div>
          <div className="card-body">
            {/* Métricas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              <div className="info-box" style={{ textAlign: "center" }}>
                <p className="info-label">Total kWh/ano</p>
                <p className="info-value" style={{ color: "var(--la)" }}>{geracaoAnual.toLocaleString("pt-BR")}</p>
              </div>
              <div className="info-box" style={{ textAlign: "center" }}>
                <p className="info-label">Economia Total/ano</p>
                <p className="info-value" style={{ color: "var(--verde)" }}>{formatBRL(economiaAnual)}</p>
              </div>
              <div className="info-box" style={{ textAlign: "center" }}>
                <p className="info-label">Árvores equiv.</p>
                <p className="info-value" style={{ color: "var(--verde)" }}>{arvoresEq}</p>
              </div>
            </div>

            {/* Barras mensais */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {meses.map((mes, i) => {
                const pct = (geracaoMensal[i] / maxGeracao) * 100;
                const econMes = tarifa > 0 ? geracaoMensal[i] * tarifa : economiaMensal * (fatoresMensais[i] / (somaFatores / 12));
                return (
                  <div key={mes} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 30, fontSize: "0.75rem", fontWeight: 600, color: "var(--cinza)", flexShrink: 0 }}>{mes}</span>
                    <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 4, height: 22, position: "relative", overflow: "hidden" }}>
                      <div style={{
                        width: `${pct}%`, height: "100%", borderRadius: 4,
                        background: "linear-gradient(90deg, var(--la), var(--la2))",
                        display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6,
                        minWidth: 40,
                      }}>
                        <span style={{ fontSize: "0.65rem", color: "#fff", fontWeight: 600 }}>{geracaoMensal[i]} kWh</span>
                      </div>
                    </div>
                    <span style={{ width: 70, fontSize: "0.7rem", color: "var(--verde)", fontWeight: 600, textAlign: "right", flexShrink: 0 }}>
                      {formatBRL(econMes)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ━━━ SEÇÃO 6: CRONOGRAMA ━━━ */}
        <section ref={el => { sectionRefs.current[6] = el; }} style={{ marginBottom: 32 }}>
          <div className="section-header">
            <div className="icon-circle"><Calendar style={{ width: 20, height: 20, color: "#fff" }} /></div>
            <h2>Cronograma</h2>
          </div>
          <div className="card-body">
            {/* Grid serviços */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              {[
                { icon: <FileText style={{ width: 20, height: 20 }} />, title: "Projeto", desc: "Elaboração do projeto técnico e memorial descritivo" },
                { icon: <Truck style={{ width: 20, height: 20 }} />, title: "Logística", desc: "Entrega dos equipamentos no local de instalação" },
                { icon: <Wrench style={{ width: 20, height: 20 }} />, title: "Instalação", desc: "Montagem e comissionamento do sistema" },
                { icon: <ClipboardCheck style={{ width: 20, height: 20 }} />, title: "Homologação", desc: "Processo junto à concessionária de energia" },
                { icon: <Wifi style={{ width: 20, height: 20 }} />, title: "Monitoramento", desc: "Configuração do sistema de monitoramento remoto" },
                { icon: <Shield style={{ width: 20, height: 20 }} />, title: "Manutenção", desc: "Suporte e manutenção preventiva pós-venda" },
              ].map(item => (
                <div key={item.title} style={{
                  border: "1px solid #e2e8f0", borderRadius: 10, padding: 14,
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: "rgba(27,58,140,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--az)",
                  }}>{item.icon}</div>
                  <div>
                    <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "var(--az)", margin: 0 }}>{item.title}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--cinza)", margin: "4px 0 0" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", padding: "0 10px" }}>
              <div style={{ position: "absolute", top: "50%", left: 24, right: 24, height: 2, background: "#e2e8f0", transform: "translateY(-50%)" }} />
              {[
                { label: "D", color: "var(--la)" },
                { label: "1", color: "var(--az)" },
                { label: "2", color: "var(--az)" },
                { label: "D+30", color: "var(--la)" },
                { label: "D+60", color: "var(--la)" },
                { label: "D+90", color: "var(--az)" },
              ].map((step, i) => (
                <div key={i} style={{ position: "relative", textAlign: "center", zIndex: 1 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: step.color, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.7rem",
                  }}>{step.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━ SEÇÃO 7: PAGAMENTO ━━━ */}
        <section ref={el => { sectionRefs.current[7] = el; }} style={{ marginBottom: 32 }}>
          <div className="section-header">
            <div className="icon-circle"><CreditCard style={{ width: 20, height: 20, color: "#fff" }} /></div>
            <h2>Formas de Pagamento</h2>
          </div>
          <div className="card-body">
            {/* Cenários / Pagamento */}
            {cenarios.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {cenarios.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCenario(c.id)}
                    style={{
                      border: selectedCenario === c.id ? "2px solid var(--az)" : "1px solid #e2e8f0",
                      background: selectedCenario === c.id ? "rgba(27,58,140,0.05)" : "#fff",
                      borderRadius: 12, padding: 16, cursor: "pointer", textAlign: "left",
                      transition: "all 0.2s",
                    }}
                  >
                    <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "var(--az)", fontSize: "0.9rem", margin: 0 }}>{c.nome}</p>
                    <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, color: "var(--la)", fontSize: "1.2rem", margin: "8px 0 4px" }}>
                      {formatBRL(c.preco_final)}
                    </p>
                    {c.num_parcelas > 0 && (
                      <p style={{ fontSize: "0.75rem", color: "var(--cinza)", margin: 0 }}>
                        {c.num_parcelas}x de {formatBRL(c.valor_parcela)}
                      </p>
                    )}
                    {c.entrada_valor > 0 && (
                      <p style={{ fontSize: "0.7rem", color: "var(--cinza)", margin: "4px 0 0" }}>
                        Entrada: {formatBRL(c.entrada_valor)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ) : s.pagamentoOpcoes.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {s.pagamentoOpcoes.map(p => (
                  <div key={p.id} style={{
                    border: "1px solid #e2e8f0", borderRadius: 12, padding: 16,
                  }}>
                    <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "var(--az)", fontSize: "0.85rem", margin: 0 }}>{p.nome}</p>
                    {p.num_parcelas > 0 && (
                      <p style={{ fontSize: "0.8rem", color: "var(--cinza)", margin: "6px 0 0" }}>
                        {p.num_parcelas}x de {formatBRL(p.valor_parcela)}
                      </p>
                    )}
                    {p.entrada > 0 && (
                      <p style={{ fontSize: "0.75rem", color: "var(--cinza)", margin: "4px 0 0" }}>Entrada: {formatBRL(p.entrada)}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="info-box" style={{ textAlign: "center", marginBottom: 20 }}>
                <p className="info-value">{formatBRL(valorTotal)}</p>
                <p className="info-label">Valor do investimento</p>
              </div>
            )}

            {/* ACEITE */}
            <div style={{
              background: "var(--az)", borderRadius: 12, padding: "1.5rem", color: "#fff", marginTop: 12,
            }}>
              <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "1.1rem", margin: "0 0 16px", textAlign: "center" }}>
                ACEITE DA PROPOSTA
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: "0.7rem", opacity: 0.6, display: "block", marginBottom: 4 }}>Cliente</label>
                  <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.85rem", margin: 0 }}>
                    {s.clienteNome || "—"}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: "0.7rem", opacity: 0.6, display: "block", marginBottom: 4 }}>Responsável Comercial</label>
                  <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.85rem", margin: 0 }}>
                    {consultorNome || tenantNome || "—"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  placeholder="Seu nome completo"
                  value={acceptForm.nome}
                  onChange={e => setAcceptForm(f => ({ ...f, nome: e.target.value }))}
                  style={{
                    background: "var(--accept-input-bg)", border: "1px solid var(--accept-input-border)",
                    borderRadius: 8, padding: "10px 14px", color: "var(--accept-input-text)", fontSize: "0.85rem",
                    outline: "none", fontFamily: "var(--font-body)",
                  }}
                />
                <input
                  placeholder="CPF ou CNPJ (opcional)"
                  value={acceptForm.documento}
                  onChange={e => setAcceptForm(f => ({ ...f, documento: e.target.value }))}
                  style={{
                    background: "var(--accept-input-bg)", border: "1px solid var(--accept-input-border)",
                    borderRadius: 8, padding: "10px 14px", color: "var(--accept-input-text)", fontSize: "0.85rem",
                    outline: "none", fontFamily: "var(--font-body)",
                  }}
                />
                <textarea
                  placeholder="Observações (opcional)"
                  value={acceptForm.obs}
                  rows={2}
                  onChange={e => setAcceptForm(f => ({ ...f, obs: e.target.value }))}
                  style={{
                    background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: "0.85rem",
                    outline: "none", fontFamily: "Open Sans, sans-serif", resize: "none",
                  }}
                />
              </div>
            </div>

            {/* CTA final */}
            <div style={{
              background: "var(--cta-bg)",
              borderRadius: 12, padding: "2rem 1.5rem", textAlign: "center", marginTop: 20, color: "var(--hero-text, #fff)",
            }}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "1.3rem", margin: "0 0 8px" }}>
                Pronto para economizar?
              </h3>
              <p style={{ fontSize: "0.85rem", opacity: 0.6, marginBottom: 20 }}>
                Aceite a proposta ou entre em contato conosco
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                {consultorTelefone && (
                  <a
                    href={`https://wa.me/55${consultorTelefone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-verde"
                    style={{ textDecoration: "none" }}
                  >
                    <Phone style={{ width: 16, height: 16 }} /> WhatsApp
                  </a>
                )}
                <button
                  className="btn-la"
                  disabled={submitting || !acceptForm.nome.trim()}
                  onClick={handleAccept}
                  style={{ opacity: !acceptForm.nome.trim() ? 0.5 : 1 }}
                >
                  {submitting ? "Enviando..." : "✓ Aceitar Proposta"}
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  style={{
                    background: "transparent", border: "1px solid rgba(255,255,255,0.3)",
                    color: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "10px 20px",
                    cursor: "pointer", fontSize: "0.85rem", fontFamily: "Montserrat, sans-serif", fontWeight: 600,
                  }}
                >
                  Recusar
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      {/* ━━━ SEÇÃO: CHAT COM IA ━━━ */}
      <PropostaChatSection propostaData={templateVariables} />

      <footer style={{
        background: "var(--footer-bg)", color: "var(--footer-text)", textAlign: "center",
        padding: "1.5rem", fontSize: "0.75rem",
      }}>
        {brand?.logo_white_url && <img src={brand.logo_white_url} alt="" style={{ height: 28, objectFit: "contain", opacity: 0.5, marginBottom: 8 }} />}
        <p style={{ margin: 0 }}>© {new Date().getFullYear()} {tenantNome || "Energia Solar"} — Todos os direitos reservados</p>
      </footer>

      {/* Modal Recusar */}
      {showReject && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: 24, width: "90vw", maxWidth: 400,
          }}>
            <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "var(--az)", fontSize: "1.1rem", margin: "0 0 12px" }}>
              Recusar Proposta
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--cinza)", marginBottom: 12 }}>
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
                  padding: "8px 16px", cursor: "pointer", fontSize: "0.85rem", color: "var(--cinza)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                style={{
                  background: "#ef4444", color: "#fff", border: "none", borderRadius: 8,
                  padding: "8px 20px", cursor: "pointer", fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700, fontSize: "0.85rem",
                }}
              >
                {submitting ? "Enviando..." : "Confirmar Recusa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme switcher — visible only for logged-in users */}
      <LandingThemeSwitcher />
    </div>
  );
}
