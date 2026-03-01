/**
 * Provider Registry — SSOT for ALL monitoring providers.
 * Each provider defines its auth type, credential fields, capabilities, and availability.
 *
 * STATUS KEY:
 * - "active"      → connect + sync plants + sync metrics (PRODUCTION)
 * - "beta"        → connect + sync plants, partial metrics or credential-only
 * - "stub"        → generic portal login, NO real API adapter
 * - "coming_soon" → listed for visibility, not functional
 */

export type AuthType = "api_token" | "api_key" | "portal" | "token_app" | "oauth2" | "basic";

export interface CredentialField {
  key: string;
  label: string;
  type: "text" | "email" | "password" | "select";
  placeholder: string;
  required: boolean;
  options?: { value: string; label: string }[];
  helperText?: string;
}

export interface ProviderCapabilities {
  sync_plants: boolean;
  sync_health: boolean;
  sync_events: boolean;
  sync_readings: boolean;
  realtime?: boolean;
}

export type ProviderStatus = "active" | "beta" | "stub" | "coming_soon" | "maintenance";

export interface ProviderDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: "monitoring";
  status: ProviderStatus;
  auth_type: AuthType;
  fields: CredentialField[];
  capabilities: ProviderCapabilities;
  api_docs_url?: string;
  rate_limit_rpm?: number;
  legacy_ids?: string[];
}

// ─── Reusable field templates ────────────────────────────────────
const F_EMAIL: CredentialField = { key: "email", label: "E-mail", type: "email", placeholder: "seu@email.com", required: true };
const F_PASSWORD: CredentialField = { key: "password", label: "Senha", type: "password", placeholder: "Senha", required: true };
const F_USER: CredentialField = { key: "username", label: "Usuário", type: "text", placeholder: "Seu usuário", required: true };
const F_API_KEY: CredentialField = { key: "apiKey", label: "API Key", type: "text", placeholder: "Sua API Key", required: true };
const F_API_SECRET: CredentialField = { key: "apiSecret", label: "API Secret", type: "password", placeholder: "Seu API Secret", required: true };
const F_APP_ID: CredentialField = { key: "appId", label: "App ID", type: "text", placeholder: "Seu App ID", required: true };
const F_APP_SECRET: CredentialField = { key: "appSecret", label: "App Secret", type: "password", placeholder: "Seu App Secret", required: true };

const FULL_CAP: ProviderCapabilities = { sync_plants: true, sync_health: true, sync_events: true, sync_readings: true };
const BASIC_CAP: ProviderCapabilities = { sync_plants: true, sync_health: true, sync_events: false, sync_readings: true };
const PLANTS_ONLY_CAP: ProviderCapabilities = { sync_plants: true, sync_health: false, sync_events: false, sync_readings: false };
const STUB_CAP: ProviderCapabilities = { sync_plants: false, sync_health: false, sync_events: false, sync_readings: false };

function stubProvider(id: string, label: string, desc: string, icon = "Sun"): ProviderDefinition {
  return {
    id, label, description: desc, icon, category: "monitoring", status: "stub", auth_type: "portal",
    fields: [F_EMAIL, F_PASSWORD], capabilities: STUB_CAP,
  };
}

export const PROVIDER_REGISTRY: ProviderDefinition[] = ([
  // All entries below are monitoring providers; category is injected automatically at the end
  // PRODUCTION — connect + listPlants + metrics implemented
  // ══════════════════════════════════════════════════════════════
  {
    id: "solarman_business", label: "Solarman Business",
    description: "Monitoramento via Solarman Business API — usinas, inversores e métricas em tempo real.",
    icon: "Sun", status: "active", auth_type: "api_token", capabilities: FULL_CAP, rate_limit_rpm: 60,
    api_docs_url: "https://doc.solarmanpv.com/api/business-api",
    fields: [{ ...F_APP_ID, placeholder: "Ex: 201911067156002" }, F_APP_SECRET, { ...F_EMAIL, label: "E-mail Solarman" }, F_PASSWORD],
  },
  {
    id: "solis_cloud", label: "Solis Cloud",
    description: "Inversores Solis via SolisCloud Platform API V2.0 (HMAC-SHA1).",
    icon: "CloudSun", status: "active", auth_type: "api_key", capabilities: FULL_CAP, rate_limit_rpm: 30,
    api_docs_url: "https://solis-service.solisinverters.com/en/support",
    fields: [
      { key: "apiId", label: "API ID (KeyID)", type: "text", placeholder: "Seu API ID", required: true },
      { key: "apiSecret", label: "API Secret (KeySecret)", type: "password", placeholder: "Seu API Secret", required: true },
    ],
  },
  {
    id: "solaredge", label: "SolarEdge",
    description: "Inversores SolarEdge via API Key — sites, energia, potência.",
    icon: "Zap", status: "active", auth_type: "api_key", capabilities: FULL_CAP, rate_limit_rpm: 300,
    api_docs_url: "https://monitoring.solaredge.com/solaredge-web/p/login",
    fields: [F_API_KEY],
  },
  {
    id: "deye_cloud", label: "Deye Cloud",
    description: "Inversores Deye via DeyeCloud Developer API.",
    icon: "Cloud", status: "active", auth_type: "token_app", capabilities: FULL_CAP, rate_limit_rpm: 60,
    fields: [
      { key: "region", label: "Data Center", type: "select", placeholder: "Selecione o data center", required: true,
        options: [
          { value: "EU", label: "EMEA (Europa / África / Ásia-Pacífico)" },
          { value: "US", label: "AMEA (Américas)" },
          { value: "INDIA", label: "India" },
        ],
        helperText: "Mesmo data center escolhido ao criar sua conta no DeyeCloud." },
      F_APP_ID, F_APP_SECRET, F_EMAIL, F_PASSWORD,
    ],
  },
  {
    id: "growatt", label: "Growatt OSS / ShineServer",
    description: "Inversores Growatt via OSS API, OpenAPI (Key) ou ShineServer (usuário/senha).",
    icon: "Sprout", status: "active", auth_type: "api_key", capabilities: FULL_CAP, rate_limit_rpm: 30,
    api_docs_url: "https://openapi.growatt.com",
    fields: [
      {
        key: "auth_mode", label: "Modo de Autenticação", type: "select", placeholder: "Selecione",
        required: true,
        options: [
          { value: "api_key", label: "API Key (OpenAPI)" },
          { value: "portal", label: "Usuário e Senha (ShineServer)" },
        ],
      },
      { ...F_API_KEY, required: false, helperText: "Obrigatório se modo = API Key" },
      { ...F_USER, required: false, helperText: "Obrigatório se modo = Usuário/Senha" },
      { ...F_PASSWORD, required: false, helperText: "Obrigatório se modo = Usuário/Senha" },
    ],
  },
  {
    id: "hoymiles", label: "Hoymiles S-Miles",
    description: "Microinversores Hoymiles via S-Miles Cloud API.",
    icon: "Radio", status: "active", auth_type: "portal", capabilities: BASIC_CAP,
    fields: [F_USER, F_PASSWORD],
  },
  {
    id: "sungrow", label: "Sungrow iSolarCloud",
    description: "Inversores Sungrow via iSolarCloud API.",
    icon: "SunDim", status: "active", auth_type: "api_key", capabilities: FULL_CAP,
    fields: [F_APP_ID, F_APP_SECRET, F_EMAIL, F_PASSWORD],
  },
  {
    id: "huawei", label: "Huawei FusionSolar",
    description: "Inversores Huawei via FusionSolar Northbound API.",
    icon: "Cpu", status: "active", auth_type: "api_token", capabilities: FULL_CAP,
    api_docs_url: "https://support.huawei.com/enterprise/en/doc/EDOC1100261860",
    fields: [
      {
        key: "region", label: "Região do Portal", type: "select", placeholder: "Selecione a região", required: true,
        options: [
          { value: "la5", label: "América Latina (la5)" },
          { value: "eu5", label: "Europa (eu5)" },
          { value: "sg5", label: "Ásia-Pacífico (sg5)" },
          { value: "au5", label: "Austrália (au5)" },
        ],
        helperText: "Selecione a região do seu portal FusionSolar",
      },
      { key: "username", label: "Usuário de API", type: "text", placeholder: "Ex: SolarZAPI", required: true, helperText: "Usuário criado em Gestão de API (NÃO é o login do portal)" },
      { key: "password", label: "Senha de API", type: "password", placeholder: "Senha do usuário de API", required: true },
    ],
  },
  {
    id: "goodwe", label: "GoodWe SEMS",
    description: "Inversores GoodWe via SEMS Portal API.",
    icon: "Gauge", status: "active", auth_type: "portal", capabilities: FULL_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },
  {
    id: "fronius", label: "Fronius Solar.web",
    description: "Inversores Fronius via Solar.web API.",
    icon: "Sun", status: "active", auth_type: "api_key", capabilities: FULL_CAP,
    api_docs_url: "https://www.fronius.com/en/photovoltaics/products/all-products/system-monitoring/open-interfaces/fronius-solar-api",
    fields: [F_API_KEY, { key: "systemId", label: "System ID", type: "text", placeholder: "ID do sistema", required: false }],
  },
  {
    id: "fox_ess", label: "Fox ESS",
    description: "Inversores Fox ESS via FoxCloud OpenAPI.",
    icon: "Zap", status: "active", auth_type: "api_key", capabilities: FULL_CAP,
    fields: [F_API_KEY],
  },
  {
    id: "solax", label: "Solax Power",
    description: "Inversores SolaX via SolaX Cloud API.",
    icon: "Zap", status: "active", auth_type: "api_key", capabilities: FULL_CAP,
    fields: [F_API_KEY],
  },
  {
    id: "saj", label: "SAJ eSolar",
    description: "Inversores SAJ via eSolar Portal API.",
    icon: "Gauge", status: "active", auth_type: "portal", capabilities: FULL_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },

  // ══════════════════════════════════════════════════════════════
  // BETA — connect + listPlants works, metrics partial or missing
  // ══════════════════════════════════════════════════════════════
  {
    id: "shinemonitor", label: "ShineMonitor",
    description: "Monitoramento ShineMonitor multi-marca. Sincroniza usinas, sem métricas detalhadas.",
    icon: "Sun", status: "beta", auth_type: "portal", capabilities: PLANTS_ONLY_CAP,
    fields: [F_USER, F_PASSWORD],
  },
  {
    id: "enphase", label: "Enphase",
    description: "Microinversores Enphase via Enlighten API v4. Listagem de usinas funcional.",
    icon: "Radio", status: "beta", auth_type: "api_key", capabilities: PLANTS_ONLY_CAP,
    api_docs_url: "https://developer-v4.enphase.com",
    fields: [F_API_KEY, { key: "clientId", label: "Client ID", type: "text", placeholder: "OAuth Client ID", required: false }, F_API_SECRET],
  },
  {
    id: "sofar", label: "Sofar Solar",
    description: "Inversores Sofar via Solarman API (mesma plataforma). Sync completo.",
    icon: "Sun", status: "active", auth_type: "api_token", capabilities: FULL_CAP,
    fields: [F_APP_ID, F_APP_SECRET, F_EMAIL, F_PASSWORD],
  },
  {
    id: "kstar", label: "KSTAR",
    description: "Inversores KSTAR via KSTAR Cloud. Listagem de usinas funcional.",
    icon: "Sun", status: "beta", auth_type: "portal", capabilities: PLANTS_ONLY_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },
  {
    id: "intelbras", label: "Intelbras ISG",
    description: "Inversores Intelbras via ISG Web. Listagem de usinas funcional.",
    icon: "Sun", status: "beta", auth_type: "portal", capabilities: PLANTS_ONLY_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },
  {
    id: "ecosolys", label: "EcoSolys",
    description: "Monitoramento EcoSolys. Listagem de usinas funcional.",
    icon: "Sun", status: "beta", auth_type: "portal", capabilities: PLANTS_ONLY_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },
  {
    id: "apsystems", label: "APsystems",
    description: "Microinversores APsystems via EMA Cloud. Conexão funcional, sync limitado.",
    icon: "Radio", status: "beta", auth_type: "portal", capabilities: PLANTS_ONLY_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },
  {
    id: "sunny_portal", label: "Sunny Portal (SMA)",
    description: "Inversores SMA — armazena credenciais, API não implementada.",
    icon: "Sun", status: "stub", auth_type: "api_key", capabilities: STUB_CAP,
    api_docs_url: "https://developer.sma.de",
    fields: [F_API_KEY, { key: "plantId", label: "Plant ID", type: "text", placeholder: "ID da planta SMA", required: false }],
  },
  {
    id: "csi_cloudpro", label: "CSI CloudPro",
    description: "Canadian Solar via CloudPro — armazena credenciais, API não implementada.",
    icon: "Sun", status: "stub", auth_type: "api_key", capabilities: STUB_CAP,
    fields: [F_API_KEY],
  },
  {
    id: "csi_smart_energy", label: "CSI Smart Energy",
    description: "Canadian Solar Smart Energy — armazena credenciais, API não implementada.",
    icon: "Sun", status: "stub", auth_type: "api_key", capabilities: STUB_CAP,
    fields: [F_API_KEY],
  },
  {
    id: "csi_cloud", label: "CSI Cloud",
    description: "Canadian Solar CSI Cloud — armazena credenciais, API não implementada.",
    icon: "Sun", status: "stub", auth_type: "api_key", capabilities: STUB_CAP,
    fields: [F_API_KEY],
  },

  // ══════════════════════════════════════════════════════════════
  // STUB — Sem API real implementada. Apenas armazena credenciais.
  // ══════════════════════════════════════════════════════════════
  // growatt_server: has real handler in monitoring-connect (testGrowatt portal mode) + monitoring-sync (growattListPlants/growattMetrics)
  {
    id: "growatt_server", label: "Growatt Server",
    description: "Monitoramento Growatt via ShineServer (login por código/senha).",
    icon: "Sprout", status: "active", auth_type: "portal", capabilities: FULL_CAP,
    fields: [
      { ...F_USER, label: "Código / Usuário", placeholder: "Ex: BXYV3001" },
      F_PASSWORD,
    ],
  },
  stubProvider("solplanet", "Solplanet", "Inversores Solplanet (AISWEI) via Solplanet Cloud."),
  stubProvider("elekeeper", "Elekeeper", "Monitoramento Elekeeper para inversores com gateway RS485/WiFi."),
  stubProvider("phb_solar", "PHB Solar", "Inversores PHB Solar via portal de monitoramento."),
  stubProvider("sunweg", "SunWeg", "Inversores SunWeg via SunWeg Cloud."),
  stubProvider("renovigi", "Renovigi", "Inversores/distribuidora Renovigi via portal."),
  stubProvider("chint_flexom", "Chint FlexOM", "Inversores Chint/Astronergy via FlexOM Cloud."),
  stubProvider("solarview", "SolarView", "Monitoramento SolarView para micro/string inversores."),
  stubProvider("livoltek", "Livoltek", "Inversores Livoltek/Axitec via portal."),
  stubProvider("solarman_smart", "Solarman Smart", "Versão Smart do Solarman para instaladores individuais."),
  stubProvider("kehua", "Kehua", "Inversores Kehua via portal de monitoramento."),
  stubProvider("weg_iot", "WEG IoT", "Inversores WEG via plataforma IoT."),
  stubProvider("refusol", "REFUlog (Refusol)", "Inversores REFUsol/REFU via REFUlog."),
  stubProvider("solarnex", "Solarnex PRO", "Monitoramento Solarnex PRO para integradores."),
  stubProvider("tsun_pro", "TSUN PRO", "Microinversores TSUN PRO via portal."),
  stubProvider("renac", "RENAC", "Inversores RENAC via portal de monitoramento."),
  stubProvider("nep_viewer", "NEP Viewer", "Microinversores NEP via NEP Viewer.", "Radio"),
  stubProvider("intelbras_plus", "Intelbras Plus", "Inversores Intelbras via plataforma Plus."),
  stubProvider("fimer", "Fimer (ABB)", "Inversores Fimer/ABB via Aurora Vision."),
  stubProvider("byd", "BYD", "Baterias/inversores BYD via BYD Connect."),
  stubProvider("auxsol", "AUXSOL", "Monitoramento AUXSOL para distribuidores."),
  stubProvider("sices", "Sices", "Monitoramento Sices Solar para instaladores."),
  stubProvider("ge_solar", "GE Solar", "Inversores GE Solar via portal."),
  stubProvider("wdc_solar", "WDC Solar", "Inversores WDC Solar via portal."),
  stubProvider("sunwave", "Sunwave", "Inversores Sunwave via portal."),
  stubProvider("nansen", "NANSEN", "Medidores/inversores NANSEN via portal."),
  stubProvider("smten", "SMTEN", "Inversores SMTEN via portal cloud."),
  stubProvider("elgin", "Elgin", "Inversores Elgin via portal de monitoramento."),
  stubProvider("hypon_cloud", "Hypon Cloud", "Inversores Hypon via cloud."),
  stubProvider("wdc_solar_cf", "WDC Solar Cliente Final", "Portal WDC para clientes finais."),
  stubProvider("intelbras_send", "Intelbras Send", "Inversores Intelbras via Send."),
  stubProvider("hopewind", "Hopewind", "Inversores Hopewind via portal."),
  stubProvider("intelbras_x", "Intelbras X", "Plataforma Intelbras X."),
  stubProvider("renovigi_portal", "Renovigi Portal", "Portal Renovigi para distribuidores."),
  stubProvider("elsys", "Elsys", "Inversores Elsys via portal."),
  stubProvider("ingeteam", "Ingeteam", "Inversores Ingeteam via IngeManager."),
  stubProvider("pvhub", "PV HUB", "Monitoramento PV HUB multi-marca."),
  stubProvider("dessmonitor", "Dessmonitor", "Inversores DESS via Dessmonitor."),
  stubProvider("smartess", "SmartESS", "Inversores SmartESS/Megarevo via portal."),
  stubProvider("bedin_solar", "Bedin Solar", "Monitoramento Bedin Solar."),
  stubProvider("ksolare", "Ksolare", "Monitoramento Ksolare."),
  stubProvider("livoltek_cf", "Livoltek Cliente Final", "Portal Livoltek para clientes finais."),
  stubProvider("tsun", "TSUN", "Microinversores TSUN via portal padrão.", "Radio"),
  stubProvider("afore", "Afore", "Inversores Afore via portal."),
  stubProvider("dah_solar", "DAH Solar", "Módulos/inversores DAH Solar via portal."),
  stubProvider("empalux", "Empalux", "Inversores Empalux via portal."),
  stubProvider("hopewind_shine", "Hopewind ShineMonitor", "Hopewind integrado via ShineMonitor."),
  stubProvider("hypon_portal", "Hypon Portal", "Portal Hypon para instaladores."),
  stubProvider("litto", "Litto", "Inversores Litto via portal."),
  stubProvider("leveros", "Leveros", "Inversores Leveros via portal."),
  stubProvider("moso", "Moso (B&B)", "Inversores Moso/B&B via portal."),
  stubProvider("pv123", "PV123", "Monitoramento PV123 multi-marca."),
  stubProvider("qcells", "QCELLS", "Inversores/módulos QCELLS via Q.Cloud."),
  stubProvider("sacolar", "Sacolar", "Monitoramento Sacolar."),
  stubProvider("solar_must", "Solar Must", "Inversores Solar Must via portal."),
  stubProvider("zevercloud", "ZeverCloud", "Inversores Zeversolar via ZeverCloud.", "Cloud"),
] as Omit<ProviderDefinition, "category">[]).map(p => ({ ...p, category: "monitoring" as const }));

// ─── Helpers ─────────────────────────────────────────────────────

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDER_REGISTRY.find((p) => p.id === id);
}

export function getActiveProviders(): ProviderDefinition[] {
  return PROVIDER_REGISTRY.filter((p) => p.status === "active");
}

export function getImplementedProviderIds(): Set<string> {
  return new Set(PROVIDER_REGISTRY.filter((p) => p.status === "active" || p.status === "beta").map((p) => p.id));
}

/** Legacy ID mapping (old DB/provider IDs → canonical registry IDs) */
export const LEGACY_ID_MAP: Record<string, string> = {
  // DB integration_providers IDs → canonical PROVIDER_REGISTRY IDs
  solarman_business_api: "solarman_business",
  goodwe_sems: "goodwe",
  huawei_fusionsolar: "huawei",
  sungrow_isolarcloud: "sungrow",
  hoymiles_s_miles: "hoymiles",
  foxess: "fox_ess",
  sofar_solar: "sofar",
  sma: "sunny_portal",
  abb_fimer: "fimer",
  must_solar: "solar_must",
  canadian_solar: "csi_cloud",
  kstar: "kstar",
};

export function resolveProviderId(id: string): string {
  return LEGACY_ID_MAP[id] || id;
}

/** Convert a registry ProviderDefinition → IntegrationProvider shape used by CatalogPage */
export function toIntegrationProvider(p: ProviderDefinition): import("@/services/integrations/types").IntegrationProvider {
  return {
    id: p.id,
    category: "monitoring",
    label: p.label,
    description: p.description,
    logo_key: p.icon,
    status: p.status === "active" ? "available" : p.status === "beta" ? "available" : "coming_soon",
    auth_type: p.auth_type,
    credential_schema: p.fields,
    tutorial: { steps: [] },
    capabilities: {
      sync_plants: p.capabilities.sync_plants,
      sync_health: p.capabilities.sync_health,
      sync_events: p.capabilities.sync_events,
      sync_readings: p.capabilities.sync_readings,
    },
    platform_managed_keys: false,
    popularity: p.status === "active" ? 100 : p.status === "beta" ? 50 : 10,
    created_at: "",
    updated_at: "",
  };
}
