// ═══════════════════════════════════════════════════════
// Payment Composition Engine — Types
// ═══════════════════════════════════════════════════════

export type FormaPagamento =
  | "pix" | "dinheiro" | "transferencia" | "boleto"
  | "cartao_credito" | "cartao_debito" | "cheque"
  | "financiamento" | "crediario" | "outro";

export type JurosTipo = "percentual" | "valor_fixo" | "sem_juros";
export type JurosResponsavel = "empresa" | "cliente" | "nao_aplica";
export type TipoParcela = "entrada" | "regular" | "intermediaria" | "final";
export type ParcelaStatus = "pendente" | "pago" | "atrasado" | "cancelado";
export type PagamentoValidacao = "valido" | "divergente" | "pendente";

export interface PaymentItemInput {
  id: string; // local UI id
  forma_pagamento: FormaPagamento;
  valor_base: number;
  entrada: boolean;
  data_pagamento: string; // ISO date
  data_primeiro_vencimento: string;
  parcelas: number;
  intervalo_dias: number;
  juros_tipo: JurosTipo;
  juros_valor: number; // percentage or fixed amount
  juros_responsavel: JurosResponsavel;
  observacoes: string;
}

export interface PaymentItemComputed extends PaymentItemInput {
  valor_juros: number;
  valor_com_juros: number;
  parcelas_detalhes: ParcelaDetalhe[];
}

export interface ParcelaDetalhe {
  numero_parcela: number;
  tipo_parcela: TipoParcela;
  valor: number;
  vencimento: string; // ISO date
}

export interface CompositionSummary {
  valor_venda: number;
  total_alocado: number;
  valor_restante: number;
  total_juros_cliente: number;
  total_juros_empresa: number;
  total_pago_cliente: number;
  valor_liquido_empresa: number;
  is_valid: boolean;
}

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  cheque: "Cheque",
  financiamento: "Financiamento",
  crediario: "Crediário",
  outro: "Outro",
};

export const JUROS_RESPONSAVEL_LABELS: Record<JurosResponsavel, string> = {
  empresa: "Empresa absorve",
  cliente: "Cliente paga",
  nao_aplica: "Não se aplica",
};

/** Forms that support installments */
export const FORMAS_PARCELAVEIS: FormaPagamento[] = [
  "cartao_credito", "cheque", "boleto", "financiamento", "crediario",
];

/** Forms that support interest */
export const FORMAS_COM_JUROS: FormaPagamento[] = [
  "cartao_credito", "cheque", "boleto", "financiamento", "crediario",
];

export function createEmptyItem(): PaymentItemInput {
  return {
    id: crypto.randomUUID(),
    forma_pagamento: "pix",
    valor_base: 0,
    entrada: false,
    data_pagamento: new Date().toISOString().split("T")[0],
    data_primeiro_vencimento: "",
    parcelas: 1,
    intervalo_dias: 30,
    juros_tipo: "sem_juros",
    juros_valor: 0,
    juros_responsavel: "nao_aplica",
    observacoes: "",
  };
}
