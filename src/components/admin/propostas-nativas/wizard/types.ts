// ─── Wizard Types ──────────────────────────────────────────
// Shared types for the 9-step Proposal Wizard

export interface LeadSelection {
  id: string;
  nome: string;
  telefone: string;
  lead_code: string;
  estado?: string;
  cidade?: string;
  /**
   * Geração estimada informada pelo vendedor no cadastro do lead (kWh/mês).
   * Campo DB: leads.consumo_previsto — NÃO é consumo nem potência.
   * Não converter diretamente em potência (kWp). Se usado em pré-dimensionamento,
   * aplicar: kWp ≈ geracao / (irradiação × 30 × taxa_desempenho).
   */
  geracao_estimada_kwh?: number;
  media_consumo?: number;
  tipo_telhado?: string;
  email?: string;
  cpf_cnpj?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  rede_atendimento?: string;
  /** Código IBGE do município (propagado de leads ou clientes) */
  municipio_ibge_codigo?: string | null;
}

export interface ClienteData {
  nome: string;
  empresa: string;
  cnpj_cpf: string;
  email: string;
  celular: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface ComercialData {
  responsavel_nome: string;
  responsavel_email: string;
  responsavel_celular: string;
  representante_nome: string;
  representante_email: string;
  representante_celular: string;
  projeto_id_externo: string;
  empresa_nome: string;
  empresa_cnpj_cpf: string;
  empresa_estado: string;
  empresa_cidade: string;
}

export type RegraCompensacao = "GD2" | "GD3";
export type GrupoTarifario = "A" | "B";
export type FaseTensao =
  | "monofasico_127" | "monofasico_220"
  | "bifasico_127_220" | "bifasico_220_380" | "bifasico_277_480"
  | "trifasico_127_220" | "trifasico_220_380" | "trifasico_277_480";

export interface UCData {
  id: string; // local temp id
  uc_index: number;
  nome: string;
  is_geradora: boolean;
  regra: RegraCompensacao;
  grupo_tarifario: GrupoTarifario;
  tipo_dimensionamento: "BT" | "MT";
  distribuidora: string;
  distribuidora_id: string;
  subgrupo: string;
  estado: string;
  cidade: string;
  fase: "monofasico" | "bifasico" | "trifasico";
  fase_tensao: FaseTensao;
  tensao_rede: string;
  // Consumo BT (Grupo B)
  consumo_mensal: number;
  consumo_meses: Record<string, number>; // jan..dez
  // Consumo MT (Grupo A) - Ponta / Fora Ponta
  consumo_mensal_p: number;
  consumo_mensal_fp: number;
  consumo_meses_p: Record<string, number>;
  consumo_meses_fp: Record<string, number>;
  // Tarifas Grupo B
  tarifa_distribuidora: number;
  tarifa_fio_b: number;
  // Tarifas Grupo A - Ponta
  tarifa_te_p: number;
  tarifa_tusd_p: number;
  tarifa_fio_b_p: number; // GD2
  tarifa_tarifacao_p: number; // GD3
  // Tarifas Grupo A - Fora Ponta
  tarifa_te_fp: number;
  tarifa_tusd_fp: number;
  tarifa_fio_b_fp: number; // GD2
  tarifa_tarifacao_fp: number; // GD3
  // Demanda (Grupo A)
  demanda_consumo_kw: number;
  demanda_geracao_kw: number;
  demanda_consumo_rs: number;
  demanda_geracao_rs: number;
  // Legacy demanda fields
  demanda_preco: number;
  demanda_contratada: number;
  demanda_adicional: number;
  // Custos / Configurações adicionais
  custo_disponibilidade_kwh: number;
  custo_disponibilidade_valor: number;
  outros_encargos_atual: number;
  outros_encargos_novo: number;
  // Localização técnica
  distancia: number;
  tipo_telhado: string;
  inclinacao: number;
  desvio_azimutal: number;
  taxa_desempenho: number;
  // Compensação
  regra_compensacao: number;
  rateio_sugerido_creditos: number;
  rateio_creditos: number;
  imposto_energia: number;
  fator_simultaneidade: number;
}

export interface PremissasData {
  imposto: number;
  inflacao_energetica: number;
  inflacao_ipca: number;
  perda_eficiencia_anual: number;
  sobredimensionamento: number;
  troca_inversor_anos: number;
  troca_inversor_custo: number;
  vpl_taxa_desconto: number;
}

/** Categorias canônicas para itens do kit gerador. Manter em sync com CATEGORIAS em StepKit.tsx */
export type KitCategoria =
  | "modulo"
  | "inversor"
  | "bateria"
  | "transformador"
  | "estrutura"
  | "string_box"
  | "cabos"
  | "conectores"
  | "mao_obra"
  | "outros";

export interface KitItemRow {
  id: string;
  descricao: string;
  fabricante: string;
  modelo: string;
  potencia_w: number;
  quantidade: number;
  preco_unitario: number;
  categoria: KitCategoria;
  avulso: boolean;
  /** Referência ao produto de origem (modulos_solares.id, inversores_catalogo.id, etc.) para rastreabilidade do snapshot. */
  produto_ref?: string | null;

  // ── Specs técnicas do módulo (opcionais — preenchidos do catálogo) ──
  tipo_celula?: string;
  num_celulas?: number;
  eficiencia_percent?: number;
  vmp?: number;
  voc?: number;
  imp?: number;
  isc?: number;
  comprimento_mm?: number;
  largura_mm?: number;
  profundidade_mm?: number;
  peso_kg?: number;
  coef_temp_pmax?: number;
  coef_temp_voc?: number;
  coef_temp_isc?: number;
  garantia_produto_anos?: number;
  garantia_performance_anos?: number;
  bifacial?: boolean;

  // ── Specs técnicas do inversor (opcionais) ──
  potencia_saida_w?: number;
  tensao_entrada_min?: number;
  tensao_entrada_max?: number;
  eficiencia_maxima?: number;
  fases?: string;
}

/** Rótulos legíveis para cada KitCategoria */
export const KIT_CATEGORIA_LABELS: Record<KitCategoria, string> = {
  modulo: "Módulo",
  inversor: "Inversor",
  bateria: "Bateria",
  transformador: "Transformador",
  estrutura: "Estrutura",
  string_box: "String Box",
  cabos: "Cabos",
  conectores: "Conectores",
  mao_obra: "Mão de obra",
  outros: "Outros",
};

/** Arredonda para centavos — inline para evitar dependência circular com formatters */
function _round(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Calcula o preço final (custo base + margem − desconto) de forma canônica.
 *  SSOT: toda lógica de pricing deve usar esta função.
 *  Quando o Centro Financeiro está ativo, custo_instalacao/custo_comissao/custo_outros
 *  são sincronizados de lá — usa esses valores se disponíveis para evitar double-counting. */
export function calcPrecoFinal(itens: KitItemRow[], servicos: ServicoItem[], venda: VendaData): number {
  const custoKitCalculado = _round(itens.reduce((s, i) => s + _round(i.quantidade * i.preco_unitario), 0));
  const custoKit = (venda.custo_kit_override != null && venda.custo_kit_override > 0)
    ? _round(venda.custo_kit_override)
    : custoKitCalculado;

  // If Financial Center has synced costs (custo_instalacao > 0 or explicitly set),
  // use VendaData costs directly. Otherwise fall back to servicos array.
  const hasFCCosts = venda.custo_instalacao > 0 || venda.custo_comissao > 0 || venda.custo_outros > 0;
  const custoServicos = hasFCCosts
    ? _round(venda.custo_instalacao)
    : _round(servicos.filter(s => s.incluso_no_preco).reduce((s, i) => s + i.valor, 0));

  const custoBase = _round(custoKit + custoServicos + venda.custo_comissao + venda.custo_outros);
  const margemValor = _round(custoBase * (venda.margem_percentual / 100));
  const precoComMargem = _round(custoBase + margemValor);
  return _round(precoComMargem - precoComMargem * (venda.desconto_percentual / 100));
}

/** Validação mínima do kit para governança do wizard */
export interface KitValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateKit(itens: KitItemRow[], potenciaKwp: number, custoKitOverride?: number | null): KitValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const modulos = itens.filter(i => i.categoria === "modulo" && i.quantidade >= 1 && i.potencia_w > 0);
  const inversores = itens.filter(i => i.categoria === "inversor");

  if (modulos.length === 0) {
    errors.push("Adicione pelo menos 1 módulo válido ao kit.");
  }
  if (potenciaKwp <= 0) {
    errors.push("A potência total do sistema deve ser maior que zero.");
  }
  if (inversores.length === 0) {
    warnings.push("Nenhum inversor adicionado — verifique antes de gerar a proposta.");
  }

  const custoTotal = (custoKitOverride != null && custoKitOverride > 0)
    ? custoKitOverride
    : itens.reduce((s, i) => s + (i.preco_unitario ?? 0) * (i.quantidade ?? 0), 0);
  const itensPrecoZero = itens.filter(i => (i.preco_unitario ?? 0) <= 0 && (i.quantidade ?? 0) > 0);
  if (itensPrecoZero.length > 0 && custoTotal <= 0) {
    warnings.push(`${itensPrecoZero.length} item(ns) com preço unitário R$ 0,00.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export interface KitData {
  tipo_kit: "fechado" | "customizado";
  tipo_sistema: "on_grid" | "hibrido" | "off_grid";
  topologia: "tradicional" | "microinversor" | "otimizador";
  itens: KitItemRow[];
  layouts: LayoutArranjo[];
}

export interface LayoutArranjo {
  id: string;
  arranjo_index: number;
  num_linhas: number;
  modulos_por_linha: number;
  disposicao: "horizontal" | "vertical";
}

export interface ServicoItem {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  incluso_no_preco: boolean;
}

export interface VendaData {
  custo_kit: number;
  custo_instalacao: number;
  custo_comissao: number;
  custo_outros: number;
  margem_percentual: number;
  desconto_percentual: number;
  observacoes: string;
  /** Override manual do custo do kit no Centro Financeiro */
  custo_kit_override?: number | null;
  /** Flag indicando que o usuário alterou manualmente a comissão */
  comissao_manual_override?: boolean;

  // Centro Financeiro — estados persistidos (E5/E6/E7)
  /** Toggle de instalação habilitado */
  instalacao_enabled?: boolean;
  /** Toggle de comissão habilitado */
  comissao_enabled?: boolean;
  /** Percentual de comissão do consultor (ex: 3.5) */
  percentual_comissao_consultor?: number;
  /** Nome do consultor para comissão */
  consultor_nome_comissao?: string;
  /** Custos extras adicionados manualmente pelo usuário */
  custos_extras?: Array<{
    id: string;
    item: string;
    quantidade: number;
    custo_unitario: number;
    checked: boolean;
  }>;
  /** Mapa de serviços habilitados/desabilitados (id → boolean) */
  servicos_enabled_map?: Record<string, boolean>;
}

export interface PagamentoOpcao {
  id: string;
  nome: string;
  tipo: "a_vista" | "financiamento" | "parcelado" | "outro";
  valor_financiado: number;
  entrada: number;
  taxa_mensal: number;
  carencia_meses: number;
  num_parcelas: number;
  valor_parcela: number;
}

export interface Concessionaria {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
  tarifa_energia: number | null;
  tarifa_fio_b: number | null;
}

export interface CatalogoModulo {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_w: number | null;
}

export interface CatalogoInversor {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_nominal_w: number | null;
}

export interface BancoFinanciamento {
  id: string;
  nome: string;
  taxa_mensal: number;
  max_parcelas: number;
}

// ─── Wizard State (all steps) ──────────────────────────────

export interface WizardState {
  // Step 0 - Cliente
  selectedLead: LeadSelection | null;
  cliente: ClienteData;
  /** Código IBGE do município do cliente/lead — usado para integrações (Solaryum) */
  cliente_municipio_ibge_codigo?: string | null;
  // Step 1 - Comercial
  comercial: ComercialData;
  // Step 2 - UCs
  ucs: UCData[];
  potenciaKwp: number;
  grupo: string;
  // Step 3 - Premissas
  premissas: PremissasData;
  // Step 4 - Kit
  kit: KitData;
  // Step 5 - Serviços
  servicos: ServicoItem[];
  // Step 6 - Venda
  venda: VendaData;
  // Step 7 - Pagamento
  pagamentoOpcoes: PagamentoOpcao[];
  // Step 8 - Documento
  templateSelecionado: string;
}

// ─── Defaults ──────────────────────────────────────────────

export const EMPTY_CLIENTE: ClienteData = {
  nome: "", empresa: "", cnpj_cpf: "", email: "", celular: "",
  cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
};

export const EMPTY_COMERCIAL: ComercialData = {
  responsavel_nome: "", responsavel_email: "", responsavel_celular: "",
  representante_nome: "", representante_email: "", representante_celular: "",
  projeto_id_externo: "", empresa_nome: "", empresa_cnpj_cpf: "",
  empresa_estado: "", empresa_cidade: "",
};

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

export function createEmptyUC(index: number): UCData {
  return {
    id: crypto.randomUUID(),
    uc_index: index,
    nome: index === 1 ? "Unidade (Geradora)" : `Unidade ${index}`,
    is_geradora: index === 1,
    regra: "GD2",
    grupo_tarifario: "B",
    tipo_dimensionamento: "BT",
    distribuidora: "", distribuidora_id: "",
    subgrupo: "B1", estado: "", cidade: "",
    fase: "bifasico", fase_tensao: "bifasico_127_220", tensao_rede: "127/220V",
    consumo_mensal: 0,
    consumo_meses: Object.fromEntries(MESES.map(m => [m, 0])),
    consumo_mensal_p: 0, consumo_mensal_fp: 0,
    consumo_meses_p: Object.fromEntries(MESES.map(m => [m, 0])),
    consumo_meses_fp: Object.fromEntries(MESES.map(m => [m, 0])),
    tarifa_distribuidora: 0, tarifa_fio_b: 0,
    tarifa_te_p: 0, tarifa_tusd_p: 0, tarifa_fio_b_p: 0, tarifa_tarifacao_p: 0,
    tarifa_te_fp: 0, tarifa_tusd_fp: 0, tarifa_fio_b_fp: 0, tarifa_tarifacao_fp: 0,
    demanda_consumo_kw: 0, demanda_geracao_kw: 0,
    demanda_consumo_rs: 0, demanda_geracao_rs: 0,
    demanda_preco: 0, demanda_contratada: 0, demanda_adicional: 0,
    custo_disponibilidade_kwh: 50, custo_disponibilidade_valor: 0,
    outros_encargos_atual: 0, outros_encargos_novo: 0,
    distancia: 0, tipo_telhado: "", inclinacao: 0, desvio_azimutal: 0,
    taxa_desempenho: 80,
    regra_compensacao: 0, rateio_sugerido_creditos: 100,
    rateio_creditos: 100, imposto_energia: 0, fator_simultaneidade: 0,
  };
}

export const DEFAULT_PREMISSAS: PremissasData = {
  imposto: 0,
  inflacao_energetica: 6.5,
  inflacao_ipca: 4.5,
  perda_eficiencia_anual: 0.5,
  sobredimensionamento: 0,
  troca_inversor_anos: 15,
  troca_inversor_custo: 30,
  vpl_taxa_desconto: 10,
};

export const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export const TIPO_TELHADO_OPTIONS = [
  "Fibrocimento", "Metálico", "Laje", "Cerâmico", "Solo", "Outro",
];

export const GRUPO_OPTIONS = [
  { value: "B1", label: "B1 - Residencial" },
  { value: "B2", label: "B2 - Rural" },
  { value: "B3", label: "B3 - Comercial" },
  { value: "A", label: "Grupo A - Alta Tensão" },
];

export const SUBGRUPO_BT = ["B1", "B2", "B3"];

// Subgrupos MT padrão ANEEL com modalidade tarifária
// Cada concessionária pode ter apenas um subconjunto destes
export const SUBGRUPO_MT = [
  "A1",
  "A2",
  "A3",
  "A3a - Verde",
  "A4 - Verde",
  "A4 - Azul",
  "AS",
];

// Labels descritivos para subgrupos MT
export const SUBGRUPO_MT_LABELS: Record<string, string> = {
  "A1": "A1 - Alta Tensão (≥ 230kV)",
  "A2": "A2 - Alta Tensão (88 a 138kV)",
  "A3": "A3 - Alta Tensão (69kV)",
  "A3a - Verde": "A3a - Verde (30 a 44kV)",
  "A4 - Verde": "A4 - Verde (2,3 a 25kV)",
  "A4 - Azul": "A4 - Azul (2,3 a 25kV)",
  "AS": "AS - Subterrâneo",
};

export const FASE_TENSAO_OPTIONS = [
  { value: "monofasico_127", label: "Monofásico 127V" },
  { value: "monofasico_220", label: "Monofásico 220V" },
  { value: "bifasico_127_220", label: "Bifásico 127/220V" },
  { value: "bifasico_220_380", label: "Bifásico 220/380V" },
  { value: "bifasico_277_480", label: "Bifásico 277/480V" },
  { value: "trifasico_127_220", label: "Trifásico 127/220V" },
  { value: "trifasico_220_380", label: "Trifásico 220/380V" },
  { value: "trifasico_277_480", label: "Trifásico 277/480V" },
] as const;

/**
 * Maps rede_atendimento (from lead/ORC) to FaseTensao value.
 * Handles both new format ("Monofásico 127V") and legacy ("Monofásico").
 */
export function redeAtendimentoToFaseTensao(rede: string | null | undefined): { fase: UCData["fase"]; fase_tensao: FaseTensao; tensao_rede: string } | null {
  if (!rede) return null;
  const map: Record<string, { fase: UCData["fase"]; fase_tensao: FaseTensao; tensao_rede: string }> = {
    "Monofásico 127V":    { fase: "monofasico", fase_tensao: "monofasico_127", tensao_rede: "127V" },
    "Monofásico 220V":    { fase: "monofasico", fase_tensao: "monofasico_220", tensao_rede: "220V" },
    "Bifásico 127/220V":  { fase: "bifasico",   fase_tensao: "bifasico_127_220", tensao_rede: "127/220V" },
    "Bifásico 220/380V":  { fase: "bifasico",   fase_tensao: "bifasico_220_380", tensao_rede: "220/380V" },
    "Bifásico 277/480V":  { fase: "bifasico",   fase_tensao: "bifasico_277_480", tensao_rede: "277/480V" },
    "Trifásico 127/220V": { fase: "trifasico",  fase_tensao: "trifasico_127_220", tensao_rede: "127/220V" },
    "Trifásico 220/380V": { fase: "trifasico",  fase_tensao: "trifasico_220_380", tensao_rede: "220/380V" },
    "Trifásico 277/480V": { fase: "trifasico",  fase_tensao: "trifasico_277_480", tensao_rede: "277/480V" },
    // Legacy fallbacks (sem tensão)
    "Monofásico":  { fase: "monofasico", fase_tensao: "monofasico_127", tensao_rede: "127V" },
    "Bifásico":    { fase: "bifasico",   fase_tensao: "bifasico_127_220", tensao_rede: "127/220V" },
    "Trifásico":   { fase: "trifasico",  fase_tensao: "trifasico_127_220", tensao_rede: "127/220V" },
    "monofasico":  { fase: "monofasico", fase_tensao: "monofasico_127", tensao_rede: "127V" },
    "bifasico":    { fase: "bifasico",   fase_tensao: "bifasico_127_220", tensao_rede: "127/220V" },
    "trifasico":   { fase: "trifasico",  fase_tensao: "trifasico_127_220", tensao_rede: "127/220V" },
  };
  return map[rede] || null;
}

/**
 * Maps lead tipo_telhado (e.g. "Zinco (Metal)") to proposal tipo_telhado (e.g. "Metálico").
 * Returns the original value if no mapping found (user can adjust manually).
 */
export function mapLeadTipoTelhadoToProposal(leadTipo: string | null | undefined): string {
  if (!leadTipo) return "";
  const map: Record<string, string> = {
    "Zinco (Metal)":       "Metálico",
    "Colonial (Madeira)":  "Cerâmico",
    "Colonial (Metal)":    "Cerâmico",
    "Fibro (Madeira)":     "Fibrocimento",
    "Fibro (Metal)":       "Fibrocimento",
    "Laje":                "Laje",
    "Solo com Zinco":      "Solo",
    "Solo com Eucalipto":  "Solo",
  };
  // If it's already a proposal value, return as-is
  if (TIPO_TELHADO_OPTIONS.includes(leadTipo)) return leadTipo;
  return map[leadTipo] || leadTipo;
}

// ─── Pre-Dimensionamento ───────────────────────────────────

export interface TopologiaConfig {
  desempenho: number;
  fator_geracao: number;
  fator_geracao_meses: Record<string, number>;
}

export const TOPOLOGIA_LABELS: Record<string, string> = {
  tradicional: "Tradicional",
  microinversor: "Microinversor",
  otimizador: "Otimizador",
};

export const DEFAULT_TOPOLOGIA_CONFIGS: Record<string, TopologiaConfig> = {
  tradicional: { desempenho: 69.80, fator_geracao: 111.29, fator_geracao_meses: {} },
  microinversor: { desempenho: 72.00, fator_geracao: 114.80, fator_geracao_meses: {} },
  otimizador: { desempenho: 74.00, fator_geracao: 117.99, fator_geracao_meses: {} },
};

export interface PreDimensionamentoData {
  sistema: "on_grid" | "hibrido" | "off_grid";
  tipos_kit: string[];
  topologias: string[];
  sombreamento: string;
  sombreamento_config?: import("@/hooks/useTenantPremises").SombreamentoConfig;
  desvio_azimutal: number;
  inclinacao: number;
  dod: number;
  topologia_configs: Record<string, TopologiaConfig>;
  sobredimensionamento: number;
  margem_pot_ideal: number;
  considerar_transformador: boolean;
  // Legacy compat — mirrors topologia_configs.tradicional
  desempenho: number;
  fator_geracao: number;
  fator_geracao_meses: Record<string, number>;
  tipo_kit: "customizado" | "fechado";
}

export const DEFAULT_PRE_DIMENSIONAMENTO: PreDimensionamentoData = {
  sistema: "on_grid",
  tipos_kit: ["customizado", "fechado"],
  topologias: ["tradicional"],
  sombreamento: "Nenhuma",
  sombreamento_config: undefined,
  desvio_azimutal: 0,
  inclinacao: 20,
  dod: 0,
  topologia_configs: { ...DEFAULT_TOPOLOGIA_CONFIGS },
  sobredimensionamento: 20,
  margem_pot_ideal: 0,
  considerar_transformador: true,
  desempenho: 69.80,
  fator_geracao: 111.29,
  fator_geracao_meses: {},
  tipo_kit: "fechado",
};

export const SOMBREAMENTO_OPTIONS = ["Nenhuma", "Pouco", "Médio", "Alto"];

export const DESVIO_AZIMUTAL_OPTIONS = Array.from({ length: 19 }, (_, i) => i * 10); // 0° to 180°

export const INCLINACAO_OPTIONS = Array.from({ length: 10 }, (_, i) => i * 5); // 0° to 45°

/** @deprecated Use `formatBRL` from `@/lib/formatters` instead. */
export { formatBRL } from "@/lib/formatters";
