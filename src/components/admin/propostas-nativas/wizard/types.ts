// ─── Wizard Types ──────────────────────────────────────────
// Shared types for the 9-step Proposal Wizard

export interface LeadSelection {
  id: string;
  nome: string;
  telefone: string;
  lead_code: string;
  estado?: string;
  cidade?: string;
  consumo_kwh?: number;
  media_consumo?: number;
  tipo_telhado?: string;
  email?: string;
  cpf_cnpj?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  rede_atendimento?: string;
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

export interface UCData {
  id: string; // local temp id
  uc_index: number;
  nome: string;
  tipo_dimensionamento: "BT" | "MT";
  distribuidora: string;
  distribuidora_id: string;
  subgrupo: string;
  estado: string;
  cidade: string;
  fase: "monofasico" | "bifasico" | "trifasico";
  tensao_rede: string;
  // Consumo BT
  consumo_mensal: number;
  consumo_meses: Record<string, number>; // jan..dez
  // Consumo MT
  consumo_mensal_p: number;
  consumo_mensal_fp: number;
  // Tarifas
  tarifa_distribuidora: number;
  tarifa_te_p: number;
  tarifa_tusd_p: number;
  tarifa_te_fp: number;
  tarifa_tusd_fp: number;
  // Demanda MT
  demanda_preco: number;
  demanda_contratada: number;
  demanda_adicional: number;
  // Custos
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

export interface KitItemRow {
  id: string;
  descricao: string;
  fabricante: string;
  modelo: string;
  potencia_w: number;
  quantidade: number;
  preco_unitario: number;
  categoria: string;
  avulso: boolean;
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
    nome: `UC ${index}`,
    tipo_dimensionamento: "BT",
    distribuidora: "", distribuidora_id: "",
    subgrupo: "B1", estado: "", cidade: "",
    fase: "bifasico", tensao_rede: "",
    consumo_mensal: 0,
    consumo_meses: Object.fromEntries(MESES.map(m => [m, 0])),
    consumo_mensal_p: 0, consumo_mensal_fp: 0,
    tarifa_distribuidora: 0, tarifa_te_p: 0, tarifa_tusd_p: 0,
    tarifa_te_fp: 0, tarifa_tusd_fp: 0,
    demanda_preco: 0, demanda_contratada: 0, demanda_adicional: 0,
    custo_disponibilidade_kwh: 0, custo_disponibilidade_valor: 0,
    outros_encargos_atual: 0, outros_encargos_novo: 0,
    distancia: 0, tipo_telhado: "", inclinacao: 0, desvio_azimutal: 0,
    taxa_desempenho: 80,
    regra_compensacao: 0, rateio_sugerido_creditos: 100,
    rateio_creditos: 100, imposto_energia: 0, fator_simultaneidade: 100,
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
export const SUBGRUPO_MT = ["A1", "A2", "A3", "A3a", "A4", "AS"];

export const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
