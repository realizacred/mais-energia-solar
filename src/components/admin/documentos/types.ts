// ═══════════════════════════════════════════════
// Document Module — Canonical Types
// ═══════════════════════════════════════════════

export type DocumentCategory = "contrato" | "procuracao" | "proposta" | "termo";

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  contrato: "Contratos",
  procuracao: "Procurações",
  proposta: "Propostas",
  termo: "Termos",
};

export type TemplateStatus = "active" | "archived";

export interface FormFieldSchema {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "currency" | "select" | "textarea";
  required: boolean;
  mask?: string;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  order: number;
}

export interface DefaultSigner {
  role: string;
  signer_id?: string;
  required: boolean;
  order: number;
}

export interface DocumentTemplate {
  id: string;
  tenant_id: string;
  categoria: DocumentCategory;
  subcategoria: string | null;
  nome: string;
  descricao: string | null;
  docx_storage_path: string | null;
  version: number;
  status: TemplateStatus;
  requires_signature_default: boolean;
  default_signers: DefaultSigner[];
  form_schema: FormFieldSchema[];
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export type GeneratedDocStatus = "draft" | "generated" | "sent_for_signature" | "signed" | "cancelled";

export interface GeneratedDocument {
  id: string;
  tenant_id: string;
  deal_id: string | null;
  lead_id: string | null;
  projeto_id: string | null;
  cliente_id: string | null;
  template_id: string;
  template_version: number;
  title: string;
  status: GeneratedDocStatus;
  input_payload: Record<string, unknown>;
  docx_filled_path: string | null;
  pdf_path: string | null;
  signature_provider: string | null;
  envelope_id: string | null;
  signature_status: string | null;
  signed_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export type AuthMethod = "email" | "whatsapp" | "sms";

export interface Signer {
  id: string;
  tenant_id: string;
  auth_method: AuthMethod;
  email: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
  options: {
    doc_oficial?: boolean;
    selfie?: boolean;
    manuscrita?: boolean;
    facial?: boolean;
  };
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface SignatureSettings {
  tenant_id: string;
  enabled: boolean;
  provider: string;
  api_token_encrypted: string | null;
  sandbox_mode: boolean;
  webhook_secret_encrypted: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

// ═══════════════════════════════════════════════
// Available template variables for the variables panel
// Complete list for contracts, proposals, receipts, etc.
// ═══════════════════════════════════════════════
export const TEMPLATE_VARIABLES = [
  {
    group: "Cliente",
    vars: [
      { key: "{{cliente.nome}}", desc: "Nome completo" },
      { key: "{{cliente.cpf_cnpj}}", desc: "CPF ou CNPJ" },
      { key: "{{cliente.email}}", desc: "E-mail" },
      { key: "{{cliente.telefone}}", desc: "Telefone" },
      { key: "{{cliente.endereco}}", desc: "Endereço completo" },
      { key: "{{cliente.cidade}}", desc: "Cidade" },
      { key: "{{cliente.estado}}", desc: "Estado (UF)" },
      { key: "{{cliente.cep}}", desc: "CEP" },
      { key: "{{cliente.bairro}}", desc: "Bairro" },
      { key: "{{cliente.rua}}", desc: "Rua/Logradouro" },
      { key: "{{cliente.numero}}", desc: "Número" },
      { key: "{{cliente.complemento}}", desc: "Complemento" },
      { key: "{{cliente.data_nascimento}}", desc: "Data de nascimento" },
    ],
  },
  {
    group: "Proposta",
    vars: [
      { key: "{{proposta.numero}}", desc: "Nº da proposta" },
      { key: "{{proposta.data}}", desc: "Data da proposta" },
      { key: "{{proposta.validade}}", desc: "Data de validade" },
      { key: "{{proposta.responsavel}}", desc: "Consultor responsável" },
      { key: "{{proposta.potencia_kwp}}", desc: "Potência total kWp" },
      { key: "{{proposta.consumo_medio}}", desc: "Consumo médio kWh/mês" },
      { key: "{{proposta.geracao_media}}", desc: "Geração média kWh/mês" },
      { key: "{{proposta.area_util}}", desc: "Área útil m²" },
      { key: "{{proposta.link_interativo}}", desc: "Link da landing page" },
      { key: "{{proposta.qr_code_url}}", desc: "URL do QR Code" },
    ],
  },
  {
    group: "Financeiro",
    vars: [
      { key: "{{financeiro.investimento}}", desc: "Investimento total" },
      { key: "{{financeiro.avista}}", desc: "Valor à vista" },
      { key: "{{financeiro.entrada}}", desc: "Valor de entrada" },
      { key: "{{financeiro.payback_anos}}", desc: "Payback em anos" },
      { key: "{{financeiro.payback_meses}}", desc: "Payback em meses" },
      { key: "{{financeiro.retorno_10_anos}}", desc: "Retorno em 10 anos" },
      { key: "{{financeiro.retorno_25_anos}}", desc: "Retorno em 25 anos" },
      { key: "{{financeiro.economia_mensal}}", desc: "Economia mensal" },
      { key: "{{financeiro.economia_anual}}", desc: "Economia anual" },
      { key: "{{financeiro.tarifa}}", desc: "Tarifa de energia" },
      { key: "{{financeiro.roi}}", desc: "ROI %" },
      { key: "{{financeiro.tir}}", desc: "TIR %" },
    ],
  },
  {
    group: "Equipamentos",
    vars: [
      { key: "{{modulo.marca}}", desc: "Marca do módulo" },
      { key: "{{modulo.modelo}}", desc: "Modelo do módulo" },
      { key: "{{modulo.potencia_wp}}", desc: "Potência Wp" },
      { key: "{{modulo.quantidade}}", desc: "Qtd. módulos" },
      { key: "{{modulo.garantia}}", desc: "Garantia módulo" },
      { key: "{{inversor.marca}}", desc: "Marca do inversor" },
      { key: "{{inversor.modelo}}", desc: "Modelo do inversor" },
      { key: "{{inversor.potencia_kw}}", desc: "Potência kW" },
      { key: "{{inversor.quantidade}}", desc: "Qtd. inversores" },
      { key: "{{inversor.garantia}}", desc: "Garantia inversor" },
      { key: "{{kit.garantia_servico}}", desc: "Garantia serviço" },
    ],
  },
  {
    group: "Projeto",
    vars: [
      { key: "{{projeto.potencia_kwp}}", desc: "Potência em kWp" },
      { key: "{{projeto.concessionaria}}", desc: "Concessionária" },
      { key: "{{projeto.telhado_tipo}}", desc: "Tipo de telhado" },
      { key: "{{projeto.num_modulos}}", desc: "Nº de módulos" },
      { key: "{{projeto.inversor}}", desc: "Inversor" },
      { key: "{{projeto.estrutura}}", desc: "Tipo de estrutura" },
      { key: "{{projeto.irradiacao}}", desc: "Irradiação solar" },
    ],
  },
  {
    group: "Venda",
    vars: [
      { key: "{{venda.valor_total}}", desc: "Valor total" },
      { key: "{{venda.entrada}}", desc: "Valor de entrada" },
      { key: "{{venda.num_parcelas}}", desc: "Nº de parcelas" },
      { key: "{{venda.data_venda}}", desc: "Data da venda" },
      { key: "{{venda.forma_pagamento}}", desc: "Forma de pagamento" },
    ],
  },
  {
    group: "Empresa",
    vars: [
      { key: "{{empresa.nome}}", desc: "Razão social" },
      { key: "{{empresa.cnpj}}", desc: "CNPJ" },
      { key: "{{empresa.endereco}}", desc: "Endereço" },
      { key: "{{empresa.telefone}}", desc: "Telefone" },
      { key: "{{empresa.email}}", desc: "E-mail" },
      { key: "{{empresa.responsavel}}", desc: "Representante legal" },
      { key: "{{empresa.responsavel_cpf}}", desc: "CPF do representante" },
      { key: "{{empresa.responsavel_cargo}}", desc: "Cargo do representante" },
    ],
  },
  {
    group: "Data/Hora",
    vars: [
      { key: "{{data.hoje}}", desc: "Data atual (dd/mm/aaaa)" },
      { key: "{{data.hoje_extenso}}", desc: "Data por extenso" },
      { key: "{{data.ano}}", desc: "Ano atual" },
      { key: "{{data.mes}}", desc: "Mês atual" },
    ],
  },
  {
    group: "Parcelas (loop)",
    vars: [
      { key: "{{#parcelas}}", desc: "Início do loop" },
      { key: "{{numero}}", desc: "Nº da parcela" },
      { key: "{{valor}}", desc: "Valor da parcela" },
      { key: "{{vencimento}}", desc: "Data vencimento" },
      { key: "{{/parcelas}}", desc: "Fim do loop" },
    ],
  },
  {
    group: "Seguro",
    vars: [
      { key: "{{seguro.valor}}", desc: "Valor do seguro" },
      { key: "{{seguro.periodo}}", desc: "Período do seguro" },
      { key: "{{seguro.cobertura}}", desc: "Cobertura" },
    ],
  },
];
