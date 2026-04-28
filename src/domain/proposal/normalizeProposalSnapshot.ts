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

// ─── Adapter: snapshot SolarMarket → shape canônico ───────
/**
 * Detecta snapshots importados do SolarMarket (shape diferente do nativo) e
 * remapeia para o formato esperado pelo normalizer.
 *
 * Shape SM detectado por:
 *   - source === "solar_market" / "solarmarket"
 *   - OU presença de kit.itens[] com chaves "qnt"/"unitCost"/"item"/"category"
 *
 * Mapeamentos:
 *   kit.itens[].{qnt,item,unitCost,category} → itens[].{quantidade,descricao,preco_unitario,categoria}
 *   cliente.endereco.{cidade,estado}         → loc_cidade / loc_estado
 *   geracao.{potencia_kwp,geracao_mensal}    → potencia_kwp / geracao_mensal_estimada
 */
function adaptSmSnapshot(s: Record<string, any>): Record<string, any> {
  const kitItens = Array.isArray(s?.kit?.itens) ? s.kit.itens : [];
  const looksLikeSm =
    s?.source === "solar_market" ||
    s?.source === "solarmarket" ||
    (kitItens.length > 0 && kitItens[0] && (
      "qnt" in kitItens[0] ||
      "unitCost" in kitItens[0] ||
      ("item" in kitItens[0] && "category" in kitItens[0])
    ));

  if (!looksLikeSm) return s;

  // Já adaptado anteriormente? Evitar duplo trabalho.
  if (Array.isArray(s.itens) && s.itens.length > 0) return s;

  // Mapear categorias SM → nativas
  const mapCategoria = (c: unknown): string => {
    const v = String(c || "").toLowerCase().trim();
    if (v === "módulo" || v === "modulo" || v === "modulos" || v === "módulos") return "modulo";
    if (v === "inversor" || v === "inversores") return "inversor";
    if (v === "kit" || v === "kti") return "kit";
    if (v === "instalação" || v === "instalacao" || v === "mão de obra" || v === "mao de obra") return "servico";
    return v || "outros";
  };

  const itens = kitItens.map((it: any) => {
    const desc = String(it.item || it.descricao || "").trim();
    // Tenta separar fabricante/modelo (ex: "OSDA ODA610-33V-MHDRZ" → "OSDA" + resto)
    const parts = desc.split(/\s+/);
    const fabricante = parts.length > 1 ? parts[0] : "";
    const modelo = parts.length > 1 ? parts.slice(1).join(" ") : desc;
    return {
      descricao: desc,
      fabricante,
      modelo,
      quantidade: Number(it.qnt ?? it.quantidade ?? 1),
      preco_unitario: Number(it.unitCost ?? it.preco_unitario ?? 0),
      potencia_w: Number(it.potencia_w ?? 0),
      categoria: mapCategoria(it.category ?? it.categoria),
      avulso: false,
      produto_ref: null,
    };
  });

  const endereco = s?.cliente?.endereco || {};
  const cliente = s?.cliente || {};
  const geracao = s?.geracao || {};

  return {
    ...s,
    // Itens canônicos
    itens,
    // Localização vinda do endereço do cliente (snapshot SM)
    loc_cidade: s.loc_cidade ?? endereco.cidade ?? s.locCidade ?? "",
    loc_estado: s.loc_estado ?? endereco.estado ?? s.locEstado ?? "",
    // Cliente: garantir campos top-level usados pelo normalizer
    cliente: {
      ...cliente,
      celular: cliente.celular ?? cliente.telefone,
      cnpj_cpf: cliente.cnpj_cpf ?? cliente.cpf_cnpj ?? cliente.documento,
    },
    // Sistema
    potencia_kwp: s.potencia_kwp ?? geracao.potencia_kwp ?? 0,
    geracao_mensal_estimada:
      s.geracao_mensal_estimada ??
      geracao.geracao_mensal ??
      (geracao.geracao_anual ? Math.round(Number(geracao.geracao_anual) / 12) : 0),
  };
}

// ─── Função principal ─────────────────────────────────────
export function normalizeProposalSnapshot(
  raw: Record<string, unknown> | null | undefined
): NormalizedProposalSnapshot {
  const s = adaptSmSnapshot((raw || {}) as Record<string, any>);
  const fin = (s.financeiro || {}) as Record<string, any>;

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

  // Geração mensal — snapshot > geracao_anual/12 > UCs > fallback estimado
  let geracaoMensalEstimada = num(s.geracaoMensalEstimada ?? s.geracao_mensal_estimada);
  if (geracaoMensalEstimada === 0) {
    const geracaoAnual = num(s.geracao_anual);
    if (geracaoAnual > 0) {
      geracaoMensalEstimada = Math.round(geracaoAnual / 12);
    }
  }
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
    clienteEmpresa: str(cliente.empresa ?? s.clienteEmpresa ?? s.cliente_empresa ?? lead.empresa),
    clienteCelular: str(cliente.celular ?? cliente.telefone ?? s.clienteCelular ?? s.cliente_celular ?? lead.telefone),
    clienteEmail: str(cliente.email ?? s.clienteEmail ?? s.cliente_email ?? lead.email),
    clienteCpfCnpj: str(cliente.cnpj_cpf ?? cliente.documento ?? s.clienteCpfCnpj ?? s.cliente_cpf_cnpj ?? lead.cpf_cnpj),

    // Sistema
    potenciaKwp,
    geracaoMensalEstimada,
    grupo: str(s.grupo, "B"),

    // Área — snapshot > calculada a partir de dimensões do módulo × quantidade
    areaUtil: (() => {
      const raw = num(s.areaUtil ?? s.area_util ?? s.area_util_m2);
      if (raw > 0) return raw;
      // Fallback: calcular a partir dos módulos
      const mod = itens.find(i => i.categoria === "modulo" || i.categoria === "modulos");
      if (mod) {
        const dim = str((s._raw ?? s)?.dimensoes_modulo ?? "");
        const parts = dim.split(/[xX×]/);
        if (parts.length >= 2) {
          const c = Number(parts[0]) / 1000;
          const l = Number(parts[1]) / 1000;
          if (c > 0 && l > 0) return Math.round(c * l * mod.quantidade * 10) / 10;
        }
      }
      return 0;
    })(),
    areaNecessaria: num(s.areaNecessaria ?? s.area_necessaria),

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

    // Financeiro — check root, then financeiro sub-object
    economiaMensal: num(s.economiaMensal ?? s.economia_mensal ?? fin?.economia_mensal ?? fin?.economiaMensal),
    paybackMeses: num(s.paybackMeses ?? s.payback_meses ?? fin?.payback_meses ?? fin?.paybackMeses),
    tir: num(s.tir ?? fin?.tir),
    vpl: num(s.vpl ?? fin?.vpl),

    // Gastos comparativos — fallback chain: dedicated fields → gasto_atual/novo from financial series
    gastoEnergiaSem: num(s.gastoEnergiaSem ?? s.gasto_energia_sem ?? fin?.gastoEnergiaSem ?? fin?.gasto_energia_sem ?? s.gasto_atual_mensal ?? fin?.gasto_atual_mensal ?? s.gasto_total_mensal_atual ?? fin?.gasto_total_mensal_atual),
    gastoEnergiaCom: num(s.gastoEnergiaCom ?? s.gasto_energia_com ?? fin?.gastoEnergiaCom ?? fin?.gasto_energia_com ?? s.gasto_total_mensal_novo ?? fin?.gasto_total_mensal_novo),
    gastoDemandaSem: num(s.gastoDemandaSem ?? s.gasto_demanda_sem ?? fin?.gastoDemandaSem ?? fin?.gasto_demanda_sem),
    gastoDemandaCom: num(s.gastoDemandaCom ?? s.gasto_demanda_com ?? fin?.gastoDemandaCom ?? fin?.gasto_demanda_com),
    outrosEncargosSem: num(s.outrosEncargosSem ?? s.outros_encargos_sem ?? fin?.outrosEncargosSem ?? fin?.outros_encargos_sem),
    outrosEncargosCom: num(s.outrosEncargosCom ?? s.outros_encargos_com ?? fin?.outrosEncargosCom ?? fin?.outros_encargos_com),

    // Metadata
    templateSelecionado: str(s.templateSelecionado ?? s.template_selecionado),
    nomeProposta: str(s.nomeProposta ?? s.nome_proposta),
    descricaoProposta: str(s.descricaoProposta ?? s.descricao_proposta),

    // Raw
    _raw: s,
  };
}
