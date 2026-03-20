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
  // URL in stringToSign must include query parameters
  const stringToSign = [method.toUpperCase(), contentHash, "", path].join("\n");
  const str = clientId + token.access_token + t + nonce + stringToSign;
  const sign = await hmacSha256(clientSecret, str);
  console.log(`[tuya-proxy] Request: ${method} ${path}, t=${t}, nonce=${nonce.slice(0,8)}...`);

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

/** Cron-triggered sync: iterate ALL active Tuya configs and sync readings */
async function handleCronSync(supabase: any): Promise<Response> {
  console.log("[tuya-proxy] CRON sync_readings for all configs");
  const { data: configs, error } = await supabase
    .from("integrations_api_configs")
    .select("*")
    .eq("provider", "tuya")
    .eq("is_active", true);

  if (error || !configs?.length) {
    console.log("[tuya-proxy] CRON: no active tuya configs found");
    return new Response(JSON.stringify({ success: true, configs_processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const config of configs) {
    try {
      const creds = config.credentials as Record<string, string>;
      const clientId = (creds.client_id || "").trim();
      const clientSecret = (creds.client_secret || "").trim();
      const baseUrl = (config.base_url || "https://openapi.tuyaeu.com").trim();
      if (!clientId || !clientSecret) { results.push({ config_id: config.id, error: "missing_credentials" }); continue; }

      const existingToken = (config.settings as any)?.token_info || null;
      const token = await getAccessToken(baseUrl, clientId, clientSecret, existingToken);
      if (token.access_token !== existingToken?.access_token) {
        await supabase.from("integrations_api_configs").update({
          settings: { ...(config.settings as any || {}), token_info: token },
          updated_at: new Date().toISOString(),
        }).eq("id", config.id);
      }

      // Sync readings for all meters in this config
      const { data: meters } = await supabase
        .from("meter_devices")
        .select("id, external_device_id, integration_config_id, tenant_id")
        .eq("integration_config_id", config.id)
        .eq("is_active", true)
        .eq("provider", "tuya");

      let processed = 0, failed = 0;
      for (const meter of (meters || [])) {
        try {
          const statusResp = await tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", `/v1.0/devices/${meter.external_device_id}/status`);
          const infoResp = await tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", `/v1.0/devices/${meter.external_device_id}`);
          if (!statusResp.success) { failed++; continue; }
          const dps = statusResp.result || [];
          const deviceInfo = infoResp.result || {};
          const now = new Date().toISOString();
          const online = deviceInfo.online ? "online" : "offline";
          const reading = buildReading(dps);
          console.log(`[tuya-proxy] buildReading for ${meter.external_device_id}:`, JSON.stringify({
            temperature_c: reading.temperature_c,
            power_factor: reading.power_factor,
            reactive_power_kvar: reading.reactive_power_kvar,
            leakage_current_ma: reading.leakage_current_ma,
            status_a: reading.status_a,
          }));

          const upsertPayload = {
            meter_device_id: meter.id, tenant_id: meter.tenant_id,
            measured_at: now, online_status: online,
            ...reading, raw_payload: { dps, device_info: deviceInfo }, updated_at: now,
          };
          const { error: upsertErr } = await supabase.from("meter_status_latest").upsert(
            upsertPayload as any, { onConflict: "meter_device_id" }
          );
          if (upsertErr) console.error(`[tuya-proxy] upsert error:`, upsertErr.message);

          await supabase.from("meter_readings").insert({
            meter_device_id: meter.id, measured_at: now,
            voltage_v: reading.voltage_v, current_a: reading.current_a,
            power_w: reading.power_w, power_factor: reading.power_factor,
            energy_import_kwh: reading.energy_import_kwh,
            energy_export_kwh: reading.energy_export_kwh,
            raw_payload: { dps, device_info: deviceInfo },
          } as any);

          await supabase.from("meter_devices").update({
            online_status: online,
            last_seen_at: deviceInfo.online ? now : undefined,
            last_reading_at: now, updated_at: now,
          } as any).eq("id", meter.id);

          processed++;
        } catch (e) { failed++; console.error(`[tuya-proxy] CRON device error:`, (e as Error).message); }
      }
      results.push({ config_id: config.id, processed, failed });
    } catch (e) { results.push({ config_id: config.id, error: (e as Error).message }); }
  }

  console.log("[tuya-proxy] CRON results:", JSON.stringify(results));
  return new Response(JSON.stringify({ success: true, configs_processed: configs.length, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Extract reading from DPS array — shared by cron and manual sync */
function buildReading(dps: any[]): Record<string, any> {
  const reading: Record<string, any> = {
    voltage_v: null, current_a: null, power_w: null,
    energy_import_kwh: null, energy_export_kwh: null,
    energy_total_kwh: null, energy_balance_kwh: null,
    reactive_power_kvar: null, power_factor: null,
    leakage_current_ma: null, neutral_current_a: null,
    temperature_c: null,
    status_a: null, status_b: null, status_c: null,
    fault_bitmap: null,
    over_current_count: null, lost_current_count: null, leak_count: null,
  };

  const DPS_MAP: Record<string, string> = {
    cur_voltage: "voltage_v", phase_a_voltage: "voltage_v",
    cur_current: "current_a", phase_a_current: "current_a",
    cur_power: "power_w", phase_a_power: "power_w",
    total_forward_energy: "energy_import_kwh", add_ele: "energy_import_kwh",
    reverse_energy_total: "energy_export_kwh", total_reverse_energy: "energy_export_kwh",
    energy_total: "energy_total_kwh", balance_energy: "energy_balance_kwh",
    power_total: "power_w", total_power: "power_w",
    power_reactive: "reactive_power_kvar", power_factor: "power_factor",
    leakage_current: "leakage_current_ma", n_current: "neutral_current_a",
    temp_current: "temperature_c",
    status: "status_a", status_b: "status_b", status_c: "status_c",
    fault: "fault_bitmap",
    over_current_cnt: "over_current_count", lost_current_cnt: "lost_current_count",
    leak_cnt: "leak_count",
  };

  const SCALE: Record<string, number> = {
    voltage_v: 0.1, current_a: 0.001, power_w: 1,
    energy_import_kwh: 0.01, energy_export_kwh: 0.01,
    energy_total_kwh: 0.001, energy_balance_kwh: 0.01,
    reactive_power_kvar: 0.1, power_factor: 0.001,
    leakage_current_ma: 1, neutral_current_a: 0.01,
    temperature_c: 1,
    fault_bitmap: 1, status_a: 1, status_b: 1, status_c: 1,
    over_current_count: 1, lost_current_count: 1, leak_count: 1,
  };

  for (const dp of dps) {
    const field = DPS_MAP[dp.code];
    if (!field) continue;
    if (typeof dp.value === "number") {
      if (reading[field] === null) {
        reading[field] = dp.value * (SCALE[field] ?? 1);
      }
    } else if (typeof dp.value === "boolean") {
      // skip booleans
    } else {
      if (reading[field] === null) reading[field] = String(dp.value);
    }
  }
  return reading;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── CRON path: x-cron-secret header ──
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET") || "cronkey2026maisenergia9X4kL7";
    if (cronSecret) {
      if (cronSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Invalid cron secret" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return await handleCronSync(supabase);
    }

    // ── Normal path: JWT auth ──
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
        // Token was already obtained successfully above (line ~237).
        // If we reach here, authentication is confirmed.
        // Optionally try a simple API call to further validate permissions.
        let apiTestOk = false;
        let apiTestMsg = "";
        try {
          const testResp = await tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", `/v1.0/iot-03/devices?page_no=1&page_size=1`);
          apiTestOk = testResp.success === true;
          apiTestMsg = testResp.msg || "";
          console.log(`[tuya-proxy] API test: success=${testResp.success}, msg=${testResp.msg}`);
        } catch (e: any) {
          console.log(`[tuya-proxy] API test call failed: ${e.message}`);
        }

        // Connection is valid if token was obtained (even if API call fails due to permissions)
        result = {
          success: true,
          msg: apiTestOk
            ? `Conectado! UID: ${token.uid}`
            : `Autenticação OK (UID: ${token.uid}). API: ${apiTestMsg || "verifique permissões do projeto."}`,
        };

        // Update config status
        await supabase
          .from("integrations_api_configs")
          .update({
            status: "connected",
            last_tested_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", config_id);
        break;
      }

      case "get_devices": {
        // Prefer SmartLife account listing when user_uid is explicitly configured.
        const pageSize = params?.page_size || 100;
        const configuredUserUid = ((config.settings as any)?.user_uid || "").trim();
        const userUid = configuredUserUid || token.uid;
        console.log(
          `[tuya-proxy] Device listing: userUid=${userUid}, tokenUid=${token.uid}, source=${configuredUserUid ? "settings.user_uid" : "token.uid"}`
        );

        if (configuredUserUid) {
          const uidPath = `/v1.0/users/${userUid}/devices`;
          console.log(`[tuya-proxy] Listing devices via ${uidPath}`);
          const resp = await tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", uidPath);
          if (resp.success && resp.result?.length) {
            const devices = resp.result;
            result = { success: true, result: devices, total: devices.length };
            break;
          }
          console.log(`[tuya-proxy] /v1.0/users/${userUid}/devices returned ${resp.result?.length ?? 0} devices, code=${resp.code}, msg=${resp.msg}`);
        }

        // Fallback: try /v2.0/cloud/thing (IoT Core)
        {
          const path = `/v2.0/cloud/thing?page_size=${pageSize}`;
          console.log(`[tuya-proxy] Trying IoT Core: ${path}`);
          const resp = await tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", path);
          if (resp.success && resp.result?.list?.length) {
            const devices = resp.result.list;
            result = { success: true, result: devices, total: devices.length };
            break;
          }
          console.log(`[tuya-proxy] /v2.0/cloud/thing returned ${resp.result?.list?.length ?? 0} devices, code=${resp.code}, msg=${resp.msg}`);
        }

        // Fallback: try known device IDs directly
        const knownDeviceIds = params?.known_device_ids || [];
        if (knownDeviceIds.length) {
          console.log(`[tuya-proxy] Trying direct device fetch for ${knownDeviceIds.length} known IDs`);
          const directDevices: any[] = [];
          for (const did of knownDeviceIds) {
            const resp = await tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", `/v1.0/devices/${did}`);
            if (resp.success && resp.result) {
              directDevices.push(resp.result);
              console.log(`[tuya-proxy] Direct fetch OK: ${did} → ${resp.result.name || "unnamed"}`);
            } else {
              console.log(`[tuya-proxy] Direct fetch failed for ${did}: ${resp.code} - ${resp.msg}`);
            }
          }
          if (directDevices.length) {
            result = { success: true, result: directDevices, total: directDevices.length };
            break;
          }
        }

        // All methods exhausted
        result = { success: true, result: [], total: 0 };
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

      case "send_command": {
        const deviceId = params?.device_id;
        const commands = params?.commands;
        if (!deviceId || !commands?.length) {
          return new Response(JSON.stringify({ error: "device_id and commands required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await tuyaRequest(
          baseUrl, clientId, clientSecret, token,
          "POST", `/v1.0/devices/${deviceId}/commands`,
          { commands }
        );
        console.log(`[tuya-proxy] send_command to ${deviceId}: ${JSON.stringify(commands)} → success=${result.success}`);
        break;
      }

      case "rename_device": {
        const deviceId = params?.device_id;
        const newName = params?.name;
        if (!deviceId || !newName) {
          return new Response(JSON.stringify({ error: "device_id and name required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await tuyaRequest(
          baseUrl, clientId, clientSecret, token,
          "PUT", `/v1.0/devices/${deviceId}`,
          { name: newName }
        );
        console.log(`[tuya-proxy] rename_device ${deviceId} → "${newName}": success=${result.success}`);
        break;
      }

      case "get_device_functions": {
        const deviceId = params?.device_id;
        if (!deviceId) {
          return new Response(JSON.stringify({ error: "device_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Fetch both specification (all DPs) and functions (writable DPs)
        const [specResult, funcResult] = await Promise.all([
          tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", `/v1.0/devices/${deviceId}/specification`),
          tuyaRequest(baseUrl, clientId, clientSecret, token, "GET", `/v1.0/devices/${deviceId}/functions`),
        ]);
        const statusDps = specResult?.result?.status || [];
        const funcDps = specResult?.result?.functions || funcResult?.result?.functions || [];
        // Merge: status (read) + functions (write), deduplicate by code
        const seen = new Set<string>();
        const allDps: any[] = [];
        for (const dp of [...funcDps, ...statusDps]) {
          if (dp?.code && !seen.has(dp.code)) {
            seen.add(dp.code);
            allDps.push({ ...dp, rw: funcDps.some((f: any) => f.code === dp.code) ? "rw" : "ro" });
          }
        }
        result = { result: { functions: allDps, total: allDps.length } };
        break;
      }

      case "sync_readings": {
        // Manual trigger: sync readings for ALL tuya meters in this config
        const { data: meters } = await supabase
          .from("meter_devices")
          .select("id, external_device_id, integration_config_id, tenant_id")
          .eq("integration_config_id", config_id)
          .eq("is_active", true)
          .eq("provider", "tuya");

        if (!meters?.length) {
          result = { success: true, processed: 0 };
          break;
        }

        let processed = 0;
        let failed = 0;

        for (const meter of meters) {
          try {
            const statusResp = await tuyaRequest(
              baseUrl, clientId, clientSecret, token,
              "GET", `/v1.0/devices/${meter.external_device_id}/status`
            );
            const infoResp = await tuyaRequest(
              baseUrl, clientId, clientSecret, token,
              "GET", `/v1.0/devices/${meter.external_device_id}`
            );

            if (!statusResp.success) {
              console.error(`[sync_readings] Device ${meter.external_device_id} status failed:`, statusResp.msg || statusResp.code);
              failed++;
              continue;
            }

            const dps = statusResp.result || [];
            const deviceInfo = infoResp.result || {};
            const now = new Date().toISOString();
            const online = deviceInfo.online ? "online" : "offline";
            const reading = buildReading(dps);

            // Upsert meter_status_latest
            await supabase.from("meter_status_latest").upsert({
              meter_device_id: meter.id, measured_at: now, online_status: online,
              ...reading, raw_payload: { dps, device_info: deviceInfo }, updated_at: now,
            } as any, { onConflict: "meter_device_id" });

            // Insert reading
            await supabase.from("meter_readings").insert({
              meter_device_id: meter.id, measured_at: now,
              voltage_v: reading.voltage_v, current_a: reading.current_a,
              power_w: reading.power_w, power_factor: reading.power_factor,
              energy_import_kwh: reading.energy_import_kwh,
              energy_export_kwh: reading.energy_export_kwh,
              raw_payload: { dps, device_info: deviceInfo },
            } as any);

            // Update meter device
            await supabase.from("meter_devices").update({
              online_status: online,
              last_seen_at: deviceInfo.online ? now : undefined,
              last_reading_at: now, updated_at: now,
            } as any).eq("id", meter.id);

            // Check alerts
            const settings = (config.settings as any) || {};
            const alertConfig = settings.alert_config || {};
            const minV = alertConfig.min_voltage ?? 200;
            const maxV = alertConfig.max_voltage ?? 240;
            const maxP = alertConfig.max_power ?? 10000;

            const alerts: any[] = [];
            if (reading.voltage_v != null && reading.voltage_v < minV) {
              alerts.push({ tipo: "tensao_baixa", valor_atual: reading.voltage_v, valor_limite: minV });
            }
            if (reading.voltage_v != null && reading.voltage_v > maxV) {
              alerts.push({ tipo: "tensao_alta", valor_atual: reading.voltage_v, valor_limite: maxV });
            }
            if (reading.power_w != null && reading.power_w > maxP) {
              alerts.push({ tipo: "sobrecarga", valor_atual: reading.power_w, valor_limite: maxP });
            }

            for (const alert of alerts) {
              const { data: existing } = await supabase
                .from("meter_alerts")
                .select("id")
                .eq("meter_device_id", meter.id)
                .eq("tipo", alert.tipo)
                .eq("resolvido", false)
                .maybeSingle();
              if (!existing) {
                await supabase.from("meter_alerts").insert({
                  meter_device_id: meter.id,
                  tenant_id: tenantId,
                  ...alert,
                } as any);
              }
            }

            processed++;
          } catch (e: any) {
            console.error(`[tuya-proxy] sync_readings error for ${meter.external_device_id}:`, e.message);
            failed++;
          }
        }

        console.log(`[tuya-proxy] sync_readings done: processed=${processed}, failed=${failed}`);
        result = { success: true, processed, failed, total: meters.length };
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
