/**
 * Template Preview Analyzer
 * Derives keys from the static snapshot in knownKeys.ts.
 *
 * NOTE: Vite cannot ?raw-import files outside src/ (supabase/functions/).
 * The BACKEND_TEMPLATE_PREVIEW_KEYS set in knownKeys.ts is a manually-maintained
 * static snapshot — update it when the edge function changes.
 */

import { BACKEND_TEMPLATE_PREVIEW_KEYS } from "./knownKeys";

/**
 * Extract all keys that template-preview explicitly sets.
 */
export function extractTemplatePreviewKeys(): Set<string> {
  return new Set(BACKEND_TEMPLATE_PREVIEW_KEYS);
}

/**
 * Check if a flat key is produced by template-preview.
 */
export function isKeyInTemplatePreview(
  flatKey: string,
  previewKeys: Set<string>
): boolean {
  if (previewKeys.has(flatKey)) return true;

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

  return {
    totalExplicitKeys: keys.size,
    keys: Array.from(keys).sort(),
    sourceLines: 0, // Unknown — file outside src/
    usesFlattener: true, // template-preview imports flattenSnapshot
    hasDynamicSnapshotPassthrough: true, // uses Object.entries(snapshot)
  };
}
