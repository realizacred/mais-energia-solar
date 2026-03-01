/**
 * Provider Registry — SSOT for all monitoring providers.
 * Each provider defines its auth type, credential fields, and availability.
 */

export type AuthType = "api_token" | "api_key" | "portal" | "token_app";

export interface CredentialField {
  key: string;
  label: string;
  type: "text" | "email" | "password" | "select";
  placeholder: string;
  required: boolean;
  options?: { value: string; label: string }[];
  helperText?: string;
}

export interface ProviderDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  auth_type: AuthType;
  fields: CredentialField[];
  /** Whether sync is fully implemented in the backend */
  sync_implemented: boolean;
}

/** Providers with sync implemented — used by UI to decide button state */
export const SYNC_IMPLEMENTED_PROVIDERS = new Set(["solarman_business_api", "solaredge", "solis_cloud", "deye_cloud"]);

export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  // ── Available now ──
  {
    id: "solarman_business_api",
    label: "Solarman Business",
    description: "Monitoramento via Solarman Business API — usinas, inversores e métricas em tempo real.",
    icon: "Sun",
    available: true,
    auth_type: "api_token",
    sync_implemented: true,
    fields: [
      { key: "appId", label: "App ID", type: "text", placeholder: "Ex: 201911067156002", required: true },
      { key: "appSecret", label: "App Secret", type: "password", placeholder: "Seu App Secret", required: true },
      { key: "email", label: "E-mail Solarman", type: "email", placeholder: "seu@email.com", required: true },
      { key: "password", label: "Senha", type: "password", placeholder: "Senha do Solarman", required: true },
    ],
  },
  {
    id: "solis_cloud",
    label: "Solis Cloud",
    description: "Monitoramento de inversores Solis via SolisCloud Platform API V2.0.",
    icon: "CloudSun",
    available: true,
    auth_type: "api_key",
    sync_implemented: true,
    fields: [
      { key: "apiId", label: "API ID (KeyID)", type: "text", placeholder: "Seu API ID", required: true },
      { key: "apiSecret", label: "API Secret (KeySecret)", type: "password", placeholder: "Seu API Secret", required: true },
    ],
  },
  {
    id: "solaredge",
    label: "SolarEdge",
    description: "Monitoramento de inversores SolarEdge via API Key.",
    icon: "Zap",
    available: true,
    auth_type: "api_key",
    sync_implemented: true,
    fields: [
      { key: "apiKey", label: "API Key", type: "text", placeholder: "Sua API Key do SolarEdge", required: true },
    ],
  },
  {
    id: "deye_cloud",
    label: "Deye Cloud",
    description: "Monitoramento de inversores Deye via DeyeCloud Developer API — usinas e métricas em tempo real.",
    icon: "Cloud",
    available: true,
    auth_type: "token_app",
    sync_implemented: true,
    fields: [
      {
        key: "region",
        label: "Região",
        type: "select",
        placeholder: "Selecione a região",
        required: true,
        options: [
          { value: "EU", label: "Europa (EU)" },
          { value: "US", label: "América (US)" },
        ],
        helperText: "A URL base da API muda conforme a região selecionada.",
      },
      { key: "appId", label: "App ID", type: "text", placeholder: "Seu App ID do Developer Portal", required: true },
      { key: "appSecret", label: "App Secret", type: "password", placeholder: "Seu App Secret", required: true },
      { key: "email", label: "E-mail", type: "email", placeholder: "seu@email.com", required: true },
      { key: "password", label: "Senha", type: "password", placeholder: "Senha da sua conta Deye Cloud", required: true },
    ],
  },

  // ── Coming soon ──
  {
    id: "growatt",
    label: "Growatt ShineServer",
    description: "Monitoramento de inversores Growatt via ShineServer.",
    icon: "Sprout",
    available: false,
    auth_type: "portal",
    sync_implemented: false,
    fields: [
      { key: "login", label: "Usuário", type: "text", placeholder: "Seu usuário", required: true },
      { key: "password", label: "Senha", type: "password", placeholder: "Sua senha", required: true },
    ],
  },
  {
    id: "huawei_fusionsolar",
    label: "Huawei FusionSolar",
    description: "Monitoramento de inversores Huawei via FusionSolar.",
    icon: "Cpu",
    available: false,
    auth_type: "api_token",
    sync_implemented: false,
    fields: [
      { key: "username", label: "Usuário", type: "text", placeholder: "Seu usuário", required: true },
      { key: "password", label: "Senha", type: "password", placeholder: "Sua senha", required: true },
      { key: "systemCode", label: "System Code", type: "text", placeholder: "Código do sistema", required: true },
    ],
  },
  {
    id: "goodwe_sems",
    label: "GoodWe SEMS",
    description: "Monitoramento de inversores GoodWe via SEMS Portal.",
    icon: "Gauge",
    available: false,
    auth_type: "portal",
    sync_implemented: false,
    fields: [
      { key: "email", label: "E-mail", type: "email", placeholder: "seu@email.com", required: true },
      { key: "password", label: "Senha", type: "password", placeholder: "Sua senha", required: true },
    ],
  },
  {
    id: "sungrow_isolarcloud",
    label: "Sungrow iSolarCloud",
    description: "Monitoramento de inversores Sungrow via iSolarCloud.",
    icon: "SunDim",
    available: false,
    auth_type: "api_key",
    sync_implemented: false,
    fields: [
      { key: "email", label: "E-mail", type: "email", placeholder: "seu@email.com", required: true },
      { key: "password", label: "Senha", type: "password", placeholder: "Sua senha", required: true },
    ],
  },
  {
    id: "hoymiles_s_miles",
    label: "Hoymiles S-Miles",
    description: "Monitoramento de microinversores Hoymiles via S-Miles Cloud.",
    icon: "Radio",
    available: false,
    auth_type: "api_key",
    sync_implemented: false,
    fields: [
      { key: "login", label: "Usuário", type: "text", placeholder: "Seu usuário S-Miles", required: true },
      { key: "password", label: "Senha", type: "password", placeholder: "Sua senha", required: true },
    ],
  },
];

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDER_REGISTRY.find((p) => p.id === id);
}
