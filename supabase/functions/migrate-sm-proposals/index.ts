import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ──────────────────────────────────────────────

interface MigrationParams {
  dry_run: boolean;
  filters?: {
    status?: string;        // e.g. "approved"
    sm_proposal_ids?: number[];
    internal_ids?: string[]; // UUID primary keys from solar_market_proposals table
    date_from?: string;     // ISO date
    date_to?: string;       // ISO date
    only_marked?: boolean;  // only migrar_para_canonico=true
    vendedor_name?: string; // filter by vendedor (SM funnel "Vendedores" stage name)
    proposal_lifecycle?: string; // "aceita" | "enviada" | "vista" | "gerada" | "rejeitada"
  };
  batch_size?: number;
  /** Required: pipeline_id to assign deals into */
  pipeline_id?: string;
  /** Required: stage_id for "won" deals */
  stage_id?: string;
  /** Optional: owner_id (consultor_id) — if omitted, auto-resolved from SM project funnel "Vendedores" */
  owner_id?: string;
  /** If true, auto-resolve owner from SM funnel stage name and create consultor if missing */
  auto_resolve_owner?: boolean;
}

type StepStatus = "WOULD_CREATE" | "WOULD_LINK" | "WOULD_SKIP" | "CONFLICT" | "ERROR";

interface StepResult {
  status: StepStatus;
  id?: string;
  reason?: string;
  matches?: number;
}

interface ProposalReport {
  sm_proposal_id: number;
  sm_client_name: string | null;
  aborted: boolean;
  steps: {
    cliente?: StepResult;
    deal?: StepResult;
    pipelines?: StepResult & { details?: Array<{ funnel: string; stage: string; pipeline_id?: string; stage_id?: string }> };
    projeto?: StepResult;
    proposta_nativa?: StepResult;
    proposta_versao?: StepResult;
  };
}

// ─── Helpers ────────────────────────────────────────────

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-11) || null;
}

// ─── Status Mapping Helpers ─────────────────────────────

function resolveSmLifecycle(smProp: any): string {
  if (smProp.acceptance_date) return "approved";
  if (smProp.rejection_date) return "rejected";
  if (smProp.viewed_at) return "viewed";
  if (smProp.send_at) return "sent";
  if (smProp.generated_at) return "generated";
  // Fallback to status field
  const s = (smProp.status || "").toLowerCase();
  if (["approved", "rejected", "viewed", "sent", "generated", "draft"].includes(s)) return s;
  return "draft";
}

function mapSmStatusToDeal(smProp: any): string {
  const lc = resolveSmLifecycle(smProp);
  if (lc === "approved") return "won";
  if (lc === "rejected") return "lost";
  return "open";
}

function mapSmStatusToProposta(smProp: any): string {
  const lc = resolveSmLifecycle(smProp);
  switch (lc) {
    case "approved": return "aceita";
    case "rejected": return "recusada";
    case "viewed": return "vista";
    case "sent": return "enviada";
    case "generated": return "gerada";
    default: return "rascunho";
  }
}

function mapSmStatusToVersao(smProp: any): string {
  const lc = resolveSmLifecycle(smProp);
  switch (lc) {
    case "approved": return "accepted";
    case "rejected": return "rejected";
    case "viewed": return "sent";
    case "sent": return "sent";
    case "generated": return "draft";
    default: return "draft";
  }
}

function parsePaybackMonths(payback: string | null): number | null {
  if (!payback) return null;
  // Parse "X anos e Y meses" or "X anos" or "Y meses"
  const anos = payback.match(/(\d+)\s*ano/i);
  const meses = payback.match(/(\d+)\s*m[eê]s/i);
  const totalMonths = (anos ? parseInt(anos[1]) * 12 : 0) + (meses ? parseInt(meses[1]) : 0);
  return totalMonths > 0 ? totalMonths : null;
}

// ─── Main Handler ───────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[SM Migration] Handler invoked", req.method);
    // Auth
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user auth using service client + getUser(jwt)
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      console.error("ERR", { step: "token_extract", err: "No token in header" });
      return new Response(JSON.stringify({ error: "Unauthorized", step: "token_extract", debug: { message: "No Bearer token found" } }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    console.log("[SM Migration] Auth result:", user?.id ?? "NO_USER", authErr?.message ?? "OK");
    if (authErr || !user) {
      console.error("ERR", { step: "user_auth", err: authErr?.message });
      return new Response(JSON.stringify({ error: "Unauthorized", step: "user_auth", debug: { message: authErr?.message } }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant_id via user_id (reuse adminClient)
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("tenant_id, status, ativo")
      .eq("user_id", user.id)
      .single();

    console.log("[SM Migration] Profile:", JSON.stringify({ tenant_id: profile?.tenant_id, status: profile?.status, ativo: profile?.ativo, err: profileError?.message }));
    if (profileError || !profile?.tenant_id) {
      console.error("ERR", { step: "profile_lookup", err: profileError?.message });
      return new Response(JSON.stringify({ error: "No tenant/profile", step: "profile_lookup", debug: { message: profileError?.message, code: profileError?.code } }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.status !== "aprovado" || !profile.ativo) {
      console.error("ERR", { step: "profile_check", err: `status=${profile.status} ativo=${profile.ativo}` });
      return new Response(JSON.stringify({ error: "User not approved/active", step: "profile_check", debug: { status: profile.status, ativo: profile.ativo } }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;
    const params: MigrationParams = await req.json();
    const { dry_run = true, filters = {}, batch_size = 50 } = params;

    const autoResolveOwner = params.auto_resolve_owner !== false; // default true

    // Validate required params — owner_id is optional when auto_resolve_owner is enabled
    if (!dry_run) {
      if (!params.pipeline_id) {
        return new Response(
          JSON.stringify({ error: "pipeline_id is required", step: "params_validation" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!params.owner_id && !autoResolveOwner) {
        return new Response(
          JSON.stringify({ error: "owner_id is required (or enable auto_resolve_owner)", step: "params_validation" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // pipeline_id is always required for targeted proposals
    if (filters.sm_proposal_ids && filters.sm_proposal_ids.length > 0 && !params.pipeline_id) {
      return new Response(
        JSON.stringify({ error: "pipeline_id is required when targeting specific proposals", step: "params_validation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[SM Migration] tenant=${tenantId} dry_run=${dry_run} filters=${JSON.stringify(filters)}`);

    // ─── 0. Authenticate with SolarMarket API to fetch funnel data ────
    let smAccessToken: string | null = null;
    let smBaseUrl = "https://business.solarmarket.com.br/api/v2";

    if (autoResolveOwner) {
      const { data: integrationConfig } = await adminClient
        .from("integration_configs")
        .select("api_key, is_active")
        .eq("tenant_id", tenantId)
        .eq("service_key", "solarmarket")
        .maybeSingle();

      const { data: smConfig } = await adminClient
        .from("solar_market_config")
        .select("api_token, base_url")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      const apiToken =
        (integrationConfig?.is_active ? integrationConfig.api_key : null) ||
        smConfig?.api_token ||
        Deno.env.get("SOLARMARKET_TOKEN") ||
        null;
      smBaseUrl = (smConfig?.base_url || smBaseUrl).replace(/\/$/, "");

      if (apiToken) {
        try {
          const signinRes = await fetch(`${smBaseUrl}/auth/signin`, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ token: apiToken }),
          });
          if (signinRes.ok) {
            const signinData = await signinRes.json();
            smAccessToken = signinData.access_token || signinData.accessToken || signinData.token || null;
            console.log(`[SM Migration] SM API authenticated (token len=${smAccessToken?.length})`);
          } else {
            console.warn(`[SM Migration] SM API auth failed: ${signinRes.status}`);
          }
        } catch (e) {
          console.warn(`[SM Migration] SM API auth error: ${(e as Error).message}`);
        }
      } else {
        console.warn("[SM Migration] No SM API token found, will fallback to DB responsible field");
      }
    }

    // Helper: fetch funnel data for a project from SM API
    async function fetchProjectFunnelVendedor(smProjectId: number): Promise<string | null> {
      if (!smAccessToken) return null;
      try {
        const res = await fetch(`${smBaseUrl}/projects/${smProjectId}/funnels`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${smAccessToken}` },
        });
        if (!res.ok) { await res.text(); return null; }
        const data = await res.json();
        const funnels = Array.isArray(data) ? data : data.data ? (Array.isArray(data.data) ? data.data : [data.data]) : [data];
        for (const f of funnels) {
          const fName = f.funnelName || f.funnel_name || f.name || "";
          if (fName === "Vendedores") {
            return f.stageName || f.stage_name || f.currentStageName || f.stage?.name || null;
          }
        }
        return null;
      } catch { return null; }
    }

    // ─── 1. Fetch SM proposals ───────────────────────────

    // Select only needed columns — exclude raw_payload to avoid statement timeout
    const SM_PROPOSAL_COLUMNS = [
      "id", "tenant_id", "sm_proposal_id", "sm_project_id", "sm_client_id",
      "titulo", "description", "potencia_kwp", "valor_total", "status",
      "panel_model", "panel_quantity", "inverter_model", "inverter_quantity",
      "discount", "installation_cost", "equipment_cost", "energy_generation",
      "roof_type", "structure_type", "warranty", "payment_conditions",
      "valid_until", "sm_created_at", "sm_updated_at",
      "link_pdf", "consumo_mensal", "tarifa_distribuidora", "economia_mensal",
      "economia_mensal_percent", "payback", "vpl", "tir", "preco_total",
      "fase", "tipo_dimensionamento", "dis_energia", "cidade", "estado",
      "geracao_anual", "inflacao_energetica", "perda_eficiencia_anual",
      "sobredimensionamento", "custo_disponibilidade",
      "generated_at", "send_at", "viewed_at", "acceptance_date", "rejection_date",
      "migrar_para_canonico",
    ].join(", ");

    let query = adminClient
      .from("solar_market_proposals")
      .select(SM_PROPOSAL_COLUMNS)
      .eq("tenant_id", tenantId)
      .not("sm_client_id", "is", null)
      .order("sm_proposal_id", { ascending: true });

    if (filters.status) {
      // SM status field: "approved", "sent", "draft" etc.
      query = query.ilike("status", filters.status);
    }
    if (filters.internal_ids && filters.internal_ids.length > 0) {
      query = query.in("id", filters.internal_ids);
    } else if (filters.sm_proposal_ids && filters.sm_proposal_ids.length > 0) {
      query = query.in("sm_proposal_id", filters.sm_proposal_ids);
    }
    if (filters.date_from) {
      query = query.gte("sm_created_at", filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte("sm_created_at", filters.date_to);
    }
    if (filters.only_marked) {
      query = query.eq("migrar_para_canonico", true);
    }
    // Lifecycle filter based on date columns
    if (filters.proposal_lifecycle) {
      switch (filters.proposal_lifecycle) {
        case "aceita":
          query = query.not("acceptance_date", "is", null);
          break;
        case "rejeitada":
          query = query.not("rejection_date", "is", null);
          break;
        case "vista":
          query = query.not("viewed_at", "is", null);
          break;
        case "enviada":
          query = query.not("send_at", "is", null);
          break;
        case "gerada":
          query = query.not("generated_at", "is", null);
          break;
      }
    }

    // Paginate SM proposals (max 1000 per page)
    const allProposals: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page, error: pageErr } = await query.range(offset, offset + pageSize - 1);
      if (pageErr) throw new Error(`Fetch SM proposals: ${pageErr.message}`);
      allProposals.push(...(page || []));
      if ((page || []).length < pageSize) break;
      offset += pageSize;
    }

    console.log(`[SM Migration] Found ${allProposals.length} proposals matching filters`);

    if (allProposals.length === 0) {
      return new Response(
        JSON.stringify({ mode: dry_run ? "dry_run" : "execute", total_processed: 0, summary: {}, details: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── 2. Pre-fetch SM clients for these proposals ─────

    const clientIds = [...new Set(allProposals.map((p) => p.sm_client_id).filter(Boolean))];
    const smClientMap = new Map<number, any>();

    for (let i = 0; i < clientIds.length; i += 500) {
      const chunk = clientIds.slice(i, i + 500);
      const { data: clients } = await adminClient
        .from("solar_market_clients")
        .select("sm_client_id, name, email, phone, phone_formatted, phone_normalized, document, document_formatted, city, state, neighborhood, address, number, complement, zip_code, zip_code_formatted, company")
        .eq("tenant_id", tenantId)
        .in("sm_client_id", chunk);
      for (const c of clients || []) {
        smClientMap.set(c.sm_client_id, c);
      }
    }

    console.log(`[SM Migration] Loaded ${smClientMap.size} SM clients`);

    // ─── 2b. Pre-fetch SM projects to resolve responsible (vendedor) & funnels ─
    const smProjectIds = [...new Set(allProposals.map((p) => p.sm_project_id).filter(Boolean))];
    const smProjectMap = new Map<number, { responsible_name: string | null; sm_funnel_name: string | null; sm_stage_name: string | null; all_funnels: any[] | null }>();

    for (let i = 0; i < smProjectIds.length; i += 500) {
      const chunk = smProjectIds.slice(i, i + 500);
      const { data: projects } = await adminClient
        .from("solar_market_projects")
        .select("sm_project_id, responsible, sm_funnel_name, sm_stage_name, all_funnels")
        .eq("tenant_id", tenantId)
        .in("sm_project_id", chunk);
      for (const p of projects || []) {
        const respName = p.responsible?.name || null;
        smProjectMap.set(p.sm_project_id, { responsible_name: respName, sm_funnel_name: p.sm_funnel_name, sm_stage_name: p.sm_stage_name, all_funnels: p.all_funnels || null });
      }
    }
    console.log(`[SM Migration] Loaded ${smProjectMap.size} SM projects for responsible resolution`);


    // ─── 2c. Pre-fetch consultores for owner auto-resolution ─
    const consultoresMap = new Map<string, string>(); // lowercase name → id
    {
      const { data: consultores } = await adminClient
        .from("consultores")
        .select("id, nome")
        .eq("tenant_id", tenantId);
      for (const c of consultores || []) {
        if (c.nome) consultoresMap.set(c.nome.toLowerCase().trim(), c.id);
      }
    }
    console.log(`[SM Migration] Loaded ${consultoresMap.size} consultores for auto-resolution`);

    // ─── Helper: resolve or create consultor by name ─────
    async function resolveOrCreateConsultor(stageName: string): Promise<{ id: string; created: boolean }> {
      const key = stageName.toLowerCase().trim();
      const existing = consultoresMap.get(key);
      if (existing) return { id: existing, created: false };

      // Also try partial match (first name)
      for (const [k, v] of consultoresMap) {
        if (k.startsWith(key) || key.startsWith(k)) {
          return { id: v, created: false };
        }
      }

      if (dry_run) {
        // In dry-run, return a placeholder
        return { id: `AUTO_CREATE:${stageName}`, created: true };
      }

      // Create consultor without user access (user_id = null)
      const codigo = `SM-${stageName.replace(/\s+/g, "-").substring(0, 20)}`;
      const { data: newConsultor, error: consErr } = await adminClient
        .from("consultores")
        .insert({
          tenant_id: tenantId,
          nome: stageName,
          telefone: "N/A",
          codigo,
          ativo: true,
          user_id: null, // No login access
        })
        .select("id")
        .single();

      if (consErr) {
        console.error(`[SM Migration] Failed to create consultor "${stageName}":`, consErr.message);
        throw new Error(`Falha ao criar consultor "${stageName}": ${consErr.message}`);
      }

      const id = newConsultor!.id;
      consultoresMap.set(key, id);
      return { id, created: true };
    }

    // ─── Helper: find or create canonical pipeline by name ──
    const pipelineCache = new Map<string, string>(); // funnelName → pipeline_id
    const stageCache = new Map<string, string>(); // "pipelineId::stageName" → stage_id

    async function resolveOrCreatePipeline(funnelName: string): Promise<string> {
      const key = funnelName.trim();
      if (pipelineCache.has(key)) return pipelineCache.get(key)!;

      // Look up existing pipeline by name
      const { data: existing } = await adminClient
        .from("pipelines")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", key)
        .limit(1);

      if (existing && existing.length > 0) {
        pipelineCache.set(key, existing[0].id);
        return existing[0].id;
      }

      if (dry_run) {
        const placeholder = `AUTO_CREATE_PIPELINE:${key}`;
        pipelineCache.set(key, placeholder);
        return placeholder;
      }

      // Create new pipeline
      const { data: newPipe, error: pipeErr } = await adminClient
        .from("pipelines")
        .insert({
          tenant_id: tenantId,
          name: key,
          kind: "process",
          is_active: true,
          version: 1,
        })
        .select("id")
        .single();

      if (pipeErr) throw new Error(`Falha ao criar pipeline "${key}": ${pipeErr.message}`);
      pipelineCache.set(key, newPipe!.id);
      console.log(`[SM Migration] Created pipeline "${key}" → ${newPipe!.id}`);
      return newPipe!.id;
    }

    async function resolveOrCreateStage(pipelineId: string, stageName: string, position: number): Promise<string> {
      const cacheKey = `${pipelineId}::${stageName.trim()}`;
      if (stageCache.has(cacheKey)) return stageCache.get(cacheKey)!;

      // Look up existing stage
      const { data: existing } = await adminClient
        .from("pipeline_stages")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("pipeline_id", pipelineId)
        .eq("name", stageName.trim())
        .limit(1);

      if (existing && existing.length > 0) {
        stageCache.set(cacheKey, existing[0].id);
        return existing[0].id;
      }

      if (dry_run) {
        const placeholder = `AUTO_CREATE_STAGE:${stageName}`;
        stageCache.set(cacheKey, placeholder);
        return placeholder;
      }

      // Create new stage
      const { data: newStage, error: stageErr } = await adminClient
        .from("pipeline_stages")
        .insert({
          tenant_id: tenantId,
          pipeline_id: pipelineId,
          name: stageName.trim(),
          position,
          probability: 50,
          is_closed: false,
          is_won: false,
        })
        .select("id")
        .single();

      if (stageErr) throw new Error(`Falha ao criar stage "${stageName}": ${stageErr.message}`);
      stageCache.set(cacheKey, newStage!.id);
      console.log(`[SM Migration] Created stage "${stageName}" in pipeline ${pipelineId} → ${newStage!.id}`);
      return newStage!.id;
    }


    const existingDeals = new Map<string, string>(); // legacy_key -> deal_id
    {
      const { data: deals } = await adminClient
        .from("deals")
        .select("id, legacy_key")
        .eq("tenant_id", tenantId)
        .not("legacy_key", "is", null);
      for (const d of deals || []) {
        if (d.legacy_key) existingDeals.set(d.legacy_key, d.id);
      }
    }

    // ─── 4. Pre-fetch existing propostas_nativas with sm_id ─

    const existingPropostas = new Map<string, string>(); // sm_id -> proposta_id
    {
      const { data: props } = await adminClient
        .from("propostas_nativas")
        .select("id, sm_id")
        .eq("tenant_id", tenantId)
        .not("sm_id", "is", null);
      for (const p of props || []) {
        if (p.sm_id) existingPropostas.set(p.sm_id, p.id);
      }
    }

    // ─── 5. Process proposals ────────────────────────────

    const reports: ProposalReport[] = [];
    const summary: Record<string, number> = {
      WOULD_CREATE: 0,
      WOULD_LINK: 0,
      WOULD_SKIP: 0,
      CONFLICT: 0,
      ERROR: 0,
      SUCCESS: 0,
    };

    // Limit total processing to batch_size to avoid timeout
    let proposalsToProcess = allProposals.slice(0, batch_size);
    console.log(`[SM Migration] Processing ${proposalsToProcess.length} of ${allProposals.length} proposals (batch_size=${batch_size})`);

    // ─── Filter by vendedor if specified ─────
    if (filters.vendedor_name) {
      const vendedorFilter = filters.vendedor_name.toLowerCase().trim();
      
      // Get sm_project_ids that belong to this vendedor
      const vendedorProjectIds = new Set<number>();
      for (const [projId, proj] of smProjectMap) {
        const funnels: any[] = proj.all_funnels || [];
        for (const f of funnels) {
          const fName = (f.funnelName || "").toLowerCase();
          const sName = (f.stageName || "").toLowerCase().trim();
          if (fName === "vendedores" && sName === vendedorFilter) {
            vendedorProjectIds.add(projId);
          }
        }
        // Also check legacy sm_funnel_name/sm_stage_name
        if (proj.sm_funnel_name?.toLowerCase() === "vendedores" && proj.sm_stage_name?.toLowerCase().trim() === vendedorFilter) {
          vendedorProjectIds.add(projId);
        }
      }
      
      const beforeCount = proposalsToProcess.length;
      proposalsToProcess = proposalsToProcess.filter((p: any) => p.sm_project_id && vendedorProjectIds.has(p.sm_project_id));
      console.log(`[SM Migration] Vendedor filter "${filters.vendedor_name}": ${beforeCount} → ${proposalsToProcess.length} proposals (${vendedorProjectIds.size} projects matched)`);
    }

    for (const smProp of proposalsToProcess) {
        const report: ProposalReport = {
          sm_proposal_id: smProp.sm_proposal_id,
          sm_client_name: null,
          aborted: false,
          steps: {},
        };

        try {
          // ── A. Resolve SM Client (handle sm_client_id=-1 via project) ──
          let smClient = smClientMap.get(smProp.sm_client_id);
          if (!smClient && smProp.sm_project_id) {
            // sm_client_id=-1 is common — resolve real client_id via project
            const { data: proj } = await adminClient
              .from("solar_market_projects")
              .select("sm_client_id")
              .eq("tenant_id", tenantId)
              .eq("sm_project_id", smProp.sm_project_id)
              .maybeSingle();
            if (proj?.sm_client_id && proj.sm_client_id > 0) {
              smClient = smClientMap.get(proj.sm_client_id);
              if (!smClient) {
                // Fetch directly if not pre-loaded
                const { data: clients } = await adminClient
                  .from("solar_market_clients")
                  .select("sm_client_id, name, email, phone, phone_formatted, phone_normalized, document, document_formatted, city, state, neighborhood, address, number, complement, zip_code, zip_code_formatted, company")
                  .eq("tenant_id", tenantId)
                  .eq("sm_client_id", proj.sm_client_id)
                  .limit(1);
                if (clients?.[0]) smClient = clients[0];
              }
              if (smClient) console.log(`[SM Migration] Resolved client via project ${smProp.sm_project_id}: sm_client_id ${smProp.sm_client_id} → ${proj.sm_client_id}`);
            }
          }
          if (!smClient) {
            report.aborted = true;
            report.steps.cliente = { status: "ERROR", reason: `Cliente SM não encontrado (sm_client_id=${smProp.sm_client_id}). Execute o sync primeiro.` };
            summary.ERROR++;
            reports.push(report);
            continue;
          }
          report.sm_client_name = smClient.name;

          // ── B. Dedupe client by phone_normalized (EXACT match) ──
          const phoneNorm = smClient.phone_normalized || normalizePhone(smClient.phone);
          let clienteId: string | null = null;

          if (phoneNorm) {
            const { data: matches } = await adminClient
              .from("clientes")
              .select("id, nome")
              .eq("tenant_id", tenantId)
              .eq("telefone_normalized", phoneNorm);

            const matchCount = (matches || []).length;

            if (matchCount > 1) {
              report.aborted = true;
              report.steps.cliente = {
                status: "CONFLICT",
                reason: `${matchCount} clients match phone ${phoneNorm}`,
                matches: matchCount,
              };
              summary.CONFLICT++;
              reports.push(report);
              await logItem(adminClient, tenantId, smProp.sm_proposal_id, smClient.name, "CONFLICT", report, dry_run);
              continue;
            }

            if (matchCount === 1) {
              clienteId = matches![0].id;
              report.steps.cliente = { status: "WOULD_LINK", id: clienteId };
            }
          }

          // Fallback: cpf_cnpj exact match
          if (!clienteId && smClient.document) {
            const docNorm = smClient.document.replace(/\D/g, "");
            if (docNorm.length >= 11) {
              const { data: docMatches } = await adminClient
                .from("clientes")
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("cpf_cnpj", docNorm);

              if ((docMatches || []).length === 1) {
                clienteId = docMatches![0].id;
                report.steps.cliente = { status: "WOULD_LINK", id: clienteId, reason: "matched by cpf_cnpj" };
              }
            }
          }

          // No match → need to create
          if (!clienteId) {
            // Generate a unique cliente_code using the real sm_client_id (resolved, not -1)
            const resolvedSmClientId = smClient.sm_client_id || smProp.sm_client_id;
            const clienteCode = `SM-${resolvedSmClientId}-${smProp.sm_project_id || 0}`;
            
            if (dry_run) {
              report.steps.cliente = { status: "WOULD_CREATE" };
            } else {
              // Try insert, on conflict with cliente_code → link to existing
              const { data: newClient, error: insErr } = await adminClient
                .from("clientes")
                .insert({
                  tenant_id: tenantId,
                  nome: smClient.name || "SM Import",
                  telefone: smClient.phone_formatted || smClient.phone || "N/A",
                  telefone_normalized: phoneNorm,
                  email: smClient.email,
                  cpf_cnpj: smClient.document ? smClient.document.replace(/\D/g, "") : null,
                  cidade: smClient.city,
                  estado: smClient.state,
                  bairro: smClient.neighborhood,
                  rua: smClient.address,
                  numero: smClient.number,
                  complemento: smClient.complement,
                  cep: smClient.zip_code_formatted || smClient.zip_code,
                  empresa: smClient.company,
                  cliente_code: clienteCode,
                  potencia_kwp: smProp.potencia_kwp || null,
                  valor_projeto: smProp.preco_total || smProp.valor_total || null,
                })
                .select("id")
                .single();

              if (insErr) {
                // If duplicate cliente_code, find existing and link
                if (insErr.message.includes("uq_clientes_tenant_cliente_code")) {
                  const { data: existing } = await adminClient
                    .from("clientes")
                    .select("id")
                    .eq("tenant_id", tenantId)
                    .eq("cliente_code", clienteCode)
                    .maybeSingle();
                  if (existing) {
                    clienteId = existing.id;
                    report.steps.cliente = { status: "WOULD_LINK", id: clienteId, reason: "cliente_code já existia" };
                  } else {
                    report.aborted = true;
                    report.steps.cliente = { status: "ERROR", reason: insErr.message };
                    summary.ERROR++;
                    reports.push(report);
                    await logItem(adminClient, tenantId, smProp.sm_proposal_id, smClient.name, "ERROR", report, dry_run);
                    continue;
                  }
                } else {
                  report.aborted = true;
                  report.steps.cliente = { status: "ERROR", reason: insErr.message };
                  summary.ERROR++;
                  reports.push(report);
                  await logItem(adminClient, tenantId, smProp.sm_proposal_id, smClient.name, "ERROR", report, dry_run);
                  continue;
                }
              } else {
                clienteId = newClient!.id;
                report.steps.cliente = { status: "WOULD_CREATE", id: clienteId };
              }
            }
          }

          // ── B2. Resolve owner_id ──
          // Priority: 1) SM API funnel "Vendedores" stage name (live fetch)
          //           2) DB sm_funnel_name/sm_stage_name (cached from sync)
          //           3) project responsible.name
          //           4) params.owner_id (manual fallback)
          let resolvedOwnerId = params.owner_id || null;
          let ownerAutoCreated = false;
          let ownerSource = resolvedOwnerId ? "manual_fallback" : "none";

          if (autoResolveOwner && smProp.sm_project_id) {
            const smProj = smProjectMap.get(smProp.sm_project_id);

            // Priority 1: Live fetch from SM API — funnel "Vendedores" stage name
            const apiFunnelName = await fetchProjectFunnelVendedor(smProp.sm_project_id);
            if (apiFunnelName) {
              try {
                const { id, created } = await resolveOrCreateConsultor(apiFunnelName);
                resolvedOwnerId = id;
                ownerAutoCreated = created;
                ownerSource = `api_funnel:${apiFunnelName}`;
                (report as any).owner_resolved = { name: apiFunnelName, id, created, source: "sm_api_vendedores" };
              } catch (e) {
                (report as any).owner_resolved = { error: (e as Error).message };
              }
            }

            // Priority 2: DB cached funnel data
            if (!resolvedOwnerId || ownerSource.startsWith("manual")) {
              if (smProj?.sm_funnel_name?.toLowerCase() === "vendedores" && smProj.sm_stage_name) {
                try {
                  const { id, created } = await resolveOrCreateConsultor(smProj.sm_stage_name);
                  resolvedOwnerId = id;
                  ownerAutoCreated = created;
                  ownerSource = `db_funnel:${smProj.sm_stage_name}`;
                  (report as any).owner_resolved = { name: smProj.sm_stage_name, id, created, source: "db_vendedores" };
                } catch (e) { /* fallthrough */ }
              }
            }

            // Priority 3: project responsible.name
            if (!resolvedOwnerId || ownerSource.startsWith("manual")) {
              const respName = smProj?.responsible_name;
              if (respName) {
                try {
                  const { id, created } = await resolveOrCreateConsultor(respName);
                  resolvedOwnerId = id;
                  ownerAutoCreated = created;
                  ownerSource = `responsible:${respName}`;
                  (report as any).owner_resolved = { name: respName, id, created, source: "project_responsible" };
                } catch (e) { /* fallthrough */ }
              }
            }
          }

          // If still no owner, abort
          if (!resolvedOwnerId) {
            report.aborted = true;
            report.steps.deal = { status: "ERROR", reason: "Nenhum vendedor no funil Vendedores e nenhum responsável de fallback selecionado" };
            summary.ERROR++;
            reports.push(report);
            await logItem(adminClient, tenantId, smProp.sm_proposal_id, smClient.name, "ERROR", report, dry_run);
            continue;
          }

          // ── C. Deal (idempotent via legacy_key) ──
          const legacyKey = `sm:${smProp.sm_proposal_id}`;
          let dealId: string | null = existingDeals.get(legacyKey) || null;

          if (dealId) {
            report.steps.deal = { status: "WOULD_SKIP", id: dealId };
          } else {
            if (dry_run) {
              report.steps.deal = { status: "WOULD_CREATE", reason: `owner: ${ownerSource}${ownerAutoCreated ? " (criar)" : ""}` };
            } else {
              // Resolve original SM date for created_at
              const smOriginalDate = smProp.sm_created_at || smProp.generated_at || smProp.send_at || null;
              const dealInsert: Record<string, any> = {
                  tenant_id: tenantId,
                  pipeline_id: params.pipeline_id!,
                  stage_id: params.stage_id || null,
                  customer_id: clienteId!,
                  owner_id: resolvedOwnerId!,
                  title: smClient.name || smProp.titulo || `SM Proposta ${smProp.sm_proposal_id}`,
                  value: smProp.preco_total || smProp.valor_total || 0,
                  kwp: smProp.potencia_kwp || null,
                  status: mapSmStatusToDeal(smProp),
                  legacy_key: legacyKey,
                  deal_num: null,
              };
              if (smOriginalDate) {
                dealInsert.created_at = smOriginalDate;
                dealInsert.updated_at = smProp.sm_updated_at || smProp.acceptance_date || smOriginalDate;
              }
              // deals table doesn't have closed_at column

              const { data: newDeal, error: dealErr } = await adminClient
                .from("deals")
                .insert(dealInsert)
                .select("id")
                .single();

              if (dealErr) {
                report.aborted = true;
                report.steps.deal = { status: "ERROR", reason: dealErr.message };
                summary.ERROR++;
                reports.push(report);
                await logItem(adminClient, tenantId, smProp.sm_proposal_id, smClient.name, "ERROR", report, dry_run);
                continue;
              }
              dealId = newDeal!.id;
              existingDeals.set(legacyKey, dealId);
              report.steps.deal = { status: "WOULD_CREATE", id: dealId };
            }
          }

          // ── C2. Assign Deal to Pipelines from SM funnels (exceto Vendedores) ──
          if (dealId && smProp.sm_project_id) {
            const smProj = smProjectMap.get(smProp.sm_project_id);
            const funnels: any[] = smProj?.all_funnels || [];
            const nonVendedores = funnels.filter((f: any) => f.funnelName && f.funnelName !== "Vendedores" && f.stageName);

            if (nonVendedores.length > 0) {
              const pipelineDetails: Array<{ funnel: string; stage: string; pipeline_id?: string; stage_id?: string }> = [];

              for (let idx = 0; idx < nonVendedores.length; idx++) {
                const f = nonVendedores[idx];
                try {
                  const pipeId = await resolveOrCreatePipeline(f.funnelName);
                  const stgId = await resolveOrCreateStage(pipeId, f.stageName, idx);
                  pipelineDetails.push({ funnel: f.funnelName, stage: f.stageName, pipeline_id: pipeId, stage_id: stgId });

                  if (!dry_run && !pipeId.startsWith("AUTO_CREATE") && !stgId.startsWith("AUTO_CREATE")) {
                    // Insert deal_pipeline_stages (idempotent — skip if exists)
                    const { error: dpsErr } = await adminClient
                      .from("deal_pipeline_stages")
                      .upsert({
                        deal_id: dealId,
                        pipeline_id: pipeId,
                        stage_id: stgId,
                        tenant_id: tenantId,
                      }, { onConflict: "deal_id,pipeline_id" });

                    if (dpsErr) {
                      console.warn(`[SM Migration] deal_pipeline_stages error: ${dpsErr.message}`);
                    }
                  }
                } catch (e) {
                  pipelineDetails.push({ funnel: f.funnelName, stage: f.stageName });
                  console.warn(`[SM Migration] Pipeline resolution error for "${f.funnelName}/${f.stageName}": ${(e as Error).message}`);
                }
              }

              report.steps.pipelines = {
                status: dry_run ? "WOULD_CREATE" : "WOULD_CREATE",
                reason: `${pipelineDetails.length} funis mapeados`,
                details: pipelineDetails,
              };
            } else {
              report.steps.pipelines = { status: "WOULD_SKIP", reason: "Nenhum funil não-Vendedores encontrado" };
            }
          }

          // ── D. Projeto ──
          let projetoId: string | null = null;

          if (dealId && !dry_run) {
            // Check if projeto already exists for this deal
            const { data: existingProjeto } = await adminClient
              .from("projetos")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("deal_id", dealId)
              .limit(1);

            if ((existingProjeto || []).length > 0) {
              projetoId = existingProjeto![0].id;
              report.steps.projeto = { status: "WOULD_LINK", id: projetoId };
            } else {
              const smProjDate = smProp.sm_created_at || smProp.generated_at || null;
              const projInsert: Record<string, any> = {
                  tenant_id: tenantId,
                  cliente_id: clienteId!,
                  deal_id: dealId,
                  consultor_id: resolvedOwnerId || null,
                  potencia_kwp: smProp.potencia_kwp || null,
                  valor_total: smProp.preco_total || smProp.valor_total || null,
                  cidade_instalacao: smProp.cidade || smClient.city || null,
                  uf_instalacao: smProp.estado || smClient.state || null,
                  bairro_instalacao: smClient.neighborhood || null,
                  rua_instalacao: smClient.address || null,
                  cep_instalacao: smClient.zip_code_formatted || smClient.zip_code || null,
                  tipo_instalacao: smProp.roof_type || null,
                  modelo_inversor: smProp.inverter_model || null,
                  numero_inversores: smProp.inverter_quantity || null,
                  modelo_modulos: smProp.panel_model || null,
                  numero_modulos: smProp.panel_quantity || null,
                  valor_equipamentos: smProp.equipment_cost || null,
                  valor_mao_obra: smProp.installation_cost || null,
                  geracao_mensal_media_kwh: smProp.geracao_anual ? Math.round(smProp.geracao_anual / 12) : null,
                  status: mapSmStatusToDeal(smProp) === "won" ? "concluido" : "criado",
                  codigo: `PROJ-SM-${smProp.sm_proposal_id}`,
                  projeto_num: null,
              };
              if (smProjDate) {
                projInsert.created_at = smProjDate;
                projInsert.updated_at = smProp.sm_updated_at || smProp.acceptance_date || smProjDate;
              }
              const { data: newProj, error: projErr } = await adminClient
                .from("projetos")
                .insert(projInsert)
                .select("id")
                .single();

              if (projErr) {
                report.steps.projeto = { status: "ERROR", reason: projErr.message };
                // Non-fatal: continue without projeto
              } else {
                projetoId = newProj!.id;
                report.steps.projeto = { status: "WOULD_CREATE", id: projetoId };
              }
            }
          } else {
            report.steps.projeto = { status: dry_run ? "WOULD_CREATE" : "ERROR", reason: dry_run ? undefined : "no deal_id" };
          }

          // ── E. Proposta Nativa ──
          const smIdKey = String(smProp.sm_proposal_id);
          let propostaId: string | null = existingPropostas.get(smIdKey) || null;

          if (propostaId) {
            report.steps.proposta_nativa = { status: "WOULD_SKIP", id: propostaId };
          } else {
            if (dry_run) {
              report.steps.proposta_nativa = { status: "WOULD_CREATE" };
            } else {
              if (!projetoId) {
                report.steps.proposta_nativa = { status: "ERROR", reason: "no projeto_id" };
                report.aborted = true;
                summary.ERROR++;
                reports.push(report);
                await logItem(adminClient, tenantId, smProp.sm_proposal_id, smClient.name, "ERROR", report, dry_run);
                continue;
              }

              const smPropDate = smProp.generated_at || smProp.sm_created_at || null;
              const propInsert: Record<string, any> = {
                  tenant_id: tenantId,
                  projeto_id: projetoId,
                  deal_id: dealId,
                  cliente_id: clienteId,
                  titulo: smClient.name || smProp.titulo || `Proposta SM #${smProp.sm_proposal_id}`,
                  status: mapSmStatusToProposta(smProp),
                  origem: "imported",
                  versao_atual: 1,
                  sm_id: smIdKey,
                  sm_project_id: smProp.sm_project_id ? String(smProp.sm_project_id) : null,
                  sm_raw_payload: null,
                  aceita_at: smProp.acceptance_date || null,
                  recusada_at: smProp.rejection_date || null,
                  enviada_at: smProp.send_at || null,
                  proposta_num: null,
                  codigo: `PROP-SM-${smProp.sm_proposal_id}`,
              };
              if (smPropDate) {
                propInsert.created_at = smPropDate;
                propInsert.updated_at = smProp.sm_updated_at || smProp.acceptance_date || smPropDate;
              }
              const { data: newProp, error: propErr } = await adminClient
                .from("propostas_nativas")
                .insert(propInsert)
                .select("id")
                .single();

              if (propErr) {
                report.aborted = true;
                report.steps.proposta_nativa = { status: "ERROR", reason: propErr.message };
                summary.ERROR++;
                reports.push(report);
                await logItem(adminClient, tenantId, smProp.sm_proposal_id, smClient.name, "ERROR", report, dry_run);
                continue;
              }
              propostaId = newProp!.id;
              existingPropostas.set(smIdKey, propostaId);
              report.steps.proposta_nativa = { status: "WOULD_CREATE", id: propostaId };
            }
          }

          // ── F. Proposta Versão ──
          if (propostaId && !dry_run) {
            // Check if version already exists
            const { data: existingVer } = await adminClient
              .from("proposta_versoes")
              .select("id")
              .eq("proposta_id", propostaId)
              .eq("versao_numero", 1)
              .limit(1);

            if ((existingVer || []).length > 0) {
              report.steps.proposta_versao = { status: "WOULD_SKIP", id: existingVer![0].id };
            } else {
              const paybackMeses = parsePaybackMonths(smProp.payback);

              const finalSnapshot = {
                source: "legacy_import",
                sm_proposal_id: smProp.sm_proposal_id,
                link_pdf: smProp.link_pdf,
                tir: smProp.tir,
                vpl: smProp.vpl,
                consumo_mensal: smProp.consumo_mensal,
                tarifa_distribuidora: smProp.tarifa_distribuidora,
                economia_mensal_percent: smProp.economia_mensal_percent,
                inflacao_energetica: smProp.inflacao_energetica,
                perda_eficiencia_anual: smProp.perda_eficiencia_anual,
                sobredimensionamento: smProp.sobredimensionamento,
                custo_disponibilidade: smProp.custo_disponibilidade,
                geracao_anual: smProp.geracao_anual,
                payback_original: smProp.payback,
                payment_conditions: smProp.payment_conditions,
                panel_model: smProp.panel_model,
                panel_quantity: smProp.panel_quantity,
                inverter_model: smProp.inverter_model,
                inverter_quantity: smProp.inverter_quantity,
                equipment_cost: smProp.equipment_cost,
                installation_cost: smProp.installation_cost,
                roof_type: smProp.roof_type,
                structure_type: smProp.structure_type,
                warranty: smProp.warranty,
                discount: smProp.discount,
                dis_energia: smProp.dis_energia,
                generated_at: smProp.generated_at,
                send_at: smProp.send_at,
                viewed_at: smProp.viewed_at,
                acceptance_date: smProp.acceptance_date,
                rejection_date: smProp.rejection_date,
                valid_until: smProp.valid_until,
              };

              const smVerDate = smProp.generated_at || smProp.sm_created_at || null;
              const verInsert: Record<string, any> = {
                  tenant_id: tenantId,
                  proposta_id: propostaId,
                  versao_numero: 1,
                  valor_total: smProp.preco_total || smProp.valor_total || null,
                  potencia_kwp: smProp.potencia_kwp || null,
                  economia_mensal: smProp.economia_mensal || null,
                  geracao_mensal: smProp.geracao_anual ? Math.round(smProp.geracao_anual / 12) : null,
                  payback_meses: paybackMeses,
                  status: mapSmStatusToVersao(smProp),
                  snapshot_locked: true,
                  final_snapshot: finalSnapshot,
                  snapshot: finalSnapshot,
                  validade_dias: 30,
                  aceito_em: smProp.acceptance_date || null,
                  link_pdf: smProp.link_pdf || null,
                  geracao_anual: smProp.geracao_anual || null,
                  tir: smProp.tir || null,
                  vpl: smProp.vpl || null,
                  consumo_mensal: smProp.consumo_mensal || null,
                  tarifa_distribuidora: smProp.tarifa_distribuidora || null,
                  economia_mensal_percent: smProp.economia_mensal_percent || null,
                  inflacao_energetica: smProp.inflacao_energetica || null,
                  perda_eficiencia_anual: smProp.perda_eficiencia_anual || null,
                  sobredimensionamento: smProp.sobredimensionamento || null,
                  custo_disponibilidade: smProp.custo_disponibilidade || null,
                  distribuidora_nome: smProp.dis_energia || null,
                  viewed_at: smProp.viewed_at || null,
                  enviado_em: smProp.send_at || null,
                  origem: "solarmarket",
              };
              if (smVerDate) {
                verInsert.created_at = smVerDate;
                verInsert.updated_at = smProp.sm_updated_at || smProp.acceptance_date || smVerDate;
              }
              const { data: newVer, error: verErr } = await adminClient
                .from("proposta_versoes")
                .insert(verInsert)
                .select("id")
                .single();

              if (verErr) {
                report.steps.proposta_versao = { status: "ERROR", reason: verErr.message };
              } else {
                report.steps.proposta_versao = { status: "WOULD_CREATE", id: newVer!.id };
              }
            }
          } else if (dry_run) {
            report.steps.proposta_versao = { status: "WOULD_CREATE" };
          }

          // Determine overall status for logging
          const allSteps = Object.values(report.steps);
          const hasError = allSteps.some((s) => s.status === "ERROR");
          const allSkip = allSteps.every((s) => s.status === "WOULD_SKIP");
          const overallStatus = hasError ? "ERROR" : allSkip ? "SKIP" : "SUCCESS";

          if (!dry_run) {
            summary[overallStatus === "SKIP" ? "WOULD_SKIP" : overallStatus === "SUCCESS" ? "SUCCESS" : "ERROR"]++;
          } else {
            // In dry-run: count creates vs links vs skips
            for (const s of allSteps) {
              summary[s.status] = (summary[s.status] || 0) + 1;
            }
          }

          await logItem(
            adminClient,
            tenantId,
            smProp.sm_proposal_id,
            smClient.name,
            overallStatus === "SUCCESS" ? "SUCCESS" : overallStatus === "SKIP" ? "SKIP" : "ERROR",
            report,
            dry_run,
          );
        } catch (err) {
          report.aborted = true;
          report.steps.cliente = report.steps.cliente || { status: "ERROR", reason: (err as Error).message };
          summary.ERROR++;
          await logItem(adminClient, tenantId, smProp.sm_proposal_id, report.sm_client_name, "ERROR", report, dry_run);
        }

        reports.push(report);
      }

    const result = {
      mode: dry_run ? "dry_run" : "execute",
      total_found: allProposals.length,
      total_processed: proposalsToProcess.length,
      summary,
      details: reports.slice(0, 200),
      filters_applied: filters,
      has_more: allProposals.length > batch_size,
    };

    console.log(`[SM Migration] Done. Summary: ${JSON.stringify(summary)}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ERR", { step: "fatal", err: (err as Error).message, stack: (err as Error).stack });
    return new Response(
      JSON.stringify({ error: (err as Error).message, step: "fatal", debug: { stack: (err as Error).stack } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─── Log helper ─────────────────────────────────────────

async function logItem(
  client: any,
  tenantId: string,
  smProposalId: number,
  smClientName: string | null,
  status: string,
  report: ProposalReport,
  isDryRun: boolean,
) {
  try {
    // Map status to allowed CHECK values
    const validStatuses = ["SUCCESS", "SKIP", "CONFLICT", "ERROR", "WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP"];
    const finalStatus = validStatuses.includes(status) ? status : "ERROR";

    await client.from("sm_migration_log").insert({
      tenant_id: tenantId,
      sm_proposal_id: smProposalId,
      sm_client_name: smClientName,
      status: finalStatus,
      payload: { steps: report.steps, aborted: report.aborted },
      is_dry_run: isDryRun,
    });
  } catch (e) {
    console.error(`[SM Migration] Log error for proposal ${smProposalId}:`, e);
  }
}
