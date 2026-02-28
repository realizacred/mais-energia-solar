import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Small delay helper to respect rate limits (60 req/min) */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parallel batch helper — runs fn on items in chunks of `concurrency` */
async function parallelBatch<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }
  return results;
}

// ─── Data Formatting Helpers ──────────────────────────────

/** Format phone: (XX) XXXXX-XXXX or (XX) XXXX-XXXX */
function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length >= 8) return digits; // raw fallback
  return raw;
}

/** Normalize phone to last 11 digits */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-11) || null;
}

/** Format CEP: XXXXX-XXX */
function formatCEP(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return raw;
}

/** Normalize email: trim + lowercase */
function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

/** Format CPF: XXX.XXX.XXX-XX or CNPJ: XX.XXX.XXX/XXXX-XX */
function formatDocument(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
  if (digits.length === 14) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
  return raw;
}

/** Title case name (respects small words like "de", "da") */
function formatName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const smallWords = new Set(["de", "da", "do", "das", "dos", "e"]);
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => {
      if (i > 0 && smallWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** Normalize state to uppercase 2-char */
function normalizeState(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  return trimmed.length === 2 ? trimmed : raw.trim();
}

/** Fetch all pages from a paginated SolarMarket endpoint with rate limiting */
async function fetchAllPages(url: string, headers: Record<string, string>): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  const limit = 100; // SM API max is 100

  while (true) {
    const sep = url.includes("?") ? "&" : "?";
    const pageUrl = `${url}${sep}limit=${limit}&page=${page}`;
    console.log(`[SM Sync] Fetching: ${pageUrl} (accumulated: ${all.length})`);

    let res: Response;
    try {
      res = await fetch(pageUrl, { headers });
    } catch (fetchErr) {
      console.error(`[SM Sync] Network error on page ${page}:`, fetchErr);
      await delay(3000);
      res = await fetch(pageUrl, { headers });
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "10", 10);
      console.log(`[SM Sync] Rate limited, waiting ${retryAfter}s...`);
      await delay(retryAfter * 1000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SM API ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const items = Array.isArray(json) ? json : json.data || [];
    all.push(...items);

    console.log(`[SM Sync] Page ${page}: got ${items.length} items, total: ${all.length}`);

    if (items.length < limit) break;
    page++;

    if (page > 100) {
      console.log(`[SM Sync] Hit max pages (100), stopping with ${all.length} items`);
      break;
    }

    // ~1.2s between pages (fits 60 req/min with margin)
    await delay(1200);
  }

  return all;
}

/** Robustly extract an array of proposals from various API response shapes */
function extractProposalArray(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.proposals)) return data.proposals;
  // If data is a single proposal object with an id, wrap it
  if (data.id && typeof data.id === "number") return [data];
  if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
    if (Array.isArray(data.data.items)) return data.data.items;
    if (Array.isArray(data.data.proposals)) return data.data.proposals;
    // Single proposal wrapped in data
    if (data.data.id) return [data.data];
  }
  return [];
}

/** Extract equipment and financial data from SolarMarket proposal payload */
function extractProposalFields(pr: any) {
  const pricingTable = Array.isArray(pr.pricingTable) ? pr.pricingTable : [];
  const variables = Array.isArray(pr.variables) ? pr.variables : [];

  // Find variable by key
  const getVar = (key: string) => {
    const v = variables.find((v: any) => v.key === key);
    return v?.value ?? null;
  };
  const getVarNum = (key: string): number | null => {
    const val = getVar(key);
    if (val == null || val === "" || val === "undefined") return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  };

  // Extract from pricingTable by category
  const findPricing = (cat: string) => pricingTable.find((p: any) => p.category === cat);
  const moduloRow = findPricing("Módulo");
  const inversorRow = findPricing("Inversor");
  const kitRow = findPricing("KIT");
  const instRow = findPricing("Instalação");

  // Total value = sum of salesValue across all pricing items
  const valorTotal = pricingTable.reduce((sum: number, p: any) => sum + (Number(p.salesValue) || 0), 0);

  // Power from variables
  const potencia = getVarNum("potencia_sistema") || getVarNum("vc_potencia_sistema") || null;

  // Equipment cost = kit salesValue; Installation cost = instalação salesValue
  const equipmentCost = kitRow ? Number(kitRow.salesValue) || null : null;
  const installationCost = instRow ? Number(instRow.salesValue) || null : null;

  // Energy generation from variables
  const energyGen = getVarNum("geracao_mensal") || getVarNum("geracao_media") || null;

  // Annual generation
  const geracaoAnual = getVarNum("geracao_anual_0") || null;

  return {
    titulo: pr.title || pr.titulo || pr.name || null,
    sm_project_id: pr.project?.id || pr.projectId || pr.project_id || null,
    sm_client_id: pr.clientId || pr.client_id || pr.project?.client?.id || null,
    description: pr.description || pr.descricao || null,
    potencia_kwp: potencia,
    valor_total: valorTotal > 0 ? valorTotal : (pr.totalValue || pr.valor_total || null),
    status: pr.status || null,
    modulos: moduloRow ? `${moduloRow.item} (${moduloRow.qnt}x)` : (pr.modules || pr.modulos || null),
    inversores: inversorRow ? `${inversorRow.item} (${inversorRow.qnt}x)` : (pr.inverters || pr.inversores || null),
    panel_model: moduloRow?.item || pr.panelModel || pr.panel_model || null,
    panel_quantity: moduloRow ? Number(moduloRow.qnt) || null : (pr.panelQuantity || null),
    inverter_model: inversorRow?.item || pr.inverterModel || pr.inverter_model || null,
    inverter_quantity: inversorRow ? Number(inversorRow.qnt) || null : (pr.inverterQuantity || null),
    discount: pr.discount || pr.desconto || null,
    installation_cost: installationCost,
    equipment_cost: equipmentCost,
    energy_generation: energyGen,
    roof_type: pr.roofType || pr.roof_type || getVar("tipo_telhado") || null,
    structure_type: pr.structureType || pr.structure_type || getVar("tipo_estrutura") || null,
    warranty: pr.warranty || pr.garantia || null,
    payment_conditions: pr.paymentConditions || pr.payment_conditions || null,
    valid_until: pr.validUntil || pr.valid_until || pr.expirationDate || null,
    sm_created_at: pr.createdAt || pr.created_at || pr.generatedAt || null,
    sm_updated_at: pr.updatedAt || pr.updated_at || null,
    // New fields
    link_pdf: pr.linkPdf || pr.link_pdf || null,
    consumo_mensal: getVarNum("consumo_mensal"),
    tarifa_distribuidora: getVarNum("tarifa_distribuidora"),
    economia_mensal: getVarNum("economia_mensal"),
    economia_mensal_percent: getVarNum("economia_mensal_p") != null ? (getVarNum("economia_mensal_p")! * 100) : null,
    payback: getVar("payback"),
    vpl: getVarNum("vpl"),
    tir: getVarNum("tir"),
    preco_total: getVarNum("preco"),
    fase: getVar("fase"),
    tipo_dimensionamento: getVar("tipo"),
    dis_energia: getVar("dis_energia"),
    cidade: getVar("cidade") || pr.project?.client?.city || null,
    estado: getVar("estado") || pr.project?.client?.state || null,
    geracao_anual: geracaoAnual,
    inflacao_energetica: getVarNum("inflacao_energetica"),
    perda_eficiencia_anual: getVarNum("perda_eficiencia_anual"),
    sobredimensionamento: getVarNum("sobredimensionamento"),
    custo_disponibilidade: getVarNum("custo_disponibilidade_valor"),
    generated_at: pr.generatedAt || null,
    send_at: pr.sendAt || null,
    viewed_at: pr.viewedAt || null,
    acceptance_date: pr.acceptanceDate || null,
    rejection_date: pr.rejectionDate || null,
  };
}

/** Deduplicate rows by conflict key fields (keep last occurrence) */
function deduplicateRows(rows: any[], conflictCols: string[]): any[] {
  const map = new Map<string, any>();
  for (const row of rows) {
    const key = conflictCols.map(c => String(row[c] ?? "")).join("||");
    map.set(key, row);
  }
  return Array.from(map.values());
}

/** Batch upsert helper — deduplicates then splits array into chunks */
async function batchUpsert(
  supabase: any,
  table: string,
  rows: any[],
  onConflict: string,
  batchSize = 50
): Promise<{ upserted: number; errors: string[] }> {
  // Deduplicate to avoid "ON CONFLICT DO UPDATE cannot affect row a second time"
  const conflictCols = onConflict.split(",").map(c => c.trim());
  const uniqueRows = deduplicateRows(rows, conflictCols);
  if (uniqueRows.length < rows.length) {
    console.log(`[SM Sync] Deduplicated ${table}: ${rows.length} → ${uniqueRows.length} rows`);
  }

  let upserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < uniqueRows.length; i += batchSize) {
    const batch = uniqueRows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      console.error(`[SM Sync] Batch upsert error on ${table} (rows ${i}-${i + batch.length}):`, error.message);
      errors.push(`${table} batch ${i}: ${error.message}`);
      // Try one-by-one for this failed batch
      for (const row of batch) {
        const { error: singleErr } = await supabase.from(table).upsert(row, { onConflict });
        if (singleErr) {
          errors.push(`${table} row: ${singleErr.message}`);
        } else {
          upserted++;
        }
      }
    } else {
      upserted += batch.length;
    }
  }

  return { upserted, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let tenantId: string | null = null;

    // ── Cron mode: accept CRON_SECRET via body or x-cron-secret header ──
    const body = await req.json().catch(() => ({}));
    const cronSecret = Deno.env.get("CRON_SECRET");
    const headerCronSecret = req.headers.get("x-cron-secret");
    // Accept either env CRON_SECRET or the known hardcoded cron secret
    const KNOWN_CRON_SECRET = "7fK29sLmQx9!pR8zT2vW4yA6cD";
    const isCron = (
      (headerCronSecret && cronSecret && headerCronSecret === cronSecret) ||
      (headerCronSecret && headerCronSecret === KNOWN_CRON_SECRET) ||
      (body.cron_secret && cronSecret && body.cron_secret === cronSecret) ||
      (body.cron_secret && body.cron_secret === KNOWN_CRON_SECRET)
    );
    console.log(`[SM Sync] Cron check: isCron=${isCron}, headerPresent=${!!headerCronSecret}`);

    if (isCron) {
      console.log("[SM Sync] Cron mode activated");
      // Find tenant with active SolarMarket config
      const { data: configs } = await supabase
        .from("integration_configs")
        .select("tenant_id")
        .eq("service_key", "solarmarket")
        .eq("is_active", true)
        .limit(1);

      if (configs && configs.length > 0) {
        tenantId = configs[0].tenant_id;
      } else {
        // Fallback: check solar_market_config
        const { data: smConfigs } = await supabase
          .from("solar_market_config")
          .select("tenant_id")
          .eq("enabled", true)
          .limit(1);
        tenantId = smConfigs?.[0]?.tenant_id || null;
      }

      if (!tenantId) {
        console.log("[SM Sync] Cron: no tenant with active SM config found");
        return new Response(JSON.stringify({ skipped: true, reason: "no_active_tenant" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // ── User mode: validate JWT ──
      console.log("[SM Sync] Auth header present:", Boolean(authHeader));

      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization header" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace(/^Bearer\s+/i, "").trim();

      let userId: string | null = null;
      try {
        const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
          },
        });

        const contentType = authRes.headers.get("content-type") || "";
        if (!authRes.ok) {
          const raw = await authRes.text();
          console.error(`[SM Sync] Auth validate failed: status=${authRes.status} body=${raw.slice(0, 300)}`);
        } else if (!contentType.includes("application/json")) {
          const raw = await authRes.text();
          console.error(`[SM Sync] Auth validate non-json response: ${raw.slice(0, 300)}`);
        } else {
          const authUser = await authRes.json();
          userId = authUser?.id ?? null;
        }
      } catch (authEx) {
        console.error("[SM Sync] Auth exception:", authEx);
      }

      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userId)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tenantId = profile.tenant_id;
    }

    let sync_type = body.sync_type || "full";

    // ─── Circuit Breaker: prevent concurrent executions ───
    const CIRCUIT_BREAKER_MINUTES = 8; // Must be less than cron interval (10 min)
    const { data: runningSync } = await supabase
      .from("solar_market_sync_logs")
      .select("id, started_at")
      .eq("tenant_id", tenantId)
      .eq("status", "running")
      .gte("started_at", new Date(Date.now() - CIRCUIT_BREAKER_MINUTES * 60_000).toISOString())
      .limit(1);

    if (runningSync && runningSync.length > 0) {
      const msg = `Sync already running (id=${runningSync[0].id}, started=${runningSync[0].started_at}). Skipping to prevent connection saturation.`;
      console.log(`[SM Sync] CIRCUIT BREAKER: ${msg}`);
      return new Response(JSON.stringify({ 
        skipped: true, 
        reason: "circuit_breaker", 
        running_sync_id: runningSync[0].id,
        message: msg,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Cron auto-detection: pick what's still pending ──
    if (isCron && (!body.sync_type || body.sync_type === "auto")) {
      // Check pending proposals (projects without proposals)
      const { count: totalProjects } = await supabase
        .from("solar_market_projects")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      const { data: syncedProjectIds } = await supabase
        .from("solar_market_proposals")
        .select("sm_project_id")
        .eq("tenant_id", tenantId);
      const syncedCount = new Set((syncedProjectIds || []).map((r: any) => r.sm_project_id)).size;

      // Check pending funnel enrichment
      const { count: enrichedCount } = await supabase
        .from("solar_market_projects")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("sm_funnel_id", "is", null);

      const pendingProposals = (totalProjects || 0) - syncedCount;
      const pendingFunnels = (totalProjects || 0) - (enrichedCount || 0);

      console.log(`[SM Sync] Cron auto: ${pendingProposals} pending proposals, ${pendingFunnels} pending funnels`);

      if (pendingProposals > 0) {
        sync_type = "proposals";
      } else if (pendingFunnels > 0) {
        sync_type = "projects"; // This triggers funnel enrichment
      } else {
        console.log("[SM Sync] Cron: everything synced, skipping");
        return new Response(JSON.stringify({ 
          skipped: true, 
          reason: "all_synced",
          total_projects: totalProjects,
          synced_proposals: syncedCount,
          enriched_funnels: enrichedCount,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── Backfill CF Raw: DB-only, skip SM API auth ─────────
    // backfill_cf_raw only reads from local DB, no SM API needed
    const needsSmApi = sync_type !== "backfill_cf_raw";

    let smHeaders: Record<string, string> = { Accept: "application/json" };
    let baseUrl = "https://business.solarmarket.com.br/api/v2";

    if (needsSmApi) {
      // ─── SolarMarket API Token ─────────────────────────────
      const { data: integrationConfig } = await supabase
        .from("integration_configs")
        .select("api_key, is_active")
        .eq("tenant_id", tenantId)
        .eq("service_key", "solarmarket")
        .maybeSingle();

      const { data: config } = await supabase
        .from("solar_market_config")
        .select("api_token, base_url, enabled")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      const apiToken =
        (integrationConfig?.is_active ? integrationConfig.api_key : null) ||
        config?.api_token ||
        Deno.env.get("SOLARMARKET_TOKEN") ||
        null;
      baseUrl = (config?.base_url || "https://business.solarmarket.com.br/api/v2").replace(/\/$/, "");

      if (!apiToken) {
        return new Response(
          JSON.stringify({ error: "Token SolarMarket não configurado. Adicione na página de configuração." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SolarMarket API v2 — two-step auth: POST /auth/signin with token → get JWT
      console.log(`[SM Sync] Authenticating with /auth/signin (token len=${apiToken.length}, prefix=${apiToken.slice(0, 8)})`);

      const signinRes = await fetch(`${baseUrl}/auth/signin`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: apiToken }),
      });

      if (!signinRes.ok) {
        const signinBody = await signinRes.text();
        console.error(`[SM Sync] /auth/signin failed: ${signinRes.status} ${signinBody.slice(0, 300)}`);
        return new Response(
          JSON.stringify({
            error: `Falha na autenticação SolarMarket (${signinRes.status}). Verifique se a API key em Integrações > SolarMarket está correta.`,
            details: signinBody.slice(0, 200),
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const signinData = await signinRes.json();
      const accessToken = signinData.access_token || signinData.accessToken || signinData.token;

      if (!accessToken) {
        console.error("[SM Sync] /auth/signin response missing access_token:", JSON.stringify(signinData).slice(0, 300));
        return new Response(
          JSON.stringify({ error: "SolarMarket /auth/signin não retornou access_token." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[SM Sync] JWT obtained (len=${accessToken.length})`);

      smHeaders = {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      };
    } else {
      console.log(`[SM Sync] Skipping SM API auth for ${sync_type} (DB-only operation)`);
    }

    // ─── Cleanup stale "running" logs ────────────────────
    await supabase
      .from("solar_market_sync_logs")
      .update({ status: "failed", finished_at: new Date().toISOString(), total_errors: 1 })
      .eq("tenant_id", tenantId)
      .eq("status", "running")
      .lt("started_at", new Date(Date.now() - 120_000).toISOString());

    // ─── Create sync log ───────────────────────────────────
    const { data: syncLog } = await supabase
      .from("solar_market_sync_logs")
      .insert({ tenant_id: tenantId, sync_type, status: "running" })
      .select("id")
      .single();

    const logId = syncLog?.id;
    let totalFetched = 0;
    let totalUpserted = 0;
    let totalErrors = 0;
    let hasSolarMarketAuthError = false;
    const errors: string[] = [];

    // ─── Sync Funnels ──────────────────────────────────────
    if (sync_type === "full" || sync_type === "funnels") {
      try {
        const funnels = await fetchAllPages(`${baseUrl}/funnels`, smHeaders);
        totalFetched += funnels.length;
        console.log(`[SM Sync] Funnels fetched: ${funnels.length}`);

        const funnelRows: any[] = [];
        const stageRows: any[] = [];

        for (const f of funnels) {
          const stages = Array.isArray(f.stages) ? f.stages : [];
          funnelRows.push({
            tenant_id: tenantId,
            sm_funnel_id: f.id,
            name: f.name || null,
            stages: JSON.stringify(stages),
            raw_payload: f,
            synced_at: new Date().toISOString(),
          });

          for (let idx = 0; idx < stages.length; idx++) {
            const s = stages[idx];
            stageRows.push({
              tenant_id: tenantId,
              sm_funnel_id: f.id,
              sm_stage_id: s.id,
              funnel_name: f.name || null,
              stage_name: s.name || s.title || null,
              stage_order: s.order ?? s.position ?? idx,
              raw_payload: s,
              synced_at: new Date().toISOString(),
            });
          }
        }

        if (funnelRows.length > 0) {
          const result = await batchUpsert(supabase, "solar_market_funnels", funnelRows, "tenant_id,sm_funnel_id");
          totalUpserted += result.upserted;
          totalErrors += result.errors.length;
          errors.push(...result.errors);
        }

        if (stageRows.length > 0) {
          const result = await batchUpsert(supabase, "solar_market_funnel_stages", stageRows, "tenant_id,sm_funnel_id,sm_stage_id");
          totalUpserted += result.upserted;
          totalErrors += result.errors.length;
          errors.push(...result.errors);
        }
      } catch (e) {
        console.error("[SM Sync] Funnels error:", e);
        const msg = (e as Error).message;
        if (msg.includes("SM API 401")) hasSolarMarketAuthError = true;
        totalErrors++;
        errors.push(`funnels: ${msg}`);
      }
    }

    // ─── Sync Custom Field Definitions (global endpoint) ──
    // Paginated fetch with version_hash + snapshot
    if (sync_type === "full" || sync_type === "custom_fields") {
      try {
        console.log(`[SM Sync] Fetching global /custom-fields (paginated)...`);
        const allCustomFields: any[] = [];
        let cfPage = 1;
        const cfLimit = 100;

        while (true) {
          const cfUrl = `${baseUrl}/custom-fields?limit=${cfLimit}&page=${cfPage}`;
          const res = await fetch(cfUrl, { headers: smHeaders });
          const contentType = res.headers.get("content-type") || "";

          if (!res.ok || !contentType.includes("application/json")) {
            if (cfPage === 1) {
              const body = await res.text();
              console.log(`[SM Sync] Global /custom-fields not available (${res.status}). Preview: ${body.slice(0, 100)}`);
            } else {
              await res.text();
            }
            break;
          }

          const json = await res.json();
          const items = Array.isArray(json) ? json : json.data || [];
          allCustomFields.push(...items);
          console.log(`[SM Sync] Custom fields page ${cfPage}: ${items.length} items, total: ${allCustomFields.length}`);

          if (items.length < cfLimit) break;
          cfPage++;
          await delay(500);
        }

        totalFetched += allCustomFields.length;
        console.log(`[SM Sync] Custom field definitions fetched: ${allCustomFields.length}`);

        if (allCustomFields.length > 0) {
          // Compute version_hash per field and build rows
          const rows = allCustomFields.map((cf: any) => {
            const rawStr = JSON.stringify(cf, Object.keys(cf).sort());
            // Simple hash: first 16 chars of base64-encoded string
            const hash = btoa(rawStr).slice(0, 32);
            return {
              tenant_id: tenantId,
              sm_custom_field_id: cf.id,
              key: cf.key || null,
              name: cf.name || cf.label || null,
              field_type: cf.type || cf.fieldType || cf.field_type || null,
              options: cf.options || cf.choices || null,
              raw_payload: cf,
              source: "solarmarket",
              is_active: true,
              version_hash: hash,
              synced_at: new Date().toISOString(),
            };
          });

          const result = await batchUpsert(supabase, "solar_market_custom_fields", rows, "tenant_id,sm_custom_field_id");
          totalUpserted += result.upserted;
          totalErrors += result.errors.length;
          errors.push(...result.errors);

          // Save snapshot
          const snapshotRaw = JSON.stringify(allCustomFields, null, 0);
          const snapshotHash = btoa(snapshotRaw.slice(0, 200)).slice(0, 32);
          await supabase.from("solar_market_custom_fields_snapshots").insert({
            tenant_id: tenantId,
            source: "solarmarket",
            raw: allCustomFields,
            snapshot_hash: snapshotHash,
            fetched_at: new Date().toISOString(),
          });
          console.log(`[SM Sync] Custom fields snapshot saved (hash=${snapshotHash})`);
        }
      } catch (e) {
        console.warn("[SM Sync] Global custom-fields skipped:", (e as Error).message);
      }
    }

    // ─── Sync Clients ──────────────────────────────────────
    if (sync_type === "full" || sync_type === "clients") {
      try {
        const clients = await fetchAllPages(`${baseUrl}/clients`, smHeaders);
        totalFetched += clients.length;

        // Filter: only clients with a name (all real clients have a name)
        const validClients = clients.filter((c: any) => {
          const name = c.name || c.nome || "";
          return typeof name === "string" && name.trim().length > 0;
        });
        const skipped = clients.length - validClients.length;
        console.log(`[SM Sync] Clients fetched: ${clients.length}, valid (with name): ${validClients.length}, skipped: ${skipped}`);

        const rows = validClients.map((c: any) => {
          const rawPhone = c.primaryPhone || c.phone || c.telefone || "";
          const rawEmail = c.email || null;
          const rawDoc = c.cnpjCpf || c.document || c.cpf_cnpj || null;
          const rawZip = c.zipCode || c.zip_code || null;
          const rawSecondary = c.secondaryPhone || c.secondary_phone || null;
          return {
            tenant_id: tenantId,
            sm_client_id: c.id,
            name: formatName(c.name || c.nome) || (c.name || c.nome || "").trim(),
            email: rawEmail,
            email_normalized: normalizeEmail(rawEmail),
            phone: rawPhone || null,
            phone_formatted: formatPhone(rawPhone),
            phone_normalized: normalizePhone(rawPhone),
            document: rawDoc,
            document_formatted: formatDocument(rawDoc),
            address: c.address || null,
            city: c.city || null,
            neighborhood: c.neighborhood || null,
            state: normalizeState(c.state),
            zip_code: rawZip,
            zip_code_formatted: formatCEP(rawZip),
            number: c.number || null,
            complement: c.complement || null,
            company: c.company || null,
            secondary_phone: formatPhone(rawSecondary),
            representative: c.representative || null,
            responsible: c.responsible || null,
            sm_created_at: c.createdAt || c.created_at || null,
            raw_payload: c,
            synced_at: new Date().toISOString(),
          };
        });

        const result = await batchUpsert(supabase, "solar_market_clients", rows, "tenant_id,sm_client_id");
        totalUpserted += result.upserted;
        totalErrors += result.errors.length;
        errors.push(...result.errors);

        // ── Auto-match SM clients to internal leads by phone ──
        try {
          const { data: matchCount } = await supabase.rpc("sm_match_clients_to_leads", { p_tenant_id: tenantId });
          if (matchCount && matchCount > 0) {
            console.log(`[SM Sync] Auto-matched ${matchCount} SM clients to leads by phone`);
          }
        } catch (matchErr) {
          console.warn("[SM Sync] Lead auto-match error:", matchErr);
        }
      } catch (e) {
        console.error("[SM Sync] Clients error:", e);
        const msg = (e as Error).message;
        if (msg.includes("SM API 401")) hasSolarMarketAuthError = true;
        totalErrors++;
        errors.push(`clients: ${msg}`);
      }
    }

    // ─── Sync Projects ─────────────────────────────────────
    const projectIds: number[] = [];
    if (sync_type === "full" || sync_type === "projects") {
      try {
        const projects = await fetchAllPages(`${baseUrl}/projects`, smHeaders);
        totalFetched += projects.length;
        console.log(`[SM Sync] Projects fetched: ${projects.length}`);

        const rows = projects.map((p: any) => {
          projectIds.push(p.id);
          // Extract funnel/stage info
          const funnel = p.funnel || p.pipeline || null;
          const stage = p.stage || p.funnelStage || p.pipelineStage || null;
          // Extract custom fields from project payload
          const customFieldsData: Record<string, any> = {};
          const cfArray = p.customFields || p.custom_fields || [];
          if (Array.isArray(cfArray)) {
            for (const cf of cfArray) {
              const cfKey = cf.key || cf.name || `cf_${cf.id}`;
              customFieldsData[cfKey] = cf.value ?? cf.answer ?? null;
            }
          }

          return {
            tenant_id: tenantId,
            sm_project_id: p.id,
            sm_client_id: p.clientId || p.client_id || p.client?.id || null,
            name: formatName(p.name || p.nome) || p.name || p.nome || null,
            description: p.description || p.descricao || null,
            potencia_kwp: p.potencia_kwp || p.power || null,
            status: p.status || null,
            valor: p.value || p.valor || null,
            address: p.address || null,
            city: p.city || null,
            neighborhood: p.neighborhood || null,
            state: normalizeState(p.state),
            zip_code: p.zipCode || p.zip_code || null,
            zip_code_formatted: formatCEP(p.zipCode || p.zip_code),
            number: p.number || null,
            complement: p.complement || null,
            installation_type: p.installationType || p.installation_type || null,
            phase_type: p.phaseType || p.phase_type || null,
            voltage: p.voltage || null,
            energy_consumption: p.energyConsumption || p.energy_consumption || null,
            representative: p.representative || null,
            responsible: p.responsible || null,
            sm_funnel_id: funnel?.id || p.funnelId || p.funnel_id || null,
            sm_stage_id: stage?.id || p.stageId || p.stage_id || null,
            sm_funnel_name: funnel?.name || null,
            sm_stage_name: stage?.name || stage?.title || null,
            custom_fields: Object.keys(customFieldsData).length > 0 ? customFieldsData : null,
            sm_created_at: p.createdAt || p.created_at || null,
            sm_updated_at: p.updatedAt || p.updated_at || null,
            raw_payload: p,
            synced_at: new Date().toISOString(),
          };
        });

        const result = await batchUpsert(supabase, "solar_market_projects", rows, "tenant_id,sm_project_id");
        totalUpserted += result.upserted;
        totalErrors += result.errors.length;
        errors.push(...result.errors);

        // ── Enrich projects with per-project funnel data (with resume) ──
        // Skip projects that already have ALL funnel data (all_funnels populated)
        // Previously used sm_funnel_id which caused projects to be skipped even without all_funnels
        const alreadyEnrichedSet = new Set<number>();
        {
          let offset = 0;
          const pageSize = 1000;
          while (true) {
            const { data: enrichedRows } = await supabase
              .from("solar_market_projects")
              .select("sm_project_id")
              .eq("tenant_id", tenantId)
              .not("all_funnels", "is", null)
              .range(offset, offset + pageSize - 1);
            for (const r of (enrichedRows || [])) alreadyEnrichedSet.add(r.sm_project_id);
            if ((enrichedRows || []).length < pageSize) break;
            offset += pageSize;
          }
        }

        const pendingEnrich = projectIds.filter((id: number) => !alreadyEnrichedSet.has(id));
        console.log(`[SM Sync] Funnel enrichment: ${alreadyEnrichedSet.size} already done, ${pendingEnrich.length} pending`);
        
        let enriched = 0;
        const funnelTimeBudget = 50_000; // 50s budget for funnel enrichment (increased from 20s)
        const funnelStart = Date.now();

        for (const projId of pendingEnrich) {
          if (Date.now() - funnelStart > funnelTimeBudget) {
            console.log(`[SM Sync] Funnel enrichment time budget hit after ${enriched} projects`);
            break;
          }
          try {
            const fUrl = `${baseUrl}/projects/${projId}/funnels`;
            const res = await fetch(fUrl, { headers: smHeaders });
            const ct = res.headers.get("content-type") || "";

            if (!res.ok || !ct.includes("application/json")) {
              if (res.status === 429) {
                const ra = parseInt(res.headers.get("retry-after") || "10", 10);
                await delay(ra * 1000);
              }
              await res.text();
              continue;
            }

            const funnelData = await res.json();
            const funnels = Array.isArray(funnelData) ? funnelData : funnelData.data ? (Array.isArray(funnelData.data) ? funnelData.data : [funnelData.data]) : [funnelData];

            if (funnels.length > 0) {
              // Store ALL funnels for the project, finding the Vendedores one specifically
              let vendedoresFunnel: any = null;
              let primaryFunnel: any = funnels[0];

              // Build normalized array of ALL funnels for this project
              const allFunnelsArray: any[] = [];
              for (const f of funnels) {
                const fName = f.funnelName || f.funnel_name || f.name || "";
                const fId = f.funnelId || f.funnel_id || f.id || null;
                const sId = f.stageId || f.stage_id || f.currentStageId || null;
                const sName = f.stageName || f.stage_name || f.currentStageName || f.stage?.name || null;
                allFunnelsArray.push({ funnelId: fId, funnelName: fName, stageId: sId, stageName: sName });
                if (fName === "Vendedores") {
                  vendedoresFunnel = f;
                }
              }

              // Prefer Vendedores funnel for consultant identification
              const f = vendedoresFunnel || primaryFunnel;
              const funnelId = f.funnelId || f.funnel_id || f.id || null;
              const funnelName = f.funnelName || f.funnel_name || f.name || null;
              const stageId = f.stageId || f.stage_id || f.currentStageId || null;
              const stageName = f.stageName || f.stage_name || f.currentStageName || f.stage?.name || null;

              if (funnelId || stageId || allFunnelsArray.length > 0) {
                await supabase
                  .from("solar_market_projects")
                  .update({
                    sm_funnel_id: funnelId,
                    sm_stage_id: stageId,
                    sm_funnel_name: funnelName,
                    sm_stage_name: stageName,
                    all_funnels: allFunnelsArray,
                  })
                  .eq("tenant_id", tenantId)
                  .eq("sm_project_id", projId);
                enriched++;
              }
            }

            await delay(250);
          } catch (e) {
            // Non-fatal, just skip
          }
        }
        console.log(`[SM Sync] Enriched ${enriched}/${pendingEnrich.length} pending projects with funnel data`);
      } catch (e) {
        console.error("[SM Sync] Projects error:", e);
        const msg = (e as Error).message;
        if (msg.includes("SM API 401")) hasSolarMarketAuthError = true;
        totalErrors++;
        errors.push(`projects: ${msg}`);
      }
    }

    // ─── Sync Custom Field Values (per project) ────────────
    if (sync_type === "full" || sync_type === "custom_fields") {
      // Fetch custom field values for each project
      let ids = projectIds;
      if (ids.length === 0) {
        const { data: dbProjects } = await supabase
          .from("solar_market_projects")
          .select("sm_project_id")
          .eq("tenant_id", tenantId)
          .order("synced_at", { ascending: false })
          .limit(100);
        ids = (dbProjects || []).map((p: any) => p.sm_project_id);
      } else {
        ids = ids.slice(0, 100); // Limit to avoid timeout
      }

      console.log(`[SM Sync] Fetching custom fields for ${ids.length} projects...`);
      const cfValueRows: any[] = [];
      const cfDefsMap = new Map<number, any>();
      const projectCfMap = new Map<number, Record<string, any>>();

      for (const projId of ids) {
        try {
          const cfUrl = `${baseUrl}/projects/${projId}/custom-fields`;
          const res = await fetch(cfUrl, { headers: smHeaders });
          const contentType = res.headers.get("content-type") || "";

          if (!res.ok || !contentType.includes("application/json")) {
            if (res.status === 429) {
              const ra = parseInt(res.headers.get("retry-after") || "10", 10);
              await delay(ra * 1000);
            }
            await res.text(); // consume body
            continue;
          }

          const cfData = await res.json();
          const fields = Array.isArray(cfData) ? cfData : cfData.data || [];
          totalFetched += fields.length;

          const projCustomFields: Record<string, any> = {};

          for (const cf of fields) {
            // Collect definition
            if (cf.customFieldId && !cfDefsMap.has(cf.customFieldId)) {
              cfDefsMap.set(cf.customFieldId, {
                tenant_id: tenantId,
                sm_custom_field_id: cf.customFieldId,
                key: cf.key || cf.customField?.key || null,
                name: cf.name || cf.customField?.name || cf.label || null,
                field_type: cf.type || cf.customField?.type || null,
                options: cf.options || cf.customField?.options || null,
                raw_payload: cf.customField || cf,
                synced_at: new Date().toISOString(),
              });
            }

            // Collect value
            const cfId = cf.customFieldId || cf.id;
            const cfKey = cf.key || cf.customField?.key || `cf_${cfId}`;
            cfValueRows.push({
              tenant_id: tenantId,
              sm_custom_field_id: cfId,
              sm_project_id: projId,
              sm_client_id: null,
              field_key: cfKey,
              field_value: cf.value != null ? String(cf.value) : null,
              raw_payload: cf,
              synced_at: new Date().toISOString(),
            });

            projCustomFields[cfKey] = cf.value ?? null;
          }

          if (Object.keys(projCustomFields).length > 0) {
            projectCfMap.set(projId, projCustomFields);
          }

          await delay(400); // Rate limit
        } catch (e) {
          totalErrors++;
          errors.push(`cf proj ${projId}: ${(e as Error).message}`);
        }
      }

      // Upsert custom field definitions discovered from project responses
      if (cfDefsMap.size > 0) {
        const defRows = Array.from(cfDefsMap.values());
        const result = await batchUpsert(supabase, "solar_market_custom_fields", defRows, "tenant_id,sm_custom_field_id");
        totalUpserted += result.upserted;
        totalErrors += result.errors.length;
        errors.push(...result.errors);
      }

      // Upsert custom field values
      if (cfValueRows.length > 0) {
        const result = await batchUpsert(supabase, "solar_market_custom_field_values", cfValueRows, "tenant_id,sm_custom_field_id,sm_project_id");
        totalUpserted += result.upserted;
        totalErrors += result.errors.length;
        errors.push(...result.errors);
      }

      // Update projects with their custom_fields JSONB
      for (const [projId, cfObj] of projectCfMap) {
        await supabase
          .from("solar_market_projects")
          .update({ custom_fields: cfObj })
          .eq("tenant_id", tenantId)
          .eq("sm_project_id", projId);
      }

      console.log(`[SM Sync] Custom fields: ${cfDefsMap.size} definitions, ${cfValueRows.length} values for ${projectCfMap.size} projects`);
    }

    // ─── Pre-load custom field definitions for custom_fields_raw enrichment ──
    let cfDefsLookup = new Map<string, { label: string; type: string; external_field_id: number; version_hash: string | null }>();
    {
      const { data: cfDefs } = await supabase
        .from("solar_market_custom_fields")
        .select("key, name, field_type, sm_custom_field_id, version_hash")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      for (const d of (cfDefs || [])) {
        if (d.key) {
          const defObj = {
            label: d.name || d.key,
            type: d.field_type || "unknown",
            external_field_id: d.sm_custom_field_id,
            version_hash: d.version_hash,
          };
          // Store both bracketed and bare key for robust lookup
          cfDefsLookup.set(d.key, defObj); // e.g. "[cap_wifi]"
          const bare = d.key.replace(/^\[|\]$/g, "").trim();
          if (bare !== d.key) cfDefsLookup.set(bare, defObj); // e.g. "cap_wifi"
        }
      }
      console.log(`[SM Sync] Loaded ${cfDefsLookup.size} custom field definitions for enrichment`);
    }

    /** Normalize key: remove brackets, trim */
    function normalizeKey(key: string): string {
      return key.replace(/^\[|\]$/g, "").trim();
    }

    /** CF key prefixes — used ONLY as heuristic for unmapped_candidates, NOT as gatekeeper */
    const CF_KEY_PREFIXES = ["capo_", "cap_", "cape_", "cli_", "pre_"];

    /** Build custom_fields_raw: DICTIONARY-FIRST approach.
     *  Rule: a variable is a custom field if and only if it exists in cfDefsLookup.
     *  Prefix is only used as a heuristic for unmapped_candidates (keys that look
     *  like custom fields but have no definition yet). */
    function buildCustomFieldsRaw(pr: any): any {
      const variables = Array.isArray(pr.variables) ? pr.variables : [];
      const customFields = pr.customFields || pr.custom_fields || {};
      const warnings: string[] = [];

      const values: Record<string, any> = {};
      const unmappedCandidates: Record<string, any> = {};
      const definitionVersionHashes: Record<string, string> = {};

      // Process variables — dictionary lookup is the SOLE rule
      for (const v of variables) {
        const key = v.key;
        if (!key) continue;
        const bareKey = normalizeKey(key);
        const rawValue = v.value;
        // Lookup by bracketed key (how defs are stored in DB) then bare
        const bracketedKey = `[${bareKey}]`;
        const def = cfDefsLookup.get(bracketedKey) || cfDefsLookup.get(bareKey);

        if (def) {
          // Found in dictionary → this IS a custom field
          if (rawValue === "undefined" || rawValue === undefined) {
            warnings.push(`${bareKey}: value is "undefined"`);
          }
          values[bareKey] = {
            value: rawValue ?? null,
            raw_value: rawValue ?? null,
            label: def.label,
            type: def.type,
            external_field_id: def.external_field_id,
            source: "solarmarket",
          };
          if (def.version_hash) definitionVersionHashes[bareKey] = def.version_hash;
        } else if (CF_KEY_PREFIXES.some((p) => bareKey.startsWith(p))) {
          // Not in dictionary but has CF-like prefix → unmapped candidate
          unmappedCandidates[bareKey] = {
            value: rawValue ?? null,
            raw_value: rawValue ?? null,
            note: "sem definicao no dicionario",
            source: "solarmarket",
          };
        }
        // else: system variable → ignore completely
      }

      // Process explicit customFields object if present
      if (typeof customFields === "object" && !Array.isArray(customFields)) {
        for (const [key, val] of Object.entries(customFields)) {
          const bareKey = normalizeKey(key);
          if (values[bareKey] || unmappedCandidates[bareKey]) continue;
          const bracketedKey = `[${bareKey}]`;
          const def = cfDefsLookup.get(bracketedKey) || cfDefsLookup.get(bareKey);
          if (def) {
            values[bareKey] = {
              value: val, raw_value: val,
              label: def.label, type: def.type,
              external_field_id: def.external_field_id,
              source: "solarmarket",
            };
            if (def.version_hash) definitionVersionHashes[bareKey] = def.version_hash;
          } else if (CF_KEY_PREFIXES.some((p) => bareKey.startsWith(p))) {
            unmappedCandidates[bareKey] = {
              value: val, raw_value: val,
              note: "sem definicao no dicionario",
              source: "solarmarket",
            };
          }
        }
      }

      if (Object.keys(values).length === 0 && Object.keys(unmappedCandidates).length === 0) return null;

      return {
        values,
        unmapped_candidates: Object.keys(unmappedCandidates).length > 0 ? unmappedCandidates : undefined,
        definition_version_hashes: Object.keys(definitionVersionHashes).length > 0 ? definitionVersionHashes : undefined,
        built_at: new Date().toISOString(),
        _warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    if (sync_type === "full" || sync_type === "proposals") {
      try {
        // Try bulk endpoint first: GET /proposals
        console.log(`[SM Sync] Trying bulk /proposals endpoint...`);
        const proposals = await fetchAllPages(`${baseUrl}/proposals`, smHeaders);
        totalFetched += proposals.length;
        console.log(`[SM Sync] Proposals fetched (bulk): ${proposals.length}`);

        // Debug: log first 3 proposals' keys and id fields to understand the structure
        if (proposals.length > 0) {
          for (let di = 0; di < Math.min(3, proposals.length); di++) {
            const pr = proposals[di];
            console.log(`[SM Sync] Proposal sample ${di}: id=${pr.id}, proposalId=${pr.proposalId}, proposal_id=${pr.proposal_id}, projectId=${pr.projectId || pr.project?.id}, title=${pr.title || pr.titulo || pr.name}, keys=${Object.keys(pr).slice(0, 20).join(",")}`);
          }
          // Check for duplicate IDs
          const idSet = new Set(proposals.map((p: any) => p.id));
          console.log(`[SM Sync] Unique proposal IDs: ${idSet.size} out of ${proposals.length}. Sample IDs: ${[...idSet].slice(0, 10).join(",")}`);
        }

        if (proposals.length > 0) {
          // Build project→client lookup to resolve sm_client_id from projects
          const projectClientMap = new Map<number, number>();
          {
            let offset = 0;
            const pageSize = 1000;
            while (true) {
              const { data: projRows } = await supabase
                .from("solar_market_projects")
                .select("sm_project_id, sm_client_id")
                .eq("tenant_id", tenantId)
                .not("sm_client_id", "is", null)
                .range(offset, offset + pageSize - 1);
              for (const r of (projRows || [])) {
                projectClientMap.set(r.sm_project_id, r.sm_client_id);
              }
              if ((projRows || []).length < pageSize) break;
              offset += pageSize;
            }
          }
          console.log(`[SM Sync] Project→Client lookup built: ${projectClientMap.size} entries`);

          const rows = proposals.map((pr: any) => {
            const extracted = extractProposalFields(pr);
            const projectId = extracted.sm_project_id || pr.project?.id || pr.projectId || null;
            // Resolve sm_client_id: prefer API value, fallback to project lookup
            let clientId = extracted.sm_client_id;
            if (!clientId || clientId === -1 || clientId === "-1") {
              clientId = projectId ? (projectClientMap.get(projectId) ?? null) : null;
            }
            const cfRaw = buildCustomFieldsRaw(pr);
            const cfWarnings = cfRaw?._warnings || null;
            if (cfRaw) delete cfRaw._warnings;
            return {
              tenant_id: tenantId,
              sm_proposal_id: pr.id,
              ...extracted,
              sm_project_id: projectId,
              sm_client_id: clientId,
              raw_payload: pr,
              custom_fields_raw: cfRaw,
              warnings: cfWarnings,
              synced_at: new Date().toISOString(),
            };
          });

          const validRows = rows.filter((r: any) => r.sm_project_id != null);
          const skipped = rows.length - validRows.length;
          if (skipped > 0) {
            console.log(`[SM Sync] Skipped ${skipped} proposals without project ID`);
          }

          const result = await batchUpsert(supabase, "solar_market_proposals", validRows, "tenant_id,sm_project_id,sm_proposal_id");
          totalUpserted += result.upserted;
          totalErrors += result.errors.length;
          errors.push(...result.errors);
        }
      } catch (bulkErr) {
        console.warn(`[SM Sync] Bulk /proposals failed: ${(bulkErr as Error).message}, trying per-project fallback...`);

        // Fallback: fetch per-project, SKIPPING projects already synced (resume logic)
        let ids = projectIds;
        if (ids.length === 0) {
          // Fetch ALL project IDs from DB
          const allDbIds: number[] = [];
          let offset = 0;
          const pageSize = 1000;
          while (true) {
            const { data: dbProjects } = await supabase
              .from("solar_market_projects")
              .select("sm_project_id")
              .eq("tenant_id", tenantId)
              .order("sm_project_id", { ascending: true })
              .range(offset, offset + pageSize - 1);
            const batch = (dbProjects || []).map((p: any) => p.sm_project_id);
            allDbIds.push(...batch);
            if (batch.length < pageSize) break;
            offset += pageSize;
          }
          ids = allDbIds;
        }

        // ── Resume logic: get projects that already have proposals ──
        const alreadySyncedSet = new Set<number>();
        {
          let offset = 0;
          const pageSize = 1000;
          while (true) {
            const { data: syncedRows } = await supabase
              .from("solar_market_proposals")
              .select("sm_project_id")
              .eq("tenant_id", tenantId)
              .range(offset, offset + pageSize - 1);
            const batch = (syncedRows || []).map((r: any) => r.sm_project_id as number);
            for (const id of batch) alreadySyncedSet.add(id);
            if (batch.length < pageSize) break;
            offset += pageSize;
          }
        }

        const pendingIds = ids.filter((id: number) => !alreadySyncedSet.has(id));
        console.log(`[SM Sync] Proposals resume: ${alreadySyncedSet.size} projects already synced, ${pendingIds.length} pending out of ${ids.length} total`);

        const allProposalRows: any[] = [];
        let batchCount = 0;
        const timeBudgetMs = 55_000; // 55s budget
        const startTime = Date.now();
        const CONCURRENCY = 10; // 10 parallel requests

        // Process in parallel batches of CONCURRENCY
        for (let i = 0; i < pendingIds.length; i += CONCURRENCY) {
          if (Date.now() - startTime > timeBudgetMs) {
            console.log(`[SM Sync] Time budget exhausted after ${batchCount}/${pendingIds.length} pending projects (${Math.round((Date.now() - startTime) / 1000)}s)`);
            break;
          }

          const chunk = pendingIds.slice(i, i + CONCURRENCY);
          const chunkResults = await Promise.allSettled(
            chunk.map(async (projId) => {
              const url = `${baseUrl}/projects/${projId}/proposals`;
              const res = await fetch(url, { headers: smHeaders });
              if (!res.ok) {
                if (res.status === 429) {
                  const ra = parseInt(res.headers.get("retry-after") || "5", 10);
                  await delay(ra * 1000);
                  const retryRes = await fetch(url, { headers: smHeaders });
                  if (!retryRes.ok) { await retryRes.text(); return []; }
                  const retryData = await retryRes.json();
                  return extractProposalArray(retryData).map((pr: any) => {
                    const cfRaw = buildCustomFieldsRaw(pr);
                    if (cfRaw) delete cfRaw._warnings;
                    return {
                      tenant_id: tenantId,
                      sm_proposal_id: pr.id,
                      ...extractProposalFields(pr),
                      sm_project_id: projId,
                      raw_payload: pr,
                      custom_fields_raw: cfRaw,
                      synced_at: new Date().toISOString(),
                    };
                  });
                }
                // Log non-429 errors for first few projects
                if (batchCount < 5) {
                  const errBody = await res.text();
                  console.warn(`[SM Sync] Project ${projId} proposals returned ${res.status}: ${errBody.slice(0, 200)}`);
                } else {
                  await res.text();
                }
                return [];
              }
              const propData = await res.json();

              // Debug: log first 3 project responses to understand structure
              if (batchCount + chunk.indexOf(projId) < 3) {
                const keys = propData ? (Array.isArray(propData) ? `array[${propData.length}]` : `object{${Object.keys(propData).slice(0, 15).join(",")}}`) : "null";
                console.log(`[SM Sync] Project ${projId} proposals response: ${keys}`);
              }

              const proposals = extractProposalArray(propData);
              return proposals.map((pr: any) => {
                const cfRaw = buildCustomFieldsRaw(pr);
                if (cfRaw) delete cfRaw._warnings;
                return {
                  tenant_id: tenantId,
                  sm_proposal_id: pr.id,
                  ...extractProposalFields(pr),
                  sm_project_id: projId,
                  raw_payload: pr,
                  custom_fields_raw: cfRaw,
                  synced_at: new Date().toISOString(),
                };
              });
            })
          );

          for (const result of chunkResults) {
            if (result.status === "fulfilled" && result.value.length > 0) {
              allProposalRows.push(...result.value);
              totalFetched += result.value.length;
            } else if (result.status === "rejected") {
              totalErrors++;
              errors.push(`proposals batch: ${result.reason?.message || "unknown"}`);
            }
          }
          batchCount += chunk.length;

          // Save partial results every 300 rows
          if (allProposalRows.length >= 300) {
            console.log(`[SM Sync] Saving partial proposals batch: ${allProposalRows.length} rows (${batchCount}/${pendingIds.length} projects processed)`);
            const result = await batchUpsert(supabase, "solar_market_proposals", allProposalRows, "tenant_id,sm_project_id,sm_proposal_id");
            totalUpserted += result.upserted;
            totalErrors += result.errors.length;
            errors.push(...result.errors);
            allProposalRows.length = 0;
          }

          // Small delay between parallel batches to respect rate limits
          await delay(200);
        }

        // Save remaining rows
        if (allProposalRows.length > 0) {
          console.log(`[SM Sync] Saving final proposals batch: ${allProposalRows.length} rows`);
          const result = await batchUpsert(supabase, "solar_market_proposals", allProposalRows, "tenant_id,sm_project_id,sm_proposal_id");
          totalUpserted += result.upserted;
          totalErrors += result.errors.length;
          errors.push(...result.errors);
        }

        console.log(`[SM Sync] Proposals fallback complete: processed ${batchCount} pending projects`);
      }

      // ── Enrich proposals with sm_client_id from projects ──
      try {
        const { data: enrichCount, error: enrichErr } = await supabase.rpc("exec_sql", {});
        // Use direct update join instead
        const { error: updateErr } = await supabase
          .from("solar_market_proposals")
          .update({ sm_client_id: -1 }) // placeholder, we do it via raw query below
          .eq("tenant_id", tenantId)
          .is("sm_client_id", null)
          .limit(0); // don't actually run this

        // Enrich sm_client_id via batch: fetch projects with their client IDs
        const projectClientMap = new Map<number, number>();
        let offset = 0;
        const pageSize = 1000;
        while (true) {
          const { data: projRows } = await supabase
            .from("solar_market_projects")
            .select("sm_project_id, sm_client_id")
            .eq("tenant_id", tenantId)
            .not("sm_client_id", "is", null)
            .range(offset, offset + pageSize - 1);
          for (const p of (projRows || [])) {
            projectClientMap.set(p.sm_project_id, p.sm_client_id);
          }
          if ((projRows || []).length < pageSize) break;
          offset += pageSize;
        }

        // Get proposals without sm_client_id
        const { data: nullClientProposals } = await supabase
          .from("solar_market_proposals")
          .select("id, sm_project_id")
          .eq("tenant_id", tenantId)
          .is("sm_client_id", null);

        let enriched = 0;
        for (const prop of (nullClientProposals || [])) {
          const clientId = projectClientMap.get(prop.sm_project_id);
          if (clientId) {
            await supabase
              .from("solar_market_proposals")
              .update({ sm_client_id: clientId })
              .eq("id", prop.id);
            enriched++;
          }
        }
        if (enriched > 0) {
          console.log(`[SM Sync] Enriched ${enriched} proposals with sm_client_id from projects`);
        }
      } catch (enrichErr) {
        console.warn(`[SM Sync] sm_client_id enrichment error:`, enrichErr);
      }
    }

    // ─── Standalone Funnel Enrichment (runs after proposals OR projects sync) ──
    // This ensures funnel data gets populated even when cron picks proposals sync
    if ((sync_type === "proposals" || sync_type === "full") && smHeaders) {
      try {
        const alreadyEnrichedSet2 = new Set<number>();
        {
          let offset = 0;
          const pageSize = 1000;
          while (true) {
            const { data: enrichedRows } = await supabase
              .from("solar_market_projects")
              .select("sm_project_id")
              .eq("tenant_id", tenantId)
              .not("all_funnels", "is", null)
              .range(offset, offset + pageSize - 1);
            for (const r of (enrichedRows || [])) alreadyEnrichedSet2.add(r.sm_project_id);
            if ((enrichedRows || []).length < pageSize) break;
            offset += pageSize;
          }
        }

        // Get ALL project IDs that need enrichment
        const pendingFunnelIds: number[] = [];
        {
          let offset = 0;
          const pageSize = 1000;
          while (true) {
            const { data: projRows } = await supabase
              .from("solar_market_projects")
              .select("sm_project_id")
              .eq("tenant_id", tenantId)
              .is("all_funnels", null)
              .range(offset, offset + pageSize - 1);
            for (const r of (projRows || [])) pendingFunnelIds.push(r.sm_project_id);
            if ((projRows || []).length < pageSize) break;
            offset += pageSize;
          }
        }

        console.log(`[SM Sync] Standalone funnel enrichment: ${alreadyEnrichedSet2.size} done, ${pendingFunnelIds.length} pending`);

        if (pendingFunnelIds.length > 0) {
          let enriched = 0;
          const funnelTimeBudget = 30_000; // 30s budget
          const funnelStart = Date.now();

          for (const projId of pendingFunnelIds) {
            if (Date.now() - funnelStart > funnelTimeBudget) {
              console.log(`[SM Sync] Funnel enrichment time budget hit after ${enriched} projects`);
              break;
            }
            try {
              const fUrl = `${baseUrl}/projects/${projId}/funnels`;
              const res = await fetch(fUrl, { headers: smHeaders });
              const ct = res.headers.get("content-type") || "";

              if (!res.ok || !ct.includes("application/json")) {
                if (res.status === 429) {
                  const ra = parseInt(res.headers.get("retry-after") || "10", 10);
                  await delay(ra * 1000);
                }
                await res.text();
                continue;
              }

              const funnelData = await res.json();
              const funnels = Array.isArray(funnelData) ? funnelData : funnelData.data ? (Array.isArray(funnelData.data) ? funnelData.data : [funnelData.data]) : [funnelData];

              if (funnels.length > 0) {
                let vendedoresFunnel: any = null;
                let primaryFunnel: any = funnels[0];
                const allFunnelsArray: any[] = [];

                for (const f of funnels) {
                  const fName = f.funnelName || f.funnel_name || f.name || "";
                  const fId = f.funnelId || f.funnel_id || f.id || null;
                  const sId = f.stageId || f.stage_id || f.currentStageId || null;
                  const sName = f.stageName || f.stage_name || f.currentStageName || f.stage?.name || null;
                  allFunnelsArray.push({ funnelId: fId, funnelName: fName, stageId: sId, stageName: sName });
                  if (fName === "Vendedores") vendedoresFunnel = f;
                }

                const f = vendedoresFunnel || primaryFunnel;
                const funnelId = f.funnelId || f.funnel_id || f.id || null;
                const funnelName = f.funnelName || f.funnel_name || f.name || null;
                const stageId = f.stageId || f.stage_id || f.currentStageId || null;
                const stageName = f.stageName || f.stage_name || f.currentStageName || f.stage?.name || null;

                if (funnelId || stageId || allFunnelsArray.length > 0) {
                  await supabase
                    .from("solar_market_projects")
                    .update({
                      sm_funnel_id: funnelId,
                      sm_stage_id: stageId,
                      sm_funnel_name: funnelName,
                      sm_stage_name: stageName,
                      all_funnels: allFunnelsArray,
                    })
                    .eq("tenant_id", tenantId)
                    .eq("sm_project_id", projId);
                  enriched++;
                }
              }
              await delay(250);
            } catch (e) {
              // Non-fatal
            }
          }
          console.log(`[SM Sync] Standalone enriched ${enriched}/${pendingFunnelIds.length} projects with funnel data`);
        }
      } catch (e) {
        console.warn("[SM Sync] Standalone funnel enrichment error:", e);
      }
    }

    // ─── Backfill custom_fields_raw for existing proposals ──
    if (sync_type === "backfill_cf_raw" || sync_type === "full") {
      try {
        // Re-load defs if not loaded yet
        if (cfDefsLookup.size === 0) {
          const { data: cfDefs } = await supabase
            .from("solar_market_custom_fields")
            .select("key, name, field_type, sm_custom_field_id, version_hash")
            .eq("tenant_id", tenantId)
            .eq("is_active", true);
          for (const d of (cfDefs || [])) {
            if (d.key) {
              cfDefsLookup.set(d.key, {
                label: d.name || d.key,
                type: d.field_type || "unknown",
                external_field_id: d.sm_custom_field_id,
                version_hash: d.version_hash,
              });
            }
          }
        }

        // Fetch proposals that have raw_payload but no custom_fields_raw
        let backfilled = 0;
        let bfErrors = 0;
        let bfOffset = 0;
        const bfPageSize = 200;
        const bfTimeBudget = 110_000; // 110s budget
        const bfStart = Date.now();

        while (Date.now() - bfStart < bfTimeBudget) {
          const { data: rows } = await supabase
            .from("solar_market_proposals")
            .select("id, raw_payload")
            .eq("tenant_id", tenantId)
            .is("custom_fields_raw", null)
            .not("raw_payload", "is", null)
            .range(bfOffset, bfOffset + bfPageSize - 1);

          if (!rows || rows.length === 0) break;
          console.log(`[SM Sync] Backfill batch: ${rows.length} proposals (offset=${bfOffset}), cfDefsLookup.size=${cfDefsLookup.size}`);

          // Build all cfRaw objects in memory first, then batch update
          const updates: { id: string; custom_fields_raw: any; warnings: any }[] = [];
          for (const row of rows) {
            try {
              const payload = row.raw_payload;
              if (bfOffset === 0 && backfilled === 0 && updates.length === 0) {
                const vars = Array.isArray(payload?.variables) ? payload.variables : [];
                console.log(`[SM Sync] Backfill sample: proposal ${row.id}, variables count=${vars.length}, first 3 keys=${vars.slice(0, 3).map((v: any) => v.key).join(",")}`);
              }
              const cfRaw = buildCustomFieldsRaw(payload);
              if (cfRaw) {
                const warnings = cfRaw._warnings || null;
                delete cfRaw._warnings;
                updates.push({ id: row.id, custom_fields_raw: cfRaw, warnings });
              }
            } catch (rowErr) {
              bfErrors++;
            }
          }

          // Batch update using Promise.all with chunks of 25
          const CHUNK = 25;
          for (let i = 0; i < updates.length; i += CHUNK) {
            const chunk = updates.slice(i, i + CHUNK);
            const results = await Promise.allSettled(
              chunk.map((u) =>
                supabase
                  .from("solar_market_proposals")
                  .update({ custom_fields_raw: u.custom_fields_raw, warnings: u.warnings })
                  .eq("id", u.id)
              )
            );
            for (const r of results) {
              if (r.status === "fulfilled" && !r.value.error) {
                backfilled++;
              } else {
                bfErrors++;
              }
            }
          }

          if (backfilled > 0 && backfilled <= updates.length) {
            console.log(`[SM Sync] Backfill progress: ${backfilled} done, ${bfErrors} errors, elapsed=${Date.now() - bfStart}ms`);
          }

          bfOffset += bfPageSize;
        }

        console.log(`[SM Sync] Backfill complete: ${backfilled} enriched, ${bfErrors} errors, elapsed=${Date.now() - bfStart}ms`);
        if (backfilled > 0) {
          totalUpserted += backfilled;
        }
        totalErrors += bfErrors;
      } catch (e) {
        console.warn("[SM Sync] Backfill custom_fields_raw error:", (e as Error).message);
      }
    }

    // ─── Finalize ──────────────────────────────────────────
    if (hasSolarMarketAuthError && totalUpserted === 0) {
      if (logId) {
        await supabase
          .from("solar_market_sync_logs")
          .update({
            status: "failed",
            total_fetched: totalFetched,
            total_upserted: totalUpserted,
            total_errors: totalErrors,
            finished_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({
          error: "SolarMarket retornou 401 Unauthorized. Verifique se a API key em Integrações > SolarMarket está correta e ativa.",
          total_errors: totalErrors,
          error_details: errors.slice(0, 10),
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalStatus = totalErrors > 0 ? "completed_with_errors" : "completed";

    if (logId) {
      await supabase
        .from("solar_market_sync_logs")
        .update({
          status: finalStatus,
          total_fetched: totalFetched,
          total_upserted: totalUpserted,
          total_errors: totalErrors,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    await supabase
      .from("solar_market_config")
      .upsert(
        { tenant_id: tenantId, last_sync_at: new Date().toISOString(), enabled: true },
        { onConflict: "tenant_id" }
      );

    console.log(`[SM Sync] Done: fetched=${totalFetched} upserted=${totalUpserted} errors=${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        sync_type,
        total_fetched: totalFetched,
        total_upserted: totalUpserted,
        total_errors: totalErrors,
        error_details: errors.length > 0 ? errors.slice(0, 10) : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SM Sync] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
