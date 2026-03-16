/**
 * Charts DOCX Injector — client-side types for chart injection results.
 * The actual injection happens server-side in the template-preview edge function
 * via _shared/chartInjector.ts. This module provides types for the response.
 */

export interface ChartInjectionReport {
  detected: string[];
  rendered: string[];
  failed: string[];
  skipped: string[];
  reasons?: Record<string, string>;
}

/**
 * Check if a template-preview response includes chart injection data.
 */
export function hasChartInjection(response: Record<string, unknown>): boolean {
  const charts = response?.charts as ChartInjectionReport | null;
  return !!charts && (charts.rendered?.length > 0 || charts.failed?.length > 0);
}

/**
 * Extract chart injection summary from template-preview response.
 */
export function getChartInjectionSummary(response: Record<string, unknown>): string | null {
  const charts = response?.charts as ChartInjectionReport | null;
  if (!charts) return null;

  const parts: string[] = [];
  if (charts.rendered?.length > 0) parts.push(`${charts.rendered.length} gráfico(s) inserido(s)`);
  if (charts.failed?.length > 0) parts.push(`${charts.failed.length} falhou(aram)`);
  if (charts.skipped?.length > 0) parts.push(`${charts.skipped.length} ignorado(s)`);

  return parts.length > 0 ? parts.join(", ") : null;
}
