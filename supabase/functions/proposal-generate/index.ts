import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ENGINE_VERSION, calcSeries25, calcCenario, calcHash,
  evaluateExpression, round2,
  type CalcInputs, type CenarioInput, type FioBStep,
} from "../_shared/calc-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  lead_id?: string;
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
  /** Wizard-specific state for edit round-trip (passthrough, not used by engine) */
  _wizard_state?: Record<string, unknown>;
}

// ─── Catalog Enrichment ─────────────────────────────────────

function parseDimensoesMm(dim: string | null | undefined): { comprimento_mm?: number; largura_mm?: number; profundidade_mm?: number } {
  if (!dim) return {};
  // Supports formats: "2279 x 1134 x 35", "2279x1134x35", "2279 × 1134 × 35"
  const parts = dim.split(/\s*[x×X]\s*/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
  if (parts.length >= 3) return { comprimento_mm: parts[0], largura_mm: parts[1], profundidade_mm: parts[2] };
  if (parts.length === 2) return { comprimento_mm: parts[0], largura_mm: parts[1] };
  return {};
}

async function enrichItensWithCatalog(
  adminClient: any,
  tenantId: string,
  itens: KitItemPayload[],
): Promise<Array<KitItemPayload & Record<string, unknown>>> {
  // Collect unique fabricante+modelo pairs per category
  const moduloKeys: string[] = [];
  const inversorKeys: string[] = [];
  const bateriaKeys: string[] = [];

  for (const it of itens) {
    const cat = (it.categoria ?? "").toLowerCase();
    const key = `${it.fabricante}||${it.modelo}`;
    if (cat.includes("modulo") || cat.includes("módulo") || cat === "module") {
      if (!moduloKeys.includes(key)) moduloKeys.push(key);
    } else if (cat.includes("inversor") || cat === "inverter") {
      if (!inversorKeys.includes(key)) inversorKeys.push(key);
    } else if (cat.includes("bateria") || cat === "battery") {
      if (!bateriaKeys.includes(key)) bateriaKeys.push(key);
    }
  }

  // Parallel catalog lookups
  const [modCatalog, invCatalog, batCatalog] = await Promise.all([
    moduloKeys.length > 0
      ? adminClient.from("modulos_fotovoltaicos")
          .select("fabricante, modelo, tipo_celula, numero_celulas, dimensoes_mm, tensao_sistema_v, vmp, imp, voc, isc, coef_temp, eficiencia_percent")
          .eq("tenant_id", tenantId)
          .then((r: any) => r.data ?? [])
      : Promise.resolve([]),
    inversorKeys.length > 0
      ? adminClient.from("inversores")
          .select("fabricante, modelo, potencia_maxima_w, mppts, tensao_max_v, tensao_min_mppt_v, tensao_max_mppt_v, corrente_max_mppt_a, tensao_linha_v, eficiencia_percent, tipo_sistema")
          .eq("tenant_id", tenantId)
          .then((r: any) => r.data ?? [])
      : Promise.resolve([]),
    bateriaKeys.length > 0
      ? adminClient.from("baterias")
          .select("fabricante, modelo, tipo_bateria, energia_kwh, dimensoes_mm, tensao_operacao_v, tensao_carga_v, tensao_nominal_v, potencia_max_saida_kw, corrente_max_descarga_a, corrente_max_carga_a, correntes_recomendadas_a")
          .eq("tenant_id", tenantId)
          .then((r: any) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  // Index catalogs by fabricante+modelo
  const modIndex = new Map<string, any>();
  for (const m of modCatalog) modIndex.set(`${m.fabricante}||${m.modelo}`, m);
  const invIndex = new Map<string, any>();
  for (const i of invCatalog) invIndex.set(`${i.fabricante}||${i.modelo}`, i);
  const batIndex = new Map<string, any>();
  for (const b of batCatalog) batIndex.set(`${b.fabricante}||${b.modelo}`, b);

  // Enrich each item
  return itens.map(it => {
    const cat = (it.categoria ?? "").toLowerCase();
    const key = `${it.fabricante}||${it.modelo}`;
    const enriched: Record<string, unknown> = { ...it };

    if (cat.includes("modulo") || cat.includes("módulo") || cat === "module") {
      const spec = modIndex.get(key);
      if (spec) {
        enriched.tipo_celula = spec.tipo_celula;
        enriched.numero_celulas = spec.numero_celulas;
        enriched.tensao_sistema_v = spec.tensao_sistema_v;
        enriched.vmp = spec.vmp;
        enriched.imp = spec.imp;
        enriched.voc = spec.voc;
        enriched.isc = spec.isc;
        enriched.coef_temp = spec.coef_temp;
        enriched.eficiencia_percent = spec.eficiencia_percent;
        const dims = parseDimensoesMm(spec.dimensoes_mm);
        if (dims.comprimento_mm) enriched.comprimento_mm = dims.comprimento_mm;
        if (dims.largura_mm) enriched.largura_mm = dims.largura_mm;
        if (dims.profundidade_mm) enriched.profundidade_mm = dims.profundidade_mm;
      }
    } else if (cat.includes("inversor") || cat === "inverter") {
      const spec = invIndex.get(key);
      if (spec) {
        enriched.potencia_maxima_w = spec.potencia_maxima_w;
        enriched.mppts = spec.mppts;
        enriched.tensao_max_v = spec.tensao_max_v;
        enriched.tensao_min_mppt_v = spec.tensao_min_mppt_v;
        enriched.tensao_max_mppt_v = spec.tensao_max_mppt_v;
        enriched.corrente_max_mppt_a = spec.corrente_max_mppt_a;
        enriched.tensao_linha_v = spec.tensao_linha_v;
        enriched.eficiencia_percent = spec.eficiencia_percent;
        enriched.tipo_sistema = spec.tipo_sistema;
      }
    } else if (cat.includes("bateria") || cat === "battery") {
      const spec = batIndex.get(key);
      if (spec) {
        enriched.tipo_bateria = spec.tipo_bateria;
        enriched.energia_kwh = spec.energia_kwh;
        enriched.tensao_operacao_v = spec.tensao_operacao_v;
        enriched.tensao_carga_v = spec.tensao_carga_v;
        enriched.tensao_nominal_v = spec.tensao_nominal_v;
        enriched.potencia_max_saida_kw = spec.potencia_max_saida_kw;
        enriched.corrente_max_descarga_a = spec.corrente_max_descarga_a;
        enriched.corrente_max_carga_a = spec.corrente_max_carga_a;
        enriched.correntes_recomendadas_a = spec.correntes_recomendadas_a;
        const dims = parseDimensoesMm(spec.dimensoes_mm);
        if (dims.comprimento_mm) enriched.comprimento_mm = dims.comprimento_mm;
        if (dims.largura_mm) enriched.largura_mm = dims.largura_mm;
        if (dims.profundidade_mm) enriched.profundidade_mm = dims.profundidade_mm;
      }
    }

    return enriched as KitItemPayload & Record<string, unknown>;
  });
}

// ─── Flatten Item Financials by Category ────────────────────
// Generates flat snapshot keys for baterias, transformadores, kit_fechado
// from the enriched itens[] array. Only creates keys that don't already exist.
// Item.preco_unitario = custo (cost). Sell price (preço) = custo * (1 + margem/100).

interface FlatItem {
  categoria: string;
  quantidade: number;
  preco_unitario: number; // this is the COST per unit
  [key: string]: unknown;
}

function flattenItensFinanceirosPorCategoria(
  itens: FlatItem[],
  margemPercentual: number,
): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  const margemFator = 1 + (margemPercentual / 100);

  // Category matchers — only real item categories emitted by frontend
  const isBateria = (cat: string) => cat.includes("bateria") || cat === "battery";
  const isTransformador = (cat: string) => cat.includes("transformador") || cat.includes("transformer");

  // ── Helper: process a category ──
  function processCategory(
    prefix: string,          // e.g. "bateria"
    prefixPlural: string,    // e.g. "baterias"
    matcher: (cat: string) => boolean,
    opts: { indexed: boolean; concatenated: boolean; totals: boolean },
  ) {
    const filtered = itens.filter(it => matcher((it.categoria ?? "").toLowerCase()));
    if (filtered.length === 0) return;

    let custoTotalSum = 0;
    let precoTotalSum = 0;
    const custoUnList: number[] = [];
    const precoUnList: number[] = [];
    const custoTotalList: number[] = [];
    const precoTotalList: number[] = [];

    filtered.forEach((item, idx) => {
      const custoUn = round2(item.preco_unitario);
      const precoUn = round2(item.preco_unitario * margemFator);
      const custoTotal = round2(item.quantidade * item.preco_unitario);
      const precoTotal = round2(item.quantidade * item.preco_unitario * margemFator);

      custoTotalSum += custoTotal;
      precoTotalSum += precoTotal;
      custoUnList.push(custoUn);
      precoUnList.push(precoUn);
      custoTotalList.push(custoTotal);
      precoTotalList.push(precoTotal);

      // Indexed keys: prefix_custo_un_1, prefix_preco_un_1, etc.
      if (opts.indexed) {
        const n = idx + 1;
        out[`${prefix}_custo_un_${n}`] = custoUn;
        out[`${prefix}_preco_un_${n}`] = precoUn;
        out[`${prefix}_preco_total_${n}`] = precoTotal;
      }
    });

    // Concatenated keys: "1.000,00 / 1.500,00"
    if (opts.concatenated && filtered.length > 0) {
      const fmtList = (arr: number[]) => arr.map(v => fmtBRL(v)).join(" / ");
      out[`${prefix}_custo_un`] = fmtList(custoUnList);
      out[`${prefix}_preco_un`] = fmtList(precoUnList);
      out[`${prefix}_custo_total`] = fmtList(custoTotalList);
      out[`${prefix}_preco_total`] = fmtList(precoTotalList);
    }

    // Aggregate totals
    if (opts.totals) {
      out[`${prefixPlural}_custo_total`] = round2(custoTotalSum);
      out[`${prefixPlural}_preco_total`] = round2(precoTotalSum);
    }
  }

  // ── Baterias: indexed + concatenated + totals ──
  processCategory("bateria", "baterias", isBateria, {
    indexed: true, concatenated: true, totals: true,
  });

  // ── Transformadores: indexed + totals (no concatenated — less common) ──
  processCategory("transformador", "transformadores", isTransformador, {
    indexed: true, concatenated: false, totals: true,
  });

  // NOTE: kit_fechado is NOT an item category — it's a commercial mode.
  // kit_fechado_custo_total and kit_fechado_preco_total are derived from
  // financeiro.custo_kit and financeiro.valor_total respectively,
  // handled by resolveFinanceiro. No item-category flatten needed here.

  return out;
}

// Simple BRL formatter for concatenated values (no Intl dependency in Deno edge)
function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

    if ((!body.lead_id && !body.cliente_id) || !body.grupo || !body.ucs?.length || !body.itens?.length) {
      return jsonError("Campos obrigatórios: lead_id ou cliente_id, grupo, ucs, itens", 400);
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
    // Template-only mode: não bloquear por variáveis técnicas/financeiras ausentes.
    // Mantemos apenas o vínculo com lead ou cliente como salvaguarda defensiva.
    const missingRequired: string[] = [];
    if (!body.lead_id && !body.cliente_id) missingRequired.push("lead_id|cliente_id");

    if (missingRequired.length > 0) {
      console.warn("[proposal-generate][BLOCKED] missing_required_variables", {
        tenant_id: tenantId,
        user_id: userId,
        lead_id: body.lead_id,
        missing: missingRequired,
        precisao: backendPrecisao,
      });

      return new Response(JSON.stringify({
        success: false,
        error: "missing_required_variables",
        missing: missingRequired,
        message: "Variáveis obrigatórias ausentes. Não é possível gerar a proposta.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ENFORCEMENT: Check aceite_estimativa if precision is estimated ──
    if (backendPrecisao === "estimado" && body.aceite_estimativa !== true) {
      console.warn("[proposal-generate][BLOCKED] estimativa_not_accepted", {
        tenant_id: tenantId, user_id: userId, lead_id: body.lead_id,
        precisao: backendPrecisao, motivo: backendPrecisaoMotivo,
      });

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
      console.warn("[proposal-generate][BLOCKED] grupo_indefinido", {
        tenant_id: tenantId, user_id: userId, lead_id: body.lead_id,
        ucs_sem_grupo: ucGrupos.map((g, i) => g === null ? i : -1).filter(i => i >= 0),
      });
      return new Response(JSON.stringify({
        success: false, error: "grupo_indefinido",
        message: "Uma ou mais UCs não possuem grupo tarifário definido.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const uniqueGrupos = new Set(ucGrupos);
    if (uniqueGrupos.size > 1) {
      console.warn("[proposal-generate][BLOCKED] mixed_grupos", {
        tenant_id: tenantId, user_id: userId, lead_id: body.lead_id,
        grupos_detectados: ucGrupos,
      });
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
    let vcResults: Array<{ variavel_id: string; nome: string; label: string; expressao: string; valor_calculado: string | null; error?: boolean; error_message?: string }> = [];

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
          consumo_mensal: consumoTotal, // alias for formulas using [consumo_mensal]
          geracao_estimada: round2(geracaoEstimada),
          geracao_mensal: round2(geracaoEstimada), // alias for formulas using [geracao_mensal]
          custo_kit: round2(custoKit),
          margem_percentual: venda.margem_percentual,
          desconto_percentual: venda.desconto_percentual,
          vpl: calcResult.vpl,
          tir: calcResult.tir,
          roi_25_anos: calcResult.roi25Anos,
          num_modulos: numModulos,
          num_ucs: body.ucs.length,
          // Aliases for custom variable expressions
          vc_consumo: consumoTotal,
          consumo: consumoTotal,
        };

        for (const vc of vcDefs) {
          try {
            if (!vc.expressao || vc.expressao.trim() === "") {
              vcResults.push({
                variavel_id: vc.id, nome: vc.nome, label: vc.label,
                expressao: vc.expressao, valor_calculado: null,
                error: true, error_message: "Expressão vazia",
              });
              continue;
            }

            // ── Text-type detection: if expression has no math operators
            //    and no [variable] references, treat as fixed text ──
            const trimmedExpr = vc.expressao.trim();
            const hasVarRefs = /\[[^\]]+\]/.test(trimmedExpr);
            const hasMathOps = /[+\-*\/()]/.test(trimmedExpr);
            const isTextoFixo = !hasVarRefs && !hasMathOps;

            if (isTextoFixo || vc.tipo_resultado === "text") {
              // Fixed text variable — return expression as-is
              vcResults.push({
                variavel_id: vc.id, nome: vc.nome, label: vc.label,
                expressao: vc.expressao, valor_calculado: trimmedExpr,
              });
              continue;
            }

            const val = evaluateExpression(vc.expressao, ctx);
            if (val === null) {
              // Check if it's a syntax issue or missing deps
              const deps = (vc.expressao.match(/\[([^\]]+)\]/g) || []).map((m: string) => m.slice(1, -1).trim());
              const missingDeps = deps.filter((d: string) => ctx[d] === undefined);
              vcResults.push({
                variavel_id: vc.id, nome: vc.nome, label: vc.label,
                expressao: vc.expressao, valor_calculado: null,
                error: true,
                error_message: missingDeps.length > 0
                  ? `Dependências ausentes: ${missingDeps.join(", ")}`
                  : "Expressão retornou null (possível erro de sintaxe ou resultado inválido)",
              });
            } else {
              vcResults.push({
                variavel_id: vc.id, nome: vc.nome, label: vc.label,
                expressao: vc.expressao, valor_calculado: String(val),
              });
              // Feed result back into ctx so dependent vars can use it
              ctx[vc.nome] = val;
            }
          } catch (e) {
            vcResults.push({
              variavel_id: vc.id, nome: vc.nome, label: vc.label,
              expressao: vc.expressao, valor_calculado: null,
              error: true, error_message: `Erro de execução: ${(e as Error).message}`,
            });
          }
        }
      }
    }

    // ── 6. ENRICH ITEMS WITH CATALOG DATA ──────────────────
    const enrichedItens = await enrichItensWithCatalog(adminClient, tenantId, body.itens);

    // ── 6b. FLATTEN ITEM FINANCIALS BY CATEGORY ─────────────
    const flatItensFinanceiros = flattenItensFinanceirosPorCategoria(enrichedItens, venda.margem_percentual);
    // ── 6c. AI JUSTIFICATIVA TÉCNICA ────────────────────────
    let aiJustificativa: string | null = null;
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const tipoTelhado = body.ucs[0]?.tipo_telhado || "não informado";
        const cidade = body.ucs[0]?.cidade || "não informada";
        const estado = body.ucs[0]?.estado || "";
        const paybackAnos = calcResult.paybackAnos;
        const econAnual = calcResult.economiaPrimeiroAno;
        const roi25 = calcResult.roi25Anos;

        const aiPrompt = `Você é um especialista em energia solar fotovoltaica. Gere uma justificativa técnica personalizada e persuasiva (máximo 4 parágrafos) para uma proposta comercial.

Dados do projeto:
- Localização: ${cidade}/${estado}
- Consumo mensal: ${consumoTotal} kWh
- Tipo de telhado: ${tipoTelhado}
- Potência do sistema: ${potenciaKwp} kWp
- Investimento: R$ ${valorTotal.toFixed(2)}
- Economia mensal estimada: R$ ${round2(economiaMensal).toFixed(2)}
- Economia anual: R$ ${econAnual.toFixed(2)}
- Payback: ${paybackAnos} anos
- ROI em 25 anos: R$ ${roi25.toFixed(2)}
- VPL: R$ ${calcResult.vpl.toFixed(2)}
- TIR: ${calcResult.tir.toFixed(1)}%

Inclua: análise do perfil de consumo, adequação técnica do sistema, retorno financeiro comparado a investimentos tradicionais (poupança, CDB), e projeção de valorização do imóvel. Tom: profissional e confiante.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "Você é um consultor especialista em energia solar fotovoltaica no Brasil. Responda em português brasileiro." },
              { role: "user", content: aiPrompt },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiJustificativa = aiData?.choices?.[0]?.message?.content ?? null;
        } else {
          console.warn("[proposal-generate] AI justificativa failed:", aiResponse.status);
        }
      }
    } catch (aiErr: any) {
      console.warn("[proposal-generate] AI justificativa error (non-blocking):", aiErr?.message);
    }

    // ── 7. SNAPSHOT IMUTÁVEL ────────────────────────────────
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
      itens: enrichedItens.map(it => ({ ...it, subtotal: round2(it.quantidade * it.preco_unitario) })),
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
        lead_id: body.lead_id ?? null, projeto_id: body.projeto_id ?? null,
        cliente_id: body.cliente_id ?? null, template_id: body.template_id ?? null,
        consultor_id: consultorId, user_id: userId,
      },
      // Flattened financial keys by category (baterias, transformadores, kit_fechado)
      // Spread at root level so resolveFinanceiro can read them via snap[key]
      ...flatItensFinanceiros,
      // P1: Flatten 25-year series into snapshot so resolvers can access them
      // without depending on relational tables (fluxo_caixa_acumulado_anual_X, economia_anual_valor_X, etc.)
      ...flattenSeries25(calcResult.series, valorTotal),
      // P2/P4: Persist wizard inputs that resolvers need from snapshot
      capo_seguro: body._wizard_state?.capo_seguro ?? body.capo_seguro ?? undefined,
      area_util: calcAreaUtil(body.itens, body.ucs),
      ai_justificativa: aiJustificativa ?? undefined,
      // Wizard-specific state for edit round-trip (passthrough, not used by engine)
      _wizard_state: body._wizard_state ?? undefined,
    };

    // ── 8. CRIAR OU REUTILIZAR propostas_nativas ────────────
    let propostaId: string;

    const matchFilter: any = { tenant_id: tenantId };
    if (body.lead_id) matchFilter.lead_id = body.lead_id;
    else matchFilter.cliente_id = body.cliente_id;
    if (body.projeto_id) matchFilter.projeto_id = body.projeto_id;

    const { data: existingProposta } = await adminClient
      .from("propostas_nativas").select("id").match(matchFilter)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (existingProposta) {
      propostaId = existingProposta.id;
    } else {
      let titulo = "Proposta";
      let codigo: string | null = null;

      if (body.lead_id) {
        const { data: lead } = await adminClient
          .from("leads").select("nome, lead_code")
          .eq("id", body.lead_id).eq("tenant_id", tenantId).single();
        if (!lead) return jsonError("Lead não encontrado neste tenant", 404);

        titulo = `Proposta ${lead.lead_code ?? ""} - ${lead.nome}`.trim();
        codigo = lead.lead_code ? `PROP-${lead.lead_code}` : null;
      } else {
        const { data: cliente } = await adminClient
          .from("clientes").select("nome, cliente_code")
          .eq("id", body.cliente_id).eq("tenant_id", tenantId).single();
        if (!cliente) return jsonError("Cliente não encontrado neste tenant", 404);

        titulo = `Proposta ${cliente.cliente_code ?? ""} - ${cliente.nome}`.trim();
        codigo = cliente.cliente_code ? `PROP-${cliente.cliente_code}` : null;
      }

      const { data: novaProposta, error: insertErr } = await adminClient
        .from("propostas_nativas")
        .insert({
          tenant_id: tenantId, lead_id: body.lead_id ?? null,
          projeto_id: body.projeto_id ?? null, cliente_id: body.cliente_id ?? null,
          consultor_id: consultorId, template_id: body.template_id ?? null,
          titulo, codigo,
          versao_atual: 0, created_by: userId,
        })
        .select("id").single();
      if (insertErr || !novaProposta) return jsonError(`Erro ao criar proposta: ${insertErr?.message}`, 500);
      propostaId = novaProposta.id;
    }

    // ── 8. VERSÃO via RPC proposal_create_version (SSOT) ────
    // Find latest existing version for this proposta (if any) for branching logic
    const { data: latestVersao } = await adminClient
      .from("proposta_versoes")
      .select("id")
      .eq("proposta_id", propostaId)
      .order("versao_numero", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: rpcResult, error: rpcErr } = await adminClient.rpc(
      "proposal_create_version", {
        p_proposta_id: propostaId,
        p_versao_id: latestVersao?.id ?? null,
        p_snapshot: snapshot,
        p_potencia_kwp: potenciaKwp,
        p_valor_total: valorTotal,
        p_economia_mensal: round2(economiaMensal),
        p_geracao_mensal: round2(geracaoEstimada),
        p_grupo: backendGrupo,
        p_intent: "active",
        p_idempotency_key: body.idempotency_key,
        p_calc_hash: hash,
        p_engine_version: ENGINE_VERSION,
        p_validade_dias: 30,
        p_observacoes: body.observacoes ?? null,
        p_gerado_por: userId,
        p_payback_meses: calcResult.paybackMeses,
      }
    );

    if (rpcErr) return jsonError(`Erro ao criar versão: ${rpcErr.message}`, 500);
    if (rpcResult?.error) return jsonError(`Erro ao criar versão: ${rpcResult.error}`, 500);

    const versaoId = rpcResult.versao_id;
    const versaoNumero = rpcResult.versao_numero;

    // ── 10. GRANULAR PERSISTENCE (critical path) ────────────
    // NOTE: Do NOT promote status to "gerada" here. Status stays "rascunho"
    // until the render step (proposal-render or template-preview) succeeds
    // and confirms artifact persistence. Only update versao_atual.
    await adminClient.from("propostas_nativas")
      .update({ versao_atual: versaoNumero })
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
            geracao_mensal_estimada: i === 0 ? round2(geracaoEstimada) : null,
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
      versao_numero: versaoNumero,
      valor_total: valorTotal,
      payback_meses: calcResult.paybackMeses,
      economia_mensal: round2(economiaMensal),
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
