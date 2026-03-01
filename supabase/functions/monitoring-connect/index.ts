import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ═══════════════════════════════════════════════════════════
// Shared Crypto Helpers
// ═══════════════════════════════════════════════════════════

async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function md5Base64(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("MD5", new TextEncoder().encode(text));
  return base64Encode(new Uint8Array(hash));
}

async function hmacSha1Base64(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64Encode(new Uint8Array(sig));
}

// ═══════════════════════════════════════════════════════════
// Provider Test Handlers
// ═══════════════════════════════════════════════════════════

// ── Solarman Business API ──
async function testSolarman(creds: Record<string, string>) {
  const appId = creds.appId || Deno.env.get("SOLARMAN_APP_ID") || "";
  const appSecret = creds.appSecret || Deno.env.get("SOLARMAN_APP_SECRET") || "";
  const { email, password } = creds;
  if (!appId || !appSecret || !email || !password) throw new Error("Missing: appId, appSecret, email, password");

  const hashHex = await sha256Hex(password);
  const res = await fetch(`https://api.solarmanpv.com/account/v1.0/token?appId=${encodeURIComponent(appId)}&language=en`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appSecret, email, password: hashHex }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(json.msg || "Solarman auth failed");
  const expiresAt = new Date(Date.now() + (json.expires_in || 7200) * 1000).toISOString();
  return {
    credentials: { appId, email },
    tokens: { access_token: json.access_token, token_type: json.token_type || "bearer", expires_at: expiresAt, uid: json.uid, orgId: json.orgId },
  };
}

// ── SolisCloud Platform API V2.0 ──
async function testSolis(creds: Record<string, string>) {
  const { apiId, apiSecret } = creds;
  if (!apiId || !apiSecret) throw new Error("Missing: apiId, apiSecret");
  const path = "/v1/api/userStationList";
  const bodyStr = JSON.stringify({ pageNo: 1, pageSize: 1 });
  const contentMd5 = await md5Base64(bodyStr);
  const contentType = "application/json;charset=UTF-8";
  const dateStr = new Date().toUTCString();
  const sign = await hmacSha1Base64(apiSecret, `POST\n${contentMd5}\n${contentType}\n${dateStr}\n${path}`);
  const res = await fetch(`https://www.soliscloud.com:13333${path}`, {
    method: "POST",
    headers: { "Content-Type": contentType, "Content-MD5": contentMd5, Date: dateStr, Authorization: `API ${apiId}:${sign}` },
    body: bodyStr,
  });
  const json = await res.json();
  if (!json.success && json.code !== "0") throw new Error(json.msg || `SolisCloud error (code=${json.code})`);
  return { credentials: { apiId }, tokens: { apiSecret } };
}

// ── SolarEdge ──
async function testSolaredge(creds: Record<string, string>) {
  const { apiKey } = creds;
  if (!apiKey) throw new Error("Missing: apiKey");
  const res = await fetch(`https://monitoringapi.solaredge.com/sites/list?api_key=${encodeURIComponent(apiKey)}&size=1`);
  if (!res.ok) { const t = await res.text(); throw new Error(`SolarEdge ${res.status}: ${t.slice(0, 200)}`); }
  await res.json();
  return { credentials: { apiKey }, tokens: {} };
}

// ── Deye Cloud ──
// Docs: https://developer.deyecloud.com/api#/Account%20Operation/getAccountTokenUsingPOST
// Sample: https://github.com/DeyeCloudDevelopers/deye-openapi-client-sample-code
async function testDeye(creds: Record<string, string>) {
  const { region, appId, appSecret, email, password } = creds;
  if (!region || !appId || !appSecret || !email || !password) throw new Error("Missing: region, appId, appSecret, email, password");
  const REGIONS: Record<string, string> = {
    EU: "https://eu1-developer.deyecloud.com/v1.0",
    US: "https://us1-developer.deyecloud.com/v1.0",
    INDIA: "https://india-developer.deyecloud.com/v1.0",
  };
  const baseUrl = REGIONS[region.toUpperCase()];
  if (!baseUrl) throw new Error(`Invalid region: ${region}. Use EU, US, or INDIA.`);

  const hashHex = await sha256Hex(password);

  // Correct endpoint: /v1.0/account/token?appId=XXX (appId as query param)
  const url = `${baseUrl}/account/token?appId=${encodeURIComponent(appId)}`;
  console.log(`[Deye] Requesting token from: ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appSecret, email, password: hashHex }),
  });

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) {
    const t = await res.text();
    console.error(`[Deye] Non-JSON response (${res.status}):`, t.slice(0, 500));
    throw new Error(`Deye returned non-JSON (HTTP ${res.status}): ${t.slice(0, 200)}`);
  }

  const json = await res.json();
  console.log(`[Deye] Response code: ${json.code}, msg: ${json.msg}`);

  // Deye API wraps token data in json.data
  const tokenData = json.data || json;
  if (!tokenData.access_token) {
    throw new Error(json.msg || `Deye auth failed (code=${json.code})`);
  }

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 7200) * 1000).toISOString();
  return {
    credentials: { region, baseUrl, appId, email },
    tokens: {
      access_token: tokenData.access_token,
      token_type: tokenData.token_type || "bearer",
      expires_at: expiresAt,
      refresh_token: tokenData.refresh_token || null,
      appSecret,
    },
  };
}

// ── Growatt ShineServer ──
// Docs: https://growatt.pl/wp-content/uploads/2020/01/Growatt-Server-API-Guide.pdf
// Password must be sent as MD5 hex hash (lowercase)
async function testGrowatt(creds: Record<string, string>) {
  const { username, password } = creds;
  if (!username || !password) throw new Error("Missing: username, password");

  // Growatt API requires MD5-hashed password
  const hashBuffer = await crypto.subtle.digest("MD5", new TextEncoder().encode(password));
  const passwordMd5 = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

  console.log(`[Growatt] Attempting login for user: ${username}`);

  const res = await fetch("https://openapi.growatt.com/newTwoLoginAPI.do", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `userName=${encodeURIComponent(username)}&password=${encodeURIComponent(passwordMd5)}`,
  });

  const ct = res.headers.get("content-type") || "";
  let json: Record<string, any>;
  if (ct.includes("json")) {
    json = await res.json();
  } else {
    const text = await res.text();
    console.error(`[Growatt] Non-JSON response (${res.status}):`, text.slice(0, 500));
    try { json = JSON.parse(text); } catch { throw new Error(`Growatt returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`); }
  }

  console.log(`[Growatt] Response result: ${json.result}, back.success: ${json.back?.success}`);

  if (json.result !== 1 && json.back?.success !== true) {
    throw new Error(json.back?.msg || json.msg || "Growatt login failed");
  }

  const userId = json.back?.userId || json.user?.id || json.userId || "";
  const cookies = res.headers.get("set-cookie") || "";

  return {
    credentials: { username },
    tokens: { userId: String(userId), cookies },
  };
}

// ── Hoymiles S-Miles ──
async function testHoymiles(creds: Record<string, string>) {
  const { username, password } = creds;
  if (!username || !password) throw new Error("Missing: username, password");
  const res = await fetch("https://global.hoymiles.com/platform/api/gateway/iam/auth_login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_name: username, password, mi_type: "en" }),
  });
  const json = await res.json();
  if (json.status !== "0" && json.code !== 0) throw new Error(json.message || "Hoymiles login failed");
  const token = json.data?.token || json.token || "";
  if (!token) throw new Error("Hoymiles: no token returned");
  return { credentials: { username }, tokens: { token } };
}

// ── Sungrow iSolarCloud ──
async function testSungrow(creds: Record<string, string>) {
  const appKey = creds.appId || creds.appKey || "";
  const userAccount = creds.email || creds.username || "";
  const userPassword = creds.password || "";
  if (!appKey || !userAccount || !userPassword) throw new Error("Missing: appKey, account, password");
  const res = await fetch("https://gateway.isolarcloud.com/v1/userService/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appkey: appKey, user_account: userAccount, user_password: userPassword, login_type: "1" }),
  });
  const json = await res.json();
  if (json.result_code !== "1" && json.result_code !== 1) throw new Error(json.result_msg || "Sungrow login failed");
  const token = json.result_data?.token || "";
  return { credentials: { appKey, userAccount }, tokens: { token, userId: json.result_data?.user_id || "" } };
}

// ── Huawei FusionSolar ──
async function testHuawei(creds: Record<string, string>) {
  const { username, password, systemCode } = creds;
  if (!username || !password) throw new Error("Missing: username, password");
  const res = await fetch("https://eu5.fusionsolar.huawei.com/thirdData/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: username, systemCode: systemCode || password }),
  });
  const json = await res.json();
  if (!json.success && json.failCode !== 0) throw new Error(json.message || "Huawei login failed");
  const xsrfToken = res.headers.get("xsrf-token") || res.headers.get("set-cookie")?.match(/XSRF-TOKEN=([^;]+)/)?.[1] || "";
  return { credentials: { username, systemCode: systemCode || "" }, tokens: { xsrfToken, cookies: res.headers.get("set-cookie") || "" } };
}

// ── GoodWe SEMS ──
async function testGoodwe(creds: Record<string, string>) {
  const { email, password } = creds;
  if (!email || !password) throw new Error("Missing: email, password");
  const res = await fetch("https://www.semsportal.com/api/v2/Common/CrossLogin", {
    method: "POST", headers: { "Content-Type": "application/json", Token: '{"version":"v2.1.0","client":"ios","language":"en"}' },
    body: JSON.stringify({ account: email, pwd: password }),
  });
  const json = await res.json();
  if (json.code !== 0 && json.hasError) throw new Error(json.msg || "GoodWe login failed");
  const token = json.data?.token || json.data?.uid || "";
  return { credentials: { email }, tokens: { token, api: json.data?.api || "https://semsportal.com", uid: json.data?.uid || "" } };
}

// ── Fronius Solar.web ──
async function testFronius(creds: Record<string, string>) {
  const { apiKey, systemId } = creds;
  if (!apiKey) throw new Error("Missing: apiKey");
  const url = systemId
    ? `https://api.solarweb.com/swqapi/pvsystems/${systemId}?accessKeyId=${encodeURIComponent(apiKey)}`
    : `https://api.solarweb.com/swqapi/pvsystems?accessKeyId=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { AccessKeyId: apiKey } });
  if (!res.ok) { const t = await res.text(); throw new Error(`Fronius ${res.status}: ${t.slice(0, 200)}`); }
  await res.json();
  return { credentials: { apiKey, systemId: systemId || "" }, tokens: {} };
}

// ── Fox ESS ──
async function testFoxEss(creds: Record<string, string>) {
  const apiKey = creds.apiKey || creds.token || "";
  if (!apiKey) throw new Error("Missing: apiKey");
  const res = await fetch("https://www.foxesscloud.com/op/v0/plant/list", {
    method: "POST", headers: { "Content-Type": "application/json", token: apiKey },
    body: JSON.stringify({ currentPage: 1, pageSize: 1 }),
  });
  const json = await res.json();
  if (json.errno !== 0) throw new Error(json.msg || "Fox ESS auth failed");
  return { credentials: { apiKey }, tokens: {} };
}

// ── SolaX Cloud ──
async function testSolax(creds: Record<string, string>) {
  const { apiKey } = creds;
  if (!apiKey) throw new Error("Missing: apiKey");
  const res = await fetch(`https://www.solaxcloud.com/proxyApp/proxy/api/getRealtimeInfo.do?tokenId=${encodeURIComponent(apiKey)}&sn=TEST`);
  // Even with invalid SN, valid key returns specific error code vs auth error
  const json = await res.json();
  if (json.exception && /token/i.test(json.exception)) throw new Error("SolaX: invalid API token");
  return { credentials: { apiKey }, tokens: {} };
}

// ── SAJ eSolar ──
async function testSaj(creds: Record<string, string>) {
  const { email, password } = creds;
  if (!email || !password) throw new Error("Missing: email, password");
  const res = await fetch("https://fop.saj-electric.com/saj/login", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&lang=en`,
  });
  if (!res.ok && res.status !== 302) { const t = await res.text(); throw new Error(`SAJ ${res.status}: ${t.slice(0, 200)}`); }
  const cookies = res.headers.get("set-cookie") || "";
  return { credentials: { email }, tokens: { cookies } };
}

// ── ShineMonitor ──
async function testShinemonitor(creds: Record<string, string>) {
  const { username, password } = creds;
  if (!username || !password) throw new Error("Missing: username, password");
  const hashPwd = await sha256Hex(password);
  const res = await fetch("https://web.shinemonitor.com/public/?sign=&salt=&action=authSource&usr=" +
    encodeURIComponent(username) + "&source=1&company-key=bnrl_frRFjEz8Mkn", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usr: username, pwd: hashPwd }),
  });
  const json = await res.json();
  if (json.err !== 0 && !json.dat?.secret) throw new Error(json.desc || "ShineMonitor login failed");
  return { credentials: { username }, tokens: { secret: json.dat?.secret || "", token: json.dat?.token || "" } };
}

// ── APsystems EMA ──
async function testApsystems(creds: Record<string, string>) {
  const { email, password } = creds;
  if (!email || !password) throw new Error("Missing: email, password");
  const res = await fetch("https://www.apsystemsema.com/ema/intoDemoUser.action", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `mailAddress=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  });
  const cookies = res.headers.get("set-cookie") || "";
  if (!cookies && !res.ok) throw new Error("APsystems login failed");
  return { credentials: { email }, tokens: { cookies } };
}

// ── Enphase Enlighten ──
async function testEnphase(creds: Record<string, string>) {
  const { apiKey, clientId, apiSecret } = creds;
  if (!apiKey) throw new Error("Missing: apiKey");
  const res = await fetch(`https://api.enphaseenergy.com/api/v4/systems?key=${encodeURIComponent(apiKey)}&size=1`, {
    headers: clientId ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Enphase ${res.status}: ${t.slice(0, 200)}`); }
  return { credentials: { apiKey, clientId: clientId || "" }, tokens: { apiSecret: apiSecret || "" } };
}

// ── SMA Sunny Portal ──
async function testSunnyPortal(creds: Record<string, string>) {
  const { apiKey, plantId } = creds;
  if (!apiKey) throw new Error("Missing: apiKey");
  return { credentials: { apiKey, plantId: plantId || "" }, tokens: {} };
}

// ── Sofar Solar (uses Solarman platform under the hood) ──
async function testSofar(creds: Record<string, string>) {
  return await testSolarman(creds); // Same API as Solarman
}

// ── KSTAR ──
async function testKstar(creds: Record<string, string>) {
  const { email, password } = creds;
  if (!email || !password) throw new Error("Missing: email, password");
  const res = await fetch("https://cloud.kstar.com/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!json.token && !json.data?.token) throw new Error(json.message || "KSTAR login failed");
  return { credentials: { email }, tokens: { token: json.token || json.data?.token || "" } };
}

// ── Intelbras ISG ──
async function testIntelbras(creds: Record<string, string>) {
  const { email, password } = creds;
  if (!email || !password) throw new Error("Missing: email, password");
  const res = await fetch("https://solar.intelbras.com/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!json.token && !json.access_token) throw new Error(json.message || "Intelbras login failed");
  return { credentials: { email }, tokens: { token: json.token || json.access_token || "" } };
}

// ── EcoSolys ──
async function testEcosolys(creds: Record<string, string>) {
  const { email, password } = creds;
  if (!email || !password) throw new Error("Missing: email, password");
  const res = await fetch("https://portal.ecosolys.com.br/api/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!json.token) throw new Error(json.message || "EcoSolys login failed");
  return { credentials: { email }, tokens: { token: json.token } };
}

// ── CSI CloudPro / CSI Smart Energy / CSI Cloud ──
async function testCsi(creds: Record<string, string>) {
  const { apiKey } = creds;
  if (!apiKey) throw new Error("Missing: apiKey");
  return { credentials: { apiKey }, tokens: {} };
}

// ── Generic Portal Login (for all portal-based providers) ──
async function testGenericPortal(provider: string, creds: Record<string, string>) {
  const email = creds.email || creds.username || "";
  const password = creds.password || "";
  if (!email || !password) throw new Error("Missing: email/username, password");
  // For portal providers without official API, we store credentials for future implementation
  return { credentials: { email: email }, tokens: { password_hash: await sha256Hex(password) } };
}

// ═══════════════════════════════════════════════════════════
// Provider Router
// ═══════════════════════════════════════════════════════════

type TestFn = (creds: Record<string, string>) => Promise<{ credentials: Record<string, unknown>; tokens: Record<string, unknown> }>;

const PROVIDER_HANDLERS: Record<string, TestFn> = {
  solarman_business: (c) => testSolarman(c),
  solarman_business_api: (c) => testSolarman(c), // legacy ID
  solis_cloud: (c) => testSolis(c),
  solaredge: (c) => testSolaredge(c),
  deye_cloud: (c) => testDeye(c),
  growatt: (c) => testGrowatt(c),
  hoymiles: (c) => testHoymiles(c),
  sungrow: (c) => testSungrow(c),
  huawei: (c) => testHuawei(c),
  goodwe: (c) => testGoodwe(c),
  fronius: (c) => testFronius(c),
  fox_ess: (c) => testFoxEss(c),
  solax: (c) => testSolax(c),
  saj: (c) => testSaj(c),
  shinemonitor: (c) => testShinemonitor(c),
  apsystems: (c) => testApsystems(c),
  enphase: (c) => testEnphase(c),
  sunny_portal: (c) => testSunnyPortal(c),
  sofar: (c) => testSofar(c),
  kstar: (c) => testKstar(c),
  intelbras: (c) => testIntelbras(c),
  ecosolys: (c) => testEcosolys(c),
  csi_cloudpro: (c) => testCsi(c),
  csi_smart_energy: (c) => testCsi(c),
  csi_cloud: (c) => testCsi(c),
};

// Portal-based providers that use generic portal test
const PORTAL_PROVIDERS = new Set([
  "growatt_server", "solplanet", "elekeeper", "phb_solar", "sunweg", "renovigi",
  "chint_flexom", "solarview", "livoltek", "solarman_smart", "kehua", "weg_iot",
  "refusol", "solarnex", "tsun_pro", "renac", "nep_viewer", "fimer", "byd",
  "auxsol", "sices", "ge_solar", "wdc_solar", "sunwave", "nansen",
  "intelbras_plus", "smten", "elgin", "hypon_cloud", "wdc_solar_cf",
  "intelbras_send", "hopewind", "intelbras_x", "renovigi_portal", "elsys",
  "ingeteam", "pvhub", "dessmonitor", "smartess", "bedin_solar", "ksolare",
  "livoltek_cf", "tsun", "afore", "dah_solar", "empalux", "hopewind_shine",
  "hypon_portal", "litto", "leveros", "moso", "pv123", "qcells", "sacolar",
  "solar_must", "zevercloud",
]);

// ═══════════════════════════════════════════════════════════
// DB Helpers
// ═══════════════════════════════════════════════════════════

interface ConnectContext {
  supabaseAdmin: ReturnType<typeof createClient>;
  tenantId: string;
  userId: string;
  provider: string;
}

async function upsertIntegration(ctx: ConnectContext, data: { status: string; sync_error: string | null; credentials: Record<string, unknown>; tokens: Record<string, unknown> }) {
  const { data: integration, error } = await ctx.supabaseAdmin
    .from("monitoring_integrations")
    .upsert({ tenant_id: ctx.tenantId, provider: ctx.provider, ...data, updated_at: new Date().toISOString() }, { onConflict: "tenant_id,provider" })
    .select("id, status")
    .single();
  if (error) throw error;
  return integration;
}

async function auditLog(ctx: ConnectContext, action: string, registroId: string | undefined, dados: Record<string, unknown>) {
  await ctx.supabaseAdmin.from("audit_logs").insert({
    tenant_id: ctx.tenantId, user_id: ctx.userId, acao: action,
    tabela: "monitoring_integrations", registro_id: registroId, dados_novos: dados,
  });
}

// ═══════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { data: profile } = await supabaseAdmin.from("profiles").select("tenant_id").eq("user_id", userId).single();
    if (!profile?.tenant_id) return jsonResponse({ error: "Tenant not found" }, 403);
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const { provider, credentials } = body;
    if (!provider || !credentials) return jsonResponse({ error: "Missing provider or credentials" }, 400);

    const ctx: ConnectContext = { supabaseAdmin, tenantId, userId, provider };

    // Resolve handler
    const handler = PROVIDER_HANDLERS[provider];
    const isPortal = PORTAL_PROVIDERS.has(provider);

    if (!handler && !isPortal) {
      return jsonResponse({ error: `Unsupported provider: ${provider}` }, 400);
    }

    try {
      const result = isPortal && !handler
        ? await testGenericPortal(provider, credentials)
        : await handler!(credentials);

      const integration = await upsertIntegration(ctx, {
        status: "connected",
        sync_error: null,
        credentials: result.credentials,
        tokens: result.tokens,
      });

      await auditLog(ctx, "monitoring.integration.connected", integration?.id, { provider, status: "connected" });
      return jsonResponse({ success: true, integration_id: integration?.id, status: "connected" });
    } catch (err) {
      const errorMsg = (err as Error).message?.slice(0, 500) || "Connection failed";
      const integration = await upsertIntegration(ctx, {
        status: "error",
        sync_error: errorMsg,
        credentials: { provider },
        tokens: {},
      });
      await auditLog(ctx, "monitoring.integration.error", integration?.id, { provider, error: errorMsg });
      return jsonResponse({ error: errorMsg }, 400);
    }
  } catch (err) {
    console.error("monitoring-connect error:", err);
    return jsonResponse({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
