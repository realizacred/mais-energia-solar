/**
 * Domain resolver: cliente.* + comercial.* + conta_energia.* + premissas.*
 * Sources: snapshot.cliente, ext.cliente, ext.lead, ext.consultor, ext.tenantNome
 */
import { type AnyObj, safeObj, safeArr, str, num, fmtNum, fmtCur, fmtVal, type ResolverExternalContext } from "./types.ts";

/** Format CPF (11 digits) or CNPJ (14 digits) with punctuation */
function formatCpfCnpj(v: string | null | undefined): string {
  if (!v) return "";
  const digits = String(v).replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return String(v);
}

/** Format phone number (10 or 11 digits) with punctuation */
function formatPhone(v: string | null | undefined): string {
  if (!v) return "";
  const digits = String(v).replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return String(v);
}

// ── Data por extenso (PT-BR) ──
const MESES_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const UNIDADES_EXT = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS_EXT = ["", "", "vinte", "trinta"];

function numExtenso(n: number): string {
  if (n < 20) return UNIDADES_EXT[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u > 0 ? `${DEZENAS_EXT[d]} e ${UNIDADES_EXT[u]}` : DEZENAS_EXT[d];
}

function dataHojeExtenso(d: Date): string {
  const dia = d.getDate();
  const mes = d.getMonth();
  const ano = d.getFullYear();
  const diaStr = numExtenso(dia);
  const mesStr = MESES_EXTENSO[mes];
  const milhar = Math.floor(ano / 1000);
  const resto = ano % 1000;
  const centena = Math.floor(resto / 100);
  const dezena = resto % 100;
  const anoPartes: string[] = [];
  if (milhar === 2) anoPartes.push("dois mil");
  else if (milhar === 1) anoPartes.push("mil");
  if (centena > 0 || dezena > 0) {
    if (dezena < 20 && dezena > 0 && centena === 0) {
      anoPartes.push(UNIDADES_EXT[dezena]);
    } else {
      if (centena > 0) anoPartes.push(["", "cento", "duzentos"][centena] || String(centena * 100));
      if (dezena > 0) anoPartes.push(numExtenso(dezena));
    }
  }
  return `${diaStr} de ${mesStr} de ${anoPartes.join(" e ")}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Format date in pt-BR locale */
function fmtDate(v: unknown): string | undefined {
  if (!v) return undefined;
  try {
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return undefined;
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch { return undefined; }
}

export function resolveClienteComercial(
  snapshot: AnyObj | null | undefined,
  ext?: ResolverExternalContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  const snap = snapshot ?? {};
  const snapCliente = safeObj(snap.cliente);
  const lead = ext?.lead ?? {};
  const cliente = ext?.cliente ?? {};
  const consultor = ext?.consultor ?? {};
  const versao = ext?.versaoData ?? {};
  const proposta = ext?.propostaData ?? {};
  const brand = ext?.brandSettings ?? {};
  const projeto = ext?.projetoData ?? {};
  const clienteData = ext?.clienteData ?? {};
  const deal = ext?.dealData ?? {};

  const set = (k: string, v: unknown) => {
    const s = str(v);
    if (s !== undefined && !out[k]) out[k] = s;
  };

  // ── Cliente ──
  const nomeCliente = str(cliente.nome) ?? str(lead.nome) ?? str(snapCliente.nome);
  set("cliente_nome", nomeCliente);
  set("vc_nome", nomeCliente);
  set("cliente_celular", formatPhone(str(cliente.telefone ?? lead.telefone ?? snapCliente.telefone)));
  set("cliente_email", cliente.email ?? snapCliente.email);
  set("cliente_cnpj_cpf", formatCpfCnpj(str(cliente.cpf_cnpj ?? snapCliente.cpf_cnpj)));
  set("cliente_empresa", cliente.empresa ?? snapCliente.empresa);
  set("cliente_cep", cliente.cep ?? lead.cep ?? snapCliente.cep);
  set("cliente_endereco", cliente.rua ?? lead.rua ?? snapCliente.rua);
  set("cliente_numero", cliente.numero ?? lead.numero ?? snapCliente.numero);
  set("cliente_complemento", cliente.complemento ?? snapCliente.complemento);
  set("cliente_bairro", cliente.bairro ?? lead.bairro ?? snapCliente.bairro);
  set("cliente_cidade", cliente.cidade ?? lead.cidade ?? snapCliente.cidade);
  set("cliente_estado", cliente.estado ?? lead.estado ?? snapCliente.estado);

  // ── Cliente (campos extras) ──
  set("cliente_data_nascimento", fmtDate(cliente.data_nascimento ?? clienteData.data_nascimento));
  set("cliente_observacoes", cliente.observacoes ?? clienteData.observacoes);
  const cpfCnpj = str(cliente.cpf_cnpj ?? clienteData.cpf_cnpj ?? snapCliente.cpf_cnpj);
  set("cliente_tipo_pessoa", cpfCnpj && cpfCnpj.length > 14 ? "PJ" : "PF");

  // ── Cliente (campos projeto/instalação — da tabela clientes) ──
  const cPotKwp = num(cliente.potencia_kwp ?? clienteData.potencia_kwp);
  if (cPotKwp != null) set("cliente_potencia_kwp", fmtNum(cPotKwp));
  const cValProjeto = num(cliente.valor_projeto ?? clienteData.valor_projeto);
  if (cValProjeto != null) set("cliente_valor_projeto", fmtVal(cValProjeto));
  set("cliente_data_instalacao", fmtDate(cliente.data_instalacao ?? clienteData.data_instalacao));
  const cNumPlacas = num(cliente.numero_placas ?? clienteData.numero_placas);
  if (cNumPlacas != null) set("cliente_numero_placas", String(cNumPlacas));
  set("cliente_modelo_inversor", cliente.modelo_inversor ?? clienteData.modelo_inversor);

  // ── Deal / Kanban ──
  set("deal_title", deal.title ?? snap.deal_title);
  set("deal_status", deal.status ?? snap.deal_status);
  set("deal_etiqueta", deal.etiqueta ?? snap.deal_etiqueta);
  set("deal_notas", deal.notas ?? snap.deal_notas);
  set("deal_expected_close_date", fmtDate(deal.expected_close_date ?? snap.deal_expected_close_date));

  // ── Comercial ──
  const now = new Date();
  set("proposta_data", now.toLocaleDateString("pt-BR"));
  set("proposta_titulo", proposta.titulo ?? nomeCliente);
  set("proposta_identificador", proposta.codigo);
  const validadeDias = num(versao.validade_dias) ?? 15;
  const validade = new Date(now.getTime() + validadeDias * 86400000);
  set("proposta_validade", validade.toLocaleDateString("pt-BR"));
  set("proposta_versao", versao.versao_numero);

  // QW9 — consultor from ext, then snapshot fallback
  const consultorNome = str(consultor.nome) ?? str(snap.consultor_nome)
    ?? str(snap.responsavel_nome) ?? str(ext?.tenantNome);
  set("responsavel_nome", consultorNome);
  set("consultor_nome", consultorNome);
  set("consultor_telefone", formatPhone(str(consultor.telefone ?? snap.consultor_telefone)));
  set("consultor_email", consultor.email ?? snap.consultor_email);
  set("responsavel_email", consultor.email ?? snap.responsavel_email ?? snap.consultor_email);
  set("responsavel_celular", formatPhone(str(consultor.telefone ?? snap.responsavel_celular ?? snap.consultor_telefone)));
  set("representante_nome", brand.representante_legal ?? snap.representante_nome);
  set("representante_email", snap.representante_email);
  set("representante_celular", snap.representante_celular);
  set("empresa_nome", ext?.tenantNome);

  // ── Proposta (metadados) ──
  set("proposta_status", proposta.status);
  set("proposta_aceita_at", fmtDate(proposta.accepted_at));
  set("proposta_enviada_at", fmtDate(proposta.sent_at));
  set("proposta_recusa_motivo", proposta.rejection_reason);
  set("proposta_recusada_at", fmtDate(proposta.rejected_at));
  set("proposta_viewed_at", fmtDate(proposta.viewed_at));
  set("proposta_versao_status", versao.status);
  set("proposta_output_docx_path", versao.docx_path);
  set("proposta_output_pdf_path", versao.pdf_path);
  const propostaNum = str(proposta.numero) ?? (str(proposta.id) ? String(proposta.id).substring(0, 8) : undefined);
  set("proposta_num", propostaNum);

  // ── Premissas da proposta ──
  set("proposta_inflacao_energetica", snap.inflacao_energetica);
  set("proposta_perda_eficiencia_anual", snap.perda_eficiencia_anual);
  set("proposta_sobredimensionamento", snap.sobredimensionamento);

  // ── Empresa (brand_settings + tenants) ──
  set("empresa_razao_social", ext?.tenantNome);
  set("empresa_nome_fantasia", ext?.tenantNome);
  set("empresa_cnpj", brand.cnpj ?? brand.cpf_cnpj);
  set("empresa_cnpj_cpf", brand.cnpj ?? brand.cpf_cnpj);
  set("empresa_cidade", brand.cidade);
  set("empresa_estado", brand.estado);
  set("empresa_logo_url", brand.logo_url);
  set("empresa_representante_legal", brand.representante_legal);
  set("empresa_representante_cpf", brand.representante_cpf);
  set("empresa_representante_cargo", brand.representante_cargo);

  // ── Consultor código ──
  set("consultor_codigo", consultor.codigo ?? consultor.slug ?? (consultor.id ? String(consultor.id).substring(0, 8) : undefined));

  // ── Proposta links ──
  const baseUrl = Deno.env.get("APP_URL") ?? "https://app.maisenergiasolar.com.br";
  const tokenPublico = str(versao.token_publico) ?? str(proposta.token_publico);
  if (tokenPublico) {
    set("proposta_link", `${baseUrl}/pl/${tokenPublico}`);
    set("proposta_link_interativo", `${baseUrl}/pl/${tokenPublico}`);
  }

  // ── Projeto ──
  set("projeto_id_externo", snap.projeto_id_externo);
  const valorKit = num(snap.valor_kit);
  if (valorKit != null) set("projeto_valor_equipamentos", fmtVal(valorKit));
  const valorInst = num(snap.valor_instalacao);
  if (valorInst != null) set("projeto_valor_mao_obra", fmtVal(valorInst));
  set("projeto_data_venda", fmtDate(projeto.created_at ?? projeto.data_venda));
  set("projeto_data_instalacao", fmtDate(projeto.data_instalacao ?? clienteData.data_instalacao));
  set("projeto_status", projeto.status);
  set("projeto_observacoes", snap.observacoes ?? projeto.observacoes);
  set("projeto_tipo_instalacao", projeto.tipo_instalacao ?? snap.tipo_instalacao);
  set("projeto_codigo", projeto.codigo);
  set("projeto_data_comissionamento", fmtDate(projeto.data_comissionamento));
  set("projeto_prazo_estimado_dias", projeto.prazo_estimado_dias);
  set("projeto_prazo_vistoria_dias", projeto.prazo_vistoria_dias);
  set("projeto_lat_instalacao", projeto.lat_instalacao);
  set("projeto_lon_instalacao", projeto.lon_instalacao);

  // ── Projeto (endereço de instalação) ──
  set("projeto_rua_instalacao", projeto.rua_instalacao ?? lead.rua ?? snapCliente.rua);
  set("projeto_numero_instalacao", projeto.numero_instalacao ?? lead.numero ?? snapCliente.numero);
  set("projeto_complemento_instalacao", projeto.complemento_instalacao ?? lead.complemento ?? snapCliente.complemento);
  set("projeto_bairro_instalacao", projeto.bairro_instalacao ?? lead.bairro ?? snapCliente.bairro);
  set("projeto_cidade_instalacao", projeto.cidade_instalacao ?? lead.cidade ?? snapCliente.cidade);
  set("projeto_estado_instalacao", projeto.uf_instalacao ?? lead.estado ?? snapCliente.estado);
  set("projeto_uf_instalacao", projeto.uf_instalacao ?? lead.estado ?? snapCliente.estado);
  set("projeto_cep_instalacao", projeto.cep_instalacao ?? lead.cep ?? snapCliente.cep);

  // ── Custom fields from snapshot (cap_*, pre_*, pos_*) ──
  const customFieldValues = safeObj(snap.customFieldValues ?? snap.custom_field_values);
  for (const [cfKey, cfVal] of Object.entries(customFieldValues)) {
    if (cfVal == null || cfVal === "") continue;
    if (Array.isArray(cfVal)) {
      const joined = cfVal.filter((v: unknown) => v != null && v !== "").join(", ");
      if (joined) set(cfKey, joined);
    } else if (typeof cfVal !== "object") {
      set(cfKey, String(cfVal));
    }
  }

  // ── Proposta (metadados complementares) ──
  set("proposta_versao_atual", proposta.versao_atual ?? versao.versao_numero);
  set("proposta_enviado_em", fmtDate(versao.enviado_em ?? proposta.sent_at));
  set("proposta_aceito_em", fmtDate(versao.aceito_em ?? proposta.accepted_at));
  set("proposta_rejeitado_em", fmtDate(versao.rejeitado_em ?? proposta.rejected_at));
  set("proposta_motivo_rejeicao", versao.motivo_rejeicao ?? proposta.rejection_reason);
  set("proposta_observacoes", versao.observacoes ?? snap.observacoes ?? snap.vc_observacao);

  // proposta_valido_ate — data de validade
  const validadeDias2 = num(versao.validade_dias) ?? 15;
  if (versao.valido_ate) {
    set("proposta_valido_ate", fmtDate(versao.valido_ate));
  } else {
    const dataVal = new Date();
    dataVal.setDate(dataVal.getDate() + validadeDias2);
    set("proposta_valido_ate", dataVal.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }));
  }

  // ── CO₂ evitado (simulação) ──
  const geracaoMensalCo2 = num(snap.geracao_mensal);
  if (geracaoMensalCo2 != null) {
    const co2Kg = geracaoMensalCo2 * 12 * 0.075;
    set("simulacao_co2_evitado_kg", fmtNum(co2Kg, 0));
  }

  // Pagamento (from pagamento_opcoes array)
  const pagOpcoes = safeArr(snap.pagamentoOpcoes ?? snap.pagamento_opcoes);
  if (pagOpcoes.length > 0) {
    const pag0 = pagOpcoes[0];
    set("projeto_forma_pagamento", pag0.tipo);
    const entradaVal = num(pag0.entrada_valor);
    if (entradaVal != null) set("projeto_valor_entrada", fmtVal(entradaVal));
    set("projeto_numero_parcelas", pag0.parcelas);
    const parcelaVal = num(pag0.valor_parcela);
    if (parcelaVal != null) set("projeto_valor_parcela", fmtVal(parcelaVal));

    // Valor financiado = valor_total - entrada_valor
    const vTotal = num(snap.valor_total);
    if (vTotal != null && entradaVal != null) {
      set("projeto_valor_financiado", fmtVal(vTotal - entradaVal));
    }
  }

  // ── Concessionária ──
  set("concessionaria_sigla", snap.dis_energia);
  set("concessionaria_estado", snap.estado);
  const fioB = num(snap.fio_b_usado_kwh);
  if (fioB != null) set("concessionaria_tarifa_fio_b", fmtVal(fioB, 4));
  set("concessionaria_custo_disponibilidade_monofasico", snap.custo_disponibilidade_kwh);
  set("concessionaria_custo_disponibilidade_bifasico", snap.custo_disponibilidade_kwh);
  set("concessionaria_custo_disponibilidade_trifasico", snap.custo_disponibilidade_kwh);
  const impostoEnergia = num(snap.imposto_energia);
  if (impostoEnergia != null) set("concessionaria_aliquota_icms", fmtVal(impostoEnergia));
  // Isenção SCEE derivada da regra GD
  const gdRegra = safeObj(snap.gd);
  set("concessionaria_possui_isencao_scee", gdRegra.regra ? "Sim" : "Não");
  set("concessionaria_percentual_isencao", gdRegra.percentual_isencao ?? snap.percentual_isencao);

  // ── Simulação ──
  set("simulacao_tipo_conta", snap.subgrupo ?? "BT");

  // ── Conta de Energia ──
  const contaFields = [
    "gasto_atual_mensal", "gasto_com_solar_mensal", "economia_percentual",
    "creditos_mensal", "tarifa_atual", "imposto_percentual", "bandeira_tarifaria",
    "custo_disponibilidade_valor", "gasto_energia_mensal_atual", "gasto_energia_mensal_novo",
    "gasto_energia_mensal_bt_atual", "gasto_energia_mensal_bt_novo",
    "gasto_energia_mensal_p_atual", "gasto_energia_mensal_p_novo",
    "gasto_energia_mensal_fp_atual", "gasto_energia_mensal_fp_novo",
    "gasto_demanda_mensal_atual", "gasto_demanda_mensal_novo",
    "economia_energia_mensal", "economia_energia_mensal_p",
    "economia_demanda_mensal", "economia_demanda_mensal_p",
    "gasto_total_mensal_atual", "gasto_total_mensal_novo",
    "economia_mensal", "economia_mensal_p",
    "creditos_alocados", "consumo_abatido",
    "consumo_abatido_p", "consumo_abatido_fp",
    "valor_imposto_energia",
    "tarifacao_energia_compensada_bt", "tarifacao_energia_compensada_fp", "tarifacao_energia_compensada_p",
  ];
  for (const k of contaFields) set(k, snap[k]);
  for (const m of MESES) {
    set(`creditos_${m}`, snap[`creditos_${m}`]);
    set(`creditos_alocados_${m}`, snap[`creditos_alocados_${m}`]);
  }

  // CO2
  const geracaoMensal = num(snap.geracao_mensal);
  if (geracaoMensal != null) {
    const co2Kg = geracaoMensal * 12 * 0.075;
    set("co2_evitado_ano", fmtNum(co2Kg, 0));
  }

  // ── Premissas ──
  for (const k of ["inflacao_energetica", "inflacao_ipca", "imposto", "vpl_taxa_desconto",
    "perda_eficiencia_anual", "troca_inversor", "troca_inversor_custo",
    "sobredimensionamento", "vida_util_sistema"]) {
    set(k, snap[k]);
  }

  // ── Observações ──
  set("vc_observacao", lead.observacoes ?? snap.vc_observacao ?? snap.observacoes);

  // ── Ghost Group 1 — Empresa extras (brand_settings / tenants) ──
  set("descricao", snap.descricaoProposta ?? snap.descricao ?? safeObj(snap._wizard_state).descricaoProposta ?? proposta.descricao);
  set("proposta_data_envio", fmtDate(proposta.created_at ?? versao.created_at ?? proposta.sent_at));
  set("proposta_codigo", proposta.codigo ?? (proposta.id ? String(proposta.id).substring(0, 8) : undefined));
  set("titulo", snap.proposta_titulo ?? proposta.titulo);
  set("empresa_cep", brand.cep);
  set("empresa_bairro", brand.bairro);
  set("empresa_numero", brand.numero);
  set("empresa_complemento", brand.complemento);
  set("empresa_inscricao_estadual", brand.inscricao_estadual ?? brand.ie);
  set("empresa_inscricao_municipal", brand.inscricao_municipal ?? brand.im);
  set("empresa_endereco", brand.endereco ?? brand.rua);
  set("empresa_telefone", formatPhone(str(brand.telefone)));
  set("empresa_email", brand.email);
  set("empresa_documento", brand.cnpj ?? brand.cpf_cnpj);
  set("empresa_ie", brand.inscricao_estadual ?? brand.ie);

  // ── Ghost Group 2 — Cliente extras ──
  set("cliente_rg", cliente.rg ?? clienteData.rg ?? snapCliente.rg ?? snap.cliente_rg);
  set("cliente_estado_civil", cliente.estado_civil ?? clienteData.estado_civil ?? snap.cliente_estado_civil);
  set("cliente_nacionalidade", cliente.nacionalidade ?? clienteData.nacionalidade ?? snap.cliente_nacionalidade);
  set("cliente_profissao", cliente.profissao ?? clienteData.profissao ?? snap.cliente_profissao);
  set("cliente_telefone", formatPhone(str(cliente.telefone ?? lead.telefone ?? snapCliente.telefone)));
  set("cliente_cpf_cnpj", formatCpfCnpj(str(cliente.cpf_cnpj ?? snapCliente.cpf_cnpj)));
  set("cliente_rua", cliente.rua ?? snapCliente.rua);
  set("cliente_codigo", cliente.cliente_code ?? clienteData.cliente_code);

  // ── Ghost Group 3 — Data/Hora ──
  const agora = new Date();
  const optsDateBR: Intl.DateTimeFormatOptions = {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric"
  };
  set("data_hoje", agora.toLocaleDateString("pt-BR", optsDateBR));
  set("data_hoje_extenso", dataHojeExtenso(agora));

  // ── Ghost Group 4 — Projeto extras ──
  const endProj = [projeto.rua_instalacao, projeto.numero_instalacao].filter(Boolean).join(", ");
  set("projeto_endereco", endProj || projeto.endereco);
  set("projeto_bairro", projeto.bairro_instalacao);
  set("projeto_cidade", projeto.cidade_instalacao);
  set("projeto_estado", projeto.uf_instalacao);
  set("projeto_cep", projeto.cep_instalacao);
  set("projeto_numero", projeto.projeto_num ?? projeto.codigo);
  set("projeto_valor_equipamentos", (() => { const v = num(projeto.valor_equipamentos); return v != null ? fmtVal(v) : undefined; })());
  set("projeto_valor_mao_obra", (() => { const v = num(projeto.valor_mao_obra); return v != null ? fmtVal(v) : undefined; })());
  set("projeto_data_previsao_instalacao", fmtDate(projeto.data_previsao_instalacao));
  set("projeto_area_util", (() => { const v = num(projeto.area_util_m2); return v != null ? fmtNum(v, 1) : undefined; })());
  set("projeto_geracao_mensal", (() => { const v = num(projeto.geracao_mensal_media_kwh); return v != null ? fmtNum(v, 0) : undefined; })());
  set("projeto_forma_pagamento", projeto.forma_pagamento);
  set("projeto_valor_entrada", (() => { const v = num(projeto.valor_entrada); return v != null ? fmtVal(v) : undefined; })());
  set("projeto_numero_parcelas", projeto.numero_parcelas);
  set("projeto_valor_parcela", (() => { const v = num(projeto.valor_parcela); return v != null ? fmtVal(v) : undefined; })());

  // ── Ghost Group 5 — Garantia serviço ──
  set("servico_garantia", snap.garantia_servico ?? snap.kit_garantia_servico);
  set("kit_garantia_servico", snap.garantia_servico ?? snap.kit_garantia_servico);

  // ── Concessionária extras ──
  set("concessionaria_icms", (() => { const v = num(snap.imposto_energia ?? snap.aliquota_icms); return v != null ? fmtNum(v, 2) : undefined; })());
  set("concessionaria_fio_b_gd", (() => { const v = num(snap.fio_b_usado_kwh ?? snap.tarifa_fio_b_gd); return v != null ? fmtNum(v, 4) : undefined; })());

  // ── Custom variables from snapshot ──
  if (Array.isArray(snap.variaveis_custom)) {
    for (const vc of snap.variaveis_custom as Array<AnyObj>) {
      if (vc.nome && vc.valor_calculado != null) {
        set(String(vc.nome), vc.valor_calculado);
      }
    }
  }

  return out;
}
