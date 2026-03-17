/**
 * Multi-UC financial resolver.
 * Derives per-UC variables (_uc1, _uc2, …) via proportional allocation (rateio_creditos).
 *
 * Generated variables per UC N:
 *   investimento_ucN, economia_ucN, economia_mensal_ucN, economia_anual_ucN,
 *   economia_anual_valor_X_ucN (X = 0..25),
 *   fluxo_caixa_acumulado_anual_X_ucN (X = 0..25),
 *   payback_ucN, payback_meses_ucN, payback_anos_ucN,
 *   vpl_ucN, tir_ucN
 */

import { type AnyObj, type ResolverExternalContext, num, fmtCur, fmtNum, safeArr } from "./types.ts";

export function resolveMultiUC(
  snapshot: AnyObj | null | undefined,
  _ext?: ResolverExternalContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  const snap = snapshot ?? {};

  const ucs = safeArr(snap.ucs);
  if (ucs.length <= 1) return out; // Single-UC → nothing to derive

  // ── Compute rateio weights ──
  const weights = computeWeights(ucs);

  // ── Global aggregates from snapshot/financeiro ──
  const fin = (snap.financeiro && typeof snap.financeiro === "object" && !Array.isArray(snap.financeiro))
    ? snap.financeiro as AnyObj : {};

  const valorTotal = num(fin.valor_total) ?? num(snap.valor_total) ?? num(snap.preco_total) ?? 0;
  const economiaMensal = num(fin.economia_mensal) ?? num(snap.economia_mensal) ?? 0;
  const economiaAnual = num(fin.economia_anual) ?? num(snap.economia_anual) ?? economiaMensal * 12;
  const vplGlobal = num(fin.vpl) ?? num(snap.vpl);
  const tirGlobal = num(fin.tir) ?? num(snap.tir);
  const paybackMeses = num(fin.payback_meses) ?? num(snap.payback_meses);

  // ── Per-UC derivation ──
  weights.forEach((w, idx) => {
    const suffix = `_uc${idx + 1}`;

    // Investment & economy
    const investUC = valorTotal * w;
    const econMensalUC = economiaMensal * w;
    const econAnualUC = economiaAnual * w;

    setCur(`investimento${suffix}`, investUC);
    setCur(`economia${suffix}`, econMensalUC);
    setCur(`economia_mensal${suffix}`, econMensalUC);
    setCur(`economia_anual${suffix}`, econAnualUC);

    // Annual series (0..25) — proportional split of global series
    for (let yr = 0; yr <= 25; yr++) {
      // economia_anual_valor_X
      const econYrGlobal = num(snap[`economia_anual_valor_${yr}`]);
      if (econYrGlobal != null) {
        setCur(`economia_anual_valor_${yr}${suffix}`, econYrGlobal * w);
      }

      // fluxo_caixa_acumulado_anual_X — recalc from investment + cumulative economy
      const fluxoGlobal = num(snap[`fluxo_caixa_acumulado_anual_${yr}`]);
      if (fluxoGlobal != null) {
        setCur(`fluxo_caixa_acumulado_anual_${yr}${suffix}`, fluxoGlobal * w);
      }
    }

    // Payback — proportional (same ratio since economy and investment scale together)
    if (paybackMeses != null && paybackMeses > 0) {
      // With proportional rateio the payback per-UC is approximately the same as global
      // when both investment and economy scale by the same weight.
      // However if rateio only affects credits (economy), payback changes.
      // Safe derivation: payback_ucN = investimento_ucN / economia_anual_ucN * 12
      const paybackUC = econAnualUC > 0 ? (investUC / econAnualUC) * 12 : paybackMeses;
      const anos = Math.floor(paybackUC / 12);
      const meses = Math.round(paybackUC % 12);
      out[`payback${suffix}`] = `${anos} anos e ${meses} meses`;
      out[`payback_meses${suffix}`] = String(Math.round(paybackUC));
      out[`payback_anos${suffix}`] = fmtNum(paybackUC / 12, 1);
    }

    // VPL — proportional
    if (vplGlobal != null) {
      setCur(`vpl${suffix}`, vplGlobal * w);
    }

    // TIR — same as global (ratio-invariant when investment & cash flows scale linearly)
    if (tirGlobal != null) {
      out[`tir${suffix}`] = String(tirGlobal);
    }
  });

  // Emit num_ucs for template use
  out["num_ucs"] = String(ucs.length);

  return out;

  // ── helpers ──
  function setCur(key: string, val: number) {
    out[key] = fmtCur(val);
  }
}

/**
 * Computes normalized weights from ucs[].rateio_creditos.
 * Fallback: equal distribution.
 */
function computeWeights(ucs: AnyObj[]): number[] {
  const raw = ucs.map(uc => num(uc.rateio_creditos) ?? num(uc.rateio_sugerido_creditos) ?? 0);
  const total = raw.reduce((s, v) => s + v, 0);

  if (total > 0) {
    return raw.map(v => v / total);
  }

  // Equal distribution fallback
  const equalWeight = 1 / ucs.length;
  return ucs.map(() => equalWeight);
}
