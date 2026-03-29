/**
 * Orchestrator: combines all domain resolvers into a single flat variable map.
 * 
 * Usage:
 *   import { resolveAllVariables } from "../_shared/resolvers/index.ts";
 *   const vars = resolveAllVariables(snapshot, ext);
 */
import { type AnyObj, type ResolverExternalContext, str } from "./types.ts";
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
      if (cfValue !== null && cfValue !== undefined && cfValue !== "" && typeof cfValue !== "object") {
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

  // Step 3: Add canonical aliases
  addCanonicalAliases(vars);

  return vars;
}
