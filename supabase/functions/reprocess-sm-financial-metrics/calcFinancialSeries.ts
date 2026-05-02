/**
 * calcFinancialSeries.ts — Pure financial calculator for snapshot enrichment.
 *
 * Extracts the 25-year series, payback, TIR, VPL, economia, and gasto calculations
 * from StepPagamento into a reusable pure function.
 *
 * SSOT: Uses calcGrupoB as canonical motor for Grupo B GD economy calculations.
 *       Uses calcGrupoA as canonical motor for Grupo A (binomial tariff).
 * StepPagamento uses identical logic for preview. This function is the
 * canonical source for persisting financial fields into the snapshot.
 *
 * Usage: called by collectSnapshot() in ProposalWizard before saving.
 */

import { calcGrupoB, type RegraGD, type TipoFase, type TariffComponentes, type CustoDisponibilidade } from "./calcGrupoB.ts";
import { calcGrupoA } from "./calcGrupoA.ts";

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
  /** GD rule — maps to calcGrupoB's RegraGD. Default: "GD2" → GD_II */
  regra?: "GD1" | "GD2" | "GD3";
  /** Phase for custo de disponibilidade. Default: "bifasico" */
  fase?: "monofasico" | "bifasico" | "trifasico";
  /** Tarifa Fio B separada (R$/kWh). If 0/missing, uses tarifaBase * 0.28 as proxy */
  tarifaFioB?: number;
  /** Grupo tarifário: "A" ou "B". Default: "B" */
  grupo?: "A" | "B";
  // ── Campos Grupo A (binomial) ──
  /** Consumo mensal ponta (kWh) — Grupo A */
  consumoPonta?: number;
  /** Consumo mensal fora ponta (kWh) — Grupo A */
  consumoForaPonta?: number;
  /** Tarifa TE ponta (R$/kWh) */
  tarifaTEPonta?: number;
  /** Tarifa TUSD ponta (R$/kWh) */
  tarifaTUSDPonta?: number;
  /** Tarifa TE fora ponta (R$/kWh) */
  tarifaTEForaPonta?: number;
  /** Tarifa TUSD fora ponta (R$/kWh) */
  tarifaTUSDForaPonta?: number;
  /** Tarifa Fio B ponta (R$/kWh) */
  tarifaFioBPonta?: number;
  /** Tarifa Fio B fora ponta (R$/kWh) */
  tarifaFioBForaPonta?: number;
  /** Demanda contratada (kW) — Grupo A */
  demandaContratada?: number;
  /** Tarifa de demanda (R$/kW) — Grupo A */
  tarifaDemanda?: number;
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

/** Maps wizard RegraCompensacao to calcGrupoB's RegraGD */
function mapRegra(regra: string | undefined): RegraGD {
  if (regra === "GD1") return "GD_I";
  if (regra === "GD3") return "GD_III";
  return "GD_II"; // default
}

/** Standard custo de disponibilidade kWh by phase (ANEEL) */
const CUSTO_DISP_KWH: CustoDisponibilidade = {
  monofasico: 30,
  bifasico: 50,
  trifasico: 100,
};

/**
 * Computes economy for a single period using Grupo A motor.
 * Returns monthly economy in R$.
 */
function calcEconomiaGrupoA(
  input: FinancialSeriesInput,
  geracaoMensal: number,
  inflacao: number,
  ano: number,
): { economiaMensal: number; gastoSemSolar: number; gastoComSolar: number } {
  const consumoP = (input.consumoPonta ?? 0);
  const consumoFP = (input.consumoForaPonta ?? 0);
  const teTarP = (input.tarifaTEPonta ?? 0) * inflacao;
  const tusdP = (input.tarifaTUSDPonta ?? 0) * inflacao;
  const teTarFP = (input.tarifaTEForaPonta ?? 0) * inflacao;
  const tusdFP = (input.tarifaTUSDForaPonta ?? 0) * inflacao;
  const fioBP = (input.tarifaFioBPonta ?? 0) * inflacao;
  const fioBFP = (input.tarifaFioBForaPonta ?? 0) * inflacao;
  const demandaKW = input.demandaContratada ?? 0;
  const tarifaDem = (input.tarifaDemanda ?? 0) * inflacao;

  const result = calcGrupoA({
    geracao_mensal_kwh: geracaoMensal,
    consumo_fp_kwh: consumoFP,
    consumo_p_kwh: consumoP,
    demanda_contratada_kw: demandaKW,
    tarifa_te_p: teTarP,
    tarifa_tusd_p: tusdP,
    tarifa_te_fp: teTarFP,
    tarifa_tusd_fp: tusdFP,
    tarifa_demanda_rs: tarifaDem,
    tarifa_fio_b_p: fioBP,
    tarifa_fio_b_fp: fioBFP,
    regra: input.regra ?? "GD2",
    ano,
  });

  return {
    economiaMensal: result.economia_mensal_rs,
    gastoSemSolar: result.custo_total_sem_solar,
    gastoComSolar: result.custo_total_com_solar,
  };
}

/**
 * Computes all financial series for snapshot enrichment.
 * Routes to calcGrupoA or calcGrupoB based on grupo tarifário.
 *
 * Grupo B: Economy via calcGrupoB (GD I/II/III, Lei 14.300).
 * Grupo A: Economy via calcGrupoA (binomial tariff, demanda fixa).
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
    regra,
    fase = "bifasico",
    grupo = "B",
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

  // Tarifa Fio B: usar campo separado se disponível, senão ~28% da tarifa (TUSD média)
  const tarifaFioB = (input.tarifaFioB ?? 0) > 0 ? input.tarifaFioB! : tarifaBase * 0.28;

  const regraGD = mapRegra(regra);
  const anoAtual = new Date().getFullYear();
  const isGrupoA = grupo === "A";

  // ── Economia do ano corrente ──
  let gastoAtualMensal: number;
  let gastoNovoMensal: number;
  let economiaMensal: number;

  if (isGrupoA) {
    const r = calcEconomiaGrupoA(input, geracaoMensalBase, 1, anoAtual);
    gastoAtualMensal = r.gastoSemSolar;
    gastoNovoMensal = r.gastoComSolar;
    economiaMensal = Math.max(0, r.economiaMensal);
  } else {
    // Grupo B — lógica existente via calcGrupoB
    gastoAtualMensal = consumoTotal > 0 ? consumoTotal * tarifaBase : geracaoMensalBase * tarifaBase;
    gastoNovoMensal = custoDisponibilidade;

    const resultAnoAtual = calcGrupoB({
      regra: regraGD,
      fase: fase as TipoFase,
      geracao_mensal_kwh: geracaoMensalBase,
      consumo_mensal_kwh: consumoTotal,
      tariff: {
        te_kwh: tarifaBase - tarifaFioB,
        tusd_fio_b_kwh: tarifaFioB,
      },
      custo_disponibilidade: CUSTO_DISP_KWH,
      ano: anoAtual,
    });
    economiaMensal = Math.max(0, resultAnoAtual.economia_mensal_rs);
  }

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
    const geracaoMensalAno = geracaoAnual / 12;
    const anoProjecao = anoAtual + ano - 1;

    let economiaAnualCalc: number;

    if (isGrupoA) {
      // Grupo A: motor binomial
      const r = calcEconomiaGrupoA(input, geracaoMensalAno, inflacao, anoProjecao);
      economiaAnualCalc = Math.round(r.economiaMensal * 12 * 100) / 100;
    } else {
      // Grupo B: motor GD
      const tarifaFioBVigente = tarifaFioB * inflacao;
      const teVigente = tarifaVigente - tarifaFioBVigente;

      const resultAno = calcGrupoB({
        regra: regraGD,
        fase: fase as TipoFase,
        geracao_mensal_kwh: geracaoMensalAno,
        consumo_mensal_kwh: consumoTotal,
        tariff: {
          te_kwh: Math.max(0, teVigente),
          tusd_fio_b_kwh: tarifaFioBVigente,
        },
        custo_disponibilidade: CUSTO_DISP_KWH,
        ano: anoProjecao,
      });
      economiaAnualCalc = Math.round(resultAno.economia_mensal_rs * 12 * 100) / 100;
    }

    // Troca de inversor
    let custoExtra = 0;
    if (trocaInversorAnos > 0 && ano === trocaInversorAnos) {
      custoExtra = Math.round(precoFinal * trocaInversorCustoPct * 100) / 100;
    }

    const fluxo = economiaAnualCalc - custoExtra;
    fluxoAcumulado += fluxo;

    economiaAnualArr.push(economiaAnualCalc);
    geracaoAnualArr.push(geracaoAnual);
    fluxoAcumuladoArr.push(Math.round(fluxoAcumulado * 100) / 100);
    investimentoArr.push(-custoExtra);
    tarifaArr.push(tarifaVigente);
    fluxosLiquidos.push(economiaAnualCalc - custoExtra);
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
