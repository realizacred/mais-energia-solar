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
  updated_at: string;
}

// Available template variables for the variables panel
export const TEMPLATE_VARIABLES = [
  { group: "Cliente", vars: [
    { key: "{{cliente.nome}}", desc: "Nome completo" },
    { key: "{{cliente.cpf_cnpj}}", desc: "CPF ou CNPJ" },
    { key: "{{cliente.endereco_completo}}", desc: "Endereço formatado" },
    { key: "{{cliente.telefone}}", desc: "Telefone" },
    { key: "{{cliente.email}}", desc: "E-mail" },
  ]},
  { group: "Projeto", vars: [
    { key: "{{projeto.potencia_kwp}}", desc: "Potência em kWp" },
    { key: "{{projeto.concessionaria}}", desc: "Concessionária" },
    { key: "{{projeto.telhado_tipo}}", desc: "Tipo de telhado" },
    { key: "{{projeto.num_modulos}}", desc: "Nº de módulos" },
    { key: "{{projeto.inversor}}", desc: "Inversor" },
  ]},
  { group: "Venda", vars: [
    { key: "{{venda.valor_total}}", desc: "Valor total" },
    { key: "{{venda.entrada}}", desc: "Valor de entrada" },
    { key: "{{venda.num_parcelas}}", desc: "Nº de parcelas" },
    { key: "{{venda.data_venda}}", desc: "Data da venda" },
  ]},
  { group: "Empresa", vars: [
    { key: "{{empresa.nome}}", desc: "Razão social" },
    { key: "{{empresa.cnpj}}", desc: "CNPJ" },
    { key: "{{empresa.endereco}}", desc: "Endereço" },
  ]},
  { group: "Parcelas (loop)", vars: [
    { key: "{{#parcelas}}", desc: "Início do loop" },
    { key: "{{numero}}", desc: "Nº da parcela" },
    { key: "{{valor}}", desc: "Valor da parcela" },
    { key: "{{vencimento}}", desc: "Data vencimento" },
    { key: "{{/parcelas}}", desc: "Fim do loop" },
  ]},
];
