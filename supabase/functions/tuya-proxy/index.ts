/**
 * tuya-proxy — Secure server-side proxy for Tuya Cloud API.
 * Handles authentication, request signing (HMAC-SHA256), token management.
 * Credentials NEVER leave server-side.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** HMAC-SHA256 using Web Crypto API */
async function hmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** SHA-256 hash of body for content_sha256 header */
async function sha256(content: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(content));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface TokenInfo {
  access_token: string;
  refresh_token: string;
  expire_time: number; // timestamp ms when token expires
  uid: string;
}

/** Get or refresh access token from Tuya */
async function getAccessToken(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
  existingToken?: TokenInfo | null
): Promise<TokenInfo> {
  const now = Date.now();

  // If we have a valid non-expired token, reuse it
  if (existingToken && existingToken.expire_time > now + 60_000) {
    return existingToken;
  }

  // If we have a refresh token, try refreshing first
  if (existingToken?.refresh_token) {
    try {
      const refreshed = await requestToken(baseUrl, clientId, clientSecret, existingToken.refresh_token);
      return refreshed;
    } catch {
      // Fall through to new token request
    }
  }

  // Request a brand new token
  return await requestToken(baseUrl, clientId, clientSecret);
}

async function requestToken(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
  refreshToken?: string
): Promise<TokenInfo> {
  const now = Date.now();
  const t = now.toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const method = "GET";
  const path = refreshToken ? `/v1.0/token/${refreshToken}` : "/v1.0/token?grant_type=1";
  const url = `${baseUrl}${path}`;

  // For token requests: str = client_id + t + nonce + stringToSign
  const contentHash = await sha256("");
  const stringToSign = [method, contentHash, "", path].join("\n");
  const str = clientId + t + nonce + stringToSign;
  const sign = await hmacSha256(clientSecret, str);

  const resp = await fetch(url, {
    method,
    headers: {
      client_id: clientId,
      sign,
      t,
      sign_method: "HMAC-SHA256",
      nonce,
    },
  });

  const body = await resp.json();
  if (!body.success) {
    throw new Error(`Tuya token error: ${body.code} - ${body.msg}`);
  }

  const result = body.result;
  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expire_time: now + result.expire_time * 1000,
    uid: result.uid || "",
  };
}

/** Make a signed API request to Tuya */
async function tuyaRequest(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
  token: TokenInfo,
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const now = Date.now();
  const t = now.toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const url = `${baseUrl}${path}`;

  const bodyStr = body ? JSON.stringify(body) : "";
  const contentHash = await sha256(bodyStr);

  // For business requests: str = client_id + access_token + t + nonce + stringToSign
  const stringToSign = [method.toUpperCase(), contentHash, "", path].join("\n");
  const str = clientId + token.access_token + t + nonce + stringToSign;
  const sign = await hmacSha256(clientSecret, str);

  const headers: Record<string, string> = {
    client_id: clientId,
    access_token: token.access_token,
    sign,
    t,
    sign_method: "HMAC-SHA256",
    nonce,
  };
  if (bodyStr) {
    headers["Content-Type"] = "application/json";
  }

  const resp = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body: bodyStr || undefined,
  });

  const result = await resp.json();
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate caller via JWT
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, status, ativo")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.status !== "aprovado" || !profile.ativo) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;
    const payload = await req.json();
    const { action, config_id, params } = payload;

    // Load integration config
    const { data: config, error: cfgErr } = await supabase
      .from("integrations_api_configs")
      .select("*")
      .eq("id", config_id)
      .eq("tenant_id", tenantId)
      .single();

    if (cfgErr || !config) {
      return new Response(JSON.stringify({ error: "Integration config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = config.credentials as Record<string, string>;
    const clientId = (creds.client_id || "").trim();
    const clientSecret = (creds.client_secret || "").trim();
    const baseUrl = (config.base_url || "https://openapi.tuyaeu.com").trim();

    console.log(`[tuya-proxy] Config: clientId=${clientId.slice(0, 6)}***, baseUrl=${baseUrl}, action=${action}`);
    console.log(`[tuya-proxy] Secret len=${clientSecret.length}, first4=${clientSecret.slice(0, 4)}`);

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Missing Tuya credentials in config" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing token from settings
    const existingToken = (config.settings as any)?.token_info || null;

    // Obtain valid token
    const token = await getAccessToken(baseUrl, clientId, clientSecret, existingToken);
    console.log(`[tuya-proxy] Token obtained OK, uid=${token.uid}`);

    // Persist token if changed
    if (token.access_token !== existingToken?.access_token) {
      await supabase
        .from("integrations_api_configs")
        .update({
          settings: { ...(config.settings as any || {}), token_info: token },
          updated_at: new Date().toISOString(),
        })
        .eq("id", config_id);
    }

    let result: any;

    switch (action) {
      case "test_connection": {
        // Simple test: get user info
        const resp = await tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", "/v1.0/token/info");
        result = resp;

        // Update config status
        await supabase
          .from("integrations_api_configs")
          .update({
            status: resp.success ? "connected" : "error",
            last_tested_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", config_id);
        break;
      }

      case "get_devices": {
        // Fetch all devices from Tuya cloud
        const pageSize = params?.page_size || 100;
        let lastRowKey = "";
        const allDevices: any[] = [];
        let hasMore = true;

        while (hasMore) {
          const path = `/v2.0/cloud/thing?page_size=${pageSize}${lastRowKey ? `&last_row_key=${encodeURIComponent(lastRowKey)}` : ""}`;
          const resp = await tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", path);

          if (!resp.success) {
            // Fallback to v1.0 device list using the uid
            const uidPath = `/v1.0/users/${token.uid}/devices`;
            const fallback = await tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", uidPath);
            if (fallback.success && fallback.result) {
              allDevices.push(...fallback.result);
            }
            hasMore = false;
            break;
          }

          const items = resp.result?.list || [];
          allDevices.push(...items);
          lastRowKey = resp.result?.last_row_key || "";
          hasMore = !!lastRowKey && items.length === pageSize;
        }

        result = { success: true, result: allDevices, total: allDevices.length };
        break;
      }

      case "get_device_status": {
        const deviceId = params?.device_id;
        if (!deviceId) {
          return new Response(JSON.stringify({ error: "device_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const statusResp = await tuyaRequest(
          baseUrl, clientId, clientSecret, token,
          "GET", `/v1.0/devices/${deviceId}/status`
        );

        // Also get device info for online status
        const infoResp = await tuyaRequest(
          baseUrl, clientId, clientSecret, token,
          "GET", `/v1.0/devices/${deviceId}`
        );

        result = {
          success: statusResp.success,
          result: {
            status: statusResp.result || [],
            device_info: infoResp.result || {},
          },
        };
        break;
      }

      case "get_devices_status_batch": {
        const deviceIds: string[] = params?.device_ids || [];
        if (!deviceIds.length) {
          return new Response(JSON.stringify({ error: "device_ids required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Batch in chunks of 20
        const results: any[] = [];
        for (let i = 0; i < deviceIds.length; i += 20) {
          const chunk = deviceIds.slice(i, i + 20);
          const ids = chunk.join(",");
          const resp = await tuyaRequest(
            baseUrl, clientId, clientSecret, token,
            "GET", `/v1.0/devices/status?device_ids=${ids}`
          );
          if (resp.success && resp.result) {
            results.push(...resp.result);
          }
        }
        result = { success: true, result: results };
        break;
      }

      case "proxy": {
        // Generic proxy for any Tuya endpoint
        const { method = "GET", path, body: reqBody } = params || {};
        if (!path) {
          return new Response(JSON.stringify({ error: "path required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await tuyaRequest(baseUrl, clientId, clientSecret, token, method, path, reqBody);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[tuya-proxy] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
