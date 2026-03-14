/**
 * Backend Flatten Analyzer
 * Parses the ACTUAL flattenSnapshot.ts source to extract produced keys.
 * Uses Vite ?raw import to read the real source code at build time.
 */

// @ts-ignore — Vite raw import
import flattenSource from "../../supabase/functions/_shared/flattenSnapshot.ts?raw";

/**
 * Extract all keys that flattenSnapshot explicitly produces via setIfMissing/set.
 */
export function extractBackendFlattenKeys(): Set<string> {
  const keys = new Set<string>();
  const source = flattenSource as string;

  // Pattern: setIfMissing("key", ...)  or  set("key", ...)
  const setRegex = /(?:setIfMissing|set)\s*\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/g;
  let match: RegExpExecArray | null;
  while ((match = setRegex.exec(source)) !== null) {
    keys.add(match[1]);
  }

  // Pattern: setIfMissing(`key_${idx}`, ...) — template literals for indexed keys
  const templateSetRegex = /(?:setIfMissing|set)\s*\(\s*`([a-z_][a-z0-9_]*)_\$\{/g;
  while ((match = templateSetRegex.exec(source)) !== null) {
    // Add base with _1 as representative
    keys.add(`${match[1]}_1`);
  }

  return keys;
}

/**
 * Check if a flat key is produced by the backend flatten.
 */
export function isKeyInBackendFlatten(
  flatKey: string,
  dottedKey: string,
  flattenKeys: Set<string>
): boolean {
  // Direct flat key match
  if (flattenKeys.has(flatKey)) return true;

  // Underscore-joined dotted key
  const underscored = dottedKey.replace(/\./g, "_");
  if (flattenKeys.has(underscored)) return true;

  // Indexed variant: key_2 → key_1
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
  const source = flattenSource as string;
  const lines = source.split("\n").length;

  return {
    totalExplicitKeys: keys.size,
    keys: Array.from(keys).sort(),
    sourceLines: lines,
    hasDynamicKeyGeneration: source.includes("forEach") || source.includes("for ("),
  };
}
