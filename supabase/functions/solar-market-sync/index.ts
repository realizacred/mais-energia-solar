import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ══════════════════════════════════════════════════════════════
// CORS & Helpers
// ══════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits;
}

function genRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ══════════════════════════════════════════════════════════════
// SolarMarketService — Auth + Request Wrapper + DB Logging
// ══════════════════════════════════════════════════════════════

interface SmConfig {
  id: string;
  tenant_id: string;
  enabled: boolean;
  base_url: string;
  api_token: string | null;
  last_token: string | null;
  last_token_expires_at: string | null;
  last_sync_clients_at: string | null;
  last_sync_projects_at: string | null;
}

class SolarMarketService {
  private supabaseAdmin: ReturnType<typeof createClient>;
  private config: SmConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private signingIn = false;

  constructor(supabaseAdmin: ReturnType<typeof createClient>, config: SmConfig) {
    this.supabaseAdmin = supabaseAdmin;
    this.config = config;

    // Restore cached token if still valid
    if (config.last_token && config.last_token_expires_at) {
      const expires = new Date(config.last_token_expires_at).getTime();
      if (expires > Date.now() + 60_000) {
        this.accessToken = config.last_token;
        this.tokenExpiresAt = expires;
        console.log("[SM] Restored cached JWT token");
      }
    }
  }

  private getRawApiToken(): string {
    if (this.config.api_token) return this.config.api_token;
    const secretToken = Deno.env.get("SOLARMARKET_TOKEN");
    if (secretToken) return secretToken;
    throw new Error("Token da API SolarMarket não configurado. Configure na aba Config ou nos Secrets do Supabase.");
  }

  // POST /auth/signin → JWT access_token (6h TTL)
  async signin(): Promise<string> {
    const rawToken = this.getRawApiToken();
    const reqId = genRequestId();
    const start = Date.now();

    console.log(`[SM] [${reqId}] POST /auth/signin`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(`${this.config.base_url}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ token: rawToken }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - start;

      // Log signin request to DB
      this.logRequest(reqId, "POST", "/auth/signin", {}, res.status, duration, res.ok ? null : `HTTP ${res.status}`);

      if (!res.ok) {
        const text = await res.text();
        console.error(`[SM] [${reqId}] signin FAILED (${res.status}) ${duration}ms: ${text}`);
        throw new Error(`SolarMarket signin falhou (${res.status}): ${text}`);
      }

      const data = await res.json();
      const token = data.access_token || data.accessToken || data.token;
      if (!token) throw new Error("SolarMarket não retornou access_token na resposta de signin");

      const expiresAt = Date.now() + (5 * 60 + 55) * 60_000;
      this.accessToken = token;
      this.tokenExpiresAt = expiresAt;

      await this.supabaseAdmin
        .from("solar_market_config")
        .update({ last_token: token, last_token_expires_at: new Date(expiresAt).toISOString() })
        .eq("id", this.config.id);

      console.log(`[SM] [${reqId}] signin OK ${duration}ms [token cached 5h55min]`);
      return token;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") throw new Error("Timeout ao conectar com SolarMarket (15s)");
      throw err;
    }
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt > Date.now() + 60_000) {
      return this.accessToken;
    }

    if (this.signingIn) {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (!this.signingIn && this.accessToken) return this.accessToken;
      }
      throw new Error("Timeout aguardando signin concorrente");
    }

    this.signingIn = true;
    try {
      return await this.signin();
    } finally {
      this.signingIn = false;
    }
  }

  // ── DB Request Logging (fire-and-forget) ──
  private logRequest(
    requestId: string, method: string, path: string,
    params: Record<string, unknown>, statusCode: number | null,
    durationMs: number, error: string | null
  ) {
    this.supabaseAdmin.from("solar_market_integration_requests").insert({
      tenant_id: this.config.tenant_id,
      request_id: requestId,
      method,
      path,
      params: params || {},
      status_code: statusCode,
      duration_ms: durationMs,
      error,
    }).then(({ error: dbErr }) => {
      if (dbErr) console.warn(`[SM] Failed to log request ${requestId}: ${dbErr.message}`);
    });
  }

  // Generic request with auth, retry, backoff, DB logging
  async request(
    method: string, path: string,
    opts?: { params?: Record<string, string | number | undefined>; body?: unknown }
  ): Promise<any> {
    const reqId = genRequestId();
    const maxRetries = 3;

    // Clean params for logging
    const cleanParams: Record<string, unknown> = {};
    if (opts?.params) {
      for (const [k, v] of Object.entries(opts.params)) {
        if (v !== undefined && v !== null && v !== "") cleanParams[k] = v;
      }
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const token = await this.getAccessToken();

      let url = `${this.config.base_url}${path}`;
      if (opts?.params) {
        const searchParams = new URLSearchParams();
        for (const [k, v] of Object.entries(opts.params)) {
          if (v !== undefined && v !== null && v !== "") searchParams.set(k, String(v));
        }
        const qs = searchParams.toString();
        if (qs) url += `?${qs}`;
      }

      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      };
      if (["POST", "PATCH", "PUT"].includes(method.toUpperCase())) {
        headers["Content-Type"] = "application/json";
      }

      const start = Date.now();
      console.log(`[SM] [${reqId}] ${method} ${path} (attempt ${attempt + 1})`);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        const res = await fetch(url, {
          method: method.toUpperCase(),
          headers,
          body: opts?.body ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const duration = Date.now() - start;

        // Rate limited
        if (res.status === 429) {
          const wait = Math.pow(2, attempt) * 1000;
          console.warn(`[SM] [${reqId}] 429 Rate limited, waiting ${wait}ms...`);
          this.logRequest(reqId, method, path, cleanParams, 429, duration, "Rate limited");
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }

        // Auth failed — refresh token once
        if ((res.status === 401 || res.status === 403) && attempt === 0) {
          console.warn(`[SM] [${reqId}] ${res.status} → refreshing token...`);
          this.logRequest(reqId, method, path, cleanParams, res.status, duration, "Auth failed, refreshing");
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          continue;
        }

        // Server error — retry with backoff
        if (res.status >= 500 && attempt < maxRetries) {
          const wait = Math.pow(2, attempt) * 1000;
          console.warn(`[SM] [${reqId}] ${res.status} Server error, retrying in ${wait}ms...`);
          this.logRequest(reqId, method, path, cleanParams, res.status, duration, `Server error, retry ${attempt + 1}`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }

        if (!res.ok) {
          const text = await res.text();
          console.error(`[SM] [${reqId}] ${method} ${path} → ${res.status} ${duration}ms: ${text.slice(0, 300)}`);
          this.logRequest(reqId, method, path, cleanParams, res.status, duration, text.slice(0, 500));
          throw new Error(`SM API ${res.status}: ${text.slice(0, 200)}`);
        }

        if (res.status === 204) {
          console.log(`[SM] [${reqId}] ${method} ${path} → 204 ${duration}ms`);
          this.logRequest(reqId, method, path, cleanParams, 204, duration, null);
          return null;
        }

        const data = await res.json();
        console.log(`[SM] [${reqId}] ${method} ${path} → ${res.status} ${duration}ms`);
        this.logRequest(reqId, method, path, cleanParams, res.status, duration, null);
        return data;
      } catch (err: any) {
        if (err.name === "AbortError") {
          this.logRequest(reqId, method, path, cleanParams, null, Date.now() - start, "Timeout");
          if (attempt < maxRetries) {
            console.warn(`[SM] [${reqId}] Timeout, retrying...`);
            continue;
          }
          throw new Error(`SM API timeout after ${maxRetries + 1} attempts`);
        }
        if (err.message?.startsWith("SM API")) throw err;
        this.logRequest(reqId, method, path, cleanParams, null, Date.now() - start, err.message);
        throw err;
      }
    }

    throw new Error("Max retries exceeded");
  }
}

// ══════════════════════════════════════════════════════════════
// SolarMarketClient — Endpoint wrappers
// ══════════════════════════════════════════════════════════════

class SolarMarketClient {
  private svc: SolarMarketService;

  constructor(svc: SolarMarketService) {
    this.svc = svc;
  }

  // ── Users ──
  async getAuthenticatedUser() {
    return this.svc.request("GET", "/users/me");
  }

  async listUsers(filters: { limit?: number; page?: number; id?: number; name?: string; email?: string } = {}) {
    return this.svc.request("GET", "/users", {
      params: {
        limit: filters.limit ?? 100,
        page: filters.page ?? 1,
        id: filters.id,
        name: filters.name,
        email: filters.email,
      },
    });
  }

  async listUsersAll(filters: { name?: string; email?: string } = {}): Promise<any[]> {
    const all: any[] = [];
    let page = 1;
    while (true) {
      const data = await this.listUsers({ ...filters, limit: 100, page });
      const items = Array.isArray(data) ? data : data?.data || data?.users || [];
      all.push(...items);
      if (items.length < 100) break;
      page++;
      await new Promise((r) => setTimeout(r, 1100)); // Rate limit: 60 req/min
    }
    return all;
  }

  // ── Clients ──
  async listClients(filters: {
    limit?: string; page?: string; id?: number; email?: string;
    cnpjCpf?: string; name?: string; phone?: string;
    createdBefore?: string; createdAfter?: string;
  } = {}) {
    let phone = filters.phone;
    if (phone) {
      phone = phone.replace(/\D/g, "");
      if (phone.startsWith("55") && phone.length > 11) phone = phone.slice(2);
    }
    return this.svc.request("GET", "/clients", {
      params: {
        limit: filters.limit ?? "100",
        page: filters.page ?? "1",
        id: filters.id,
        email: filters.email,
        cnpjCpf: filters.cnpjCpf,
        name: filters.name,
        phone,
        createdBefore: filters.createdBefore,
        createdAfter: filters.createdAfter,
      },
    });
  }

  async listClientsAll(filters: { createdAfter?: string } = {}): Promise<any[]> {
    const all: any[] = [];
    let page = 1;
    const limit = "100";
    let totalFromApi: number | null = null;
    let lastPageFromApi: number | null = null;
    while (true) {
      const data = await this.listClients({ ...filters, limit, page: String(page) });
      const items = Array.isArray(data) ? data : data?.data || data?.clients || [];

      // Extract pagination metadata from API response (common formats)
      if (page === 1 && data && typeof data === "object" && !Array.isArray(data)) {
        totalFromApi = data.total ?? data.totalItems ?? data.meta?.total ?? null;
        lastPageFromApi = data.lastPage ?? data.totalPages ?? data.meta?.lastPage ?? data.meta?.totalPages ?? null;
        console.log(`[SM] Clients pagination metadata: total=${totalFromApi}, lastPage=${lastPageFromApi}, itemsPage1=${items.length}`);
      }

      all.push(...items);
      console.log(`[SM] Clients page ${page}: ${items.length} items (accumulated: ${all.length}${totalFromApi ? `/${totalFromApi}` : ""})`);

      // Stop conditions: empty page, less than limit, or reached last page
      if (items.length === 0) break;
      if (items.length < 100 && !lastPageFromApi) break;
      if (lastPageFromApi && page >= lastPageFromApi) break;
      if (totalFromApi && all.length >= totalFromApi) break;

      page++;
      await new Promise((r) => setTimeout(r, 1100)); // Rate limit: 60 req/min
    }
    console.log(`[SM] Clients total fetched: ${all.length} (pages: ${page})`);
    return all;
  }

  async createClient(payload: Record<string, unknown>) {
    if (payload.cnpjCpf) payload.cnpjCpf = String(payload.cnpjCpf).replace(/\D/g, "");
    if (payload.primaryPhone) payload.primaryPhone = String(payload.primaryPhone).replace(/\D/g, "");
    if (payload.secondaryPhone) payload.secondaryPhone = String(payload.secondaryPhone).replace(/\D/g, "");
    if (payload.zipCode) payload.zipCode = String(payload.zipCode).replace(/\D/g, "");
    return this.svc.request("POST", "/clients", { body: payload });
  }

  async updateClient(id: number, payload: Record<string, unknown>) {
    return this.svc.request("PATCH", `/clients/${id}`, { body: payload });
  }

  async deleteClient(id: number) {
    return this.svc.request("DELETE", `/clients/${id}`);
  }

  // ── Projects ──
  async listProjects(filters: {
    limit?: string; page?: string; id?: number; clientId?: number;
    name?: string; createdBefore?: string; createdAfter?: string;
  } = {}) {
    return this.svc.request("GET", "/projects", {
      params: {
        limit: filters.limit ?? "100",
        page: filters.page ?? "1",
        id: filters.id,
        clientId: filters.clientId,
        name: filters.name,
        createdBefore: filters.createdBefore,
        createdAfter: filters.createdAfter,
      },
    });
  }

  async listProjectsAll(filters: { createdAfter?: string } = {}): Promise<any[]> {
    const all: any[] = [];
    let page = 1;
    let totalFromApi: number | null = null;
    let lastPageFromApi: number | null = null;
    while (true) {
      const data = await this.listProjects({ ...filters, limit: "100", page: String(page) });
      const items = Array.isArray(data) ? data : data?.data || data?.projects || [];

      // Extract pagination metadata
      if (page === 1 && data && typeof data === "object" && !Array.isArray(data)) {
        totalFromApi = data.total ?? data.totalItems ?? data.meta?.total ?? null;
        lastPageFromApi = data.lastPage ?? data.totalPages ?? data.meta?.lastPage ?? data.meta?.totalPages ?? null;
        console.log(`[SM] Projects pagination metadata: total=${totalFromApi}, lastPage=${lastPageFromApi}, itemsPage1=${items.length}`);
      }

      all.push(...items);
      console.log(`[SM] Projects page ${page}: ${items.length} items (accumulated: ${all.length}${totalFromApi ? `/${totalFromApi}` : ""})`);

      if (items.length === 0) break;
      if (items.length < 100 && !lastPageFromApi) break;
      if (lastPageFromApi && page >= lastPageFromApi) break;
      if (totalFromApi && all.length >= totalFromApi) break;

      page++;
      await new Promise((r) => setTimeout(r, 1100));
    }
    console.log(`[SM] Projects total fetched: ${all.length} (pages: ${page})`);
    return all;
  }

  async createProject(payload: Record<string, unknown>) {
    if (payload.clientId && payload.client) delete payload.client;
    return this.svc.request("POST", "/projects", { body: payload });
  }

  async updateProject(id: number, payload: Record<string, unknown>) {
    return this.svc.request("PATCH", `/projects/${id}`, { body: payload });
  }

  async deleteProject(id: number) {
    return this.svc.request("DELETE", `/projects/${id}`);
  }

  // ── Custom Fields (per project) ──
  async listProjectCustomFields(projectId: number, filters: { limit?: string; page?: string; customFieldId?: number } = {}) {
    return this.svc.request("GET", `/projects/${projectId}/custom-fields`, {
      params: {
        limit: filters.limit ?? "100",
        page: filters.page ?? "1",
        customFieldId: filters.customFieldId,
      },
    });
  }

  async updateProjectCustomFieldValue(projectId: number, customFieldId: number, value: string) {
    return this.svc.request("POST", `/projects/${projectId}/custom-fields/${customFieldId}`, {
      body: { value },
    });
  }

  // ── Funnels (per project) ──
  async listProjectFunnels(projectId: number) {
    return this.svc.request("GET", `/projects/${projectId}/funnels`);
  }

  // ── Proposals (active) ──
  async getActiveProposalByProject(projectId: number) {
    return this.svc.request("GET", `/projects/${projectId}/proposals`);
  }

  // ── Funnels (general catalog) ──
  async listFunnels(filters: { limit?: string; page?: string; id?: number; name?: string } = {}) {
    return this.svc.request("GET", "/funnels", {
      params: {
        limit: filters.limit ?? "100",
        page: filters.page ?? "1",
        id: filters.id,
        name: filters.name,
      },
    });
  }

  // ── Custom Fields (general catalog) ──
  async listCustomFields(filters: { limit?: string; page?: string; id?: number; key?: string } = {}) {
    return this.svc.request("GET", "/custom-fields", {
      params: {
        limit: filters.limit ?? "100",
        page: filters.page ?? "1",
        id: filters.id,
        key: filters.key,
      },
    });
  }
}

// ══════════════════════════════════════════════════════════════
// Sync Logic
// ══════════════════════════════════════════════════════════════

// ── Cancellation check helper ──
async function isSyncCancelled(
  db: ReturnType<typeof createClient>, syncLogId: string | null
): Promise<boolean> {
  if (!syncLogId) return false;
  try {
    const { data } = await db
      .from("solar_market_sync_logs")
      .select("status")
      .eq("id", syncLogId)
      .single();
    return data?.status === "cancelled";
  } catch {
    return false;
  }
}

interface SyncCounts {
  clients_synced: number;
  projects_synced: number;
  proposals_synced: number;
  funnels_synced: number;
  custom_fields_synced: number;
  users_synced: number;
  leads_linked: number;
  errors: string[];
}

function newCounts(): SyncCounts {
  return {
    clients_synced: 0, projects_synced: 0, proposals_synced: 0,
    funnels_synced: 0, custom_fields_synced: 0, users_synced: 0,
    leads_linked: 0, errors: [],
  };
}

// ── Chunked sync types & helpers ──

interface SyncResult {
  done: boolean;
  nextPhase?: string;
  nextOffset?: number;
}

const CHUNK_SIZE = 25; // Projects per chunk (sub-resources phase)

async function mergeSyncCounts(
  db: ReturnType<typeof createClient>, syncLogId: string, localCounts: SyncCounts
): Promise<SyncCounts> {
  const { data } = await db
    .from("solar_market_sync_logs")
    .select("counts")
    .eq("id", syncLogId)
    .single();

  const prev = (data?.counts || {}) as Partial<SyncCounts>;
  return {
    clients_synced: (prev.clients_synced || 0) + localCounts.clients_synced,
    projects_synced: (prev.projects_synced || 0) + localCounts.projects_synced,
    proposals_synced: (prev.proposals_synced || 0) + localCounts.proposals_synced,
    funnels_synced: (prev.funnels_synced || 0) + localCounts.funnels_synced,
    custom_fields_synced: (prev.custom_fields_synced || 0) + localCounts.custom_fields_synced,
    users_synced: (prev.users_synced || 0) + localCounts.users_synced,
    leads_linked: (prev.leads_linked || 0) + localCounts.leads_linked,
    errors: [...(prev.errors || []), ...localCounts.errors],
  };
}

// ── Log failed item to DB ──
async function logFailedItem(
  db: ReturnType<typeof createClient>, tenantId: string, syncLogId: string | null,
  entityType: string, entityId: string | number | null, errorMessage: string, payload?: unknown
) {
  if (!syncLogId) return;
  await db.from("solar_market_sync_items_failed").insert({
    tenant_id: tenantId,
    sync_log_id: syncLogId,
    entity_type: entityType,
    entity_id: entityId != null ? String(entityId) : null,
    error_message: errorMessage,
    payload: payload || {},
  }).then(({ error }) => {
    if (error) console.warn(`[SM] Failed to log sync item failure: ${error.message}`);
  });
}

// ── Sync Users ──
async function syncUsers(
  db: ReturnType<typeof createClient>, client: SolarMarketClient,
  config: SmConfig, counts: SyncCounts, syncLogId: string | null
) {
  try {
    console.log("[SM] Syncing users...");
    const users = await client.listUsersAll();
    console.log(`[SM] Fetched ${users.length} users from SM`);

    for (const u of users) {
      const smId = u.id || u.userId;
      if (!smId) continue;

      const { error } = await db
        .from("solar_market_users")
        .upsert({
          tenant_id: config.tenant_id,
          sm_user_id: smId,
          name: u.name || u.nome || "",
          email: u.email || "",
          role: u.role || u.profile || null,
          payload: u,
        }, { onConflict: "tenant_id,sm_user_id" });

      if (error) {
        counts.errors.push(`user ${smId}: ${error.message}`);
        await logFailedItem(db, config.tenant_id, syncLogId, "user", smId, error.message, u);
      } else {
        counts.users_synced++;
      }
    }
  } catch (err: any) {
    console.error("[SM] Sync users error:", err.message);
    counts.errors.push(`users: ${err.message}`);
  }
}

// ── Sync Clients (batched upsert for performance) ──
async function syncClients(
  db: ReturnType<typeof createClient>, client: SolarMarketClient,
  config: SmConfig, counts: SyncCounts, syncLogId: string | null, createdAfter?: string
): Promise<any[]> {
  try {
    console.log(`[SM] Syncing clients${createdAfter ? ` (after ${createdAfter})` : " (full)"}...`);
    const clients = await client.listClientsAll({ createdAfter });
    console.log(`[SM] Fetched ${clients.length} clients from SM`);

    // Batch upsert: 100 at a time instead of 1-by-1 (18 HTTP calls vs 1800)
    const BATCH_SIZE = 100;
    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE);
      const rows = batch.map((c: any) => {
        const smId = c.id || c.clientId;
        if (!smId) return null;
        const phone = c.primaryPhone || c.phone || c.telefone || "";
        return {
          tenant_id: config.tenant_id,
          sm_client_id: smId,
          name: c.name || c.nome || "",
          email: c.email || "",
          phone,
          phone_normalized: normalizePhone(phone),
          cnpj_cpf: c.cnpjCpf || c.cpf || c.cnpj || null,
          primary_phone: c.primaryPhone || null,
          secondary_phone: c.secondaryPhone || null,
          city: c.city || c.cidade || null,
          state: c.state ? String(c.state).slice(0, 2).toUpperCase() : null,
          payload: c,
          deleted_at: null,
        };
      }).filter(Boolean);

      if (rows.length === 0) continue;

      const { error } = await db
        .from("solar_market_clients")
        .upsert(rows as any[], { onConflict: "tenant_id,sm_client_id" });

      if (error) {
        counts.errors.push(`clients batch ${i}: ${error.message}`);
        await logFailedItem(db, config.tenant_id, syncLogId, "client_batch", i, error.message);
      } else {
        counts.clients_synced += rows.length;
        console.log(`[SM] Clients batch ${i}-${i + rows.length}: upserted ${rows.length}`);
      }
    }
    return clients;
  } catch (err: any) {
    console.error("[SM] Sync clients error:", err.message);
    counts.errors.push(`clients: ${err.message}`);
    return [];
  }
}

// ── Sync ALL Projects in bulk (replaces per-client N+1 pattern) ──
async function syncAllProjectsBulk(
  db: ReturnType<typeof createClient>, client: SolarMarketClient,
  config: SmConfig, counts: SyncCounts, syncLogId: string | null,
  createdAfter?: string
): Promise<any[]> {
  try {
    console.log(`[SM] Bulk fetching ALL projects${createdAfter ? ` (after ${createdAfter})` : ""}...`);
    const projects = await client.listProjectsAll({ createdAfter });
    console.log(`[SM] Fetched ${projects.length} projects from SM in bulk`);

    // Batch upsert projects (100 at a time)
    const BATCH_SIZE = 100;
    for (let i = 0; i < projects.length; i += BATCH_SIZE) {
      const batch = projects.slice(i, i + BATCH_SIZE);
      const rows = batch.map((p: any) => {
        const smProjId = p.id || p.projectId;
        const smCliId = p.clientId || p.client_id || 0;
        if (!smProjId) return null;
        return {
          tenant_id: config.tenant_id,
          sm_project_id: smProjId,
          sm_client_id: smCliId,
          status: p.status || p.situacao || null,
          payload: p,
          deleted_at: null,
        };
      }).filter(Boolean);

      if (rows.length === 0) continue;

      const { error } = await db
        .from("solar_market_projects")
        .upsert(rows as any[], { onConflict: "tenant_id,sm_project_id" });

      if (error) {
        counts.errors.push(`projects batch ${i}: ${error.message}`);
        await logFailedItem(db, config.tenant_id, syncLogId, "project_batch", i, error.message);
      } else {
        counts.projects_synced += rows.length;
        console.log(`[SM] Projects batch ${i}-${i + rows.length}: upserted ${rows.length}`);
      }
    }
    return projects;
  } catch (err: any) {
    console.error("[SM] Bulk projects error:", err.message);
    counts.errors.push(`projects_bulk: ${err.message}`);
    return [];
  }
}

// ── Sync sub-resources for a single project ──
async function syncProjectSubResourcesById(
  db: ReturnType<typeof createClient>, client: SolarMarketClient,
  config: SmConfig, smProjectId: number, smClientId: number,
  counts: SyncCounts, syncLogId: string | null
) {
  await syncProjectSubResources(db, client, config, smProjectId, smClientId, counts, syncLogId);
}

// ── Sync project sub-resources: custom fields, funnels, proposals ──
async function syncProjectSubResources(
  db: ReturnType<typeof createClient>, client: SolarMarketClient,
  config: SmConfig, smProjectId: number, smClientId: number,
  counts: SyncCounts, syncLogId: string | null
) {
  // Custom Fields
  try {
    const cfData = await client.listProjectCustomFields(smProjectId);
    const fields = Array.isArray(cfData) ? cfData : cfData?.data || cfData?.customFields || [];

    for (const f of fields) {
      const cfId = f.id || f.customFieldId;
      if (!cfId) continue;

      const { error } = await db
        .from("solar_market_custom_fields")
        .upsert({
          tenant_id: config.tenant_id,
          sm_project_id: smProjectId,
          sm_custom_field_id: cfId,
          field_key: f.key || f.name || null,
          field_type: f.type || null,
          value: f.value != null ? String(f.value) : null,
          payload: f,
        }, { onConflict: "tenant_id,sm_project_id,sm_custom_field_id" });

      if (error) {
        counts.errors.push(`cf ${cfId} proj ${smProjectId}: ${error.message}`);
        await logFailedItem(db, config.tenant_id, syncLogId, "custom_field", cfId, error.message, f);
      } else {
        counts.custom_fields_synced++;
      }
    }
  } catch (err: any) {
    console.warn(`[SM] Custom fields skipped for project ${smProjectId}: ${err.message}`);
  }

  // Rate limit delay between sub-resource calls
  await new Promise((r) => setTimeout(r, 1100));

  // Funnels
  try {
    const fData = await client.listProjectFunnels(smProjectId);
    const { error } = await db
      .from("solar_market_funnels")
      .upsert({
        tenant_id: config.tenant_id,
        sm_project_id: smProjectId,
        payload: fData || {},
      }, { onConflict: "tenant_id,sm_project_id" });

    if (error) {
      counts.errors.push(`funnel proj ${smProjectId}: ${error.message}`);
      await logFailedItem(db, config.tenant_id, syncLogId, "funnel", smProjectId, error.message);
    } else {
      counts.funnels_synced++;
    }
  } catch (err: any) {
    console.warn(`[SM] Funnels skipped for project ${smProjectId}: ${err.message}`);
  }

  // Rate limit delay between sub-resource calls
  await new Promise((r) => setTimeout(r, 1100));

  // Active Proposal
  try {
    const propData = await client.getActiveProposalByProject(smProjectId);
    
    // Debug: log raw response shape to understand API format
    const propType = propData === null ? "null" : Array.isArray(propData) ? "array" : typeof propData;
    const propKeys = propData && typeof propData === "object" && !Array.isArray(propData) ? Object.keys(propData).join(",") : "";
    const dataField = propData?.data;
    const dataType = dataField === undefined ? "undefined" : dataField === null ? "null" : Array.isArray(dataField) ? `array[${dataField.length}]` : typeof dataField;
    console.log(`[SM] Proposals raw for project ${smProjectId}: type=${propType}, keys=${propKeys}, data=${dataType}, sample=${JSON.stringify(propData)?.slice(0, 300)}`);

    if (propData) {
      // Normalize: API may return object, array, {data: [...]}, or {proposals: [...]}
      let proposals: any[] = [];
      if (Array.isArray(propData)) {
        proposals = propData;
      } else if (propData?.data && Array.isArray(propData.data)) {
        proposals = propData.data;
      } else if (propData?.data && typeof propData.data === "object" && propData.data !== null && (propData.data.id || propData.data.proposalId)) {
        // API returns {data: {id, ...}} — single proposal wrapped in data
        proposals = [propData.data];
      } else if (propData?.proposals && Array.isArray(propData.proposals)) {
        proposals = propData.proposals;
      } else if (typeof propData === "object" && propData !== null && (propData.id || propData.proposalId)) {
        proposals = [propData];
      }

      console.log(`[SM] Proposals parsed for project ${smProjectId}: ${proposals.length} proposals found`);

      for (const prop of proposals) {
        const propId = prop.id || prop.proposalId;
        if (!propId) {
          console.warn(`[SM] Proposal skipped for project ${smProjectId}: no id/proposalId in keys=[${Object.keys(prop).join(",")}]`);
          continue;
        }

        const { error } = await db
          .from("solar_market_proposals")
          .upsert({
            tenant_id: config.tenant_id,
            sm_proposal_id: propId,
            sm_project_id: smProjectId,
            sm_client_id: smClientId,
            status: prop.status || null,
            generated_at: prop.generatedAt || prop.created_at || null,
            acceptance_date: prop.acceptanceDate || null,
            rejection_date: prop.rejectionDate || null,
            expiration_date: prop.expirationDate || null,
            link_pdf: prop.linkPdf || prop.pdfUrl || null,
            pricing_table: prop.pricingTable || [],
            variables: prop.variables || {},
            payload: prop,
          }, { onConflict: "tenant_id,sm_proposal_id" });

        if (error) {
          counts.errors.push(`proposal ${propId}: ${error.message}`);
          await logFailedItem(db, config.tenant_id, syncLogId, "proposal", propId, error.message, prop);
        } else {
          counts.proposals_synced++;
        }
      }
    } else {
      console.log(`[SM] No proposal data for project ${smProjectId} (null/undefined response)`);
    }
  } catch (err: any) {
    console.warn(`[SM] Proposals skipped for project ${smProjectId}: ${err.message}`);
  }
}

// ── Sync general catalogs (funnels + custom fields) ──
async function syncCatalogs(
  db: ReturnType<typeof createClient>, client: SolarMarketClient,
  config: SmConfig, counts: SyncCounts
) {
  // Funnels catalog
  try {
    let page = 1;
    while (true) {
      const data = await client.listFunnels({ limit: "100", page: String(page) });
      const funnels = Array.isArray(data) ? data : data?.data || data?.funnels || [];

      for (const f of funnels) {
        const fId = f.id || f.funnelId;
        if (!fId) continue;

        await db.from("solar_market_funnels_catalog").upsert({
          tenant_id: config.tenant_id,
          sm_funnel_id: fId,
          name: f.name || null,
          stages: f.stages || f.steps || [],
          payload: f,
        }, { onConflict: "tenant_id,sm_funnel_id" });
      }

      if (funnels.length < 100) break;
      page++;
    }
  } catch (err: any) {
    console.warn("[SM] Funnels catalog sync skipped:", err.message);
  }

  // Custom Fields catalog
  try {
    let page = 1;
    while (true) {
      const data = await client.listCustomFields({ limit: "100", page: String(page) });
      const fields = Array.isArray(data) ? data : data?.data || data?.customFields || [];

      for (const f of fields) {
        const cfId = f.id || f.customFieldId;
        if (!cfId) continue;

        await db.from("solar_market_custom_fields_catalog").upsert({
          tenant_id: config.tenant_id,
          sm_custom_field_id: cfId,
          field_key: f.key || null,
          field_type: f.type || null,
          label: f.label || f.name || null,
          options: f.options || null,
          payload: f,
        }, { onConflict: "tenant_id,sm_custom_field_id" });
      }

      if (fields.length < 100) break;
      page++;
    }
  } catch (err: any) {
    console.warn("[SM] Custom fields catalog sync skipped:", err.message);
  }
}

// ── Link leads by phone ──
async function linkLeads(
  db: ReturnType<typeof createClient>, config: SmConfig, counts: SyncCounts
) {
  console.log("[SM] Running automatic lead linking...");

  const { data: smClients, error: fetchErr } = await db
    .from("solar_market_clients")
    .select("sm_client_id, phone_normalized")
    .eq("tenant_id", config.tenant_id)
    .not("phone_normalized", "eq", "")
    .not("phone_normalized", "is", null)
    .is("deleted_at", null);

  if (fetchErr || !smClients?.length) {
    console.log("[SM] No SM clients to link or error:", fetchErr?.message);
    return;
  }

  for (const smClient of smClients) {
    const { data: existing } = await db
      .from("lead_links")
      .select("id")
      .eq("sm_client_id", smClient.sm_client_id)
      .eq("tenant_id", config.tenant_id)
      .limit(1)
      .maybeSingle();

    if (existing) continue;

    const { data: lead } = await db
      .from("leads")
      .select("id")
      .eq("telefone_normalized", smClient.phone_normalized)
      .eq("tenant_id", config.tenant_id)
      .limit(1)
      .maybeSingle();

    if (!lead) continue;

    const { data: firstProject } = await db
      .from("solar_market_projects")
      .select("sm_project_id")
      .eq("sm_client_id", smClient.sm_client_id)
      .eq("tenant_id", config.tenant_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { error: linkErr } = await db
      .from("lead_links")
      .upsert({
        tenant_id: config.tenant_id,
        lead_id: lead.id,
        sm_client_id: smClient.sm_client_id,
        sm_project_id: firstProject?.sm_project_id || null,
        link_reason: "auto_phone_match",
      }, { onConflict: "tenant_id,lead_id,sm_client_id" });

    if (!linkErr) {
      counts.leads_linked++;
      console.log(`[SM] Linked lead ${lead.id} ↔ SM client ${smClient.sm_client_id}`);
    }
  }
}

// ── Full Sync (chunked: init → projects in batches of CHUNK_SIZE) ──
async function runFullSync(
  db: ReturnType<typeof createClient>, smClient: SolarMarketClient,
  config: SmConfig, counts: SyncCounts, syncLogId: string | null,
  phase: string = "init", chunkOffset: number = 0
): Promise<SyncResult> {

  // ── Phase "init": users + clients (batched) + projects (bulk) + catalogs ──
  if (phase === "init") {
    console.log("[SM] === FULL SYNC (phase: init) ===");

    await syncUsers(db, smClient, config, counts, syncLogId);
    await syncClients(db, smClient, config, counts, syncLogId);

    // Save clients timestamp early so crash doesn't restart from zero
    await db.from("solar_market_config").update({
      last_sync_clients_at: new Date().toISOString(),
    }).eq("id", config.id);

    // Bulk fetch ALL projects (replaces N+1 per-client pattern)
    await syncAllProjectsBulk(db, smClient, config, counts, syncLogId);

    // Save projects timestamp early
    await db.from("solar_market_config").update({
      last_sync_projects_at: new Date().toISOString(),
    }).eq("id", config.id);

    await syncCatalogs(db, smClient, config, counts);

    console.log("[SM] Init phase complete. Continuing with sub-resources...");
    return { done: false, nextPhase: "sub_resources", nextOffset: 0 };
  }

  // ── Phase "sub_resources": process CHUNK_SIZE projects per invocation ──
  if (phase === "sub_resources") {
    console.log(`[SM] === FULL SYNC (phase: sub_resources, offset: ${chunkOffset}) ===`);

    // Fetch projects from DB (already bulk-synced in init phase)
    const { data: dbProjects } = await db
      .from("solar_market_projects")
      .select("sm_project_id, sm_client_id")
      .eq("tenant_id", config.tenant_id)
      .is("deleted_at", null)
      .order("sm_project_id", { ascending: true })
      .range(chunkOffset, chunkOffset + CHUNK_SIZE - 1);

    if (!dbProjects?.length) {
      // All projects processed — finalize
      await linkLeads(db, config, counts);
      console.log("[SM] === FULL SYNC COMPLETE ===");
      return { done: true };
    }

    for (let i = 0; i < dbProjects.length; i++) {
      if (i % 5 === 0 && await isSyncCancelled(db, syncLogId)) {
        console.log("[SM] Sync cancelled by user");
        counts.errors.push("Cancelado pelo usuário");
        return { done: true };
      }
      const proj = dbProjects[i];
      await syncProjectSubResources(db, smClient, config, proj.sm_project_id, proj.sm_client_id, counts, syncLogId);
      // Small delay between projects (sub-resources already have 1100ms delays internally)
      await new Promise((r) => setTimeout(r, 200));
    }

    const nextOffset = chunkOffset + CHUNK_SIZE;
    console.log(`[SM] Sub-resources chunk done (${dbProjects.length} projects). Next offset: ${nextOffset}`);
    return { done: false, nextPhase: "sub_resources", nextOffset };
  }

  return { done: true };
}




// ── Incremental Sync ──
async function runIncrementalSync(
  db: ReturnType<typeof createClient>, smClient: SolarMarketClient,
  config: SmConfig, counts: SyncCounts, syncLogId: string | null,
  phase: string = "init", chunkOffset: number = 0
): Promise<SyncResult> {
  const clientsAfter = config.last_sync_clients_at
    ? new Date(config.last_sync_clients_at).toISOString().split("T")[0]
    : undefined;
  const projectsAfter = config.last_sync_projects_at
    ? new Date(config.last_sync_projects_at).toISOString().split("T")[0]
    : undefined;

  // If never synced, delegate to chunked full sync
  if (!clientsAfter && !projectsAfter) {
    return runFullSync(db, smClient, config, counts, syncLogId, phase, chunkOffset);
  }

  // Incremental with dates — smaller volume, single invocation
  console.log("[SM] === INCREMENTAL SYNC START ===");
  console.log(`[SM] Filters: clientsAfter=${clientsAfter}, projectsAfter=${projectsAfter}`);

  // Sync users (always full, lightweight)
  await syncUsers(db, smClient, config, counts, syncLogId);

  // Sync new clients (bulk)
  await syncClients(db, smClient, config, counts, syncLogId, clientsAfter);

  // Sync new projects (bulk) — replaces per-client N+1
  await syncAllProjectsBulk(db, smClient, config, counts, syncLogId, projectsAfter);

  // Check cancellation before sub-resources
  if (await isSyncCancelled(db, syncLogId)) {
    console.log("[SM] Incremental sync cancelled by user");
    counts.errors.push("Cancelado pelo usuário");
    return { done: true };
  }

  // Sub-resources for NEW projects only (fetched with createdAfter)
  const { data: newProjects } = await db
    .from("solar_market_projects")
    .select("sm_project_id, sm_client_id")
    .eq("tenant_id", config.tenant_id)
    .is("deleted_at", null)
    .gte("updated_at", config.last_sync_projects_at || "2000-01-01")
    .order("sm_project_id", { ascending: true });

  if (newProjects?.length) {
    console.log(`[SM] Fetching sub-resources for ${newProjects.length} new/updated projects`);
    for (let i = 0; i < newProjects.length; i++) {
      if (i % 5 === 0 && await isSyncCancelled(db, syncLogId)) {
        counts.errors.push("Cancelado pelo usuário");
        return { done: true };
      }
      const proj = newProjects[i];
      await syncProjectSubResources(db, smClient, config, proj.sm_project_id, proj.sm_client_id, counts, syncLogId);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  await linkLeads(db, config, counts);

  // Save timestamps
  await db.from("solar_market_config").update({
    last_sync_clients_at: new Date().toISOString(),
    last_sync_projects_at: new Date().toISOString(),
  }).eq("id", config.id);

  console.log("[SM] === INCREMENTAL SYNC END ===");
  return { done: true };
}

// ── Delta Sync (single entity) ──
async function runDeltaSync(
  db: ReturnType<typeof createClient>, smClient: SolarMarketClient,
  config: SmConfig, counts: SyncCounts, delta: any, syncLogId: string | null
) {
  console.log("[SM] === DELTA SYNC START ===", JSON.stringify(delta));

  if (delta.type === "client" && delta.sm_client_id) {
    try {
      const clients = await smClient.listClients({ id: delta.sm_client_id });
      const clientList = Array.isArray(clients) ? clients : clients?.data || [];
      if (clientList.length > 0) {
        const c = clientList[0];
        const phone = c.primaryPhone || c.phone || c.telefone || "";
        await db.from("solar_market_clients").upsert({
          tenant_id: config.tenant_id,
          sm_client_id: delta.sm_client_id,
          name: c.name || c.nome || "",
          email: c.email || "",
          phone,
          phone_normalized: normalizePhone(phone),
          cnpj_cpf: c.cnpjCpf || null,
          primary_phone: c.primaryPhone || null,
          secondary_phone: c.secondaryPhone || null,
          city: c.city || null,
          state: c.state ? String(c.state).slice(0, 2) : null,
          payload: c,
          deleted_at: null,
        }, { onConflict: "tenant_id,sm_client_id" });
        counts.clients_synced++;
      }
    } catch (err: any) {
      counts.errors.push(`delta client ${delta.sm_client_id}: ${err.message}`);
      await logFailedItem(db, config.tenant_id, syncLogId, "client", delta.sm_client_id, err.message);
    }

    // Fetch projects for this client and sync sub-resources
    try {
      const projData = await smClient.listProjects({ clientId: delta.sm_client_id });
      const projects = Array.isArray(projData) ? projData : projData?.data || projData?.projects || [];
      for (const p of projects) {
        const smProjId = p.id || p.projectId;
        if (!smProjId) continue;
        await db.from("solar_market_projects").upsert({
          tenant_id: config.tenant_id, sm_project_id: smProjId,
          sm_client_id: delta.sm_client_id, status: p.status || null,
          payload: p, deleted_at: null,
        }, { onConflict: "tenant_id,sm_project_id" });
        counts.projects_synced++;
        await syncProjectSubResources(db, smClient, config, smProjId, delta.sm_client_id, counts, syncLogId);
        await new Promise((r) => setTimeout(r, 1100));
      }
    } catch (err: any) {
      counts.errors.push(`delta client projects ${delta.sm_client_id}: ${err.message}`);
    }
  }

  if (delta.type === "project" && delta.sm_project_id) {
    try {
      const projects = await smClient.listProjects({ id: delta.sm_project_id });
      const projList = Array.isArray(projects) ? projects : projects?.data || [];
      if (projList.length > 0) {
        const p = projList[0];
        const smCliId = p.clientId || delta.sm_client_id || 0;
        await db.from("solar_market_projects").upsert({
          tenant_id: config.tenant_id,
          sm_project_id: delta.sm_project_id,
          sm_client_id: smCliId,
          status: p.status || null,
          payload: p,
          deleted_at: null,
        }, { onConflict: "tenant_id,sm_project_id" });
        counts.projects_synced++;

        await syncProjectSubResources(db, smClient, config, delta.sm_project_id, smCliId, counts, syncLogId);
      }
    } catch (err: any) {
      counts.errors.push(`delta project ${delta.sm_project_id}: ${err.message}`);
      await logFailedItem(db, config.tenant_id, syncLogId, "project", delta.sm_project_id, err.message);
    }
  }

  if (delta.type === "proposal" && (delta.sm_project_id || delta.sm_proposal_id)) {
    const projId = delta.sm_project_id;
    if (projId) {
      try {
        const propData = await smClient.getActiveProposalByProject(projId);
        if (propData) {
          const proposals = Array.isArray(propData) ? propData : [propData];
          for (const prop of proposals) {
            const propId = prop.id || prop.proposalId;
            if (!propId) continue;
            await db.from("solar_market_proposals").upsert({
              tenant_id: config.tenant_id,
              sm_proposal_id: propId,
              sm_project_id: projId,
              sm_client_id: delta.sm_client_id || 0,
              status: prop.status || null,
              generated_at: prop.generatedAt || null,
              acceptance_date: prop.acceptanceDate || null,
              rejection_date: prop.rejectionDate || null,
              expiration_date: prop.expirationDate || null,
              link_pdf: prop.linkPdf || prop.pdfUrl || null,
              pricing_table: prop.pricingTable || [],
              variables: prop.variables || {},
              payload: prop,
            }, { onConflict: "tenant_id,sm_proposal_id" });
            counts.proposals_synced++;
          }
        }
      } catch (err: any) {
        counts.errors.push(`delta proposal proj ${projId}: ${err.message}`);
        await logFailedItem(db, config.tenant_id, syncLogId, "proposal", projId, err.message);
      }
    }
  }

  if (delta.type === "client_deleted" && delta.sm_client_id) {
    await db.from("solar_market_clients").update({ deleted_at: new Date().toISOString() })
      .eq("tenant_id", config.tenant_id).eq("sm_client_id", delta.sm_client_id);
  }

  if (delta.type === "project_deleted" && delta.sm_project_id) {
    await db.from("solar_market_projects").update({ deleted_at: new Date().toISOString() })
      .eq("tenant_id", config.tenant_id).eq("sm_project_id", delta.sm_project_id);
  }

  await linkLeads(db, config, counts);
  console.log("[SM] === DELTA SYNC END ===");
}

// ══════════════════════════════════════════════════════════════
// Main Handler
// ══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let mode = "full";
  let source = "manual";
  let triggeredBy: string | null = null;
  let deltaPayload: any = null;
  let phase = "init";
  let chunkOffset = 0;
  let existingSyncLogId: string | null = null;

  try {
    if (req.method === "POST") {
      const body = await req.json();
      mode = body.mode || "full";
      source = body.source || "manual";
      triggeredBy = body.triggered_by || null;
      deltaPayload = body.delta || null;
      phase = body.phase || "init";
      chunkOffset = body.chunk_offset || 0;
      existingSyncLogId = body.sync_log_id || null;
    }
  } catch {
    // GET request or empty body = full sync
  }

  // Auth check for manual triggers (skip for continuations & cron)
  if (source === "manual") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    triggeredBy = userData.user.id;

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", triggeredBy);

    const isAdmin = roles?.some((r: any) =>
      ["admin", "gerente", "financeiro"].includes(r.role)
    );

    if (!isAdmin) {
      return jsonRes({ error: "Apenas administradores podem sincronizar" }, 403);
    }
  }

  // Get config
  const { data: configRaw, error: configErr } = await supabaseAdmin
    .from("solar_market_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (configErr || !configRaw) {
    return jsonRes({ error: "Configuração SolarMarket não encontrada" }, 404);
  }

  if (!configRaw.enabled) {
    return jsonRes({ error: "Integração SolarMarket desabilitada" }, 400);
  }

  const config = configRaw as SmConfig;

  // ── Test mode: verify connectivity ──
  if (mode === "test") {
    try {
      const svc = new SolarMarketService(supabaseAdmin, config);
      await svc.signin();
      const smClient = new SolarMarketClient(svc);
      await smClient.listClients({ limit: "1" });
      return jsonRes({ status: "ok", message: "Conexão com SolarMarket bem-sucedida" });
    } catch (err: any) {
      return jsonRes({ error: err.message }, 400);
    }
  }

  // ── Create or reuse sync log ──
  let syncLogId: string | null = existingSyncLogId;

  if (!syncLogId) {
    const { data: syncLog } = await supabaseAdmin
      .from("solar_market_sync_logs")
      .insert({
        tenant_id: config.tenant_id,
        status: "running",
        triggered_by: triggeredBy,
        source,
        mode,
      })
      .select("id")
      .single();
    syncLogId = syncLog?.id || null;
  }

  let counts = newCounts();

  try {
    const svc = new SolarMarketService(supabaseAdmin, config);
    const smClient = new SolarMarketClient(svc);

    let result: SyncResult;

    if (mode === "delta" && deltaPayload) {
      await runDeltaSync(supabaseAdmin, smClient, config, counts, deltaPayload, syncLogId);
      result = { done: true };
    } else if (mode === "incremental") {
      result = await runIncrementalSync(supabaseAdmin, smClient, config, counts, syncLogId, phase, chunkOffset);
    } else {
      result = await runFullSync(supabaseAdmin, smClient, config, counts, syncLogId, phase, chunkOffset);
    }

    // ── Merge counts (always, so first invocation also persists) ──
    if (syncLogId) {
      if (existingSyncLogId) {
        counts = await mergeSyncCounts(supabaseAdmin, syncLogId, counts);
      }
      // Persist counts even on first invocation (intermediate save)
      await supabaseAdmin.from("solar_market_sync_logs").update({
        counts,
        error: counts.errors.length > 0 ? counts.errors.join("; ") : null,
      }).eq("id", syncLogId);
    }

    // ── If more chunks remain: save progress + self-invoke ──
    if (!result.done && syncLogId) {
      // CRITICAL: Set status to "continuing" so the finally guard doesn't kill the chain
      await supabaseAdmin.from("solar_market_sync_logs").update({
        status: "continuing",
        counts,
        error: counts.errors.length > 0 ? counts.errors.join("; ") : null,
      }).eq("id", syncLogId);

      console.log(`[SM] Self-invoking: phase=${result.nextPhase}, offset=${result.nextOffset}`);

      // Fire-and-forget self-invocation for next chunk
      supabaseAdmin.functions.invoke("solar-market-sync", {
        body: {
          mode,
          source: "continuation",
          phase: result.nextPhase,
          chunk_offset: result.nextOffset,
          sync_log_id: syncLogId,
        },
      }).catch((err: any) => console.error("[SM] Self-invoke error:", err.message));

      return jsonRes({
        status: "continuing",
        counts,
        sync_log_id: syncLogId,
        next_phase: result.nextPhase,
        next_offset: result.nextOffset,
      });
    }

    // ── Done — finalize ──
    const wasCancelled = await isSyncCancelled(supabaseAdmin, syncLogId);
    const hasCancelError = counts.errors.some(e => e.includes("Cancelado pelo usuário"));
    const finalStatus = wasCancelled || hasCancelError
      ? "cancelled"
      : counts.errors.length > 0
        ? "partial"
        : "success";

    if (syncLogId) {
      await supabaseAdmin.from("solar_market_sync_logs").update({
        finished_at: new Date().toISOString(),
        status: finalStatus,
        counts,
        error: counts.errors.length > 0 ? counts.errors.join("; ") : null,
      }).eq("id", syncLogId);
    }

    console.log(`[SM] Sync finished: ${finalStatus}`, JSON.stringify(counts));
    return jsonRes({ status: finalStatus, counts, sync_log_id: syncLogId });

  } catch (err: any) {
    console.error("[SM] Sync fatal error:", err.message);

    // Merge counts on error too (for continuations)
    if (syncLogId && existingSyncLogId) {
      try { counts = await mergeSyncCounts(supabaseAdmin, syncLogId, counts); } catch {}
    }

    if (syncLogId) {
      await supabaseAdmin.from("solar_market_sync_logs").update({
        finished_at: new Date().toISOString(),
        status: "fail",
        error: err.message,
        counts,
      }).eq("id", syncLogId);
    }

    return jsonRes({ error: err.message, counts }, 500);
  } finally {
    // Anti-zombie: check for ALL invocations (including continuations)
    if (syncLogId) {
      try {
        const { data: check } = await supabaseAdmin
          .from("solar_market_sync_logs")
          .select("status, finished_at")
          .eq("id", syncLogId)
          .single();

        // Only force-fail if still "running" (not "continuing") AND no finished_at
        if (check?.status === "running" && check?.finished_at === null) {
          console.warn(`[SM] Finally guard: sync ${syncLogId} still running without finished_at, forcing fail`);
          await supabaseAdmin.from("solar_market_sync_logs").update({
            finished_at: new Date().toISOString(),
            status: "fail",
            error: "forced-fail: finally guard (unexpected exit without status update)",
            counts,
          }).eq("id", syncLogId);
        } else if (check?.status === "continuing") {
          // Continuation dispatched — reset status back to "running" for next invocation
          await supabaseAdmin.from("solar_market_sync_logs").update({
            status: "running",
          }).eq("id", syncLogId);
        }
      } catch (e: any) {
        console.warn(`[SM] Finally guard error: ${e.message}`);
      }
    }
  }
});
