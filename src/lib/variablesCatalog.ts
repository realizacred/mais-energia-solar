/**
 * ═══════════════════════════════════════════════════════════════
 * CATÁLOGO CENTRAL DE VARIÁVEIS — Single Source of Truth (SSOT)
 * ═══════════════════════════════════════════════════════════════
 *
 * REGRAS:
 *  1. Formato canônico: {{grupo.campo}}  (Mustache)
 *  2. Formato legado:   [campo]
 *  3. Ambos formatos são suportados em templates e expressões
 *  4. Toda variável DEVE ter canonicalKey e legacyKey
 *  5. Este arquivo é a ÚNICA fonte de verdade para variáveis
 *
 * CONSUMIDORES:
 *  - Templates DOCX (Mustache)
 *  - Templates WEB (HTML)
 *  - Templates de E-mail
 *  - Variáveis Customizadas (expressões)
 *  - VariableMapperPanel (vínculo de contrato)
 *  - VariablesPanel (painel lateral)
 */

// ── Types ────────────────────────────────────────────────────

export type VariableCategory =
  | "entrada"
  | "sistema_solar"
  | "financeiro"
  | "conta_energia"
  | "comercial"
  | "cliente"
  | "tabelas"
  | "series"
  | "premissas"
  | "cdd"
  | "customizada";

export const CATEGORY_LABELS: Record<VariableCategory, string> = {
  entrada: "Entrada de Dados",
  sistema_solar: "Sistema Solar",
  financeiro: "Financeiro",
  conta_energia: "Conta de Energia",
  comercial: "Comercial",
  cliente: "Cliente",
  tabelas: "Tabelas",
  series: "Séries",
  premissas: "Premissas",
  cdd: "Campos dos Distribuidores",
  customizada: "Variáveis Customizadas",
};

export const CATEGORY_ORDER: VariableCategory[] = [
  "entrada",
  "sistema_solar",
  "financeiro",
  "conta_energia",
  "comercial",
  "cliente",
  "tabelas",
  "series",
  "premissas",
  "cdd",
  "customizada",
];

export type VariableAppliesTo = "proposta" | "contrato" | "email" | "todos";

export interface CatalogVariable {
  /** Chave canônica: {{grupo.campo}} */
  canonicalKey: string;
  /** Chave legada: [campo] */
  legacyKey: string;
  /** Label curto para exibição */
  label: string;
  /** Descrição detalhada */
  description: string;
  /** Categoria */
  category: VariableCategory;
  /** Aplica-se a */
  appliesTo: VariableAppliesTo;
  /** Unidade (R$, kWh, %, etc.) */
  unit: string;
  /** Exemplo de valor */
  example: string;
  /** Se é uma série (lista de valores) */
  isSeries?: boolean;
  /** Se ainda não está implantado */
  notImplemented?: boolean;
}

// ── Helper para criar variáveis rapidamente ──────────────────

function v(
  category: VariableCategory,
  canonical: string,
  legacy: string,
  label: string,
  description: string,
  unit: string,
  example: string,
  appliesTo: VariableAppliesTo = "todos",
  opts?: { isSeries?: boolean; notImplemented?: boolean }
): CatalogVariable {
  return {
    canonicalKey: `{{${canonical}}}`,
    legacyKey: `[${legacy}]`,
    label,
    description,
    category,
    appliesTo,
    unit,
    example,
    ...opts,
  };
}

// ═══════════════════════════════════════════════════════════════
// CATÁLOGO COMPLETO
// ═══════════════════════════════════════════════════════════════

export const VARIABLES_CATALOG: CatalogVariable[] = [
  // ──────────────────────────────────────────────────────────────
  // ENTRADA DE DADOS
  // ──────────────────────────────────────────────────────────────
  // ── Tipo e Consumo ──
  v("entrada", "entrada.tipo", "tipo", "Tipo de Dimensionamento", "BT ou MT", "-", "BT|MT"),
  v("entrada", "entrada.tipo_uc1", "tipo_uc1", "Tipo de Dimensionamento UC #", "Tipo de dimensionamento por UC", "-", "BT"),
  v("entrada", "entrada.consumo_mensal", "consumo_mensal", "Consumo Mensal", "Consumo mensal total (BT)", "kWh", "1.000"),
  v("entrada", "entrada.consumo_mensal_uc1", "consumo_mensal_uc1", "Consumo Mensal UC #", "Consumo mensal por UC (BT)", "kWh", "1.000"),
  v("entrada", "entrada.consumo_mensal_p", "consumo_mensal_p", "Consumo Mensal Ponta", "Consumo mensal na ponta (MT)", "kWh", "12.000"),
  v("entrada", "entrada.consumo_mensal_p_uc1", "consumo_mensal_p_uc1", "Consumo Mensal Ponta UC #", "Consumo mensal ponta por UC (MT)", "kWh", "12.000"),
  v("entrada", "entrada.consumo_mensal_fp", "consumo_mensal_fp", "Consumo Mensal Fora Ponta", "Consumo mensal fora da ponta (MT)", "kWh", "11.000"),
  v("entrada", "entrada.consumo_mensal_fp_uc1", "consumo_mensal_fp_uc1", "Consumo Mensal Fora Ponta UC #", "Consumo mensal fora ponta por UC (MT)", "kWh", "11.000"),

  // ── Distribuidora e Subgrupo ──
  v("entrada", "entrada.dis_energia", "dis_energia", "Distribuidora de Energia", "Nome da concessionária/distribuidora", "-", "Copel-DIS"),
  v("entrada", "entrada.subgrupo_uc1", "subgrupo_uc1", "Subgrupo UC#", "Subgrupo tarifário por UC", "-", "A4 - Verde"),

  // ── Consumo mensal por mês (BT — Disponível para os 12 meses) ──
  v("entrada", "entrada.consumo_jan", "consumo_jan", "Consumo Janeiro", "Consumo em janeiro (Disponível para os 12 meses)", "kWh", "1.236"),
  v("entrada", "entrada.consumo_jan_uc1", "consumo_jan_uc1", "Consumo Janeiro UC #", "Consumo em janeiro por UC (Disponível para os 12 meses)", "kWh", "1.236"),
  v("entrada", "entrada.consumo_fev", "consumo_fev", "Consumo Fevereiro", "Consumo em fevereiro", "kWh", "480"),
  v("entrada", "entrada.consumo_mar", "consumo_mar", "Consumo Março", "Consumo em março", "kWh", "460"),
  v("entrada", "entrada.consumo_abr", "consumo_abr", "Consumo Abril", "Consumo em abril", "kWh", "400"),
  v("entrada", "entrada.consumo_mai", "consumo_mai", "Consumo Maio", "Consumo em maio", "kWh", "380"),
  v("entrada", "entrada.consumo_jun", "consumo_jun", "Consumo Junho", "Consumo em junho", "kWh", "350"),
  v("entrada", "entrada.consumo_jul", "consumo_jul", "Consumo Julho", "Consumo em julho", "kWh", "340"),
  v("entrada", "entrada.consumo_ago", "consumo_ago", "Consumo Agosto", "Consumo em agosto", "kWh", "360"),
  v("entrada", "entrada.consumo_set", "consumo_set", "Consumo Setembro", "Consumo em setembro", "kWh", "380"),
  v("entrada", "entrada.consumo_out", "consumo_out", "Consumo Outubro", "Consumo em outubro", "kWh", "420"),
  v("entrada", "entrada.consumo_nov", "consumo_nov", "Consumo Novembro", "Consumo em novembro", "kWh", "450"),
  v("entrada", "entrada.consumo_dez", "consumo_dez", "Consumo Dezembro", "Consumo em dezembro", "kWh", "490"),

  // ── Consumo mensal Ponta por mês (MT — Disponível para os 12 meses) ──
  v("entrada", "entrada.consumo_mensal_p_jan", "consumo_mensal_p_jan", "Consumo Mensal Ponta Janeiro", "Consumo ponta em janeiro (Disponível para os 12 meses)", "kWh", "12.000"),
  v("entrada", "entrada.consumo_mensal_p_jan_uc1", "consumo_mensal_p_jan_uc1", "Consumo Mensal Ponta Janeiro UC #", "Consumo ponta em janeiro por UC", "kWh", "12.000"),

  // ── Consumo mensal Fora Ponta por mês (MT — Disponível para os 12 meses) ──
  v("entrada", "entrada.consumo_mensal_fp_jan", "consumo_mensal_fp_jan", "Consumo Mensal Fora Ponta Janeiro", "Consumo fora ponta em janeiro (Disponível para os 12 meses)", "kWh", "11.000"),
  v("entrada", "entrada.consumo_mensal_fp_jan_uc1", "consumo_mensal_fp_jan_uc1", "Consumo Mensal Fora Ponta Janeiro UC #", "Consumo fora ponta em janeiro por UC", "kWh", "11.000"),

  // ── Tarifas (BT) ──
  v("entrada", "entrada.tarifa_distribuidora", "tarifa_distribuidora", "Tarifa Distribuidora", "Tarifa da distribuidora (BT)", "R$", "0,97"),
  v("entrada", "entrada.tarifa_distribuidora_uc1", "tarifa_distribuidora_uc1", "Tarifa Distribuidora UC #", "Tarifa da distribuidora por UC (BT)", "R$", "0,97"),

  // ── Tarifas (MT) ──
  v("entrada", "entrada.tarifa_te_p", "tarifa_te_p", "Tarifa TE Ponta", "Tarifa TE na ponta (MT)", "R$", "0,98"),
  v("entrada", "entrada.tarifa_te_p_uc1", "tarifa_te_p_uc1", "Tarifa TE Ponta UC #", "Tarifa TE ponta por UC (MT)", "R$", "0,98"),
  v("entrada", "entrada.tarifa_tusd_p", "tarifa_tusd_p", "Tarifa TUSD Ponta", "Tarifa TUSD na ponta (MT)", "R$", "0,89"),
  v("entrada", "entrada.tarifa_tusd_p_uc1", "tarifa_tusd_p_uc1", "Tarifa TUSD Ponta UC #", "Tarifa TUSD ponta por UC (MT)", "R$", "0,89"),
  v("entrada", "entrada.tarifa_te_fp", "tarifa_te_fp", "Tarifa TE Fora Ponta", "Tarifa TE fora ponta (MT)", "R$", "0,87"),
  v("entrada", "entrada.tarifa_te_fp_uc1", "tarifa_te_fp_uc1", "Tarifa TE Fora Ponta UC #", "Tarifa TE fora ponta por UC (MT)", "R$", "0,87"),
  v("entrada", "entrada.tarifa_tusd_fp", "tarifa_tusd_fp", "Tarifa TUSD Fora Ponta", "Tarifa TUSD fora ponta (MT)", "R$", "0,86"),
  v("entrada", "entrada.tarifa_tusd_fp_uc1", "tarifa_tusd_fp_uc1", "Tarifa TUSD Fora Ponta UC #", "Tarifa TUSD fora ponta por UC (MT)", "R$", "0,86"),

  // ── Demanda (MT) ──
  v("entrada", "entrada.demanda_preco", "demanda_preco", "Demanda Preço", "Preço da demanda (MT)", "R$", "12,56"),
  v("entrada", "entrada.demanda_preco_uc1", "demanda_preco_uc1", "Demanda Preço UC #", "Preço da demanda por UC (MT)", "R$", "12,56"),
  v("entrada", "entrada.demanda_contratada", "demanda_contratada", "Demanda Contratada", "Demanda contratada (MT)", "KW", "123"),
  v("entrada", "entrada.demanda_contratada_uc1", "demanda_contratada_uc1", "Demanda Contratada UC #", "Demanda contratada por UC (MT)", "KW", "123"),
  v("entrada", "entrada.demanda_adicional", "demanda_adicional", "Demanda Adicional", "Demanda adicional (MT)", "KW", "50"),

  // ── Outros Encargos ──
  v("entrada", "entrada.outros_encargos_atual", "outros_encargos_atual", "Outros Encargos Atual", "Outros encargos atuais", "R$", "123"),
  v("entrada", "entrada.outros_encargos_atual_uc1", "outros_encargos_atual_uc1", "Outros Encargos Atual UC #", "Outros encargos atuais por UC", "R$", "123"),
  v("entrada", "entrada.outros_encargos_novo", "outros_encargos_novo", "Outros Encargos Novo", "Outros encargos novos (com solar)", "R$", "123"),
  v("entrada", "entrada.outros_encargos_novo_uc1", "outros_encargos_novo_uc1", "Outros Encargos Novo UC #", "Outros encargos novos por UC", "R$", "123"),

  // ── Localização e Parâmetros ──
  v("entrada", "entrada.estado", "estado", "Estado", "UF do cliente", "-", "RJ"),
  v("entrada", "entrada.cidade", "cidade", "Cidade", "Cidade do cliente", "-", "Rio de Janeiro"),
  v("entrada", "entrada.distancia", "distancia", "Distância", "Distância para instalação", "KM", "50"),
  v("entrada", "entrada.taxa_desempenho", "taxa_desempenho", "Taxa de Desempenho", "Performance ratio do sistema", "%", "80"),
  v("entrada", "entrada.desvio_azimutal", "desvio_azimutal", "Desvio Azimutal", "Desvio em relação ao norte", "°", "90"),
  v("entrada", "entrada.inclinacao", "inclinacao", "Inclinação", "Ângulo de inclinação dos módulos", "°", "20"),
  v("entrada", "entrada.fator_geracao", "fator_geracao", "Fator de Geração", "Fator de geração local", "kWh/kWp", "120"),
  v("entrada", "entrada.fator_geracao_jan", "fator_geracao_jan", "Fator de Geração Janeiro", "Fator de geração em janeiro (Disponível para os 12 meses)", "kWh/kWp", "120"),

  // ── Instalação ──
  v("entrada", "entrada.tipo_telhado", "tipo_telhado", "Tipo de Telhado", "Tipo de telhado/cobertura", "-", "Shingle"),
  v("entrada", "entrada.fase", "fase", "Fase", "Fase elétrica", "-", "Trifásico"),
  v("entrada", "entrada.fase_uc1", "fase_uc1", "Fase UC #", "Fase elétrica por UC", "-", "Trifásico"),
  v("entrada", "entrada.tensao_rede", "tensao_rede", "Tensão da Rede", "Tensão da rede elétrica", "V", "127/220V"),

  // ── Custo de Disponibilidade ──
  v("entrada", "entrada.custo_disponibilidade_kwh", "custo_disponibilidade_kwh", "Custo de Disponibilidade", "Custo de disponibilidade em kWh (BT)", "kWh", "100"),
  v("entrada", "entrada.custo_disponibilidade_kwh_uc1", "custo_disponibilidade_kwh_uc1", "Custo de Disponibilidade UC #", "Custo de disponibilidade por UC (BT)", "kWh", "100"),
  v("entrada", "entrada.topologia", "topologia", "Topologia", "Microinversor, String, etc.", "-", "Microinversor"),
  v("entrada", "entrada.fator_simultaneidade", "fator_simultaneidade", "Fator de Simultaneidade", "Fator de simultaneidade para autoconsumo", "%", "10"),

  // ── Rateio de Créditos ──
  v("entrada", "entrada.rateio_sugerido_creditos", "rateio_sugerido_creditos", "Rateio Sugerido dos Créditos Gerados UCs", "Rateio sugerido de créditos de todas as UCs", "%", "100"),
  v("entrada", "entrada.rateio_sugerido_creditos_uc1", "rateio_sugerido_creditos_uc1", "Rateio Sugerido dos Créditos Gerados UC #", "Rateio sugerido por UC", "%", "10"),
  v("entrada", "entrada.rateio_creditos", "rateio_creditos", "Rateio dos Créditos Gerados UCs", "Rateio real de créditos de todas as UCs", "%", "100"),
  v("entrada", "entrada.rateio_creditos_uc1", "rateio_creditos_uc1", "Rateio dos Créditos Gerados UC #", "Rateio real por UC", "%", "10"),

  // ── Impostos ──
  v("entrada", "entrada.imposto_energia", "imposto_energia", "Imposto Sobre Energia UCs", "Imposto sobre energia de todas as UCs", "%", "10"),
  v("entrada", "entrada.imposto_energia_uc1", "imposto_energia_uc1", "Imposto Sobre Energia UC #", "Imposto sobre energia por UC", "%", "10"),

  // ── UC ──
  v("entrada", "entrada.nome_uc1", "nome_uc1", "Nome da Unidade Consumidora", "Nome/apelido da UC", "-", "Usina 1"),

  // ── Demanda Geração (MT) ──
  v("entrada", "entrada.demanda_g_uc1", "demanda_g_uc1", "Demanda Geração UC 1", "Demanda de geração por UC (MT)", "kW", "30,00"),
  v("entrada", "entrada.demanda_g_preco_uc1", "demanda_g_preco_uc1", "Demanda Geração Preço UC 1", "Preço da demanda de geração por UC (MT)", "R$", "10,00"),

  // ── Tarifa Fio B / Energia Compensada ──
  v("entrada", "entrada.t_e_comp_fp_1_uc1", "t_e_comp_fp_1_uc1", "Tarifa Fio B/Energia Compensada Fora Ponta 1 UC #", "Tarifa Fio B energia compensada fora ponta período 1 por UC (MT)", "R$", "0,12345"),
  v("entrada", "entrada.t_e_comp_fp_2_uc1", "t_e_comp_fp_2_uc1", "Tarifa Fio B/Energia Compensada Fora Ponta 2 UC #", "Tarifa Fio B energia compensada fora ponta período 2 por UC (MT)", "R$", "0,12345"),
  v("entrada", "entrada.t_e_comp_p_1_uc1", "t_e_comp_p_1_uc1", "Tarifa Fio B/Energia Compensada Ponta 1 UC #", "Tarifa Fio B energia compensada ponta período 1 por UC (MT)", "R$", "0,12345"),
  v("entrada", "entrada.t_e_comp_p_2_uc1", "t_e_comp_p_2_uc1", "Tarifa Fio B/Energia Compensada Ponta 2 UC #", "Tarifa Fio B energia compensada ponta período 2 por UC (MT)", "R$", "0,12345"),
  v("entrada", "entrada.t_e_comp_bt_1_uc1", "t_e_comp_bt_1_uc1", "Tarifa Fio B/Energia Compensada BT 1 UC #", "Tarifa Fio B energia compensada BT período 1 por UC", "R$", "0,12345"),
  v("entrada", "entrada.t_e_comp_bt_2_uc1", "t_e_comp_bt_2_uc1", "Tarifa Fio B/Energia Compensada BT 2 UC #", "Tarifa Fio B energia compensada BT período 2 por UC", "R$", "0,12345"),

  // ── Regra de Compensação ──
  v("entrada", "entrada.regra_comp_uc1", "regra_comp_uc1", "Regra de Compensação", "0 (GD I) ou 1 (GD II) por UC", "-", "1"),

  // ── Sistema ──
  v("entrada", "entrada.tipo_sistema", "tipo_sistema", "Tipo de Sistema", "On Grid / Híbrido / Off Grid", "-", "On Grid / Híbrido / Off Grid"),
  v("entrada", "entrada.dod", "dod", "DoD", "Depth of Discharge (profundidade de descarga)", "%", "80,00"),

  // ──────────────────────────────────────────────────────────────
  // SISTEMA SOLAR
  // ──────────────────────────────────────────────────────────────
  // ── Potência e Geração ──
  v("sistema_solar", "sistema_solar.potencia_ideal_total", "potencia_ideal_total", "Potência Ideal Total UCs", "Potência ideal calculada para atender consumo de todas as UCs", "kWp", "20.45"),
  v("sistema_solar", "sistema_solar.potencia_ideal_uc1", "potencia_ideal_uc1", "Potência Ideal UC #", "Potência ideal por UC específica", "kWp", "20.45"),
  v("sistema_solar", "sistema_solar.tipo_fornecedor_distribuidor", "tipo_fornecedor_distribuidor", "Tipo Fornecedor", "Fornecedor ou Distribuidor", "-", "Distribuidor"),
  v("sistema_solar", "sistema_solar.fornecedor", "fornecedor", "Fornecedor", "Nome do fornecedor", "-", "SolarView"),
  v("sistema_solar", "sistema_solar.tipo_kit", "tipo_kit", "Tipo de Kit", "Aberto ou Fechado", "-", "Aberto"),
  v("sistema_solar", "sistema_solar.potencia_sistema", "potencia_sistema", "Potência do Sistema", "Potência real do sistema configurado", "kWp", "8,2"),
  v("sistema_solar", "sistema_solar.geracao_mensal", "geracao_mensal", "Geração Mensal", "Geração média mensal estimada", "kWh", "556"),
  v("sistema_solar", "sistema_solar.geracao_jan", "geracao_jan", "Geração Janeiro", "Geração estimada em janeiro (Disponível para os 12 meses)", "kWh", "12.254"),
  v("sistema_solar", "sistema_solar.geracao_fev", "geracao_fev", "Geração Fevereiro", "Geração estimada em fevereiro", "kWh", "1150"),
  v("sistema_solar", "sistema_solar.geracao_mar", "geracao_mar", "Geração Março", "Geração estimada em março", "kWh", "1100"),
  v("sistema_solar", "sistema_solar.geracao_abr", "geracao_abr", "Geração Abril", "Geração estimada em abril", "kWh", "1000"),
  v("sistema_solar", "sistema_solar.geracao_mai", "geracao_mai", "Geração Maio", "Geração estimada em maio", "kWh", "900"),
  v("sistema_solar", "sistema_solar.geracao_jun", "geracao_jun", "Geração Junho", "Geração estimada em junho", "kWh", "850"),
  v("sistema_solar", "sistema_solar.geracao_jul", "geracao_jul", "Geração Julho", "Geração estimada em julho", "kWh", "870"),
  v("sistema_solar", "sistema_solar.geracao_ago", "geracao_ago", "Geração Agosto", "Geração estimada em agosto", "kWh", "950"),
  v("sistema_solar", "sistema_solar.geracao_set", "geracao_set", "Geração Setembro", "Geração estimada em setembro", "kWh", "1050"),
  v("sistema_solar", "sistema_solar.geracao_out", "geracao_out", "Geração Outubro", "Geração estimada em outubro", "kWh", "1150"),
  v("sistema_solar", "sistema_solar.geracao_nov", "geracao_nov", "Geração Novembro", "Geração estimada em novembro", "kWh", "1180"),
  v("sistema_solar", "sistema_solar.geracao_dez", "geracao_dez", "Geração Dezembro", "Geração estimada em dezembro", "kWh", "1200"),
  v("sistema_solar", "sistema_solar.geracao_anual_0", "geracao_anual_0", "Geração Anual", "Geração anual (Disponível para os 25 anos: _0 a _25)", "kWh", "6.672"),
  v("sistema_solar", "sistema_solar.geracao_anual_0_uc1", "geracao_anual_0_uc1", "Geração Anual UC #", "Geração anual por UC (Disponível para os 25 anos)", "kWh", "6.672"),
  v("sistema_solar", "sistema_solar.kit_fechado_quantidade", "kit_fechado_quantidade", "Qtd. Kits Fechados", "Quantidade de kits fechados utilizados", "-", "3"),
  v("sistema_solar", "sistema_solar.segmentos_utilizados", "segmentos_utilizados", "Qtd. Segmentos Utilizados", "Quantidade de segmentos utilizados (mínimo 1)", "-", "5"),

  // ── Módulo ──
  v("sistema_solar", "sistema_solar.modulo_fabricante", "modulo_fabricante", "Módulo Fabricante", "Fabricante do módulo solar", "-", "CANADIAN"),
  v("sistema_solar", "sistema_solar.modulo_modelo", "modulo_modelo", "Módulo Modelo", "Modelo do módulo", "-", "CS6K-320"),
  v("sistema_solar", "sistema_solar.modulo_potencia", "modulo_potencia", "Módulo Potência", "Potência unitária do módulo", "W", "320"),
  v("sistema_solar", "sistema_solar.modulo_quantidade", "modulo_quantidade", "Módulo Quantidade", "Quantidade total de módulos", "UN", "256"),
  v("sistema_solar", "sistema_solar.modulo_celulas", "modulo_celulas", "Módulo Nº de Células", "Número de células do módulo", "UN", "72"),
  v("sistema_solar", "sistema_solar.modulo_tensao_maxima", "modulo_tensao_maxima", "Módulo Tensão Máxima", "Tensão máxima do sistema do módulo", "V", "1500"),
  v("sistema_solar", "sistema_solar.modulo_comprimento", "modulo_comprimento", "Módulo Comprimento", "Comprimento do módulo", "cm", "1920"),
  v("sistema_solar", "sistema_solar.modulo_largura", "modulo_largura", "Módulo Largura", "Largura do módulo", "cm", "992"),
  v("sistema_solar", "sistema_solar.modulo_profundidade", "modulo_profundidade", "Módulo Profundidade", "Profundidade do módulo", "cm", "40"),
  v("sistema_solar", "sistema_solar.modulo_vmp", "modulo_vmp", "Módulo Tensão Vmp", "Tensão de máxima potência do módulo", "V", "41,50"),
  v("sistema_solar", "sistema_solar.modulo_voc", "modulo_voc", "Módulo Tensão Voc", "Tensão de circuito aberto do módulo", "V", "47,24"),
  v("sistema_solar", "sistema_solar.modulo_imp", "modulo_imp", "Módulo Corrente Imp", "Corrente de máxima potência do módulo", "A", "9,88"),
  v("sistema_solar", "sistema_solar.modulo_isc", "modulo_isc", "Módulo Corrente Isc", "Corrente de curto-circuito do módulo", "A", "10,44"),
  v("sistema_solar", "sistema_solar.modulo_tipo_celula", "modulo_tipo_celula", "Módulo Tipo Célula", "Tipo da célula do módulo", "-", "Monocristalino"),
  v("sistema_solar", "sistema_solar.modulo_coef_temp_voc", "modulo_coef_temp_voc", "Módulo Coeficiente Temp Voc", "Coeficiente de temperatura Voc", "%", "10"),
  v("sistema_solar", "sistema_solar.modulo_coef_temp_isc", "modulo_coef_temp_isc", "Módulo Coeficiente Temp Isc", "Coeficiente de temperatura Isc", "%", "10"),
  v("sistema_solar", "sistema_solar.modulo_coef_temp_pmax", "modulo_coef_temp_pmax", "Módulo Coeficiente Temp Pmax", "Coeficiente de temperatura Pmax", "%", "10"),
  v("sistema_solar", "sistema_solar.modulo_eficiencia", "modulo_eficiencia", "Módulo Eficiência", "Eficiência do módulo", "%", "19,80"),
  v("sistema_solar", "sistema_solar.modulo_codigo", "modulo_codigo", "Módulo Código", "Código do módulo no catálogo", "-", "123"),

  // ── Inversor (indexado — O número é incremental) ──
  v("sistema_solar", "sistema_solar.inversor_fabricante_1", "inversor_fabricante_1", "Inversor Fabricante 1", "Fabricante do inversor 1 (O número é incremental)", "-", "SUNGROW"),
  v("sistema_solar", "sistema_solar.inversor_modelo_1", "inversor_modelo_1", "Inversor Modelo 1", "Modelo do inversor 1 (O número é incremental)", "-", "SG36KTL-M"),
  v("sistema_solar", "sistema_solar.inversor_quantidade_1", "inversor_quantidade_1", "Inversor Quantidade 1", "Quantidade do inversor 1 (O número é incremental)", "-", "1"),
  v("sistema_solar", "sistema_solar.inversor_potencia_1", "inversor_potencia_1", "Inversor Potência Máxima 1", "Potência máxima do inversor 1 (O número é incremental)", "-", "1"),
  v("sistema_solar", "sistema_solar.inversor_potencia_nominal_1", "inversor_potencia_nominal_1", "Inversor Potência Nominal 1", "Potência nominal do inversor 1 (O número é incremental)", "-", "1"),
  v("sistema_solar", "sistema_solar.inversor_tensao_1", "inversor_tensao_1", "Inversor Tensão em Linha 1", "Tensão em linha do inversor 1 (O número é incremental)", "V", "380"),
  v("sistema_solar", "sistema_solar.inversor_tipo_1", "inversor_tipo_1", "Inversor Tipo 1", "Tipo do inversor 1 (O número é incremental)", "-", "Monofásico"),
  v("sistema_solar", "sistema_solar.inversor_corrente_saida_1", "inversor_corrente_saida_1", "Inversor Corrente Saída 1", "Corrente de saída do inversor 1 (O número é incremental)", "A", "10"),
  v("sistema_solar", "sistema_solar.inversor_mppts_utilizados_1", "inversor_mppts_utilizados_1", "Inversor MPPTs Utilizados 1", "MPPTs utilizados do inversor 1 (O número é incremental)", "-", "2"),
  v("sistema_solar", "sistema_solar.inversor_strings_utilizadas_1", "inversor_strings_utilizadas_1", "Inversor Strings Utilizadas 1", "Strings utilizadas do inversor 1 (O número é incremental)", "-", "2"),

  // ── Inversor (concatenados — todos os inversores) ──
  v("sistema_solar", "sistema_solar.inversor_fabricante", "inversor_fabricante", "Inversor Fabricante", "Fabricantes de todos os inversores concatenados", "-", "ABB / FRONIUS"),
  v("sistema_solar", "sistema_solar.inversor_modelo", "inversor_modelo", "Inversor Modelo", "Modelos de todos os inversores concatenados", "-", "UNO-DM / ECO 25"),
  v("sistema_solar", "sistema_solar.inversor_quantidade", "inversor_quantidade", "Inversor Quantidade", "Quantidades de todos os inversores concatenadas", "-", "1 / 2"),
  v("sistema_solar", "sistema_solar.inversor_potencia_nominal", "inversor_potencia_nominal", "Inversor Potência Nominal", "Potências nominais concatenadas", "-", "2.700 / 24.000"),
  v("sistema_solar", "sistema_solar.inversor_potencia", "inversor_potencia", "Inversor Potência Máxima", "Potências máximas concatenadas", "W", "3.000 / 25.000"),
  v("sistema_solar", "sistema_solar.inversor_tensao", "inversor_tensao", "Inversor Tensão", "Tensões concatenadas", "V", "127 / 480"),
  v("sistema_solar", "sistema_solar.inversor_tipo", "inversor_tipo", "Inversor Tipo", "Tipos concatenados", "-", "Monofásico / Trifásico"),
  v("sistema_solar", "sistema_solar.inversor_corrente_saida", "inversor_corrente_saida", "Inversor Corrente Saída", "Correntes de saída concatenadas", "A", "10 / 15"),
  v("sistema_solar", "sistema_solar.inversor_mppts_utilizados", "inversor_mppts_utilizados", "Inversor MPPTs Utilizados", "MPPTs utilizados concatenados", "-", "2"),
  v("sistema_solar", "sistema_solar.inversor_strings_utilizadas", "inversor_strings_utilizadas", "Inversor Strings Utilizadas", "Strings utilizadas concatenadas", "-", "2"),
  v("sistema_solar", "sistema_solar.inversor_codigo", "inversor_codigo", "Inversor Código", "Código do inversor no catálogo", "-", "123"),

  // ── Otimizador ──
  v("sistema_solar", "sistema_solar.otimizador_fabricante", "otimizador_fabricante", "Otimizador Fabricante", "Fabricante do otimizador", "-", "SOLAREDGE"),
  v("sistema_solar", "sistema_solar.otimizador_modelo", "otimizador_modelo", "Otimizador Modelo", "Modelo do otimizador", "-", "P505"),
  v("sistema_solar", "sistema_solar.otimizador_potencia", "otimizador_potencia", "Otimizador Potência", "Potência do otimizador", "W", "505"),
  v("sistema_solar", "sistema_solar.otimizador_quantidade", "otimizador_quantidade", "Otimizador Quantidade", "Quantidade de otimizadores", "UN", "30"),

  // ── Totais inversores ──
  v("sistema_solar", "sistema_solar.inversores_potencia_maxima_total", "inversores_potencia_maxima_total", "Potência Máxima Total dos Inversores", "Potência máxima total somada de todos os inversores", "W", "53.000"),
  v("sistema_solar", "sistema_solar.inversores_utilizados", "inversores_utilizados", "Quantidade de Inversores Utilizados", "Total de inversores utilizados", "UN", "3"),

  // ── Kit Fechado ──
  v("sistema_solar", "sistema_solar.kit_codigo", "kit_codigo", "Código do Kit Fechado", "Código(s) do kit fechado", "-", "23012-3 / 12392-1"),
  v("sistema_solar", "sistema_solar.kit_comp_nome_1", "kit_comp_nome_1", "Outros Componentes do Kit Nome 1", "Nome do componente extra do kit (O número é incremental)", "-", "Cabo Solar Preto"),
  v("sistema_solar", "sistema_solar.kit_comp_qtd_1", "kit_comp_qtd_1", "Outros Componentes do Kit Quantidade 1", "Quantidade do componente extra do kit (O número é incremental)", "UN", "3"),

  // ── Área e Estrutura ──
  v("sistema_solar", "sistema_solar.area_util", "area_util", "Área Útil", "Área útil disponível para instalação", "m²", "300"),
  v("sistema_solar", "sistema_solar.area_necessaria", "area_necessaria", "Área necessária", "Área total necessária para instalação", "m²", "42"),
  v("sistema_solar", "sistema_solar.peso_total", "peso_total", "Peso total", "Peso total do sistema", "kg", "380"),
  v("sistema_solar", "sistema_solar.estrutura_tipo", "estrutura_tipo", "Tipo estrutura", "Tipo de estrutura de fixação", "", "Trilho alumínio"),

  // ── Transformador ──
  v("sistema_solar", "sistema_solar.transformador_nome", "transformador_nome", "Transformador Nome", "Nome do transformador", "-", "Autotransformador XYZ"),
  v("sistema_solar", "sistema_solar.transformador_potencia", "transformador_potencia", "Transformador Potência", "Potência do transformador", "kVa", "500"),

  // ── Layout dos Módulos ──
  v("sistema_solar", "sistema_solar.layout_arranjo_linhas", "layout_arranjo_linhas", "Layout Linhas por Arranjo", "Linhas por arranjo (concatenados)", "UN", "1 / 3"),
  v("sistema_solar", "sistema_solar.layout_arranjo_modulos", "layout_arranjo_modulos", "Layout Módulos por Arranjo", "Módulos por arranjo (concatenados)", "UN", "10 / 5"),
  v("sistema_solar", "sistema_solar.layout_arranjo_orientacao", "layout_arranjo_orientacao", "Layout Orientações por Arranjo", "Orientações por arranjo (concatenados)", "-", "vertical / horizontal"),
  v("sistema_solar", "sistema_solar.layout_linhas_total", "layout_linhas_total", "Layout Total de Linhas", "Total de linhas de módulos", "UN", "4"),
  v("sistema_solar", "sistema_solar.layout_arranjos_total", "layout_arranjos_total", "Layout Total de Arranjos", "Total de arranjos", "UN", "2"),
  v("sistema_solar", "sistema_solar.layout_arranjos_total_horizontal", "layout_arranjos_total_horizontal", "Layout Arranjos Horizontais", "Total de arranjos na horizontal", "UN", "2"),
  v("sistema_solar", "sistema_solar.layout_arranjos_total_vertical", "layout_arranjos_total_vertical", "Layout Arranjos Verticais", "Total de arranjos na vertical", "UN", "2"),
  v("sistema_solar", "sistema_solar.layout_orientacao", "layout_orientacao", "Orientação", "Orientação do arranjo (N, NE, NO...)", "", "Norte"),

  // ── UCs e Créditos ──
  v("sistema_solar", "sistema_solar.qtd_ucs", "qtd_ucs", "Quantidade UCs", "Quantidade de unidades consumidoras", "-", "1"),
  v("sistema_solar", "sistema_solar.creditos_gerados", "creditos_gerados", "Créditos Gerados UCs", "Créditos de energia gerados nas UCs", "kWh", "800"),

  // ── Inversor Corrente Máxima Entrada ──
  v("sistema_solar", "sistema_solar.inversor_corrente_max_entrada_mppt1_1", "inversor_corrente_max_entrada_mppt1_1", "Inversor Corrente Máx. Entrada MPPT", "Corrente máxima de entrada por MPPT do inversor", "A", "16"),
  v("sistema_solar", "sistema_solar.inversor_corrente_max_entrada_1", "inversor_corrente_max_entrada_1", "Inversor Corrente Máx. Entrada MPPTs", "Corrente máxima de entrada de todos MPPTs do inversor (concatenados)", "A", "16 / 16"),

  // ── Bateria (concatenados — todas as baterias) ──
  v("sistema_solar", "sistema_solar.bateria_fabricante", "bateria_fabricante", "Bateria Fabricante", "Fabricante(s) da(s) bateria(s)", "-", "UNIPOWER"),
  v("sistema_solar", "sistema_solar.bateria_modelo", "bateria_modelo", "Bateria Modelo", "Modelo(s) da(s) bateria(s)", "-", "UPLFP48-100 3U"),
  v("sistema_solar", "sistema_solar.bateria_tipo", "bateria_tipo", "Bateria Tipo", "Tipo(s) da(s) bateria(s)", "-", "Lítio"),
  v("sistema_solar", "sistema_solar.bateria_energia", "bateria_energia", "Bateria Energia", "Energia da(s) bateria(s)", "kWh", "5"),
  v("sistema_solar", "sistema_solar.bateria_quantidade", "bateria_quantidade", "Bateria Quantidade", "Quantidade total de baterias", "-", "2"),
  v("sistema_solar", "sistema_solar.bateria_comprimento", "bateria_comprimento", "Bateria Comprimento", "Comprimento da(s) bateria(s)", "mm", "390"),
  v("sistema_solar", "sistema_solar.bateria_largura", "bateria_largura", "Bateria Largura", "Largura da(s) bateria(s)", "mm", "442"),
  v("sistema_solar", "sistema_solar.bateria_profundidade", "bateria_profundidade", "Bateria Profundidade", "Profundidade da(s) bateria(s)", "mm", "140"),
  v("sistema_solar", "sistema_solar.bateria_tensao_operacao", "bateria_tensao_operacao", "Bateria Tensão de Operação", "Tensão de operação da(s) bateria(s)", "V", "36"),
  v("sistema_solar", "sistema_solar.bateria_tensao_carga", "bateria_tensao_carga", "Bateria Tensão de Carga", "Tensão de carga da(s) bateria(s)", "V", "36"),
  v("sistema_solar", "sistema_solar.bateria_tensao_nominal", "bateria_tensao_nominal", "Bateria Tensão Nominal", "Tensão nominal da(s) bateria(s)", "V", "48"),
  v("sistema_solar", "sistema_solar.bateria_potencia_maxima_saida", "bateria_potencia_maxima_saida", "Bateria Potência Máx. Saída", "Potência máxima de saída da(s) bateria(s)", "kW", "-"),
  v("sistema_solar", "sistema_solar.bateria_corrente_maxima_descarga", "bateria_corrente_maxima_descarga", "Bateria Corrente Máx. Descarga", "Corrente máxima de descarga", "A", "100"),
  v("sistema_solar", "sistema_solar.bateria_corrente_maxima_carga", "bateria_corrente_maxima_carga", "Bateria Corrente Máx. Carga", "Corrente máxima de carga", "A", "100"),
  v("sistema_solar", "sistema_solar.bateria_corrente_recomendada", "bateria_corrente_recomendada", "Bateria Correntes Recomendadas", "Correntes recomendadas da(s) bateria(s)", "A", "50"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_descarga_min", "bateria_temperatura_descarga_min", "Bateria Temp. Descarga Mínima", "Temperatura mínima de descarga", "°C", "-15"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_descarga_max", "bateria_temperatura_descarga_max", "Bateria Temp. Descarga Máxima", "Temperatura máxima de descarga", "°C", "55"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_carga_min", "bateria_temperatura_carga_min", "Bateria Temp. Carga Mínima", "Temperatura mínima de carga", "°C", "3"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_carga_max", "bateria_temperatura_carga_max", "Bateria Temp. Carga Máxima", "Temperatura máxima de carga", "°C", "55"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_armazenamento_min", "bateria_temperatura_armazenamento_min", "Bateria Temp. Armazenamento Mín.", "Temperatura mínima de armazenamento", "°C", "-15"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_armazenamento_max", "bateria_temperatura_armazenamento_max", "Bateria Temp. Armazenamento Máx.", "Temperatura máxima de armazenamento", "°C", "55"),
  v("sistema_solar", "sistema_solar.bateria_capacidade", "bateria_capacidade", "Bateria Capacidade", "Capacidade da(s) bateria(s)", "Ah", "100"),

  // ── Bateria (indexado — O número é incremental) ──
  v("sistema_solar", "sistema_solar.bateria_fabricante_1", "bateria_fabricante_1", "Bateria Fabricante 1", "Fabricante da bateria 1 (O número é incremental)", "-", "UNIPOWER"),
  v("sistema_solar", "sistema_solar.bateria_modelo_1", "bateria_modelo_1", "Bateria Modelo 1", "Modelo da bateria 1 (O número é incremental)", "-", "UPLFP48-100 3U"),
  v("sistema_solar", "sistema_solar.bateria_tipo_1", "bateria_tipo_1", "Bateria Tipo 1", "Tipo da bateria 1 (O número é incremental)", "-", "Lítio"),
  v("sistema_solar", "sistema_solar.bateria_energia_1", "bateria_energia_1", "Bateria Energia 1", "Energia da bateria 1 (O número é incremental)", "kWh", "5"),
  v("sistema_solar", "sistema_solar.bateria_quantidade_1", "bateria_quantidade_1", "Bateria Quantidade 1", "Quantidade da bateria 1 (O número é incremental)", "-", "2"),
  v("sistema_solar", "sistema_solar.bateria_comprimento_1", "bateria_comprimento_1", "Bateria Comprimento 1", "Comprimento da bateria 1 (O número é incremental)", "mm", "390"),
  v("sistema_solar", "sistema_solar.bateria_largura_1", "bateria_largura_1", "Bateria Largura 1", "Largura da bateria 1 (O número é incremental)", "mm", "442"),
  v("sistema_solar", "sistema_solar.bateria_profundidade_1", "bateria_profundidade_1", "Bateria Profundidade 1", "Profundidade da bateria 1 (O número é incremental)", "mm", "140"),
  v("sistema_solar", "sistema_solar.bateria_tensao_operacao_1", "bateria_tensao_operacao_1", "Bateria Tensão Operação 1", "Tensão de operação da bateria 1 (O número é incremental)", "V", "36"),
  v("sistema_solar", "sistema_solar.bateria_tensao_carga_1", "bateria_tensao_carga_1", "Bateria Tensão Carga 1", "Tensão de carga da bateria 1 (O número é incremental)", "V", "36"),
  v("sistema_solar", "sistema_solar.bateria_tensao_nominal_1", "bateria_tensao_nominal_1", "Bateria Tensão Nominal 1", "Tensão nominal da bateria 1 (O número é incremental)", "V", "48"),
  v("sistema_solar", "sistema_solar.bateria_potencia_maxima_saida_1", "bateria_potencia_maxima_saida_1", "Bateria Potência Máx. Saída 1", "Potência máxima de saída da bateria 1 (O número é incremental)", "kW", "-"),
  v("sistema_solar", "sistema_solar.bateria_corrente_maxima_descarga_1", "bateria_corrente_maxima_descarga_1", "Bateria Corrente Máx. Descarga 1", "Corrente máxima de descarga da bateria 1 (O número é incremental)", "A", "100"),
  v("sistema_solar", "sistema_solar.bateria_corrente_maxima_carga_1", "bateria_corrente_maxima_carga_1", "Bateria Corrente Máx. Carga 1", "Corrente máxima de carga da bateria 1 (O número é incremental)", "A", "100"),
  v("sistema_solar", "sistema_solar.bateria_corrente_recomendada_1", "bateria_corrente_recomendada_1", "Bateria Correntes Recomendadas 1", "Correntes recomendadas da bateria 1 (O número é incremental)", "A", "50"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_descarga_min_1", "bateria_temperatura_descarga_min_1", "Bateria Temp. Descarga Mín. 1", "Temp. mín. descarga da bateria 1 (O número é incremental)", "°C", "-15"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_descarga_max_1", "bateria_temperatura_descarga_max_1", "Bateria Temp. Descarga Máx. 1", "Temp. máx. descarga da bateria 1 (O número é incremental)", "°C", "55"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_carga_min_1", "bateria_temperatura_carga_min_1", "Bateria Temp. Carga Mín. 1", "Temp. mín. carga da bateria 1 (O número é incremental)", "°C", "3"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_carga_max_1", "bateria_temperatura_carga_max_1", "Bateria Temp. Carga Máx. 1", "Temp. máx. carga da bateria 1 (O número é incremental)", "°C", "55"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_armazenamento_min_1", "bateria_temperatura_armazenamento_min_1", "Bateria Temp. Armaz. Mín. 1", "Temp. mín. armazenamento da bateria 1 (O número é incremental)", "°C", "-15"),
  v("sistema_solar", "sistema_solar.bateria_temperatura_armazenamento_max_1", "bateria_temperatura_armazenamento_max_1", "Bateria Temp. Armaz. Máx. 1", "Temp. máx. armazenamento da bateria 1 (O número é incremental)", "°C", "55"),
  v("sistema_solar", "sistema_solar.bateria_capacidade_1", "bateria_capacidade_1", "Bateria Capacidade 1", "Capacidade da bateria 1 (O número é incremental)", "Ah", "100"),

  // ── Inversor — Bateria (híbrido/off-grid) ──
  v("sistema_solar", "sistema_solar.inversor_sistema", "inversor_sistema", "Inversor Sistema", "Tipo de sistema do inversor (Híbrido / Off Grid / On Grid)", "-", "Híbrido / Off Grid / On Grid"),
  v("sistema_solar", "sistema_solar.inversor_sistema_1", "inversor_sistema_1", "Inversor Sistema 1", "Tipo de sistema do inversor 1 (O número é incremental)", "-", "Híbrido / Off Grid / On Grid"),
  v("sistema_solar", "sistema_solar.inversor_corrente_max_carga_cc", "inversor_corrente_max_carga_cc", "Inversor Corrente Máx. Carga CC", "Corrente máxima de carga CC do inversor", "A", "-"),
  v("sistema_solar", "sistema_solar.inversor_corrente_max_carga_cc_1", "inversor_corrente_max_carga_cc_1", "Inversor Corrente Máx. Carga CC 1", "Corrente máx. carga CC do inversor 1 (O número é incremental)", "A", "-"),
  v("sistema_solar", "sistema_solar.inversor_corrente_max_descarga_cc", "inversor_corrente_max_descarga_cc", "Inversor Corrente Máx. Descarga CC", "Corrente máxima de descarga CC do inversor", "A", "-"),
  v("sistema_solar", "sistema_solar.inversor_corrente_max_descarga_cc_1", "inversor_corrente_max_descarga_cc_1", "Inversor Corrente Máx. Descarga CC 1", "Corrente máx. descarga CC do inversor 1 (O número é incremental)", "A", "-"),
  v("sistema_solar", "sistema_solar.inversor_tipo_bateria", "inversor_tipo_bateria", "Inversor Tipo de Bateria", "Tipo de bateria compatível com o inversor", "-", "Lítio"),
  v("sistema_solar", "sistema_solar.inversor_tipo_bateria_1", "inversor_tipo_bateria_1", "Inversor Tipo de Bateria 1", "Tipo de bateria do inversor 1 (O número é incremental)", "-", "Lítio"),
  v("sistema_solar", "sistema_solar.inversor_tensao_bateria_min", "inversor_tensao_bateria_min", "Inversor Tensão Bateria Mínima", "Tensão mínima de bateria do inversor", "V", "40"),
  v("sistema_solar", "sistema_solar.inversor_tensao_bateria_min_1", "inversor_tensao_bateria_min_1", "Inversor Tensão Bateria Mín. 1", "Tensão mín. bateria do inversor 1 (O número é incremental)", "V", "40"),
  v("sistema_solar", "sistema_solar.inversor_tensao_bateria_max", "inversor_tensao_bateria_max", "Inversor Tensão Bateria Máxima", "Tensão máxima de bateria do inversor", "V", "60"),
  v("sistema_solar", "sistema_solar.inversor_tensao_bateria_max_1", "inversor_tensao_bateria_max_1", "Inversor Tensão Bateria Máx. 1", "Tensão máx. bateria do inversor 1 (O número é incremental)", "V", "60"),

  // ── Armazenamento ──
  v("sistema_solar", "sistema_solar.autonomia", "autonomia", "Autonomia", "Autonomia do sistema de armazenamento", "dias", "1"),
  v("sistema_solar", "sistema_solar.energia_diaria_armazenamento", "energia_diaria_armazenamento", "Energia Diária para Armazenamento", "Energia diária necessária para armazenamento", "kWh/dia", "20"),
  v("sistema_solar", "sistema_solar.armazenamento_necessario", "armazenamento_necessario", "Armazenamento Necessário", "Armazenamento total necessário", "kWh", "20"),
  v("sistema_solar", "sistema_solar.armazenamento_util_adicionado", "armazenamento_util_adicionado", "Armazenamento Útil Adicionado", "Armazenamento útil adicionado ao sistema", "kWh", "25"),
  v("sistema_solar", "sistema_solar.p_armazenamento_necessario", "p_armazenamento_necessario", "% do Armazenamento Necessário", "Percentual do armazenamento necessário atendido", "%", "60"),

  // ── Legado (mantido por compatibilidade) ──
  v("sistema_solar", "sistema_solar.geracao_anual", "geracao_anual", "Geração anual (legado)", "Geração anual total no ano 0 (legado)", "kWh", "13200"),
  v("sistema_solar", "sistema_solar.modulo_area", "modulo_area", "Área do módulo (legado)", "Área de um módulo (legado)", "m²", "2.58"),
  v("sistema_solar", "sistema_solar.modulo_garantia", "modulo_garantia", "Garantia módulo (legado)", "Garantia do fabricante do módulo (legado)", "anos", "25"),
  v("sistema_solar", "sistema_solar.inversor_garantia", "inversor_garantia", "Garantia inversor (legado)", "Garantia do fabricante do inversor (legado)", "anos", "10"),

  // ──────────────────────────────────────────────────────────────
  // FINANCEIRO — Equipamentos (Custo = interno / Preço = venda)
  // ──────────────────────────────────────────────────────────────
  // Módulos
  v("financeiro", "financeiro.modulo_custo_un", "modulo_custo_un", "Módulo Custo Unitário", "Custo unitário do módulo", "R$", "496,42"),
  v("financeiro", "financeiro.modulo_preco_un", "modulo_preco_un", "Módulo Preço Unitário", "Preço de venda unitário do módulo", "R$", "520,30"),
  v("financeiro", "financeiro.modulo_custo_total", "modulo_custo_total", "Módulo Custo Total", "Custo total dos módulos", "R$", "64534,60"),
  v("financeiro", "financeiro.modulo_preco_total", "modulo_preco_total", "Módulo Preço Total", "Preço de venda total dos módulos", "R$", "133196,80"),
  // Inversores
  v("financeiro", "financeiro.inversor_custo_un_1", "inversor_custo_un_1", "Inversor Custo Unitário 1", "Custo unitário do inversor 1 (O número é incremental)", "R$", "15000,00"),
  v("financeiro", "financeiro.inversor_preco_un_1", "inversor_preco_un_1", "Inversor Preço Unitário 1", "Preço de venda unitário do inversor 1 (O número é incremental)", "R$", "27700,79"),
  v("financeiro", "financeiro.inversor_preco_total_1", "inversor_preco_total_1", "Inversor Preço Total 1", "Preço de venda total do inversor 1 (O número é incremental)", "R$", "27700,79"),
  v("financeiro", "financeiro.inversor_custo_un", "inversor_custo_un", "Inversor(s) Custo(s) Unitário(s)", "Custos unitários concatenados de todos os inversores", "R$", "10.000 / 25.000"),
  v("financeiro", "financeiro.inversor_preco_un", "inversor_preco_un", "Inversor(s) Preço(s) Unitário(s)", "Preços unitários concatenados de todos os inversores", "R$", "15.000 / 30.000"),
  v("financeiro", "financeiro.inversor_custo_total", "inversor_custo_total", "Inversor(s) Custo(s) Total", "Custos totais concatenados de todos os inversores", "R$", "15.000 / 15.000"),
  v("financeiro", "financeiro.inversor_preco_total", "inversor_preco_total", "Inversor(s) Preço(s) Total", "Preços totais concatenados de todos os inversores", "R$", "30.000 / 30.000"),
  v("financeiro", "financeiro.inversores_custo_total", "inversores_custo_total", "Inversores Custo Total", "Custo total somado de todos os inversores", "R$", "18905,79"),
  v("financeiro", "financeiro.inversores_preco_total", "inversores_preco_total", "Inversores Preço Total", "Preço de venda total somado de todos os inversores", "R$", "60000,00"),
  // Otimizadores
  v("financeiro", "financeiro.otimizador_custo_un", "otimizador_custo_un", "Otimizador Custo Unitário", "Custo unitário do otimizador", "R$", "500,00"),
  v("financeiro", "financeiro.otimizador_preco_un", "otimizador_preco_un", "Otimizador Preço Unitário", "Preço de venda unitário do otimizador", "R$", "600,00"),
  v("financeiro", "financeiro.otimizador_custo_total", "otimizador_custo_total", "Otimizador Custo Total", "Custo total dos otimizadores", "R$", "15000,00"),
  v("financeiro", "financeiro.otimizador_preco_total", "otimizador_preco_total", "Otimizador Preço Total", "Preço de venda total dos otimizadores", "R$", "18000,00"),
  // Kit Fechado
  v("financeiro", "financeiro.kit_fechado_custo_total", "kit_fechado_custo_total", "Kit Fechado Custo Total", "Custo total do kit fechado", "R$", "15000,00"),
  v("financeiro", "financeiro.kit_fechado_preco_total", "kit_fechado_preco_total", "Kit Fechado Preço Total", "Preço de venda total do kit fechado", "R$", "18000,00"),
  // Instalação
  v("financeiro", "financeiro.instalacao_custo_total", "instalacao_custo_total", "Instalação Custo Total", "Custo total de instalação", "R$", "5000"),
  v("financeiro", "financeiro.instalacao_preco_total", "instalacao_preco_total", "Instalação Preço Total", "Preço de venda total de instalação", "R$", "8000"),
  // Estrutura
  v("financeiro", "financeiro.estrutura_custo_total", "estrutura_custo_total", "Estrutura Custo Total", "Custo total da estrutura", "R$", "5000"),
  v("financeiro", "financeiro.estrutura_preco_total", "estrutura_preco_total", "Estrutura Preço Total", "Preço de venda total da estrutura", "R$", "8000"),
  // Transformadores
  v("financeiro", "financeiro.transformador_custo_un_1", "transformador_custo_un_1", "Transformador Custo Unitário 1", "Custo unitário do transformador 1 (O número é incremental)", "R$", "144555,84"),
  v("financeiro", "financeiro.transformador_preco_un_1", "transformador_preco_un_1", "Transformador Preço Unitário 1", "Preço de venda unitário do transformador 1 (O número é incremental)", "R$", "144555,84"),
  v("financeiro", "financeiro.transformadores_custo_total", "transformadores_custo_total", "Transformadores Custo Total", "Custo total de todos os transformadores", "R$", "144555,84"),
  v("financeiro", "financeiro.transformadores_preco_total", "transformadores_preco_total", "Transformadores Preço Total", "Preço de venda total de todos os transformadores", "R$", "144555,84"),
  // Totais agregados
  v("financeiro", "financeiro.equipamentos_custo_total", "equipamentos_custo_total", "Equipamentos Custo Total", "Custo total de todos os equipamentos", "R$", "15000,00"),
  v("financeiro", "financeiro.kits_custo_total", "kits_custo_total", "Kits Custo Total", "Custo total dos kits (Kit Fechado ou Módulo+Inversor)", "R$", "15000,00"),
  v("financeiro", "financeiro.componentes_custo_total", "componentes_custo_total", "Componentes Custo Total", "Custo total dos componentes avulsos", "R$", "15000,00"),
  // Itens avulsos
  v("financeiro", "financeiro.item_a_nome_1", "item_a_nome_1", "Item Avulso Nome 1", "Nome do item avulso 1 (O número é incremental)", "-", "Adequação do padrão"),
  v("financeiro", "financeiro.item_a_custo_1", "item_a_custo_1", "Item Avulso Custo 1", "Custo do item avulso 1 (O número é incremental)", "R$", "3000,00"),
  v("financeiro", "financeiro.item_a_preco_1", "item_a_preco_1", "Item Avulso Preço 1", "Preço de venda do item avulso 1 (O número é incremental)", "R$", "5000,00"),

  // ── Financiamento (indexado — O número é incremental) ──
  v("financeiro", "financeiro.f_nome_1", "f_nome_1", "Financiamento Nome 1", "Nome do financiamento 1 (O número é incremental)", "-", "Santander"),
  v("financeiro", "financeiro.f_entrada_1", "f_entrada_1", "Financiamento Entrada R$ 1", "Valor de entrada do financiamento 1 (O número é incremental)", "R$", "5.000"),
  v("financeiro", "financeiro.f_entrada_p_1", "f_entrada_p_1", "Financiamento Entrada % 1", "Percentual de entrada do financiamento 1 (O número é incremental)", "%", "10"),
  v("financeiro", "financeiro.f_valor_1", "f_valor_1", "Financiamento Valor R$ 1", "Valor financiado do financiamento 1 (O número é incremental)", "R$", "45.000"),
  v("financeiro", "financeiro.f_valor_p_1", "f_valor_p_1", "Financiamento Valor % 1", "Percentual financiado do financiamento 1 (O número é incremental)", "%", "90"),
  v("financeiro", "financeiro.f_prazo_1", "f_prazo_1", "Financiamento Prazo 1", "Prazo em meses do financiamento 1 (O número é incremental)", "Meses", "12"),
  v("financeiro", "financeiro.f_carencia_1", "f_carencia_1", "Financiamento Carência 1", "Carência em meses do financiamento 1 (O número é incremental)", "Meses", "0"),
  v("financeiro", "financeiro.f_taxa_1", "f_taxa_1", "Financiamento Taxa 1", "Taxa de juros mensal do financiamento 1 (O número é incremental)", "a.m.", "1"),
  v("financeiro", "financeiro.f_parcela_1", "f_parcela_1", "Financiamento Parcela 1", "Valor da parcela do financiamento 1 (O número é incremental)", "R$", "3988,20"),

  // ── Financiamento Ativo (selecionado pelo consultor) ──
  v("financeiro", "financeiro.f_ativo_nome", "f_ativo_nome", "Financiamento Ativo Nome", "Nome do financiamento ativo/selecionado", "-", "Santander"),
  v("financeiro", "financeiro.f_ativo_entrada", "f_ativo_entrada", "Financiamento Ativo Entrada R$", "Entrada em R$ do financiamento ativo", "R$", "5.000"),
  v("financeiro", "financeiro.f_ativo_entrada_p", "f_ativo_entrada_p", "Financiamento Ativo Entrada %", "Entrada em % do financiamento ativo", "%", "10"),
  v("financeiro", "financeiro.f_ativo_valor", "f_ativo_valor", "Financiamento Ativo Valor R$", "Valor financiado do financiamento ativo", "R$", "45.000"),
  v("financeiro", "financeiro.f_ativo_valor_p", "f_ativo_valor_p", "Financiamento Ativo Valor %", "Percentual financiado do financiamento ativo", "%", "90"),
  v("financeiro", "financeiro.f_ativo_prazo", "f_ativo_prazo", "Financiamento Ativo Prazo", "Prazo em meses do financiamento ativo", "Meses", "12"),
  v("financeiro", "financeiro.f_ativo_carencia", "f_ativo_carencia", "Financiamento Ativo Carência", "Carência em meses do financiamento ativo", "Meses", "0"),
  v("financeiro", "financeiro.f_ativo_taxa", "f_ativo_taxa", "Financiamento Ativo Taxa", "Taxa de juros mensal do financiamento ativo", "a.m.", "1"),
  v("financeiro", "financeiro.f_ativo_parcela", "f_ativo_parcela", "Financiamento Ativo Parcela", "Valor da parcela do financiamento ativo", "R$", "3988,20"),

  // ── Margens, Preço e Payback ──
  v("financeiro", "financeiro.margem_lucro", "margem_lucro", "Margem de Lucro", "Margem percentual de lucro", "%", "25"),
  v("financeiro", "financeiro.preco", "preco", "Preço Total Venda", "Preço total de venda do projeto", "R$", "200000,00"),
  v("financeiro", "financeiro.preco_por_extenso", "preco_por_extenso", "Preço Total Venda por Extenso", "Valor por extenso do preço total", "R$", "duzentos mil reais e vinte e cinco centavos"),
  v("financeiro", "financeiro.preco_kwp", "preco_kwp", "Preço por kWp", "Valor por kWp instalado", "R$/kWp", "5113.64"),
  v("financeiro", "financeiro.preco_watt", "preco_watt", "Preço por Watt", "Valor por Watt instalado", "R$/W", "5.11"),
  v("financeiro", "financeiro.payback", "payback", "Payback", "Tempo de retorno do investimento formatado", "-", "3 anos e 2 meses"),
  v("financeiro", "financeiro.payback_uc1", "payback_uc1", "Payback UC #", "Payback por UC específica", "-", "3 anos e 2 meses"),

  // ── Indicadores financeiros ──
  v("financeiro", "financeiro.vpl", "vpl", "Valor Presente Líquido", "VPL do investimento", "R$", "50.000"),
  v("financeiro", "financeiro.vpl_uc1", "vpl_uc1", "VPL UC #", "VPL por UC específica", "R$", "50.000"),
  v("financeiro", "financeiro.tir", "tir", "Taxa Interna de Retorno", "TIR do investimento", "%", "13,44"),
  v("financeiro", "financeiro.tir_uc1", "tir_uc1", "TIR UC #", "TIR por UC específica", "%", "13,44"),

  // ── Séries anuais (Disponível para os 25 anos: _0 a _25) ──
  v("financeiro", "financeiro.investimento_anual_0", "investimento_anual_0", "Investimento Anual", "Investimento anual (Disponível para os 25 anos: _0 a _25)", "R$", "100.000"),
  v("financeiro", "financeiro.investimento_anual_0_uc1", "investimento_anual_0_uc1", "Investimento Anual UC #", "Investimento anual por UC (Disponível para os 25 anos)", "R$", "100.000"),
  v("financeiro", "financeiro.economia_anual_valor_0", "economia_anual_valor_0", "Economia Anual", "Economia anual (Disponível para os 25 anos: _0 a _25)", "R$", "58800,00"),
  v("financeiro", "financeiro.economia_anual_valor_0_uc1", "economia_anual_valor_0_uc1", "Economia Anual UC #", "Economia anual por UC (Disponível para os 25 anos)", "R$", "58800,00"),
  v("financeiro", "financeiro.fluxo_caixa_acumulado_anual_0", "fluxo_caixa_acumulado_anual_0", "Fluxo de Caixa Acumulado Anual", "Fluxo de caixa acumulado anual (Disponível para os 25 anos: _0 a _25)", "R$", "100.000"),
  v("financeiro", "financeiro.fluxo_caixa_acumulado_anual_0_uc1", "fluxo_caixa_acumulado_anual_0_uc1", "Fluxo de Caixa Acumulado Anual UC #", "Fluxo de caixa acumulado anual por UC (Disponível para os 25 anos)", "R$", "100.000"),

  // ── Distribuidor ──
  v("financeiro", "financeiro.distribuidor_categoria", "distribuidor_categoria", "Distribuidor Categoria", "Categoria do distribuidor (Premium, Gold, etc.)", "-", "Premium"),

  // ── Comissões ──
  v("financeiro", "financeiro.comissao_res", "comissao_res", "Comissão Responsável R$", "Valor da comissão do responsável", "R$", "R$ 5.000,23"),
  v("financeiro", "financeiro.comissao_rep", "comissao_rep", "Comissão Representante R$", "Valor da comissão do representante", "R$", "R$ 5.000,23"),
  v("financeiro", "financeiro.comissao_res_p", "comissao_res_p", "Comissão Responsável %", "Percentual de comissão do responsável", "%", "1,25"),
  v("financeiro", "financeiro.comissao_rep_p", "comissao_rep_p", "Comissão Representante %", "Percentual de comissão do representante", "%", "1,25"),

  // ── Comparativos 25 anos ──
  v("financeiro", "financeiro.solar_25", "solar_25", "Solar 25 anos", "Saldo acumulado com solar em 25 anos", "R$", "R$ 180.111,05"),
  v("financeiro", "financeiro.renda_25", "renda_25", "Renda Fixa 25 anos", "Se investisse o mesmo valor em renda fixa", "R$", "R$ 120.200,00"),
  v("financeiro", "financeiro.poupanca_25", "poupanca_25", "Poupança 25 anos", "Se investisse o mesmo valor na poupança", "R$", "R$ 98.000,00"),

  // ── Baterias ──
  v("financeiro", "financeiro.bateria_custo_un_1", "bateria_custo_un_1", "Bateria Custo Unitário 1", "Custo unitário da bateria 1 (O número é incremental)", "R$", "1000,00"),
  v("financeiro", "financeiro.bateria_preco_un_1", "bateria_preco_un_1", "Bateria Preço Unitário 1", "Preço de venda unitário da bateria 1 (O número é incremental)", "R$", "1000,00"),
  v("financeiro", "financeiro.bateria_preco_total_1", "bateria_preco_total_1", "Bateria Preço Total 1", "Preço de venda total da bateria 1 (O número é incremental)", "R$", "1000,00"),
  v("financeiro", "financeiro.bateria_custo_un", "bateria_custo_un", "Bateria(s) Custo(s) Unitário(s)", "Custos unitários concatenados de todas as baterias", "R$", "1000,00 / 1500,00"),
  v("financeiro", "financeiro.bateria_preco_un", "bateria_preco_un", "Bateria(s) Preço(s) Unitário(s)", "Preços unitários concatenados de todas as baterias", "R$", "1000,00 / 1500,00"),
  v("financeiro", "financeiro.bateria_custo_total", "bateria_custo_total", "Bateria(s) Custo(s) Total", "Custos totais concatenados de todas as baterias", "R$", "1000,00 / 1500,00"),
  v("financeiro", "financeiro.bateria_preco_total", "bateria_preco_total", "Bateria(s) Preço(s) Total", "Preços totais concatenados de todas as baterias", "R$", "1000,00 / 1500,00"),
  v("financeiro", "financeiro.baterias_custo_total", "baterias_custo_total", "Baterias Custo Total", "Custo total somado de todas as baterias", "R$", "1000,00"),
  v("financeiro", "financeiro.baterias_preco_total", "baterias_preco_total", "Baterias Preço Total", "Preço de venda total somado de todas as baterias", "R$", "1000,00"),

  // ── Legado (mantido por compatibilidade) ──
  v("financeiro", "financeiro.preco_total", "preco_total", "Preço total (legado)", "Valor total do projeto/proposta (legado)", "R$", "45000.00"),
  v("financeiro", "financeiro.custo_modulos", "custo_modulos", "Custo módulos (legado)", "Custo total dos módulos (legado)", "R$", "12000.00"),
  v("financeiro", "financeiro.custo_inversores", "custo_inversores", "Custo inversores (legado)", "Custo total dos inversores (legado)", "R$", "6000.00"),
  v("financeiro", "financeiro.custo_estrutura", "custo_estrutura", "Custo estrutura (legado)", "Custo da estrutura (legado)", "R$", "3000.00"),
  v("financeiro", "financeiro.custo_instalacao", "custo_instalacao", "Custo instalação (legado)", "Custo de mão de obra (legado)", "R$", "5000.00"),
  v("financeiro", "financeiro.custo_kit", "custo_kit", "Custo do kit (legado)", "Custo total do kit (legado)", "R$", "21000.00"),
  v("financeiro", "financeiro.margem_percentual", "margem_percentual", "Margem % (legado)", "Margem percentual sobre o custo (legado)", "%", "35"),
  v("financeiro", "financeiro.desconto_percentual", "desconto_percentual", "Desconto % (legado)", "Desconto aplicado (legado)", "%", "5"),
  v("financeiro", "financeiro.desconto_valor", "desconto_valor", "Desconto R$ (legado)", "Valor do desconto em reais (legado)", "R$", "2250.00"),
  v("financeiro", "financeiro.economia_mensal", "economia_mensal", "Economia mensal (legado)", "Economia mensal estimada (legado)", "R$", "850.00"),
  v("financeiro", "financeiro.economia_anual", "economia_anual", "Economia anual (legado)", "Economia anual estimada (legado)", "R$", "10200.00"),
  v("financeiro", "financeiro.payback_meses", "payback_meses", "Payback meses (legado)", "Payback em meses (legado)", "meses", "52"),
  v("financeiro", "financeiro.payback_anos", "payback_anos", "Payback anos (legado)", "Payback em anos (legado)", "anos", "4.3"),
  v("financeiro", "financeiro.roi_25_anos", "roi_25_anos", "ROI 25 anos (legado)", "Retorno total em 25 anos (legado)", "R$", "210000.00"),
  v("financeiro", "financeiro.solar_25_anos", "solar_25_anos", "Saldo solar 25 anos (legado)", "Saldo acumulado solar 25 anos (legado)", "R$", "255000.00"),
  v("financeiro", "financeiro.renda_fixa_25_anos", "renda_fixa_25_anos", "Renda fixa 25 anos (legado)", "Renda fixa 25 anos (legado)", "R$", "85000.00"),
  v("financeiro", "financeiro.poupanca_25_anos", "poupanca_25_anos", "Poupança 25 anos (legado)", "Poupança 25 anos (legado)", "R$", "72000.00"),
  v("financeiro", "financeiro.comissao_percentual", "comissao_percentual", "Comissão % (legado)", "Comissão percentual (legado)", "%", "5"),
  v("financeiro", "financeiro.comissao_valor", "comissao_valor", "Comissão R$ (legado)", "Valor comissão (legado)", "R$", "2250.00"),
  v("financeiro", "financeiro.f_banco", "f_banco", "Banco financiamento (legado)", "Banco/instituição financeira (legado)", "", "BV Financeira"),
  v("financeiro", "financeiro.f_taxa_juros", "f_taxa_juros", "Taxa de juros (legado)", "Taxa de juros mensal (legado)", "% a.m.", "1.29"),
  v("financeiro", "financeiro.f_parcelas", "f_parcelas", "Nº parcelas (legado)", "Quantidade de parcelas (legado)", "un", "60"),
  v("financeiro", "financeiro.f_valor_parcela", "f_valor_parcela", "Valor parcela (legado)", "Valor mensal da parcela (legado)", "R$", "980.00"),
  v("financeiro", "financeiro.f_entrada", "f_entrada", "Entrada (legado)", "Valor de entrada (legado)", "R$", "5000.00"),
  v("financeiro", "financeiro.f_valor_financiado", "f_valor_financiado", "Valor financiado (legado)", "Valor total financiado (legado)", "R$", "40000.00"),
  v("financeiro", "financeiro.f_cet", "f_cet", "CET (legado)", "Custo efetivo total anual (legado)", "% a.a.", "18.5"),

  // ──────────────────────────────────────────────────────────────
  // CONTA DE ENERGIA
  // ──────────────────────────────────────────────────────────────
  // Legado (mantido por compatibilidade)
  v("conta_energia", "conta_energia.gasto_atual_mensal", "gasto_atual_mensal", "Gasto atual mensal", "Valor atual da conta de energia", "R$", "750.00"),
  v("conta_energia", "conta_energia.gasto_com_solar_mensal", "gasto_com_solar_mensal", "Gasto com solar mensal", "Valor estimado da conta com solar", "R$", "50.00"),
  v("conta_energia", "conta_energia.economia_percentual", "economia_percentual", "Economia (%)", "Percentual de economia na conta", "%", "93"),
  v("conta_energia", "conta_energia.creditos_mensal", "creditos_mensal", "Créditos mensais", "Créditos de energia gerados por mês", "kWh", "650"),
  v("conta_energia", "conta_energia.tarifa_atual", "tarifa_atual", "Tarifa atual", "Tarifa vigente da distribuidora", "R$/kWh", "0.95"),
  v("conta_energia", "conta_energia.imposto_percentual", "imposto_percentual", "Imposto (%)", "Percentual de impostos na conta", "%", "25"),
  v("conta_energia", "conta_energia.bandeira_tarifaria", "bandeira_tarifaria", "Bandeira tarifária", "Bandeira tarifária vigente", "", "Verde"),

  // Custo de Disponibilidade
  v("conta_energia", "conta_energia.custo_disponibilidade_valor", "custo_disponibilidade_valor", "Custo de Disponibilidade", "Custo de disponibilidade da UC", "R$", "99,99"),
  v("conta_energia", "conta_energia.custo_disponibilidade_valor_uc1", "custo_disponibilidade_valor_uc1", "Custo de Disponibilidade UC #", "Custo de disponibilidade por UC", "R$", "99,99"),

  // Gasto Energia Mensal (BT)
  v("conta_energia", "conta_energia.gasto_energia_mensal_atual", "gasto_energia_mensal_atual", "Gasto Energia Mensal Atual", "Gasto com energia mensal atual", "R$", "1.000"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_atual_uc1", "gasto_energia_mensal_atual_uc1", "Gasto Energia Mensal Atual UC #", "Gasto com energia mensal atual por UC", "R$", "1.000"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_bt_atual", "gasto_energia_mensal_bt_atual", "Gasto Energia Mensal BT Atual", "Gasto energia BT atual", "R$", "1.000"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_bt_atual_uc1", "gasto_energia_mensal_bt_atual_uc1", "Gasto Energia Mensal BT Atual UC #", "Gasto energia BT atual por UC", "R$", "1.000"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_novo", "gasto_energia_mensal_novo", "Gasto Energia Mensal Novo", "Gasto energia mensal com solar", "R$", "100"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_novo_uc1", "gasto_energia_mensal_novo_uc1", "Gasto Energia Mensal Novo UC #", "Gasto energia mensal novo por UC", "R$", "100"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_bt_novo", "gasto_energia_mensal_bt_novo", "Gasto Energia Mensal BT Novo", "Gasto energia BT com solar", "R$", "100"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_bt_novo_uc1", "gasto_energia_mensal_bt_novo_uc1", "Gasto Energia Mensal BT Novo UC #", "Gasto energia BT novo por UC", "R$", "100"),

  // Gasto Energia Mensal (Ponta / Fora Ponta)
  v("conta_energia", "conta_energia.gasto_energia_mensal_p_atual", "gasto_energia_mensal_p_atual", "Gasto Energia Mensal Ponta Atual", "Gasto energia ponta atual", "R$", "100"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_p_atual_uc1", "gasto_energia_mensal_p_atual_uc1", "Gasto Energia Mensal Ponta Atual UC #", "Gasto energia ponta atual por UC", "R$", "100"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_p_novo", "gasto_energia_mensal_p_novo", "Gasto Energia Mensal Ponta Novo", "Gasto energia ponta com solar", "R$", "100"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_p_novo_uc1", "gasto_energia_mensal_p_novo_uc1", "Gasto Energia Mensal Ponta Novo UC #", "Gasto energia ponta novo por UC", "R$", "100"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_fp_atual", "gasto_energia_mensal_fp_atual", "Gasto Energia Mensal Fora Ponta Atual", "Gasto energia fora ponta atual", "R$", "100"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_fp_atual_uc1", "gasto_energia_mensal_fp_atual_uc1", "Gasto Energia Mensal Fora Ponta Atual UC #", "Gasto energia fora ponta atual por UC", "R$", "100"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_fp_novo", "gasto_energia_mensal_fp_novo", "Gasto Energia Mensal Fora Ponta Novo", "Gasto energia fora ponta com solar", "R$", "100"),
  v("conta_energia", "conta_energia.gasto_energia_mensal_fp_novo_uc1", "gasto_energia_mensal_fp_novo_uc1", "Gasto Energia Mensal Fora Ponta Novo UC #", "Gasto energia fora ponta novo por UC", "R$", "100"),

  // Gasto Demanda (MT)
  v("conta_energia", "conta_energia.gasto_demanda_mensal_atual", "gasto_demanda_mensal_atual", "Gasto Demanda Mensal Atual", "Gasto demanda mensal atual (MT)", "R$", "5.000"),
  v("conta_energia", "conta_energia.gasto_demanda_mensal_atual_uc1", "gasto_demanda_mensal_atual_uc1", "Gasto Demanda Mensal Atual UC #", "Gasto demanda atual por UC", "R$", "5.000"),
  v("conta_energia", "conta_energia.gasto_demanda_mensal_novo", "gasto_demanda_mensal_novo", "Gasto Demanda Mensal Novo", "Gasto demanda com solar (MT)", "R$", "8.000"),
  v("conta_energia", "conta_energia.gasto_demanda_mensal_novo_uc1", "gasto_demanda_mensal_novo_uc1", "Gasto Demanda Mensal Novo UC #", "Gasto demanda novo por UC", "R$", "8.000"),

  // Economia Energia
  v("conta_energia", "conta_energia.economia_energia_mensal", "economia_energia_mensal", "Economia Energia Mensal R$", "Economia de energia mensal em reais", "R$", "900"),
  v("conta_energia", "conta_energia.economia_energia_mensal_uc1", "economia_energia_mensal_uc1", "Economia Energia Mensal R$ UC #", "Economia energia mensal por UC", "R$", "900"),
  v("conta_energia", "conta_energia.economia_energia_mensal_p", "economia_energia_mensal_p", "Economia Energia Mensal %", "Percentual de economia energia mensal", "%", "90"),
  v("conta_energia", "conta_energia.economia_energia_mensal_p_uc1", "economia_energia_mensal_p_uc1", "Economia Energia Mensal % UC #", "Percentual economia energia por UC", "%", "90"),

  // Economia Demanda (MT)
  v("conta_energia", "conta_energia.economia_demanda_mensal", "economia_demanda_mensal", "Economia Demanda Mensal R$", "Economia demanda mensal (MT)", "R$", "-3.000"),
  v("conta_energia", "conta_energia.economia_demanda_mensal_uc1", "economia_demanda_mensal_uc1", "Economia Demanda Mensal R$ UC #", "Economia demanda por UC", "R$", "-3.000"),
  v("conta_energia", "conta_energia.economia_demanda_mensal_p", "economia_demanda_mensal_p", "Economia Demanda Mensal %", "Percentual economia demanda", "%", "-60"),
  v("conta_energia", "conta_energia.economia_demanda_mensal_p_uc1", "economia_demanda_mensal_p_uc1", "Economia Demanda Mensal % UC #", "Percentual economia demanda por UC", "%", "-60"),

  // Gasto Total Mensal
  v("conta_energia", "conta_energia.gasto_total_mensal_atual", "gasto_total_mensal_atual", "Gasto Total Mensal Atual", "Gasto total mensal atual", "R$", "500,00"),
  v("conta_energia", "conta_energia.gasto_total_mensal_atual_uc1", "gasto_total_mensal_atual_uc1", "Gasto Total Mensal Atual UC #", "Gasto total atual por UC", "R$", "500,00"),
  v("conta_energia", "conta_energia.gasto_total_mensal_atual_0", "gasto_total_mensal_atual_0", "Gasto Total Mensal Atual UCs", "Gasto total atual todas UCs (série)", "R$", "100,00"),
  v("conta_energia", "conta_energia.gasto_total_mensal_novo", "gasto_total_mensal_novo", "Gasto Total Mensal Novo", "Gasto total mensal com solar", "R$", "400,00"),
  v("conta_energia", "conta_energia.gasto_total_mensal_novo_uc1", "gasto_total_mensal_novo_uc1", "Gasto Total Mensal Novo UC #", "Gasto total novo por UC", "R$", "400,00"),

  // Créditos e Tarifa (pontuais)
  v("conta_energia", "conta_energia.creditos_jan", "creditos_jan", "Saldo de Créditos Janeiro", "Saldo de créditos em janeiro", "kWh", "12254"),
  v("conta_energia", "conta_energia.creditos_jan_uc1", "creditos_jan_uc1", "Saldo de Créditos Janeiro UC #", "Saldo créditos janeiro por UC", "kWh", "12254"),
  v("conta_energia", "conta_energia.tarifa_distribuidora_0", "tarifa_distribuidora_0", "Tarifa Distribuidora", "Tarifa distribuidora ano 0", "R$", "0,99"),
  v("conta_energia", "conta_energia.tarifa_distribuidora_0_uc1", "tarifa_distribuidora_0_uc1", "Tarifa Distribuidora UC #", "Tarifa distribuidora ano 0 por UC", "R$", "0,99"),

  // Economia Mensal (consolidada)
  v("conta_energia", "conta_energia.economia_mensal", "economia_mensal", "Economia Mensal R$", "Economia mensal total em reais", "R$", "800"),
  v("conta_energia", "conta_energia.economia_mensal_uc1", "economia_mensal_uc1", "Economia Mensal R$ UC #", "Economia mensal por UC", "R$", "800"),
  v("conta_energia", "conta_energia.economia_mensal_p", "economia_mensal_p", "Economia Mensal %", "Percentual de economia mensal total", "%", "76.5"),
  v("conta_energia", "conta_energia.economia_mensal_p_uc1", "economia_mensal_p_uc1", "Economia Mensal % UC #", "Percentual economia mensal por UC", "%", "10.5"),

  // Créditos Alocados (conta)
  v("conta_energia", "conta_energia.creditos_alocados", "creditos_alocados", "Créditos Alocados UCs", "Créditos alocados total UCs", "kWh", "800"),
  v("conta_energia", "conta_energia.creditos_alocados_jan", "creditos_alocados_jan", "Créditos Alocados Janeiro", "Créditos alocados em janeiro", "kWh", "800"),
  v("conta_energia", "conta_energia.creditos_alocados_uc1", "creditos_alocados_uc1", "Créditos Alocados UC #", "Créditos alocados por UC", "kWh", "800"),
  v("conta_energia", "conta_energia.creditos_alocados_jan_uc1", "creditos_alocados_jan_uc1", "Créditos Alocados Janeiro UC #", "Créditos alocados janeiro por UC", "kWh", "800"),

  // Consumo Abatido
  v("conta_energia", "conta_energia.consumo_abatido", "consumo_abatido", "Consumo Abatido BT UCs", "Consumo abatido total BT", "kWh", "800"),
  v("conta_energia", "conta_energia.consumo_abatido_uc1", "consumo_abatido_uc1", "Consumo Abatido BT UC #", "Consumo abatido por UC", "kWh", "800"),
  v("conta_energia", "conta_energia.consumo_abatido_p", "consumo_abatido_p", "Consumo Abatido P UCs", "Consumo abatido ponta total", "kWh", "800"),
  v("conta_energia", "conta_energia.consumo_abatido_p_uc1", "consumo_abatido_p_uc1", "Consumo Abatido P UC #", "Consumo abatido ponta por UC", "kWh", "800"),
  v("conta_energia", "conta_energia.consumo_abatido_fp", "consumo_abatido_fp", "Consumo Abatido FP UCs", "Consumo abatido fora ponta total", "kWh", "800"),
  v("conta_energia", "conta_energia.consumo_abatido_fp_uc1", "consumo_abatido_fp_uc1", "Consumo Abatido FP UC #", "Consumo abatido fora ponta por UC", "kWh", "800"),

  // Imposto sobre Energia
  v("conta_energia", "conta_energia.valor_imposto_energia", "valor_imposto_energia", "Imposto Sobre Energia UCs", "Valor do imposto sobre energia", "R$", "10,97"),
  v("conta_energia", "conta_energia.valor_imposto_energia_uc1", "valor_imposto_energia_uc1", "Imposto Sobre Energia UC #", "Valor imposto energia por UC", "R$", "10,97"),

  // Tarifação Energia Compensada (Fio B / Lei 14.300)
  v("conta_energia", "conta_energia.tarifacao_energia_compensada_bt", "tarifacao_energia_compensada_bt", "Tarifação Energia Compensada BT", "Valor tarifação Fio B/Energia compensada BT", "R$", "12,34"),
  v("conta_energia", "conta_energia.tarifacao_energia_compensada_bt_uc1", "tarifacao_energia_compensada_bt_uc1", "Tarifação Energia Compensada BT UC #", "Tarifação compensada BT por UC", "R$", "12,34"),
  v("conta_energia", "conta_energia.tarifacao_energia_compensada_fp", "tarifacao_energia_compensada_fp", "Tarifação Energia Compensada FP", "Tarifação compensada fora ponta (MT)", "R$", "12,34"),
  v("conta_energia", "conta_energia.tarifacao_energia_compensada_fp_uc1", "tarifacao_energia_compensada_fp_uc1", "Tarifação Energia Compensada FP UC #", "Tarifação compensada FP por UC", "R$", "12,34"),
  v("conta_energia", "conta_energia.tarifacao_energia_compensada_p", "tarifacao_energia_compensada_p", "Tarifação Energia Compensada P", "Tarifação compensada ponta (MT)", "R$", "12,34"),
  v("conta_energia", "conta_energia.tarifacao_energia_compensada_p_uc1", "tarifacao_energia_compensada_p_uc1", "Tarifação Energia Compensada P UC #", "Tarifação compensada ponta por UC", "R$", "12,34"),

  // Gasto Total Mensal (série por UC - disponível para 25 anos)
  v("conta_energia", "conta_energia.gasto_total_mensal_atual_0_uc1", "gasto_total_mensal_atual_0_uc1", "Gasto Total Mensal Atual UC # (série)", "Gasto total atual UC série", "R$", "100,00"),
  v("conta_energia", "conta_energia.gasto_total_mensal_novo_0", "gasto_total_mensal_novo_0", "Gasto Total Mensal Novo UCs (série)", "Gasto total novo UCs série", "R$", "100,00"),
  v("conta_energia", "conta_energia.gasto_total_mensal_novo_0_uc1", "gasto_total_mensal_novo_0_uc1", "Gasto Total Mensal Novo UC # (série)", "Gasto total novo UC série", "R$", "100,00"),

  // ──────────────────────────────────────────────────────────────
  // COMERCIAL
  // ──────────────────────────────────────────────────────────────
  v("comercial", "comercial.proposta_identificador", "proposta_identificador", "Identificador da Proposta", "Identificador único da proposta", "-", "2590-1", "proposta"),
  v("comercial", "comercial.proposta_titulo", "proposta_titulo", "Título da Proposta", "Nome/título da proposta", "-", "Proposta Sistema Fotovoltaico", "proposta"),
  v("comercial", "comercial.proposta_link", "proposta_link", "Link da Proposta", "URL de visualização pública da proposta", "-", "https://...", "proposta"),
  v("comercial", "comercial.proposta_validade", "proposta_validade", "Validade", "Data de validade da proposta", "data", "15/03/2025", "proposta"),
  v("comercial", "comercial.proposta_data", "proposta_data", "Data da proposta", "Data de criação da proposta", "data", "01/03/2025", "proposta"),
  v("comercial", "comercial.responsavel_nome", "responsavel_nome", "Responsável", "Nome do responsável técnico", "-", "Ross", "proposta"),
  v("comercial", "comercial.responsavel_email", "responsavel_email", "Responsável E-mail", "Email do responsável", "-", "ross@mail.com.br", "proposta"),
  v("comercial", "comercial.responsavel_celular", "responsavel_celular", "Responsável Celular", "Celular do responsável", "-", "+55 21 99999-9999", "proposta"),
  v("comercial", "comercial.representante_nome", "representante_nome", "Representante", "Nome do representante comercial", "-", "Rachel", "proposta"),
  v("comercial", "comercial.representante_email", "representante_email", "Representante E-mail", "Email do representante", "-", "rachel@mail.com.br", "proposta"),
  v("comercial", "comercial.representante_celular", "representante_celular", "Representante Celular", "Celular do representante", "-", "+55 21 88888-8888", "proposta"),
  v("comercial", "comercial.projeto_id_externo", "projeto_id_externo", "Identificador externo do Projeto", "ID do projeto em sistema externo", "-", "123123", "proposta"),
  v("comercial", "comercial.empresa_nome", "empresa_nome", "Empresa do integrador", "Razão social da empresa", "-", "Cruzeiro Esporte Clube", "proposta"),
  v("comercial", "comercial.empresa_cnpj_cpf", "empresa_cnpj_cpf", "CNPJ/CPF do integrador", "CNPJ ou CPF da empresa", "-", "44.490.706/0001-54", "proposta"),
  v("comercial", "comercial.empresa_cidade", "empresa_cidade", "Cidade do integrador", "Cidade da empresa", "-", "Belo Horizonte", "proposta"),
  v("comercial", "comercial.empresa_estado", "empresa_estado", "Estado do integrador", "Estado da empresa", "-", "MG", "proposta"),
  v("comercial", "comercial.empresa_endereco", "empresa_endereco", "Endereço do integrador", "Endereço completo da empresa", "-", "Rua Solar, 100", "proposta"),
  v("comercial", "comercial.empresa_telefone", "empresa_telefone", "Telefone do integrador", "Telefone da empresa", "-", "(31) 3333-0000", "proposta"),
  v("comercial", "comercial.empresa_email", "empresa_email", "E-mail do integrador", "Email da empresa", "-", "contato@solartech.com", "proposta"),
  v("comercial", "comercial.empresa_logo_url", "empresa_logo_url", "Logo da empresa", "URL do logotipo da empresa", "-", "https://...", "proposta"),

  // ──────────────────────────────────────────────────────────────
  // CLIENTE
  // ──────────────────────────────────────────────────────────────
  v("cliente", "cliente.nome", "cliente_nome", "Nome", "Nome completo do cliente", "", "José da Silva"),
  v("cliente", "cliente.empresa", "cliente_empresa", "Empresa do cliente", "Empresa/razão social do cliente", "", "Fazenda Boa Vista"),
  v("cliente", "cliente.cnpj_cpf", "cliente_cnpj_cpf", "CPF/CNPJ", "CPF ou CNPJ do cliente", "", "123.456.789-00"),
  v("cliente", "cliente.email", "cliente_email", "Email", "Email do cliente", "", "jose@email.com"),
  v("cliente", "cliente.celular", "cliente_celular", "Celular", "Celular do cliente", "", "(31) 99999-1234"),
  v("cliente", "cliente.cep", "cliente_cep", "CEP", "CEP do cliente", "", "30130-000"),
  v("cliente", "cliente.endereco", "cliente_endereco", "Endereço", "Endereço/rua do cliente", "", "Rua das Flores, 42"),
  v("cliente", "cliente.numero", "cliente_numero", "Número", "Número do endereço", "", "42"),
  v("cliente", "cliente.complemento", "cliente_complemento", "Complemento", "Complemento do endereço", "", "Apto 301"),
  v("cliente", "cliente.bairro", "cliente_bairro", "Bairro", "Bairro do cliente", "", "Centro"),
  v("cliente", "cliente.cidade", "cliente_cidade", "Cidade", "Cidade do cliente", "", "Belo Horizonte"),
  v("cliente", "cliente.estado", "cliente_estado", "Estado", "Estado/UF do cliente", "", "MG"),

  // ──────────────────────────────────────────────────────────────
  // TABELAS (dados tabulares para loops)
  // ──────────────────────────────────────────────────────────────
  v("tabelas", "tabelas.consumo_mensal", "tabela_consumo_mensal", "Tabela consumo mensal", "Tabela com consumo por mês (jan-dez)", "kWh", "{jan:500,...,dez:490}", "proposta", { isSeries: true }),
  v("tabelas", "tabelas.geracao_mensal", "tabela_geracao_mensal", "Tabela geração mensal", "Tabela com geração estimada por mês", "kWh", "{jan:1200,...,dez:1200}", "proposta", { isSeries: true }),
  v("tabelas", "tabelas.economia_mensal", "tabela_economia_mensal", "Tabela economia mensal", "Tabela com economia estimada por mês", "R$", "{jan:850,...,dez:830}", "proposta", { isSeries: true }),
  v("tabelas", "tabelas.equipamentos", "tabela_equipamentos", "Tabela equipamentos", "Lista de equipamentos do sistema", "", "[{item,qtd,modelo}]", "proposta", { isSeries: true }),
  v("tabelas", "tabelas.parcelas", "tabela_parcelas", "Tabela parcelas", "Parcelas do financiamento", "", "[{num,valor,vencimento}]", "proposta", { isSeries: true }),

  // ──────────────────────────────────────────────────────────────
  // SÉRIES (projeções anuais 0-24)
  // ──────────────────────────────────────────────────────────────
  v("series", "series.economia_anual", "s_economia_anual", "Economia anual (série)", "Série de economia anual por 25 anos", "R$", "{0:10200,...,24:28500}", "proposta", { isSeries: true }),
  v("series", "series.geracao_anual", "s_geracao_anual", "Geração anual (série)", "Série de geração anual por 25 anos", "kWh", "{0:13200,...,24:11880}", "proposta", { isSeries: true }),
  v("series", "series.geracao_mensal", "s_geracao_mensal", "Geração mensal (série)", "Série de geração mensal por 25 anos", "kWh", "{0:1100,...,24:990}", "proposta", { isSeries: true }),
  v("series", "series.investimento_anual", "s_investimento_anual", "Investimento anual (série)", "Série de investimento acumulado por ano", "R$", "{0:45000,...,24:45000}", "proposta", { isSeries: true }),
  v("series", "series.fluxo_caixa_acumulado", "s_fluxo_caixa_acumulado_anual", "Fluxo de caixa acum. (série)", "Série de fluxo de caixa acumulado anual", "R$", "{0:-34800,...,24:210000}", "proposta", { isSeries: true }),
  v("series", "series.tarifa_distribuidora", "s_tarifa_distribuidora_anual", "Tarifa distribuidora (série)", "Série de tarifa projetada por ano", "R$/kWh", "{0:0.95,...,24:2.10}", "proposta", { isSeries: true }),
  v("series", "series.consumo_mensal", "s_consumo_mensal", "Consumo mensal (série)", "Série de consumo mensal projetado", "kWh", "{jan:500,...,dez:490}", "proposta", { isSeries: true }),
  v("series", "series.creditos_mensal", "s_creditos_mensal", "Créditos mensal (série)", "Série de créditos de energia mensais", "kWh", "{jan:650,...,dez:710}", "proposta", { isSeries: true }),
  v("series", "series.creditos_gerados", "s_creditos_gerados", "Créditos gerados (série)", "Série de créditos gerados mensais", "kWh", "{jan:700,...,dez:710}", "proposta", { isSeries: true }),
  v("series", "series.creditos_alocados", "s_creditos_alocados", "Créditos alocados (série)", "Série de créditos alocados mensais", "kWh", "800", "proposta", { isSeries: true }),
  v("series", "series.creditos_alocados_uc1", "s_creditos_alocados_uc1", "Créditos alocados UC # (série)", "Série de créditos alocados por UC", "kWh", "800", "proposta", { isSeries: true }),
  // UC-specific series
  v("series", "series.consumo_mensal_uc1", "s_consumo_mensal_uc1", "Consumo mensal UC # (série)", "Série de consumo mensal por UC", "kWh", "{jan:350,...,dez:380}", "proposta", { isSeries: true }),
  v("series", "series.creditos_mensal_uc1", "s_creditos_mensal_uc1", "Saldo créditos mensal UC # (série)", "Série de saldo de créditos mensal por UC", "kWh", "{jan:300,...,dez:330}", "proposta", { isSeries: true }),
  v("series", "series.economia_anual_uc1", "s_economia_anual_uc1", "Economia anual UC # (série)", "Série de economia anual por UC", "R$", "{0:8500,...,24:23000}", "proposta", { isSeries: true }),
  v("series", "series.fluxo_caixa_acumulado_uc1", "s_fluxo_caixa_acumulado_anual_uc1", "Fluxo caixa acum. UC # (série)", "Série de fluxo de caixa acumulado por UC", "R$", "{0:-30000,...,24:180000}", "proposta", { isSeries: true }),
  v("series", "series.geracao_anual_uc1", "s_geracao_anual_uc1", "Geração anual UC # (série)", "Série de geração anual por UC", "kWh", "{0:11000,...,24:9900}", "proposta", { isSeries: true }),
  v("series", "series.investimento_anual_uc1", "s_investimento_anual_uc1", "Investimento anual UC # (série)", "Série de investimento acumulado por UC", "R$", "{0:38000,...,24:38000}", "proposta", { isSeries: true }),
  v("series", "series.tarifa_distribuidora_uc1", "s_tarifa_distribuidora_anual_uc1", "Tarifa distribuidora UC # (série)", "Série de tarifa projetada por UC", "R$/kWh", "{0:0.95,...,24:2.10}", "proposta", { isSeries: true }),

  // ──────────────────────────────────────────────────────────────
  // PREMISSAS
  // ──────────────────────────────────────────────────────────────
  v("premissas", "premissas.inflacao_energetica", "inflacao_energetica", "Inflação energética", "Taxa de reajuste anual da energia", "% a.a.", "8"),
  v("premissas", "premissas.inflacao_ipca", "inflacao_ipca", "Inflação IPCA", "Inflação geral IPCA projetada", "% a.a.", "5"),
  v("premissas", "premissas.imposto", "imposto", "Imposto sobre energia", "Percentual de impostos na conta", "%", "25"),
  v("premissas", "premissas.vpl_taxa_desconto", "vpl_taxa_desconto", "Taxa de desconto VPL", "Taxa de desconto usada no cálculo do VPL", "% a.a.", "10"),
  v("premissas", "premissas.perda_eficiencia_anual", "perda_eficiencia_anual", "Perda de eficiência anual", "Degradação anual dos módulos", "% a.a.", "0.5"),
  v("premissas", "premissas.troca_inversor", "troca_inversor", "Troca inversor (ano)", "Ano previsto para troca do inversor", "ano", "12"),
  v("premissas", "premissas.troca_inversor_custo", "troca_inversor_custo", "Custo troca inversor", "Custo estimado da troca do inversor", "R$", "6000.00"),
  v("premissas", "premissas.sobredimensionamento", "sobredimensionamento", "Sobredimensionamento", "Percentual de sobredimensionamento", "%", "10"),
  v("premissas", "premissas.vida_util_sistema", "vida_util_sistema", "Vida útil do sistema", "Vida útil projetada do sistema", "anos", "25"),

  // ──────────────────────────────────────────────────────────────
  // CAMPOS DOS DISTRIBUIDORES (CDD)
  // ──────────────────────────────────────────────────────────────
  v("cdd", "cdd.tipo_estrutura", "cdd_tipo_estrutura", "Tipo de estrutura", "Tipo de Telhado / Tipo de Estrutura — ECORI, GENYX, WEG SOLAR, NEOSOLAR, BLUESUN, SOLARMARKET", "", "Solo", "proposta", { notImplemented: true }),
  v("cdd", "cdd.marca_estrutura", "cdd_marca_estrutura", "Solução Estrutural", "Solução Estrutural / Marca da estrutura — ECORI", "", "Romagnole", "proposta", { notImplemented: true }),
  v("cdd", "cdd.comunicador", "cdd_comunicador", "Utiliza Comunicador?", "Tipo de comunicador de dados — ECORI", "", "Wi-Fi", "proposta", { notImplemented: true }),
  v("cdd", "cdd.tipo_sustentacao", "cdd_tipo_sustentacao", "Tipo de Sustentação", "Tipo de sustentação — GENYX", "", "Laje", "proposta", { notImplemented: true }),
  v("cdd", "cdd.tipo_telhado", "cdd_tipo_telhado", "Tipo de telhado utilizado", "Tipo de telhado utilizado / Onde será instalado — NEXEN, GTSOLAR", "", "Cerâmico", "proposta", { notImplemented: true }),
  v("cdd", "cdd.nivel", "cdd_nivel", "Nível da estrutura", "Nível do distribuidor — BLUESUN, SOLARMARKET", "", "Gold", "proposta", { notImplemented: true }),
  v("cdd", "cdd.orientacao", "cdd_orientacao", "Orientação", "Orientação dos módulos — BLUESUN, SOLARMARKET", "", "Norte", "proposta", { notImplemented: true }),
  v("cdd", "cdd.string_config", "cdd_string", "Adicionar StringBox CC?", "StringBox CC / Deseja Incluir StringBox — BLUESUN, SOLARMARKET", "", "2x8", "proposta", { notImplemented: true }),
  v("cdd", "cdd.string_ca", "cdd_sting_ca", "Adicionar StringBox CA?", "Configuração de strings CA — BLUESUN, SOLARMARKET", "", "1x1", "proposta", { notImplemented: true }),
  v("cdd", "cdd.telhado", "cdd_telhado", "Tipo de Telhado", "Tipo de telhado no cadastro — SOLARMARKET", "", "Cerâmico", "proposta", { notImplemented: true }),
  v("cdd", "cdd.estrutura", "cdd_estrutura", "Estrutura", "Estrutura / Estrutura do Telhado — A.DIAS SOLAR, SOPRANO, SOLARMARKET, BLUESUN, FORTLEV, ALDO", "", "Fibrocimento", "proposta", { notImplemented: true }),
  v("cdd", "cdd.tipo_perfil", "cdd_tipo_perfil", "Tipo de Perfil", "Tipo de perfil da estrutura — WEG SOLAR", "", "Perfil", "proposta", { notImplemented: true }),

  // ──────────────────────────────────────────────────────────────
  // VARIÁVEIS CUSTOMIZADAS (vc_*)
  // ──────────────────────────────────────────────────────────────
  // ── Consumo e Geração ──
  v("customizada", "customizada.vc_consumo", "vc_consumo", "Consumo BT/MT", "Consumo em Baixa e Média Tensão unificado", "kWh", "1000"),
  v("customizada", "customizada.vc_aumento", "vc_aumento", "Aumento da Geração vs Consumo", "Percentual de aumento da geração em relação ao consumo", "%", "120"),
  v("customizada", "customizada.vc_media_sonsumo_mensal", "vc_media_sonsumo_mensal", "Média de Consumo Mensal", "Média de consumo mensal (alias de consumo_mensal)", "kWh", "500"),

  // ── Financeiro / Pagamento ──
  v("customizada", "customizada.vc_valor_entrada", "vc_valor_entrada", "Valor Entrada", "Valor de entrada (kit_fechado_preco_total)", "R$", "15000"),
  v("customizada", "customizada.vc_valor_parcelas_4", "vc_valor_parcelas_4", "Valor das Parcelas", "Valor das parcelas ((preco - entrada) / 3)", "R$", "5000"),
  v("customizada", "customizada.vc_valor_parcela_troca_medidor", "vc_valor_parcela_troca_medidor", "Valor Parcela Após Troca Medidor", "Valor à vista menos entrada", "R$", "10000"),

  // ── Financiamento / Banco ──
  v("customizada", "customizada.vc_nome", "vc_nome", "Nome (Financiamento)", "Nome do banco/financeira ativo", "-", "BV"),
  v("customizada", "customizada.vc_taxa_1", "vc_taxa_1", "Taxa 1", "Taxa de juros condição 1 (SWITCH por banco)", "%", "1.99"),
  v("customizada", "customizada.vc_taxa_2", "vc_taxa_2", "Taxa 2", "Taxa de juros condição 2 (SWITCH por banco)", "%", "2.49"),
  v("customizada", "customizada.vc_taxa_3", "vc_taxa_3", "Taxa 3", "Taxa de juros condição 3 (SWITCH por banco)", "%", "2.99"),
  v("customizada", "customizada.vc_entrada_1", "vc_entrada_1", "Entrada 1", "Entrada condição 1 (SWITCH por banco)", "R$", "5000"),
  v("customizada", "customizada.vc_entrada_2", "vc_entrada_2", "Entrada 2", "Entrada condição 2 (SWITCH por banco)", "R$", "3000"),
  v("customizada", "customizada.vc_entrada_3", "vc_entrada_3", "Entrada 3", "Entrada condição 3 (SWITCH por banco)", "R$", "1000"),
  v("customizada", "customizada.vc_prazo_1", "vc_prazo_1", "Prazo 1", "Prazo condição 1 (SWITCH por banco)", "meses", "24"),
  v("customizada", "customizada.vc_prazo_2", "vc_prazo_2", "Prazo 2", "Prazo condição 2 (SWITCH por banco)", "meses", "36"),
  v("customizada", "customizada.vc_prazo_3", "vc_prazo_3", "Prazo 3", "Prazo condição 3 (SWITCH por banco)", "meses", "48"),
  v("customizada", "customizada.vc_parcela_1", "vc_parcela_1", "Parcela 1", "Parcela condição 1 (SWITCH por banco)", "R$", "1500"),
  v("customizada", "customizada.vc_parcela_2", "vc_parcela_2", "Parcela 2", "Parcela condição 2 (SWITCH por banco)", "R$", "1200"),
  v("customizada", "customizada.vc_parcela_3", "vc_parcela_3", "Parcela 3", "Parcela condição 3 (SWITCH por banco)", "R$", "1000"),

  // ── Equipamentos ──
  v("customizada", "customizada.vc_total_modulo", "vc_total_modulo", "Total Módulos", "Quantidade total de módulos calculada", "-", "16"),
  v("customizada", "customizada.vc_p_total_cc", "vc_p_total_cc", "Potência Total CC", "Potência total CC dos inversores", "kW", "8.2"),
  v("customizada", "customizada.vc_string_box_cc", "vc_string_box_cc", "Incluir String Box CC", "Texto condicional sobre string box", "-", "Este inversor..."),
  v("customizada", "customizada.vc_potencia_sistema", "vc_potencia_sistema", "Potência Sistema Resumo", "Potência do sistema (alias)", "kWp", "8.2"),
  v("customizada", "customizada.vc_modulo_potencia", "vc_modulo_potencia", "Módulo Potência", "Potência do módulo (alias)", "W", "550"),
  v("customizada", "customizada.vc_inversor_potencia_nominal", "vc_inversor_potencia_nominal", "Inversor Potência Nominal", "Potência nominal do inversor / 1000", "kW", "8.2"),
  v("customizada", "customizada.vc_estrutura", "vc_estrutura", "Estrutura", "Tipo de estrutura (alias cape_telhado)", "-", "Fibrocimento"),

  // ── Comercial ──
  v("customizada", "customizada.vc_garantiaservico", "vc_garantiaservico", "Garantia Serviço", "Tempo de garantia de serviço", "-", "2 ano"),
  v("customizada", "customizada.vc_grafico_de_comparacao", "vc_grafico_de_comparacao", "Gráfico de Comparação", "Dados para gráfico comparativo (gasto atual vs geração)", "-", "{15000, 12000}"),
  v("customizada", "customizada.vc_valor_gerac_prevista", "vc_valor_gerac_prevista", "Valor de Geração Prevista", "Tarifa distribuidora × geração mensal", "R$", "800"),

  // ── Cartão de Crédito ──
  v("customizada", "customizada.vc_cartao_credito_parcela_1", "vc_cartao_credito_parcela_1", "Cartão Crédito Parcela 1", "Parcela cartão 1x (à vista + taxa)", "R$", "45000"),
  v("customizada", "customizada.vc_cartao_credito_parcela_2", "vc_cartao_credito_parcela_2", "Cartão Crédito Parcela 2", "Parcela cartão 2x (à vista + taxa)", "R$", "23000"),
  v("customizada", "customizada.vc_cartao_credito_parcela_3", "vc_cartao_credito_parcela_3", "Cartão Crédito Parcela 3", "Parcela cartão 3x (à vista + taxa)", "R$", "16000"),
  v("customizada", "customizada.vc_cartao_credito_parcela_4", "vc_cartao_credito_parcela_4", "Cartão Crédito Parcela 4", "Parcela cartão 4x (à vista + taxa)", "R$", "12500"),
  v("customizada", "customizada.vc_cartao_credito_taxa_1", "vc_cartao_credito_taxa_1", "Cartão Crédito Taxa 1", "Taxa cartão 1x (7%)", "%", "7"),
  v("customizada", "customizada.vc_cartao_credito_taxa_2", "vc_cartao_credito_taxa_2", "Cartão Crédito Taxa 2", "Taxa cartão 2x (11%)", "%", "11"),
  v("customizada", "customizada.vc_cartao_credito_taxa_3", "vc_cartao_credito_taxa_3", "Cartão Crédito Taxa 3", "Taxa cartão 3x (15%)", "%", "15"),
  v("customizada", "customizada.vc_cartao_credito_taxa_4", "vc_cartao_credito_taxa_4", "Cartão Crédito Taxa 4", "Taxa cartão 4x (17%)", "%", "17"),

  // ── ICMS / Impostos ──
  v("customizada", "customizada.vc_cal_icms_enel", "vc_cal_icms_enel", "Cálculo ICMS Enel", "Alíquota ICMS condicional por faixa de gasto", "%", "25"),
  v("customizada", "customizada.vc_valor_icms_enel", "vc_valor_icms_enel", "Valor ICMS Enel (R$)", "Valor do ICMS calculado em reais", "R$", "150"),
  v("customizada", "customizada.vc_valor_icms_enel_fator_simultaneidade", "vc_valor_icms_enel_fator_simultaneidade", "ICMS Enel c/ Fator Simultaneidade", "Valor ICMS ajustado pelo fator de simultaneidade", "R$", "135"),

  // ── Seguro ──
  v("customizada", "customizada.vc_incluir_seguro", "vc_incluir_seguro", "Incluir Seguro", "Condicional para inclusão de seguro (Sim/Não)", "-", "Sim"),
  v("customizada", "customizada.vc_calculo_seguro", "vc_calculo_seguro", "Cálculo Seguro", "Valor calculado do seguro por período", "R$", "500"),

  // ── Observação ──
  v("customizada", "customizada.vc_observacao", "vc_observacao", "Observação", "Observação condicional (tensão/inversor)", "-", "Observação técnica"),
];

// ── Variáveis Customizadas Default ───────────────────────────

export const DEFAULT_CUSTOM_VARIABLES: Array<{
  nome: string;
  label: string;
  expressao: string;
  tipo_resultado: string;
  categoria: string;
  descricao: string;
}> = [
  {
    nome: "vc_saldo_solar_25_anos",
    label: "Saldo solar 25 anos",
    expressao: "[economia_anual] * 25",
    tipo_resultado: "currency",
    categoria: "financeiro",
    descricao: "Economia acumulada com energia solar em 25 anos",
  },
  {
    nome: "vc_saldo_renda_fixa_25_anos",
    label: "Saldo renda fixa 25 anos",
    expressao: "[preco_total] * 1.08",
    tipo_resultado: "currency",
    categoria: "financeiro",
    descricao: "Investimento equivalente em renda fixa por 25 anos",
  },
  {
    nome: "vc_roi_primeiro_mes",
    label: "ROI primeiro mês",
    expressao: "[economia_mensal] / [preco_total] * 100",
    tipo_resultado: "percent",
    categoria: "financeiro",
    descricao: "Retorno sobre investimento no primeiro mês",
  },
  {
    nome: "vc_tarifa_solar",
    label: "Tarifa solar efetiva",
    expressao: "[preco_total] / ([geracao_anual] * 25)",
    tipo_resultado: "currency",
    categoria: "financeiro",
    descricao: "Custo efetivo por kWh com energia solar ao longo de 25 anos",
  },
  {
    nome: "vc_preco_watt",
    label: "Preço por Watt",
    expressao: "[preco_total] / ([potencia_sistema] * 1000)",
    tipo_resultado: "currency",
    categoria: "financeiro",
    descricao: "Valor do investimento por Watt instalado",
  },
  {
    nome: "vc_economia_conta_total_rs",
    label: "Economia total conta (R$)",
    expressao: "[economia_mensal] * 12",
    tipo_resultado: "currency",
    categoria: "financeiro",
    descricao: "Economia total anual na conta de energia",
  },
  {
    nome: "vc_consumo_anual",
    label: "Consumo anual",
    expressao: "[consumo_mensal] * 12",
    tipo_resultado: "number",
    categoria: "tecnico",
    descricao: "Consumo anual total de energia",
  },
];

// ═══════════════════════════════════════════════════════════════
// ALIAS MAPPING — Resolução bidirecional canonical ↔ legacy
// ═══════════════════════════════════════════════════════════════

const _canonicalToLegacy = new Map<string, string>();
const _legacyToCanonical = new Map<string, string>();
const _byCanonical = new Map<string, CatalogVariable>();
const _byLegacy = new Map<string, CatalogVariable>();

VARIABLES_CATALOG.forEach((v) => {
  _canonicalToLegacy.set(v.canonicalKey, v.legacyKey);
  _legacyToCanonical.set(v.legacyKey, v.canonicalKey);
  _byCanonical.set(v.canonicalKey, v);
  _byLegacy.set(v.legacyKey, v);
});

/** Resolve qualquer formato para o canônico {{grupo.campo}} */
export function toCanonical(key: string): string {
  if (key.startsWith("{{")) return key;
  if (_legacyToCanonical.has(key)) return _legacyToCanonical.get(key)!;
  // Try wrapping in [] and looking up
  const bracketed = `[${key}]`;
  if (_legacyToCanonical.has(bracketed)) return _legacyToCanonical.get(bracketed)!;
  return key;
}

/** Resolve qualquer formato para o legado [campo] */
export function toLegacy(key: string): string {
  if (key.startsWith("[")) return key;
  if (_canonicalToLegacy.has(key)) return _canonicalToLegacy.get(key)!;
  return key;
}

/** Buscar variável por qualquer formato */
export function findVariable(key: string): CatalogVariable | undefined {
  return _byCanonical.get(key) || _byLegacy.get(key);
}

/** Todas as variáveis de uma categoria */
export function getByCategory(category: VariableCategory): CatalogVariable[] {
  return VARIABLES_CATALOG.filter((v) => v.category === category);
}

/** Busca textual em label, description, keys */
export function searchVariables(query: string): CatalogVariable[] {
  const q = query.toLowerCase();
  return VARIABLES_CATALOG.filter(
    (v) =>
      v.label.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      v.canonicalKey.toLowerCase().includes(q) ||
      v.legacyKey.toLowerCase().includes(q)
  );
}

/**
 * Substitui variáveis em um texto, suportando ambos os formatos.
 * Processa primeiro {{grupo.campo}} e depois [campo].
 */
export function replaceVariables(
  text: string,
  context: Record<string, any>
): string {
  let result = text;

  // 1. Replace {{grupo.campo}} format
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const val = context[key] ?? context[key.replace(/\./g, "_")];
    return val !== undefined && val !== null ? String(val) : match;
  });

  // 2. Replace [campo] format
  result = result.replace(/\[([^\]]+)\]/g, (match, key) => {
    const val = context[key];
    return val !== undefined && val !== null ? String(val) : match;
  });

  return result;
}
