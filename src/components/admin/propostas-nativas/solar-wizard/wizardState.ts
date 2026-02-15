// ─── SolarWizard State Types & Defaults ──────────────────

export interface WizClienteData {
  id?: string;
  nome: string;
  telefone: string;
  cpf_cnpj: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface WizObraData {
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  mesmoEnderecoCliente: boolean;
}

export interface WizConsumoData {
  meses: number[]; // 12 values
  mediaMensal: number;
}

export interface WizTecnicoData {
  concessionariaId: string;
  tipoTelhado: string;
  orientacao: string;
  tarifa: number;
}

export interface WizKitItem {
  tipo: string;
  descricao: string;
  fabricante: string;
  modelo: string;
  quantidade: number;
  precoUnitario: number;
}

export interface WizFinanceiroData {
  custoEquipamentos: number;
  custoInstalacao: number;
  custoComissao: number;
  custoImpostos: number;
  margemPercent: number;
  descontoPercent: number;
  bancoId: string;
  numParcelas: number;
  entrada: number;
}

export interface SolarWizardState {
  step: number;
  cliente: WizClienteData;
  obra: WizObraData;
  consumo: WizConsumoData;
  tecnico: WizTecnicoData;
  selectedKitId: string | null;
  kitItems: WizKitItem[];
  financeiro: WizFinanceiroData;
  analysisComplete: boolean;
}

export const INITIAL_STATE: SolarWizardState = {
  step: 0,
  cliente: {
    nome: "", telefone: "", cpf_cnpj: "", email: "",
    cep: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "",
  },
  obra: {
    cep: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "",
    mesmoEnderecoCliente: true,
  },
  consumo: {
    meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    mediaMensal: 0,
  },
  tecnico: {
    concessionariaId: "",
    tipoTelhado: "",
    orientacao: "N",
    tarifa: 0,
  },
  selectedKitId: null,
  kitItems: [],
  financeiro: {
    custoEquipamentos: 0,
    custoInstalacao: 2500,
    custoComissao: 0,
    custoImpostos: 0,
    margemPercent: 25,
    descontoPercent: 0,
    bancoId: "",
    numParcelas: 60,
    entrada: 0,
  },
  analysisComplete: false,
};

// ─── Derived calculations ──────────────────────────────────

export function calcSuggestedKwp(mediaMensal: number): number {
  if (mediaMensal <= 0) return 0;
  return Math.round((mediaMensal / 130) * 100) / 100;
}

export function calcGeracaoEstimada(kwp: number, orientacaoFator: number = 1): number {
  return Math.round(kwp * 130 * 0.82 * orientacaoFator);
}

export function calcNumModulos(kwp: number, potenciaModuloWp: number): number {
  if (potenciaModuloWp <= 0) return 0;
  return Math.ceil((kwp * 1000) / potenciaModuloWp);
}

export function calcPrecoFinal(fin: WizFinanceiroData): number {
  const custoBase = fin.custoEquipamentos + fin.custoInstalacao + fin.custoComissao + fin.custoImpostos;
  const comMargem = custoBase * (1 + fin.margemPercent / 100);
  return comMargem * (1 - fin.descontoPercent / 100);
}

export function calcLucro(fin: WizFinanceiroData): number {
  const custoBase = fin.custoEquipamentos + fin.custoInstalacao + fin.custoComissao + fin.custoImpostos;
  return calcPrecoFinal(fin) - custoBase;
}

export function calcMargemLiquida(fin: WizFinanceiroData): number {
  const pf = calcPrecoFinal(fin);
  if (pf <= 0) return 0;
  const custoBase = fin.custoEquipamentos + fin.custoInstalacao + fin.custoComissao + fin.custoImpostos;
  return ((pf - custoBase) / pf) * 100;
}

export function calcParcela(principal: number, taxaMensal: number, n: number): number {
  if (principal <= 0 || n <= 0) return 0;
  if (taxaMensal <= 0) return principal / n;
  const r = taxaMensal / 100;
  const fator = Math.pow(1 + r, n);
  return principal * (r * fator) / (fator - 1);
}
