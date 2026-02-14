// ─── Proposal Calculation Engine v2.0 ──────────────────────
// Shared module: deterministic 25-year financial projections
// with Lei 14.300 Fio B escalation and cenário support.

export const ENGINE_VERSION = "2.0.0";

// ─── Types ─────────────────────────────────────────────────

export interface CalcInputs {
  investimentoTotal: number;
  economiaMensalAno1: number;
  geracaoMensalKwh: number;
  tarifaMedia: number;
  inflacaoEnergetica: number;
  perdaEficienciaAnual: number;
  trocaInversorAnos: number;
  trocaInversorCustoPct: number;
  vplTaxaDesconto: number;
  // Lei 14.300 Fio B escalation
  fioB: {
    anoBase: number;
    percentualBase: number; // e.g. 15 for 2024
    escalonamento: FioBStep[];
  };
}

export interface FioBStep {
  ano: number;
  percentual: number; // % of Fio B não compensado
}

export interface SeriesRow {
  ano: number;
  geracao_kwh: number;
  tarifa_vigente: number;
  degradacao_acumulada: number;
  economia_bruta: number;
  custo_fio_b: number;
  economia_liquida: number;
  economia_acumulada: number;
  custo_extra: number;
  fluxo_caixa: number;
  fluxo_caixa_acumulado: number;
  vpl_parcial: number;
}

export interface CalcResult {
  series: SeriesRow[];
  paybackAnos: number;
  paybackMeses: number;
  vpl: number;
  tir: number;
  economiaPrimeiroAno: number;
  roi25Anos: number;
}

export interface CenarioInput {
  nome: string;
  tipo: "a_vista" | "financiamento" | "parcelado" | "outro";
  investimento: number;
  entrada: number;
  taxaMensal: number;
  numParcelas: number;
  valorParcela: number;
  financiadorId?: string;
}

export interface CenarioResult {
  nome: string;
  tipo: string;
  precoFinal: number;
  entrada: number;
  numParcelas: number;
  valorParcela: number;
  taxaMensal: number;
  cetAnual: number;
  paybackMeses: number;
  tir: number;
  roi25Anos: number;
  economiaPrimeiroAno: number;
  series: SeriesRow[];
  financiadorId?: string;
}

// ─── Helpers ───────────────────────────────────────────────

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function getFioBPercent(fioB: CalcInputs["fioB"], ano: number): number {
  // Find the applicable step for this calendar year
  const calendarYear = fioB.anoBase + ano - 1;
  
  // Check escalation steps (sorted by ano desc to find latest applicable)
  const steps = [...fioB.escalonamento].sort((a, b) => b.ano - a.ano);
  for (const step of steps) {
    if (calendarYear >= step.ano) {
      return step.percentual / 100;
    }
  }
  return fioB.percentualBase / 100;
}

// ─── Core 25-Year Series ───────────────────────────────────

export function calcSeries25(inputs: CalcInputs): CalcResult {
  const {
    investimentoTotal, economiaMensalAno1, geracaoMensalKwh,
    tarifaMedia, inflacaoEnergetica, perdaEficienciaAnual,
    trocaInversorAnos, trocaInversorCustoPct, vplTaxaDesconto, fioB,
  } = inputs;

  const series: SeriesRow[] = [];
  let acumulado = 0;
  let fluxoAcumulado = -investimentoTotal;
  let vplTotal = -investimentoTotal;
  let paybackAnos = 0;
  const taxaDesc = vplTaxaDesconto / 100;

  for (let ano = 1; ano <= 25; ano++) {
    const degradacao = Math.pow(1 - perdaEficienciaAnual / 100, ano - 1);
    const inflacao = Math.pow(1 + inflacaoEnergetica / 100, ano - 1);
    const tarifaVigente = round2(tarifaMedia * inflacao);
    const geracaoAnual = round2(geracaoMensalKwh * 12 * degradacao);
    const economiaBruta = round2(geracaoAnual * tarifaVigente);

    // Fio B cost using Lei 14.300 escalation
    const fioBPct = getFioBPercent(fioB, ano);
    const custoFioB = round2(geracaoAnual * tarifaVigente * 0.28 * fioBPct); // 28% = TUSD Fio B proportion

    const economiaLiquida = round2(economiaBruta - custoFioB);

    let custoExtra = 0;
    if (trocaInversorAnos > 0 && ano === trocaInversorAnos) {
      custoExtra = round2(investimentoTotal * (trocaInversorCustoPct / 100));
    }

    const fluxo = round2(economiaLiquida - custoExtra);
    acumulado += economiaLiquida;
    fluxoAcumulado += fluxo;

    const vplParcial = round2(fluxo / Math.pow(1 + taxaDesc, ano));
    vplTotal += vplParcial;

    if (paybackAnos === 0 && fluxoAcumulado >= 0) {
      paybackAnos = ano;
    }

    series.push({
      ano,
      geracao_kwh: geracaoAnual,
      tarifa_vigente: tarifaVigente,
      degradacao_acumulada: round2((1 - degradacao) * 100),
      economia_bruta: economiaBruta,
      custo_fio_b: custoFioB,
      economia_liquida: economiaLiquida,
      economia_acumulada: round2(acumulado),
      custo_extra: custoExtra,
      fluxo_caixa: fluxo,
      fluxo_caixa_acumulado: round2(fluxoAcumulado),
      vpl_parcial: vplParcial,
    });
  }

  const tir = calcTIR(investimentoTotal, series.map(s => s.fluxo_caixa));
  const paybackMeses = economiaMensalAno1 > 0 ? Math.ceil(investimentoTotal / economiaMensalAno1) : 0;

  return {
    series,
    paybackAnos,
    paybackMeses,
    vpl: round2(vplTotal),
    tir: round2(tir),
    economiaPrimeiroAno: round2(economiaMensalAno1 * 12),
    roi25Anos: round2(acumulado),
  };
}

// ─── Cenário Calculator ────────────────────────────────────

export function calcCenario(
  baseInputs: CalcInputs,
  cenario: CenarioInput,
): CenarioResult {
  // For financed scenarios, the effective investment includes interest
  const totalPago = cenario.tipo === "a_vista"
    ? cenario.investimento
    : cenario.entrada + cenario.numParcelas * cenario.valorParcela;

  // Calculate CET (Custo Efetivo Total)
  const cetAnual = cenario.numParcelas > 0 && cenario.taxaMensal > 0
    ? round2((Math.pow(1 + cenario.taxaMensal / 100, 12) - 1) * 100)
    : 0;

  // Run series with the actual investment amount
  const result = calcSeries25({
    ...baseInputs,
    investimentoTotal: cenario.investimento,
  });

  // Adjust payback for financed: includes parcelas period
  let paybackMesesAdj = result.paybackMeses;
  if (cenario.tipo === "financiamento" && cenario.numParcelas > 0) {
    // During financing, monthly cash flow = economia - parcela
    const economiaMensal = baseInputs.economiaMensalAno1;
    const fluxoMensalFinanciamento = economiaMensal - cenario.valorParcela;
    if (fluxoMensalFinanciamento > 0) {
      const entradaRecovery = cenario.entrada > 0 ? Math.ceil(cenario.entrada / economiaMensal) : 0;
      paybackMesesAdj = entradaRecovery + cenario.numParcelas;
    }
  }

  return {
    nome: cenario.nome,
    tipo: cenario.tipo,
    precoFinal: cenario.investimento,
    entrada: cenario.entrada,
    numParcelas: cenario.numParcelas,
    valorParcela: cenario.valorParcela,
    taxaMensal: cenario.taxaMensal,
    cetAnual,
    paybackMeses: paybackMesesAdj,
    tir: result.tir,
    roi25Anos: result.roi25Anos,
    economiaPrimeiroAno: result.economiaPrimeiroAno,
    series: result.series,
    financiadorId: cenario.financiadorId,
  };
}

// ─── TIR (IRR) via Bisection ───────────────────────────────

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

// ─── Calc Hash (deterministic) ─────────────────────────────

export async function calcHash(inputs: Record<string, unknown>): Promise<string> {
  const sorted = JSON.stringify(inputs, Object.keys(inputs).sort());
  const data = new TextEncoder().encode(sorted);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Safe Expression Evaluator ─────────────────────────────

export function evaluateExpression(expr: string, ctx: Record<string, number>): number | null {
  try {
    if (!expr || expr.trim() === "") return null;
    let resolved = expr;
    const matches = expr.match(/\[([^\]]+)\]/g);
    if (matches) {
      for (const m of matches) {
        const name = m.slice(1, -1).trim();
        const val = ctx[name] ?? 0;
        resolved = resolved.replace(m, String(val));
      }
    }
    if (/[^0-9.+\-*/() \t]/.test(resolved)) return null;
    const fn = new Function(`"use strict"; return (${resolved});`);
    const result = fn();
    return typeof result === "number" && isFinite(result) ? Math.round(result * 10000) / 10000 : null;
  } catch {
    return null;
  }
}
