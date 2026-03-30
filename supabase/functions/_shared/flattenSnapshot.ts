/**
 * flattenSnapshot.ts — Achata snapshots usando domain resolvers.
 *
 * Uso: import { flattenSnapshot } from "../_shared/flattenSnapshot.ts";
 *      const flat = flattenSnapshot(snapshot);
 */

import { resolveAllVariables, type ResolverExternalContext } from "./resolvers/index.ts";

type AnyObj = Record<string, unknown>;

/**
 * Achata um snapshot de proposta em Record<string, string>.
 * Delega toda a lógica de resolução aos domain resolvers.
 * 
 * @param snapshot - Snapshot raw da proposta
 * @param ext - Contexto externo opcional (lead, cliente, projeto, consultor)
 */
export function flattenSnapshot(
  snapshot: AnyObj | null | undefined,
  ext?: ResolverExternalContext,
): Record<string, string> {
  const result = resolveAllVariables(snapshot, ext);

  const totalKeys = Object.keys(result).length;
  console.log(`[flattenSnapshot] Total resolved keys: ${totalKeys}`);
  console.log("[flattenSnapshot] resolved keys sample:", {
    subgrupo: result.subgrupo,
    tipo_telhado: result.tipo_telhado,
    estrutura: result.estrutura,
    dis_energia: result.dis_energia,
    cidade: result.cidade,
    estado: result.estado,
    tensao_rede: result.tensao_rede,
    fator_geracao: result.fator_geracao,
    valor_total: result.valor_total,
    modulo_fabricante: result.modulo_fabricante,
    inversor_fabricante: result.inversor_fabricante,
    proposta_identificador: result.proposta_identificador,
    area_util: result.area_util,
    vc_aumento: result.vc_aumento,
    vc_a_vista: result.vc_a_vista,
    capo_m: result.capo_m,
    capo_seguro: result.capo_seguro,
    vc_calculo_seguro: result.vc_calculo_seguro,
    fluxo_caixa_acumulado_anual_10: result.fluxo_caixa_acumulado_anual_10,
  });

  return result;
}
