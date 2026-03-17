/**
 * Known keys resolved in each layer of the system.
 *
 * FRONTEND_RESOLVER_KEYS: ONLY keys with EXPLICIT switch-case handling
 * in resolveProposalVariables.ts. Keys resolved via the universal
 * finalSnapshot fallback (deepGet) do NOT need to be listed here —
 * the audit classifier honors `frontendHasFinalSnapshotFallback`.
 *
 * BACKEND_FLATTEN_KEYS: Keys explicitly set by domain resolvers in
 * the backend (flattenSnapshot → resolveAllVariables).
 */

// ── Frontend resolver: keys with EXPLICIT handling in resolveProposalVariables.ts ──
// Verified against source on 2026-03-17.
// DO NOT add keys here just to make audit pass — that's a gambiarra.
// The classifier uses `frontendHasFinalSnapshotFallback` for the rest.
export const FRONTEND_RESOLVER_KEYS = new Set<string>([
  // ── Tarifa (9 explicit cases) ──
  "tarifa.te_kwh", "tarifa.tusd_total_kwh", "tarifa.fio_b_real_kwh",
  "tarifa.fio_b_usado_kwh", "tarifa.precisao", "tarifa.precisao_motivo",
  "tarifa.origem", "tarifa.vigencia_inicio", "tarifa.vigencia_fim",

  // ── ANEEL (3 explicit cases) ──
  "aneel.last_sync_at", "aneel.run_id", "aneel.snapshot_hash_curto",

  // ── GD (4 explicit cases) ──
  "gd.regra", "gd.ano_aplicado", "gd.fio_b_percent_cobrado", "gd.fio_b_percent_compensado",

  // ── Cálculo (8 explicit cases) ──
  "calculo.consumo_mensal_kwh", "calculo.custo_disponibilidade_kwh",
  "calculo.consumo_compensavel_kwh", "calculo.geracao_mensal_kwh",
  "calculo.energia_compensada_kwh", "calculo.valor_credito_kwh",
  "calculo.economia_mensal_rs", "alerta.estimado.texto_pdf",

  // ── Cliente (8 explicit cases) ──
  "cliente.nome", "cliente.empresa", "cliente.cnpj_cpf", "cliente.email",
  "cliente.celular", "cliente.endereco", "cliente.cidade", "cliente.estado",
  "cliente.bairro", "cliente.cep",

  // ── Comercial (2 explicit cases) ──
  "comercial.responsavel_nome", "comercial.empresa_nome",

  // ── Entrada (11 explicit cases) ──
  "entrada.consumo_mensal", "entrada.dis_energia",
  "entrada.estado", "entrada.cidade", "entrada.fase",
  "entrada.tipo_telhado", "entrada.tarifa_distribuidora",
  "entrada.custo_disponibilidade_kwh", "entrada.tensao_rede",
  "entrada.tipo_sistema",

  // ── Sistema Solar (9 explicit cases from kit items) ──
  "sistema_solar.potencia_sistema", "sistema_solar.geracao_mensal",
  "sistema_solar.numero_modulos",
  "sistema_solar.modulo_fabricante", "sistema_solar.modulo_modelo",
  "sistema_solar.modulo_potencia", "sistema_solar.modulo_quantidade",
  "sistema_solar.inversor_fabricante", "sistema_solar.inversor_fabricante_1",
  "sistema_solar.inversor_modelo", "sistema_solar.inversor_potencia_nominal",
  "sistema_solar.inversor_quantidade",

  // ── Financeiro (~30 explicit cases) ──
  "financeiro.preco_total", "financeiro.preco", "financeiro.preco_final", "financeiro.valor_total",
  "financeiro.economia_mensal", "financeiro.economia_anual", "financeiro.economia_25_anos",
  "financeiro.payback_anos", "financeiro.payback_meses",
  "financeiro.preco_kwp", "financeiro.preco_watt",
  "financeiro.modulo_custo_un", "financeiro.modulo_preco_un",
  "financeiro.modulo_custo_total", "financeiro.modulo_preco_total",
  "financeiro.inversor_custo_un", "financeiro.inversor_preco_un",
  "financeiro.inversor_custo_total", "financeiro.inversor_preco_total",
  "financeiro.f_ativo_nome", "financeiro.f_ativo_parcela",
  "financeiro.f_ativo_taxa", "financeiro.f_ativo_prazo",
  "financeiro.f_ativo_entrada", "financeiro.f_ativo_valor",

  // ── Conta Energia (3 explicit cases) ──
  "conta_energia.co2_evitado_ano", "conta_energia.gasto_atual_mensal",
  "conta_energia.economia_percentual",

  // ── Customizada (explicit cases from pagamento opcoes) ──
  "customizada.vc_financeira_nome", "customizada.vc_nome",
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
