/**
 * Multi-UC financial resolver.
 * Derives per-UC variables (_uc1, _uc2, …) via proportional allocation (rateio_creditos).
 *
 * PRIORITY: If a _ucN variable already exists in the snapshot, it is used as-is.
 * Proportional derivation is a FALLBACK only — not an independent per-UC calculation.
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
  // Single-UC → emit _uc1 variables as copies of global values (fallback)
  const isSingleUC = ucs.length <= 1;

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

  // ── Helper: set only if key not already in snapshot ──
  function setIfMissing(key: string, val: string) {
    // Check snapshot first (real data takes priority over derivation)
    const existing = snap[key];
    if (existing !== null && existing !== undefined && existing !== "") {
      out[key] = String(existing);
    } else {
      out[key] = val;
    }
  }

  function setCurIfMissing(key: string, val: number) {
    setIfMissing(key, fmtCur(val));
  }

  // ── Per-UC derivation (proportional fallback) ──
  weights.forEach((w, idx) => {
    const suffix = `_uc${idx + 1}`;

    // Investment & economy — proportional fallback
    const investUC = valorTotal * w;
    const econMensalUC = economiaMensal * w;
    const econAnualUC = economiaAnual * w;

    setCurIfMissing(`investimento${suffix}`, investUC);
    setCurIfMissing(`economia${suffix}`, econMensalUC);
    setCurIfMissing(`economia_mensal${suffix}`, econMensalUC);
    setCurIfMissing(`economia_anual${suffix}`, econAnualUC);

    // Annual series (0..25) — proportional split of global series
    for (let yr = 0; yr <= 25; yr++) {
      // economia_anual_valor_X_ucN — proportional fallback
      const econYrKey = `economia_anual_valor_${yr}${suffix}`;
      const econYrGlobal = num(snap[`economia_anual_valor_${yr}`]);
      if (econYrGlobal != null) {
        setCurIfMissing(econYrKey, econYrGlobal * w);
      }

      // fluxo_caixa_acumulado_anual_X_ucN — proportional fallback
      const fluxoKey = `fluxo_caixa_acumulado_anual_${yr}${suffix}`;
      const fluxoGlobal = num(snap[`fluxo_caixa_acumulado_anual_${yr}`]);
      if (fluxoGlobal != null) {
        setCurIfMissing(fluxoKey, fluxoGlobal * w);
      }
    }

    // payback_ucN — proportional derivation fallback.
    // NOTE: This is NOT an independent per-UC IRR calculation.
    // It approximates payback as investimento_ucN / economia_anual_ucN * 12.
    if (paybackMeses != null && paybackMeses > 0) {
      const paybackKey = `payback${suffix}`;
      const paybackMesesKey = `payback_meses${suffix}`;
      const paybackAnosKey = `payback_anos${suffix}`;

      if (snap[paybackKey] != null && snap[paybackKey] !== "") {
        out[paybackKey] = String(snap[paybackKey]);
      } else {
        const paybackUC = econAnualUC > 0 ? (investUC / econAnualUC) * 12 : paybackMeses;
        const anos = Math.floor(paybackUC / 12);
        const meses = Math.round(paybackUC % 12);
        out[paybackKey] = `${anos} anos e ${meses} meses`;
      }

      if (snap[paybackMesesKey] != null && snap[paybackMesesKey] !== "") {
        out[paybackMesesKey] = String(snap[paybackMesesKey]);
      } else {
        const paybackUC = econAnualUC > 0 ? (investUC / econAnualUC) * 12 : paybackMeses;
        out[paybackMesesKey] = String(Math.round(paybackUC));
      }

      if (snap[paybackAnosKey] != null && snap[paybackAnosKey] !== "") {
        out[paybackAnosKey] = String(snap[paybackAnosKey]);
      } else {
        const paybackUC = econAnualUC > 0 ? (investUC / econAnualUC) * 12 : paybackMeses;
        out[paybackAnosKey] = fmtNum(paybackUC / 12, 1);
      }
    }

    // vpl_ucN — proportional fallback (not independent NPV calculation)
    if (vplGlobal != null) {
      setCurIfMissing(`vpl${suffix}`, vplGlobal * w);
    }

    // tir_ucN — uses global TIR as fallback (ratio-invariant when cash flows scale linearly).
    // NOTE: This is NOT an independent per-UC IRR calculation.
    if (tirGlobal != null) {
      setIfMissing(`tir${suffix}`, String(tirGlobal));
    }
  });

  // Emit num_ucs for template use
  out["num_ucs"] = String(ucs.length);

  return out;
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

  const equalWeight = 1 / ucs.length;
  return ucs.map(() => equalWeight);
}
