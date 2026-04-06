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

  // console.log(`[flattenSnapshot] Total resolved keys: ${totalKeys}`);

  return result;
}
