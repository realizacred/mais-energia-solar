/**
 * Backend Flatten Analyzer
 * Derives keys from the static snapshot in knownKeys.ts.
 *
 * NOTE: Vite cannot ?raw-import files outside src/ (supabase/functions/).
 * The BACKEND_FLATTEN_KEYS set in knownKeys.ts is a manually-maintained
 * static snapshot of flattenSnapshot.ts — update it when the edge function changes.
 */

import { BACKEND_FLATTEN_KEYS } from "./knownKeys";

/**
 * Extract all keys that flattenSnapshot explicitly produces.
 */
export function extractBackendFlattenKeys(): Set<string> {
  return new Set(BACKEND_FLATTEN_KEYS);
}

/**
 * Check if a flat key is produced by the backend flatten.
 */
export function isKeyInBackendFlatten(
  flatKey: string,
  dottedKey: string,
  flattenKeys: Set<string>
): boolean {
  if (flattenKeys.has(flatKey)) return true;

  const underscored = dottedKey.replace(/\./g, "_");
  if (flattenKeys.has(underscored)) return true;

  const basePattern = flatKey.replace(/_\d+$/, "_1");
  if (basePattern !== flatKey && flattenKeys.has(basePattern)) return true;

  return false;
}

/**
 * Get analysis metadata about the backend flatten.
 */
export function getBackendFlattenAnalysis(): {
  totalExplicitKeys: number;
  keys: string[];
  sourceLines: number;
  hasDynamicKeyGeneration: boolean;
} {
  const keys = extractBackendFlattenKeys();

  return {
    totalExplicitKeys: keys.size,
    keys: Array.from(keys).sort(),
    sourceLines: 0, // Unknown — file outside src/
    hasDynamicKeyGeneration: true, // flattenSnapshot uses forEach loops
  };
}
