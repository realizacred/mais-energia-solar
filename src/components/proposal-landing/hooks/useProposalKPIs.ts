/**
 * useProposalKPIs.ts — SSOT dos KPIs exibidos na landing pública (alta conversão).
 *
 * Centraliza TODAS as métricas mostradas ao cliente final em um só lugar,
 * derivando-as do motor financeiro canônico (calcFinancialSeries → calcGrupoB/A)
 * sempre que possível.
 *
 * Regra de ouro:
 * - Persistido no snapshot/cenário > recalculado via motor canônico > "—" (nunca chutar).
 * - NUNCA usar fallbacks numéricos mentirosos (ex: economia=0, tarifa=0.85).
 * - NUNCA mostrar "0,0 anos" — se não dá pra calcular, retorna null e a UI mostra "—".
 */

import { useMemo } from "react";
import { calcFinancialSeries, type FinancialSeriesInput } from "@/components/admin/propostas-nativas/wizard/utils/calcFinancialSeries";
import type { NormalizedProposalSnapshot } from "@/domain/proposal/normalizeProposalSnapshot";
import type { CenarioData } from "../sections/types";

export interface ProposalKPIs {
  /** true quando os dados mínimos chegaram (evita render com zeros). */
  ready: boolean;

  // Sistema
  potenciaKwp: number | null;
  geracaoMensalKwh: number | null;
  consumoMensalKwh: number | null;

  // Financeiro
  valorTotal: number | null;
  economiaMensal: number | null;
  economiaAnual: number | null;
  /** Projeção 25 anos COM inflação e perda — motor canônico. */
  economia25Anos: number | null;
  paybackMeses: number | null;
  /** Em anos, formatado já no hook ("4,8" ou null). */
  paybackAnosLabel: string | null;
  tirPercent: number | null;
  vpl: number | null;

  // Conta
  contaAtualMensal: number | null;
  contaDepoisMensal: number | null;
  /** Clamp 0–100. */
  percentEconomiaConta: number | null;

  // Série anual (índice 0 = ano 0/investimento)
  fluxoCaixaAcumulado: number[];
  economiaAnualSerie: number[];
}

const EMPTY_KPIS: ProposalKPIs = {
  ready: false,
  potenciaKwp: null,
  geracaoMensalKwh: null,
  consumoMensalKwh: null,
  valorTotal: null,
  economiaMensal: null,
  economiaAnual: null,
  economia25Anos: null,
  paybackMeses: null,
  paybackAnosLabel: null,
  tirPercent: null,
  vpl: null,
  contaAtualMensal: null,
  contaDepoisMensal: null,
  percentEconomiaConta: null,
  fluxoCaixaAcumulado: [],
  economiaAnualSerie: [],
};

interface VersaoSlim {
  valor_total: number;
  economia_mensal: number;
  payback_meses: number;
  potencia_kwp: number;
}

/**
 * @param inflacaoOverride opcional (slider do simulador). Sem override usa premissas.
 */
export function useProposalKPIs(
  snapshot: NormalizedProposalSnapshot | null,
  versaoData: VersaoSlim | null,
  activeCenario: CenarioData | null,
  inflacaoOverride?: number,
): ProposalKPIs {
  return useMemo(() => {
    if (!snapshot || !versaoData) return EMPTY_KPIS;

    const s = snapshot;
    const potenciaKwp = (s.potenciaKwp || versaoData.potencia_kwp) || null;
    const valorTotal =
      (activeCenario?.preco_final && activeCenario.preco_final > 0
        ? activeCenario.preco_final
        : versaoData.valor_total) || null;

    // ── Tarifa real da UC (não chutar 0,85) ────────────────────────────────
    const uc0 = s.ucs[0];
    const tarifa = uc0?.tarifa_distribuidora ?? 0;
    const tarifaFioB = uc0?.tarifa_fio_b ?? 0;
    const consumoMensalKwh = s.consumoTotal > 0 ? s.consumoTotal : (uc0?.consumo_mensal ?? 0);

    const inflacao = inflacaoOverride ?? s.premissas?.inflacao_energetica ?? 0;
    const perda = s.premissas?.perda_eficiencia_anual ?? 0.5;
    const taxaDesconto = s.premissas?.vpl_taxa_desconto ?? 10;
    const trocaInvAnos = s.premissas?.troca_inversor_anos ?? 15;
    const trocaInvCusto = s.premissas?.troca_inversor_custo ?? 30;

    // ── Tenta motor canônico (DA-37) quando temos dados mínimos ────────────
    const podeCalcular =
      !!potenciaKwp && !!valorTotal && consumoMensalKwh > 0 && tarifa > 0;

    let series: ReturnType<typeof calcFinancialSeries> | null = null;
    if (podeCalcular) {
      const input: FinancialSeriesInput = {
        precoFinal: valorTotal!,
        potenciaKwp: potenciaKwp!,
        irradiacao: s.locIrradiacao || 4.5,
        geracaoMensalKwh: s.geracaoMensalEstimada || 0,
        consumoTotal: consumoMensalKwh,
        tarifaBase: tarifa,
        custoDisponibilidade: uc0?.custo_disponibilidade_valor ?? 0,
        regra: (uc0 as any)?.regra ?? "GD2",
        fase: (uc0 as any)?.fase ?? "bifasico",
        tarifaFioB,
        grupo: (uc0 as any)?.grupo_tarifario === "A" ? "A" : "B",
        premissas: {
          inflacao_energetica: inflacao,
          perda_eficiencia_anual: perda,
          vpl_taxa_desconto: taxaDesconto,
          troca_inversor_anos: trocaInvAnos,
          troca_inversor_custo: trocaInvCusto,
        },
      };
      try {
        series = calcFinancialSeries(input);
      } catch {
        series = null;
      }
    }

    // ── Resolução com precedência: cenário > snapshot persistido > série recalc ──
    const economiaMensal =
      (versaoData.economia_mensal && versaoData.economia_mensal > 0
        ? versaoData.economia_mensal
        : s.economiaMensal && s.economiaMensal > 0
          ? s.economiaMensal
          : series?.economia_mensal) || null;

    const paybackMeses =
      (activeCenario?.payback_meses && activeCenario.payback_meses > 0
        ? activeCenario.payback_meses
        : versaoData.payback_meses && versaoData.payback_meses > 0
          ? versaoData.payback_meses
          : s.paybackMeses && s.paybackMeses > 0
            ? s.paybackMeses
            : series?.payback_meses) || null;

    const tirPercent =
      (activeCenario?.tir_anual && activeCenario.tir_anual > 0
        ? activeCenario.tir_anual
        : (s as any).tir && (s as any).tir > 0
          ? (s as any).tir
          : series?.tir) || null;

    const vpl = ((s as any).vpl && (s as any).vpl > 0 ? (s as any).vpl : series?.vpl) || null;

    const economiaAnual = economiaMensal != null ? economiaMensal * 12 : null;
    // 25 anos: prioriza série (com inflação); fallback nominal só se não há série.
    const economia25Anos = series
      ? series.economia_anual_valor.reduce((a, b) => a + b, 0)
      : economiaAnual != null
        ? economiaAnual * 25
        : null;

    // ── Conta atual: prioriza motor canônico, NUNCA consumo×tarifa cru ──────
    const contaAtualMensal = series?.gasto_atual_mensal ?? null;
    const contaDepoisMensal = series?.gasto_total_mensal_novo ?? null;
    const percentEconomiaConta =
      contaAtualMensal && contaAtualMensal > 0 && economiaMensal != null
        ? Math.min(100, Math.round((economiaMensal / contaAtualMensal) * 100))
        : null;

    const paybackAnosLabel =
      paybackMeses != null && paybackMeses > 0
        ? (paybackMeses / 12).toFixed(1).replace(".", ",")
        : null;

    return {
      ready: true,
      potenciaKwp,
      geracaoMensalKwh: s.geracaoMensalEstimada > 0 ? s.geracaoMensalEstimada : null,
      consumoMensalKwh: consumoMensalKwh > 0 ? consumoMensalKwh : null,
      valorTotal,
      economiaMensal,
      economiaAnual,
      economia25Anos,
      paybackMeses,
      paybackAnosLabel,
      tirPercent,
      vpl,
      contaAtualMensal,
      contaDepoisMensal,
      percentEconomiaConta,
      fluxoCaixaAcumulado: series?.fluxo_caixa_acumulado_anual ?? [],
      economiaAnualSerie: series?.economia_anual_valor ?? [],
    };
  }, [snapshot, versaoData, activeCenario, inflacaoOverride]);
}
