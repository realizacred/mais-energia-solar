/**
 * Charts Datasets Builder — transforms proposal data into chart datasets.
 */
import type { ChartDataset, ProposalChart } from "./charts-types";

/**
 * Build a ChartDataset from raw proposal data + chart config.
 */
export function buildChartDataset(
  chart: ProposalChart,
  rawData: Record<string, unknown>[] | null
): ChartDataset {
  if (!rawData || rawData.length === 0) {
    return { labels: [], datasets: [] };
  }

  const labels = rawData.map((row) => String(row[chart.label_field] ?? ""));
  const values = rawData.map((row) => Number(row[chart.value_field] ?? 0));

  // For charts with conditional colors (e.g., positive/negative)
  const opts = chart.chart_options as Record<string, string>;
  let backgroundColor: string | string[];

  if (opts.negativeColor && opts.positiveColor) {
    backgroundColor = values.map((v) =>
      v < 0 ? opts.negativeColor : opts.positiveColor
    );
  } else if (chart.colors && chart.colors.length > 1 && (chart.chart_type === "pie" || chart.chart_type === "doughnut")) {
    backgroundColor = chart.colors;
  } else {
    backgroundColor = chart.colors?.[0] ?? "#3b82f6";
  }

  return {
    labels,
    datasets: [
      {
        label: chart.title,
        data: values,
        backgroundColor,
        borderColor: "transparent",
        borderWidth: 0,
      },
    ],
  };
}

/**
 * Resolve data from the proposal snapshot by data_source path.
 * e.g. "tabelas.geracao_mensal" → snapshot.tabelas.geracao_mensal
 */
export function resolveDataFromSnapshot(
  snapshot: Record<string, unknown>,
  dataSourcePath: string
): Record<string, unknown>[] | null {
  const parts = dataSourcePath.split(".");
  let current: unknown = snapshot;

  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  if (Array.isArray(current)) {
    return current as Record<string, unknown>[];
  }

  return null;
}
