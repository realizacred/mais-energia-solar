/**
 * Known keys resolved in each layer of the system.
 *
 * FRONTEND_RESOLVER_KEYS: Keys explicitly handled by resolveProposalVariables.ts
 * (switch-case + deepGet fallback).
 *
 * BACKEND_FLATTEN_KEYS: Keys produced by domain resolvers in
 * supabase/functions/_shared/resolvers/ (resolveAllVariables).
 *
 * Updated 2026-03-29 after comprehensive audit of all 6 BE resolvers
 * and the FE resolver. Includes dynamic keys (monthly series, annual series,
 * indexed equipment, UC-indexed) and passthrough groups.
 */
export const FRONTEND_RESOLVER_KEYS = new Set<string>([
  // ── Tarifa (9) ──
  "tarifa.te_kwh", "tarifa.tusd_total_kwh", "tarifa.fio_b_real_kwh",
  "tarifa.fio_b_usado_kwh", "tarifa.precisao", "tarifa.precisao_motivo",
  "tarifa.origem", "tarifa.vigencia_inicio", "tarifa.vigencia_fim",

  // ── ANEEL (3) ──
  "aneel.last_sync_at", "aneel.run_id", "aneel.snapshot_hash_curto",

  // ── GD (4) ──
  "gd.regra", "gd.ano_aplicado", "gd.fio_b_percent_cobrado", "gd.fio_b_percent_compensado",

  // ── Cálculo (8) ──
  "calculo.consumo_mensal_kwh", "calculo.custo_disponibilidade_kwh",
  "calculo.consumo_compensavel_kwh", "calculo.geracao_mensal_kwh",
  "calculo.energia_compensada_kwh", "calculo.valor_credito_kwh",
  "calculo.economia_mensal_rs", "alerta.estimado.texto_pdf",

  // ── Cliente (10) ──
  "cliente.nome", "cliente.empresa", "cliente.cnpj_cpf", "cliente.email",
  "cliente.celular", "cliente.endereco", "cliente.cidade", "cliente.estado",
  "cliente.bairro", "cliente.cep",

  // ── Comercial (10) ──
  "comercial.responsavel_nome", "comercial.responsavel_email", "comercial.responsavel_celular",
  "comercial.representante_nome", "comercial.representante_email", "comercial.representante_celular",
  "comercial.empresa_nome",
  "comercial.consultor_nome", "comercial.consultor_telefone", "comercial.consultor_email",

  // ── Entrada (11) ──
  "entrada.consumo_mensal", "entrada.dis_energia",
  "entrada.estado", "entrada.cidade", "entrada.fase",
  "entrada.tipo_telhado", "entrada.tarifa_distribuidora",
  "entrada.custo_disponibilidade_kwh", "entrada.tensao_rede",
  "entrada.tipo_sistema", "entrada.area_util",

  // ── Sistema Solar — Base (~20) ──
  "sistema_solar.potencia_sistema", "sistema_solar.potencia_sistema_numero",
  "sistema_solar.geracao_mensal", "sistema_solar.geracao_mensal_numero",
  "sistema_solar.geracao_anual",
  "sistema_solar.numero_modulos",
  "sistema_solar.modulo_fabricante", "sistema_solar.modulo_modelo",
  "sistema_solar.modulo_potencia", "sistema_solar.modulo_potencia_numero",
  "sistema_solar.modulo_quantidade",
  "sistema_solar.modulo_comprimento", "sistema_solar.modulo_comprimento_numero",
  "sistema_solar.modulo_largura", "sistema_solar.modulo_largura_numero",
  "sistema_solar.modulo_area", "sistema_solar.modulo_area_numero",
  "sistema_solar.inversor_fabricante", "sistema_solar.inversor_fabricante_1",
  "sistema_solar.inversor_modelo",
  "sistema_solar.inversor_potencia_nominal", "sistema_solar.inversor_potencia_nominal_numero",
  "sistema_solar.inversor_quantidade",
  "sistema_solar.area_util", "sistema_solar.area_necessaria",

  // ── Financeiro (~40) ──
  "financeiro.preco_total", "financeiro.preco", "financeiro.preco_final",
  "financeiro.valor_total", "financeiro.valor_total_numero",
  "financeiro.economia_mensal", "financeiro.economia_mensal_numero",
  "financeiro.economia_anual", "financeiro.economia_anual_numero",
  "financeiro.economia_25_anos",
  "financeiro.payback_anos", "financeiro.payback_meses",
  "financeiro.preco_kwp", "financeiro.preco_watt", "financeiro.preco_watt_numero",
  "financeiro.valor_kit", "financeiro.custo_kit",
  "financeiro.valor_kit_numero",
  "financeiro.valor_instalacao", "financeiro.custo_instalacao_total",
  "financeiro.valor_instalacao_numero",
  "financeiro.valor_comissao", "financeiro.comissao_total",
  "financeiro.valor_outros_custos", "financeiro.valor_servicos",
  "financeiro.margem_percentual", "financeiro.margem_valor", "financeiro.margem_real",
  "financeiro.desconto_percentual", "financeiro.desconto_valor",
  "financeiro.percentual_comissao", "financeiro.consultor_comissao",
  "financeiro.modulo_custo_un", "financeiro.modulo_preco_un",
  "financeiro.modulo_custo_total", "financeiro.modulo_preco_total",
  "financeiro.inversor_custo_un", "financeiro.inversor_preco_un",
  "financeiro.inversor_custo_total", "financeiro.inversor_preco_total",
  "financeiro.f_ativo_nome", "financeiro.f_ativo_parcela",
  "financeiro.f_ativo_taxa", "financeiro.f_ativo_prazo",
  "financeiro.f_ativo_entrada", "financeiro.f_ativo_valor",

  // ── Financeiro indexed (f_nome_1..5, f_parcela_1..5, etc.) ──
  "financeiro.f_nome_1", "financeiro.f_nome_2", "financeiro.f_nome_3", "financeiro.f_nome_4", "financeiro.f_nome_5",
  "financeiro.f_parcela_1", "financeiro.f_parcela_2", "financeiro.f_parcela_3",
  "financeiro.f_taxa_1", "financeiro.f_taxa_2", "financeiro.f_taxa_3",
  "financeiro.f_prazo_1", "financeiro.f_prazo_2", "financeiro.f_prazo_3",
  "financeiro.f_entrada_1", "financeiro.f_entrada_2", "financeiro.f_entrada_3",
  "financeiro.f_valor_1", "financeiro.f_valor_2", "financeiro.f_valor_3",

  // ── Conta Energia (3) ──
  "conta_energia.co2_evitado_ano", "conta_energia.gasto_atual_mensal",
  "conta_energia.economia_percentual",

  // ── Customizada (pagamento opcoes) ──
  "customizada.vc_financeira_nome", "customizada.vc_nome",
  "customizada.vc_a_vista",
  "customizada.vc_parcela_1", "customizada.vc_parcela_2", "customizada.vc_parcela_3",
  "customizada.vc_taxa_1", "customizada.vc_taxa_2", "customizada.vc_taxa_3",
  "customizada.vc_prazo_1", "customizada.vc_prazo_2", "customizada.vc_prazo_3",
  "customizada.vc_entrada_1", "customizada.vc_entrada_2", "customizada.vc_entrada_3",
]);

// ── Backend resolvers: keys set via domain resolvers ──
// Updated 2026-03-29 — comprehensive extraction from all 6 resolvers.
export const BACKEND_FLATTEN_KEYS = new Set<string>([
  // ══════════════════════════════════════════
  // resolveEntrada.ts
  // ══════════════════════════════════════════
  "tipo", "tipo_uc1", "consumo_mensal", "consumo_mensal_uc1",
  "consumo_mensal_p", "consumo_mensal_p_uc1", "consumo_mensal_fp", "consumo_mensal_fp_uc1",
  "dis_energia", "concessionaria_id",
  "subgrupo", "subgrupo_uc1", "grupo_tarifario",
  // Monthly consumption (BT)
  "consumo_jan", "consumo_fev", "consumo_mar", "consumo_abr", "consumo_mai", "consumo_jun",
  "consumo_jul", "consumo_ago", "consumo_set", "consumo_out", "consumo_nov", "consumo_dez",
  // Monthly consumption UC1
  "consumo_jan_uc1", "consumo_fev_uc1", "consumo_mar_uc1", "consumo_abr_uc1",
  "consumo_mai_uc1", "consumo_jun_uc1", "consumo_jul_uc1", "consumo_ago_uc1",
  "consumo_set_uc1", "consumo_out_uc1", "consumo_nov_uc1", "consumo_dez_uc1",
  // Monthly MT ponta/fora ponta
  "consumo_mensal_p_jan", "consumo_mensal_p_fev", "consumo_mensal_p_mar", "consumo_mensal_p_abr",
  "consumo_mensal_p_mai", "consumo_mensal_p_jun", "consumo_mensal_p_jul", "consumo_mensal_p_ago",
  "consumo_mensal_p_set", "consumo_mensal_p_out", "consumo_mensal_p_nov", "consumo_mensal_p_dez",
  "consumo_mensal_p_jan_uc1", "consumo_mensal_p_fev_uc1", "consumo_mensal_p_mar_uc1",
  "consumo_mensal_p_abr_uc1", "consumo_mensal_p_mai_uc1", "consumo_mensal_p_jun_uc1",
  "consumo_mensal_p_jul_uc1", "consumo_mensal_p_ago_uc1", "consumo_mensal_p_set_uc1",
  "consumo_mensal_p_out_uc1", "consumo_mensal_p_nov_uc1", "consumo_mensal_p_dez_uc1",
  "consumo_mensal_fp_jan", "consumo_mensal_fp_fev", "consumo_mensal_fp_mar", "consumo_mensal_fp_abr",
  "consumo_mensal_fp_mai", "consumo_mensal_fp_jun", "consumo_mensal_fp_jul", "consumo_mensal_fp_ago",
  "consumo_mensal_fp_set", "consumo_mensal_fp_out", "consumo_mensal_fp_nov", "consumo_mensal_fp_dez",
  "consumo_mensal_fp_jan_uc1", "consumo_mensal_fp_fev_uc1", "consumo_mensal_fp_mar_uc1",
  "consumo_mensal_fp_abr_uc1", "consumo_mensal_fp_mai_uc1", "consumo_mensal_fp_jun_uc1",
  "consumo_mensal_fp_jul_uc1", "consumo_mensal_fp_ago_uc1", "consumo_mensal_fp_set_uc1",
  "consumo_mensal_fp_out_uc1", "consumo_mensal_fp_nov_uc1", "consumo_mensal_fp_dez_uc1",
  // Tarifas BT
  "tarifa_distribuidora", "tarifa_distribuidora_uc1",
  // Tarifas MT
  "tarifa_te_p", "tarifa_te_p_uc1", "tarifa_tusd_p", "tarifa_tusd_p_uc1",
  "tarifa_te_fp", "tarifa_te_fp_uc1", "tarifa_tusd_fp", "tarifa_tusd_fp_uc1",
  // Demanda MT
  "demanda_preco", "demanda_preco_uc1", "demanda_contratada", "demanda_contratada_uc1",
  "demanda_adicional",
  // Outros encargos
  "outros_encargos_atual", "outros_encargos_atual_uc1",
  "outros_encargos_novo", "outros_encargos_novo_uc1",
  // Localização e parâmetros
  "estado", "cidade", "cidade_estado", "distancia", "taxa_desempenho",
  "desvio_azimutal", "inclinacao", "fator_geracao",
  // Fator geração mensal
  "fator_geracao_jan", "fator_geracao_fev", "fator_geracao_mar", "fator_geracao_abr",
  "fator_geracao_mai", "fator_geracao_jun", "fator_geracao_jul", "fator_geracao_ago",
  "fator_geracao_set", "fator_geracao_out", "fator_geracao_nov", "fator_geracao_dez",
  // Instalação
  "tipo_telhado", "cape_telhado", "estrutura",
  "fase", "fase_uc1", "tensao_rede", "tensao",
  // Custo disponibilidade
  "custo_disponibilidade_kwh", "custo_disponibilidade_kwh_uc1",
  // Área
  "area_util",
  // Topologia
  "topologia", "fator_simultaneidade", "tipo_sistema",
  // Rateio
  "rateio_sugerido_creditos", "rateio_sugerido_creditos_uc1",
  "rateio_creditos", "rateio_creditos_uc1",
  // Impostos
  "imposto_energia", "imposto_energia_uc1",
  // UC
  "nome_uc1",
  // Demanda geração MT
  "demanda_g_uc1", "demanda_g_preco_uc1",
  // Tarifa Fio B / Energia Compensada
  "t_e_comp_fp_1_uc1", "t_e_comp_fp_2_uc1",
  "t_e_comp_p_1_uc1", "t_e_comp_p_2_uc1",
  "t_e_comp_bt_1_uc1", "t_e_comp_bt_2_uc1",
  // Regra compensação
  "regra_comp_uc1",
  // DoD
  "dod",
  // QTD UCs
  "qtd_ucs",

  // ══════════════════════════════════════════
  // resolveSistemaSolar.ts
  // ══════════════════════════════════════════
  // Potência e geração
  "potencia_sistema", "potencia_kwp", "potencia_ideal_total",
  "geracao_mensal", "geracao_mensal_numero", "geracao_anual", "geracao_anual_numero",
  // Geração mensal por mês
  "geracao_jan", "geracao_fev", "geracao_mar", "geracao_abr", "geracao_mai", "geracao_jun",
  "geracao_jul", "geracao_ago", "geracao_set", "geracao_out", "geracao_nov", "geracao_dez",
  // Geração anual 0..25
  "geracao_anual_0", "geracao_anual_1", "geracao_anual_2", "geracao_anual_3",
  "geracao_anual_4", "geracao_anual_5", "geracao_anual_6", "geracao_anual_7",
  "geracao_anual_8", "geracao_anual_9", "geracao_anual_10",
  // (pattern continues — isKeyInBackendFlatten handles _\d+ patterns)
  // Módulos
  "numero_modulos", "modulo_quantidade", "vc_total_modulo",
  "modulo_fabricante", "modulo_modelo", "modulo_potencia", "modulo_potencia_numero",
  "vc_modulo_potencia",
  "modulo_tipo_celula", "modulo_celulas", "modulo_eficiencia",
  "modulo_tensao_maxima", "modulo_vmp", "modulo_voc", "modulo_imp", "modulo_isc",
  "modulo_comprimento", "modulo_comprimento_numero",
  "modulo_largura", "modulo_largura_numero",
  "modulo_profundidade", "modulo_profundidade_numero",
  "modulo_coef_temp_pmax", "modulo_coef_temp_voc", "modulo_coef_temp_isc",
  "modulo_area", "modulo_area_numero",
  "modulo_codigo", "modulo_garantia",
  // Inversores — concatenated
  "inversor_fabricante", "inversor_fabricante_1",
  "inversor_modelo", "inversor_potencia_nominal", "inversor_potencia_nominal_numero",
  "inversores_utilizados", "inversor_quantidade",
  "inversor_tensao", "inversor_tipo",
  "inversor_corrente_saida", "inversor_mppts_utilizados",
  "inversor_codigo", "inversor_garantia",
  "inversores_potencia_maxima_total",
  "inversor_sistema",
  "inversor_corrente_max_entrada_mppt1", "inversor_corrente_max_entrada",
  "inversor_strings_utilizadas",
  "inversor_corrente_max_carga_cc", "inversor_corrente_max_descarga_cc",
  "inversor_tipo_bateria", "inversor_tensao_bateria_min", "inversor_tensao_bateria_max",
  // Inversores — indexed (_1.._5 via pattern matching)
  "inversor_fabricante_1", "inversor_modelo_1", "inversor_potencia_nominal_1",
  "inversor_quantidade_1", "inversor_potencia_1", "inversor_tensao_1",
  "inversor_tipo_1", "inversor_mppts_utilizados_1", "inversor_sistema_1",
  "inversor_corrente_max_entrada_mppt1_1", "inversor_corrente_max_entrada_1",
  // Otimizador
  "otimizador_fabricante", "otimizador_modelo", "otimizador_potencia", "otimizador_quantidade",
  // Transformador
  "transformador_nome", "transformador_potencia",
  // Baterias — concatenated
  "bateria_fabricante", "bateria_modelo", "bateria_tipo", "bateria_energia",
  "bateria_quantidade", "bateria_tensao_operacao", "bateria_tensao_nominal",
  "bateria_tensao_carga", "bateria_potencia_maxima_saida",
  "bateria_corrente_maxima_descarga", "bateria_corrente_maxima_carga",
  "bateria_corrente_recomendada", "bateria_capacidade",
  "bateria_comprimento", "bateria_largura", "bateria_profundidade",
  "bateria_temperatura_descarga_min", "bateria_temperatura_descarga_max",
  "bateria_temperatura_carga_min", "bateria_temperatura_carga_max",
  "bateria_temperatura_armazenamento_min", "bateria_temperatura_armazenamento_max",
  // Baterias — indexed (_1.._3 via pattern)
  "bateria_fabricante_1", "bateria_modelo_1", "bateria_tipo_1", "bateria_energia_1",
  "bateria_quantidade_1", "bateria_tensao_operacao_1", "bateria_tensao_nominal_1",
  "bateria_tensao_carga_1", "bateria_potencia_maxima_saida_1",
  "bateria_corrente_maxima_descarga_1", "bateria_corrente_maxima_carga_1",
  "bateria_corrente_recomendada_1", "bateria_capacidade_1",
  "bateria_comprimento_1", "bateria_largura_1", "bateria_profundidade_1",
  // Armazenamento
  "autonomia", "energia_diaria_armazenamento", "armazenamento_necessario",
  "armazenamento_util_adicionado", "p_armazenamento_necessario",
  // Layout
  "layout_arranjo_linhas", "layout_arranjo_modulos", "layout_arranjo_orientacao",
  "layout_linhas_total", "layout_arranjos_total",
  "layout_arranjos_total_horizontal", "layout_arranjos_total_vertical",
  "layout_orientacao",
  // Misc
  "creditos_gerados", "kit_fechado_quantidade", "segmentos_utilizados",
  "area_necessaria", "peso_total", "estrutura_tipo", "kit_codigo",
  "inversor_potencia",

  // ══════════════════════════════════════════
  // resolveFinanceiro.ts
  // ══════════════════════════════════════════
  "valor_total", "valor_total_numero", "preco_final", "preco_total", "preco", "capo_i",
  "vc_a_vista", "preco_kwp", "preco_watt", "preco_watt_numero",
  "economia_mensal", "economia_mensal_numero", "economia_anual", "economia_anual_numero",
  "roi_25_anos", "economia_25_anos",
  "economia_percentual", "economia_mensal_percent",
  "payback", "payback_meses", "payback_anos",
  "kit_fechado_preco_total", "kit_fechado_custo_total",
  "vpl", "tir", "roi_anual",
  // Cost breakdown
  "valor_instalacao", "custo_instalacao_total", "valor_instalacao_numero",
  "valor_comissao", "comissao_total",
  "valor_outros_custos", "valor_servicos",
  "valor_kit", "valor_kit_numero", "valor_custo_total",
  "margem_valor", "margem_real", "margem_percentual",
  "desconto_percentual", "desconto_valor",
  "percentual_comissao", "consultor_comissao",
  // Equipment costs (passthrough from snapshot)
  "modulo_custo_un", "modulo_preco_un", "modulo_custo_total", "modulo_preco_total",
  "inversor_custo_un", "inversor_preco_un", "inversor_custo_total", "inversor_preco_total",
  "inversores_custo_total", "inversores_preco_total",
  "otimizador_custo_un", "otimizador_preco_un", "otimizador_custo_total", "otimizador_preco_total",
  "instalacao_custo_total", "instalacao_preco_total",
  "estrutura_custo_total", "estrutura_preco_total",
  "equipamentos_custo_total", "kits_custo_total", "componentes_custo_total",
  "baterias_custo_total", "baterias_preco_total",
  "bateria_custo_un", "bateria_preco_un", "bateria_custo_total", "bateria_preco_total",
  "margem_lucro",
  "custo_modulos", "custo_inversores", "custo_estrutura", "custo_instalacao", "custo_kit",
  "comissao_percentual", "comissao_valor", "comissao_res", "comissao_rep",
  "comissao_res_p", "comissao_rep_p",
  "distribuidor_categoria", "preco_por_extenso",
  "transformadores_custo_total", "transformadores_preco_total",
  // Indexed equipment costs (_1.._5 via pattern)
  "inversor_custo_un_1", "inversor_preco_un_1", "inversor_preco_total_1",
  "transformador_custo_un_1", "transformador_preco_un_1",
  "bateria_custo_un_1", "bateria_preco_un_1", "bateria_preco_total_1",
  "item_a_nome_1", "item_a_custo_1", "item_a_preco_1",
  // f_* indexed financing
  "f_nome_1", "f_entrada_1", "f_entrada_p_1", "f_valor_1", "f_valor_p_1",
  "f_prazo_1", "f_carencia_1", "f_taxa_1", "f_parcela_1",
  "f_ativo_nome", "f_ativo_entrada", "f_ativo_entrada_p",
  "f_ativo_valor", "f_ativo_valor_p",
  "f_ativo_prazo", "f_ativo_carencia", "f_ativo_taxa", "f_ativo_parcela",
  "f_banco", "f_taxa_juros", "f_parcelas", "f_valor_parcela",
  "f_entrada", "f_valor_financiado", "f_cet",
  // Annual series (0..25)
  "investimento_anual_0", "economia_anual_valor_0", "fluxo_caixa_acumulado_anual_0",
  "solar_25", "renda_25", "poupanca_25",
  "solar_25_anos", "renda_fixa_25_anos", "poupanca_25_anos",

  // ══════════════════════════════════════════
  // resolvePagamento.ts
  // ══════════════════════════════════════════
  "vc_cartao_credito_parcela_1", "vc_cartao_credito_parcela_2",
  "vc_cartao_credito_parcela_3", "vc_cartao_credito_parcela_4",
  "vc_parcela_1", "vc_parcela_2", "vc_parcela_3",
  "vc_taxa_1", "vc_taxa_2", "vc_taxa_3",
  "vc_prazo_1", "vc_prazo_2", "vc_prazo_3",
  "vc_entrada_1", "vc_entrada_2", "vc_entrada_3",
  "vc_financeira_nome",

  // ══════════════════════════════════════════
  // resolveClienteComercial.ts
  // ══════════════════════════════════════════
  "cliente_nome", "vc_nome", "cliente_celular", "cliente_email",
  "cliente_cnpj_cpf", "cliente_empresa", "cliente_cep",
  "cliente_endereco", "cliente_numero", "cliente_complemento",
  "cliente_bairro", "cliente_cidade", "cliente_estado",
  // Comercial
  "consultor_nome", "responsavel_nome", "consultor_telefone", "consultor_email",
  "empresa_nome", "proposta_data", "proposta_titulo", "proposta_identificador",
  "proposta_validade", "proposta_versao",
  // Proposta metadados (new)
  "proposta_status", "proposta_aceita_at", "proposta_enviada_at",
  "proposta_recusa_motivo", "proposta_recusada_at", "proposta_viewed_at",
  "proposta_versao_status", "proposta_output_docx_path", "proposta_output_pdf_path",
  "proposta_num",
  // Premissas da proposta (new)
  "proposta_inflacao_energetica", "proposta_perda_eficiencia_anual", "proposta_sobredimensionamento",
  // Empresa / brand_settings (new)
  "empresa_cnpj_cpf", "empresa_cidade", "empresa_estado", "empresa_logo_url",
  "empresa_representante_legal", "empresa_representante_cpf", "empresa_representante_cargo",
  // Projeto (new)
  "projeto_id_externo", "projeto_valor_equipamentos", "projeto_valor_mao_obra",
  "projeto_data_venda", "projeto_data_instalacao", "projeto_status",
  "projeto_observacoes", "projeto_forma_pagamento", "projeto_valor_entrada",
  "projeto_numero_parcelas", "projeto_valor_parcela", "projeto_valor_financiado",
  // Concessionária (new)
  "concessionaria_sigla", "concessionaria_estado", "concessionaria_tarifa_fio_b",
  "concessionaria_custo_disponibilidade_monofasico",
  "concessionaria_custo_disponibilidade_bifasico",
  "concessionaria_custo_disponibilidade_trifasico",
  "concessionaria_aliquota_icms", "concessionaria_possui_isencao_scee",
  // Simulação (new)
  "simulacao_tipo_conta",
  // Conta energia (passthrough from snapshot)
  "gasto_atual_mensal", "gasto_com_solar_mensal", "economia_percentual",
  "creditos_mensal", "tarifa_atual", "imposto_percentual", "bandeira_tarifaria",
  "custo_disponibilidade_valor",
  "gasto_energia_mensal_atual", "gasto_energia_mensal_novo",
  "gasto_energia_mensal_bt_atual", "gasto_energia_mensal_bt_novo",
  "gasto_energia_mensal_p_atual", "gasto_energia_mensal_p_novo",
  "gasto_energia_mensal_fp_atual", "gasto_energia_mensal_fp_novo",
  "gasto_demanda_mensal_atual", "gasto_demanda_mensal_novo",
  "economia_energia_mensal", "economia_energia_mensal_p",
  "economia_demanda_mensal", "economia_demanda_mensal_p",
  "gasto_total_mensal_atual", "gasto_total_mensal_novo",
  "creditos_alocados", "consumo_abatido",
  "valor_imposto_energia", "tarifacao_energia_compensada_bt",
  // Monthly credits
  "creditos_jan", "creditos_fev", "creditos_mar", "creditos_abr",
  "creditos_mai", "creditos_jun", "creditos_jul", "creditos_ago",
  "creditos_set", "creditos_out", "creditos_nov", "creditos_dez",
  "creditos_alocados_jan", "creditos_alocados_fev", "creditos_alocados_mar",
  "creditos_alocados_abr", "creditos_alocados_mai", "creditos_alocados_jun",
  "creditos_alocados_jul", "creditos_alocados_ago", "creditos_alocados_set",
  "creditos_alocados_out", "creditos_alocados_nov", "creditos_alocados_dez",
  // CO2
  "co2_evitado_ano",
  // Premissas
  "inflacao_energetica", "inflacao_ipca", "imposto", "vpl_taxa_desconto",
  "perda_eficiencia_anual", "troca_inversor", "troca_inversor_custo",
  "sobredimensionamento", "vida_util_sistema",
  // Observação
  "vc_observacao",

  // ══════════════════════════════════════════
  // resolveMultiUC.ts
  // ══════════════════════════════════════════
  "num_ucs",
  // Per-UC variables (_uc1.._ucN via pattern)
  "investimento_uc1", "economia_uc1", "economia_mensal_uc1", "economia_anual_uc1",
  "payback_uc1", "payback_meses_uc1", "payback_anos_uc1",
  "vpl_uc1", "tir_uc1",
  // Per-UC annual series (_0.._25 via pattern)
  "economia_anual_valor_0_uc1", "fluxo_caixa_acumulado_anual_0_uc1",

  // ══════════════════════════════════════════
  // index.ts — canonical aliases (addCanonicalAliases)
  // ══════════════════════════════════════════
  // These are added as dotted aliases of flat keys via CANONICAL_PREFIX_MAP
  // The pattern matcher in isKeyInBackendFlatten handles these
]);

export const BACKEND_TEMPLATE_PREVIEW_KEYS = new Set<string>([
  ...BACKEND_FLATTEN_KEYS,
]);

/**
 * Maps canonical dotted keys to their data source path in the snapshot/context.
 */
export const SOURCE_MAP: Record<string, { source: string; path: string }> = {
  "cliente.nome": { source: "cliente", path: "cliente.nome" },
  "cliente.empresa": { source: "cliente", path: "cliente.empresa" },
  "cliente.cnpj_cpf": { source: "cliente", path: "cliente.cpf_cnpj" },
  "cliente.email": { source: "cliente", path: "cliente.email" },
  "cliente.celular": { source: "cliente", path: "cliente.telefone" },
  "cliente.endereco": { source: "cliente", path: "cliente.rua" },
  "cliente.cidade": { source: "cliente", path: "cliente.cidade" },
  "cliente.estado": { source: "cliente", path: "cliente.estado" },
  "cliente.bairro": { source: "cliente", path: "cliente.bairro" },
  "cliente.cep": { source: "cliente", path: "cliente.cep" },
  "entrada.consumo_mensal": { source: "ucs/tecnico", path: "ucs[0].consumo_mensal / tecnico.consumo_total_kwh" },
  "entrada.dis_energia": { source: "ucs/snapshot", path: "snapshot.concessionaria_nome / ucs[0].distribuidora" },
  "entrada.tarifa_distribuidora": { source: "ucs/snapshot", path: "snapshot.tarifa_distribuidora / ucs[0].tarifa_kwh" },
  "sistema_solar.potencia_sistema": { source: "versao/tecnico", path: "versao.potencia_kwp / tecnico.potencia_kwp" },
  "sistema_solar.geracao_mensal": { source: "projeto/tecnico", path: "projeto.geracao_mensal_media_kwh / tecnico.geracao_estimada_kwh" },
  "financeiro.preco_total": { source: "versao/financeiro", path: "versao.valor_total / financeiro.valor_total" },
  "financeiro.economia_mensal": { source: "versao/financeiro", path: "versao.economia_mensal / financeiro.economia_mensal" },
  "financeiro.payback_anos": { source: "versao/financeiro", path: "versao.payback_meses/12 / financeiro.payback_meses/12" },
  "comercial.responsavel_nome": { source: "consultor", path: "consultor.nome" },
  "comercial.empresa_nome": { source: "tenant", path: "tenants.nome" },
  "customizada.vc_financeira_nome": { source: "pagamento_opcoes", path: "pagamento_opcoes[tipo=financ].nome" },
  "customizada.vc_nome": { source: "cliente", path: "cliente.nome (alias legado)" },
};
