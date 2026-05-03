/**
 * Types for the Proposal Charts module.
 */

export type ChartType = "bar" | "line" | "pie" | "doughnut" | "area" | "stacked_bar";
export type ChartEngine = "rendered_image" | "docx_native";

export interface ProposalChart {
  id: string;
  tenant_id: string;
  name: string;
  placeholder: string;
  chart_type: ChartType;
  engine: ChartEngine;
  data_source: string;
  label_field: string;
  value_field: string;
  title: string;
  subtitle: string | null;
  colors: string[];
  chart_options: Record<string, unknown>;
  width: number;
  height: number;
  show_legend: boolean;
  show_grid: boolean;
  show_labels: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChartDataset {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

export interface RenderChartRequest {
  chart_config: {
    chart_type: ChartType;
    title: string;
    subtitle?: string;
    width: number;
    height: number;
    colors?: string[];
    show_legend: boolean;
    show_grid: boolean;
    show_labels: boolean;
  };
  dataset: ChartDataset;
}

export interface RenderChartResponse {
  success: boolean;
  image_base64?: string;
  error?: string;
}

export type ProposalChartInsert = Omit<ProposalChart, "id" | "created_at" | "updated_at">;
export type ProposalChartUpdate = Partial<Omit<ProposalChart, "id" | "tenant_id" | "created_at" | "updated_at">>;

/**
 * Paleta padrão alinhada à marca (laranja + azul corporativo).
 * Ordem pensada para boa legibilidade em pizza/rosca/barras.
 */
export const DEFAULT_CHART_COLORS = [
  "#FF6A00", // brand orange (primary)
  "#144C8C", // brand blue (secondary)
  "#3F6FCC", // brand blue light
  "#16A34A", // emerald (economia/positivo)
  "#F59E0B", // amber (atenção)
  "#64748B", // slate (neutro)
  "#0EA5E9", // sky (apoio)
  "#9333EA", // violet (apoio)
];

/** Default charts to seed per tenant */
export const DEFAULT_CHARTS: Omit<ProposalChart, "id" | "tenant_id" | "created_at" | "updated_at">[] = [
  {
    name: "Consumo Mensal",
    placeholder: "grafico_consumo_mensal",
    chart_type: "bar",
    engine: "rendered_image",
    data_source: "tabelas.consumo_mensal",
    label_field: "mes",
    value_field: "valor",
    title: "Consumo de Energia",
    subtitle: "kWh por mês",
    colors: ["#ef4444"],
    chart_options: {},
    width: 1600,
    height: 900,
    show_legend: false,
    show_grid: true,
    show_labels: true,
    active: true,
  },
  {
    name: "Geração Mensal",
    placeholder: "grafico_geracao_mensal",
    chart_type: "bar",
    engine: "rendered_image",
    data_source: "tabelas.geracao_mensal",
    label_field: "mes",
    value_field: "valor",
    title: "Geração Mensal Estimada",
    subtitle: "kWh por mês",
    colors: ["#3b82f6"],
    chart_options: {},
    width: 1600,
    height: 900,
    show_legend: false,
    show_grid: true,
    show_labels: true,
    active: true,
  },
  {
    name: "Economia Mensal",
    placeholder: "grafico_economia_mensal",
    chart_type: "bar",
    engine: "rendered_image",
    data_source: "tabelas.economia_mensal",
    label_field: "mes",
    value_field: "valor",
    title: "Economia Mensal Estimada",
    subtitle: "Economia em R$",
    colors: ["#10b981"],
    chart_options: {},
    width: 1600,
    height: 900,
    show_legend: false,
    show_grid: true,
    show_labels: true,
    active: true,
  },
  {
    name: "Comparação de Custos",
    placeholder: "vc_grafico_de_comparacao",
    chart_type: "bar",
    engine: "rendered_image",
    data_source: "tabelas.comparacao_investimento",
    label_field: "item",
    value_field: "valor",
    title: "Comparação de Custos",
    subtitle: "Antes e Depois da Energia Solar",
    colors: ["#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4"],
    chart_options: {},
    width: 1600,
    height: 900,
    show_legend: true,
    show_grid: true,
    show_labels: true,
    active: true,
  },
  {
    name: "Fluxo de Caixa Acumulado",
    placeholder: "s_fluxo_caixa_acumulado_anual",
    chart_type: "bar",
    engine: "rendered_image",
    data_source: "tabelas.fluxo_caixa",
    label_field: "ano",
    value_field: "valor",
    title: "Retorno do Investimento",
    subtitle: "Fluxo de caixa acumulado",
    colors: ["#f59e0b", "#3b82f6"],
    chart_options: { negativeColor: "#f59e0b", positiveColor: "#3b82f6" },
    width: 1600,
    height: 900,
    show_legend: true,
    show_grid: true,
    show_labels: true,
    active: true,
  },
];
