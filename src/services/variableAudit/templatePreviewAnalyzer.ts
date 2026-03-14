/**
 * Template Preview Analyzer
 * Parses the ACTUAL template-preview/index.ts source to extract all keys it produces.
 * Uses Vite ?raw import to read the real source code at build time.
 */

// @ts-ignore — Vite raw import
import previewSource from "../../supabase/functions/template-preview/index.ts?raw";

/**
 * Extract all keys that template-preview explicitly sets via set/setIfMissing/setCur/setCurIfMissing.
 */
export function extractTemplatePreviewKeys(): Set<string> {
  const keys = new Set<string>();
  const source = previewSource as string;

  // Pattern: set("key", ...) / setIfMissing("key", ...) / setCur("key", ...) / setCurIfMissing("key", ...)
  const setRegex = /(?:set|setIfMissing|setCur|setCurIfMissing)\s*\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/g;
  let match: RegExpExecArray | null;
  while ((match = setRegex.exec(source)) !== null) {
    keys.add(match[1]);
  }

  // Pattern: template literals for indexed keys: set(`key_${i}`, ...)
  const templateSetRegex = /(?:set|setIfMissing|setCur|setCurIfMissing)\s*\(\s*`([a-z_][a-z0-9_]*)_\$\{/g;
  while ((match = templateSetRegex.exec(source)) !== null) {
    keys.add(`${match[1]}_1`);
  }

  // Pattern: array-based field lists → for (const k of ["key1", "key2"]) setIfMissing(k, ...)
  // Extract keys from array literals that are iterated with setIfMissing
  const arrayFieldsRegex = /(?:const\s+\w+\s*=\s*\[|for\s*\(\s*const\s+\w+\s+of\s*\[)\s*((?:["'][a-z_][a-z0-9_]*["']\s*,?\s*)+)\]/g;
  while ((match = arrayFieldsRegex.exec(source)) !== null) {
    const fieldList = match[1];
    const fieldRegex = /["']([a-z_][a-z0-9_]*)["']/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRegex.exec(fieldList)) !== null) {
      keys.add(fieldMatch[1]);
    }
  }

  return keys;
}

/**
 * Check if a flat key is produced by template-preview.
 * template-preview uses flattenSnapshot + its own explicit sets,
 * AND passes through any snapshot top-level key via dynamic iteration.
 */
export function isKeyInTemplatePreview(
  flatKey: string,
  previewKeys: Set<string>
): boolean {
  if (previewKeys.has(flatKey)) return true;

  // Indexed variant
  const basePattern = flatKey.replace(/_\d+$/, "_1");
  if (basePattern !== flatKey && previewKeys.has(basePattern)) return true;

  return false;
}

/**
 * Get analysis metadata about the template-preview.
 */
export function getTemplatePreviewAnalysis(): {
  totalExplicitKeys: number;
  keys: string[];
  sourceLines: number;
  usesFlattener: boolean;
  hasDynamicSnapshotPassthrough: boolean;
} {
  const keys = extractTemplatePreviewKeys();
  const source = previewSource as string;
  const lines = source.split("\n").length;

  return {
    totalExplicitKeys: keys.size,
    keys: Array.from(keys).sort(),
    sourceLines: lines,
    usesFlattener: source.includes("flattenSnapshot"),
    hasDynamicSnapshotPassthrough: source.includes("Object.entries(snapshot"),
  };
}
