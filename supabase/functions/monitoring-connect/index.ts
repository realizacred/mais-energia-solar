import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { getAdapter } from "../_shared/providers/registry.ts";
import { runHealthCheck, normalizeError } from "../_shared/provider-core/index.ts";

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
  const { createHash } = await import("node:crypto");
  const hash = createHash("md5").update(text).digest();
  return base64Encode(new Uint8Array(hash));
}

async function hmacSha1Base64(secret: string, data: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  const sig = createHmac("sha1", secret).update(data).digest();
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
    credentials: { appId, appSecret, email, password },
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
  const contentType = "application/json";
  const dateStr = new Date().toUTCString();
  const signStr = `POST\n${contentMd5}\n${contentType}\n${dateStr}\n${path}`;
  const sign = await hmacSha1Base64(apiSecret, signStr);
  console.log(`[Solis] Request: POST ${path}, Date: ${dateStr}`);
  const res = await fetch(`https://www.soliscloud.com:13333${path}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Content-MD5": contentMd5,
      Date: dateStr,
      Authorization: `API ${apiId}:${sign}`,
    },
    body: bodyStr,
  });
  const text = await res.text();
  console.log(`[Solis] Response status=${res.status}, body=${text.slice(0, 500)}`);
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`SolisCloud returned non-JSON: ${text.slice(0, 200)}`); }
  const isOk = json.success === true || json.code === "0" || json.code === 0;
  if (!isOk) throw new Error(json.msg || `SolisCloud error (code=${json.code}, success=${json.success})`);
  return { credentials: { apiId, apiSecret }, tokens: { apiSecret } };
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
// Supports both Personal User and Business Member flows.
// Business Members must provide companyId (or it's auto-detected).
// Docs: https://developer-eu.deyecloud.com/
async function testDeye(creds: Record<string, string>) {
  const { region, appId, appSecret, email, password } = creds;
  const companyId = creds.companyId || "";
  if (!region || !appId || !appSecret || !email || !password) throw new Error("Missing: region, appId, appSecret, email, password");
  const REGIONS: Record<string, string> = {
    EU: "https://eu1-developer.deyecloud.com/v1.0",
    US: "https://us1-developer.deyecloud.com/v1.0",
    AMEA: "https://us1-developer.deyecloud.com/v1.0",
    INDIA: "https://india-developer.deyecloud.com/v1.0",
  };
  const baseUrl = REGIONS[region.toUpperCase()];
  if (!baseUrl) throw new Error(`Invalid region: ${region}. Use EU, US, AMEA, or INDIA.`);

  // SHA256 hash + lowercase (as per Deye docs: "password should be in SHA256 encrypted and in lowercase")
  const hashHex = await sha256Hex(password);
  console.log(`[Deye] Password hash (first 10 chars): ${hashHex.slice(0, 10)}... length=${hashHex.length}`);
  console.log(`[Deye] Password length: ${password.length}, email: ${email}`);

  const tokenUrl = `${baseUrl}/account/token?appId=${encodeURIComponent(appId)}`;
  console.log(`[Deye] Requesting token from: ${tokenUrl}`);

  // Build request body — include companyId for Business Members
  const tokenBody: Record<string, unknown> = { appSecret, email, password: hashHex };
  if (companyId) {
    tokenBody.companyId = companyId;
    console.log(`[Deye] Business Member mode with companyId: ${companyId}`);
  }

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokenBody),
  });

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) {
    const t = await res.text();
    console.error(`[Deye] Non-JSON response (${res.status}):`, t.slice(0, 500));
    throw new Error(`Deye returned non-JSON (HTTP ${res.status}): ${t.slice(0, 200)}`);
  }

  const json = await res.json();
  console.log(`[Deye] Response success: ${json.success}, code: ${json.code}, msg: ${json.msg}`);

  const accessToken = json.accessToken || json.access_token || "";
  if (!accessToken) {
    // Parse nested error message if msg is JSON
    let errMsg = json.msg || `Deye auth failed (code=${json.code})`;
    try {
      const parsed = typeof errMsg === "string" ? JSON.parse(errMsg) : errMsg;
      errMsg = parsed.error || parsed.error_description || errMsg;
    } catch { /* not JSON, use as-is */ }
    throw new Error(errMsg);
  }

  // If personal user (no companyId), try to detect if they're actually a business member
  let detectedCompanyId = companyId;
  if (!companyId) {
    try {
      console.log(`[Deye] Checking if user is a Business Member...`);
      const infoRes = await fetch(`${baseUrl}/account/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `bearer ${accessToken}` },
        body: "{}",
      });
      const infoJson = await infoRes.json();
      const orgs = infoJson.orgInfoList || [];
      if (orgs.length > 0) {
        detectedCompanyId = String(orgs[0].companyId);
        console.log(`[Deye] Business Member detected! companyId=${detectedCompanyId}, company=${orgs[0].companyName}`);

        // Re-authenticate with companyId for proper business access
        const bizRes = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appSecret, email, password: hashHex, companyId: detectedCompanyId }),
        });
        const bizJson = await bizRes.json();
        const bizToken = bizJson.accessToken || bizJson.access_token || "";
        if (bizToken) {
          console.log(`[Deye] Business Member token obtained successfully`);
          const expiresIn = bizJson.expiresIn || bizJson.expires_in || 5183999;
          const expiresAt = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
          return {
            credentials: { region, baseUrl, appId, appSecret, email, password, companyId: detectedCompanyId },
            tokens: {
              access_token: bizToken,
              token_type: bizJson.tokenType || "bearer",
              expires_at: expiresAt,
              refresh_token: bizJson.refreshToken || null,
              appSecret,
            },
          };
        }
      } else {
        console.log(`[Deye] Personal User confirmed (no organizations found)`);
      }
    } catch (e) {
      console.log(`[Deye] Could not check business member status: ${(e as Error).message}`);
    }
  }

  const expiresIn = json.expiresIn || json.expires_in || 5183999;
  const expiresAt = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
  return {
    credentials: { region, baseUrl, appId, appSecret, email, password, companyId: detectedCompanyId },
    tokens: {
      access_token: accessToken,
      token_type: json.tokenType || json.token_type || "bearer",
      expires_at: expiresAt,
      refresh_token: json.refreshToken || json.refresh_token || null,
      appSecret,
    },
  };
}

// ── Growatt ──
// Supports two auth modes:
// 1) api_key: OpenAPI token (https://openapi.growatt.com) — token passed in HTTP header
//    Docs: POST /v4/new-api/queryLastData with token header, x-www-form-urlencoded body
// 2) portal: ShineServer username/password (legacy cookie auth)
async function testGrowatt(creds: Record<string, string>) {
  const authMode = creds.auth_mode || (creds.apiKey ? "api_key" : "portal");

  if (authMode === "api_key") {
    // ── OpenAPI Token mode ──
    const apiKey = creds.apiKey;
    if (!apiKey) throw new Error("Missing: apiKey (token do OpenAPI Growatt)");

    console.log(`[Growatt] Testing OpenAPI token auth...`);

    // Test with v1 plant list (business API) first
    const res = await fetch("https://openapi.growatt.com/v1/plant/list?page=1&perpage=1", {
      method: "GET",
      headers: { "token": apiKey },
    });

    const responseText = await res.text();
    let json: Record<string, any>;
    try {
      json = JSON.parse(responseText);
    } catch {
      console.error(`[Growatt] Non-JSON response (${res.status}):`, responseText.slice(0, 500));
      throw new Error(`Growatt returned non-JSON (HTTP ${res.status}): ${responseText.slice(0, 200)}`);
    }

    console.log(`[Growatt] OpenAPI response:`, JSON.stringify(json).slice(0, 300));

    if (json.error_code && json.error_code !== 0) {
      throw new Error(json.error_msg || `Growatt OpenAPI error (code=${json.error_code})`);
    }
    if (json.result === -1 || json.result === "-1") {
      throw new Error(json.msg || "Growatt: token inválido");
    }

    return {
      credentials: { auth_mode: "api_key", apiKey },
      tokens: { apiKey },
    };
  }

  // ── Portal/ShineServer mode (username + password) ──
  const username = creds.username || creds.email || "";
  const password = creds.password || "";
  if (!username || !password) throw new Error("Missing: username/email, password");

  const { createHash } = await import("node:crypto");

  // Growatt custom password hash: MD5 hex with '0' nibbles at even positions replaced by 'c'
  const rawMd5 = createHash("md5").update(password, "utf8").digest("hex");
  let customMd5 = rawMd5;
  for (let i = 0; i < customMd5.length; i += 2) {
    if (customMd5[i] === "0") {
      customMd5 = customMd5.substring(0, i) + "c" + customMd5.substring(i + 1);
    }
  }

  console.log(`[Growatt] user=${username}, rawMd5Prefix=${rawMd5.substring(0,8)}, customMd5Prefix=${customMd5.substring(0,8)}`);

  const growattUA = "Dalvik/2.1.0 (Linux; U; Android 12; SM-G975F Build/SP1A.210812.016)";

  // ── Strategy A: server.growatt.com/login with PLAIN password (like .NET GrowattApi library) ──
  // Reference: https://github.com/ealse/GrowattApi — uses account + plain password + cookie auth
  const plainLoginServers = [
    "https://server.growatt.com",
    "https://server-api.growatt.com",
    "https://openapi.growatt.com",
    "https://openapi-cn.growatt.com",
    "https://openapi-us.growatt.com",
  ];

  let lastError = "";
  for (const server of plainLoginServers) {
    try {
      console.log(`[Growatt] Trying plain login @ ${server}/login`);
      const res = await fetch(`${server}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": growattUA,
        },
        body: `account=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&validateCode=`,
        redirect: "follow",
      });

      const text = await res.text();
      console.log(`[Growatt] Plain login response (${res.status}):`, text.slice(0, 500));

      let json: Record<string, any>;
      try { json = JSON.parse(text); } catch {
        lastError = `Non-JSON from ${server}/login (HTTP ${res.status})`;
        continue;
      }

      if (json.result === 1 || json.result === "1") {
        const cookies = res.headers.get("set-cookie") || "";
        console.log(`[Growatt] Plain login OK @ ${server}! cookies=${cookies.length > 0}`);
        return {
          credentials: { auth_mode: "portal", username, server },
          tokens: { cookies, server, loginMethod: "plain" },
        };
      }

      const errMsg = json.back?.error || json.back?.msg || json.msg || json.error || `result=${json.result}`;
      lastError = errMsg;
      console.log(`[Growatt] Plain login rejected @ ${server}: ${errMsg}`);
    } catch (e) {
      lastError = (e as Error).message;
      console.error(`[Growatt] ${server}/login error:`, lastError);
    }
  }

  // ── Strategy B: newTwoLoginAPI.do with MD5 hashed password (ShinePhone API) ──
  const endpoints = [
    "https://openapi.growatt.com/newTwoLoginAPI.do",
    "https://server.growatt.com/newTwoLoginAPI.do",
    "https://server-api.growatt.com/newTwoLoginAPI.do",
    "https://openapi-cn.growatt.com/newTwoLoginAPI.do",
    "https://openapi-us.growatt.com/newTwoLoginAPI.do",
  ];

  const hashVariants = [
    { label: "customHash", hash: customMd5 },
    { label: "rawMD5", hash: rawMd5 },
  ];

  for (const variant of hashVariants) {
    for (const endpoint of endpoints) {
      try {
        console.log(`[Growatt] Trying ${variant.label} @ ${endpoint}`);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": growattUA,
          },
          body: `userName=${encodeURIComponent(username)}&password=${encodeURIComponent(variant.hash)}`,
          redirect: "follow",
        });

        const text = await res.text();
        console.log(`[Growatt] Response (${res.status}):`, text.slice(0, 500));

        let json: Record<string, any>;
        try { json = JSON.parse(text); } catch {
          lastError = `Non-JSON from ${endpoint} (HTTP ${res.status})`;
          continue;
        }

        if (json.result === 1 || json.back?.success === true) {
          const userId = json.back?.userId || json.user?.id || json.userId || "";
          const cookies = res.headers.get("set-cookie") || "";

          console.log(`[Growatt] Login OK via ${variant.label}! userId=${userId}`);
          return {
            credentials: { auth_mode: "portal", username },
            tokens: { userId: String(userId), cookies, passwordMd5: variant.hash, loginMethod: "md5" },
          };
        }

        const errMsg = json.back?.error || json.back?.msg || json.msg || json.error || `result=${json.result}`;
        lastError = errMsg;
        console.log(`[Growatt] Rejected: ${errMsg}`);
      } catch (e) {
        lastError = (e as Error).message;
        console.error(`[Growatt] ${endpoint} error:`, lastError);
      }
    }
  }

  throw new Error(`Growatt login failed: ${lastError}`);
}

// ── Hoymiles S-Miles ──
// Updated API flow (2025): region_c → login_c with MD5.SHA256Base64 password
// Reference: https://github.com/krikk/hoymiles-ms-a2-to-mqtt
async function testHoymiles(creds: Record<string, string>) {
  const username = creds.username || creds.login || creds.email || "";
  const password = creds.password || "";
  if (!username || !password) throw new Error("Missing: username/login, password");

  const { createHash } = await import("node:crypto");

  // Hoymiles password encoding: MD5(hex) + "." + base64(SHA256(raw digest))
  const md5Hex = createHash("md5").update(password, "utf8").digest("hex");
  const sha256Digest = createHash("sha256").update(password, "utf8").digest();
  // Convert raw digest bytes to base64 (matching Python's base64.b64encode)
  const sha256B64 = btoa(String.fromCharCode(...new Uint8Array(sha256Digest)));
  const encodedPassword = `${md5Hex}.${sha256B64}`;

  console.log(`[Hoymiles] Encoded password length=${encodedPassword.length}, md5Len=${md5Hex.length}, b64Len=${sha256B64.length}`);

  // Step 1: Discover region-specific login URL
  // Try all region endpoints; some accounts are region-specific
  const regionBases = [
    "https://euapi.hoymiles.com",
    "https://neapi.hoymiles.com",
    "https://global.hoymiles.com",
  ];

  let loginBaseUrl = "";
  for (const regionBase of regionBases) {
    try {
      console.log(`[Hoymiles] Trying region discovery at ${regionBase}/iam/pub/0/c/region_c`);
      const regionRes = await fetch(`${regionBase}/iam/pub/0/c/region_c`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ email: username }),
      });
      const regionText = await regionRes.text();
      console.log(`[Hoymiles] Region response status=${regionRes.status}, body=${regionText.substring(0, 300)}`);
      if (regionText.startsWith("<")) continue;
      const regionJson = JSON.parse(regionText);
      if ((regionJson.status === "0" || regionJson.status === 0) && regionJson.data?.login_url) {
        loginBaseUrl = regionJson.data.login_url;
        console.log(`[Hoymiles] Region resolved login_url=${loginBaseUrl}`);
        break;
      }
    } catch (e) {
      console.log(`[Hoymiles] Region ${regionBase} error: ${(e as Error).message}`);
    }
  }

  // Fallback: try all known base URLs directly (some accounts have dc=-1)
  const loginUrls = loginBaseUrl
    ? [loginBaseUrl]
    : ["https://neapi.hoymiles.com", "https://euapi.hoymiles.com", "https://global.hoymiles.com"];

  let lastError = "Hoymiles login failed";
  for (const baseUrl of loginUrls) {
    try {
      const loginEndpoint = `${baseUrl}/iam/pub/0/c/login_c`;
      const bodyPayload = { user_name: username, password: encodedPassword };

      console.log(`[Hoymiles] Trying login at ${loginEndpoint}`);
      const res = await fetch(loginEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(bodyPayload),
      });

      const text = await res.text();
      console.log(`[Hoymiles] Login response status=${res.status}, body=${text.substring(0, 300)}`);

      if (text.startsWith("<")) continue;

      const json = JSON.parse(text);
      if (json.status !== "0" && json.status !== 0) {
        lastError = json.message || json.msg || "Hoymiles login failed";
        continue;
      }

      const token = json.data?.token || json.token || "";
      if (!token) {
        lastError = "Hoymiles: no token returned";
        continue;
      }

      console.log(`[Hoymiles] Login OK via ${loginEndpoint}, userId=${json.data?.userId}`);
      return {
        credentials: { username },
        tokens: { token, userId: json.data?.userId || "", baseUrl },
      };
    } catch (e) {
      console.log(`[Hoymiles] ${baseUrl} error: ${(e as Error).message}`);
      lastError = (e as Error).message;
      continue;
    }
  }
  throw new Error(lastError);
}

// ── Sungrow iSolarCloud ──
// V2 API: https://developer-api.isolarcloud.com
// Password must be sent as-is (API handles hashing server-side)
async function testSungrow(creds: Record<string, string>) {
  const appKey = creds.appId || creds.appKey || "";
  const userAccount = creds.email || creds.username || "";
  const userPassword = creds.password || "";
  if (!appKey || !userAccount || !userPassword) throw new Error("Missing: appKey, account, password");

  console.log(`[Sungrow] Attempting login for account: ${userAccount}`);

  const res = await fetch("https://gateway.isolarcloud.com/v1/userService/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appkey: appKey, user_account: userAccount, user_password: userPassword, login_type: "1" }),
  });
  const json = await res.json();
  console.log(`[Sungrow] Response code: ${json.result_code}, msg: ${json.result_msg}`);

  if (json.result_code !== "1" && json.result_code !== 1) throw new Error(json.result_msg || "Sungrow login failed");
  const token = json.result_data?.token || "";
  return { credentials: { appKey, userAccount, userPassword }, tokens: { token, userId: json.result_data?.user_id || "" } };
}

// ── Huawei FusionSolar ──
function huaweiBaseUrl(region: string): string {
  const r = (region || "la5").toLowerCase();
  return `https://${r}.fusionsolar.huawei.com`;
}

async function testHuawei(creds: Record<string, string>) {
  const { username, password, region } = creds;
  if (!username || !password) throw new Error("Preencha Usuário de API e Senha de API.");
  const base = huaweiBaseUrl(region);
  console.log(`[Huawei] Tentando login em ${base} com user=${username}`);
  const res = await fetch(`${base}/thirdData/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: username, systemCode: password }),
  });
  const json = await res.json();
  console.log(`[Huawei] Response: success=${json.success}, failCode=${json.failCode}, message=${json.message}`);
  if (!json.success && json.failCode !== 0) throw new Error(json.message || "Huawei login failed");
  const xsrfToken = res.headers.get("xsrf-token") || res.headers.get("set-cookie")?.match(/XSRF-TOKEN=([^;]+)/)?.[1] || "";
  const cookies = res.headers.get("set-cookie") || "";
  if (!xsrfToken) console.warn("[Huawei] XSRF-TOKEN não encontrado nos headers!");
  return { credentials: { username, password, region: region || "la5" }, tokens: { xsrfToken, cookies, region: region || "la5" } };
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
  return { credentials: { email, password }, tokens: { token, api: json.data?.api || "https://semsportal.com", uid: json.data?.uid || "" } };
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
  return { credentials: { apiKey, systemId: systemId || "" }, tokens: { apiKey } };
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
  return { credentials: { apiKey }, tokens: { apiKey } };
}

// ── SolaX Cloud ──
async function testSolax(creds: Record<string, string>) {
  const { apiKey } = creds;
  if (!apiKey) throw new Error("Missing: apiKey");
  const res = await fetch(`https://www.solaxcloud.com/proxyApp/proxy/api/getRealtimeInfo.do?tokenId=${encodeURIComponent(apiKey)}&sn=TEST`);
  // Even with invalid SN, valid key returns specific error code vs auth error
  const json = await res.json();
  if (json.exception && /token/i.test(json.exception)) throw new Error("SolaX: invalid API token");
  return { credentials: { apiKey }, tokens: { apiKey } };
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
  return { credentials: { email, password }, tokens: { cookies } };
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
  return { credentials: { username, password }, tokens: { secret: json.dat?.secret || "", token: json.dat?.token || "" } };
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
  return { credentials: { email, password }, tokens: { cookies } };
}

// ── Enphase Enlighten ──
async function testEnphase(creds: Record<string, string>) {
  const { apiKey, clientId, apiSecret } = creds;
  if (!apiKey) throw new Error("Missing: apiKey");
  const res = await fetch(`https://api.enphaseenergy.com/api/v4/systems?key=${encodeURIComponent(apiKey)}&size=1`, {
    headers: clientId ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Enphase ${res.status}: ${t.slice(0, 200)}`); }
  return { credentials: { apiKey, clientId: clientId || "", apiSecret: apiSecret || "" }, tokens: { apiSecret: apiSecret || "" } };
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
  return { credentials: { email, password }, tokens: { token: json.token || json.data?.token || "" } };
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
  return { credentials: { email, password }, tokens: { token: json.token || json.access_token || "" } };
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
  return { credentials: { email, password }, tokens: { token: json.token } };
}

// ── CSI CloudPro / CSI Smart Energy / CSI Cloud ──
async function testCsi(creds: Record<string, string>) {
  const { apiKey } = creds;
  if (!apiKey) throw new Error("Missing: apiKey");
  return { credentials: { apiKey }, tokens: {} };
}

// ── Livoltek API ──
const LIVOLTEK_SERVERS = [
  "https://api-eu.livoltek-portal.com:8081",
  "https://api.livoltek-portal.com:8081",
];

// Validate that a Livoltek token looks like a real JWT or long token string
function isValidLivoltekToken(data: unknown): data is string {
  if (typeof data !== "string") return false;
  if (data.length < 20) return false; // JWT tokens are long
  // Reject known error messages
  const errorPhrases = ["not exit", "not exist", "error", "fail", "invalid", "expire"];
  if (errorPhrases.some(p => data.toLowerCase().includes(p))) return false;
  return true;
}

async function testLivoltek(creds: Record<string, string>) {
  const apiKey = creds.apiKey || creds.key || "";
  const appSecret = creds.appSecret || creds.secuid || "";
  const username = creds.username || creds.email || "";
  const password = creds.password || "";
  const userToken = creds.userToken || "";

  if (!apiKey || !appSecret) throw new Error("Missing: apiKey (Chave Api) and appSecret (Segredo da Aplicação)");
  if (!username || !password) throw new Error("Missing: username (Usuário) and password (Senha)");

  let token = userToken;
  let baseUrl = "";

  if (!token) {
    for (const server of LIVOLTEK_SERVERS) {
      try {
        console.log(`[Livoltek] Trying login at ${server}`);
        const loginBody: Record<string, string> = { secuid: appSecret, key: apiKey, username, password };
        const res = await fetch(`${server}/hess/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loginBody),
        });
        const json = await res.json();
        console.log(`[Livoltek] Response code=${json.code}, message=${json.message}, data=${String(json.data).substring(0, 50)}`);
        
        if (isValidLivoltekToken(json.data)) {
          token = json.data;
          baseUrl = server;
          console.log(`[Livoltek] Got valid token from ${server} (len=${token.length})`);
          break;
        } else {
          console.log(`[Livoltek] Rejected data as invalid token: "${String(json.data).substring(0, 80)}"`);
        }
      } catch (e) {
        console.log(`[Livoltek] ${server} error: ${(e as Error).message}`);
      }
    }
  } else {
    baseUrl = LIVOLTEK_SERVERS[0];
  }

  if (!token) throw new Error("Livoltek login failed. Verifique todos os 4 campos (username, password, apiKey, appSecret).");

  // Verify token by listing sites
  const serversToTry = baseUrl ? [baseUrl] : LIVOLTEK_SERVERS;
  for (const server of serversToTry) {
    try {
      const sitesRes = await fetch(`${server}/hess/api/userSites/list?userToken=${encodeURIComponent(token)}&page=1&size=5`);
      const sitesJson = await sitesRes.json();
      console.log(`[Livoltek] Sites check @ ${server}: code=${sitesJson.code}, msg=${sitesJson.message}, msg_code=${sitesJson.msg_code}, count=${sitesJson.data?.count || sitesJson.data?.list?.length || 0}`);
      const ok = sitesJson.msg_code === "operate.success" || sitesJson.code === "0" || sitesJson.code === 0 || sitesJson.message === "SUCCESS";
      if (ok) {
        baseUrl = server;
        break;
      }
    } catch (e) {
      console.warn(`[Livoltek] Sites verification @ ${server} failed:`, (e as Error).message);
    }
  }

  return {
    credentials: { apiKey, appSecret, username, baseUrl },
    tokens: { token, baseUrl, userToken: token, password },
  };
}

// ── Generic Portal Login (for all portal-based providers) ──
async function testGenericPortal(provider: string, creds: Record<string, string>) {
  const email = creds.email || creds.username || "";
  const password = creds.password || "";
  if (!email || !password) throw new Error("Missing: email/username, password");
  // Store full credentials for re-authentication when tokens expire
  return { credentials: { email, password }, tokens: { password_hash: await sha256Hex(password) } };
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
  growatt_server: (c) => testGrowatt({ ...c, auth_mode: "portal" }),
  hoymiles: (c) => testHoymiles(c),
  hoymiles_s_miles: (c) => testHoymiles(c),
  sungrow: (c) => testSungrow(c),
  huawei: (c) => testHuawei(c),
  huawei_fusionsolar: (c) => testHuawei(c),
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
  livoltek: (c) => testLivoltek(c),
  livoltek_cf: (c) => testLivoltek(c),
};

// Portal-based providers that use generic portal test
const PORTAL_PROVIDERS = new Set([
  "solplanet", "elekeeper", "phb_solar", "sunweg", "renovigi",
  "chint_flexom", "solarview", "solarman_smart", "kehua", "weg_iot",
  "refusol", "solarnex", "tsun_pro", "renac", "nep_viewer", "fimer", "byd",
  "auxsol", "sices", "ge_solar", "wdc_solar", "sunwave", "nansen",
  "intelbras_plus", "smten", "elgin", "hypon_cloud", "wdc_solar_cf",
  "intelbras_send", "hopewind", "intelbras_x", "renovigi_portal", "elsys",
  "ingeteam", "pvhub", "dessmonitor", "smartess", "bedin_solar", "ksolare",
  "tsun", "afore", "dah_solar", "empalux", "hopewind_shine",
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

    // ═══ CANONICAL ADAPTER PATH (preferred) ═══
    const canonicalAdapter = getAdapter(provider);

    if (canonicalAdapter) {
      try {
        console.log(`[monitoring-connect] Using canonical adapter for ${provider}`);
        canonicalAdapter.validateCredentials(credentials);
        const authResult = await canonicalAdapter.authenticate(credentials);

        // Run health check (PERMISSION errors → blocked)
        const health = await runHealthCheck(canonicalAdapter, authResult);
        console.log(`[monitoring-connect] Health check: ${health.status} (${health.latencyMs}ms)`);

        // Determine canonical status from health check behavior
        let integrationStatus: string;
        if (health.error && health.error.startsWith("[BLOCKED]")) {
          integrationStatus = "blocked";
        } else if (health.status === "FAIL") {
          integrationStatus = "error";
        } else {
          integrationStatus = "connected";
        }

        // SECURITY: Strip sensitive fields before persisting credentials
        const SENSITIVE_KEYS = new Set(["password", "userPassword", "senha", "secret_key"]);
        const safeCredentials: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(authResult.credentials)) {
          if (!SENSITIVE_KEYS.has(k)) safeCredentials[k] = v;
        }
        // Also strip sensitive fields from tokens
        const safeTokens: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(authResult.tokens)) {
          if (!SENSITIVE_KEYS.has(k) && k !== "password_for_reauth") safeTokens[k] = v;
        }

        const syncError = integrationStatus === "blocked"
          ? health.error || `Provider ${provider} requires additional setup. Sync disabled.`
          : health.error || null;

        const integration = await upsertIntegration(ctx, {
          status: integrationStatus,
          sync_error: syncError,
          credentials: safeCredentials,
          tokens: safeTokens,
        });

        await auditLog(ctx, "monitoring.integration.connected", integration?.id, { provider, status: integrationStatus, adapter: "canonical", health: health.status });
        return jsonResponse({ success: true, integration_id: integration?.id, status: integrationStatus, health: health.status });
      } catch (err) {
        const normalized = normalizeError(err, provider);
        const errorMsg = normalized.message?.slice(0, 500) || "Connection failed";
        console.error(`[monitoring-connect] ${provider} canonical adapter failed: [${normalized.category}] ${errorMsg}`);

        // Preserve existing credentials on error
        const { data: existing } = await ctx.supabaseAdmin
          .from("monitoring_integrations")
          .select("credentials, tokens")
          .eq("tenant_id", ctx.tenantId)
          .eq("provider", provider)
          .maybeSingle();

        const integration = await upsertIntegration(ctx, {
          status: "error",
          sync_error: `[${normalized.category}] ${errorMsg}`,
          credentials: (existing as any)?.credentials && Object.keys((existing as any).credentials).length > 1
            ? (existing as any).credentials : { provider },
          tokens: (existing as any)?.tokens && Object.keys((existing as any).tokens).length > 0
            ? (existing as any).tokens : {},
        });
        await auditLog(ctx, "monitoring.integration.error", integration?.id, { provider, error: errorMsg, category: normalized.category });
        return jsonResponse({ error: errorMsg, category: normalized.category }, 400);
      }
    }

    // ═══ LEGACY FALLBACK PATH ═══
    const handler = PROVIDER_HANDLERS[provider];
    const isPortal = PORTAL_PROVIDERS.has(provider);

    if (!handler && !isPortal) {
      return jsonResponse({ error: `Unsupported provider: ${provider}` }, 400);
    }

    try {
      console.log(`[monitoring-connect] Using LEGACY handler for ${provider}`);
      const result = isPortal && !handler
        ? await testGenericPortal(provider, credentials)
        : await handler!(credentials);

      // SECURITY: Strip sensitive fields before persisting credentials
      const SENSITIVE_KEYS = new Set(["password", "userPassword", "senha", "secret_key"]);
      const safeCredentials: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(result.credentials)) {
        if (!SENSITIVE_KEYS.has(k)) safeCredentials[k] = v;
      }

      const integration = await upsertIntegration(ctx, {
        status: "connected",
        sync_error: null,
        credentials: safeCredentials,
        tokens: result.tokens,
      });

      await auditLog(ctx, "monitoring.integration.connected", integration?.id, { provider, status: "connected", adapter: "legacy" });
      return jsonResponse({ success: true, integration_id: integration?.id, status: "connected" });
    } catch (err) {
      const errorMsg = (err as Error).message?.slice(0, 500) || "Connection failed";
      console.error(`[monitoring-connect] ${provider} legacy handshake failed:`, errorMsg);
      // Preserve existing credentials on error
      const { data: existing } = await ctx.supabaseAdmin
        .from("monitoring_integrations")
        .select("credentials, tokens")
        .eq("tenant_id", ctx.tenantId)
        .eq("provider", provider)
        .maybeSingle();

      const integration = await upsertIntegration(ctx, {
        status: "error",
        sync_error: errorMsg,
        credentials: (existing as any)?.credentials && Object.keys((existing as any).credentials).length > 1
          ? (existing as any).credentials
          : { provider },
        tokens: (existing as any)?.tokens && Object.keys((existing as any).tokens).length > 0
          ? (existing as any).tokens
          : {},
      });
      await auditLog(ctx, "monitoring.integration.error", integration?.id, { provider, error: errorMsg });
      return jsonResponse({ error: errorMsg }, 400);
    }
  } catch (err) {
    console.error("monitoring-connect error:", err);
    return jsonResponse({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
