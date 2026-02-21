import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ENGINE_VERSION, calcSeries25, calcCenario, calcHash,
  evaluateExpression, round2,
  type CalcInputs, type CenarioInput, type FioBStep,
} from "../_shared/calc-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ──────────────────────────────────────────────────

const SUBGRUPOS_A = ["A1", "A2", "A3", "A3a", "A4", "AS"];
const SUBGRUPOS_B = ["B1", "B2", "B3"];

function resolveGrupoFromSubgrupo(subgrupo: string | undefined | null): "A" | "B" | null {
  if (!subgrupo) return null;
  const upper = subgrupo.toUpperCase();
  if (SUBGRUPOS_A.some(s => s.toUpperCase() === upper)) return "A";
  if (SUBGRUPOS_B.some(s => s.toUpperCase() === upper)) return "B";
  if (upper.startsWith("A")) return "A";
  if (upper.startsWith("B")) return "B";
  return null;
}

interface UCPayload {
  nome: string;
  tipo_dimensionamento: "BT" | "MT";
  distribuidora: string;
  distribuidora_id: string;
  subgrupo: string;
  estado: string;
  cidade: string;
  fase: "monofasico" | "bifasico" | "trifasico";
  tensao_rede: string;
  consumo_mensal: number;
  consumo_meses: Record<string, number>;
  consumo_mensal_p: number;
  consumo_mensal_fp: number;
  tarifa_distribuidora: number;
  tarifa_te_p: number;
  tarifa_tusd_p: number;
  tarifa_te_fp: number;
  tarifa_tusd_fp: number;
  demanda_preco: number;
  demanda_contratada: number;
  demanda_adicional: number;
  custo_disponibilidade_kwh: number;
  custo_disponibilidade_valor: number;
  outros_encargos_atual: number;
  outros_encargos_novo: number;
  distancia: number;
  tipo_telhado: string;
  inclinacao: number;
  desvio_azimutal: number;
  taxa_desempenho: number;
  regra_compensacao: number;
  rateio_sugerido_creditos: number;
  rateio_creditos: number;
  imposto_energia: number;
  fator_simultaneidade: number;
}

interface PremissasPayload {
  imposto: number;
  inflacao_energetica: number;
  inflacao_ipca: number;
  perda_eficiencia_anual: number;
  sobredimensionamento: number;
  troca_inversor_anos: number;
  troca_inversor_custo: number;
  vpl_taxa_desconto: number;
}

interface KitItemPayload {
  descricao: string;
  fabricante: string;
  modelo: string;
  potencia_w: number;
  quantidade: number;
  preco_unitario: number;
  categoria: string;
  avulso: boolean;
}

interface ServicoPayload {
  descricao: string;
  categoria: string;
  valor: number;
  incluso_no_preco: boolean;
}

interface VendaPayload {
  custo_comissao: number;
  custo_outros: number;
  margem_percentual: number;
  desconto_percentual: number;
  observacoes: string;
}

interface PagamentoPayload {
  nome: string;
  tipo: "a_vista" | "financiamento" | "parcelado" | "outro";
  valor_financiado: number;
  entrada: number;
  taxa_mensal: number;
  carencia_meses: number;
  num_parcelas: number;
  valor_parcela: number;
  financiador_id?: string;
}

interface GenerateRequestV2 {
  lead_id: string;
  projeto_id?: string;
  cliente_id?: string;
  grupo: "A" | "B";
  template_id?: string;
  potencia_kwp: number;
  ucs: UCPayload[];
  premissas: PremissasPayload;
  itens: KitItemPayload[];
  servicos: ServicoPayload[];
  venda: VendaPayload;
  pagamento_opcoes: PagamentoPayload[];
  observacoes?: string;
  idempotency_key: string;
  variaveis_custom?: boolean;
  aceite_estimativa?: boolean;
}

// ─── Main Handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // ── 1. AUTH ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Não autorizado. Faça login novamente.", 401);
    }

    const callerClient = createClient(
      supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) {
      console.error("[proposal-generate] Auth failed:", authErr?.message);
      return jsonError("Sessão expirada ou inválida. Faça login novamente.", 401);
    }
    const userId = user.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Resolve tenant + permissions (parallel)
    const [profileRes, rolesRes] = await Promise.all([
      adminClient.from("profiles").select("tenant_id, ativo").eq("user_id", userId).single(),
      adminClient.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (!profileRes.data?.tenant_id || !profileRes.data.ativo) {
      return jsonError("Usuário inativo ou sem tenant", 403);
    }
    const tenantId = profileRes.data.tenant_id;

    const allowedRoles = ["admin", "gerente", "financeiro", "consultor"];
    const hasPermission = rolesRes.data?.some((r: any) => allowedRoles.includes(r.role));
    if (!hasPermission) return jsonError("Sem permissão para gerar propostas", 403);

    // Verify tenant active
    const { data: tenant } = await adminClient
      .from("tenants").select("id, status, nome, estado").eq("id", tenantId).single();
    if (!tenant || tenant.status !== "active") return jsonError("Tenant suspenso ou inativo", 403);

    // ── 2. PARSE PAYLOAD ────────────────────────────────────
    const body: GenerateRequestV2 = await req.json();

    if (!body.lead_id || !body.grupo || !body.ucs?.length || !body.itens?.length) {
      return jsonError("Campos obrigatórios: lead_id, grupo, ucs, itens", 400);
    }
    if (!body.idempotency_key) return jsonError("idempotency_key é obrigatório", 400);
    if (!["A", "B"].includes(body.grupo)) return jsonError("grupo deve ser A ou B", 400);

    // ── 3. IDEMPOTÊNCIA ─────────────────────────────────────
    const { data: existingVersion } = await adminClient
      .from("proposta_versoes")
      .select("id, proposta_id, versao_numero, valor_total, payback_meses, economia_mensal, calc_hash, engine_version")
      .eq("tenant_id", tenantId)
      .eq("idempotency_key", body.idempotency_key)
      .maybeSingle();

    if (existingVersion) {
      return jsonOk({
        success: true, idempotent: true,
        proposta_id: existingVersion.proposta_id,
        versao_id: existingVersion.id,
        versao_numero: existingVersion.versao_numero,
        valor_total: existingVersion.valor_total,
        payback_meses: existingVersion.payback_meses,
        economia_mensal: existingVersion.economia_mensal,
        engine_version: existingVersion.engine_version,
      });
    }

    // ── 4. DADOS AUXILIARES (parallel) ──────────────────────
    const uc1 = body.ucs[0];
    const estado = uc1.estado;
    const anoAtual = new Date().getFullYear();
    const distribuidoraId = uc1.distribuidora_id || null;

    const [fioBRes, tributacaoRes, irradiacaoRes, defaultPremissasRes, consultorRes, tariffVersionRes, aneelRunRes] = await Promise.all([
      adminClient.from("fio_b_escalonamento")
        .select("ano, percentual_nao_compensado")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order("ano", { ascending: true }),
      adminClient.from("config_tributaria_estado")
        .select("aliquota_icms, possui_isencao_scee, percentual_isencao")
        .eq("estado", estado).maybeSingle(),
      adminClient.from("irradiacao_por_estado")
        .select("geracao_media_kwp_mes")
        .eq("estado", estado)
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order("tenant_id", { ascending: false, nullsFirst: false })
        .limit(1).maybeSingle(),
      adminClient.from("premissas_default_tenant")
        .select("inflacao_energetica, inflacao_ipca, taxa_desconto_vpl, perda_eficiencia_anual, sobredimensionamento, troca_inversor_ano, troca_inversor_custo_percentual")
        .eq("tenant_id", tenantId).maybeSingle(),
      adminClient.from("consultores")
        .select("id").eq("user_id", userId).eq("tenant_id", tenantId).eq("ativo", true).maybeSingle(),
      // ── ENFORCEMENT: Fetch active tariff_version for distribuidora ──
      distribuidoraId
        ? adminClient.from("tariff_versions")
            .select("id, te_kwh, tusd_total_kwh, tusd_fio_b_kwh, tusd_fio_a_kwh, tfsee_kwh, pnd_kwh, precisao, origem, vigencia_inicio, vigencia_fim, snapshot_hash, run_id, is_active")
            .eq("tenant_id", tenantId)
            .eq("concessionaria_id", distribuidoraId)
            .eq("is_active", true)
            .order("vigencia_inicio", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // ── ENFORCEMENT: Fetch latest ANEEL sync run ──
      adminClient.from("aneel_sync_runs")
        .select("id, started_at, snapshot_hash, status")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const consultorId = consultorRes.data?.id ?? null;
    const geracaoMediaKwpMes = irradiacaoRes.data?.geracao_media_kwp_mes ?? 120;
    const activeTariff = tariffVersionRes.data;
    const lastAneelRun = aneelRunRes.data;

    // Build Fio B escalation steps
    const fioBSteps: FioBStep[] = (fioBRes.data ?? []).map((r: any) => ({
      ano: r.ano,
      percentual: r.percentual_nao_compensado,
    }));
    const fioBCurrentYear = fioBSteps.find(s => s.ano === anoAtual);
    const percentualFioB = fioBCurrentYear?.percentual ?? 0;

    // ── ENFORCEMENT: Recalculate precision from tariff data (NEVER trust frontend) ──
    let backendPrecisao: "exato" | "estimado" = "estimado";
    let backendPrecisaoMotivo = "Fio B real não disponível — usando TUSD total como proxy";
    if (activeTariff && activeTariff.tusd_fio_b_kwh && activeTariff.tusd_fio_b_kwh > 0) {
      backendPrecisao = "exato";
      backendPrecisaoMotivo = "Fio B real disponível na tariff_version ativa";
    }

    // ── ENFORCEMENT: GD rule recalculation — uses body.grupo initially, overridden by backendGrupo later ──
    // Note: backendGrupo is set after grupo validation below; this initial value is only for the missing_required check
    let backendRegraGd = body.grupo === "B" ? "GD_II" : "GD_I";
    const backendAnoGd = anoAtual;
    const GD_FIO_B_BY_YEAR: Record<number, number> = {
      2023: 0.15, 2024: 0.30, 2025: 0.45, 2026: 0.60, 2027: 0.75, 2028: 0.90,
    };
    const backendFioBPercent = GD_FIO_B_BY_YEAR[anoAtual] ?? (anoAtual >= 2029 ? 0.90 : 0.60);

    // ── ENFORCEMENT: Validate required variables ──
    const missingRequired: string[] = [];
    if (!body.lead_id) missingRequired.push("lead_id");
    if (!body.potencia_kwp || body.potencia_kwp <= 0) missingRequired.push("sistema_solar.potencia_sistema");
    const consumoCheck = body.ucs.reduce((s, uc) => s + (uc.tipo_dimensionamento === "MT" ? uc.consumo_mensal_p + uc.consumo_mensal_fp : uc.consumo_mensal), 0);
    if (consumoCheck <= 0) missingRequired.push("entrada.consumo_mensal");
    const custoKitCheck = body.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
    if (custoKitCheck <= 0) missingRequired.push("financeiro.preco_total");

    if (missingRequired.length > 0) {
      // Log bypass attempt
      await adminClient.from("audit_logs").insert({
        tenant_id: tenantId,
        tabela: "propostas_nativas",
        acao: "pdf_bloqueado_backend",
        user_id: userId,
        registro_id: body.lead_id,
        dados_novos: {
          motivo: "missing_required_variables",
          missing_required: missingRequired,
          precisao: backendPrecisao,
        },
      }).then(() => {}).catch(() => {});

      return new Response(JSON.stringify({
        success: false,
        error: "missing_required_variables",
        missing: missingRequired,
        message: "Variáveis obrigatórias ausentes. Não é possível gerar a proposta.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ENFORCEMENT: Check aceite_estimativa if precision is estimated ──
    if (backendPrecisao === "estimado" && body.aceite_estimativa !== true) {
      // Log bypass attempt
      await adminClient.from("audit_logs").insert({
        tenant_id: tenantId,
        tabela: "propostas_nativas",
        acao: "pdf_bloqueado_backend",
        user_id: userId,
        registro_id: body.lead_id,
        dados_novos: {
          motivo: "estimativa_not_accepted",
          precisao: backendPrecisao,
          precisao_motivo: backendPrecisaoMotivo,
        },
      }).then(() => {}).catch(() => {});

      return new Response(JSON.stringify({
        success: false,
        error: "estimativa_not_accepted",
        message: "É necessário aceitar que os valores são estimados antes de gerar a proposta.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ENFORCEMENT: Grupo consistency validation (NEVER trust frontend) ──
    const ucGrupos = body.ucs.map(uc => resolveGrupoFromSubgrupo(uc.subgrupo));
    const undefinedGrupos = ucGrupos.filter(g => g === null);
    if (undefinedGrupos.length > 0) {
      await adminClient.from("audit_logs").insert({
        tenant_id: tenantId, tabela: "propostas_nativas",
        acao: "bloqueio_grupo_indefinido", user_id: userId,
        registro_id: body.lead_id,
        dados_novos: { motivo: "grupo_indefinido", ucs_sem_grupo: ucGrupos.map((g, i) => g === null ? i : -1).filter(i => i >= 0) },
      }).then(() => {}).catch(() => {});
      return new Response(JSON.stringify({
        success: false, error: "grupo_indefinido",
        message: "Uma ou mais UCs não possuem grupo tarifário definido.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const uniqueGrupos = new Set(ucGrupos);
    if (uniqueGrupos.size > 1) {
      await adminClient.from("audit_logs").insert({
        tenant_id: tenantId, tabela: "propostas_nativas",
        acao: "bloqueio_grupo_misto", user_id: userId,
        registro_id: body.lead_id,
        dados_novos: { motivo: "mixed_grupos", grupos_detectados: ucGrupos },
      }).then(() => {}).catch(() => {});
      return new Response(JSON.stringify({
        success: false, error: "mixed_grupos",
        message: "Não é permitido misturar Grupo A e Grupo B na mesma proposta.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use backend-resolved grupo (NEVER trust body.grupo)
    const backendGrupo = ucGrupos[0] as "A" | "B";
    // Override GD rule with backend-resolved grupo
    backendRegraGd = backendGrupo === "B" ? "GD_II" : "GD_I";

    // Resolve premissas (payload > tenant defaults > hardcoded)
    let premissas = body.premissas;
    if (!premissas || Object.keys(premissas).length === 0) {
      const d = defaultPremissasRes.data;
      premissas = d ? {
        imposto: 0,
        inflacao_energetica: d.inflacao_energetica ?? 6.5,
        inflacao_ipca: d.inflacao_ipca ?? 4.5,
        perda_eficiencia_anual: d.perda_eficiencia_anual ?? 0.5,
        sobredimensionamento: d.sobredimensionamento ?? 0,
        troca_inversor_anos: d.troca_inversor_ano ?? 15,
        troca_inversor_custo: d.troca_inversor_custo_percentual ?? 30,
        vpl_taxa_desconto: d.taxa_desconto_vpl ?? 10,
      } : {
        imposto: 0, inflacao_energetica: 6.5, inflacao_ipca: 4.5,
        perda_eficiencia_anual: 0.5, sobredimensionamento: 0,
        troca_inversor_anos: 15, troca_inversor_custo: 30, vpl_taxa_desconto: 10,
      };
    }

    const tributacao = tributacaoRes.data;

    // ── 5. CÁLCULO via shared engine ────────────────────────
    const potenciaKwp = body.potencia_kwp;
    const consumoTotal = body.ucs.reduce((s, uc) => {
      return s + (uc.tipo_dimensionamento === "MT" ? uc.consumo_mensal_p + uc.consumo_mensal_fp : uc.consumo_mensal);
    }, 0);

    const geracaoEstimada = potenciaKwp * geracaoMediaKwpMes;
    const tarifaMedia = uc1.tarifa_distribuidora || 0.85;
    const energiaCompensavel = Math.min(geracaoEstimada, consumoTotal);
    const fioBAplicavel = backendGrupo === "B" ? percentualFioB / 100 : 0;
    const custoFioBMensal = energiaCompensavel * (tarifaMedia * 0.28) * fioBAplicavel;
    const custoDispTotal = body.ucs.reduce((s, uc) => s + uc.custo_disponibilidade_valor, 0);
    const economiaBruta = energiaCompensavel * tarifaMedia;
    const economiaMensal = Math.max(economiaBruta - custoFioBMensal - custoDispTotal, 0);

    // Custos
    const custoKit = body.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
    const custoServicosInclusos = body.servicos.filter(s => s.incluso_no_preco).reduce((s, i) => s + i.valor, 0);
    const venda = body.venda ?? { custo_comissao: 0, custo_outros: 0, margem_percentual: 20, desconto_percentual: 0, observacoes: "" };
    const custoBase = custoKit + custoServicosInclusos + venda.custo_comissao + venda.custo_outros;
    const margemValor = custoBase * (venda.margem_percentual / 100);
    const precoComMargem = custoBase + margemValor;
    const descontoValor = precoComMargem * (venda.desconto_percentual / 100);
    const valorTotal = round2(precoComMargem - descontoValor);

    // Build calc inputs
    const calcInputs: CalcInputs = {
      investimentoTotal: valorTotal,
      economiaMensalAno1: economiaMensal,
      geracaoMensalKwh: geracaoEstimada,
      tarifaMedia,
      inflacaoEnergetica: premissas.inflacao_energetica,
      perdaEficienciaAnual: premissas.perda_eficiencia_anual,
      trocaInversorAnos: premissas.troca_inversor_anos,
      trocaInversorCustoPct: premissas.troca_inversor_custo,
      vplTaxaDesconto: premissas.vpl_taxa_desconto,
      fioB: {
        anoBase: anoAtual,
        percentualBase: percentualFioB,
        escalonamento: fioBSteps,
      },
    };

    // 25-year series via shared engine
    const calcResult = calcSeries25(calcInputs);

    // Calc hash for deterministic auditing
    const hashInput = {
      grupo: backendGrupo, potencia_kwp: potenciaKwp, ucs: body.ucs,
      premissas, itens: body.itens, servicos: body.servicos, venda,
      pagamento_opcoes: body.pagamento_opcoes, fioB: fioBSteps,
      irradiacao: geracaoMediaKwpMes,
    };
    const hash = await calcHash(hashInput);

    // ── 5b. CENÁRIOS (one per payment option) ───────────────
    const cenarioInputs: CenarioInput[] = (body.pagamento_opcoes ?? []).map(p => ({
      nome: p.nome,
      tipo: p.tipo,
      investimento: valorTotal,
      entrada: p.entrada,
      taxaMensal: p.taxa_mensal,
      numParcelas: p.num_parcelas,
      valorParcela: p.valor_parcela,
      financiadorId: p.financiador_id,
    }));
    const cenarioResults = cenarioInputs.map(ci => calcCenario(calcInputs, ci));

    // ── 5c. CUSTOM VARIABLES (vc_*) ─────────────────────────
    let vcResults: Array<{ variavel_id: string; nome: string; label: string; expressao: string; valor_calculado: string | null }> = [];

    if (body.variaveis_custom !== false) {
      const { data: vcDefs } = await adminClient
        .from("proposta_variaveis_custom")
        .select("id, nome, label, expressao, tipo_resultado")
        .eq("tenant_id", tenantId).eq("ativo", true).order("ordem");

      if (vcDefs && vcDefs.length > 0) {
        const numModulos = body.itens.filter(it => it.categoria === "modulo").reduce((s, it) => s + it.quantidade, 0);
        const ctx: Record<string, number> = {
          valor_total: valorTotal,
          economia_mensal: round2(economiaMensal),
          economia_anual: round2(economiaMensal * 12),
          payback_meses: calcResult.paybackMeses,
          payback_anos: calcResult.paybackAnos,
          potencia_kwp: potenciaKwp,
          consumo_total: consumoTotal,
          geracao_estimada: round2(geracaoEstimada),
          custo_kit: round2(custoKit),
          margem_percentual: venda.margem_percentual,
          desconto_percentual: venda.desconto_percentual,
          vpl: calcResult.vpl,
          tir: calcResult.tir,
          roi_25_anos: calcResult.roi25Anos,
          num_modulos: numModulos,
          num_ucs: body.ucs.length,
        };

        for (const vc of vcDefs) {
          const val = evaluateExpression(vc.expressao, ctx);
          vcResults.push({
            variavel_id: vc.id, nome: vc.nome, label: vc.label,
            expressao: vc.expressao, valor_calculado: val !== null ? String(val) : null,
          });
        }
      }
    }

    // ── 6. SNAPSHOT IMUTÁVEL ────────────────────────────────
    const snapshot = {
      versao_schema: 3,
      engine_version: ENGINE_VERSION,
      calc_hash: hash,
      gerado_em: new Date().toISOString(),
      grupo: backendGrupo,
      regra_lei_14300: {
        versao: `${anoAtual}-01`,
        fio_b_ano: anoAtual,
        percentual_fio_b: fioBAplicavel,
        percentual_nao_compensado: percentualFioB,
        escalonamento: fioBSteps,
        fonte: fioBRes.data?.length ? "fio_b_escalonamento" : "fallback_zero",
      },
      tributacao: {
        estado,
        aliquota_icms: tributacao?.aliquota_icms ?? 0.25,
        possui_isencao_scee: tributacao?.possui_isencao_scee ?? false,
        percentual_isencao: tributacao?.percentual_isencao ?? 0,
      },
      tecnico: {
        potencia_kwp: potenciaKwp,
        consumo_total_kwh: consumoTotal,
        geracao_estimada_kwh: round2(geracaoEstimada),
        irradiacao_media_kwp_mes: geracaoMediaKwpMes,
        energia_compensavel_kwh: energiaCompensavel,
        num_ucs: body.ucs.length,
      },
      premissas,
      ucs: body.ucs.map((uc, i) => ({ uc_index: i + 1, ...uc })),
      itens: body.itens.map(it => ({ ...it, subtotal: round2(it.quantidade * it.preco_unitario) })),
      servicos: body.servicos,
      venda: { ...venda, custo_kit: round2(custoKit), custo_servicos: round2(custoServicosInclusos) },
      financeiro: {
        custo_kit: round2(custoKit),
        custo_servicos_inclusos: round2(custoServicosInclusos),
        custo_comissao: round2(venda.custo_comissao),
        custo_outros: round2(venda.custo_outros),
        custo_base: round2(custoBase),
        margem_percentual: venda.margem_percentual,
        margem_valor: round2(margemValor),
        desconto_percentual: venda.desconto_percentual,
        desconto_valor: round2(descontoValor),
        valor_total: valorTotal,
        economia_mensal: round2(economiaMensal),
        economia_anual: calcResult.economiaPrimeiroAno,
        payback_meses: calcResult.paybackMeses,
        payback_anos: calcResult.paybackAnos,
        vpl: calcResult.vpl,
        tir: calcResult.tir,
        roi_25_anos: calcResult.roi25Anos,
      },
      pagamento_opcoes: body.pagamento_opcoes ?? [],
      cenarios: cenarioResults.map(c => ({
        nome: c.nome, tipo: c.tipo, preco_final: c.precoFinal,
        payback_meses: c.paybackMeses, tir: c.tir, cet_anual: c.cetAnual,
      })),
      variaveis_custom: vcResults.length > 0 ? vcResults : undefined,
      inputs: {
        lead_id: body.lead_id, projeto_id: body.projeto_id ?? null,
        cliente_id: body.cliente_id ?? null, template_id: body.template_id ?? null,
        consultor_id: consultorId, user_id: userId,
      },
    };

    // ── 7. CRIAR OU REUTILIZAR propostas_nativas ────────────
    let propostaId: string;

    const matchFilter: any = { tenant_id: tenantId, lead_id: body.lead_id };
    if (body.projeto_id) matchFilter.projeto_id = body.projeto_id;

    const { data: existingProposta } = await adminClient
      .from("propostas_nativas").select("id").match(matchFilter)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (existingProposta) {
      propostaId = existingProposta.id;
    } else {
      const { data: lead } = await adminClient
        .from("leads").select("nome, lead_code")
        .eq("id", body.lead_id).eq("tenant_id", tenantId).single();
      if (!lead) return jsonError("Lead não encontrado neste tenant", 404);

      const titulo = `Proposta ${lead.lead_code ?? ""} - ${lead.nome}`.trim();
      const { data: novaProposta, error: insertErr } = await adminClient
        .from("propostas_nativas")
        .insert({
          tenant_id: tenantId, lead_id: body.lead_id,
          projeto_id: body.projeto_id ?? null, cliente_id: body.cliente_id ?? null,
          consultor_id: consultorId, template_id: body.template_id ?? null,
          titulo, codigo: lead.lead_code ? `PROP-${lead.lead_code}` : null,
          versao_atual: 0, created_by: userId,
        })
        .select("id").single();
      if (insertErr || !novaProposta) return jsonError(`Erro ao criar proposta: ${insertErr?.message}`, 500);
      propostaId = novaProposta.id;
    }

    // ── 8. VERSÃO ATÔMICA via RPC ───────────────────────────
    const { data: versaoNumero, error: rpcErr } = await adminClient.rpc(
      "next_proposta_versao_numero", { _proposta_id: propostaId }
    );
    if (rpcErr || !versaoNumero) return jsonError(`Erro ao gerar número de versão: ${rpcErr?.message}`, 500);

    // ── 9. INSERIR proposta_versoes ─────────────────────────
    const { data: versao, error: versaoErr } = await adminClient
      .from("proposta_versoes")
      .insert({
        tenant_id: tenantId, proposta_id: propostaId,
        versao_numero: versaoNumero, status: "generated",
        grupo: backendGrupo, potencia_kwp: potenciaKwp,
        valor_total: valorTotal,
        economia_mensal: round2(economiaMensal),
        payback_meses: calcResult.paybackMeses,
        validade_dias: 30,
        valido_ate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        snapshot, snapshot_locked: true,
        idempotency_key: body.idempotency_key,
        observacoes: body.observacoes ?? null,
        gerado_por: userId,
        gerado_em: new Date().toISOString(),
        calc_hash: hash,
        engine_version: ENGINE_VERSION,
      })
      .select("id, versao_numero, valor_total, payback_meses, economia_mensal")
      .single();

    if (versaoErr) {
      if (versaoErr.code === "23505") {
        const { data: dup } = await adminClient.from("proposta_versoes")
          .select("id, proposta_id, versao_numero, valor_total, payback_meses, economia_mensal")
          .eq("tenant_id", tenantId).eq("idempotency_key", body.idempotency_key).single();
        if (dup) {
          return jsonOk({
            success: true, idempotent: true, proposta_id: dup.proposta_id,
            versao_id: dup.id, versao_numero: dup.versao_numero,
            valor_total: dup.valor_total, payback_meses: dup.payback_meses,
            economia_mensal: dup.economia_mensal,
          });
        }
      }
      return jsonError(`Erro ao criar versão: ${versaoErr.message}`, 500);
    }

    const versaoId = versao!.id;

    // ── 10. GRANULAR PERSISTENCE (critical path) ────────────
    await adminClient.from("propostas_nativas")
      .update({ status: "gerada", versao_atual: versao!.versao_numero })
      .eq("id", propostaId).eq("tenant_id", tenantId);

    const granularOps = [];

    // UCs → proposta_versao_ucs (new granular table)
    if (body.ucs.length > 0) {
      granularOps.push(
        adminClient.from("proposta_versao_ucs").insert(
          body.ucs.map((uc, i) => ({
            tenant_id: tenantId, versao_id: versaoId, ordem: i + 1,
            nome: uc.nome, grupo: uc.subgrupo.startsWith("A") ? "A" : "B",
            modalidade: uc.tipo_dimensionamento,
            consumo_mensal_kwh: uc.tipo_dimensionamento === "MT"
              ? uc.consumo_mensal_p + uc.consumo_mensal_fp
              : uc.consumo_mensal,
            consumo_ponta_kwh: uc.consumo_mensal_p || null,
            consumo_fora_ponta_kwh: uc.consumo_mensal_fp || null,
            tarifa_energia: uc.tarifa_distribuidora,
            tipo_ligacao: uc.fase,
            concessionaria_id: uc.distribuidora_id || null,
            demanda_contratada_kw: uc.demanda_contratada || null,
            aliquota_icms: tributacao?.aliquota_icms ?? null,
          }))
        )
      );
    }

    // Also keep legacy proposta_ucs for backward compat
    if (body.ucs.length > 0) {
      granularOps.push(
        adminClient.from("proposta_ucs").insert(
          body.ucs.map((uc, i) => ({
            tenant_id: tenantId, versao_id: versaoId, uc_index: i + 1,
            nome: uc.nome, tipo_dimensionamento: uc.tipo_dimensionamento,
            distribuidora: uc.distribuidora, distribuidora_id: uc.distribuidora_id || null,
            subgrupo: uc.subgrupo, estado: uc.estado, cidade: uc.cidade,
            fase: uc.fase, tensao_rede: uc.tensao_rede,
            consumo_mensal: uc.consumo_mensal, consumo_meses: uc.consumo_meses,
            consumo_mensal_p: uc.consumo_mensal_p, consumo_mensal_fp: uc.consumo_mensal_fp,
            tarifa_distribuidora: uc.tarifa_distribuidora,
            custo_disponibilidade_kwh: uc.custo_disponibilidade_kwh,
            custo_disponibilidade_valor: uc.custo_disponibilidade_valor,
            distancia_km: uc.distancia, tipo_telhado: uc.tipo_telhado,
            inclinacao: uc.inclinacao, desvio_azimutal: uc.desvio_azimutal,
            taxa_desempenho: uc.taxa_desempenho, rateio_creditos: uc.rateio_creditos,
            fator_simultaneidade: uc.fator_simultaneidade,
          }))
        )
      );
    }

    // Premissas
    granularOps.push(
      adminClient.from("proposta_premissas").insert({
        tenant_id: tenantId, versao_id: versaoId,
        imposto: premissas.imposto, inflacao_energetica: premissas.inflacao_energetica,
        inflacao_ipca: premissas.inflacao_ipca, perda_eficiencia_anual: premissas.perda_eficiencia_anual,
        sobredimensionamento: premissas.sobredimensionamento,
        troca_inversor_anos: premissas.troca_inversor_anos,
        troca_inversor_custo_pct: premissas.troca_inversor_custo,
        vpl_taxa_desconto: premissas.vpl_taxa_desconto,
      })
    );

    // Kit + itens
    granularOps.push(
      adminClient.from("proposta_kits").insert({
        tenant_id: tenantId, versao_id: versaoId,
        tipo_kit: "customizado", tipo_sistema: "on_grid",
        topologia: "tradicional", custo_total: round2(custoKit),
      }).select("id").single().then(async ({ data: kit }) => {
        if (kit && body.itens.length > 0) {
          await adminClient.from("proposta_kit_itens").insert(
            body.itens.map((it, i) => ({
              tenant_id: tenantId, kit_id: kit.id, ordem: i + 1,
              descricao: it.descricao, fabricante: it.fabricante, modelo: it.modelo,
              potencia_w: it.potencia_w, quantidade: it.quantidade,
              preco_unitario: it.preco_unitario,
              subtotal: round2(it.quantidade * it.preco_unitario),
              categoria: it.categoria, avulso: it.avulso,
            }))
          );
        }
      })
    );

    // Serviços → proposta_versao_servicos (new)
    if (body.servicos.length > 0) {
      granularOps.push(
        adminClient.from("proposta_versao_servicos").insert(
          body.servicos.map((s, i) => ({
            tenant_id: tenantId, versao_id: versaoId, ordem: i + 1,
            descricao: s.descricao, tipo: s.categoria, valor: s.valor,
            incluso: s.incluso_no_preco,
          }))
        )
      );
      // Legacy
      granularOps.push(
        adminClient.from("proposta_servicos").insert(
          body.servicos.map((s, i) => ({
            tenant_id: tenantId, versao_id: versaoId, ordem: i + 1,
            descricao: s.descricao, categoria: s.categoria, valor: s.valor,
            incluso_no_preco: s.incluso_no_preco,
          }))
        )
      );
    }

    // Venda
    granularOps.push(
      adminClient.from("proposta_venda").insert({
        tenant_id: tenantId, versao_id: versaoId,
        custo_equipamentos: round2(custoKit), custo_servicos: round2(custoServicosInclusos),
        custo_comissao: round2(venda.custo_comissao), custo_outros: round2(venda.custo_outros),
        margem_percentual: venda.margem_percentual, margem_valor: round2(margemValor),
        desconto_percentual: venda.desconto_percentual, desconto_valor: round2(descontoValor),
        preco_final: valorTotal, observacoes: venda.observacoes,
      })
    );

    // Cenários → proposta_cenarios
    if (cenarioResults.length > 0) {
      for (let i = 0; i < cenarioResults.length; i++) {
        const cr = cenarioResults[i];
        const pg = body.pagamento_opcoes[i];
        granularOps.push(
          adminClient.from("proposta_cenarios").insert({
            tenant_id: tenantId, versao_id: versaoId, ordem: i + 1,
            nome: cr.nome, tipo: cr.tipo, is_default: i === 0,
            preco_final: cr.precoFinal, entrada_valor: cr.entrada,
            entrada_percent: cr.precoFinal > 0 ? round2(cr.entrada / cr.precoFinal * 100) : 0,
            taxa_juros_mensal: cr.taxaMensal,
            taxa_juros_anual: cr.taxaMensal > 0 ? round2((Math.pow(1 + cr.taxaMensal / 100, 12) - 1) * 100) : 0,
            cet_anual: cr.cetAnual,
            num_parcelas: cr.numParcelas, valor_parcela: cr.valorParcela,
            valor_financiado: pg.valor_financiado,
            payback_meses: cr.paybackMeses, tir_anual: cr.tir,
            roi_25_anos: cr.roi25Anos, economia_primeiro_ano: cr.economiaPrimeiroAno,
            custo_equipamentos: round2(custoKit), custo_servicos: round2(custoServicosInclusos),
            custo_total: valorTotal, margem_percent: venda.margem_percentual,
            financiador_id: cr.financiadorId || null,
          }).select("id").single().then(async ({ data: cenario }) => {
            // Write series for this cenário
            if (cenario && cr.series.length > 0) {
              await adminClient.from("proposta_versao_series").insert(
                cr.series.map(s => ({
                  tenant_id: tenantId, versao_id: versaoId, cenario_id: cenario.id,
                  ano: s.ano, geracao_kwh: s.geracao_kwh, tarifa_vigente: s.tarifa_vigente,
                  degradacao_acumulada: s.degradacao_acumulada,
                  economia_rs: s.economia_liquida, economia_acumulada_rs: s.economia_acumulada,
                  fluxo_caixa: s.fluxo_caixa, fluxo_caixa_acumulado: s.fluxo_caixa_acumulado,
                  // Financing parcels for this cenário
                  parcela_financiamento: s.ano * 12 <= cr.numParcelas ? cr.valorParcela * 12 : 0,
                }))
              );
            }
          })
        );
      }
    }

    // Also write base series (no cenário) to legacy table
    if (calcResult.series.length > 0) {
      granularOps.push(
        adminClient.from("proposta_series").insert(
          calcResult.series.map(s => ({
            tenant_id: tenantId, versao_id: versaoId,
            ano: s.ano, geracao_kwh: s.geracao_kwh,
            economia_bruta: s.economia_bruta, custo_fio_b: s.custo_fio_b,
            economia_liquida: s.economia_liquida, economia_acumulada: s.economia_acumulada,
            fluxo_caixa: s.fluxo_caixa, fluxo_caixa_acumulado: s.fluxo_caixa_acumulado,
            vpl_parcial: s.vpl_parcial,
          }))
        )
      );
    }

    // Legacy pagamento opcoes
    if (body.pagamento_opcoes?.length > 0) {
      granularOps.push(
        adminClient.from("proposta_pagamento_opcoes").insert(
          body.pagamento_opcoes.map((p, i) => ({
            tenant_id: tenantId, versao_id: versaoId, ordem: i + 1,
            nome: p.nome, tipo: p.tipo, valor_financiado: p.valor_financiado,
            entrada: p.entrada, taxa_mensal: p.taxa_mensal,
            carencia_meses: p.carencia_meses, num_parcelas: p.num_parcelas,
            valor_parcela: p.valor_parcela,
          }))
        )
      );
    }

    // Custom variables
    if (vcResults.length > 0) {
      granularOps.push(
        adminClient.from("proposta_versao_variaveis").insert(
          vcResults.map(vc => ({
            tenant_id: tenantId, versao_id: versaoId,
            variavel_id: vc.variavel_id, nome: vc.nome, label: vc.label,
            expressao: vc.expressao, valor_calculado: vc.valor_calculado,
          }))
        )
      );
    }

    // Execute all granular writes
    const granularResults = await Promise.allSettled(granularOps);
    const failures = granularResults.filter(r => r.status === "rejected");
    if (failures.length > 0) {
      console.warn(`[proposal-generate] ${failures.length}/${granularResults.length} granular ops failed:`,
        failures.map(f => (f as PromiseRejectedResult).reason));
    }

    // ── ENFORCEMENT: Save audit data from BACKEND-COMPUTED values (NEVER from frontend) ──
    const auditPayload: Record<string, unknown> = {
      precisao_calculo: backendPrecisao,
      regra_gd: backendRegraGd,
      ano_gd: backendAnoGd,
      fio_b_percent_aplicado: backendFioBPercent,
      origem_tarifa: activeTariff?.origem ?? "desconhecida",
      vigencia_tarifa: activeTariff?.vigencia_inicio ?? null,
      snapshot_hash: activeTariff?.snapshot_hash ?? lastAneelRun?.snapshot_hash ?? null,
      missing_variables: null, // passed validation
      tariff_version_id: activeTariff?.id ?? null,
      aneel_run_id: activeTariff?.run_id ?? lastAneelRun?.id ?? null,
    };
    if (backendPrecisao === "estimado" && body.aceite_estimativa === true) {
      auditPayload.aceite_estimativa = true;
      auditPayload.data_aceite_estimativa = new Date().toISOString();
    }

    await adminClient.from("propostas_nativas")
      .update(auditPayload)
      .eq("id", propostaId)
      .eq("tenant_id", tenantId)
      .then(({ error: auditErr }) => {
        if (auditErr) console.warn("[proposal-generate] Audit persist failed:", auditErr.message);
      });

    return jsonOk({
      success: true, idempotent: false,
      proposta_id: propostaId, versao_id: versaoId,
      versao_numero: versao!.versao_numero,
      valor_total: versao!.valor_total,
      payback_meses: versao!.payback_meses,
      economia_mensal: versao!.economia_mensal,
      vpl: calcResult.vpl, tir: calcResult.tir,
      payback_anos: calcResult.paybackAnos,
      engine_version: ENGINE_VERSION,
      calc_hash: hash,
      cenarios_count: cenarioResults.length,
    });
  } catch (err) {
    console.error("[proposal-generate] Error:", err);
    return jsonError(err.message ?? "Erro interno", 500);
  }
});

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
