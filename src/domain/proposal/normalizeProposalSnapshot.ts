/**
 * normalizeProposalSnapshot.ts
 * 
 * Adapter canônico para normalizar snapshots de proposta.
 * SSOT: todo componente que precisa ler dados do snapshot DEVE usar este adapter.
 * 
 * Regras:
 * - Números NUNCA são undefined (fallback 0)
 * - Strings NUNCA são undefined (fallback "")
 * - Arrays NUNCA são undefined (fallback [])
 * - Converte string → number quando necessário
 * - Suporta camelCase e snake_case (fallback duplo)
 */

// ─── Helper: safe number ──────────────────────────────────
function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return isNaN(n) ? fallback : n;
}

function str(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function arr<T = any>(v: unknown, fallback: T[] = []): T[] {
  return Array.isArray(v) ? v : fallback;
}

function pick<T>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k] as T;
  }
  return undefined;
}

// ─── Kit Item normalizado ─────────────────────────────────
export interface NormalizedKitItem {
  id: string;
  descricao: string;
  fabricante: string;
  modelo: string;
  potencia_w: number;
  quantidade: number;
  preco_unitario: number;
  categoria: string;
  avulso: boolean;
  produto_ref: string | null;
}

// ─── Serviço normalizado ──────────────────────────────────
export interface NormalizedServico {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  incluso_no_preco: boolean;
}

// ─── Pagamento normalizado ────────────────────────────────
export interface NormalizedPagamento {
  id: string;
  nome: string;
  tipo: string;
  valor_financiado: number;
  entrada: number;
  taxa_mensal: number;
  carencia_meses: number;
  num_parcelas: number;
  valor_parcela: number;
}

// ─── UC normalizada ───────────────────────────────────────
export interface NormalizedUC {
  id: string;
  nome: string;
  is_geradora: boolean;
  consumo_mensal: number;
  consumo_mensal_p: number;
  consumo_mensal_fp: number;
  tarifa_distribuidora: number;
  taxa_desempenho: number;
  inclinacao: number;
  desvio_azimutal: number;
  geracao_mensal_estimada: number;
}

// ─── Venda normalizada ────────────────────────────────────
export interface NormalizedVenda {
  custo_kit: number;
  custo_instalacao: number;
  custo_comissao: number;
  custo_outros: number;
  margem_percentual: number;
  desconto_percentual: number;
  observacoes: string;
}

// ─── Snapshot Normalizado (output) ────────────────────────
export interface NormalizedProposalSnapshot {
  // Localização
  locEstado: string;
  locCidade: string;
  locTipoTelhado: string;
  locDistribuidoraNome: string;
  locDistribuidoraId: string;
  locIrradiacao: number;
  locLatitude: number;
  locLongitude: number;

  // Cliente
  clienteNome: string;
  clienteEmpresa: string;
  clienteCelular: string;
  clienteEmail: string;
  clienteCpfCnpj: string;

  // Sistema
  potenciaKwp: number;
  geracaoMensalEstimada: number;
  grupo: string;

  // Área
  areaUtil: number;       // m² — área útil (snapshot ou calculada: módulos × dimensões)
  areaNecessaria: number;  // m² — área necessária para instalação

  // Kit
  itens: NormalizedKitItem[];
  custoKit: number;

  // Serviços
  servicos: NormalizedServico[];
  custoServicos: number;

  // Venda
  venda: NormalizedVenda;

  // Pagamento
  pagamentoOpcoes: NormalizedPagamento[];

  // UCs
  ucs: NormalizedUC[];
  consumoTotal: number;

  // Premissas
  premissas: {
    imposto: number;
    inflacao_energetica: number;
    inflacao_ipca: number;
    perda_eficiencia_anual: number;
    sobredimensionamento: number;
    troca_inversor_anos: number;
    troca_inversor_custo: number;
    vpl_taxa_desconto: number;
  };

  // Financeiro (calculado pelo engine ou snapshot)
  economiaMensal: number;
  paybackMeses: number;
  tir: number;
  vpl: number;

  // Gastos comparativos (snapshot do engine)
  gastoEnergiaSem: number;
  gastoEnergiaCom: number;
  gastoDemandaSem: number;
  gastoDemandaCom: number;
  outrosEncargosSem: number;
  outrosEncargosCom: number;

  // Metadata
  templateSelecionado: string;
  nomeProposta: string;
  descricaoProposta: string;

  // Raw snapshot for pass-through to engine (edge function)
  _raw: Record<string, unknown>;
}

// ─── Normalizar item de kit ───────────────────────────────
function normalizeKitItem(raw: any): NormalizedKitItem {
  return {
    id: str(raw.id, crypto.randomUUID()),
    descricao: str(raw.descricao),
    fabricante: str(raw.fabricante),
    modelo: str(raw.modelo),
    potencia_w: num(raw.potencia_w),
    quantidade: num(raw.quantidade, 1),
    preco_unitario: num(raw.preco_unitario),
    categoria: str(raw.categoria, "outros"),
    avulso: !!raw.avulso,
    produto_ref: raw.produto_ref ?? null,
  };
}

function normalizeServico(raw: any): NormalizedServico {
  return {
    id: str(raw.id, crypto.randomUUID()),
    descricao: str(raw.descricao),
    categoria: str(raw.categoria),
    valor: num(raw.valor),
    incluso_no_preco: !!raw.incluso_no_preco,
  };
}

function normalizePagamento(raw: any): NormalizedPagamento {
  return {
    id: str(raw.id, crypto.randomUUID()),
    nome: str(raw.nome),
    tipo: str(raw.tipo, "outro"),
    valor_financiado: num(raw.valor_financiado),
    entrada: num(raw.entrada),
    taxa_mensal: num(raw.taxa_mensal),
    carencia_meses: num(raw.carencia_meses),
    num_parcelas: num(raw.num_parcelas),
    valor_parcela: num(raw.valor_parcela),
  };
}

function normalizeUC(raw: any): NormalizedUC {
  return {
    id: str(raw.id, crypto.randomUUID()),
    nome: str(raw.nome),
    is_geradora: !!raw.is_geradora,
    consumo_mensal: num(raw.consumo_mensal),
    consumo_mensal_p: num(raw.consumo_mensal_p),
    consumo_mensal_fp: num(raw.consumo_mensal_fp),
    tarifa_distribuidora: num(raw.tarifa_distribuidora),
    taxa_desempenho: num(raw.taxa_desempenho, 80),
    inclinacao: num(raw.inclinacao),
    desvio_azimutal: num(raw.desvio_azimutal),
    geracao_mensal_estimada: num(raw.geracao_mensal_estimada),
  };
}

// ─── Função principal ─────────────────────────────────────
export function normalizeProposalSnapshot(
  raw: Record<string, unknown> | null | undefined
): NormalizedProposalSnapshot {
  const s = (raw || {}) as Record<string, any>;

  // Cliente — suporta camelCase e objeto aninhado
  const cliente = s.cliente || {};
  // selectedLead — fallback from wizard snapshot (lead data saved alongside)
  const lead = s.selectedLead || {};

  // Itens
  const rawItens = arr(s.itens);
  const itens = rawItens.map(normalizeKitItem);
  const custoKit = itens.reduce((sum, i) => sum + i.quantidade * i.preco_unitario, 0);

  // Serviços
  const rawServicos = arr(s.servicos);
  const servicos = rawServicos.map(normalizeServico);
  const custoServicos = servicos
    .filter(sv => sv.incluso_no_preco)
    .reduce((sum, sv) => sum + sv.valor, 0);

  // Venda
  const rawVenda = s.venda || {};
  const venda: NormalizedVenda = {
    custo_kit: num(rawVenda.custo_kit),
    custo_instalacao: num(rawVenda.custo_instalacao),
    custo_comissao: num(rawVenda.custo_comissao),
    custo_outros: num(rawVenda.custo_outros),
    margem_percentual: num(rawVenda.margem_percentual),
    desconto_percentual: num(rawVenda.desconto_percentual),
    observacoes: str(rawVenda.observacoes),
  };

  // Pagamento (camelCase ou snake_case)
  const rawPagamento = arr(s.pagamentoOpcoes ?? s.pagamento_opcoes);
  const pagamentoOpcoes = rawPagamento.map(normalizePagamento);

  // UCs
  const rawUcs = arr(s.ucs);
  const ucs = rawUcs.map(normalizeUC);
  const consumoTotal = ucs.reduce(
    (sum, uc) => sum + (uc.consumo_mensal || uc.consumo_mensal_p + uc.consumo_mensal_fp),
    0
  );

  // Premissas
  const rawPrem = s.premissas || {};
  const premissas = {
    imposto: num(rawPrem.imposto),
    inflacao_energetica: num(rawPrem.inflacao_energetica, 6),
    inflacao_ipca: num(rawPrem.inflacao_ipca, 4.5),
    perda_eficiencia_anual: num(rawPrem.perda_eficiencia_anual, 0.5),
    sobredimensionamento: num(rawPrem.sobredimensionamento),
    troca_inversor_anos: num(rawPrem.troca_inversor_anos, 12),
    troca_inversor_custo: num(rawPrem.troca_inversor_custo),
    vpl_taxa_desconto: num(rawPrem.vpl_taxa_desconto, 8),
  };

  // Potência — versão root > calculada dos itens
  let potenciaKwp = num(s.potenciaKwp ?? s.potencia_kwp);
  if (potenciaKwp === 0) {
    potenciaKwp = itens
      .filter(i => i.categoria === "modulo" || i.categoria === "modulos")
      .reduce((sum, m) => sum + (m.potencia_w * m.quantidade) / 1000, 0);
  }

  // Geração mensal — snapshot > UCs > fallback estimado
  let geracaoMensalEstimada = num(s.geracaoMensalEstimada ?? s.geracao_mensal_estimada);
  if (geracaoMensalEstimada === 0) {
    geracaoMensalEstimada = ucs.reduce((sum, uc) => sum + uc.geracao_mensal_estimada, 0);
  }
  const irradiacao = num(s.locIrradiacao ?? s.loc_irradiacao);
  if (geracaoMensalEstimada === 0 && potenciaKwp > 0 && irradiacao > 0) {
    const ucGeradora = ucs.find(uc => uc.is_geradora);
    const pr = (ucGeradora?.taxa_desempenho ?? 80) / 100;
    geracaoMensalEstimada = Math.round(potenciaKwp * irradiacao * 30 * pr);
  }

  return {
    // Localização — fallback: selectedLead data from wizard
    locEstado: str(s.locEstado ?? s.loc_estado ?? lead.estado),
    locCidade: str(s.locCidade ?? s.loc_cidade ?? lead.cidade),
    locTipoTelhado: str(s.locTipoTelhado ?? s.loc_tipo_telhado ?? lead.tipo_telhado),
    locDistribuidoraNome: str(s.locDistribuidoraNome ?? s.loc_distribuidora_nome),
    locDistribuidoraId: str(s.locDistribuidoraId ?? s.loc_distribuidora_id),
    locIrradiacao: irradiacao,
    locLatitude: num(s.locLatitude ?? s.loc_latitude),
    locLongitude: num(s.locLongitude ?? s.loc_longitude),

    // Cliente — fallback chain: cliente obj → top-level camelCase → selectedLead
    clienteNome: str(cliente.nome ?? s.clienteNome ?? s.cliente_nome ?? lead.nome),
    clienteEmpresa: str(cliente.empresa ?? s.clienteEmpresa ?? s.cliente_empresa),
    clienteCelular: str(cliente.celular ?? s.clienteCelular ?? s.cliente_celular ?? lead.telefone),
    clienteEmail: str(cliente.email ?? s.clienteEmail ?? s.cliente_email ?? lead.email),
    clienteCpfCnpj: str(cliente.cnpj_cpf ?? s.clienteCpfCnpj ?? s.cliente_cpf_cnpj ?? lead.cpf_cnpj),

    // Sistema
    potenciaKwp,
    geracaoMensalEstimada,
    grupo: str(s.grupo, "B"),

    // Kit
    itens,
    custoKit,

    // Serviços
    servicos,
    custoServicos,

    // Venda
    venda,

    // Pagamento
    pagamentoOpcoes,

    // UCs
    ucs,
    consumoTotal,

    // Premissas
    premissas,

    // Financeiro
    economiaMensal: num(s.economiaMensal ?? s.economia_mensal),
    paybackMeses: num(s.paybackMeses ?? s.payback_meses),
    tir: num(s.tir),
    vpl: num(s.vpl),

    // Gastos comparativos
    gastoEnergiaSem: num(s.gastoEnergiaSem ?? s.gasto_energia_sem),
    gastoEnergiaCom: num(s.gastoEnergiaCom ?? s.gasto_energia_com),
    gastoDemandaSem: num(s.gastoDemandaSem ?? s.gasto_demanda_sem),
    gastoDemandaCom: num(s.gastoDemandaCom ?? s.gasto_demanda_com),
    outrosEncargosSem: num(s.outrosEncargosSem ?? s.outros_encargos_sem),
    outrosEncargosCom: num(s.outrosEncargosCom ?? s.outros_encargos_com),

    // Metadata
    templateSelecionado: str(s.templateSelecionado ?? s.template_selecionado),
    nomeProposta: str(s.nomeProposta ?? s.nome_proposta),
    descricaoProposta: str(s.descricaoProposta ?? s.descricao_proposta),

    // Raw
    _raw: s,
  };
}
