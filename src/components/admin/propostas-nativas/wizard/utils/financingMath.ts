/**
 * financingMath.ts
 * Centralized financial calculations for solar projects.
 * SSOT for both Frontend and Edge Functions.
 */

import { calcGrupoB, type TipoFase, type RegraGD, getFioBCobranca } from "../../../lib/calcGrupoB";
import { calcGrupoA } from "../../../lib/calcGrupoA";

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
  regra?: "GD1" | "GD2" | "GD3";
  fase?: "monofasico" | "bifasico" | "trifasico";
  tarifaFioB?: number;
  grupo?: "A" | "B";
  // Grupo A
  consumoPonta?: number;
  consumoForaPonta?: number;
  tarifaTEPonta?: number;
  tarifaTUSDPonta?: number;
  tarifaTEForaPonta?: number;
  tarifaTUSDForaPonta?: number;
  tarifaFioBPonta?: number;
  tarifaFioBForaPonta?: number;
  demandaContratada?: number;
  tarifaDemanda?: number;
}

export interface FinancialSeriesOutput {
  gasto_atual_mensal: number;
  gasto_energia_mensal_atual: number;
  gasto_total_mensal_atual: number;
  gasto_total_mensal_novo: number;
  economia_mensal: number;
  economia_mensal_p: number;
  economia_anual: number;
  payback_meses: number;
  tir: number;
  vpl: number;
  economia_anual_valor: number[];
  geracao_anual: number[];
  fluxo_caixa_acumulado_anual: number[];
  investimento_anual: number[];
  tarifa_distribuidora_series: number[];
}

/** Standard custo de disponibilidade kWh by phase */
const CUSTO_DISP_KWH = {
  monofasico: 30,
  bifasico: 50,
  trifasico: 100,
};

function mapRegra(regra: string | undefined): RegraGD {
  if (regra === "GD1") return "GD_I";
  if (regra === "GD3") return "GD_III";
  return "GD_II";
}

export function getFioBPercent(ano: number): number {
  const cobranca = getFioBCobranca(ano);
  return cobranca ?? 0.90;
}

function calcEconomiaGrupoA(
  input: FinancialSeriesInput,
  geracaoMensal: number,
  inflacao: number,
  ano: number,
): { economiaMensal: number; gastoSemSolar: number; gastoComSolar: number } {
  const result = calcGrupoA({
    geracao_mensal_kwh: geracaoMensal,
    consumo_fp_kwh: input.consumoForaPonta ?? 0,
    consumo_p_kwh: input.consumoPonta ?? 0,
    demanda_contratada_kw: input.demandaContratada ?? 0,
    tarifa_te_p: (input.tarifaTEPonta ?? 0) * inflacao,
    tarifa_tusd_p: (input.tarifaTUSDPonta ?? 0) * inflacao,
    tarifa_te_fp: (input.tarifaTEForaPonta ?? 0) * inflacao,
    tarifa_tusd_fp: (input.tarifaTUSDForaPonta ?? 0) * inflacao,
    tarifa_demanda_rs: (input.tarifaDemanda ?? 0) * inflacao,
    tarifa_fio_b_p: (input.tarifaFioBPonta ?? 0) * inflacao,
    tarifa_fio_b_fp: (input.tarifaFioBForaPonta ?? 0) * inflacao,
    regra: (input.regra as any) ?? "GD2",
    ano,
  });

  return {
    economiaMensal: result.economia_mensal_rs,
    gastoSemSolar: result.custo_total_sem_solar,
    gastoComSolar: result.custo_total_com_solar,
  };
}

export function calcularSerieFinanceira25Anos(input: FinancialSeriesInput): FinancialSeriesOutput {
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

  const geracaoMensalCalculada = potenciaKwp * (irradiacao || 4.5) * 30 * 0.80;
  const geracaoMensalBase = geracaoMensalKwh > 0 ? geracaoMensalKwh : geracaoMensalCalculada;
  const geracaoAnualBase = geracaoMensalBase * 12;

  const tarifaFioB = (input.tarifaFioB ?? 0) > 0 ? input.tarifaFioB! : tarifaBase * 0.28;
  const regraGD = mapRegra(regra);
  const anoAtual = new Date().getFullYear();
  const isGrupoA = grupo === "A";

  let gastoAtualMensal: number;
  let gastoNovoMensal: number;
  let economiaMensal: number;

  if (isGrupoA) {
    const r = calcEconomiaGrupoA(input, geracaoMensalBase, 1, anoAtual);
    gastoAtualMensal = r.gastoSemSolar;
    gastoNovoMensal = r.gastoComSolar;
    economiaMensal = Math.max(0, r.economiaMensal);
  } else {
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

  const economiaAnualArr: number[] = [];
  const geracaoAnualArr: number[] = [];
  const fluxoAcumuladoArr: number[] = [];
  const investimentoArr: number[] = [];
  const tarifaArr: number[] = [];
  const fluxosLiquidos: number[] = [];

  let fluxoAcumulado = -precoFinal;

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
      const r = calcEconomiaGrupoA(input, geracaoMensalAno, inflacao, anoProjecao);
      economiaAnualCalc = Math.round(r.economiaMensal * 12 * 100) / 100;
    } else {
      const tarifaFioBVigente = tarifaFioB * inflacao;
      const resultAno = calcGrupoB({
        regra: regraGD,
        fase: fase as TipoFase,
        geracao_mensal_kwh: geracaoMensalAno,
        consumo_mensal_kwh: consumoTotal,
        tariff: {
          te_kwh: Math.max(0, tarifaVigente - tarifaFioBVigente),
          tusd_fio_b_kwh: tarifaFioBVigente,
        },
        custo_disponibilidade: CUSTO_DISP_KWH,
        ano: anoProjecao,
      });
      economiaAnualCalc = Math.round(resultAno.economia_mensal_rs * 12 * 100) / 100;
    }

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

  const paybackMesesTotal = calcularPaybackFinanceiro(precoFinal, fluxosLiquidos);
  const tir = calcularTIR(precoFinal, fluxosLiquidos);
  const vpl = calcularVPL(precoFinal, fluxosLiquidos, vplTaxaDesconto);

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

export function calcularPaybackFinanceiro(investimento: number, fluxosLiquidos: number[]): number {
  let acumulado = -investimento;
  const acumuladoSerie = [-investimento];
  for (const f of fluxosLiquidos) {
    acumulado += f;
    acumuladoSerie.push(acumulado);
  }

  const paybackRow = acumuladoSerie.findIndex((v, i) => i > 0 && v >= 0);
  if (paybackRow > 0) {
    const prev = acumuladoSerie[paybackRow - 1];
    const curr = acumuladoSerie[paybackRow];
    const frac = prev < 0 && curr >= 0 ? Math.abs(prev) / (curr - prev) : 0;
    return Math.round(((paybackRow - 1) + frac) * 12);
  }
  return 300;
}

export function calcularTIR(investimento: number, fluxosLiquidos: number[]): number {
  let lo = -0.5, hi = 5.0;
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    let npv = -investimento;
    for (let i = 0; i < fluxosLiquidos.length; i++) {
      npv += fluxosLiquidos[i] / Math.pow(1 + mid, i + 1);
    }
    if (Math.abs(npv) < 0.01) { lo = mid; hi = mid; break; }
    if (npv > 0) lo = mid; else hi = mid;
  }
  return Math.max(0, ((lo + hi) / 2) * 100);
}

export function calcularVPL(investimento: number, fluxosLiquidos: number[], taxaDesconto: number): number {
  let vpl = -investimento;
  for (let i = 0; i < fluxosLiquidos.length; i++) {
    vpl += fluxosLiquidos[i] / Math.pow(1 + taxaDesconto, i + 1);
  }
  return vpl;
}

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

  for (let i = 0; i <= 25; i++) {
    if (fin.economia_anual_valor[i] != null) out[`economia_anual_valor_${i}`] = fin.economia_anual_valor[i];
    if (fin.geracao_anual[i] != null) out[`geracao_anual_${i}`] = fin.geracao_anual[i];
    if (fin.fluxo_caixa_acumulado_anual[i] != null) out[`fluxo_caixa_acumulado_anual_${i}`] = fin.fluxo_caixa_acumulado_anual[i];
    if (fin.investimento_anual[i] != null) out[`investimento_anual_${i}`] = fin.investimento_anual[i];
    if (fin.tarifa_distribuidora_series[i] != null) out[`tarifa_distribuidora_${i}`] = fin.tarifa_distribuidora_series[i];
  }

  return out;
}
