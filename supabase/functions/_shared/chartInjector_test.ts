/**
 * Tests for chartInjector utilities.
 * Run with: supabase--test_edge_functions
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  normalizeChartPlaceholder,
  detectChartPlaceholders,
  resolveDataFromSnapshot,
  buildChartDataset,
} from "./chartInjector.ts";

// ── normalizeChartPlaceholder ───────────────────────────────

Deno.test("normalizeChartPlaceholder — strips brackets", () => {
  assertEquals(normalizeChartPlaceholder("[grafico_geracao_mensal]"), "grafico_geracao_mensal");
});

Deno.test("normalizeChartPlaceholder — already clean", () => {
  assertEquals(normalizeChartPlaceholder("grafico_geracao_mensal"), "grafico_geracao_mensal");
});

Deno.test("normalizeChartPlaceholder — trims whitespace", () => {
  assertEquals(normalizeChartPlaceholder("  [grafico_geracao_mensal]  "), "grafico_geracao_mensal");
});

Deno.test("normalizeChartPlaceholder — normalizes spaces to underscores", () => {
  assertEquals(normalizeChartPlaceholder("grafico geracao mensal"), "grafico_geracao_mensal");
});

Deno.test("normalizeChartPlaceholder — lowercases", () => {
  assertEquals(normalizeChartPlaceholder("[Grafico_Geracao_Mensal]"), "grafico_geracao_mensal");
});

Deno.test("normalizeChartPlaceholder — empty string", () => {
  assertEquals(normalizeChartPlaceholder(""), "");
});

Deno.test("normalizeChartPlaceholder — mixed case with brackets and spaces", () => {
  assertEquals(normalizeChartPlaceholder(" [VC Grafico De Comparacao] "), "vc_grafico_de_comparacao");
});

// ── detectChartPlaceholders ─────────────────────────────────

Deno.test("detectChartPlaceholders — finds bracketed placeholders in XML", () => {
  const xml = `<w:t>[grafico_geracao_mensal]</w:t><w:t>[grafico_economia_mensal]</w:t>`;
  const result = detectChartPlaceholders(xml);
  assertEquals(result.length, 2);
  assertEquals(result.includes("grafico_geracao_mensal"), true);
  assertEquals(result.includes("grafico_economia_mensal"), true);
});

Deno.test("detectChartPlaceholders — deduplicates", () => {
  const xml = `<w:t>[grafico_geracao_mensal]</w:t><w:t>[grafico_geracao_mensal]</w:t>`;
  const result = detectChartPlaceholders(xml);
  assertEquals(result.length, 1);
});

Deno.test("detectChartPlaceholders — ignores short placeholders", () => {
  const xml = `<w:t>[ab]</w:t><w:t>[grafico_ok_test]</w:t>`;
  const result = detectChartPlaceholders(xml);
  assertEquals(result.length, 1);
  assertEquals(result[0], "grafico_ok_test");
});

Deno.test("detectChartPlaceholders — returns empty for no placeholders", () => {
  const xml = `<w:t>Some regular text without brackets</w:t>`;
  assertEquals(detectChartPlaceholders(xml).length, 0);
});

// ── resolveDataFromSnapshot ─────────────────────────────────

Deno.test("resolveDataFromSnapshot — resolves nested path", () => {
  const snapshot = {
    tabelas: {
      geracao_mensal: [
        { mes: "Jan", valor: 100 },
        { mes: "Fev", valor: 200 },
      ],
    },
  };
  const result = resolveDataFromSnapshot(snapshot, "tabelas.geracao_mensal");
  assertEquals(result?.length, 2);
  assertEquals(result?.[0].mes, "Jan");
});

Deno.test("resolveDataFromSnapshot — returns null for missing path", () => {
  const snapshot = { tabelas: {} };
  assertEquals(resolveDataFromSnapshot(snapshot, "tabelas.geracao_mensal"), null);
});

Deno.test("resolveDataFromSnapshot — returns null for non-array", () => {
  const snapshot = { tabelas: { geracao_mensal: "not an array" } };
  assertEquals(resolveDataFromSnapshot(snapshot as any, "tabelas.geracao_mensal"), null);
});

Deno.test("resolveDataFromSnapshot — single level path", () => {
  const snapshot = { data: [{ a: 1 }] };
  const result = resolveDataFromSnapshot(snapshot, "data");
  assertEquals(result?.length, 1);
});

// ── buildChartDataset ───────────────────────────────────────

Deno.test("buildChartDataset — basic bar chart", () => {
  const chart = {
    id: "1", placeholder: "test", chart_type: "bar", engine: "rendered_image",
    data_source: "test", label_field: "mes", value_field: "valor",
    title: "Test", subtitle: null, colors: ["#3b82f6"], chart_options: {},
    width: 1600, height: 900, show_legend: false, show_grid: true, show_labels: true,
  };
  const data = [{ mes: "Jan", valor: 100 }, { mes: "Fev", valor: 200 }];
  const result = buildChartDataset(chart, data);
  assertEquals(result.labels, ["Jan", "Fev"]);
  assertEquals(result.datasets[0].data, [100, 200]);
  assertEquals(result.datasets[0].backgroundColor, "#3b82f6");
});

Deno.test("buildChartDataset — conditional colors (positive/negative)", () => {
  const chart = {
    id: "1", placeholder: "test", chart_type: "bar", engine: "rendered_image",
    data_source: "test", label_field: "ano", value_field: "valor",
    title: "Fluxo", subtitle: null, colors: ["#f59e0b", "#3b82f6"],
    chart_options: { negativeColor: "#f59e0b", positiveColor: "#3b82f6" },
    width: 1600, height: 900, show_legend: true, show_grid: true, show_labels: true,
  };
  const data = [
    { ano: "Ano 1", valor: -5000 },
    { ano: "Ano 2", valor: -2000 },
    { ano: "Ano 3", valor: 3000 },
  ];
  const result = buildChartDataset(chart, data);
  const bgColors = result.datasets[0].backgroundColor as string[];
  assertEquals(bgColors[0], "#f59e0b"); // negative
  assertEquals(bgColors[1], "#f59e0b"); // negative
  assertEquals(bgColors[2], "#3b82f6"); // positive
});

Deno.test("buildChartDataset — missing value field defaults to 0", () => {
  const chart = {
    id: "1", placeholder: "test", chart_type: "bar", engine: "rendered_image",
    data_source: "test", label_field: "mes", value_field: "valor",
    title: "Test", subtitle: null, colors: ["#3b82f6"], chart_options: {},
    width: 1600, height: 900, show_legend: false, show_grid: true, show_labels: true,
  };
  const data = [{ mes: "Jan" }, { mes: "Fev", valor: 150 }]; // first has no valor
  const result = buildChartDataset(chart, data);
  assertEquals(result.datasets[0].data, [0, 150]);
});

Deno.test("buildChartDataset — pie chart with multiple colors", () => {
  const chart = {
    id: "1", placeholder: "test", chart_type: "pie", engine: "rendered_image",
    data_source: "test", label_field: "item", value_field: "valor",
    title: "Test", subtitle: null, colors: ["#ef4444", "#3b82f6", "#10b981"],
    chart_options: {},
    width: 1600, height: 900, show_legend: true, show_grid: false, show_labels: true,
  };
  const data = [{ item: "A", valor: 10 }, { item: "B", valor: 20 }, { item: "C", valor: 30 }];
  const result = buildChartDataset(chart, data);
  assertEquals(result.datasets[0].backgroundColor, ["#ef4444", "#3b82f6", "#10b981"]);
});
