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
  v("entrada", "entrada.tipo", "tipo", "Tipo de projeto", "Tipo: residencial, comercial, rural, industrial", "", "residencial"),
  v("entrada", "entrada.tipo_uc1", "tipo_uc1", "Tipo UC principal", "Tipo da unidade consumidora principal", "", "monofásico"),
  v("entrada", "entrada.consumo_mensal", "consumo_mensal", "Consumo mensal total", "Soma do consumo mensal de todas as UCs", "kWh", "450"),
  v("entrada", "entrada.consumo_mensal_uc1", "consumo_mensal_uc1", "Consumo UC1", "Consumo mensal da UC principal", "kWh", "350"),
  v("entrada", "entrada.consumo_mensal_p", "consumo_mensal_p", "Consumo ponta", "Consumo mensal na ponta (Grupo A)", "kWh", "100"),
  v("entrada", "entrada.consumo_mensal_fp", "consumo_mensal_fp", "Consumo fora-ponta", "Consumo mensal fora da ponta (Grupo A)", "kWh", "350"),
  v("entrada", "entrada.distribuidora", "distribuidora", "Distribuidora", "Nome da concessionária/distribuidora", "", "CEMIG"),
  v("entrada", "entrada.subgrupo", "subgrupo", "Subgrupo tarifário", "B1, B2, B3, A4, etc.", "", "B1"),
  v("entrada", "entrada.consumo_jan", "consumo_jan", "Consumo janeiro", "Consumo em janeiro", "kWh", "500"),
  v("entrada", "entrada.consumo_fev", "consumo_fev", "Consumo fevereiro", "Consumo em fevereiro", "kWh", "480"),
  v("entrada", "entrada.consumo_mar", "consumo_mar", "Consumo março", "Consumo em março", "kWh", "460"),
  v("entrada", "entrada.consumo_abr", "consumo_abr", "Consumo abril", "Consumo em abril", "kWh", "400"),
  v("entrada", "entrada.consumo_mai", "consumo_mai", "Consumo maio", "Consumo em maio", "kWh", "380"),
  v("entrada", "entrada.consumo_jun", "consumo_jun", "Consumo junho", "Consumo em junho", "kWh", "350"),
  v("entrada", "entrada.consumo_jul", "consumo_jul", "Consumo julho", "Consumo em julho", "kWh", "340"),
  v("entrada", "entrada.consumo_ago", "consumo_ago", "Consumo agosto", "Consumo em agosto", "kWh", "360"),
  v("entrada", "entrada.consumo_set", "consumo_set", "Consumo setembro", "Consumo em setembro", "kWh", "380"),
  v("entrada", "entrada.consumo_out", "consumo_out", "Consumo outubro", "Consumo em outubro", "kWh", "420"),
  v("entrada", "entrada.consumo_nov", "consumo_nov", "Consumo novembro", "Consumo em novembro", "kWh", "450"),
  v("entrada", "entrada.consumo_dez", "consumo_dez", "Consumo dezembro", "Consumo em dezembro", "kWh", "490"),
  v("entrada", "entrada.tarifa_energia", "tarifa_energia", "Tarifa de energia", "Tarifa TE da distribuidora", "R$/kWh", "0.85"),
  v("entrada", "entrada.tarifa_fio_b", "tarifa_fio_b", "Tarifa Fio B", "Tarifa TUSD Fio B", "R$/kWh", "0.25"),
  v("entrada", "entrada.demanda_contratada", "demanda_contratada", "Demanda contratada", "Demanda contratada (Grupo A)", "kW", "50"),
  v("entrada", "entrada.estado", "estado", "Estado", "UF do cliente", "", "MG"),
  v("entrada", "entrada.cidade", "cidade", "Cidade", "Cidade do cliente", "", "Belo Horizonte"),
  v("entrada", "entrada.distancia_km", "distancia_km", "Distância", "Distância para instalação", "km", "25"),
  v("entrada", "entrada.taxa_desempenho", "taxa_desempenho", "Taxa de desempenho", "Performance ratio do sistema", "%", "80"),
  v("entrada", "entrada.desvio_azimutal", "desvio_azimutal", "Desvio azimutal", "Desvio em relação ao norte", "°", "15"),
  v("entrada", "entrada.inclinacao", "inclinacao", "Inclinação", "Ângulo de inclinação dos módulos", "°", "20"),
  v("entrada", "entrada.fator_geracao", "fator_geracao", "Fator de geração", "Fator de geração local (kWh/kWp/mês)", "kWh/kWp", "130"),
  v("entrada", "entrada.telhado", "telhado", "Tipo de telhado", "Cerâmico, metálico, fibrocimento, laje, solo", "", "cerâmico"),
  v("entrada", "entrada.fase", "fase", "Fase", "Monofásico, bifásico, trifásico", "", "trifásico"),
  v("entrada", "entrada.tensao", "tensao", "Tensão", "Tensão de atendimento", "V", "220"),
  v("entrada", "entrada.custo_disponibilidade", "custo_disponibilidade", "Custo disponibilidade", "Custo mínimo da concessionária", "R$", "50.00"),
  v("entrada", "entrada.topologia", "topologia", "Topologia", "On-grid, off-grid, híbrido", "", "on-grid"),
  v("entrada", "entrada.simultaneidade", "simultaneidade", "Simultaneidade", "Fator de simultaneidade para autoconsumo", "%", "30"),
  v("entrada", "entrada.rateio_percentual", "rateio_percentual", "Rateio percentual", "Percentual de rateio entre UCs", "%", "100"),
  v("entrada", "entrada.nome_uc1", "nome_uc1", "Nome UC1", "Nome/apelido da UC principal", "", "Casa principal"),

  // ──────────────────────────────────────────────────────────────
  // SISTEMA SOLAR
  // ──────────────────────────────────────────────────────────────
  v("sistema_solar", "sistema_solar.potencia_ideal_total", "potencia_ideal_total", "Potência ideal total", "Potência ideal calculada para atender consumo", "kWp", "8.50"),
  v("sistema_solar", "sistema_solar.potencia_sistema", "potencia_sistema", "Potência do sistema", "Potência real do sistema configurado", "kWp", "8.80"),
  v("sistema_solar", "sistema_solar.geracao_mensal", "geracao_mensal", "Geração mensal", "Geração média mensal estimada", "kWh", "1100"),
  v("sistema_solar", "sistema_solar.geracao_anual", "geracao_anual", "Geração anual", "Geração anual total no ano 0", "kWh", "13200"),
  v("sistema_solar", "sistema_solar.geracao_jan", "geracao_jan", "Geração janeiro", "Geração estimada em janeiro", "kWh", "1200"),
  v("sistema_solar", "sistema_solar.geracao_fev", "geracao_fev", "Geração fevereiro", "Geração estimada em fevereiro", "kWh", "1150"),
  v("sistema_solar", "sistema_solar.geracao_mar", "geracao_mar", "Geração março", "Geração estimada em março", "kWh", "1100"),
  v("sistema_solar", "sistema_solar.geracao_abr", "geracao_abr", "Geração abril", "Geração estimada em abril", "kWh", "1000"),
  v("sistema_solar", "sistema_solar.geracao_mai", "geracao_mai", "Geração maio", "Geração estimada em maio", "kWh", "900"),
  v("sistema_solar", "sistema_solar.geracao_jun", "geracao_jun", "Geração junho", "Geração estimada em junho", "kWh", "850"),
  v("sistema_solar", "sistema_solar.geracao_jul", "geracao_jul", "Geração julho", "Geração estimada em julho", "kWh", "870"),
  v("sistema_solar", "sistema_solar.geracao_ago", "geracao_ago", "Geração agosto", "Geração estimada em agosto", "kWh", "950"),
  v("sistema_solar", "sistema_solar.geracao_set", "geracao_set", "Geração setembro", "Geração estimada em setembro", "kWh", "1050"),
  v("sistema_solar", "sistema_solar.geracao_out", "geracao_out", "Geração outubro", "Geração estimada em outubro", "kWh", "1150"),
  v("sistema_solar", "sistema_solar.geracao_nov", "geracao_nov", "Geração novembro", "Geração estimada em novembro", "kWh", "1180"),
  v("sistema_solar", "sistema_solar.geracao_dez", "geracao_dez", "Geração dezembro", "Geração estimada em dezembro", "kWh", "1200"),
  v("sistema_solar", "sistema_solar.modulo_fabricante", "modulo_fabricante", "Fabricante módulo", "Fabricante do módulo solar", "", "Canadian Solar"),
  v("sistema_solar", "sistema_solar.modulo_modelo", "modulo_modelo", "Modelo módulo", "Modelo do módulo", "", "CS6W-550MS"),
  v("sistema_solar", "sistema_solar.modulo_potencia", "modulo_potencia", "Potência módulo", "Potência unitária do módulo", "Wp", "550"),
  v("sistema_solar", "sistema_solar.modulo_quantidade", "modulo_quantidade", "Qtd. módulos", "Quantidade total de módulos", "un", "16"),
  v("sistema_solar", "sistema_solar.modulo_area", "modulo_area", "Área do módulo", "Área de um módulo", "m²", "2.58"),
  v("sistema_solar", "sistema_solar.modulo_garantia", "modulo_garantia", "Garantia módulo", "Garantia do fabricante do módulo", "anos", "25"),
  v("sistema_solar", "sistema_solar.inversor_fabricante", "inversor_fabricante", "Fabricante inversor", "Fabricante do inversor", "", "Growatt"),
  v("sistema_solar", "sistema_solar.inversor_modelo", "inversor_modelo", "Modelo inversor", "Modelo do inversor", "", "MIN 8000TL-X"),
  v("sistema_solar", "sistema_solar.inversor_potencia", "inversor_potencia", "Potência inversor", "Potência nominal do inversor", "kW", "8.0"),
  v("sistema_solar", "sistema_solar.inversor_quantidade", "inversor_quantidade", "Qtd. inversores", "Quantidade de inversores", "un", "1"),
  v("sistema_solar", "sistema_solar.inversor_garantia", "inversor_garantia", "Garantia inversor", "Garantia do fabricante do inversor", "anos", "10"),
  v("sistema_solar", "sistema_solar.area_necessaria", "area_necessaria", "Área necessária", "Área total necessária para instalação", "m²", "42"),
  v("sistema_solar", "sistema_solar.peso_total", "peso_total", "Peso total", "Peso total do sistema", "kg", "380"),
  v("sistema_solar", "sistema_solar.estrutura_tipo", "estrutura_tipo", "Tipo estrutura", "Tipo de estrutura de fixação", "", "Trilho alumínio"),
  v("sistema_solar", "sistema_solar.layout_orientacao", "layout_orientacao", "Orientação", "Orientação do arranjo (N, NE, NO...)", "", "Norte"),

  // ──────────────────────────────────────────────────────────────
  // FINANCEIRO
  // ──────────────────────────────────────────────────────────────
  v("financeiro", "financeiro.preco_total", "preco_total", "Preço total", "Valor total do projeto/proposta", "R$", "45000.00"),
  v("financeiro", "financeiro.preco_kwp", "preco_kwp", "Preço por kWp", "Valor por kWp instalado", "R$/kWp", "5113.64"),
  v("financeiro", "financeiro.preco_watt", "preco_watt", "Preço por Watt", "Valor por Watt instalado", "R$/W", "5.11"),
  v("financeiro", "financeiro.custo_modulos", "custo_modulos", "Custo módulos", "Custo total dos módulos", "R$", "12000.00"),
  v("financeiro", "financeiro.custo_inversores", "custo_inversores", "Custo inversores", "Custo total dos inversores", "R$", "6000.00"),
  v("financeiro", "financeiro.custo_estrutura", "custo_estrutura", "Custo estrutura", "Custo da estrutura de fixação", "R$", "3000.00"),
  v("financeiro", "financeiro.custo_instalacao", "custo_instalacao", "Custo instalação", "Custo de mão de obra de instalação", "R$", "5000.00"),
  v("financeiro", "financeiro.custo_kit", "custo_kit", "Custo do kit", "Custo total do kit de equipamentos", "R$", "21000.00"),
  v("financeiro", "financeiro.margem_percentual", "margem_percentual", "Margem (%)", "Margem percentual sobre o custo", "%", "35"),
  v("financeiro", "financeiro.desconto_percentual", "desconto_percentual", "Desconto (%)", "Desconto aplicado", "%", "5"),
  v("financeiro", "financeiro.desconto_valor", "desconto_valor", "Desconto (R$)", "Valor do desconto em reais", "R$", "2250.00"),
  v("financeiro", "financeiro.economia_mensal", "economia_mensal", "Economia mensal", "Economia mensal estimada na conta de luz", "R$", "850.00"),
  v("financeiro", "financeiro.economia_anual", "economia_anual", "Economia anual", "Economia anual estimada", "R$", "10200.00"),
  v("financeiro", "financeiro.payback_meses", "payback_meses", "Payback (meses)", "Tempo de retorno do investimento em meses", "meses", "52"),
  v("financeiro", "financeiro.payback_anos", "payback_anos", "Payback (anos)", "Tempo de retorno do investimento em anos", "anos", "4.3"),
  v("financeiro", "financeiro.vpl", "vpl", "VPL", "Valor presente líquido do investimento", "R$", "120000.00"),
  v("financeiro", "financeiro.tir", "tir", "TIR", "Taxa interna de retorno", "%", "25"),
  v("financeiro", "financeiro.roi_25_anos", "roi_25_anos", "ROI 25 anos", "Retorno total em 25 anos", "R$", "210000.00"),
  v("financeiro", "financeiro.solar_25_anos", "solar_25_anos", "Saldo solar 25 anos", "Saldo acumulado com energia solar em 25 anos", "R$", "255000.00"),
  v("financeiro", "financeiro.renda_fixa_25_anos", "renda_fixa_25_anos", "Renda fixa 25 anos", "Se investisse o mesmo valor em renda fixa", "R$", "85000.00"),
  v("financeiro", "financeiro.poupanca_25_anos", "poupanca_25_anos", "Poupança 25 anos", "Se investisse o mesmo valor na poupança", "R$", "72000.00"),
  v("financeiro", "financeiro.comissao_percentual", "comissao_percentual", "Comissão (%)", "Percentual de comissão do consultor", "%", "5"),
  v("financeiro", "financeiro.comissao_valor", "comissao_valor", "Comissão (R$)", "Valor da comissão do consultor", "R$", "2250.00"),
  // Financiamento
  v("financeiro", "financeiro.f_banco", "f_banco", "Banco financiamento", "Banco/instituição financeira", "", "BV Financeira"),
  v("financeiro", "financeiro.f_taxa_juros", "f_taxa_juros", "Taxa de juros", "Taxa de juros mensal do financiamento", "% a.m.", "1.29"),
  v("financeiro", "financeiro.f_parcelas", "f_parcelas", "Nº parcelas", "Quantidade de parcelas do financiamento", "un", "60"),
  v("financeiro", "financeiro.f_valor_parcela", "f_valor_parcela", "Valor parcela", "Valor mensal da parcela", "R$", "980.00"),
  v("financeiro", "financeiro.f_entrada", "f_entrada", "Entrada", "Valor de entrada do financiamento", "R$", "5000.00"),
  v("financeiro", "financeiro.f_valor_financiado", "f_valor_financiado", "Valor financiado", "Valor total financiado", "R$", "40000.00"),
  v("financeiro", "financeiro.f_cet", "f_cet", "CET", "Custo efetivo total anual", "% a.a.", "18.5"),

  // ──────────────────────────────────────────────────────────────
  // CONTA DE ENERGIA
  // ──────────────────────────────────────────────────────────────
  v("conta_energia", "conta_energia.gasto_atual_mensal", "gasto_atual_mensal", "Gasto atual mensal", "Valor atual da conta de energia", "R$", "750.00"),
  v("conta_energia", "conta_energia.gasto_com_solar_mensal", "gasto_com_solar_mensal", "Gasto com solar mensal", "Valor estimado da conta com solar", "R$", "50.00"),
  v("conta_energia", "conta_energia.economia_percentual", "economia_percentual", "Economia (%)", "Percentual de economia na conta", "%", "93"),
  v("conta_energia", "conta_energia.creditos_mensal", "creditos_mensal", "Créditos mensais", "Créditos de energia gerados por mês", "kWh", "650"),
  v("conta_energia", "conta_energia.tarifa_atual", "tarifa_atual", "Tarifa atual", "Tarifa vigente da distribuidora", "R$/kWh", "0.95"),
  v("conta_energia", "conta_energia.imposto_percentual", "imposto_percentual", "Imposto (%)", "Percentual de impostos na conta", "%", "25"),
  v("conta_energia", "conta_energia.bandeira_tarifaria", "bandeira_tarifaria", "Bandeira tarifária", "Bandeira tarifária vigente", "", "Verde"),

  // ──────────────────────────────────────────────────────────────
  // COMERCIAL
  // ──────────────────────────────────────────────────────────────
  v("comercial", "comercial.proposta_identificador", "proposta_identificador", "Nº da proposta", "Identificador único da proposta", "", "PROP-2025-0042"),
  v("comercial", "comercial.proposta_titulo", "proposta_titulo", "Título da proposta", "Nome/título da proposta", "", "Proposta Solar Residencial"),
  v("comercial", "comercial.proposta_link", "proposta_link", "Link da proposta", "URL de visualização pública da proposta", "", "https://..."),
  v("comercial", "comercial.proposta_validade", "proposta_validade", "Validade", "Data de validade da proposta", "data", "15/03/2025"),
  v("comercial", "comercial.proposta_data", "proposta_data", "Data da proposta", "Data de criação da proposta", "data", "01/03/2025"),
  v("comercial", "comercial.responsavel_nome", "responsavel_nome", "Responsável nome", "Nome do responsável técnico", "", "João Silva"),
  v("comercial", "comercial.responsavel_email", "responsavel_email", "Responsável email", "Email do responsável", "", "joao@empresa.com"),
  v("comercial", "comercial.responsavel_celular", "responsavel_celular", "Responsável celular", "Celular do responsável", "", "(31) 99999-0000"),
  v("comercial", "comercial.representante_nome", "representante_nome", "Representante nome", "Nome do representante comercial", "", "Maria Souza"),
  v("comercial", "comercial.representante_email", "representante_email", "Representante email", "Email do representante", "", "maria@empresa.com"),
  v("comercial", "comercial.representante_celular", "representante_celular", "Representante celular", "Celular do representante", "", "(31) 98888-0000"),
  v("comercial", "comercial.projeto_id_externo", "projeto_id_externo", "ID externo", "ID do projeto em sistema externo", "", "PRJ-12345"),
  v("comercial", "comercial.empresa_nome", "empresa_nome", "Empresa nome", "Razão social da empresa", "", "Solar Tech Ltda"),
  v("comercial", "comercial.empresa_cnpj_cpf", "empresa_cnpj_cpf", "Empresa CNPJ/CPF", "CNPJ ou CPF da empresa", "", "12.345.678/0001-90"),
  v("comercial", "comercial.empresa_cidade", "empresa_cidade", "Empresa cidade", "Cidade da empresa", "", "Belo Horizonte"),
  v("comercial", "comercial.empresa_estado", "empresa_estado", "Empresa estado", "Estado da empresa", "", "MG"),
  v("comercial", "comercial.empresa_endereco", "empresa_endereco", "Empresa endereço", "Endereço completo da empresa", "", "Rua Solar, 100"),
  v("comercial", "comercial.empresa_telefone", "empresa_telefone", "Empresa telefone", "Telefone da empresa", "", "(31) 3333-0000"),
  v("comercial", "comercial.empresa_email", "empresa_email", "Empresa email", "Email da empresa", "", "contato@solartech.com"),
  v("comercial", "comercial.empresa_logo_url", "empresa_logo_url", "Logo da empresa", "URL do logotipo da empresa", "", "https://..."),

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
  // CAMPOS DOS DISTRIBUIDORES (não implantado)
  // ──────────────────────────────────────────────────────────────
  v("cdd", "cdd.tipo_estrutura", "cdd_tipo_estrutura", "Tipo de estrutura", "Tipo de estrutura no sistema do distribuidor", "", "Solo", "proposta", { notImplemented: true }),
  v("cdd", "cdd.marca_estrutura", "cdd_marca_estrutura", "Marca estrutura", "Marca da estrutura", "", "Romagnole", "proposta", { notImplemented: true }),
  v("cdd", "cdd.comunicador", "cdd_comunicador", "Comunicador", "Tipo de comunicador de dados", "", "Wi-Fi", "proposta", { notImplemented: true }),
  v("cdd", "cdd.nivel", "cdd_nivel", "Nível", "Nível do distribuidor", "", "Gold", "proposta", { notImplemented: true }),
  v("cdd", "cdd.orientacao", "cdd_orientacao", "Orientação", "Orientação dos módulos", "", "Norte", "proposta", { notImplemented: true }),
  v("cdd", "cdd.string_config", "cdd_string", "Configuração string", "Configuração de strings CC", "", "2x8", "proposta", { notImplemented: true }),
  v("cdd", "cdd.string_ca", "cdd_sting_ca", "String CA", "Configuração de strings CA", "", "1x1", "proposta", { notImplemented: true }),
  v("cdd", "cdd.telhado", "cdd_telhado", "Telhado (CDD)", "Tipo de telhado no cadastro do distribuidor", "", "Cerâmico", "proposta", { notImplemented: true }),
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
