/**
 * Domain resolver: financeiro.* variables
 * Sources: snapshot.financeiro, snapshot top-level, versaoData, ext.projeto
 */
import { type AnyObj, safeObj, safeArr, str, num, fmtCur, fmtNum, type ResolverExternalContext } from "./types.ts";

export function resolveFinanceiro(
  snapshot: AnyObj | null | undefined,
  ext?: ResolverExternalContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  const snap = snapshot ?? {};
  const fin = safeObj(snap.financeiro);
  const versao = ext?.versaoData ?? {};
  const projeto = ext?.projeto ?? {};
  const lead = ext?.lead ?? {};
  const cliente = ext?.cliente ?? {};

  const set = (k: string, v: unknown) => {
    const s = str(v);
    if (s && !out[k]) out[k] = s;
  };
  const setCur = (k: string, v: number | null) => {
    if (v != null && !isNaN(v)) out[k] = fmtCur(v);
  };
  const setCurIfMissing = (k: string, v: number | null) => {
    if (!out[k] && v != null && !isNaN(v)) out[k] = fmtCur(v);
  };

  // ── Valor Total / Preço ──
  const valorTotal = num(versao.valor_total) ?? num(fin.valor_total) ?? num(projeto.valor_total)
    ?? num(lead.valor_estimado) ?? num(cliente.valor_projeto) ?? num(snap.preco_total) ?? num(snap.preco);
  
  if (valorTotal != null && valorTotal > 0) {
    setCur("valor_total", valorTotal);
    out["valor_total_numero"] = fmtNum(valorTotal, 2);
    setCur("preco_final", valorTotal);
    setCur("preco_total", valorTotal);
    setCur("preco", valorTotal);
    setCur("capo_i", valorTotal);
    setCur("vc_a_vista", valorTotal);

    const potencia = num(versao.potencia_kwp) ?? num(projeto.potencia_kwp) ?? num(cliente.potencia_kwp)
      ?? num(snap.potencia_kwp) ?? num(snap.potencia_sistema);
    if (potencia && potencia > 0) {
      out["preco_kwp"] = fmtCur(valorTotal / potencia);
      out["preco_watt"] = `${fmtNum(valorTotal / (potencia * 1000), 2)} R$/W`;
      out["preco_watt_numero"] = fmtNum(valorTotal / (potencia * 1000), 2);
    }
  }

  // ── Economia ──
  const econMensal = num(versao.economia_mensal) ?? num(fin.economia_mensal) ?? num(snap.economia_mensal);
  if (econMensal != null) {
    setCur("economia_mensal", econMensal);
    out["economia_mensal_numero"] = fmtNum(econMensal, 2);
    setCurIfMissing("economia_anual", econMensal * 12);
    if (!out["economia_anual_numero"]) out["economia_anual_numero"] = fmtNum(econMensal * 12, 2);
    setCurIfMissing("roi_25_anos", econMensal * 12 * 25);
    setCurIfMissing("economia_25_anos", econMensal * 12 * 25);
  }

  // ── Economia Percentual ──
  const econPercent = num(versao.economia_mensal_percent) ?? num(fin.economia_mensal_percent) ?? num(snap.economia_mensal_percent) ?? num(snap.economia_percentual);
  if (econPercent != null) {
    out["economia_percentual"] = fmtNum(econPercent, 1) + "%";
    out["economia_mensal_percent"] = fmtNum(econPercent, 1) + "%";
  }

  // ── Payback ──
  const paybackMeses = num(versao.payback_meses) ?? num(fin.payback_meses) ?? num(snap.payback_meses) ?? num(snap.payback);
  if (paybackMeses != null && paybackMeses > 0) {
    const anos = Math.floor(paybackMeses / 12);
    const meses = Math.round(paybackMeses % 12);
    out["payback"] = `${anos} anos e ${meses} meses`;
    out["payback_meses"] = String(paybackMeses);
    out["payback_anos"] = fmtNum(paybackMeses / 12, 1);
  } else {
    // Fallback: snapshot may have payback as pre-formatted string
    const paybackStr = str(snap.payback) ?? str(fin.payback);
    if (paybackStr) out["payback"] = paybackStr;
  }

  // ── Kit Fechado (commercial mode — equipment price only, NOT valor_total) ──
  // kit_fechado_preco_total = sell price of kit equipment = custo_kit * (1 + margem/100)
  const kitFechadoPreco = num(snap.kit_fechado_preco_total) ?? num(fin.kit_fechado_preco_total);
  if (kitFechadoPreco != null && kitFechadoPreco > 0) {
    setCur("kit_fechado_preco_total", kitFechadoPreco);
  } else {
    // Derive from custo_kit + margem if available (equipment sell price only)
    const custoKit = num(fin.custo_kit);
    const margem = num(fin.margem_percentual) ?? 0;
    if (custoKit != null && custoKit > 0) {
      setCur("kit_fechado_preco_total", custoKit * (1 + margem / 100));
    }
  }
  // kit_fechado_custo_total = cost of kit equipment = financeiro.custo_kit
  const kitFechadoCusto = num(snap.kit_fechado_custo_total) ?? num(fin.custo_kit);
  if (kitFechadoCusto != null && kitFechadoCusto > 0) {
    setCur("kit_fechado_custo_total", kitFechadoCusto);
  }

  // ── VPL / TIR / ROI ──
  set("vpl", fin.vpl ?? snap.vpl);
  set("tir", fin.tir ?? snap.tir);
  set("roi_anual", fin.roi_anual ?? snap.roi_anual);

  // ── Equipment costs from snapshot ──
  // ── Financial Center costs (custo_instalacao, custo_comissao, custo_outros) ──
  // Fallback chains: flat → nested (venda.*) → flattened (venda_*) — AP-15 parity
  const venda = safeObj(snap.venda);
  const custoInstalacao = num(fin.custo_instalacao) ?? num(snap.custo_instalacao) ?? num(venda.custo_instalacao) ?? num(snap.venda_custo_instalacao) ?? 0;
  const custoComissao = num(fin.custo_comissao) ?? num(snap.custo_comissao) ?? num(venda.custo_comissao) ?? num(snap.venda_custo_comissao) ?? 0;
  const custoOutros = num(fin.custo_outros) ?? num(snap.custo_outros) ?? num(venda.custo_outros) ?? num(snap.venda_custo_outros) ?? 0;
  const custoKit = num(fin.custo_kit) ?? num(snap.custo_kit) ?? num(snap.custo_kit_override) ?? num(venda.custo_kit_override) ?? num(snap.venda_custo_kit_override) ?? 0;
  const custoTotalCalc = custoKit + custoInstalacao + custoComissao + custoOutros;

  if (custoInstalacao > 0) {
    setCurIfMissing("valor_instalacao", custoInstalacao);
    setCurIfMissing("custo_instalacao_total", custoInstalacao);
    if (!out["valor_instalacao_numero"]) out["valor_instalacao_numero"] = fmtNum(custoInstalacao, 2);
  }
  if (custoComissao > 0) { setCurIfMissing("valor_comissao", custoComissao); setCurIfMissing("comissao_total", custoComissao); }
  if (custoOutros > 0) setCurIfMissing("valor_outros_custos", custoOutros);
  if (custoInstalacao + custoOutros > 0) setCurIfMissing("valor_servicos", custoInstalacao + custoOutros);
  if (custoKit > 0) {
    setCurIfMissing("valor_kit", custoKit);
    if (!out["valor_kit_numero"]) out["valor_kit_numero"] = fmtNum(custoKit, 2);
  }
  if (custoTotalCalc > 0) setCurIfMissing("valor_custo_total", custoTotalCalc);
  if (valorTotal != null && valorTotal > 0 && custoTotalCalc > 0) {
    setCurIfMissing("margem_valor", valorTotal - custoTotalCalc);
    const margemReal = ((valorTotal - custoTotalCalc) / custoTotalCalc) * 100;
    if (!out["margem_real"]) out["margem_real"] = `${fmtNum(margemReal, 1)}%`;
  }
  const margemPct = num(fin.margem_percentual) ?? num(snap.margem_percentual) ?? num(venda.margem_percentual);
  if (margemPct != null && !out["margem_percentual"]) out["margem_percentual"] = `${fmtNum(margemPct, 1)}%`;

  // ── Desconto (D1, QW4 — AP-15 parity with frontend) ──
  const descontoPercent = num(snap.desconto_percentual) ?? num(venda.desconto_percentual) ?? num(fin.desconto_percentual) ?? 0;
  if (!out["desconto_percentual"]) out["desconto_percentual"] = `${fmtNum(descontoPercent, 1)}%`;
  if (descontoPercent > 0 && valorTotal != null && valorTotal > 0) {
    // valorTotal already has discount applied; reverse to find pre-discount
    const precoPreDesconto = valorTotal / (1 - descontoPercent / 100);
    const descontoValor = Math.round(precoPreDesconto * descontoPercent / 100 * 100) / 100;
    if (!out["desconto_valor"]) out["desconto_valor"] = fmtCur(descontoValor);
  } else if (!out["desconto_valor"]) {
    out["desconto_valor"] = fmtCur(0);
  }

  // ── Comissão do consultor (D3 — AP-15 parity with frontend) ──
  const pctComissao = num(snap.percentual_comissao_consultor) ?? num(venda.percentual_comissao_consultor) ?? num(fin.percentual_comissao_consultor);
  if (pctComissao != null && !out["percentual_comissao"]) out["percentual_comissao"] = `${fmtNum(pctComissao, 1)}%`;
  const consultorNomeComissao = str(snap.consultor_nome_comissao) ?? str(venda.consultor_nome_comissao) ?? str(fin.consultor_nome_comissao);
  if (consultorNomeComissao && !out["consultor_comissao"]) out["consultor_comissao"] = consultorNomeComissao;

  const costFields = [
    "modulo_custo_un", "modulo_preco_un", "modulo_custo_total", "modulo_preco_total",
    "inversor_custo_un", "inversor_preco_un", "inversor_custo_total", "inversor_preco_total",
    "inversores_custo_total", "inversores_preco_total",
    "otimizador_custo_un", "otimizador_preco_un", "otimizador_custo_total", "otimizador_preco_total",
    "kit_fechado_custo_total",
    "instalacao_custo_total", "instalacao_preco_total",
    "estrutura_custo_total", "estrutura_preco_total",
    "equipamentos_custo_total", "kits_custo_total", "componentes_custo_total",
    "baterias_custo_total", "baterias_preco_total",
    "margem_lucro", "desconto_percentual", "desconto_valor",
    "custo_modulos", "custo_inversores", "custo_estrutura", "custo_instalacao", "custo_kit",
    "comissao_percentual", "comissao_valor", "comissao_res", "comissao_rep",
    "distribuidor_categoria", "preco_por_extenso",
    "kit_fechado_preco_total",
  ];
  for (const k of costFields) set(k, snap[k]);

  // ── Indexed inverter/battery/transformer costs ──
  for (let i = 1; i <= 5; i++) {
    for (const prefix of ["inversor_custo_un_", "inversor_preco_un_", "inversor_preco_total_",
      "transformador_custo_un_", "transformador_preco_un_",
      "bateria_custo_un_", "bateria_preco_un_", "bateria_preco_total_",
      "item_a_nome_", "item_a_custo_", "item_a_preco_"]) {
      set(`${prefix}${i}`, snap[`${prefix}${i}`]);
    }
  }

  // ── Derive indexed costs from itens[] when snapshot lacks them ──
  const itens = safeArr(snap.itens).length > 0 ? safeArr(snap.itens) : (() => {
    const kits = safeArr(snap.manualKits);
    const idx = Number(snap.selectedKitIndex ?? 0);
    const kit = kits[idx] ? safeObj(kits[idx]) : {};
    return safeArr(kit.itens);
  })();

  const isBateria = (item: AnyObj) => {
    const cat = String(item.categoria ?? "").toLowerCase();
    const tipo = String(item.tipo ?? "").toLowerCase();
    return cat.includes("bateria") || cat === "battery" || tipo.includes("bateria");
  };
  const isTransformador = (item: AnyObj) => {
    const cat = String(item.categoria ?? "").toLowerCase();
    const tipo = String(item.tipo ?? "").toLowerCase();
    return cat.includes("transformador") || tipo.includes("transformador");
  };

  const bateriaItens = itens.filter(isBateria);
  const transformadorItens = itens.filter(isTransformador);

  // Indexed battery costs from itens[]
  bateriaItens.forEach((bat, idx) => {
    const i = idx + 1;
    const custoUn = num(bat.custo_unitario) ?? num(bat.preco_custo);
    const precoUn = num(bat.preco_unitario) ?? num(bat.preco_venda);
    const qty = num(bat.quantidade) ?? 1;
    if (custoUn != null) setCurIfMissing(`bateria_custo_un_${i}`, custoUn);
    if (precoUn != null) setCurIfMissing(`bateria_preco_un_${i}`, precoUn);
    if (precoUn != null) setCurIfMissing(`bateria_preco_total_${i}`, precoUn * qty);
  });

  // Indexed transformer costs from itens[]
  transformadorItens.forEach((tr, idx) => {
    const i = idx + 1;
    const custoUn = num(tr.custo_unitario) ?? num(tr.preco_custo);
    const precoUn = num(tr.preco_unitario) ?? num(tr.preco_venda);
    if (custoUn != null) setCurIfMissing(`transformador_custo_un_${i}`, custoUn);
    if (precoUn != null) setCurIfMissing(`transformador_preco_un_${i}`, precoUn);
  });

  // Concatenated battery cost/price variables (all batteries joined)
  if (bateriaItens.length > 0) {
    const custoUnArr: string[] = [];
    const precoUnArr: string[] = [];
    const custoTotalArr: string[] = [];
    const precoTotalArr: string[] = [];
    let custoTotalSum = 0;
    let precoTotalSum = 0;

    bateriaItens.forEach((bat) => {
      const custoUn = num(bat.custo_unitario) ?? num(bat.preco_custo);
      const precoUn = num(bat.preco_unitario) ?? num(bat.preco_venda);
      const qty = num(bat.quantidade) ?? 1;
      if (custoUn != null) { custoUnArr.push(fmtCur(custoUn)); custoTotalArr.push(fmtCur(custoUn * qty)); custoTotalSum += custoUn * qty; }
      if (precoUn != null) { precoUnArr.push(fmtCur(precoUn)); precoTotalArr.push(fmtCur(precoUn * qty)); precoTotalSum += precoUn * qty; }
    });

    if (custoUnArr.length > 0) {
      setCurIfMissing("bateria_custo_un", custoUnArr.length === 1 ? num(bateriaItens[0].custo_unitario ?? bateriaItens[0].preco_custo)! : custoTotalSum);
      setCurIfMissing("bateria_custo_total", custoTotalSum);
    }
    if (precoUnArr.length > 0) {
      setCurIfMissing("bateria_preco_un", precoUnArr.length === 1 ? num(bateriaItens[0].preco_unitario ?? bateriaItens[0].preco_venda)! : precoTotalSum);
      setCurIfMissing("bateria_preco_total", precoTotalSum);
    }
  }
  set("transformadores_custo_total", snap.transformadores_custo_total);
  set("transformadores_preco_total", snap.transformadores_preco_total);

  // ── Indexed f_* (from snapshot direct — pagamento resolver handles from array) ──
  for (let i = 1; i <= 5; i++) {
    for (const k of ["f_nome_", "f_entrada_", "f_entrada_p_", "f_valor_", "f_valor_p_",
      "f_prazo_", "f_carencia_", "f_taxa_", "f_parcela_"]) {
      set(`${k}${i}`, snap[`${k}${i}`]);
    }
  }
  for (const k of ["f_ativo_nome", "f_ativo_entrada", "f_ativo_entrada_p", "f_ativo_valor",
    "f_ativo_valor_p", "f_ativo_prazo", "f_ativo_carencia", "f_ativo_taxa", "f_ativo_parcela",
    "f_banco", "f_taxa_juros", "f_parcelas", "f_valor_parcela", "f_entrada", "f_valor_financiado", "f_cet"]) {
    set(k, snap[k]);
  }

  // ── Annual series ──
  for (let i = 0; i <= 25; i++) {
    for (const prefix of ["investimento_anual_", "economia_anual_valor_", "fluxo_caixa_acumulado_anual_"]) {
      set(`${prefix}${i}`, snap[`${prefix}${i}`]);
    }
  }
  for (const k of ["solar_25", "renda_25", "poupanca_25"]) set(k, snap[k]);

  // ── Legacy aliases (retrocompatibilidade com templates antigos) ──
  if (out["solar_25"]) set("solar_25_anos", out["solar_25"]);
  if (out["renda_25"]) set("renda_fixa_25_anos", out["renda_25"]);
  if (out["poupanca_25"]) set("poupanca_25_anos", out["poupanca_25"]);

  // ── Battery singular→plural fallback aliases ──
  // Catalog defines singular as "concatenated" and plural as "summed aggregate".
  // When snapshot lacks concatenated values (Phase 2B), fallback to aggregate total.
  if (out["baterias_custo_total"] && !out["bateria_custo_total"]) {
    out["bateria_custo_total"] = out["baterias_custo_total"];
  }
  if (out["baterias_preco_total"] && !out["bateria_preco_total"]) {
    out["bateria_preco_total"] = out["baterias_preco_total"];
  }

  // ── Comissão percentual (derivado de comissao_res/rep + valor_total) ──
  if (valorTotal && valorTotal > 0) {
    const comRes = num(snap.comissao_res) ?? num(fin.comissao_res);
    if (comRes != null) set("comissao_res_p", `${fmtNum((comRes / valorTotal) * 100, 2)}%`);
    const comRep = num(snap.comissao_rep) ?? num(fin.comissao_rep);
    if (comRep != null) set("comissao_rep_p", `${fmtNum((comRep / valorTotal) * 100, 2)}%`);
  }

  return out;
}
