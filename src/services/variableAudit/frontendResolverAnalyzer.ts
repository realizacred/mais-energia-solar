/**
 * Frontend Resolver Analyzer
 * Parses the ACTUAL resolveProposalVariables.ts source to extract handled keys.
 * Uses Vite ?raw import to read the real source code at build time.
 */

// @ts-ignore — Vite raw import
import resolverSource from "@/lib/resolveProposalVariables.ts?raw";

/**
 * Extract all dotted keys that the frontend resolver explicitly handles.
 * Looks for patterns like: if (key === "grupo.campo")
 */
export function extractFrontendResolverKeys(): Set<string> {
  const keys = new Set<string>();
  const source = resolverSource as string;

  // Pattern 1: if (key === "grupo.campo")
  const ifKeyRegex = /if\s*\(\s*key\s*===\s*["'`]([a-z_]+\.[a-z_0-9]+)["'`]\)/g;
  let match: RegExpExecArray | null;
  while ((match = ifKeyRegex.exec(source)) !== null) {
    keys.add(match[1]);
  }

  // Pattern 2: if (key === `grupo.campo_${i + 1}`) — template literals with index
  const templateKeyRegex = /if\s*\(\s*key\s*===\s*`([a-z_]+\.[a-z_]+)_\$\{/g;
  while ((match = templateKeyRegex.exec(source)) !== null) {
    // Add base pattern with _1 as representative
    keys.add(`${match[1]}_1`);
  }

  return keys;
}

/**
 * Check if a specific key is handled by the frontend resolver.
 * Handles indexed variants, monthly series, UC-indexed, etc.
 */
export function isKeyInFrontendResolver(
  dottedKey: string,
  resolverKeys: Set<string>
): boolean {
  // Direct match
  if (resolverKeys.has(dottedKey)) return true;

  // Indexed variant: key_2 → key_1
  const basePattern = dottedKey.replace(/_\d+$/, "_1");
  if (basePattern !== dottedKey && resolverKeys.has(basePattern)) return true;

  // UC-indexed variant: key_uc2 → key
  const ucBase = dottedKey.replace(/_uc\d+$/, "");
  if (ucBase !== dottedKey && resolverKeys.has(ucBase)) return true;

  // Monthly variants — resolved via finalSnapshot
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  if (months.some(m => dottedKey.endsWith(`_${m}`))) return true;

  // Annual series (_0 to _25) — resolved via finalSnapshot
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
  const source = resolverSource as string;
  const lines = source.split("\n").length;

  return {
    totalExplicitKeys: keys.size,
    keys: Array.from(keys).sort(),
    sourceLines: lines,
    hasFinalSnapshotFallback: source.includes("finalSnapshot"),
    hasDeepGetSupport: source.includes("deepGet"),
  };
}
