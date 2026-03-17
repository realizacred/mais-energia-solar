/**
 * Known keys resolved in each layer of the system.
 * Updated to reflect domain resolver architecture.
 */

// ── Frontend resolver: keys handled in resolveProposalVariables.ts ──
// Updated 2026-03-16: comprehensive sync with variablesCatalog.ts + domain resolvers.
// Keys handled by classifier patterns (monthly _jan.._dez, annual _0.._25, UC _uc\d+,
// equipment indexed _\d+) do NOT need to be listed here.
export const FRONTEND_RESOLVER_KEYS = new Set<string>([
  // ── Tarifa ──
  "tarifa.te_kwh", "tarifa.tusd_total_kwh", "tarifa.fio_b_real_kwh",
  "tarifa.fio_b_usado_kwh", "tarifa.precisao", "tarifa.precisao_motivo",
  "tarifa.origem", "tarifa.vigencia_inicio", "tarifa.vigencia_fim",
  // ── ANEEL ──
  "aneel.last_sync_at", "aneel.run_id", "aneel.snapshot_hash_curto",
  // ── GD ──
  "gd.regra", "gd.ano_aplicado", "gd.fio_b_percent_cobrado", "gd.fio_b_percent_compensado",
  // ── Cálculo ──
  "calculo.consumo_mensal_kwh", "calculo.custo_disponibilidade_kwh",
  "calculo.consumo_compensavel_kwh", "calculo.geracao_mensal_kwh",
  "calculo.energia_compensada_kwh", "calculo.valor_credito_kwh",
  "calculo.economia_mensal_rs", "alerta.estimado.texto_pdf",

  // ══════════════════════════════════════════════════════════
  // ── ENTRADA (resolveEntrada) ──
  // ══════════════════════════════════════════════════════════
  "entrada.tipo",
  "entrada.consumo_mensal", "entrada.consumo_mensal_p", "entrada.consumo_mensal_fp",
  "entrada.dis_energia",
  "entrada.tarifa_distribuidora",
  "entrada.tarifa_te_p", "entrada.tarifa_tusd_p",
  "entrada.tarifa_te_fp", "entrada.tarifa_tusd_fp",
  "entrada.demanda_preco", "entrada.demanda_contratada", "entrada.demanda_adicional",
  "entrada.outros_encargos_atual", "entrada.outros_encargos_novo",
  "entrada.estado", "entrada.cidade", "entrada.cidade_estado",
  "entrada.distancia", "entrada.taxa_desempenho",
  "entrada.desvio_azimutal", "entrada.inclinacao", "entrada.fator_geracao",
  "entrada.tipo_telhado", "entrada.fase", "entrada.tensao_rede",
  "entrada.custo_disponibilidade_kwh",
  "entrada.topologia", "entrada.fator_simultaneidade", "entrada.tipo_sistema",
  "entrada.rateio_sugerido_creditos", "entrada.rateio_creditos",
  "entrada.imposto_energia",
  "entrada.dod", "entrada.qtd_ucs",

  // ══════════════════════════════════════════════════════════
  // ── CLIENTE (resolveCliente) ──
  // ══════════════════════════════════════════════════════════
  "cliente.nome", "cliente.empresa", "cliente.cnpj_cpf", "cliente.email",
  "cliente.celular", "cliente.endereco", "cliente.cidade", "cliente.estado",
  "cliente.bairro", "cliente.cep", "cliente.numero", "cliente.complemento",
  "cliente.data_nascimento",

  // ══════════════════════════════════════════════════════════
  // ── COMERCIAL (resolveComercial) ──
  // ══════════════════════════════════════════════════════════
  "comercial.responsavel_nome", "comercial.empresa_nome",
  "comercial.consultor_telefone", "comercial.consultor_email", "comercial.consultor_codigo",
  "comercial.responsavel_email", "comercial.responsavel_celular",
  "comercial.representante_nome", "comercial.representante_email", "comercial.representante_celular",
  "comercial.proposta_identificador", "comercial.proposta_titulo", "comercial.proposta_link",
  "comercial.proposta_validade", "comercial.proposta_data",
  "comercial.proposta_num", "comercial.proposta_status", "comercial.proposta_valido_ate",
  "comercial.proposta_link_pdf", "comercial.proposta_aceita_at", "comercial.proposta_enviada_at",
  "comercial.proposta_recusa_motivo", "comercial.proposta_recusada_at",
  "comercial.proposta_regra_gd", "comercial.proposta_origem_tarifa",
  "comercial.proposta_precisao_calculo", "comercial.proposta_precisao_motivo",
  "comercial.proposta_versao_atual",
  "comercial.proposta_inflacao_energetica", "comercial.proposta_perda_eficiencia_anual",
  "comercial.proposta_sobredimensionamento",
  "comercial.proposta_enviado_em", "comercial.proposta_aceito_em",
  "comercial.proposta_rejeitado_em", "comercial.proposta_motivo_rejeicao",
  "comercial.proposta_output_docx_path", "comercial.proposta_output_pdf_path",
  "comercial.proposta_viewed_at", "comercial.proposta_observacoes", "comercial.proposta_versao_status",
  "comercial.empresa_cnpj_cpf", "comercial.empresa_cidade", "comercial.empresa_estado",
  "comercial.empresa_endereco", "comercial.empresa_telefone", "comercial.empresa_email",
  "comercial.empresa_logo_url",
  "comercial.projeto_id_externo",
  "comercial.deal_title", "comercial.deal_status", "comercial.deal_etiqueta",
  "comercial.deal_notas", "comercial.deal_expected_close_date",
  "comercial.projeto_tipo_instalacao", "comercial.projeto_valor_equipamentos",
  "comercial.projeto_valor_mao_obra", "comercial.projeto_data_venda",
  "comercial.projeto_data_previsao_instalacao", "comercial.projeto_data_instalacao",
  "comercial.projeto_data_comissionamento", "comercial.projeto_status",
  "comercial.projeto_forma_pagamento", "comercial.projeto_valor_entrada",
  "comercial.projeto_valor_financiado", "comercial.projeto_numero_parcelas",
  "comercial.projeto_valor_parcela",
  "comercial.projeto_prazo_estimado_dias", "comercial.projeto_prazo_vistoria_dias",
  "comercial.projeto_rua_instalacao", "comercial.projeto_numero_instalacao",
  "comercial.projeto_complemento_instalacao", "comercial.projeto_bairro_instalacao",
  "comercial.projeto_cidade_instalacao", "comercial.projeto_uf_instalacao",
  "comercial.projeto_cep_instalacao",
  "comercial.projeto_lat_instalacao", "comercial.projeto_lon_instalacao",
  "comercial.projeto_observacoes",
  "comercial.concessionaria_sigla", "comercial.concessionaria_estado",
  "comercial.concessionaria_tarifa_fio_b",
  "comercial.concessionaria_custo_disponibilidade_monofasico",
  "comercial.concessionaria_custo_disponibilidade_bifasico",
  "comercial.concessionaria_custo_disponibilidade_trifasico",
  "comercial.concessionaria_aliquota_icms",
  "comercial.concessionaria_percentual_isencao", "comercial.concessionaria_possui_isencao_scee",
  "comercial.simulacao_tipo_conta", "comercial.simulacao_co2_evitado_kg",
  "comercial.cliente_observacoes",

  // ══════════════════════════════════════════════════════════
  // ── SISTEMA SOLAR (resolveSistemaSolar) ──
  // ══════════════════════════════════════════════════════════
  // Potência e Geração
  "sistema_solar.potencia_sistema", "sistema_solar.potencia_kwp",
  "sistema_solar.potencia_ideal_total",
  "sistema_solar.tipo_fornecedor_distribuidor", "sistema_solar.fornecedor",
  "sistema_solar.tipo_kit",
  "sistema_solar.geracao_mensal", "sistema_solar.geracao_anual",
  "sistema_solar.kit_fechado_quantidade", "sistema_solar.segmentos_utilizados",
  "sistema_solar.numero_modulos",
  // Módulo
  "sistema_solar.modulo_fabricante", "sistema_solar.modulo_modelo",
  "sistema_solar.modulo_potencia", "sistema_solar.modulo_quantidade",
  "sistema_solar.modulo_celulas", "sistema_solar.modulo_tipo_celula",
  "sistema_solar.modulo_eficiencia", "sistema_solar.modulo_tensao_maxima",
  "sistema_solar.modulo_vmp", "sistema_solar.modulo_voc",
  "sistema_solar.modulo_imp", "sistema_solar.modulo_isc",
  "sistema_solar.modulo_comprimento", "sistema_solar.modulo_largura",
  "sistema_solar.modulo_profundidade",
  "sistema_solar.modulo_area",
  "sistema_solar.modulo_coef_temp_pmax", "sistema_solar.modulo_coef_temp_voc",
  "sistema_solar.modulo_coef_temp_isc",
  "sistema_solar.modulo_codigo", "sistema_solar.modulo_garantia",
  // Inversor (base/concatenado)
  "sistema_solar.inversor_fabricante", "sistema_solar.inversor_modelo",
  "sistema_solar.inversor_potencia_nominal", "sistema_solar.inversor_quantidade",
  "sistema_solar.inversor_potencia",
  "sistema_solar.inversor_tensao", "sistema_solar.inversor_tipo",
  "sistema_solar.inversor_corrente_saida",
  "sistema_solar.inversor_mppts_utilizados", "sistema_solar.inversor_strings_utilizadas",
  "sistema_solar.inversor_codigo", "sistema_solar.inversor_garantia",
  "sistema_solar.inversor_sistema",
  "sistema_solar.inversor_corrente_max_entrada_mppt1",
  "sistema_solar.inversor_corrente_max_entrada",
  "sistema_solar.inversor_corrente_max_carga_cc",
  "sistema_solar.inversor_corrente_max_descarga_cc",
  "sistema_solar.inversor_tipo_bateria",
  "sistema_solar.inversor_tensao_bateria_min", "sistema_solar.inversor_tensao_bateria_max",
  // Inversor totais
  "sistema_solar.inversores_potencia_maxima_total", "sistema_solar.inversores_utilizados",
  // Otimizador
  "sistema_solar.otimizador_fabricante", "sistema_solar.otimizador_modelo",
  "sistema_solar.otimizador_potencia", "sistema_solar.otimizador_quantidade",
  // Transformador
  "sistema_solar.transformador_nome", "sistema_solar.transformador_potencia",
  // Kit
  "sistema_solar.kit_codigo",
  // Área e Estrutura
  "sistema_solar.area_util", "sistema_solar.area_necessaria",
  "sistema_solar.peso_total", "sistema_solar.estrutura_tipo",
  // Layout
  "sistema_solar.layout_arranjo_linhas", "sistema_solar.layout_arranjo_modulos",
  "sistema_solar.layout_arranjo_orientacao",
  "sistema_solar.layout_linhas_total", "sistema_solar.layout_arranjos_total",
  "sistema_solar.layout_arranjos_total_horizontal", "sistema_solar.layout_arranjos_total_vertical",
  "sistema_solar.layout_orientacao",
  // UCs
  "sistema_solar.qtd_ucs", "sistema_solar.creditos_gerados",
  // Bateria (base/concatenado)
  "sistema_solar.bateria_fabricante", "sistema_solar.bateria_modelo",
  "sistema_solar.bateria_tipo", "sistema_solar.bateria_energia",
  "sistema_solar.bateria_quantidade",
  "sistema_solar.bateria_comprimento", "sistema_solar.bateria_largura",
  "sistema_solar.bateria_profundidade",
  "sistema_solar.bateria_tensao_operacao", "sistema_solar.bateria_tensao_carga",
  "sistema_solar.bateria_tensao_nominal",
  "sistema_solar.bateria_potencia_maxima_saida",
  "sistema_solar.bateria_corrente_maxima_descarga", "sistema_solar.bateria_corrente_maxima_carga",
  "sistema_solar.bateria_corrente_recomendada", "sistema_solar.bateria_capacidade",
  "sistema_solar.bateria_temperatura_descarga_min", "sistema_solar.bateria_temperatura_descarga_max",
  "sistema_solar.bateria_temperatura_carga_min", "sistema_solar.bateria_temperatura_carga_max",
  "sistema_solar.bateria_temperatura_armazenamento_min", "sistema_solar.bateria_temperatura_armazenamento_max",
  // Armazenamento
  "sistema_solar.autonomia", "sistema_solar.energia_diaria_armazenamento",
  "sistema_solar.armazenamento_necessario", "sistema_solar.armazenamento_util_adicionado",
  "sistema_solar.p_armazenamento_necessario",

  // ══════════════════════════════════════════════════════════
  // ── FINANCEIRO (resolveFinanceiro) ──
  // ══════════════════════════════════════════════════════════
  "financeiro.preco_total", "financeiro.preco", "financeiro.preco_final", "financeiro.valor_total",
  "financeiro.economia_mensal", "financeiro.economia_anual", "financeiro.economia_25_anos",
  "financeiro.payback_anos", "financeiro.payback_meses", "financeiro.payback",
  "financeiro.preco_kwp", "financeiro.preco_watt",
  "financeiro.preco_por_extenso", "financeiro.margem_lucro",
  "financeiro.vpl", "financeiro.tir", "financeiro.roi_anual",
  // Equipamentos — módulo
  "financeiro.modulo_custo_un", "financeiro.modulo_preco_un",
  "financeiro.modulo_custo_total", "financeiro.modulo_preco_total",
  // Equipamentos — inversor
  "financeiro.inversor_custo_un", "financeiro.inversor_preco_un",
  "financeiro.inversor_custo_total", "financeiro.inversor_preco_total",
  "financeiro.inversores_custo_total", "financeiro.inversores_preco_total",
  // Equipamentos — otimizador
  "financeiro.otimizador_custo_un", "financeiro.otimizador_preco_un",
  "financeiro.otimizador_custo_total", "financeiro.otimizador_preco_total",
  // Equipamentos — kit/estrutura/instalação/transformador
  "financeiro.kit_fechado_custo_total", "financeiro.kit_fechado_preco_total",
  "financeiro.instalacao_custo_total", "financeiro.instalacao_preco_total",
  "financeiro.estrutura_custo_total", "financeiro.estrutura_preco_total",
  "financeiro.transformadores_custo_total", "financeiro.transformadores_preco_total",
  // Totais agregados
  "financeiro.equipamentos_custo_total", "financeiro.kits_custo_total",
  "financeiro.componentes_custo_total",
  // Bateria
  "financeiro.bateria_custo_un", "financeiro.bateria_preco_un",
  "financeiro.bateria_custo_total", "financeiro.bateria_preco_total",
  "financeiro.baterias_custo_total", "financeiro.baterias_preco_total",
  // Financiamento ativo
  "financeiro.f_ativo_nome", "financeiro.f_ativo_parcela",
  "financeiro.f_ativo_taxa", "financeiro.f_ativo_prazo",
  "financeiro.f_ativo_entrada", "financeiro.f_ativo_valor",
  "financeiro.f_ativo_entrada_p", "financeiro.f_ativo_valor_p",
  "financeiro.f_ativo_carencia",
  // Distribuidor
  "financeiro.distribuidor_categoria",
  // Comissões
  "financeiro.comissao_res", "financeiro.comissao_rep",
  "financeiro.comissao_res_p", "financeiro.comissao_rep_p",
  // Comparativos
  "financeiro.solar_25", "financeiro.renda_25", "financeiro.poupanca_25",
  // Legado
  "financeiro.custo_modulos", "financeiro.custo_inversores", "financeiro.custo_estrutura",
  "financeiro.custo_instalacao", "financeiro.custo_kit",
  "financeiro.margem_percentual", "financeiro.desconto_percentual", "financeiro.desconto_valor",
  "financeiro.roi_25_anos", "financeiro.solar_25_anos",
  "financeiro.renda_fixa_25_anos", "financeiro.poupanca_25_anos",
  "financeiro.comissao_percentual", "financeiro.comissao_valor",
  "financeiro.f_banco", "financeiro.f_taxa_juros", "financeiro.f_parcelas",
  "financeiro.f_valor_parcela", "financeiro.f_entrada", "financeiro.f_valor_financiado",
  "financeiro.f_cet",

  // ══════════════════════════════════════════════════════════
  // ── CONTA DE ENERGIA (resolveContaEnergia) ──
  // ══════════════════════════════════════════════════════════
  "conta_energia.co2_evitado_ano", "conta_energia.gasto_atual_mensal",
  "conta_energia.economia_percentual",
  "conta_energia.gasto_com_solar_mensal", "conta_energia.creditos_mensal",
  "conta_energia.tarifa_atual", "conta_energia.imposto_percentual",
  "conta_energia.bandeira_tarifaria",
  "conta_energia.custo_disponibilidade_valor",
  "conta_energia.gasto_energia_mensal_atual", "conta_energia.gasto_energia_mensal_bt_atual",
  "conta_energia.gasto_energia_mensal_novo", "conta_energia.gasto_energia_mensal_bt_novo",
  "conta_energia.gasto_energia_mensal_p_atual", "conta_energia.gasto_energia_mensal_p_novo",
  "conta_energia.gasto_energia_mensal_fp_atual", "conta_energia.gasto_energia_mensal_fp_novo",
  "conta_energia.gasto_demanda_mensal_atual", "conta_energia.gasto_demanda_mensal_novo",
  "conta_energia.economia_energia_mensal", "conta_energia.economia_energia_mensal_p",
  "conta_energia.economia_demanda_mensal", "conta_energia.economia_demanda_mensal_p",
  "conta_energia.gasto_total_mensal_atual", "conta_energia.gasto_total_mensal_novo",
  "conta_energia.economia_mensal", "conta_energia.economia_mensal_p",
  "conta_energia.creditos_alocados", "conta_energia.consumo_abatido",
  "conta_energia.consumo_abatido_p", "conta_energia.consumo_abatido_fp",
  "conta_energia.valor_imposto_energia",
  "conta_energia.tarifacao_energia_compensada_bt",
  "conta_energia.tarifacao_energia_compensada_fp",
  "conta_energia.tarifacao_energia_compensada_p",

  // ══════════════════════════════════════════════════════════
  // ── CUSTOMIZADA (resolveCustomizada / motor de expressões) ──
  // ══════════════════════════════════════════════════════════
  "customizada.vc_financeira_nome", "customizada.vc_nome",
  "customizada.vc_parcela_1", "customizada.vc_taxa_1",
  "customizada.vc_prazo_1", "customizada.vc_entrada_1",
  "customizada.vc_a_vista",
]);

// ── Backend resolvers: keys set via domain resolvers ──
// Updated 2026-03-16 after catalog enrichment audit.
// Columns verified against actual DB schema.
export const BACKEND_FLATTEN_KEYS = new Set<string>([
  // Entrada
  "tipo", "tipo_uc1", "consumo_mensal", "consumo_mensal_uc1",
  "consumo_mensal_p", "consumo_mensal_p_uc1", "consumo_mensal_fp", "consumo_mensal_fp_uc1",
  "dis_energia", "subgrupo_uc1",
  "consumo_jan", "consumo_fev", "consumo_mar", "consumo_abr", "consumo_mai", "consumo_jun",
  "consumo_jul", "consumo_ago", "consumo_set", "consumo_out", "consumo_nov", "consumo_dez",
  "tarifa_distribuidora", "tarifa_distribuidora_uc1",
  "tarifa_te_p", "tarifa_te_p_uc1", "tarifa_tusd_p", "tarifa_tusd_p_uc1",
  "tarifa_te_fp", "tarifa_te_fp_uc1", "tarifa_tusd_fp", "tarifa_tusd_fp_uc1",
  "demanda_preco", "demanda_preco_uc1", "demanda_contratada", "demanda_contratada_uc1",
  "demanda_adicional", "outros_encargos_atual", "outros_encargos_atual_uc1",
  "outros_encargos_novo", "outros_encargos_novo_uc1",
  "estado", "cidade", "cidade_estado", "distancia", "taxa_desempenho",
  "desvio_azimutal", "inclinacao", "fator_geracao",
  "tipo_telhado", "fase", "fase_uc1", "tensao_rede",
  "custo_disponibilidade_kwh", "custo_disponibilidade_kwh_uc1",
  "topologia", "fator_simultaneidade", "tipo_sistema",
  "rateio_sugerido_creditos", "rateio_sugerido_creditos_uc1",
  "rateio_creditos", "rateio_creditos_uc1",
  "imposto_energia", "imposto_energia_uc1",
  "nome_uc1", "demanda_g_uc1", "demanda_g_preco_uc1",
  "t_e_comp_fp_1_uc1", "t_e_comp_fp_2_uc1", "t_e_comp_p_1_uc1",
  "dod", "qtd_ucs",
  // Sistema Solar — base
  "potencia_sistema", "potencia_kwp", "geracao_mensal", "geracao_anual",
  "numero_modulos", "modulo_quantidade", "vc_total_modulo",
  "modulo_fabricante", "modulo_modelo", "modulo_potencia", "vc_modulo_potencia",
  "inversor_fabricante", "inversor_fabricante_1", "inversor_modelo",
  "inversor_potencia_nominal", "inversores_utilizados", "inversor_quantidade",
  // Sistema Solar — catalog-enriched (verified columns exist in DB)
  "modulo_tipo_celula", "modulo_celulas", "modulo_eficiencia",
  "modulo_tensao_maxima", "modulo_vmp", "modulo_voc", "modulo_imp", "modulo_isc",
  "modulo_comprimento", "modulo_largura", "modulo_profundidade",
  "modulo_coef_temp_pmax", "modulo_coef_temp_voc", "modulo_coef_temp_isc",
  "modulo_area", // derived: comprimento × largura
  "inversor_tensao", // from tensao_linha_v (AC-side)
  "inversor_tipo", // from tipo_sistema (on-grid/hybrid/off-grid)
  "inversor_mppts_utilizados", // from mppts
  "inversor_sistema", // alias for tipo_sistema
  "inversor_corrente_max_entrada_mppt1", "inversor_corrente_max_entrada", // from corrente_max_mppt_a (DC input)
  "inversores_potencia_maxima_total", // derived: Σ(potencia_maxima_w × qty)
  "inversor_potencia", // from potencia_maxima_w
  // Baterias — catalog-enriched (verified columns exist in DB)
  "bateria_fabricante", "bateria_modelo", "bateria_tipo", "bateria_energia",
  "bateria_quantidade", "bateria_tensao_operacao", "bateria_tensao_nominal",
  "bateria_tensao_carga", "bateria_potencia_maxima_saida",
  "bateria_corrente_maxima_descarga", "bateria_corrente_maxima_carga",
  "bateria_corrente_recomendada", "bateria_capacidade",
  "bateria_comprimento", "bateria_largura", "bateria_profundidade",
  // Financeiro
  "valor_total", "preco_final", "preco_total", "preco", "capo_i",
  "economia_mensal", "economia_anual", "economia_25_anos",
  "payback", "payback_meses", "payback_anos",
  "preco_kwp", "preco_watt", "vpl", "tir", "roi_anual",
  // Pagamento
  "vc_a_vista", "vc_parcela_1", "vc_parcela_2", "vc_parcela_3",
  "vc_taxa_1", "vc_taxa_2", "vc_taxa_3",
  "vc_prazo_1", "vc_prazo_2", "vc_prazo_3",
  "vc_entrada_1", "vc_entrada_2", "vc_entrada_3",
  "vc_cartao_credito_parcela_1", "vc_cartao_credito_parcela_2",
  "vc_cartao_credito_parcela_3", "vc_cartao_credito_parcela_4",
  "f_nome_1", "f_parcela_1", "f_taxa_1", "f_prazo_1", "f_entrada_1", "f_valor_1",
  "f_ativo_nome", "f_ativo_parcela", "f_ativo_taxa", "f_ativo_prazo",
  "f_ativo_entrada", "f_ativo_valor", "vc_financeira_nome",
  // Cliente
  "cliente_nome", "vc_nome", "cliente_celular", "cliente_email",
  "cliente_cnpj_cpf", "cliente_empresa", "cliente_cep",
  "cliente_endereco", "cliente_numero", "cliente_complemento",
  "cliente_bairro", "cliente_cidade", "cliente_estado",
  // Comercial
  "consultor_nome", "responsavel_nome", "consultor_telefone", "consultor_email",
  "empresa_nome", "proposta_data", "proposta_titulo", "proposta_validade",
  // Conta energia
  "co2_evitado_ano", "gasto_atual_mensal", "economia_percentual",
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
