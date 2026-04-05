/**
 * calcFinancialSeries.ts — Pure financial calculator for snapshot enrichment.
 *
 * Extracts the 25-year series, payback, TIR, VPL, economia, and gasto calculations
 * from StepPagamento into a reusable pure function.
 *
 * SSOT: StepPagamento uses identical logic for preview. This function is the
 * canonical source for persisting financial fields into the snapshot.
 *
 * Usage: called by collectSnapshot() in ProposalWizard before saving.
 */

export interface FinancialSeriesInput {
  precoFinal: number;
  potenciaKwp: number;
  irradiacao: number;
  geracaoMensalKwh: number;
  consumoTotal: number;
  tarifaBase: number;
  custoDisponibilidade: number;
  premissas: {
    inflacao_energetica?: number;
    perda_eficiencia_anual?: number;
    vpl_taxa_desconto?: number;
    troca_inversor_anos?: number;
    troca_inversor_custo?: number;
  } | null;
}

export interface FinancialSeriesOutput {
  /** gasto_atual_mensal = consumo × tarifa */
  gasto_atual_mensal: number;
  /** alias */
  gasto_energia_mensal_atual: number;
  /** gasto_total_mensal_atual = gasto_atual_mensal (for templates) */
  gasto_total_mensal_atual: number;
  /** gasto after solar = custo_disponibilidade */
  gasto_total_mensal_novo: number;
  /** economia_mensal = gasto_atual - gasto_novo */
  economia_mensal: number;
  /** economia_mensal_p = percentage */
  economia_mensal_p: number;
  /** economia_anual */
  economia_anual: number;
  /** payback in total months */
  payback_meses: number;
  /** TIR (%) */
  tir: number;
  /** VPL (R$) */
  vpl: number;
  /** 25-year annual series (index 0 = year 0) */
  economia_anual_valor: number[];
  geracao_anual: number[];
  fluxo_caixa_acumulado_anual: number[];
  investimento_anual: number[];
  tarifa_distribuidora_series: number[];
}

/**
 * Computes all financial series for snapshot enrichment.
 * Logic mirrors StepPagamento's fluxoCaixaData + paybackInfo calculations.
 */
export function calcFinancialSeries(input: FinancialSeriesInput): FinancialSeriesOutput {
  const {
    precoFinal,
    potenciaKwp,
    irradiacao,
    geracaoMensalKwh,
    consumoTotal,
    tarifaBase,
    custoDisponibilidade,
    premissas: prem,
  } = input;

  const inflacaoRate = ((prem?.inflacao_energetica ?? 9.5) / 100);
  const degradacaoRate = ((prem?.perda_eficiencia_anual ?? 0.5) / 100);
  const trocaInversorAnos = prem?.troca_inversor_anos ?? 15;
  const trocaInversorCustoPct = (prem?.troca_inversor_custo ?? 30) / 100;
  const vplTaxaDesconto = (prem?.vpl_taxa_desconto ?? 10) / 100;

  // Geração
  const geracaoMensalCalculada = potenciaKwp * (irradiacao || 4.5) * 30 * 0.80;
  const geracaoMensalBase = geracaoMensalKwh > 0 ? geracaoMensalKwh : geracaoMensalCalculada;
  const geracaoAnualBase = geracaoMensalBase * 12;

  // Gasto atual
  const gastoAtualMensal = consumoTotal > 0 ? consumoTotal * tarifaBase : geracaoMensalBase * tarifaBase;
  const gastoNovoMensal = custoDisponibilidade;
  const economiaMensal = Math.max(0, gastoAtualMensal - gastoNovoMensal);
  const economiaPercent = gastoAtualMensal > 0 ? (economiaMensal / gastoAtualMensal * 100) : 0;

  // 25-year series
  const economiaAnualArr: number[] = [];
  const geracaoAnualArr: number[] = [];
  const fluxoAcumuladoArr: number[] = [];
  const investimentoArr: number[] = [];
  const tarifaArr: number[] = [];
  const fluxosLiquidos: number[] = [];

  let fluxoAcumulado = -precoFinal;

  // Year 0
  economiaAnualArr.push(0);
  geracaoAnualArr.push(0);
  fluxoAcumuladoArr.push(Math.round(fluxoAcumulado * 100) / 100);
  investimentoArr.push(-precoFinal);
  tarifaArr.push(tarifaBase);

  for (let ano = 1; ano <= 25; ano++) {
    const degradacao = Math.pow(1 - degradacaoRate, ano - 1);
    const inflacao = Math.pow(1 + inflacaoRate, ano - 1);
    const tarifaVigente = Math.round(tarifaBase * inflacao * 100) / 100;
    const geracaoAnual = Math.round(geracaoAnualBase * degradacao * 100) / 100;
    const economiaBruta = Math.round(geracaoAnual * tarifaVigente * 100) / 100;

    // Fio B simplified (same as StepPagamento)
    const fioBPct = 0.15;
    const custoFioB = Math.round(geracaoAnual * tarifaVigente * 0.28 * fioBPct * 100) / 100;
    const economiaLiquida = Math.round((economiaBruta - custoFioB) * 100) / 100;

    // Troca de inversor
    let custoExtra = 0;
    if (trocaInversorAnos > 0 && ano === trocaInversorAnos) {
      custoExtra = Math.round(precoFinal * trocaInversorCustoPct * 100) / 100;
    }

    const fluxo = economiaLiquida - custoExtra;
    fluxoAcumulado += fluxo;

    economiaAnualArr.push(economiaLiquida);
    geracaoAnualArr.push(geracaoAnual);
    fluxoAcumuladoArr.push(Math.round(fluxoAcumulado * 100) / 100);
    investimentoArr.push(-custoExtra);
    tarifaArr.push(tarifaVigente);
    fluxosLiquidos.push(economiaLiquida - custoExtra);
  }

  // Payback
  let paybackMesesTotal = 300; // default 25 years
  const paybackRow = fluxoAcumuladoArr.findIndex((v, i) => i > 0 && v >= 0);
  if (paybackRow > 0) {
    const prev = fluxoAcumuladoArr[paybackRow - 1];
    const curr = fluxoAcumuladoArr[paybackRow];
    const frac = prev < 0 && curr >= 0 ? Math.abs(prev) / (curr - prev) : 0;
    paybackMesesTotal = Math.round(((paybackRow - 1) + frac) * 12);
  }

  // TIR via bisection
  let lo = -0.5, hi = 5.0;
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    let npv = -precoFinal;
    for (let i = 0; i < fluxosLiquidos.length; i++) {
      npv += fluxosLiquidos[i] / Math.pow(1 + mid, i + 1);
    }
    if (Math.abs(npv) < 0.01) { lo = mid; hi = mid; break; }
    if (npv > 0) lo = mid; else hi = mid;
  }
  const tir = Math.max(0, ((lo + hi) / 2) * 100);

  // VPL
  let vpl = -precoFinal;
  for (let i = 0; i < fluxosLiquidos.length; i++) {
    vpl += fluxosLiquidos[i] / Math.pow(1 + vplTaxaDesconto, i + 1);
  }

  return {
    gasto_atual_mensal: Math.round(gastoAtualMensal * 100) / 100,
    gasto_energia_mensal_atual: Math.round(gastoAtualMensal * 100) / 100,
    gasto_total_mensal_atual: Math.round(gastoAtualMensal * 100) / 100,
    gasto_total_mensal_novo: Math.round(gastoNovoMensal * 100) / 100,
    economia_mensal: Math.round(economiaMensal * 100) / 100,
    economia_mensal_p: Math.round(economiaPercent * 10) / 10,
    economia_anual: Math.round(economiaMensal * 12 * 100) / 100,
    payback_meses: paybackMesesTotal,
    tir: Math.round(tir * 100) / 100,
    vpl: Math.round(vpl * 100) / 100,
    economia_anual_valor: economiaAnualArr,
    geracao_anual: geracaoAnualArr,
    fluxo_caixa_acumulado_anual: fluxoAcumuladoArr,
    investimento_anual: investimentoArr,
    tarifa_distribuidora_series: tarifaArr,
  };
}

/**
 * Flattens financial series output into snapshot-compatible key-value pairs.
 * Keys match what resolveFinanceiro expects from the snapshot.
 */
export function flattenFinancialToSnapshot(fin: FinancialSeriesOutput): Record<string, number> {
  const out: Record<string, number> = {
    gasto_atual_mensal: fin.gasto_atual_mensal,
    gasto_energia_mensal_atual: fin.gasto_energia_mensal_atual,
    gasto_total_mensal_atual: fin.gasto_total_mensal_atual,
    gasto_total_mensal_novo: fin.gasto_total_mensal_novo,
    economia_mensal: fin.economia_mensal,
    economia_mensal_p: fin.economia_mensal_p,
    economia_anual: fin.economia_anual,
    payback_meses: fin.payback_meses,
    tir: fin.tir,
    vpl: fin.vpl,
  };

  // Flatten series (0..25)
  for (let i = 0; i <= 25; i++) {
    if (fin.economia_anual_valor[i] != null) out[`economia_anual_valor_${i}`] = fin.economia_anual_valor[i];
    if (fin.geracao_anual[i] != null) out[`geracao_anual_${i}`] = fin.geracao_anual[i];
    if (fin.fluxo_caixa_acumulado_anual[i] != null) out[`fluxo_caixa_acumulado_anual_${i}`] = fin.fluxo_caixa_acumulado_anual[i];
    if (fin.investimento_anual[i] != null) out[`investimento_anual_${i}`] = fin.investimento_anual[i];
    if (fin.tarifa_distribuidora_series[i] != null) out[`tarifa_distribuidora_${i}`] = fin.tarifa_distribuidora_series[i];
  }

  return out;
}
