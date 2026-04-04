/**
 * Domain resolver: cliente.* + comercial.* + conta_energia.* + premissas.*
 * Sources: snapshot.cliente, ext.cliente, ext.lead, ext.consultor, ext.tenantNome
 */
import { type AnyObj, safeObj, safeArr, str, num, fmtNum, fmtCur, fmtVal, type ResolverExternalContext } from "./types.ts";

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

  const set = (k: string, v: unknown) => {
    const s = str(v);
    if (s && !out[k]) out[k] = s;
  };

  // ── Cliente ──
  const nomeCliente = str(cliente.nome) ?? str(lead.nome) ?? str(snapCliente.nome);
  set("cliente_nome", nomeCliente);
  set("vc_nome", nomeCliente);
  set("cliente_celular", cliente.telefone ?? lead.telefone ?? snapCliente.telefone);
  set("cliente_email", cliente.email ?? snapCliente.email);
  set("cliente_cnpj_cpf", cliente.cpf_cnpj ?? snapCliente.cpf_cnpj);
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
  set("consultor_telefone", consultor.telefone ?? snap.consultor_telefone);
  set("consultor_email", consultor.email ?? snap.consultor_email);
  set("responsavel_email", consultor.email ?? snap.responsavel_email ?? snap.consultor_email);
  set("responsavel_celular", consultor.telefone ?? snap.responsavel_celular ?? snap.consultor_telefone);
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
  set("projeto_data_venda", fmtDate(projeto.created_at));
  set("projeto_data_instalacao", fmtDate(clienteData.data_instalacao));
  set("projeto_status", projeto.status);
  set("projeto_observacoes", snap.observacoes ?? projeto.observacoes);

  // ── Projeto (endereço de instalação) ──
  set("projeto_rua_instalacao", projeto.rua_instalacao ?? lead.rua ?? snapCliente.rua);
  set("projeto_numero_instalacao", projeto.numero_instalacao ?? lead.numero ?? snapCliente.numero);
  set("projeto_complemento_instalacao", projeto.complemento_instalacao ?? lead.complemento ?? snapCliente.complemento);
  set("projeto_bairro_instalacao", projeto.bairro_instalacao ?? lead.bairro ?? snapCliente.bairro);
  set("projeto_cidade_instalacao", projeto.cidade_instalacao ?? lead.cidade ?? snapCliente.cidade);
  set("projeto_uf_instalacao", projeto.uf_instalacao ?? lead.estado ?? snapCliente.estado);
  set("projeto_cep_instalacao", projeto.cep_instalacao ?? lead.cep ?? snapCliente.cep);

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
