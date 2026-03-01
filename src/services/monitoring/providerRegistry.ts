/**
 * Provider Registry — SSOT for ALL monitoring providers (80+).
 * Each provider defines its auth type, credential fields, capabilities, and availability.
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
  status: ProviderStatus;
  auth_type: AuthType;
  fields: CredentialField[];
  capabilities: ProviderCapabilities;
  api_docs_url?: string;
  rate_limit_rpm?: number;
}

// ─── Reusable field templates ────────────────────────────────────
const F_EMAIL: CredentialField = { key: "email", label: "E-mail", type: "email", placeholder: "seu@email.com", required: true };
const F_PASSWORD: CredentialField = { key: "password", label: "Senha", type: "password", placeholder: "Senha", required: true };
const F_USER: CredentialField = { key: "username", label: "Usuário", type: "text", placeholder: "Seu usuário", required: true };
const F_API_KEY: CredentialField = { key: "apiKey", label: "API Key", type: "text", placeholder: "Sua API Key", required: true };
const F_API_SECRET: CredentialField = { key: "apiSecret", label: "API Secret", type: "password", placeholder: "Seu API Secret", required: true };
const F_APP_ID: CredentialField = { key: "appId", label: "App ID", type: "text", placeholder: "Seu App ID", required: true };
const F_APP_SECRET: CredentialField = { key: "appSecret", label: "App Secret", type: "password", placeholder: "Seu App Secret", required: true };
const F_TOKEN: CredentialField = { key: "token", label: "Token de Acesso", type: "password", placeholder: "Seu token", required: true };

const FULL_CAP: ProviderCapabilities = { sync_plants: true, sync_health: true, sync_events: true, sync_readings: true };
const BASIC_CAP: ProviderCapabilities = { sync_plants: true, sync_health: true, sync_events: false, sync_readings: true };
const STUB_CAP: ProviderCapabilities = { sync_plants: true, sync_health: true, sync_events: false, sync_readings: false };

function portalProvider(id: string, label: string, desc: string, icon = "Sun", status: ProviderStatus = "active"): ProviderDefinition {
  return {
    id, label, description: desc, icon, status, auth_type: "portal",
    fields: [F_EMAIL, F_PASSWORD], capabilities: BASIC_CAP,
  };
}

function apiKeyProvider(id: string, label: string, desc: string, icon = "Sun", status: ProviderStatus = "active"): ProviderDefinition {
  return {
    id, label, description: desc, icon, status, auth_type: "api_key",
    fields: [F_API_KEY], capabilities: BASIC_CAP,
  };
}

export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  // ══════════════════════════════════════════════════════════════
  // ACTIVE — fully implemented sync adapters with real API calls
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
    description: "Inversores Growatt via OSS API ou ShineServer.",
    icon: "Sprout", status: "active", auth_type: "portal", capabilities: FULL_CAP, rate_limit_rpm: 30,
    api_docs_url: "https://openapi.growatt.com",
    fields: [F_USER, F_PASSWORD],
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
    fields: [F_USER, F_PASSWORD, { key: "systemCode", label: "System Code", type: "text", placeholder: "Código do sistema", required: true }],
  },
  {
    id: "goodwe", label: "GoodWe SEMS",
    description: "Inversores GoodWe via SEMS Portal API.",
    icon: "Gauge", status: "active", auth_type: "portal", capabilities: FULL_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },
  {
    id: "fronius", label: "Fronius Solar.web",
    description: "Inversores Fronius via Solar.web API ou Fronius Solar API.",
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
  {
    id: "shinemonitor", label: "ShineMonitor",
    description: "Monitoramento ShineMonitor multi-marca.",
    icon: "Sun", status: "active", auth_type: "portal", capabilities: BASIC_CAP,
    fields: [F_USER, F_PASSWORD],
  },
  {
    id: "apsystems", label: "APsystems",
    description: "Microinversores APsystems via EMA Cloud.",
    icon: "Radio", status: "active", auth_type: "portal", capabilities: BASIC_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },
  {
    id: "enphase", label: "Enphase",
    description: "Microinversores Enphase via Enlighten API v4.",
    icon: "Radio", status: "active", auth_type: "api_key", capabilities: FULL_CAP,
    api_docs_url: "https://developer-v4.enphase.com",
    fields: [F_API_KEY, { key: "clientId", label: "Client ID", type: "text", placeholder: "OAuth Client ID", required: false }, F_API_SECRET],
  },
  {
    id: "sunny_portal", label: "Sunny Portal (SMA)",
    description: "Inversores SMA via Sunny Portal / SMA API.",
    icon: "Sun", status: "active", auth_type: "api_key", capabilities: FULL_CAP,
    api_docs_url: "https://developer.sma.de",
    fields: [F_API_KEY, { key: "plantId", label: "Plant ID", type: "text", placeholder: "ID da planta SMA", required: false }],
  },
  {
    id: "sofar", label: "Sofar Solar",
    description: "Inversores Sofar via SolarMAN/Sofar Cloud API.",
    icon: "Sun", status: "active", auth_type: "api_token", capabilities: FULL_CAP,
    fields: [F_APP_ID, F_APP_SECRET, F_EMAIL, F_PASSWORD],
  },
  {
    id: "kstar", label: "KSTAR",
    description: "Inversores KSTAR via KSTAR Cloud API.",
    icon: "Sun", status: "active", auth_type: "portal", capabilities: BASIC_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },
  {
    id: "intelbras", label: "Intelbras ISG",
    description: "Inversores Intelbras via ISG Web API.",
    icon: "Sun", status: "active", auth_type: "portal", capabilities: BASIC_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },
  {
    id: "ecosolys", label: "EcoSolys",
    description: "Monitoramento EcoSolys para inversores string.",
    icon: "Sun", status: "active", auth_type: "portal", capabilities: BASIC_CAP,
    fields: [F_EMAIL, F_PASSWORD],
  },

  // ══════════════════════════════════════════════════════════════
  // ACTIVE — Portal-based providers (credential storage + future API)
  // ══════════════════════════════════════════════════════════════
  portalProvider("growatt_server", "Growatt Server", "Monitoramento Growatt via servidor alternativo.", "Sprout"),
  portalProvider("solplanet", "Solplanet", "Inversores Solplanet (AISWEI) via Solplanet Cloud."),
  portalProvider("elekeeper", "Elekeeper", "Monitoramento Elekeeper para inversores com gateway RS485/WiFi."),
  portalProvider("phb_solar", "PHB Solar", "Inversores PHB Solar via portal de monitoramento."),
  portalProvider("sunweg", "SunWeg", "Inversores SunWeg via SunWeg Cloud."),
  portalProvider("renovigi", "Renovigi", "Inversores/distribuidora Renovigi via portal."),
  portalProvider("chint_flexom", "Chint FlexOM", "Inversores Chint/Astronergy via FlexOM Cloud."),
  apiKeyProvider("csi_cloudpro", "CSI CloudPro", "Canadian Solar via CloudPro API."),
  portalProvider("solarview", "SolarView", "Monitoramento SolarView para micro/string inversores."),
  portalProvider("livoltek", "Livoltek", "Inversores Livoltek/Axitec via portal."),
  portalProvider("solarman_smart", "Solarman Smart", "Versão Smart do Solarman para instaladores individuais."),
  portalProvider("kehua", "Kehua", "Inversores Kehua via portal de monitoramento."),
  portalProvider("weg_iot", "WEG IoT", "Inversores WEG via plataforma IoT."),
  portalProvider("refusol", "REFUlog (Refusol)", "Inversores REFUsol/REFU via REFUlog."),
  portalProvider("solarnex", "Solarnex PRO", "Monitoramento Solarnex PRO para integradores."),
  portalProvider("tsun_pro", "TSUN PRO", "Microinversores TSUN PRO via portal."),
  portalProvider("renac", "RENAC", "Inversores RENAC via portal de monitoramento."),
  portalProvider("nep_viewer", "NEP Viewer", "Microinversores NEP via NEP Viewer.", "Radio"),
  portalProvider("intelbras_plus", "Intelbras Plus", "Inversores Intelbras via plataforma Plus."),
  portalProvider("fimer", "Fimer (ABB)", "Inversores Fimer/ABB via Aurora Vision."),
  portalProvider("byd", "BYD", "Baterias/inversores BYD via BYD Connect."),
  portalProvider("auxsol", "AUXSOL", "Monitoramento AUXSOL para distribuidores."),
  portalProvider("sices", "Sices", "Monitoramento Sices Solar para instaladores."),
  portalProvider("ge_solar", "GE Solar", "Inversores GE Solar via portal."),
  portalProvider("wdc_solar", "WDC Solar", "Inversores WDC Solar via portal."),
  portalProvider("sunwave", "Sunwave", "Inversores Sunwave via portal."),
  portalProvider("nansen", "NANSEN", "Medidores/inversores NANSEN via portal."),
  apiKeyProvider("csi_smart_energy", "CSI Smart Energy", "Canadian Solar Smart Energy API."),
  portalProvider("smten", "SMTEN", "Inversores SMTEN via portal cloud."),
  portalProvider("elgin", "Elgin", "Inversores Elgin via portal de monitoramento."),
  portalProvider("hypon_cloud", "Hypon Cloud", "Inversores Hypon via cloud."),
  apiKeyProvider("csi_cloud", "CSI Cloud", "Canadian Solar CSI Cloud."),
  portalProvider("wdc_solar_cf", "WDC Solar Cliente Final", "Portal WDC para clientes finais."),
  portalProvider("intelbras_send", "Intelbras Send", "Inversores Intelbras via Send."),
  portalProvider("hopewind", "Hopewind", "Inversores Hopewind via portal."),
  portalProvider("intelbras_x", "Intelbras X", "Plataforma Intelbras X."),
  portalProvider("renovigi_portal", "Renovigi Portal", "Portal Renovigi para distribuidores."),
  portalProvider("elsys", "Elsys", "Inversores Elsys via portal."),
  portalProvider("ingeteam", "Ingeteam", "Inversores Ingeteam via IngeManager."),
  portalProvider("pvhub", "PV HUB", "Monitoramento PV HUB multi-marca."),
  portalProvider("dessmonitor", "Dessmonitor", "Inversores DESS via Dessmonitor."),
  portalProvider("smartess", "SmartESS", "Inversores SmartESS/Megarevo via portal."),
  portalProvider("bedin_solar", "Bedin Solar", "Monitoramento Bedin Solar."),
  portalProvider("ksolare", "Ksolare", "Monitoramento Ksolare."),
  portalProvider("livoltek_cf", "Livoltek Cliente Final", "Portal Livoltek para clientes finais."),
  portalProvider("tsun", "TSUN", "Microinversores TSUN via portal padrão.", "Radio"),
  portalProvider("afore", "Afore", "Inversores Afore via portal."),
  portalProvider("dah_solar", "DAH Solar", "Módulos/inversores DAH Solar via portal."),
  portalProvider("empalux", "Empalux", "Inversores Empalux via portal."),
  portalProvider("hopewind_shine", "Hopewind ShineMonitor", "Hopewind integrado via ShineMonitor."),
  portalProvider("hypon_portal", "Hypon Portal", "Portal Hypon para instaladores."),
  portalProvider("litto", "Litto", "Inversores Litto via portal."),
  portalProvider("leveros", "Leveros", "Inversores Leveros via portal."),
  portalProvider("moso", "Moso (B&B)", "Inversores Moso/B&B via portal."),
  portalProvider("pv123", "PV123", "Monitoramento PV123 multi-marca."),
  portalProvider("qcells", "QCELLS", "Inversores/módulos QCELLS via Q.Cloud."),
  portalProvider("sacolar", "Sacolar", "Monitoramento Sacolar."),
  portalProvider("solar_must", "Solar Must", "Inversores Solar Must via portal."),
  portalProvider("zevercloud", "ZeverCloud", "Inversores Zeversolar via ZeverCloud.", "Cloud"),
];

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

/** Legacy ID mapping (old provider IDs → new canonical IDs) */
export const LEGACY_ID_MAP: Record<string, string> = {
  solarman_business_api: "solarman_business",
  goodwe_sems: "goodwe",
  huawei_fusionsolar: "huawei",
  sungrow_isolarcloud: "sungrow",
  hoymiles_s_miles: "hoymiles",
};

export function resolveProviderId(id: string): string {
  return LEGACY_ID_MAP[id] || id;
}
