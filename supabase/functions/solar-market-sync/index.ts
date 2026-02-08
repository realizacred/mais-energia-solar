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
  // Remove country code 55 prefix if present
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits;
}

function genRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ══════════════════════════════════════════════════════════════
// SolarMarketService — Auth + Request Wrapper
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

  // Get the raw API token from DB config or Supabase secret
  private getRawApiToken(): string {
    // Priority: DB config > Supabase secret
    if (this.config.api_token) {
      return this.config.api_token;
    }
    const secretToken = Deno.env.get("SOLARMARKET_TOKEN");
    if (secretToken) {
      return secretToken;
    }
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
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ token: rawToken }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - start;

      if (!res.ok) {
        const text = await res.text();
        console.error(`[SM] [${reqId}] signin FAILED (${res.status}) ${duration}ms: ${text}`);
        throw new Error(`SolarMarket signin falhou (${res.status}): ${text}`);
      }

      const data = await res.json();
      const token = data.access_token || data.accessToken || data.token;
      if (!token) {
        throw new Error("SolarMarket não retornou access_token na resposta de signin");
      }

      // Cache token for 5h55min (margin from 6h TTL)
      const expiresAt = Date.now() + (5 * 60 + 55) * 60_000;
      this.accessToken = token;
      this.tokenExpiresAt = expiresAt;

      // Persist cache in DB
      await this.supabaseAdmin
        .from("solar_market_config")
        .update({
          last_token: token,
          last_token_expires_at: new Date(expiresAt).toISOString(),
        })
        .eq("id", this.config.id);

      console.log(`[SM] [${reqId}] signin OK ${duration}ms [token cached 5h55min]`);
      return token;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error("Timeout ao conectar com SolarMarket (15s)");
      }
      throw err;
    }
  }

  // Get valid JWT, refreshing if expired
  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt > Date.now() + 60_000) {
      return this.accessToken;
    }

    // Simple mutex to avoid concurrent signins
    if (this.signingIn) {
      // Wait up to 20s for concurrent signin
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (!this.signingIn && this.accessToken) return this.accessToken;
      }
      throw new Error("Timeout aguardando signin concorrente");
    }

    this.signingIn = true;
    try {
      const token = await this.signin();
      return token;
    } finally {
      this.signingIn = false;
    }
  }

  // Generic request with auth, retry, backoff
  async request(
    method: string,
    path: string,
    opts?: { params?: Record<string, string | number | undefined>; body?: unknown }
  ): Promise<any> {
    const reqId = genRequestId();
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const token = await this.getAccessToken();

      // Build URL with query params
      let url = `${this.config.base_url}${path}`;
      if (opts?.params) {
        const searchParams = new URLSearchParams();
        for (const [k, v] of Object.entries(opts.params)) {
          if (v !== undefined && v !== null && v !== "") {
            searchParams.set(k, String(v));
          }
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
      console.log(`[SM] [${reqId}] ${method} ${url} (attempt ${attempt + 1})`);

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
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }

        // Auth failed — refresh token once
        if ((res.status === 401 || res.status === 403) && attempt === 0) {
          console.warn(`[SM] [${reqId}] ${res.status} → refreshing token...`);
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          continue;
        }

        // Server error — retry with backoff
        if (res.status >= 500 && attempt < maxRetries) {
          const wait = Math.pow(2, attempt) * 1000;
          console.warn(`[SM] [${reqId}] ${res.status} Server error, retrying in ${wait}ms...`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }

        if (!res.ok) {
          const text = await res.text();
          console.error(`[SM] [${reqId}] ${method} ${path} → ${res.status} ${duration}ms: ${text.slice(0, 300)}`);
          throw new Error(`SM API ${res.status}: ${text.slice(0, 200)}`);
        }

        // Handle 204 No Content
        if (res.status === 204) {
          console.log(`[SM] [${reqId}] ${method} ${path} → 204 ${duration}ms`);
          return null;
        }

        const data = await res.json();
        console.log(`[SM] [${reqId}] ${method} ${path} → ${res.status} ${duration}ms`);
        return data;
      } catch (err: any) {
        if (err.name === "AbortError") {
          if (attempt < maxRetries) {
            console.warn(`[SM] [${reqId}] Timeout, retrying...`);
            continue;
          }
          throw new Error(`SM API timeout after ${maxRetries + 1} attempts`);
        }
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

  // ── Clients ──
  async listClients(filters: {
    limit?: string; page?: string; id?: number; email?: string;
    cnpjCpf?: string; name?: string; phone?: string;
    createdBefore?: string; createdAfter?: string;
  } = {}) {
    // Normalize phone: remove non-digits, remove 55 prefix
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
    while (true) {
      const data = await this.listClients({ ...filters, limit, page: String(page) });
      const items = Array.isArray(data) ? data : data?.data || data?.clients || [];
      all.push(...items);
      if (items.length < 100) break;
      page++;
      await new Promise((r) => setTimeout(r, 300)); // throttle
    }
    return all;
  }

  async createClient(payload: Record<string, unknown>) {
    // Normalize fields
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
    while (true) {
      const data = await this.listProjects({ ...filters, limit: "100", page: String(page) });
      const items = Array.isArray(data) ? data : data?.data || data?.projects || [];
      all.push(...items);
      if (items.length < 100) break;
      page++;
      await new Promise((r) => setTimeout(r, 300));
    }
    return all;
  }

  async createProject(payload: Record<string, unknown>) {
    // Enforce: clientId XOR client
    if (payload.clientId && payload.client) {
      delete payload.client;
    }
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

// ── Sync Clients ──
async function syncClients(
  db: ReturnType<typeof createClient>, client: SolarMarketClient,
  config: SmConfig, counts: SyncCounts, createdAfter?: string
): Promise<any[]> {
  try {
    console.log(`[SM] Syncing clients${createdAfter ? ` (after ${createdAfter})` : " (full)"}...`);
    const clients = await client.listClientsAll({ createdAfter });
    console.log(`[SM] Fetched ${clients.length} clients from SM`);

    for (const c of clients) {
      const smId = c.id || c.clientId;
      if (!smId) continue;

      const phone = c.primaryPhone || c.phone || c.telefone || "";
      const phoneNorm = normalizePhone(phone);

      const { error } = await db
        .from("solar_market_clients")
        .upsert({
          tenant_id: config.tenant_id,
          sm_client_id: smId,
          name: c.name || c.nome || "",
          email: c.email || "",
          phone: phone,
          phone_normalized: phoneNorm,
          cnpj_cpf: c.cnpjCpf || c.cpf || c.cnpj || null,
          primary_phone: c.primaryPhone || null,
          secondary_phone: c.secondaryPhone || null,
          city: c.city || c.cidade || null,
          state: c.state ? String(c.state).slice(0, 2).toUpperCase() : null,
          payload: c,
          deleted_at: null, // un-soft-delete if reappeared
        }, { onConflict: "tenant_id,sm_client_id" });

      if (error) {
        counts.errors.push(`client ${smId}: ${error.message}`);
      } else {
        counts.clients_synced++;
      }
    }
    return clients;
  } catch (err: any) {
    console.error("[SM] Sync clients error:", err.message);
    counts.errors.push(`clients: ${err.message}`);
    return [];
  }
}

// ── Sync Projects for a Client ──
async function syncProjectsForClient(
  db: ReturnType<typeof createClient>, client: SolarMarketClient,
  config: SmConfig, smClientId: number, counts: SyncCounts
) {
  try {
    const data = await client.listProjects({ clientId: smClientId });
    const projects = Array.isArray(data) ? data : data?.data || data?.projects || [];

    for (const p of projects) {
      const smProjId = p.id || p.projectId;
      if (!smProjId) continue;

      const { error } = await db
        .from("solar_market_projects")
        .upsert({
          tenant_id: config.tenant_id,
          sm_project_id: smProjId,
          sm_client_id: smClientId,
          status: p.status || p.situacao || null,
          payload: p,
          deleted_at: null,
        }, { onConflict: "tenant_id,sm_project_id" });

      if (error) {
        counts.errors.push(`project ${smProjId}: ${error.message}`);
      } else {
        counts.projects_synced++;
      }

      // Sync sub-resources for each project
      await syncProjectSubResources(db, client, config, smProjId, smClientId, counts);
    }
  } catch (err: any) {
    counts.errors.push(`projects client ${smClientId}: ${err.message}`);
  }
}

// ── Sync project sub-resources: custom fields, funnels, proposals ──
async function syncProjectSubResources(
  db: ReturnType<typeof createClient>, client: SolarMarketClient,
  config: SmConfig, smProjectId: number, smClientId: number, counts: SyncCounts
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
      } else {
        counts.custom_fields_synced++;
      }
    }
  } catch (err: any) {
    // Custom fields endpoint may not exist for all projects
    console.warn(`[SM] Custom fields skipped for project ${smProjectId}: ${err.message}`);
  }

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
    } else {
      counts.funnels_synced++;
    }
  } catch (err: any) {
    console.warn(`[SM] Funnels skipped for project ${smProjectId}: ${err.message}`);
  }

  // Active Proposal
  try {
    const propData = await client.getActiveProposalByProject(smProjectId);
    if (propData) {
      const proposals = Array.isArray(propData) ? propData : propData?.data || [propData];
      for (const prop of proposals) {
        const propId = prop.id || prop.proposalId;
        if (!propId) continue;

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
        } else {
          counts.proposals_synced++;
        }
      }
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
    // Check if already linked
    const { data: existing } = await db
      .from("lead_links")
      .select("id")
      .eq("sm_client_id", smClient.sm_client_id)
      .eq("tenant_id", config.tenant_id)
      .limit(1)
      .maybeSingle();

    if (existing) continue;

    // Find matching lead by phone
    const { data: lead } = await db
      .from("leads")
      .select("id")
      .eq("telefone_normalized", smClient.phone_normalized)
      .eq("tenant_id", config.tenant_id)
      .limit(1)
      .maybeSingle();

    if (!lead) continue;

    // Get first project for this client
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

// ── Full Sync ──
async function runFullSync(
  db: ReturnType<typeof createClient>, smClient: SolarMarketClient,
  config: SmConfig, counts: SyncCounts
) {
  console.log("[SM] === FULL SYNC START ===");

  // 1. Sync all clients
  const clients = await syncClients(db, smClient, config, counts);

  // 2. For each client: sync projects + sub-resources
  for (const c of clients) {
    const smClientId = c.id || c.clientId;
    if (!smClientId) continue;
    await syncProjectsForClient(db, smClient, config, smClientId, counts);
    await new Promise((r) => setTimeout(r, 200)); // throttle
  }

  // 3. Sync catalogs
  await syncCatalogs(db, smClient, config, counts);

  // 4. Link leads
  await linkLeads(db, config, counts);

  // Update last sync timestamps
  await db.from("solar_market_config").update({
    last_sync_clients_at: new Date().toISOString(),
    last_sync_projects_at: new Date().toISOString(),
  }).eq("id", config.id);

  console.log("[SM] === FULL SYNC END ===");
}

// ── Incremental Sync ──
async function runIncrementalSync(
  db: ReturnType<typeof createClient>, smClient: SolarMarketClient,
  config: SmConfig, counts: SyncCounts
) {
  console.log("[SM] === INCREMENTAL SYNC START ===");

  const clientsAfter = config.last_sync_clients_at
    ? new Date(config.last_sync_clients_at).toISOString().split("T")[0]
    : undefined;
  const projectsAfter = config.last_sync_projects_at
    ? new Date(config.last_sync_projects_at).toISOString().split("T")[0]
    : undefined;

  // If never synced, do full
  if (!clientsAfter && !projectsAfter) {
    return runFullSync(db, smClient, config, counts);
  }

  // Sync new clients
  const newClients = await syncClients(db, smClient, config, counts, clientsAfter);
  for (const c of newClients) {
    const smClientId = c.id || c.clientId;
    if (!smClientId) continue;
    await syncProjectsForClient(db, smClient, config, smClientId, counts);
    await new Promise((r) => setTimeout(r, 200));
  }

  // Sync new projects (may belong to existing clients)
  try {
    const newProjects = await smClient.listProjectsAll({ createdAfter: projectsAfter });
    for (const p of newProjects) {
      const smProjId = p.id || p.projectId;
      const smCliId = p.clientId || p.client_id;
      if (!smProjId) continue;

      await db.from("solar_market_projects").upsert({
        tenant_id: config.tenant_id,
        sm_project_id: smProjId,
        sm_client_id: smCliId || 0,
        status: p.status || null,
        payload: p,
        deleted_at: null,
      }, { onConflict: "tenant_id,sm_project_id" });
      counts.projects_synced++;

      await syncProjectSubResources(db, smClient, config, smProjId, smCliId || 0, counts);
      await new Promise((r) => setTimeout(r, 200));
    }
  } catch (err: any) {
    counts.errors.push(`incremental projects: ${err.message}`);
  }

  await linkLeads(db, config, counts);

  await db.from("solar_market_config").update({
    last_sync_clients_at: new Date().toISOString(),
    last_sync_projects_at: new Date().toISOString(),
  }).eq("id", config.id);

  console.log("[SM] === INCREMENTAL SYNC END ===");
}

// ── Delta Sync (single entity) ──
async function runDeltaSync(
  db: ReturnType<typeof createClient>, smClient: SolarMarketClient,
  config: SmConfig, counts: SyncCounts, delta: any
) {
  console.log("[SM] === DELTA SYNC START ===", JSON.stringify(delta));

  if (delta.type === "client" && delta.sm_client_id) {
    // Sync single client
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
    }

    // Also sync projects for this client
    await syncProjectsForClient(db, smClient, config, delta.sm_client_id, counts);
  }

  if (delta.type === "project" && delta.sm_project_id) {
    // Sync single project
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

        await syncProjectSubResources(db, smClient, config, delta.sm_project_id, smCliId, counts);
      }
    } catch (err: any) {
      counts.errors.push(`delta project ${delta.sm_project_id}: ${err.message}`);
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

  // Parse request
  let mode = "full";
  let source = "manual";
  let triggeredBy: string | null = null;
  let deltaPayload: any = null;

  try {
    if (req.method === "POST") {
      const body = await req.json();
      mode = body.mode || "full";
      source = body.source || "manual";
      triggeredBy = body.triggered_by || null;
      deltaPayload = body.delta || null;
    }
  } catch {
    // GET request or empty body = full sync
  }

  // Auth check for manual triggers
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
      // Quick connectivity test
      const smClient = new SolarMarketClient(svc);
      await smClient.listClients({ limit: "1" });
      return jsonRes({ status: "ok", message: "Conexão com SolarMarket bem-sucedida" });
    } catch (err: any) {
      return jsonRes({ error: err.message }, 400);
    }
  }

  // Create sync log
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

  const counts = newCounts();

  try {
    const svc = new SolarMarketService(supabaseAdmin, config);
    const smClient = new SolarMarketClient(svc);

    if (mode === "delta" && deltaPayload) {
      await runDeltaSync(supabaseAdmin, smClient, config, counts, deltaPayload);
    } else if (mode === "incremental") {
      await runIncrementalSync(supabaseAdmin, smClient, config, counts);
    } else {
      await runFullSync(supabaseAdmin, smClient, config, counts);
    }

    const finalStatus = counts.errors.length > 0 ? "partial" : "success";

    if (syncLog?.id) {
      await supabaseAdmin.from("solar_market_sync_logs").update({
        finished_at: new Date().toISOString(),
        status: finalStatus,
        counts,
        error: counts.errors.length > 0 ? counts.errors.join("; ") : null,
      }).eq("id", syncLog.id);
    }

    console.log(`[SM] Sync finished: ${finalStatus}`, JSON.stringify(counts));

    return jsonRes({ status: finalStatus, counts, sync_log_id: syncLog?.id });
  } catch (err: any) {
    console.error("[SM] Sync fatal error:", err.message);

    if (syncLog?.id) {
      await supabaseAdmin.from("solar_market_sync_logs").update({
        finished_at: new Date().toISOString(),
        status: "fail",
        error: err.message,
        counts,
      }).eq("id", syncLog.id);
    }

    return jsonRes({ error: err.message, counts }, 500);
  }
});
