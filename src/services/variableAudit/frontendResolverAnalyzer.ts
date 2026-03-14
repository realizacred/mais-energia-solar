/**
 * Frontend Resolver Analyzer
 * Derives keys from the static snapshot in knownKeys.ts.
 *
 * NOTE: Using knownKeys.ts static set for consistency with BE analyzers.
 * The FRONTEND_RESOLVER_KEYS set should be updated when resolveProposalVariables.ts changes.
 */

import { FRONTEND_RESOLVER_KEYS } from "./knownKeys";

/**
 * Extract all dotted keys that the frontend resolver explicitly handles.
 */
export function extractFrontendResolverKeys(): Set<string> {
  return new Set(FRONTEND_RESOLVER_KEYS);
}

/**
 * Check if a specific key is handled by the frontend resolver.
 * Handles indexed variants, monthly series, UC-indexed, etc.
 */
export function isKeyInFrontendResolver(
  dottedKey: string,
  resolverKeys: Set<string>
): boolean {
  if (resolverKeys.has(dottedKey)) return true;

  const basePattern = dottedKey.replace(/_\d+$/, "_1");
  if (basePattern !== dottedKey && resolverKeys.has(basePattern)) return true;

  const ucBase = dottedKey.replace(/_uc\d+$/, "");
  if (ucBase !== dottedKey && resolverKeys.has(ucBase)) return true;

  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  if (months.some(m => dottedKey.endsWith(`_${m}`))) return true;

  const annualMatch = dottedKey.match(/_(\d+)$/);
  if (annualMatch) {
    const num = parseInt(annualMatch[1]);
    if (num >= 0 && num <= 25) return true;
  }

  return false;
}

/**
 * Get analysis metadata about the frontend resolver.
 */
export function getFrontendResolverAnalysis(): {
  totalExplicitKeys: number;
  keys: string[];
  sourceLines: number;
  hasFinalSnapshotFallback: boolean;
  hasDeepGetSupport: boolean;
} {
  const keys = extractFrontendResolverKeys();

  return {
    totalExplicitKeys: keys.size,
    keys: Array.from(keys).sort(),
    sourceLines: 0, // Static snapshot — not parsed at build time
    hasFinalSnapshotFallback: true, // resolveProposalVariables uses finalSnapshot
    hasDeepGetSupport: true, // uses deepGet utility
  };
}
