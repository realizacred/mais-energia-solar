import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ──────────────────────────────────────────────────

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
  variaveis_custom?: boolean; // if true, evaluate tenant vc_* variables
}

// ─── 25-Year Series Calculator ──────────────────────────────

interface SeriesRow {
  ano: number;
  geracao_kwh: number;
  economia_bruta: number;
  custo_fio_b: number;
  economia_liquida: number;
  economia_acumulada: number;
  custo_extra: number; // inverter replacement
  fluxo_caixa: number;
  fluxo_caixa_acumulado: number;
  vpl_parcial: number;
}

function calcSeries25(params: {
  investimentoTotal: number;
  economiaMensalAno1: number;
  inflacaoEnergetica: number;
  perdaEficienciaAnual: number;
  trocaInversorAnos: number;
  trocaInversorCustoPct: number;
  vplTaxaDesconto: number;
}): { series: SeriesRow[]; paybackAnos: number; vpl: number; tir: number } {
  const {
    investimentoTotal, economiaMensalAno1, inflacaoEnergetica,
    perdaEficienciaAnual, trocaInversorAnos, trocaInversorCustoPct,
    vplTaxaDesconto,
  } = params;

  const series: SeriesRow[] = [];
  let acumulado = 0;
  let fluxoAcumulado = -investimentoTotal;
  let vplTotal = -investimentoTotal;
  let paybackAnos = 0;
  const taxaDesc = vplTaxaDesconto / 100;

  for (let ano = 1; ano <= 25; ano++) {
    const degradacao = Math.pow(1 - perdaEficienciaAnual / 100, ano - 1);
    const inflacao = Math.pow(1 + inflacaoEnergetica / 100, ano - 1);
    const economiaAnual = economiaMensalAno1 * 12 * degradacao * inflacao;
    
    let custoExtra = 0;
    if (trocaInversorAnos > 0 && ano === trocaInversorAnos) {
      custoExtra = investimentoTotal * (trocaInversorCustoPct / 100);
    }

    const fluxo = economiaAnual - custoExtra;
    acumulado += economiaAnual;
    fluxoAcumulado += fluxo;
    
    const vplParcial = fluxo / Math.pow(1 + taxaDesc, ano);
    vplTotal += vplParcial;

    if (paybackAnos === 0 && fluxoAcumulado >= 0) {
      paybackAnos = ano;
    }

    series.push({
      ano,
      geracao_kwh: 0, // filled by caller if needed
      economia_bruta: round2(economiaAnual),
      custo_fio_b: 0,
      economia_liquida: round2(economiaAnual),
      economia_acumulada: round2(acumulado),
      custo_extra: round2(custoExtra),
      fluxo_caixa: round2(fluxo),
      fluxo_caixa_acumulado: round2(fluxoAcumulado),
      vpl_parcial: round2(vplParcial),
    });
  }

  // Simple TIR approximation via bisection
  const tir = calcTIR(investimentoTotal, series.map(s => s.fluxo_caixa + (s.ano === 1 ? 0 : 0)));

  return { series, paybackAnos, vpl: round2(vplTotal), tir: round2(tir) };
}

function calcTIR(investimento: number, fluxos: number[]): number {
  let lo = -0.5, hi = 5.0;
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    let npv = -investimento;
    for (let i = 0; i < fluxos.length; i++) {
      npv += fluxos[i] / Math.pow(1 + mid, i + 1);
    }
    if (Math.abs(npv) < 0.01) return mid * 100;
    if (npv > 0) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ─── Safe Expression Evaluator (mirrors src/lib/expressionEngine.ts) ─────
function evaluateExpression(expr: string, ctx: Record<string, number>): number | null {
  try {
    if (!expr || expr.trim() === "") return null;
    // Replace [var] with values
    let resolved = expr;
    const matches = expr.match(/\[([^\]]+)\]/g);
    if (matches) {
      for (const m of matches) {
        const name = m.slice(1, -1).trim();
        const val = ctx[name] ?? 0;
        resolved = resolved.replace(m, String(val));
      }
    }
    // Only allow: digits, dots, operators, parens, spaces, minus
    if (/[^0-9.+\-*/() \t]/.test(resolved)) return null;
    // Use Function for safe math-only evaluation
    const fn = new Function(`"use strict"; return (${resolved});`);
    const result = fn();
    return typeof result === "number" && isFinite(result) ? Math.round(result * 10000) / 10000 : null;
  } catch {
    return null;
  }
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
      return jsonError("Não autorizado", 401);
    }

    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return jsonError("Token inválido", 401);
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Resolve tenant
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id, ativo")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id || !profile.ativo) {
      return jsonError("Usuário inativo ou sem tenant", 403);
    }
    const tenantId = profile.tenant_id;

    // Verificar tenant ativo
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("id, status, nome, estado")
      .eq("id", tenantId)
      .single();

    if (!tenant || tenant.status !== "active") {
      return jsonError("Tenant suspenso ou inativo", 403);
    }

    // Verificar permissão
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const allowedRoles = ["admin", "gerente", "financeiro", "consultor"];
    const hasPermission = roles?.some((r: any) => allowedRoles.includes(r.role));
    if (!hasPermission) {
      return jsonError("Sem permissão para gerar propostas", 403);
    }

    // ── 2. PARSE PAYLOAD ────────────────────────────────────
    const body: GenerateRequestV2 = await req.json();

    if (!body.lead_id || !body.grupo || !body.ucs?.length || !body.itens?.length) {
      return jsonError("Campos obrigatórios: lead_id, grupo, ucs, itens", 400);
    }
    if (!body.idempotency_key) {
      return jsonError("idempotency_key é obrigatório", 400);
    }
    if (!["A", "B"].includes(body.grupo)) {
      return jsonError("grupo deve ser A ou B", 400);
    }

    // ── 3. IDEMPOTÊNCIA ─────────────────────────────────────
    const { data: existingVersion } = await adminClient
      .from("proposta_versoes")
      .select("id, proposta_id, versao_numero, valor_total, payback_meses, economia_mensal")
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
      });
    }

    // ── 4. DADOS AUXILIARES ─────────────────────────────────
    const uc1 = body.ucs[0];
    const estado = uc1.estado;
    const anoAtual = new Date().getFullYear();

    // Load tenant default premissas (fallback to payload or hardcoded)
    let premissas = body.premissas;
    if (!premissas || Object.keys(premissas).length === 0) {
      const { data: defaults } = await adminClient
        .from("premissas_default_tenant")
        .select("inflacao_energetica, inflacao_ipca, taxa_desconto_vpl, perda_eficiencia_anual, sobredimensionamento, troca_inversor_ano, troca_inversor_custo_percentual")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (defaults) {
        premissas = {
          imposto: 0,
          inflacao_energetica: defaults.inflacao_energetica ?? 6.5,
          inflacao_ipca: defaults.inflacao_ipca ?? 4.5,
          perda_eficiencia_anual: defaults.perda_eficiencia_anual ?? 0.5,
          sobredimensionamento: defaults.sobredimensionamento ?? 0,
          troca_inversor_anos: defaults.troca_inversor_ano ?? 15,
          troca_inversor_custo: defaults.troca_inversor_custo_percentual ?? 30,
          vpl_taxa_desconto: defaults.taxa_desconto_vpl ?? 10,
        };
      } else {
        premissas = {
          imposto: 0, inflacao_energetica: 6.5, inflacao_ipca: 4.5,
          perda_eficiencia_anual: 0.5, sobredimensionamento: 0,
          troca_inversor_anos: 15, troca_inversor_custo: 30, vpl_taxa_desconto: 10,
        };
      }
    }

    // Fio B
    const { data: fioBRows } = await adminClient
      .from("fio_b_escalonamento")
      .select("ano, percentual_nao_compensado, tenant_id")
      .eq("ano", anoAtual)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .order("tenant_id", { ascending: false, nullsFirst: false })
      .limit(1);
    const percentualFioB = fioBRows?.[0]?.percentual_nao_compensado ?? 0;

    // Tributação
    const { data: tributacao } = await adminClient
      .from("config_tributaria_estado")
      .select("aliquota_icms, possui_isencao_scee, percentual_isencao")
      .eq("estado", estado)
      .maybeSingle();

    // Irradiação
    const { data: irradiacao } = await adminClient
      .from("irradiacao_por_estado")
      .select("geracao_media_kwp_mes")
      .eq("estado", estado)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .order("tenant_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const geracaoMediaKwpMes = irradiacao?.geracao_media_kwp_mes ?? 120;

    // ── 5. CÁLCULO ──────────────────────────────────────────
    const potenciaKwp = body.potencia_kwp;
    const consumoTotal = body.ucs.reduce((s, uc) => {
      if (uc.tipo_dimensionamento === "MT") return s + uc.consumo_mensal_p + uc.consumo_mensal_fp;
      return s + uc.consumo_mensal;
    }, 0);

    const geracaoEstimada = potenciaKwp * geracaoMediaKwpMes;
    const tarifaMedia = uc1.tarifa_distribuidora || 0.85;
    const energiaCompensavel = Math.min(geracaoEstimada, consumoTotal);
    const fioBAplicavel = body.grupo === "B" ? percentualFioB / 100 : 0;
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

    // 25-year series
    const { series, paybackAnos, vpl, tir } = calcSeries25({
      investimentoTotal: valorTotal,
      economiaMensalAno1: economiaMensal,
      inflacaoEnergetica: premissas.inflacao_energetica,
      perdaEficienciaAnual: premissas.perda_eficiencia_anual,
      trocaInversorAnos: premissas.troca_inversor_anos,
      trocaInversorCustoPct: premissas.troca_inversor_custo,
      vplTaxaDesconto: premissas.vpl_taxa_desconto,
    });

    const paybackMeses = economiaMensal > 0 ? Math.ceil(valorTotal / economiaMensal) : 0;

    // ── 5b. CUSTOM VARIABLES (vc_*) ─────────────────────────
    let vcResults: Array<{ variavel_id: string; nome: string; label: string; expressao: string; valor_calculado: string | null }> = [];

    if (body.variaveis_custom !== false) {
      const { data: vcDefs } = await adminClient
        .from("proposta_variaveis_custom")
        .select("id, nome, label, expressao, tipo_resultado")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("ordem");

      if (vcDefs && vcDefs.length > 0) {
        const numModulos = body.itens.filter((it: any) => it.categoria === "modulo").reduce((s: number, it: any) => s + it.quantidade, 0);
        const ctx: Record<string, number> = {
          valor_total: valorTotal,
          economia_mensal: round2(economiaMensal),
          economia_anual: round2(economiaMensal * 12),
          payback_meses: paybackMeses,
          payback_anos: paybackAnos,
          potencia_kwp: potenciaKwp,
          consumo_total: consumoTotal,
          geracao_estimada: round2(geracaoEstimada),
          custo_kit: round2(custoKit),
          margem_percentual: venda.margem_percentual,
          desconto_percentual: venda.desconto_percentual,
          vpl,
          tir,
          roi_25_anos: round2(economiaMensal * 12 * 25),
          num_modulos: numModulos,
          num_ucs: body.ucs.length,
        };

        for (const vc of vcDefs) {
          try {
            const val = evaluateExpression(vc.expressao, ctx);
            vcResults.push({
              variavel_id: vc.id,
              nome: vc.nome,
              label: vc.label,
              expressao: vc.expressao,
              valor_calculado: val !== null ? String(val) : null,
            });
          } catch {
            vcResults.push({
              variavel_id: vc.id,
              nome: vc.nome,
              label: vc.label,
              expressao: vc.expressao,
              valor_calculado: null,
            });
          }
        }
      }
    }

    // Resolver consultor_id
    const { data: consultor } = await adminClient
      .from("consultores")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .maybeSingle();
    const consultorId = consultor?.id ?? null;

    // ── 6. SNAPSHOT IMUTÁVEL ────────────────────────────────
    const snapshot = {
      versao_schema: 2,
      gerado_em: new Date().toISOString(),
      grupo: body.grupo,
      regra_lei_14300: {
        versao: `${anoAtual}-01`,
        fio_b_ano: anoAtual,
        percentual_fio_b: fioBAplicavel,
        percentual_nao_compensado: percentualFioB,
        fonte: fioBRows?.[0] ? "fio_b_escalonamento" : "fallback_zero",
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
        economia_anual: round2(economiaMensal * 12),
        payback_meses: paybackMeses,
        payback_anos: paybackAnos,
        vpl,
        tir,
        roi_25_anos: round2(economiaMensal * 12 * 25),
      },
      pagamento_opcoes: body.pagamento_opcoes ?? [],
      variaveis_custom: vcResults.length > 0 ? vcResults : undefined,
      inputs: {
        lead_id: body.lead_id,
        projeto_id: body.projeto_id ?? null,
        cliente_id: body.cliente_id ?? null,
        template_id: body.template_id ?? null,
        consultor_id: consultorId,
        user_id: userId,
      },
    };

    // ── 7. CRIAR OU REUTILIZAR propostas_nativas ────────────
    let propostaId: string;

    const matchFilter: any = { tenant_id: tenantId, lead_id: body.lead_id };
    if (body.projeto_id) matchFilter.projeto_id = body.projeto_id;

    const { data: existingProposta } = await adminClient
      .from("propostas_nativas")
      .select("id")
      .match(matchFilter)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingProposta) {
      propostaId = existingProposta.id;
    } else {
      const { data: lead } = await adminClient
        .from("leads")
        .select("nome, lead_code")
        .eq("id", body.lead_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!lead) {
        return jsonError("Lead não encontrado neste tenant", 404);
      }

      const titulo = `Proposta ${lead.lead_code ?? ""} - ${lead.nome}`.trim();
      const { data: novaProposta, error: insertErr } = await adminClient
        .from("propostas_nativas")
        .insert({
          tenant_id: tenantId,
          lead_id: body.lead_id,
          projeto_id: body.projeto_id ?? null,
          cliente_id: body.cliente_id ?? null,
          consultor_id: consultorId,
          template_id: body.template_id ?? null,
          titulo,
          codigo: lead.lead_code ? `PROP-${lead.lead_code}` : null,
          versao_atual: 0,
          created_by: userId,
        })
        .select("id")
        .single();

      if (insertErr || !novaProposta) {
        return jsonError(`Erro ao criar proposta: ${insertErr?.message}`, 500);
      }
      propostaId = novaProposta.id;
    }

    // ── 8. VERSÃO ATÔMICA via RPC ───────────────────────────
    const { data: versaoNumero, error: rpcErr } = await adminClient.rpc(
      "next_proposta_versao_numero",
      { _proposta_id: propostaId }
    );

    if (rpcErr || !versaoNumero) {
      return jsonError(`Erro ao gerar número de versão: ${rpcErr?.message}`, 500);
    }

    // ── 9. INSERIR proposta_versoes ─────────────────────────
    const { data: versao, error: versaoErr } = await adminClient
      .from("proposta_versoes")
      .insert({
        tenant_id: tenantId,
        proposta_id: propostaId,
        versao_numero: versaoNumero,
        status: "generated",
        grupo: body.grupo,
        potencia_kwp: potenciaKwp,
        valor_total: valorTotal,
        economia_mensal: round2(economiaMensal),
        payback_meses: paybackMeses,
        validade_dias: 30,
        valido_ate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        snapshot,
        snapshot_locked: true,
        idempotency_key: body.idempotency_key,
        observacoes: body.observacoes ?? null,
        gerado_por: userId,
        gerado_em: new Date().toISOString(),
      })
      .select("id, versao_numero, valor_total, payback_meses, economia_mensal")
      .single();

    if (versaoErr) {
      if (versaoErr.code === "23505") {
        const { data: dup } = await adminClient
          .from("proposta_versoes")
          .select("id, proposta_id, versao_numero, valor_total, payback_meses, economia_mensal")
          .eq("tenant_id", tenantId)
          .eq("idempotency_key", body.idempotency_key)
          .single();
        if (dup) {
          return jsonOk({
            success: true, idempotent: true,
            proposta_id: dup.proposta_id, versao_id: dup.id,
            versao_numero: dup.versao_numero, valor_total: dup.valor_total,
            payback_meses: dup.payback_meses, economia_mensal: dup.economia_mensal,
          });
        }
      }
      return jsonError(`Erro ao criar versão: ${versaoErr.message}`, 500);
    }

    const versaoId = versao!.id;

    // ── 9b. ATUALIZAR STATUS DA PROPOSTA ────────────────────
    await adminClient
      .from("propostas_nativas")
      .update({ status: "gerada", versao_atual: versao!.versao_numero })
      .eq("id", propostaId)
      .eq("tenant_id", tenantId);
    // Fire-and-forget: non-critical, snapshot is the source of truth
    try {
      const granularOps = [];

      // UCs
      if (body.ucs.length > 0) {
        granularOps.push(
          adminClient.from("proposta_ucs").insert(
            body.ucs.map((uc, i) => ({
              tenant_id: tenantId,
              versao_id: versaoId,
              uc_index: i + 1,
              nome: uc.nome,
              tipo_dimensionamento: uc.tipo_dimensionamento,
              distribuidora: uc.distribuidora,
              distribuidora_id: uc.distribuidora_id || null,
              subgrupo: uc.subgrupo,
              estado: uc.estado,
              cidade: uc.cidade,
              fase: uc.fase,
              tensao_rede: uc.tensao_rede,
              consumo_mensal: uc.consumo_mensal,
              consumo_meses: uc.consumo_meses,
              consumo_mensal_p: uc.consumo_mensal_p,
              consumo_mensal_fp: uc.consumo_mensal_fp,
              tarifa_distribuidora: uc.tarifa_distribuidora,
              custo_disponibilidade_kwh: uc.custo_disponibilidade_kwh,
              custo_disponibilidade_valor: uc.custo_disponibilidade_valor,
              distancia_km: uc.distancia,
              tipo_telhado: uc.tipo_telhado,
              inclinacao: uc.inclinacao,
              desvio_azimutal: uc.desvio_azimutal,
              taxa_desempenho: uc.taxa_desempenho,
              rateio_creditos: uc.rateio_creditos,
              fator_simultaneidade: uc.fator_simultaneidade,
            }))
          )
        );
      }

      // Premissas
      granularOps.push(
        adminClient.from("proposta_premissas").insert({
          tenant_id: tenantId,
          versao_id: versaoId,
          imposto: premissas.imposto,
          inflacao_energetica: premissas.inflacao_energetica,
          inflacao_ipca: premissas.inflacao_ipca,
          perda_eficiencia_anual: premissas.perda_eficiencia_anual,
          sobredimensionamento: premissas.sobredimensionamento,
          troca_inversor_anos: premissas.troca_inversor_anos,
          troca_inversor_custo_pct: premissas.troca_inversor_custo,
          vpl_taxa_desconto: premissas.vpl_taxa_desconto,
        })
      );

      // Kit
      granularOps.push(
        adminClient.from("proposta_kits").insert({
          tenant_id: tenantId,
          versao_id: versaoId,
          tipo_kit: "customizado",
          tipo_sistema: "on_grid",
          topologia: "tradicional",
          custo_total: round2(custoKit),
        }).select("id").single().then(async ({ data: kit }) => {
          if (kit && body.itens.length > 0) {
            await adminClient.from("proposta_kit_itens").insert(
              body.itens.map((it, i) => ({
                tenant_id: tenantId,
                kit_id: kit.id,
                ordem: i + 1,
                descricao: it.descricao,
                fabricante: it.fabricante,
                modelo: it.modelo,
                potencia_w: it.potencia_w,
                quantidade: it.quantidade,
                preco_unitario: it.preco_unitario,
                subtotal: round2(it.quantidade * it.preco_unitario),
                categoria: it.categoria,
                avulso: it.avulso,
              }))
            );
          }
        })
      );

      // Serviços
      if (body.servicos.length > 0) {
        granularOps.push(
          adminClient.from("proposta_servicos").insert(
            body.servicos.map((s, i) => ({
              tenant_id: tenantId,
              versao_id: versaoId,
              ordem: i + 1,
              descricao: s.descricao,
              categoria: s.categoria,
              valor: s.valor,
              incluso_no_preco: s.incluso_no_preco,
            }))
          )
        );
      }

      // Venda
      granularOps.push(
        adminClient.from("proposta_venda").insert({
          tenant_id: tenantId,
          versao_id: versaoId,
          custo_equipamentos: round2(custoKit),
          custo_servicos: round2(custoServicosInclusos),
          custo_comissao: round2(venda.custo_comissao),
          custo_outros: round2(venda.custo_outros),
          margem_percentual: venda.margem_percentual,
          margem_valor: round2(margemValor),
          desconto_percentual: venda.desconto_percentual,
          desconto_valor: round2(descontoValor),
          preco_final: valorTotal,
          observacoes: venda.observacoes,
        })
      );

      // Pagamento opções
      if (body.pagamento_opcoes?.length > 0) {
        granularOps.push(
          adminClient.from("proposta_pagamento_opcoes").insert(
            body.pagamento_opcoes.map((p, i) => ({
              tenant_id: tenantId,
              versao_id: versaoId,
              ordem: i + 1,
              nome: p.nome,
              tipo: p.tipo,
              valor_financiado: p.valor_financiado,
              entrada: p.entrada,
              taxa_mensal: p.taxa_mensal,
              carencia_meses: p.carencia_meses,
              num_parcelas: p.num_parcelas,
              valor_parcela: p.valor_parcela,
            }))
          )
        );
      }

      // Series 25 anos
      if (series.length > 0) {
        granularOps.push(
          adminClient.from("proposta_series").insert(
            series.map(s => ({
              tenant_id: tenantId,
              versao_id: versaoId,
              ano: s.ano,
              geracao_kwh: s.geracao_kwh,
              economia_bruta: s.economia_bruta,
              custo_fio_b: s.custo_fio_b,
              economia_liquida: s.economia_liquida,
              economia_acumulada: s.economia_acumulada,
              fluxo_caixa: s.fluxo_caixa,
              fluxo_caixa_acumulado: s.fluxo_caixa_acumulado,
              vpl_parcial: s.vpl_parcial,
            }))
          )
        );
      }

      // Custom variables (vc_*)
      if (vcResults.length > 0) {
        granularOps.push(
          adminClient.from("proposta_versao_variaveis").insert(
            vcResults.map(vc => ({
              tenant_id: tenantId,
              versao_id: versaoId,
              variavel_id: vc.variavel_id,
              nome: vc.nome,
              label: vc.label,
              expressao: vc.expressao,
              valor_calculado: vc.valor_calculado,
            }))
          )
        );
      }

      await Promise.allSettled(granularOps);
    } catch (granularErr) {
      // Log but don't fail — snapshot is the source of truth
      console.warn("[proposal-generate] Granular persistence partial failure:", granularErr);
    }

    return jsonOk({
      success: true,
      idempotent: false,
      proposta_id: propostaId,
      versao_id: versaoId,
      versao_numero: versao!.versao_numero,
      valor_total: versao!.valor_total,
      payback_meses: versao!.payback_meses,
      economia_mensal: versao!.economia_mensal,
      vpl,
      tir,
      payback_anos: paybackAnos,
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
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
