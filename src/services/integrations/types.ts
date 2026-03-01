/** Types for the Integration Framework V2 */

export interface CredentialField {
  key: string;
  label: string;
  type: "text" | "email" | "password" | "select";
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  helperText?: string;
}

export interface TutorialData {
  steps: string[];
  notes?: string;
}

export type ProviderStatus = "available" | "coming_soon" | "maintenance";
export type ConnectionStatus = "disconnected" | "connected" | "error" | "maintenance";
export type IntegrationCategory =
  | "monitoring"
  | "crm"
  | "storage"
  | "calendar"
  | "email"
  | "messaging"
  | "meetings"
  | "billing"
  | "nf"
  | "api"
  | "automation"
  | "signature";

export interface IntegrationProvider {
  id: string;
  category: IntegrationCategory;
  label: string;
  description: string;
  logo_key: string | null;
  status: ProviderStatus;
  auth_type: string;
  credential_schema: CredentialField[];
  tutorial: TutorialData;
  capabilities: Record<string, boolean>;
  platform_managed_keys: boolean;
  popularity: number;
  created_at: string;
  updated_at: string;
}

export interface IntegrationConnection {
  id: string;
  tenant_id: string;
  provider_id: string;
  status: ConnectionStatus;
  credentials: Record<string, unknown>;
  tokens: Record<string, unknown>;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationJob {
  id: string;
  tenant_id: string;
  provider_id: string;
  connection_id: string | null;
  job_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  stats: Record<string, unknown>;
  error: string | null;
  created_at: string;
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  monitoring: "Monitoramento Solar",
  crm: "CRM",
  storage: "Armazenamento",
  calendar: "Calendário",
  email: "E-mail",
  messaging: "Mensagens",
  meetings: "Reuniões",
  billing: "Cobranças / Financeiro",
  nf: "Notas Fiscais",
  api: "API",
  automation: "Automação",
  signature: "Assinatura Digital",
};

export const CATEGORY_ICONS: Record<IntegrationCategory, string> = {
  monitoring: "Sun",
  crm: "Users",
  storage: "HardDrive",
  calendar: "Calendar",
  email: "Mail",
  messaging: "MessageCircle",
  meetings: "Video",
  billing: "CreditCard",
  nf: "ReceiptText",
  api: "Globe",
  automation: "Workflow",
  signature: "FileSignature",
};
