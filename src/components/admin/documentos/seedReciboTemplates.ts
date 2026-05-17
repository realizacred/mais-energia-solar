/**
 * Seed templates pré-configurados para a categoria "Recibo".
 * Inseridos sob demanda quando o tenant ainda não possui nenhum template de recibo.
 *
 * Branding (logo, nome, CNPJ) é injetado em runtime pelo motor de geração via
 * variáveis {{empresa.*}} resolvidas a partir de brand_settings + tenants.
 */
import type { DocumentTemplate, FormFieldSchema } from "./types";

type SeedTemplate = Pick<
  DocumentTemplate,
  "categoria" | "subcategoria" | "nome" | "descricao" | "requires_signature_default"
> & { form_schema: FormFieldSchema[] };

const COMMON_FIELDS: FormFieldSchema[] = [
  { key: "cliente_nome", label: "Nome do cliente", type: "text", required: true, order: 1 },
  { key: "cliente_cpf_cnpj", label: "CPF/CNPJ", type: "text", required: true, order: 2 },
  { key: "valor_recibo", label: "Valor", type: "currency", required: true, order: 3 },
  { key: "data_pagamento", label: "Data do pagamento", type: "date", required: true, order: 4 },
  { key: "forma_pagamento", label: "Forma de pagamento", type: "text", required: true, order: 5 },
  { key: "descricao", label: "Descrição", type: "textarea", required: false, order: 6 },
];

export const RECIBO_SEED_TEMPLATES: SeedTemplate[] = [
  {
    categoria: "recibo",
    subcategoria: "sinal",
    nome: "Recibo de Sinal",
    descricao: "Comprova o recebimento do sinal/entrada para fechamento da venda.",
    requires_signature_default: false,
    form_schema: [
      ...COMMON_FIELDS,
      { key: "projeto_valor_total", label: "Valor total da venda", type: "currency", required: true, order: 7 },
      { key: "saldo_devedor", label: "Saldo devedor restante", type: "currency", required: false, order: 8 },
    ],
  },
  {
    categoria: "recibo",
    subcategoria: "parcela",
    nome: "Recibo de Parcela",
    descricao: "Comprova o pagamento de uma parcela do parcelamento acordado.",
    requires_signature_default: false,
    form_schema: [
      ...COMMON_FIELDS,
      { key: "numero_recibo", label: "Nº da parcela", type: "text", required: true, order: 7 },
      { key: "saldo_devedor", label: "Saldo devedor restante", type: "currency", required: false, order: 8 },
    ],
  },
  {
    categoria: "recibo",
    subcategoria: "quitacao",
    nome: "Recibo de Quitação",
    descricao: "Quita integralmente o débito do cliente referente à venda.",
    requires_signature_default: false,
    form_schema: [
      ...COMMON_FIELDS,
      { key: "projeto_valor_total", label: "Valor total da venda", type: "currency", required: true, order: 7 },
    ],
  },
];

