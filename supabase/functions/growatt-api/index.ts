import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
// Token masking (NEVER log full token)
// ═══════════════════════════════════════════════════════════
function maskToken(token: string): string {
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}${"*".repeat(token.length - 8)}${token.slice(-4)}`;
}

// ═══════════════════════════════════════════════════════════
// Growatt HTTP Client — retry + auth header fallback
// ═══════════════════════════════════════════════════════════
type AuthHeaderMode = "bearer" | "token_header";

interface GrowattRequestOpts {
  baseUrl: string;
  token: string;
  method: "GET" | "POST";
  path: string;
  params?: Record<string, string>;
  body?: unknown;
}

async function growattFetch(opts: GrowattRequestOpts, headerMode: AuthHeaderMode): Promise<Response> {
  let url = `${opts.baseUrl.replace(/\/+$/, "")}${opts.path}`;
  if (opts.params) {
    const qs = new URLSearchParams(opts.params).toString();
    url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  if (headerMode === "bearer") {
    headers["Authorization"] = `Bearer ${opts.token}`;
  } else {
    headers["Token"] = opts.token;
  }

  const fetchOpts: RequestInit = { method: opts.method, headers };
  if (opts.body && opts.method === "POST") {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(opts.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  fetchOpts.signal = controller.signal;

  try {
    const res = await fetch(url, fetchOpts);
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function growattRequest<T = unknown>(opts: GrowattRequestOpts): Promise<{ data: T; headerMode: AuthHeaderMode }> {
  const MAX_RETRIES = 3;
  const BACKOFF = [500, 1000, 2000];
  let lastErr: Error | null = null;

  // Try Bearer first, then Token header on 401/403
  for (const headerMode of ["bearer", "token_header"] as AuthHeaderMode[]) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`[Growatt-v1] ${opts.method} ${opts.path} (${headerMode}, attempt ${attempt + 1}), token=${maskToken(opts.token)}`);
        const res = await growattFetch(opts, headerMode);

        if (res.status === 401 || res.status === 403) {
          const text = await res.text().catch(() => "");
          console.warn(`[Growatt-v1] Auth failed (${res.status}) with ${headerMode}: ${text.slice(0, 200)}`);
          lastErr = new Error(`auth_error:${res.status}`);
          break; // Try next header mode
        }

        if (res.status === 429 || res.status >= 500) {
          const text = await res.text().catch(() => "");
          console.warn(`[Growatt-v1] Retryable ${res.status}: ${text.slice(0, 100)}`);
          lastErr = new Error(res.status === 429 ? "rate_limit" : `upstream_error:${res.status}`);
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, BACKOFF[attempt]));
            continue;
          }
          throw lastErr;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`upstream_error:${res.status}:${text.slice(0, 200)}`);
        }

        const text = await res.text();
        let json: T;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(`parse_error:Invalid JSON: ${text.slice(0, 100)}`);
        }

        return { data: json, headerMode };
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          lastErr = new Error("timeout");
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, BACKOFF[attempt]));
            continue;
          }
        }
        lastErr = err as Error;
        if (attempt >= MAX_RETRIES - 1) break;
      }
    }
  }

  throw lastErr || new Error("unknown_error");
}

// ═══════════════════════════════════════════════════════════
// Normalizer
// ═══════════════════════════════════════════════════════════
interface NormalizedInverterData {
  inverter_sn: string;
  datalogger_sn: string | null;
  ts_device: string | null;
  status_text: string | null;
  status_code: string | null;
  power_w: number | null;
  energy_today: number | null;
  energy_total: number | null;
  temperature_c: number | null;
  freq_hz: number | null;
  pv_v1: number | null; pv_i1: number | null;
  pv_v2: number | null; pv_i2: number | null;
  pv_v3: number | null; pv_i3: number | null;
  raw_payload: Record<string, unknown>;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "" || v === "--") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function normalizeRealtimeData(sn: string, raw: Record<string, unknown>): NormalizedInverterData {
  // The API may nest data under a "data" key or at root level
  const d = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;

  return {
    inverter_sn: sn,
    datalogger_sn: (raw.dataloggerSn || d.dataloggerSn || null) as string | null,
    ts_device: (d.time as string) || null,
    status_text: (d.statusText as string) || null,
    status_code: d.status != null ? String(d.status) : null,
    power_w: numOrNull(d.pac) ?? numOrNull(d.power),
    energy_today: numOrNull(d.powerToday) ?? numOrNull(d.eToday),
    energy_total: numOrNull(d.powerTotal) ?? numOrNull(d.eTotal),
    temperature_c: numOrNull(d.temperature),
    freq_hz: numOrNull(d.fac),
    pv_v1: numOrNull(d.vpv1), pv_i1: numOrNull(d.ipv1),
    pv_v2: numOrNull(d.vpv2), pv_i2: numOrNull(d.ipv2),
    pv_v3: numOrNull(d.vpv3), pv_i3: numOrNull(d.ipv3),
    raw_payload: raw,
  };
}

function normalizeBatchData(raw: Record<string, unknown>): NormalizedInverterData[] {
  const results: NormalizedInverterData[] = [];
  const data = (raw.data || {}) as Record<string, unknown>;

  for (const [inverterId, value] of Object.entries(data)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    // Batch response: data[inverterId].dataloggerSn + data[inverterId][inverterId] = metrics
    const metrics = (entry[inverterId] || entry) as Record<string, unknown>;
    const dataloggerSn = (entry.dataloggerSn || null) as string | null;

    const normalized = normalizeRealtimeData(inverterId, { ...metrics, dataloggerSn });
    results.push(normalized);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════
// Persistence helpers
// ═══════════════════════════════════════════════════════════
async function upsertRealtimeCache(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  data: NormalizedInverterData,
) {
  const { error } = await supabase.from("growatt_inverter_rt").upsert({
    tenant_id: tenantId,
    inverter_sn: data.inverter_sn,
    datalogger_sn: data.datalogger_sn,
    ts_device: data.ts_device,
    status_text: data.status_text,
    status_code: data.status_code,
    power_w: data.power_w,
    energy_today: data.energy_today,
    energy_total: data.energy_total,
    temperature_c: data.temperature_c,
    freq_hz: data.freq_hz,
    pv_v1: data.pv_v1, pv_i1: data.pv_i1,
    pv_v2: data.pv_v2, pv_i2: data.pv_i2,
    pv_v3: data.pv_v3, pv_i3: data.pv_i3,
    raw_payload: data.raw_payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,inverter_sn" });

  if (error) console.error(`[Growatt-v1] Upsert RT error for ${data.inverter_sn}: ${error.message}`);
  return error;
}

async function insertRawEvent(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  data: NormalizedInverterData,
) {
  // Hash for deduplication
  const encoder = new TextEncoder();
  const hashInput = `${tenantId}:${data.inverter_sn}:${data.ts_device || ""}:${JSON.stringify(data.raw_payload)}`;
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashInput));
  const payloadHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const { error } = await supabase.from("growatt_raw_events").upsert({
    tenant_id: tenantId,
    inverter_sn: data.inverter_sn,
    ts_device: data.ts_device,
    payload_hash: payloadHash,
    raw_payload: data.raw_payload,
  }, { onConflict: "tenant_id,inverter_sn,payload_hash" });

  if (error && !error.message.includes("duplicate")) {
    console.error(`[Growatt-v1] Raw event insert error: ${error.message}`);
  }
}

async function updateHealthCache(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  status: "ok" | "auth_error" | "timeout" | "upstream_error" | "parse_error" | "unknown",
  errorCode?: string,
  httpStatus?: number,
) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    status,
    checked_at: now,
    reason: status === "ok" ? null : status,
    last_error_code: status === "ok" ? null : (errorCode || null),
    last_http_status: status === "ok" ? null : (httpStatus || null),
  };
  if (status === "ok") payload.last_ok_at = now;
  else payload.last_fail_at = now;

  await supabase.from("growatt_health_cache").upsert(payload, { onConflict: "tenant_id" });
}

// ═══════════════════════════════════════════════════════════
// Config loader
// ═══════════════════════════════════════════════════════════
async function loadGrowattConfig(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<{ baseUrl: string; token: string }> {
  const { data, error } = await supabase
    .from("monitoring_integrations")
    .select("credentials, tokens")
    .eq("tenant_id", tenantId)
    .eq("provider", "growatt_v1")
    .maybeSingle();

  if (error || !data) {
    // Fallback: try regular "growatt" provider
    const { data: fallback } = await supabase
      .from("monitoring_integrations")
      .select("credentials, tokens")
      .eq("tenant_id", tenantId)
      .eq("provider", "growatt")
      .maybeSingle();

    if (!fallback) throw new Error("Growatt v1 integration not configured. Go to Integrations to set up.");
    
    const creds = (fallback.credentials || {}) as Record<string, unknown>;
    const tokens = (fallback.tokens || {}) as Record<string, unknown>;
    const baseUrl = (creds.growatt_base_url || creds.base_url || "https://openapi.growatt.com/v1") as string;
    const token = (tokens.apiKey || tokens.api_key || creds.apiKey || "") as string;
    if (!token) throw new Error("Growatt API token not configured.");
    return { baseUrl, token };
  }

  const creds = (data.credentials || {}) as Record<string, unknown>;
  const tokens = (data.tokens || {}) as Record<string, unknown>;
  const baseUrl = (creds.growatt_base_url || "https://openapi.growatt.com/v1") as string;
  const token = (tokens.growatt_token || creds.growatt_token || "") as string;
  if (!token) throw new Error("Growatt API token not configured.");
  return { baseUrl, token };
}

// ═══════════════════════════════════════════════════════════
// Route handlers
// ═══════════════════════════════════════════════════════════

async function handleRealtime(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  sn: string,
  includeRaw: boolean,
) {
  const config = await loadGrowattConfig(supabase, tenantId);

  const { data: raw } = await growattRequest<Record<string, unknown>>({
    baseUrl: config.baseUrl,
    token: config.token,
    method: "GET",
    path: "/device/inverter/last_new_data",
    params: { device_sn: sn },
  });

  const normalized = normalizeRealtimeData(sn, raw);

  // Persist
  await Promise.all([
    upsertRealtimeCache(supabase, tenantId, normalized),
    insertRawEvent(supabase, tenantId, normalized),
    updateHealthCache(supabase, tenantId, "ok"),
  ]);

  const result: Record<string, unknown> = { ...normalized };
  if (!includeRaw) delete result.raw_payload;

  return { success: true, data: result };
}

async function handleBatch(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  inverters: string[],
  pageNum: number,
  includeRaw: boolean,
) {
  const config = await loadGrowattConfig(supabase, tenantId);

  const { data: raw } = await growattRequest<Record<string, unknown>>({
    baseUrl: config.baseUrl,
    token: config.token,
    method: "POST",
    path: "/device/inverter/invs_data",
    body: { pageNum, inverters },
  });

  const normalized = normalizeBatchData(raw);

  // Persist all
  await Promise.all([
    ...normalized.map((d) => upsertRealtimeCache(supabase, tenantId, d)),
    ...normalized.map((d) => insertRawEvent(supabase, tenantId, d)),
    updateHealthCache(supabase, tenantId, "ok"),
  ]);

  const results = normalized.map((d) => {
    const r: Record<string, unknown> = { ...d };
    if (!includeRaw) delete r.raw_payload;
    return r;
  });

  return { success: true, count: results.length, data: results };
}

async function handleInfo(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  sn: string,
) {
  const config = await loadGrowattConfig(supabase, tenantId);

  const { data: raw } = await growattRequest<Record<string, unknown>>({
    baseUrl: config.baseUrl,
    token: config.token,
    method: "GET",
    path: "/device/inverter/inv_data_info",
    params: { device_sn: sn },
  });

  await updateHealthCache(supabase, tenantId, "ok");

  return { success: true, data: raw };
}

async function handleTestConnection(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  sn: string,
) {
  try {
    const config = await loadGrowattConfig(supabase, tenantId);
    const { data: raw } = await growattRequest<Record<string, unknown>>({
      baseUrl: config.baseUrl,
      token: config.token,
      method: "GET",
      path: "/device/inverter/inv_data_info",
      params: { device_sn: sn },
    });

    await updateHealthCache(supabase, tenantId, "ok");
    return { success: true, message: "Conexão OK", data: raw };
  } catch (err) {
    const msg = (err as Error).message || "";
    let status: "auth_error" | "timeout" | "upstream_error" | "parse_error" = "upstream_error";
    if (msg.startsWith("auth_error")) status = "auth_error";
    else if (msg === "timeout") status = "timeout";
    else if (msg.startsWith("parse_error")) status = "parse_error";

    const httpMatch = msg.match(/:(\d{3})/);
    await updateHealthCache(supabase, tenantId, status, msg, httpMatch ? parseInt(httpMatch[1]) : undefined);
    throw err;
  }
}

async function handleSaveConfig(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  baseUrl: string,
  token: string,
) {
  // Normalize base URL
  let normalizedUrl = baseUrl.trim();
  if (!normalizedUrl.endsWith("/")) normalizedUrl += "/";
  if (!normalizedUrl.includes("/v1")) {
    normalizedUrl = normalizedUrl.replace(/\/$/, "/v1/");
  }

  // Upsert into monitoring_integrations with provider='growatt_v1'
  const { data: existing } = await supabase
    .from("monitoring_integrations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("provider", "growatt_v1")
    .maybeSingle();

  const payload = {
    tenant_id: tenantId,
    provider: "growatt_v1",
    status: "connected",
    credentials: { growatt_base_url: normalizedUrl },
    tokens: { growatt_token: token },
    sync_error: null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("monitoring_integrations").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("monitoring_integrations").insert(payload);
  }

  // Reset health cache
  await supabase.from("growatt_health_cache").upsert({
    tenant_id: tenantId,
    status: "unknown",
    checked_at: new Date().toISOString(),
  }, { onConflict: "tenant_id" });

  // Audit log
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: userId,
    acao: "growatt_v1.config.saved",
    tabela: "monitoring_integrations",
    dados_novos: { provider: "growatt_v1", base_url: normalizedUrl, token_length: token.length },
  });

  return { success: true, message: "Configuração salva" };
}

// ═══════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();
    if (!profile?.tenant_id) return jsonResponse({ error: "Tenant not found" }, 403);
    const tenantId = profile.tenant_id;

    const body = req.method === "POST" ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get("action") || "";

    switch (action) {
      case "save_config": {
        const { base_url, token } = body;
        if (!base_url || !token) return jsonResponse({ error: "base_url e token são obrigatórios" }, 400);
        if (token.length < 16) return jsonResponse({ error: "Token deve ter pelo menos 16 caracteres" }, 400);
        const result = await handleSaveConfig(supabaseAdmin, tenantId, userId, base_url, token);
        return jsonResponse(result);
      }

      case "test_connection": {
        const sn = body.device_sn || body.sn;
        if (!sn) return jsonResponse({ error: "device_sn é obrigatório para teste" }, 400);
        const result = await handleTestConnection(supabaseAdmin, tenantId, sn);
        return jsonResponse(result);
      }

      case "realtime": {
        const sn = body.device_sn || body.sn;
        if (!sn) return jsonResponse({ error: "device_sn é obrigatório" }, 400);
        const includeRaw = body.raw === true || url.searchParams.get("raw") === "1";
        const result = await handleRealtime(supabaseAdmin, tenantId, sn, includeRaw);
        return jsonResponse(result);
      }

      case "batch_realtime": {
        const inverters = body.inverters;
        if (!Array.isArray(inverters) || inverters.length === 0) {
          return jsonResponse({ error: "inverters (array de SNs) é obrigatório" }, 400);
        }
        const pageNum = body.pageNum || 1;
        const includeRaw = body.raw === true;
        const result = await handleBatch(supabaseAdmin, tenantId, inverters, pageNum, includeRaw);
        return jsonResponse(result);
      }

      case "info": {
        const sn = body.device_sn || body.sn;
        if (!sn) return jsonResponse({ error: "device_sn é obrigatório" }, 400);
        const result = await handleInfo(supabaseAdmin, tenantId, sn);
        return jsonResponse(result);
      }

      case "health": {
        const { data } = await supabaseAdmin
          .from("growatt_health_cache")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        return jsonResponse({ success: true, health: data || { status: "unknown" } });
      }

      case "get_config": {
        const { data } = await supabaseAdmin
          .from("monitoring_integrations")
          .select("credentials, status, last_sync_at, sync_error")
          .eq("tenant_id", tenantId)
          .eq("provider", "growatt_v1")
          .maybeSingle();
        const creds = (data?.credentials || {}) as Record<string, unknown>;
        return jsonResponse({
          success: true,
          config: {
            base_url: creds.growatt_base_url || "",
            has_token: !!data,
            status: data?.status || "disconnected",
            last_sync_at: data?.last_sync_at,
            sync_error: data?.sync_error,
          },
        });
      }

      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}. Use: save_config, test_connection, realtime, batch_realtime, info, health, get_config` }, 400);
    }
  } catch (err) {
    const msg = (err as Error).message || "Internal server error";
    console.error("[Growatt-v1] Error:", msg);

    // Classify error for user-friendly response
    if (msg.startsWith("auth_error")) {
      return jsonResponse({ error: "Falha de autenticação. Verifique o token Growatt.", category: "auth_error" }, 401);
    }
    if (msg === "timeout") {
      return jsonResponse({ error: "Timeout ao conectar com Growatt. Tente novamente.", category: "timeout" }, 504);
    }
    if (msg.startsWith("parse_error")) {
      return jsonResponse({ error: "Resposta inválida do servidor Growatt.", category: "parse_error" }, 502);
    }
    if (msg.startsWith("upstream_error")) {
      return jsonResponse({ error: `Erro no servidor Growatt: ${msg}`, category: "upstream_error" }, 502);
    }

    return jsonResponse({ error: msg }, 500);
  }
});
