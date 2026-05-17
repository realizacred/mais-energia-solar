// ═══════════════════════════════════════════════
// Document Module — Canonical Types
// ═══════════════════════════════════════════════

export type DocumentCategory = "contrato" | "procuracao" | "proposta" | "termo" | "recibo";

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  contrato: "Contratos",
  procuracao: "Procurações",
  proposta: "Propostas",
  termo: "Termos",
  recibo: "Recibos",
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

export type SignerMode = "simplified" | "complete";
export type SignatureReminder = null | "DAILY" | "WEEKLY";

export interface SignatureSettingsExtra {
  signer_mode?: SignerMode;
  refusable?: boolean;
  reminder?: SignatureReminder;
  deadline_days?: number | null;
}

export interface SignatureSettings {
  tenant_id: string;
  enabled: boolean;
  provider: string;
  api_token_encrypted: string | null;
  sandbox_mode: boolean;
  webhook_secret_encrypted: string | null;
  settings_extra: SignatureSettingsExtra | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface RepresentanteLegal {
  representante_legal: string | null;
  representante_email: string | null;
  representante_cpf: string | null;
  representante_cargo: string | null;
}

// ═══════════════════════════════════════════════
// Available template variables for the variables panel
// Complete list for contracts, proposals, receipts, etc.
// ═══════════════════════════════════════════════
export const TEMPLATE_VARIABLES = [
  {
    group: "Cliente",
    vars: [
      { key: "{{cliente_nome}}", desc: "Nome completo" },
      { key: "{{cliente_cpf_cnpj}}", desc: "CPF ou CNPJ" },
      { key: "{{cliente_email}}", desc: "E-mail" },
      { key: "{{cliente_celular}}", desc: "Telefone/Celular" },
      { key: "{{cliente_endereco}}", desc: "Logradouro" },
      { key: "{{cliente_cidade}}", desc: "Cidade" },
      { key: "{{cliente_estado}}", desc: "Estado (UF)" },
      { key: "{{cliente_cep}}", desc: "CEP" },
      { key: "{{cliente_bairro}}", desc: "Bairro" },
      { key: "{{cliente_numero}}", desc: "Número" },
      { key: "{{cliente_complemento}}", desc: "Complemento" },
      { key: "{{cliente_data_nascimento}}", desc: "Data de nascimento" },
    ],
  },
  {
    group: "Consultor",
    vars: [
      { key: "{{consultor_nome}}", desc: "Nome do consultor" },
      { key: "{{consultor_telefone}}", desc: "Telefone do consultor" },
      { key: "{{consultor_email}}", desc: "E-mail do consultor" },
      { key: "{{responsavel_nome}}", desc: "Nome do responsável" },
    ],
  },
  {
    group: "Empresa",
    vars: [
      { key: "{{empresa_nome}}", desc: "Nome fantasia/Razão social" },
      { key: "{{empresa_cnpj}}", desc: "CNPJ da empresa" },
      { key: "{{empresa_telefone}}", desc: "Telefone da empresa" },
      { key: "{{empresa_email}}", desc: "E-mail da empresa" },
      { key: "{{empresa_endereco}}", desc: "Endereço completo" },
      { key: "{{empresa_responsavel}}", desc: "Representante legal" },
    ],
  },
  {
    group: "Pagamento",
    vars: [
      { key: "{{pagamento_entrada_valor}}", desc: "Valor da entrada" },
      { key: "{{pagamento_forma_entrada}}", desc: "Forma pgto entrada" },
      { key: "{{pagamento_data_venc_entrada}}", desc: "Data vencimento entrada" },
      { key: "{{pagamento_valor_restante}}", desc: "Valor restante" },
      { key: "{{pagamento_forma_restante}}", desc: "Forma pgto restante" },
      { key: "{{pagamento_data_venc_restante}}", desc: "Data pgto restante" },
      { key: "{{pagamento_parcelas_quantidade}}", desc: "Nº de parcelas" },
      { key: "{{pagamento_parcelas_valor}}", desc: "Valor da parcela" },
      { key: "{{pagamento_parcelas_descricao}}", desc: "Ex: 12x de R$ X no cartão" },
      { key: "{{pagamento_valor_equipamento}}", desc: "Valor do kit" },
      { key: "{{pagamento_valor_mao_obra}}", desc: "Valor mão de obra" },
      { key: "{{saldo_devedor}}", desc: "Saldo devedor (recibos)" },
    ],
  },
  {
    group: "Projeto",
    vars: [
      { key: "{{projeto_nome}}", desc: "Nome do projeto" },
      { key: "{{projeto_numero}}", desc: "Nº do projeto" },
      { key: "{{projeto_potencia}}", desc: "Potência em kWp" },
      { key: "{{projeto_valor_total}}", desc: "Valor total do contrato" },
      { key: "{{projeto_status}}", desc: "Status atual" },
      { key: "{{projeto_endereco_completo}}", desc: "Endereço da instalação" },
    ],
  },
  {
    group: "Financeiro / Recibo",
    vars: [
      { key: "{{valor_recibo}}", desc: "Valor do recibo (R$)" },
      { key: "{{valor_por_extenso}}", desc: "Valor por extenso" },
      { key: "{{numero_recibo}}", desc: "Nº sequencial do recibo" },
      { key: "{{data_pagamento}}", desc: "Data do pagamento" },
      { key: "{{forma_pagamento}}", desc: "Método de pagamento" },
      { key: "{{descricao}}", desc: "Motivo do recebimento" },
    ],
  },
  {
    group: "Data/Hora",
    vars: [
      { key: "{{data_atual}}", desc: "Data hoje (dd/mm/aaaa)" },
      { key: "{{data_extenso}}", desc: "Data hoje por extenso" },
    ],
  },
];

