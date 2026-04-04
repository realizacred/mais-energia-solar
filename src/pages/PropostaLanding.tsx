/**
 * PropostaLanding.tsx
 * 
 * Landing page de alta conversão para propostas comerciais.
 * Rota: /pl/:token
 * 
 * Carrega dados via token (como PropostaPublica) e renderiza 
 * uma página de marketing com brand_settings do tenant.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatters";
import { normalizeProposalSnapshot, type NormalizedProposalSnapshot } from "@/domain/proposal/normalizeProposalSnapshot";
import { LandingHero } from "@/components/proposal-landing/LandingHero";
import { LandingSistema } from "@/components/proposal-landing/LandingSistema";
import { LandingInvestimento } from "@/components/proposal-landing/LandingInvestimento";
import { LandingBeneficios } from "@/components/proposal-landing/LandingBeneficios";
import { LandingCTA } from "@/components/proposal-landing/LandingCTA";
import { LandingFooter } from "@/components/proposal-landing/LandingFooter";
import { LandingLoading } from "@/components/proposal-landing/LandingLoading";
import { LandingError } from "@/components/proposal-landing/LandingError";
import { LandingDecisionDone } from "@/components/proposal-landing/LandingDecisionDone";
import { Sun, Loader2 } from "lucide-react";

interface BrandData {
  logo_url: string | null;
  logo_white_url: string | null;
  color_primary: string | null;
  color_primary_foreground: string | null;
  color_background: string | null;
  color_foreground: string | null;
  font_heading: string | null;
}

interface TenantData {
  nome: string | null;
  telefone: string | null;
  whatsapp: string | null;
}

interface CenarioData {
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
  payback_meses: number;
  tir_anual: number;
  roi_25_anos: number;
  economia_primeiro_ano: number;
}

export default function PropostaLanding() {
  const { token } = useParams<{ token: string }>();
  
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
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [consultorNome, setConsultorNome] = useState<string | null>(null);
  const [consultorTelefone, setConsultorTelefone] = useState<string | null>(null);
  
  // Heartbeat
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useEffect(() => {
    if (token) loadData();
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load token
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

      // Track view
      try {
        await supabase.rpc("registrar_view_proposta" as any, {
          p_token: td.token,
          p_user_agent: navigator.userAgent,
          p_referrer: document.referrer || null,
        });
      } catch { /* best-effort */ }

      // Heartbeat for tracked tokens
      if (td.tipo !== "public") {
        heartbeatRef.current = setInterval(async () => {
          try {
            await supabase.rpc("registrar_heartbeat_proposta" as any, {
              p_token: td.token, p_segundos: 30,
            });
          } catch { /* best-effort */ }
        }, 30_000);
      }

      // 2. Load versão + cenários + proposta (for tenant_id) in parallel
      const [versaoRes, cenariosRes, propostaRes] = await Promise.all([
        supabase.from("proposta_versoes")
          .select("id, valor_total, economia_mensal, payback_meses, potencia_kwp, snapshot, output_pdf_path")
          .eq("id", td.versao_id).single(),
        (supabase as any).from("proposta_cenarios")
          .select("id, ordem, nome, tipo, is_default, preco_final, entrada_valor, num_parcelas, valor_parcela, taxa_juros_mensal, payback_meses, tir_anual, roi_25_anos, economia_primeiro_ano")
          .eq("versao_id", td.versao_id).order("ordem"),
        (supabase as any).from("propostas_nativas")
          .select("tenant_id, consultor_id, titulo")
          .eq("id", td.proposta_id).maybeSingle(),
      ]);

      if (versaoRes.data) {
        setVersaoData(versaoRes.data);
        const snap = normalizeProposalSnapshot(versaoRes.data.snapshot as Record<string, unknown> | null);
        setSnapshot(snap);
      }

      const loadedCenarios = cenariosRes.data ?? [];
      setCenarios(loadedCenarios);
      const defaultC = loadedCenarios.find((c: CenarioData) => c.is_default) ?? loadedCenarios[0];
      if (defaultC) setSelectedCenario(defaultC.id);

      // 3. Load brand + tenant + consultor
      if (propostaRes.data?.tenant_id) {
        const tenantId = propostaRes.data.tenant_id;
        const [brandRes, tenantRes, consultorRes] = await Promise.all([
          supabase.from("brand_settings")
            .select("logo_url, logo_white_url, color_primary, color_primary_foreground, color_background, color_foreground, font_heading")
            .eq("tenant_id", tenantId).maybeSingle(),
          supabase.from("tenants")
            .select("nome")
            .eq("id", tenantId).maybeSingle(),
          propostaRes.data.consultor_id
            ? (supabase as any).from("consultores")
                .select("nome, telefone")
                .eq("id", propostaRes.data.consultor_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (brandRes.data) setBrand(brandRes.data as any);
        if (tenantRes.data) setTenant({ nome: tenantRes.data.nome, telefone: null, whatsapp: null });
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

  // Accept handler
  const handleAccept = async (nome: string, documento: string, observacoes: string) => {
    if (!tokenId) return;
    
    const { error: updateErr } = await (supabase as any)
      .from("proposta_aceite_tokens")
      .update({
        used_at: new Date().toISOString(),
        decisao: "aceita",
        aceite_nome: nome,
        aceite_documento: documento || null,
        aceite_observacoes: observacoes || null,
        aceite_user_agent: navigator.userAgent,
        cenario_aceito_id: selectedCenario || null,
      })
      .eq("id", tokenId);

    if (updateErr) throw updateErr;

    if (propostaId) {
      await supabase.from("propostas_nativas")
        .update({ status: "aceita", aceita_at: new Date().toISOString() })
        .eq("id", propostaId);

      supabase.functions.invoke("proposal-decision-notify", {
        body: { token_id: tokenId, decisao: "aceita" },
      }).catch(() => {});
    }

    setDecision("aceita");
  };

  const handleReject = async (motivo: string) => {
    if (!tokenId) return;

    const { error: updateErr } = await (supabase as any)
      .from("proposta_aceite_tokens")
      .update({
        used_at: new Date().toISOString(),
        decisao: "recusada",
        recusa_motivo: motivo || null,
        recusa_at: new Date().toISOString(),
        aceite_user_agent: navigator.userAgent,
      })
      .eq("id", tokenId);

    if (updateErr) throw updateErr;

    if (propostaId) {
      await supabase.from("propostas_nativas")
        .update({ status: "recusada", recusada_at: new Date().toISOString(), recusa_motivo: motivo || null })
        .eq("id", propostaId);

      supabase.functions.invoke("proposal-decision-notify", {
        body: { token_id: tokenId, decisao: "recusada" },
      }).catch(() => {});
    }

    setDecision("recusada");
  };

  if (loading) return <LandingLoading />;
  if (error) return <LandingError message={error} />;
  if (decision) return <LandingDecisionDone decision={decision} brand={brand} tenant={tenant} />;
  if (!snapshot || !versaoData) return <LandingError message="Dados da proposta não encontrados." />;

  const valorTotal = activeCenario?.preco_final ?? versaoData.valor_total ?? 0;
  const economiaMensal = versaoData.economia_mensal ?? 0;
  const paybackMeses = activeCenario?.payback_meses ?? versaoData.payback_meses ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <LandingHero
        clienteNome={snapshot.clienteNome}
        potenciaKwp={snapshot.potenciaKwp}
        economiaMensal={economiaMensal}
        logoUrl={brand?.logo_white_url || brand?.logo_url}
        empresaNome={tenant?.nome}
        consultorNome={consultorNome}
      />

      <LandingSistema
        potenciaKwp={snapshot.potenciaKwp}
        geracaoMensal={snapshot.geracaoMensalEstimada}
        consumoTotal={snapshot.consumoTotal}
        itens={snapshot.itens}
        tipoTelhado={snapshot.locTipoTelhado}
        cidade={snapshot.locCidade}
        estado={snapshot.locEstado}
      />

      <LandingBeneficios
        economiaMensal={economiaMensal}
        paybackMeses={paybackMeses}
        potenciaKwp={snapshot.potenciaKwp}
      />

      <LandingInvestimento
        valorTotal={valorTotal}
        economiaMensal={economiaMensal}
        paybackMeses={paybackMeses}
        cenarios={cenarios}
        selectedCenario={selectedCenario}
        onSelectCenario={setSelectedCenario}
        activeCenario={activeCenario}
        pagamentoOpcoes={snapshot.pagamentoOpcoes}
      />

      <LandingCTA
        onAccept={handleAccept}
        onReject={handleReject}
        consultorNome={consultorNome}
        consultorTelefone={consultorTelefone}
        empresaNome={tenant?.nome}
      />

      <LandingFooter
        empresaNome={tenant?.nome}
        logoUrl={brand?.logo_white_url || brand?.logo_url}
      />
    </div>
  );
}
