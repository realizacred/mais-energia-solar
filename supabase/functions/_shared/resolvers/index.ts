/**
 * Orchestrator: combines all domain resolvers into a single flat variable map.
 * 
 * Usage:
 *   import { resolveAllVariables } from "../_shared/resolvers/index.ts";
 *   const vars = resolveAllVariables(snapshot, ext);
 */
import { type AnyObj, type ResolverExternalContext, str, num, fmtVal } from "./types.ts";
import { resolveEntrada } from "./resolveEntrada.ts";
import { resolveFinanceiro } from "./resolveFinanceiro.ts";
import { resolveSistemaSolar } from "./resolveSistemaSolar.ts";
import { resolvePagamento } from "./resolvePagamento.ts";
import { resolveClienteComercial } from "./resolveClienteComercial.ts";
import { resolveMultiUC } from "./resolveMultiUC.ts";

export { type ResolverExternalContext } from "./types.ts";

/**
 * Canonical prefix map for dual-key support.
 * Maps flat legacy keys to dotted canonical keys.
 */
const CANONICAL_PREFIX_MAP: Record<string, string> = {
  "cliente_": "cliente.",
  "consumo_": "entrada.consumo_",
  "dis_energia": "entrada.dis_energia",
  "tarifa_distribuidora": "entrada.tarifa_distribuidora",
  "tipo_telhado": "entrada.tipo_telhado",
  "fase": "entrada.fase",
  "tensao_rede": "entrada.tensao_rede",
  "custo_disponibilidade_kwh": "entrada.custo_disponibilidade_kwh",
  "tipo_sistema": "entrada.tipo_sistema",
  "area_util": "entrada.area_util",
  "potencia_sistema": "sistema_solar.potencia_sistema",
  "geracao_mensal": "sistema_solar.geracao_mensal",
  "modulo_": "sistema_solar.modulo_",
  "inversor_": "sistema_solar.inversor_",
  "inversores_": "sistema_solar.inversores_",
  "otimizador_": "sistema_solar.otimizador_",
  "bateria_": "sistema_solar.bateria_",
  "transformador_": "sistema_solar.transformador_",
  "preco": "financeiro.preco",
  "preco_total": "financeiro.preco_total",
  "preco_final": "financeiro.preco_final",
  "valor_total": "financeiro.valor_total",
  "economia_": "financeiro.economia_",
  "payback": "financeiro.payback",
  "vpl": "financeiro.vpl",
  "tir": "financeiro.tir",
  "margem_": "financeiro.margem_",
  "comissao_": "financeiro.comissao_",
  "gasto_": "conta_energia.gasto_",
  "creditos_": "conta_energia.creditos_",
  "co2_evitado": "conta_energia.co2_evitado",
  "proposta_": "comercial.proposta_",
  "consultor_": "comercial.consultor_",
  "responsavel_": "comercial.responsavel_",
  "empresa_": "comercial.empresa_",
  "inflacao_": "premissas.inflacao_",
  "perda_eficiencia": "premissas.perda_eficiencia",
  "vida_util_sistema": "premissas.vida_util_sistema",
};

/**
 * Generates dual-key canonical aliases from flat keys.
 */
function addCanonicalAliases(vars: Record<string, string>): void {
  const additions: Record<string, string> = {};

  for (const [flatKey, value] of Object.entries(vars)) {
    for (const [prefix, canonicalPrefix] of Object.entries(CANONICAL_PREFIX_MAP)) {
      if (flatKey === prefix || flatKey.startsWith(prefix)) {
        const canonicalKey = flatKey.replace(prefix, canonicalPrefix);
        if (canonicalKey !== flatKey && !vars[canonicalKey]) {
          additions[canonicalKey] = value;
        }
        break;
      }
    }
    // vc_* and f_* → customizada.*
    if ((flatKey.startsWith("vc_") || flatKey.startsWith("f_")) && !vars[`customizada.${flatKey}`]) {
      additions[`customizada.${flatKey}`] = value;
    }
  }

  Object.assign(vars, additions);
}

// ═══════════════════════════════════════════════════════════════
// Custom variable formula evaluator (lightweight, no external deps)
// Supports: +, -, *, /, ^, (), IF, SWITCH, MAX, MIN
// ═══════════════════════════════════════════════════════════════

function evaluateFormula(
  expression: string,
  vars: Record<string, string>,
): { value: number | null; missing: string[] } {
  const missing: string[] = [];

  // Replace [var_name] with resolved values
  let expr = expression.replace(/\[([^\]]+)\]/g, (_, key: string) => {
    const k = key.trim();
    const val = vars[k];
    if (val === undefined || val === null || val === "") {
      missing.push(k);
      return "NaN";
    }
    // Parse pt-BR formatted number: "6.445,86" → 6445.86
    const cleaned = val.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? "NaN" : String(n);
  });

  if (missing.length > 0) return { value: null, missing };

  // Handle IF(cond;then;else) or IF(cond,then,else)
  expr = expr.replace(/IF\s*\(([^)]+)\)/gi, (_, args: string) => {
    const parts = args.split(/[;,]/).map(p => p.trim());
    if (parts.length < 3) return "NaN";
    try {
      const cond = Function(`"use strict"; return (${parts[0]});`)();
      return cond ? parts[1] : parts[2];
    } catch { return "NaN"; }
  });

  // Handle MAX/MIN
  expr = expr.replace(/MAX\s*\(([^)]+)\)/gi, (_, args: string) => {
    const nums = args.split(/[;,]/).map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums)) : "NaN";
  });
  expr = expr.replace(/MIN\s*\(([^)]+)\)/gi, (_, args: string) => {
    const nums = args.split(/[;,]/).map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
    return nums.length > 0 ? String(Math.min(...nums)) : "NaN";
  });

  // Replace ^ with ** for exponentiation
  expr = expr.replace(/\^/g, "**");

  try {
    const result = Function(`"use strict"; return (${expr});`)();
    if (typeof result === "number" && isFinite(result)) {
      return { value: result, missing: [] };
    }
    return { value: null, missing: [] };
  } catch {
    return { value: null, missing: [] };
  }
}

/**
 * Process variaveis_custom array from snapshot.
 * Re-evaluates formulas using already-resolved variables.
 * Uses topological sort to handle inter-dependencies.
 */
function processCustomVariables(
  snapshot: AnyObj,
  vars: Record<string, string>,
): void {
  const customVars = Array.isArray(snapshot.variaveis_custom)
    ? (snapshot.variaveis_custom as AnyObj[])
    : [];

  if (customVars.length === 0) return;

  // Build dependency graph
  const varMap = new Map<string, AnyObj>();
  for (const cv of customVars) {
    const nome = str(cv.nome);
    if (!nome) continue;
    varMap.set(nome, cv);
  }

  // Topological sort: resolve vars with no custom dependencies first
  const resolved = new Set<string>();
  const maxPasses = varMap.size + 1;

  for (let pass = 0; pass < maxPasses; pass++) {
    let progress = false;

    for (const [nome, cv] of varMap) {
      if (resolved.has(nome)) continue;
      if (vars[nome]) { resolved.add(nome); continue; }

      const expressao = str(cv.expressao);
      if (!expressao) {
        // No formula — use pre-computed value if available
        const preComputed = cv.valor_calculado;
        if (preComputed !== null && preComputed !== undefined && preComputed !== "" && preComputed !== 0) {
          vars[nome] = String(preComputed);
        }
        resolved.add(nome);
        progress = true;
        continue;
      }

      // Try to evaluate formula
      const { value, missing } = evaluateFormula(expressao, vars);

      // Check if missing deps are custom vars not yet resolved
      const hasPendingCustomDeps = missing.some(m => varMap.has(m) && !resolved.has(m));
      if (hasPendingCustomDeps) continue; // Wait for next pass

      if (value !== null) {
        vars[nome] = fmtVal(value);
        resolved.add(nome);
        progress = true;
      } else {
        // Cannot resolve — mark as resolved to avoid infinite loop
        resolved.add(nome);
        progress = true;
      }
    }

    if (!progress) break;
  }
}

/**
 * Resolves ALL proposal variables from a snapshot + optional external context.
 * Returns a flat Record<string, string> with both legacy and canonical keys.
 */
export function resolveAllVariables(
  snapshot: AnyObj | null | undefined,
  ext?: ResolverExternalContext,
): Record<string, string> {
  const snap = snapshot ?? {};

  // Step 1: Extract top-level primitives
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(snap)) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object") {
      // Dot-flatten nested objects (one level) → prefix_subkey
      if (!Array.isArray(value)) {
        for (const [subKey, subValue] of Object.entries(value as AnyObj)) {
          if (subValue !== null && subValue !== undefined && subValue !== "" && typeof subValue !== "object") {
            if (!vars[`${key}_${subKey}`]) vars[`${key}_${subKey}`] = String(subValue);
          }
        }
      }
      continue;
    }
    if (!vars[key]) vars[key] = String(value);
  }

  // Step 1b: Flatten customFieldValues directly as flat keys (pos_*, pre_*, cap_*)
  const cfv = snap.customFieldValues ?? snap.custom_field_values ?? {};
  if (typeof cfv === "object" && !Array.isArray(cfv)) {
    for (const [cfKey, cfValue] of Object.entries(cfv as AnyObj)) {
      if (cfValue === null || cfValue === undefined || cfValue === "") continue;
      if (Array.isArray(cfValue)) {
        // multi_select / select fields → join as comma-separated string
        const joined = cfValue.filter((v: unknown) => v != null && v !== "").join(", ");
        if (joined && !vars[cfKey]) vars[cfKey] = joined;
      } else if (typeof cfValue !== "object") {
        if (!vars[cfKey]) vars[cfKey] = String(cfValue);
      }
    }
  }

  // Step 2: Run domain resolvers (setIfMissing semantics — first source wins)
  const entrada = resolveEntrada(snapshot, ext);
  const financeiro = resolveFinanceiro(snapshot, ext);
  const sistema = resolveSistemaSolar(snapshot, ext);
  const pagamento = resolvePagamento(snapshot, ext);
  const clienteComercial = resolveClienteComercial(snapshot, ext);
  const multiUC = resolveMultiUC(snapshot, ext);

  // Merge with setIfMissing semantics
  for (const resolverOut of [entrada, financeiro, sistema, pagamento, clienteComercial, multiUC]) {
    for (const [k, v] of Object.entries(resolverOut)) {
      if (!vars[k]) vars[k] = v;
    }
  }

  // Step 2b: Process custom variables (re-evaluate formulas with resolved vars)
  processCustomVariables(snap, vars);

  // Step 3: Add canonical aliases
  addCanonicalAliases(vars);

  return vars;
}
