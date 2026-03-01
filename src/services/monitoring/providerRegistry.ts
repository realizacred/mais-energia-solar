/**
 * Provider Registry — SSOT for all monitoring providers.
 * Each provider defines its modes, credential fields, and availability.
 */

export type ConnectionMode = "api" | "portal" | "api_key";

export interface CredentialField {
  key: string;
  label: string;
  type: "text" | "email" | "password";
  placeholder: string;
  required: boolean;
}

export interface ProviderMode {
  id: ConnectionMode;
  label: string;
  description: string;
  fields: CredentialField[];
}

export interface ProviderDefinition {
  id: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
  available: boolean;
  modes: ProviderMode[];
}

export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  {
    id: "solarman_business",
    label: "Solarman Business",
    description: "Monitoramento via Solarman Business API — usinas, inversores e métricas em tempo real.",
    icon: "Sun",
    available: true,
    modes: [
      {
        id: "api",
        label: "API (Recomendado)",
        description: "Integração oficial via API. Mais estável e confiável. Requer App ID e App Secret da plataforma.",
        fields: [
          { key: "email", label: "E-mail Solarman", type: "email", placeholder: "seu@email.com", required: true },
          { key: "password", label: "Senha", type: "password", placeholder: "Senha do Solarman", required: true },
        ],
      },
      {
        id: "portal",
        label: "Portal (Login direto)",
        description: "Conexão via login do portal Solarman. Funcionalidades podem ser limitadas.",
        fields: [
          { key: "login", label: "Login (e-mail)", type: "email", placeholder: "seu@email.com", required: true },
          { key: "password", label: "Senha", type: "password", placeholder: "Senha do portal", required: true },
        ],
      },
    ],
  },
  {
    id: "solis_cloud",
    label: "Solis Cloud",
    description: "Monitoramento de inversores Solis via Solis Cloud API.",
    icon: "CloudSun",
    available: false,
    modes: [
      {
        id: "api",
        label: "API",
        description: "Integração via API Key e Secret do Solis Cloud.",
        fields: [
          { key: "apiKey", label: "API Key", type: "text", placeholder: "Sua API Key", required: true },
          { key: "apiSecret", label: "API Secret", type: "password", placeholder: "Seu API Secret", required: true },
        ],
      },
    ],
  },
  {
    id: "growatt",
    label: "Growatt ShineServer",
    description: "Monitoramento de inversores Growatt via ShineServer.",
    icon: "Sprout",
    available: false,
    modes: [
      {
        id: "portal",
        label: "Portal",
        description: "Login com credenciais do ShineServer.",
        fields: [
          { key: "login", label: "Usuário", type: "text", placeholder: "Seu usuário", required: true },
          { key: "password", label: "Senha", type: "password", placeholder: "Sua senha", required: true },
        ],
      },
    ],
  },
  {
    id: "huawei_fusionsolar",
    label: "Huawei FusionSolar",
    description: "Monitoramento de inversores Huawei via FusionSolar.",
    icon: "Cpu",
    available: false,
    modes: [
      {
        id: "api",
        label: "API",
        description: "Integração via API do FusionSolar (northbound interface).",
        fields: [
          { key: "username", label: "Usuário", type: "text", placeholder: "Seu usuário", required: true },
          { key: "password", label: "Senha", type: "password", placeholder: "Sua senha", required: true },
          { key: "systemCode", label: "System Code", type: "text", placeholder: "Código do sistema", required: true },
        ],
      },
    ],
  },
  {
    id: "goodwe_sems",
    label: "GoodWe SEMS",
    description: "Monitoramento de inversores GoodWe via SEMS Portal.",
    icon: "Gauge",
    available: false,
    modes: [
      {
        id: "portal",
        label: "Portal",
        description: "Login com credenciais do SEMS Portal.",
        fields: [
          { key: "email", label: "E-mail", type: "email", placeholder: "seu@email.com", required: true },
          { key: "password", label: "Senha", type: "password", placeholder: "Sua senha", required: true },
        ],
      },
    ],
  },
  {
    id: "sungrow",
    label: "Sungrow iSolarCloud",
    description: "Monitoramento de inversores Sungrow via iSolarCloud.",
    icon: "SunDim",
    available: false,
    modes: [
      {
        id: "portal",
        label: "Portal",
        description: "Login com credenciais do iSolarCloud.",
        fields: [
          { key: "email", label: "E-mail", type: "email", placeholder: "seu@email.com", required: true },
          { key: "password", label: "Senha", type: "password", placeholder: "Sua senha", required: true },
        ],
      },
    ],
  },
  {
    id: "solaredge",
    label: "SolarEdge",
    description: "Monitoramento de inversores SolarEdge via API Key.",
    icon: "Zap",
    available: true,
    modes: [
      {
        id: "api_key",
        label: "API Key",
        description: "Integração via API Key gerada no portal SolarEdge Monitoring.",
        fields: [
          { key: "apiKey", label: "API Key", type: "text", placeholder: "Sua API Key do SolarEdge", required: true },
          { key: "siteId", label: "Site ID (opcional)", type: "text", placeholder: "ID do site (ex: 123456)", required: false },
          { key: "email", label: "E-mail (opcional)", type: "email", placeholder: "seu@email.com", required: false },
          { key: "password", label: "Senha (opcional)", type: "password", placeholder: "Senha do portal", required: false },
        ],
      },
    ],
  },
];

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDER_REGISTRY.find((p) => p.id === id);
}
