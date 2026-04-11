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
  /** If true, also migrate projects that have no active proposal */
  include_projects_without_proposal?: boolean;
  batch_size?: number;
  /** Required: pipeline_id to assign deals into */
  pipeline_id?: string;
  /** Required: stage_id for "won" deals */
  stage_id?: string;
  /** Optional: owner_id (consultor_id) — if omitted, auto-resolved from SM project funnel "Vendedores" */
  owner_id?: string;
  /** If true, auto-resolve owner from SM funnel stage name and create consultor if missing */
  auto_resolve_owner?: boolean;
  /** If true, auto-fetch next batch of pending proposals instead of requiring internal_ids */
  auto_resume?: boolean;
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

/** Extract wattage from model name, preferring explicit W/kW suffixes (e.g. 585W, 5K, 10kW). */
function extractPotenciaFromModel(model: string | null): number {
  if (!model) return 0;
  const normalized = model.toUpperCase();
  const explicitWatts = normalized.match(/(\d{3,4})\s*W\b/);
  if (explicitWatts) return parseInt(explicitWatts[1], 10);
  const explicitKw = normalized.match(/(\d{1,2}(?:[\.,]\d+)?)\s*KW\b/);
  if (explicitKw) return Math.round(parseFloat(explicitKw[1].replace(",", ".")) * 1000);
  const compactKw = normalized.match(/(?:^|[^\d])(\d{1,2}(?:[\.,]\d+)?)K(?:[^A-Z\d]|$)/);
  if (compactKw) return Math.round(parseFloat(compactKw[1].replace(",", ".")) * 1000);
  const fallback = normalized.match(/(\d{3,4})/);
  return fallback ? parseInt(fallback[1], 10) : 0;
}

/** Extract manufacturer (first word) from model name */
function extractFabricante(model: string | null): string {
  if (!model) return "";
  return model.trim().split(/\s+/)[0] || "";
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
    case "generated": return "generated";
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
/**
 * Map SM fase string to wizard-compatible fase/fase_tensao.
 * SM values: "Monofásico", "Bifásico", "Trifásico"
 * Wizard values: "monofasico", "bifasico", "trifasico" + fase_tensao enum
 */
function mapFaseToWizard(smFase: string | null): { fase: string; fase_tensao: string; tensao_rede: string } {
  const f = (smFase || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (f.includes("monofas")) return { fase: "monofasico", fase_tensao: "monofasico_127_220", tensao_rede: "127/220V" };
  if (f.includes("trifas")) return { fase: "trifasico", fase_tensao: "trifasico_127_220", tensao_rede: "127/220V" };
  return { fase: "bifasico", fase_tensao: "bifasico_127_220", tensao_rede: "127/220V" };
}

/**
 * Build a UC object fully compatible with the wizard's UCData interface.
 * Maps SM field names to wizard field names so that editing a migrated proposal works.
 */
function buildWizardUC(smProp: Record<string, any>, resolvedConcId?: string | null): Record<string, any> {
  const { fase, fase_tensao, tensao_rede } = mapFaseToWizard(smProp.fase);
  const consumo = Number(smProp.consumo_mensal ?? 0);
  const tarifaEnergia = Number(smProp.tarifa_distribuidora ?? 0);

  // Determine subgrupo — SM may provide or default to B3
  let subgrupo = smProp.subgrupo_tarifario || "";
  if (!subgrupo) {
    subgrupo = "B3";
  }

  return {
    id: crypto.randomUUID(),
    uc_index: 1,
    nome: "UC Principal",
    is_geradora: true,
    regra: "GD2",
    grupo_tarifario: "B",
    tipo_dimensionamento: "consumo",
    distribuidora: smProp.dis_energia ?? "",
    distribuidora_id: resolvedConcId || null,
    subgrupo,
    estado: "",
    cidade: "",
    fase,
    fase_tensao,
    tensao_rede,
    consumo_mensal: consumo,
    consumo_meses: { jan: 0, fev: 0, mar: 0, abr: 0, mai: 0, jun: 0, jul: 0, ago: 0, set: 0, out: 0, nov: 0, dez: 0 },
    consumo_mensal_p: 0,
    consumo_mensal_fp: 0,
    consumo_meses_p: { jan: 0, fev: 0, mar: 0, abr: 0, mai: 0, jun: 0, jul: 0, ago: 0, set: 0, out: 0, nov: 0, dez: 0 },
    consumo_meses_fp: { jan: 0, fev: 0, mar: 0, abr: 0, mai: 0, jun: 0, jul: 0, ago: 0, set: 0, out: 0, nov: 0, dez: 0 },
    tarifa_distribuidora: tarifaEnergia,
    tarifa_fio_b: 0,
    tarifa_te_p: 0, tarifa_tusd_p: 0, tarifa_fio_b_p: 0, tarifa_tarifacao_p: 0,
    tarifa_te_fp: 0, tarifa_tusd_fp: 0, tarifa_fio_b_fp: 0, tarifa_tarifacao_fp: 0,
    demanda_consumo_kw: 0, demanda_geracao_kw: 0,
    demanda_consumo_rs: 0, demanda_geracao_rs: 0,
    demanda_preco: 0, demanda_contratada: 0, demanda_adicional: 0,
    custo_disponibilidade_kwh: 50, custo_disponibilidade_valor: 0,
    outros_encargos_atual: 0, outros_encargos_novo: 0,
    distancia: 0, tipo_telhado: smProp.roof_type ?? "",
    inclinacao: smProp.inclinacao ?? 0, desvio_azimutal: smProp.desvio_azimutal ?? 0,
    taxa_desempenho: 80,
    regra_compensacao: 0, rateio_sugerido_creditos: 100,
    rateio_creditos: 100, imposto_energia: 0, fator_simultaneidade: 0,
    percentual_compensacao: 100,
  };
}

// ─── PASSO 0: Sync Pipelines Handler ────────────────────

function normalizeNameForCompare(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function handleSyncPipelines(adminClient: any, tenantId: string): Promise<Response> {
  const report = {
    pipelines: { created: 0, existing: 0, names: [] as string[] },
    stages: { created: 0, existing: 0 },
    consultores: { created: 0, existing: 0 },
  };

  // 1. Fetch ALL SM projects for this tenant
  const allProjects: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data: page, error: pageErr } = await adminClient
      .from("solar_market_projects")
      .select("sm_project_id, sm_funnel_name, sm_stage_name, all_funnels, responsible")
      .eq("tenant_id", tenantId)
      .range(offset, offset + pageSize - 1);
    if (pageErr) throw new Error(`Fetch SM projects: ${pageErr.message}`);
    allProjects.push(...(page || []));
    if ((page || []).length < pageSize) break;
    offset += pageSize;
  }

  // 2. Extract all unique funnels and stages
  // Map: funnelName → Set<stageName>
  const funnelStagesMap = new Map<string, Set<string>>();
  const vendedorNames = new Set<string>();

  for (const proj of allProjects) {
    const funnels: Array<{ funnelName: string; stageName: string }> = [];

    // From all_funnels array
    if (Array.isArray(proj.all_funnels)) {
      for (const f of proj.all_funnels) {
        const fName = String(f.funnelName || f.funnel_name || "").trim();
        const sName = String(f.stageName || f.stage_name || "").trim();
        if (fName) funnels.push({ funnelName: fName, stageName: sName });
      }
    }

    // Fallback from sm_funnel_name + sm_stage_name
    if (funnels.length === 0 && proj.sm_funnel_name) {
      funnels.push({
        funnelName: String(proj.sm_funnel_name).trim(),
        stageName: String(proj.sm_stage_name || "").trim(),
      });
    }

    for (const f of funnels) {
      const normalizedFunnel = normalizeNameForCompare(f.funnelName);
      if (normalizedFunnel === "vendedores") {
        // Collect vendedor names for consultor creation
        if (f.stageName) vendedorNames.add(f.stageName);
        continue;
      }
      if (!f.funnelName) continue;

      if (!funnelStagesMap.has(f.funnelName)) {
        funnelStagesMap.set(f.funnelName, new Set());
      }
      if (f.stageName) {
        funnelStagesMap.get(f.funnelName)!.add(f.stageName);
      }
    }
  }

  // 3. Pre-fetch existing pipelines, stages, consultores
  const { data: existingPipelines } = await adminClient
    .from("pipelines")
    .select("id, name")
    .eq("tenant_id", tenantId);

  const pipelineMap = new Map<string, string>(); // normalized name → id
  for (const p of existingPipelines || []) {
    pipelineMap.set(normalizeNameForCompare(p.name), p.id);
  }

  const { data: existingConsultores } = await adminClient
    .from("consultores")
    .select("id, nome")
    .eq("tenant_id", tenantId);

  const consultorMap = new Map<string, string>(); // normalized name → id
  for (const c of existingConsultores || []) {
    consultorMap.set(normalizeNameForCompare(c.nome), c.id);
  }

  // 4. Create/resolve pipelines and stages
  for (const [funnelName, stageNames] of funnelStagesMap) {
    // LEAD → Comercial mapping
    const pipelineName = funnelName === "LEAD" ? "Comercial" : funnelName;
    const normalizedPipeName = normalizeNameForCompare(pipelineName);

    let pipelineId = pipelineMap.get(normalizedPipeName);

    if (pipelineId) {
      report.pipelines.existing++;
    } else {
      // Create pipeline
      const { data: newPipe, error: pipeErr } = await adminClient
        .from("pipelines")
        .insert({
          tenant_id: tenantId,
          name: pipelineName,
          kind: "process",
          is_active: true,
          version: 1,
        })
        .select("id")
        .single();

      if (pipeErr) throw new Error(`Falha ao criar pipeline "${pipelineName}": ${pipeErr.message}`);
      pipelineId = newPipe!.id;
      pipelineMap.set(normalizedPipeName, pipelineId);
      report.pipelines.created++;
    }

    report.pipelines.names.push(pipelineName);

    // Fetch existing stages for this pipeline
    const { data: existingStages } = await adminClient
      .from("pipeline_stages")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("pipeline_id", pipelineId);

    const existingStageMap = new Map<string, string>();
    for (const s of existingStages || []) {
      existingStageMap.set(normalizeNameForCompare(s.name), s.id);
    }

    // Create stages in order
    const stageArray = [...stageNames];
    let position = (existingStages || []).length;
    for (const stageName of stageArray) {
      const normalizedStageName = normalizeNameForCompare(stageName);
      if (existingStageMap.has(normalizedStageName)) {
        report.stages.existing++;
        continue;
      }

      const { error: stageErr } = await adminClient
        .from("pipeline_stages")
        .insert({
          tenant_id: tenantId,
          pipeline_id: pipelineId,
          name: stageName.trim(),
          position: position++,
          probability: 50,
          is_closed: false,
          is_won: false,
        });

      if (stageErr) {
        console.error(`[SM Sync] Failed to create stage "${stageName}": ${stageErr.message}`);
      } else {
        report.stages.created++;
        existingStageMap.set(normalizedStageName, "created");
      }
    }
  }

  // 5. Resolve consultores from Vendedores funnel (no auto-creation — fallback to Escritório)
  for (const vendedorName of vendedorNames) {
    const normalizedName = normalizeNameForCompare(vendedorName);
    if (!normalizedName) continue;

    if (consultorMap.has(normalizedName)) {
      report.consultores.existing++;
      continue;
    }

    // Check partial match (first name)
    let found = false;
    for (const [k] of consultorMap) {
      if (k.startsWith(normalizedName) || normalizedName.startsWith(k)) {
        report.consultores.existing++;
        found = true;
        break;
      }
    }
    if (found) continue;

    // No match — will use Escritório fallback at runtime (no auto-creation)
    console.error(`[SM Sync] Consultor "${vendedorName}" not found in cadastro, will use Escritório fallback`);
  }

  // 6. Ensure "Escritório" fallback consultor exists
  if (!consultorMap.has(normalizeNameForCompare("escritório"))) {
    const { error: consErr } = await adminClient
      .from("consultores")
      .insert({
        tenant_id: tenantId,
        nome: "Escritório",
        telefone: "N/A",
        codigo: "escritorio",
        ativo: true,
        user_id: null,
      });

    if (!consErr) {
      report.consultores.created++;
    }
  }

  return new Response(
    JSON.stringify({
      action: "sync_pipelines",
      success: true,
      report,
      total_projects_scanned: allProjects.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ─── Main Handler ───────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── EMERGENCY BLOCK CHECK ─────────────────────────────
    const _supaUrl = Deno.env.get("SUPABASE_URL")!;
    const _svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const _blockClient = createClient(_supaUrl, _svcKey);
    const { data: _blockRow } = await _blockClient
      .from("solar_market_config")
      .select("migration_blocked")
      .limit(1)
      .maybeSingle();
    if (_blockRow?.migration_blocked === true) {
      return new Response(
        JSON.stringify({ blocked: true, message: "Migração bloqueada para manutenção. Contate o administrador." }),
        { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // ─── END BLOCK CHECK ───────────────────────────────────
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
    // console.log("[SM Migration] Auth result:", user?.id ?? "NO_USER", authErr?.message ?? "OK");
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

    // console.log("[SM Migration] Profile:", JSON.stringify({ tenant_id: profile?.tenant_id, status: profile?.status, ativo: profile?.ativo, err: profileError?.message }));
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
    const rawBody = await req.json();

    // ─── PASSO 0: sync_pipelines action ─────────────────
    if (rawBody?.action === "sync_pipelines") {
      return await handleSyncPipelines(adminClient, tenantId);
    }

    const params: MigrationParams = rawBody as MigrationParams;
    const { dry_run = true, batch_size = 25 } = params;
    let { filters = {} } = params;

    // ─── AUTO_RESUME: fetch next pending batch automatically ─────
    if (params.auto_resume && !dry_run) {
      const { data: pendentes } = await adminClient
        .from("solar_market_proposals")
        .select("id")
        .eq("tenant_id", tenantId)
        .is("migrado_em", null)
        .order("sm_proposal_id", { ascending: true })
        .limit(batch_size);

      if (!pendentes || pendentes.length === 0) {
        // Count totals for final report
        const { count: totalCount } = await adminClient
          .from("solar_market_proposals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId);
        const { count: migratedCount } = await adminClient
          .from("solar_market_proposals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("migrado_em", "is", null);

        return new Response(
          JSON.stringify({
            completed: true,
            message: "Todas as propostas foram migradas",
            total: totalCount || 0,
            migrated: migratedCount || 0,
            pending: 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Override filters with auto-fetched IDs
      filters = { ...filters, internal_ids: pendentes.map((p: any) => p.id) };
      console.error(`[SM Migration] auto_resume: fetched ${pendentes.length} pending proposals`);
    }

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

    // console.log(`[SM Migration] tenant=${tenantId} dry_run=${dry_run} filters=${JSON.stringify(filters)}`);

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
        const signinController = new AbortController();
        const signinTimeout = setTimeout(() => signinController.abort(), 10_000);
        try {
          const signinRes = await fetch(`${smBaseUrl}/auth/signin`, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ token: apiToken }),
            signal: signinController.signal,
          });
          if (signinRes.ok) {
            const signinData = await signinRes.json();
            smAccessToken = signinData.access_token || signinData.accessToken || signinData.token || null;
            console.error(`[SM Migration] SM API authenticated (token len=${smAccessToken?.length})`);
          } else {
            console.warn(`[SM Migration] SM API auth failed: ${signinRes.status}`);
          }
        } catch (signinErr: any) {
          const isTimeout = signinErr?.name === "AbortError";
          console.warn(`[SM Migration] SM API auth ${isTimeout ? "timeout (10s)" : "error"}: ${signinErr?.message}`);
          // Don't block migration — continue without SM API token, will use DB fallback
        } finally {
          clearTimeout(signinTimeout);
        }
      } else {
        console.warn("[SM Migration] No SM API token found, will fallback to DB responsible field");
      }
    }

    // Helper: fetch funnel data for a project from SM API
    async function fetchProjectFunnelVendedor(smProjectId: number): Promise<string | null> {
      if (!smAccessToken) return null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        let res: Response;
        try {
          res = await fetch(`${smBaseUrl}/projects/${smProjectId}/funnels`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${smAccessToken}` },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
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
    // Also include custom_fields_raw for mapping
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
      "migrar_para_canonico", "custom_fields_raw",
    ].join(", ");

    let query = adminClient
      .from("solar_market_proposals")
      .select(SM_PROPOSAL_COLUMNS)
      .eq("tenant_id", tenantId)
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

    // console.log(`[SM Migration] Found ${allProposals.length} proposals matching filters`);

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

    // console.log(`[SM Migration] Loaded ${smClientMap.size} SM clients`);

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
    // console.log(`[SM Migration] Loaded ${smProjectMap.size} SM projects for responsible resolution`);


    // ─── 2c. Pre-fetch consultores for owner auto-resolution ─
    function normalizeComparableName(value: string | null | undefined): string {
      return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    }

    const consultoresMap = new Map<string, string>(); // normalized name → id
    {
      const { data: consultores } = await adminClient
        .from("consultores")
        .select("id, nome")
        .eq("tenant_id", tenantId);
      for (const c of consultores || []) {
        const normalizedName = normalizeComparableName(c.nome);
        if (normalizedName) consultoresMap.set(normalizedName, c.id);
      }
    }
    // console.log(`[SM Migration] Loaded ${consultoresMap.size} consultores for auto-resolution`);

    // ─── 2d. Pre-fetch custom field mappings ────────────
    // Normalize source_key on load: store as bareKey (no brackets) for consistent lookup
    function normalizeCfKey(key: string): string {
      return key.replace(/^\[|\]$/g, "").trim();
    }
    const cfMappings = new Map<string, { target_namespace: string; target_path: string; transform: string; priority: number }>();
    {
      const { data: mappings } = await adminClient
        .from("custom_field_mappings")
        .select("source_key, target_namespace, target_path, transform, priority")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("priority", { ascending: true });
      for (const m of (mappings || [])) {
        const bareKey = normalizeCfKey(m.source_key);
        cfMappings.set(bareKey, {
          target_namespace: m.target_namespace,
          target_path: m.target_path,
          transform: m.transform,
          priority: m.priority,
        });
      }
    }
    // console.log(`[SM Migration] Loaded ${cfMappings.size} custom field mappings`);

    /** Apply transform to a raw value */
    function applyTransform(rawValue: any, transform: string): any {
      if (rawValue == null || rawValue === "undefined") return null;
      switch (transform) {
        case "number_br": {
          const s = String(rawValue).replace(/\./g, "").replace(",", ".");
          const n = Number(s);
          return isNaN(n) ? rawValue : n;
        }
        case "number": {
          const n = Number(rawValue);
          return isNaN(n) ? rawValue : n;
        }
        case "boolean":
          return rawValue === true || rawValue === "true" || rawValue === "1" || rawValue === "sim" || rawValue === "Sim";
        case "date_br": {
          // DD/MM/YYYY → YYYY-MM-DD
          const m = String(rawValue).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          return m ? `${m[3]}-${m[2]}-${m[1]}` : rawValue;
        }
        case "json":
          try { return JSON.parse(String(rawValue)); } catch { return rawValue; }
        default: // "string" or enum
          return String(rawValue);
      }
    }


    // ─── Vendedor name mapping (SM stage name → canonical consultor name) ──
    // Ex-funcionários mapeados diretamente para Escritório (DA confirmado 2026-04-10)
    const EX_FUNCIONARIOS = ['rogerio', 'rogério', 'ricardo'];

    const VENDEDOR_MAP: Record<string, string> = {
      'bruno': 'BRUNO BANDEIRA',
      'claudia': 'claudia',
      'diego': 'diego',
      'ian': 'ian souza',
      'renan': 'renan',
      'sebastiao': 'sebastião',
      'sebastião': 'sebastião',
      'escritorio': 'escritório',
      'escritório': 'escritório',
    };

    async function resolveOrCreateConsultor(stageName: string): Promise<{ id: string; created: boolean }> {
      const key = normalizeComparableName(stageName);
      if (!key) {
        // Empty name → use "Escritório"
        return resolveOrCreateEscritorio();
      }

      // Priority 0: ex-funcionários → Escritório direto (sem log de erro)
      if (EX_FUNCIONARIOS.includes(key)) {
        return resolveOrCreateEscritorio();
      }

      // Priority 1: exact match in consultoresMap
      const existing = consultoresMap.get(key);
      if (existing) return { id: existing, created: false };

      // Priority 2: VENDEDOR_MAP lookup — find canonical name and match (word-boundary safe)
      const mappedName = Object.entries(VENDEDOR_MAP).find(([k]) => key === k || key.startsWith(k + ' ') || key.endsWith(' ' + k))?.[1];
      if (mappedName) {
        const normalizedMapped = normalizeComparableName(mappedName);
        const mapped = consultoresMap.get(normalizedMapped);
        if (mapped) return { id: mapped, created: false };
      }

      // Priority 3: partial match (first name)
      for (const [k, v] of consultoresMap) {
        if (k.startsWith(key) || key.startsWith(k)) {
          return { id: v, created: false };
        }
      }

      // Priority 4: No match found — fallback to "Escritório" instead of creating new consultor
      console.error(`[SM Migration] Consultor "${stageName}" not found, falling back to Escritório`);
      return resolveOrCreateEscritorio();
    }

    /** Resolve or create "Escritório" consultor — used when vendor name is empty */
    async function resolveOrCreateEscritorio(): Promise<{ id: string; created: boolean }> {
      const escritorioKey = normalizeComparableName("escritório");
      const escritorioId = consultoresMap.get(escritorioKey);
      if (escritorioId) return { id: escritorioId, created: false };

      if (dry_run) return { id: `AUTO_FALLBACK:escritorio`, created: true };

      const { data: newConsultor, error: consErr } = await adminClient
        .from("consultores")
        .upsert(
          { tenant_id: tenantId, nome: "Escritório", telefone: "N/A", codigo: "escritorio", ativo: true, user_id: null },
          { onConflict: "tenant_id,codigo", ignoreDuplicates: false }
        )
        .select("id")
        .single();

      if (consErr) {
        console.error(`[SM Migration] Failed to create consultor "Escritório":`, consErr.message);
        throw new Error(`Falha ao criar consultor "Escritório": ${consErr.message}`);
      }

      const id = newConsultor!.id;
      consultoresMap.set(escritorioKey, id);
      return { id, created: true };
    }

    // ─── Helper: find or create canonical pipeline by name ──
    const pipelineCache = new Map<string, string>(); // funnelName → pipeline_id
    const stageCache = new Map<string, string>(); // "pipelineId::stageName" → stage_id

    async function resolveOrCreatePipeline(funnelName: string, smStages?: string[]): Promise<string> {
      // LEAD → Comercial mapping (DA-32 governance)
      const key = funnelName.trim() === "LEAD" ? "Comercial" : funnelName.trim();
      if (pipelineCache.has(key)) return pipelineCache.get(key)!;

      // Look up existing pipeline by name (ilike to avoid duplicates)
      const { data: existing } = await adminClient
        .from("pipelines")
        .select("id")
        .eq("tenant_id", tenantId)
        .ilike("name", key)
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
      const pipeId = newPipe!.id;
      pipelineCache.set(key, pipeId);

      // Create SM stages for this pipeline if provided
      if (smStages && smStages.length > 0) {
        const uniqueStages = [...new Set(smStages.map(s => s.trim()).filter(Boolean))];
        for (let i = 0; i < uniqueStages.length; i++) {
          await resolveOrCreateStage(pipeId, uniqueStages[i], i);
        }
      }

      return pipeId;
    }

    async function resolveOrCreateStage(pipelineId: string, stageName: string, position: number): Promise<string> {
      const normalizedStageName = normalizeComparableName(stageName);
      const cacheKey = `${pipelineId}::${normalizedStageName}`;
      if (stageCache.has(cacheKey)) return stageCache.get(cacheKey)!;

      // Bulk-load ALL stages for this pipeline into cache (1 query per pipeline, not per stage)
      const pipelineCacheMarker = `__loaded__::${pipelineId}`;
      if (!stageCache.has(pipelineCacheMarker)) {
        const { data: allStages } = await adminClient
          .from("pipeline_stages")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .eq("pipeline_id", pipelineId);
        for (const s of (allStages || [])) {
          const normKey = `${pipelineId}::${normalizeComparableName(s.name)}`;
          if (!stageCache.has(normKey)) stageCache.set(normKey, s.id);
        }
        stageCache.set(pipelineCacheMarker, "__marker__");
      }

      // Re-check cache after bulk load
      if (stageCache.has(cacheKey)) return stageCache.get(cacheKey)!;

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
      // console.log(`[SM Migration] Created stage "${stageName}" in pipeline ${pipelineId} → ${newStage!.id}`);
      return newStage!.id;
    }


    // ─── Helper: resolve principal pipeline from SM funnels ──
    // Use real SM funnel names as pipeline names (no canonical mapping)
    const FUNNEL_PRIORITY = ['LEAD', 'Engenharia', 'Equipamento', 'Compesação', 'Compensação', 'Pagamento'];

    async function resolvePipelinePrincipalDoFunil(
      allFunnels: any[] | null,
      tId: string,
      fallbackPipelineId: string,
      fallbackStageId: string | null,
      smFunnelName?: string | null,
      smStageName?: string | null,
    ): Promise<{ pipeline_id: string; stage_id: string | null; source: string }> {
      // Build effective funnels list: all_funnels + fallback from sm_funnel_name/sm_stage_name
      let effectiveFunnels = allFunnels || [];
      if (effectiveFunnels.length === 0 && smFunnelName) {
        effectiveFunnels = [{ funnelName: smFunnelName, stageName: smStageName || null }];
      }

      if (effectiveFunnels.length === 0) {
        return { pipeline_id: fallbackPipelineId, stage_id: fallbackStageId, source: "fallback_ui" };
      }

      // First pass: create/resolve only REAL pipelines from SM funnels.
      // "Vendedores" is used exclusively for owner resolution and must never become a real pipeline.
      for (const funnel of effectiveFunnels) {
        const fName = String(funnel.funnelName || "").trim();
        if (!fName || normalizeComparableName(fName) === "vendedores") continue;

        // Collect all known stage names for this funnel from effectiveFunnels entries with same funnelName
        const stagesForFunnel = effectiveFunnels
          .filter((f: any) => String(f.funnelName || "").trim() === fName && f.stageName)
          .map((f: any) => f.stageName as string);

        await resolveOrCreatePipeline(fName, stagesForFunnel);
      }

      // Second pass: find the principal pipeline by priority
      // Apply LEAD→Comercial mapping for cache lookup
      for (const funnelName of FUNNEL_PRIORITY) {
        const funnel = effectiveFunnels.find((f: any) => f.funnelName === funnelName);
        if (!funnel) continue;

        // Apply same LEAD→Comercial mapping used in resolveOrCreatePipeline
        const mappedName = funnelName === "LEAD" ? "Comercial" : funnelName;
        let pipelineId = pipelineCache.get(mappedName);
        if (!pipelineId) {
          // Should have been created in first pass, but try ilike lookup
          const { data: pipeline } = await adminClient
            .from("pipelines")
            .select("id")
            .eq("tenant_id", tId)
            .ilike("name", mappedName)
            .maybeSingle();
          if (pipeline) {
            pipelineId = pipeline.id;
            pipelineCache.set(mappedName, pipelineId);
          }
        }
        if (!pipelineId) continue;

        let stageId: string | null = null;
        if (funnel.stageName && !pipelineId.startsWith("AUTO_CREATE")) {
          const normalizedStageName = normalizeComparableName(funnel.stageName);
          const cacheKey = `${pipelineId}::${normalizedStageName}`;
          stageId = stageCache.get(cacheKey) || null;
          if (!stageId) {
            const { data: stages } = await adminClient
              .from("pipeline_stages")
              .select("id, name")
              .eq("tenant_id", tId)
              .eq("pipeline_id", pipelineId);
            const matchedStage = (stages || []).find((stage: any) => normalizeComparableName(stage.name) === normalizedStageName);
            if (matchedStage?.id) {
              stageId = matchedStage.id;
              stageCache.set(cacheKey, stageId);
            } else if (!dry_run) {
              stageId = await resolveOrCreateStage(pipelineId, funnel.stageName, 0);
            }
          }
        }

        return { pipeline_id: pipelineId, stage_id: stageId, source: `funil:${funnelName}` };
      }

      return { pipeline_id: fallbackPipelineId, stage_id: fallbackStageId, source: "fallback_ui" };
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

    // ─── 5b. Pre-fetch concessionárias for distribuidora matching ─
    const concMap = new Map<string, { id: string; nome: string }>();
    {
      const { data: concs } = await adminClient
        .from("concessionarias")
        .select("id, nome, sigla")
        .eq("tenant_id", tenantId);
      for (const c of concs || []) {
        const nomeNorm = (c.nome || "").toLowerCase().trim();
        const siglaNorm = (c.sigla || "").toLowerCase().trim();
        concMap.set(nomeNorm, { id: c.id, nome: c.nome });
        if (siglaNorm) concMap.set(siglaNorm, { id: c.id, nome: c.nome });
      }
    }

    // ─── 4b. Pre-create only REAL pipelines + stages from SM funnels ──
    // "Vendedores" is a consultor-resolution funnel and must not be materialized as pipeline.
    if (!dry_run) {
      const allFunnelStages = new Map<string, Set<string>>(); // funnelName → Set<stageName>
      for (const [, proj] of smProjectMap) {
        const funnels: any[] = proj.all_funnels || [];
        for (const f of funnels) {
          const fName = String(f.funnelName || "").trim();
          const sName = String(f.stageName || "").trim();
          if (!fName || normalizeComparableName(fName) === "vendedores") continue;
          if (!allFunnelStages.has(fName)) allFunnelStages.set(fName, new Set());
          if (sName) allFunnelStages.get(fName)!.add(sName);
        }
        // Fallback: use sm_funnel_name/sm_stage_name when all_funnels is empty
        if (funnels.length === 0 && proj.sm_funnel_name) {
          const fName = proj.sm_funnel_name.trim();
          if (fName && normalizeComparableName(fName) !== "vendedores") {
            if (!allFunnelStages.has(fName)) allFunnelStages.set(fName, new Set());
            if (proj.sm_stage_name?.trim()) allFunnelStages.get(fName)!.add(proj.sm_stage_name.trim());
          }
        }
      }

      let pipelinesCreated = 0;
      let stagesCreated = 0;
      for (const [funnelName, stages] of allFunnelStages) {
        try {
          const pipeId = await resolveOrCreatePipeline(funnelName);
          if (!pipeId.startsWith("AUTO_CREATE")) {
            pipelinesCreated++;
            let pos = 0;
            for (const stageName of stages) {
              try {
                await resolveOrCreateStage(pipeId, stageName, pos++);
                stagesCreated++;
              } catch (e) {
                console.warn(`[SM Migration] Pre-create stage "${stageName}" error: ${(e as Error).message}`);
              }
            }
          }
        } catch (e) {
          console.warn(`[SM Migration] Pre-create pipeline "${funnelName}" error: ${(e as Error).message}`);
        }
      }
      console.error(`[SM Migration] Pre-created ${pipelinesCreated} pipelines, ${stagesCreated} stages from SM funnels`);
    }

    // ─── 5a. Batch pre-fetch canonical entities for O(1) lookup ──
    // Pre-fetch ALL clientes for this tenant to avoid N+1 phone/email/doc lookups
    const allClientes: Array<{ id: string; telefone_normalized: string | null; email: string | null; cpf_cnpj: string | null; cliente_code: string; rua: string | null; cidade: string | null }> = [];
    {
      let cOffset = 0;
      while (true) {
        const { data: cPage } = await adminClient
          .from("clientes")
          .select("id, telefone_normalized, email, cpf_cnpj, cliente_code, rua, cidade")
          .eq("tenant_id", tenantId)
          .range(cOffset, cOffset + 999);
        allClientes.push(...(cPage || []));
        if ((cPage || []).length < 1000) break;
        cOffset += 1000;
      }
    }
    const clienteByPhone = new Map<string, { id: string; count: number }>();
    const clienteByEmail = new Map<string, string>();
    const clienteByDoc = new Map<string, string>();
    const clienteByCode = new Map<string, string>();
    const clienteAddressMap = new Map<string, { rua: string | null; cidade: string | null }>();
    for (const c of allClientes) {
      if (c.telefone_normalized) {
        const existing = clienteByPhone.get(c.telefone_normalized);
        if (existing) {
          existing.count++;
        } else {
          clienteByPhone.set(c.telefone_normalized, { id: c.id, count: 1 });
        }
      }
      if (c.email) clienteByEmail.set(c.email.trim().toLowerCase(), c.id);
      if (c.cpf_cnpj) clienteByDoc.set(c.cpf_cnpj, c.id);
      if (c.cliente_code) clienteByCode.set(c.cliente_code, c.id);
      clienteAddressMap.set(c.id, { rua: c.rua, cidade: c.cidade });
    }

    // Pre-fetch ALL projetos for lookup by codigo and deal_id
    const allProjetos: Array<{ id: string; codigo: string | null; deal_id: string | null }> = [];
    {
      let pOffset = 0;
      while (true) {
        const { data: pPage } = await adminClient
          .from("projetos")
          .select("id, codigo, deal_id")
          .eq("tenant_id", tenantId)
          .range(pOffset, pOffset + 999);
        allProjetos.push(...(pPage || []));
        if ((pPage || []).length < 1000) break;
        pOffset += 1000;
      }
    }
    const projetoByCodigo = new Map<string, string>();
    const projetoByDeal = new Map<string, string>();
    for (const p of allProjetos) {
      if (p.codigo) projetoByCodigo.set(p.codigo, p.id);
      if (p.deal_id) projetoByDeal.set(p.deal_id, p.id);
    }

    // Pre-fetch first stages of all pipelines for fallback
    const pipelineFirstStage = new Map<string, string>();
    {
      const { data: allStages } = await adminClient
        .from("pipeline_stages")
        .select("id, pipeline_id, position")
        .eq("tenant_id", tenantId)
        .order("position", { ascending: true });
      for (const s of allStages || []) {
        if (!pipelineFirstStage.has(s.pipeline_id)) {
          pipelineFirstStage.set(s.pipeline_id, s.id);
        }
      }
    }




    // Pre-fetch existing proposta_versoes for dedup
    const existingVersoes = new Set<string>();
    {
      let vOffset = 0;
      while (true) {
        const { data: vPage } = await adminClient
          .from("proposta_versoes")
          .select("proposta_id")
          .eq("tenant_id", tenantId)
          .eq("versao_numero", 1)
          .range(vOffset, vOffset + 999);
        for (const v of vPage || []) existingVersoes.add(v.proposta_id);
        if ((vPage || []).length < 1000) break;
        vOffset += 1000;
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
    console.error(`[SM Migration] Processing ${proposalsToProcess.length} of ${allProposals.length} proposals (batch_size=${batch_size})`);

    // Time budget: stop processing before edge function timeout (wall-clock ~60s)
    const MIGRATION_TIMEOUT_MS = 50_000;
    const migrationStartTime = Date.now();

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
      // console.log(`[SM Migration] Vendedor filter "${filters.vendedor_name}": ${beforeCount} → ${proposalsToProcess.length} proposals (${vendedorProjectIds.size} projects matched)`);
    }

    for (const smProp of proposalsToProcess) {
        // Check time budget before each proposal
        if (Date.now() - migrationStartTime > MIGRATION_TIMEOUT_MS) {
          console.error(`[SM Migration] Time budget exceeded (${MIGRATION_TIMEOUT_MS}ms). Stopping with partial results.`);
          break;
        }

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
              // if (smClient) console.log(`[SM Migration] Resolved client via project ${smProp.sm_project_id}: sm_client_id ${smProp.sm_client_id} → ${proj.sm_client_id}`);
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

          // ── B. Dedupe client by phone_normalized, email, or sm_id (multi-fallback) ──
          // Uses pre-fetched Maps for O(1) lookup instead of N+1 queries
          const phoneNorm = smClient.phone_normalized || normalizePhone(smClient.phone);
          let clienteId: string | null = null;

          // 1) Match by phone (using pre-fetched map)
          if (phoneNorm) {
            const phoneMatch = clienteByPhone.get(phoneNorm);
            if (phoneMatch) {
              if (phoneMatch.count > 1) {
                report.aborted = true;
                report.steps.cliente = {
                  status: "CONFLICT",
                  reason: `${phoneMatch.count} clients match phone ${phoneNorm}`,
                  matches: phoneMatch.count,
                };
                summary.CONFLICT++;
                reports.push(report);
                await logItem(adminClient, tenantId, smProp.sm_proposal_id, smClient.name, "CONFLICT", report, dry_run);
                continue;
              }
              clienteId = phoneMatch.id;
              report.steps.cliente = { status: "WOULD_LINK", id: clienteId, reason: "matched by phone" };
            }
          }

          // 2) Fallback: email exact match (using pre-fetched map)
          if (!clienteId && smClient.email) {
            const emailNorm = smClient.email.trim().toLowerCase();
            if (emailNorm) {
              const emailMatch = clienteByEmail.get(emailNorm);
              if (emailMatch) {
                clienteId = emailMatch;
                report.steps.cliente = { status: "WOULD_LINK", id: clienteId, reason: "matched by email" };
              }
            }
          }

          // 3) Fallback: cpf_cnpj exact match (using pre-fetched map)
          if (!clienteId && smClient.document) {
            const docNorm = smClient.document.replace(/\D/g, "");
            if (docNorm.length >= 11) {
              const docMatch = clienteByDoc.get(docNorm);
              if (docMatch) {
                clienteId = docMatch;
                report.steps.cliente = { status: "WOULD_LINK", id: clienteId, reason: "matched by cpf_cnpj" };
              }
            }
          }

          // 4) Fallback: sm_client_id in existing cliente_code pattern (using pre-fetched map)
          if (!clienteId) {
            const resolvedSmClientId = smClient.sm_client_id || smProp.sm_client_id;
            const codePattern = `SM-${resolvedSmClientId}-`;
            for (const [code, cId] of clienteByCode) {
              if (code.startsWith(codePattern)) {
                clienteId = cId;
                report.steps.cliente = { status: "WOULD_LINK", id: clienteId, reason: "matched by sm_client_code" };
                break;
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
              // FIX 1: Use project address as fallback when client has no address
              const smProjAddr = smProp.sm_project_id ? (() => {
                // Fetch from solar_market_projects pre-loaded data via smProjectMap is limited;
                // use smProp fields which come from solar_market_proposals (has cidade, estado)
                return {
                  address: null as string | null,
                  number: null as string | null,
                  neighborhood: null as string | null,
                  city: smProp.cidade || null,
                  state: smProp.estado || null,
                  zip_code: null as string | null,
                };
              })() : null;

              // Try insert, on conflict with cliente_code → link to existing
              const { data: newClient, error: insErr } = await adminClient
                .from("clientes")
                .insert({
                  origem: "imported",
                  tenant_id: tenantId,
                  nome: smClient.name || "SM Import",
                  telefone: smClient.phone_formatted || smClient.phone || `SM-${resolvedSmClientId}`,
                  telefone_normalized: phoneNorm,
                  email: smClient.email,
                  cpf_cnpj: smClient.document ? smClient.document.replace(/\D/g, "") : null,
                  cidade: smClient.city || smProjAddr?.city || null,
                  estado: smClient.state || smProjAddr?.state || null,
                  bairro: smClient.neighborhood || smProjAddr?.neighborhood || null,
                  rua: smClient.address || smProjAddr?.address || null,
                  numero: smClient.number || smProjAddr?.number || null,
                  complemento: smClient.complement,
                  cep: smClient.zip_code_formatted || smClient.zip_code || smProjAddr?.zip_code || null,
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
                } else if (insErr.message.includes("uq_clientes_tenant_telefone")) {
                  // Duplicate phone — reuse existing client (use limit(1) to handle multiple matches safely)
                  let existing: { id: string } | null = null;
                  // Try 1: match by telefone_normalized
                  if (phoneNorm) {
                    const { data: normMatch } = await adminClient
                      .from("clientes")
                      .select("id")
                      .eq("tenant_id", tenantId)
                      .eq("telefone_normalized", phoneNorm)
                      .limit(1);
                    if (normMatch?.[0]) existing = normMatch[0];
                  }
                  // Try 2: match by raw telefone field
                  if (!existing) {
                    const rawPhone = smClient.phone_formatted || smClient.phone;
                    if (rawPhone) {
                      const { data: rawMatch } = await adminClient
                        .from("clientes")
                        .select("id")
                        .eq("tenant_id", tenantId)
                        .eq("telefone", rawPhone)
                        .limit(1);
                      if (rawMatch?.[0]) existing = rawMatch[0];
                    }
                  }
                  // Try 3: match by digits-only normalization of the raw phone
                  if (!existing) {
                    const rawDigits = (smClient.phone || "").replace(/\D/g, "");
                    if (rawDigits.length >= 10) {
                      const { data: digitMatch } = await adminClient
                        .from("clientes")
                        .select("id")
                        .eq("tenant_id", tenantId)
                        .eq("telefone_normalized", rawDigits)
                        .limit(1);
                      if (digitMatch?.[0]) existing = digitMatch[0];
                    }
                  }
                  if (existing) {
                    clienteId = existing.id;
                    if (phoneNorm) clienteByPhone.set(phoneNorm, { id: clienteId, count: 1 });
                    report.steps.cliente = { status: "WOULD_LINK", id: clienteId, reason: "telefone já existia — vinculado ao cliente existente" };
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
                // Update local maps for future iterations
                if (phoneNorm) clienteByPhone.set(phoneNorm, { id: clienteId, count: 1 });
                if (smClient.email) clienteByEmail.set(smClient.email.trim().toLowerCase(), clienteId);
                const docNorm2 = smClient.document ? smClient.document.replace(/\D/g, "") : "";
                if (docNorm2.length >= 11) clienteByDoc.set(docNorm2, clienteId);
                clienteByCode.set(clienteCode, clienteId);
                clienteAddressMap.set(clienteId, { rua: smClient.address || null, cidade: smClient.city || smProp.cidade || null });
                report.steps.cliente = { status: "WOULD_CREATE", id: clienteId };
              }
            }

            // FIX 7: Update existing linked client if missing address (using pre-fetched map)
            if (clienteId && !dry_run && report.steps.cliente?.status === "WOULD_LINK") {
              const cachedAddr = clienteAddressMap.get(clienteId);
              if (cachedAddr && !cachedAddr.rua && !cachedAddr.cidade) {
                const updateAddr: Record<string, any> = {};
                if (smClient.address) updateAddr.rua = smClient.address;
                if (smClient.number) updateAddr.numero = smClient.number;
                if (smClient.neighborhood) updateAddr.bairro = smClient.neighborhood;
                if (smClient.city || smProp.cidade) updateAddr.cidade = smClient.city || smProp.cidade;
                if (smClient.state || smProp.estado) updateAddr.estado = smClient.state || smProp.estado;
                if (smClient.zip_code_formatted || smClient.zip_code) updateAddr.cep = smClient.zip_code_formatted || smClient.zip_code;
                if (Object.keys(updateAddr).length > 0) {
                  await adminClient.from("clientes").update(updateAddr).eq("id", clienteId);
                  // Update the local cache too
                  clienteAddressMap.set(clienteId, { rua: updateAddr.rua || cachedAddr.rua, cidade: updateAddr.cidade || cachedAddr.cidade });
                }
              }
            }
          }

          // ── B2. Resolve owner_id ──
          // Priority: 1) DB cached funnel data "Vendedores" (fast, no external call)
          //           2) SM API funnel "Vendedores" (live fetch, only if DB empty)
          //           3) Fallback → Escritório (projetos sem consultor definido)
          // NOTE: responsible.name removido da cadeia — causava atribuição errada
          //       (Bruno era o responsible padrão no SM, inflava seus deals)
          let resolvedOwnerId = params.owner_id || null;
          let ownerAutoCreated = false;
          let ownerSource = resolvedOwnerId ? "manual_fallback" : "none";

          if (autoResolveOwner && smProp.sm_project_id) {
            const smProj = smProjectMap.get(smProp.sm_project_id);

            // Priority 1: DB cached funnel data (fast, no external call)
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

            // Priority 2: Live fetch from SM API — only if DB cache empty
            if (!resolvedOwnerId || ownerSource.startsWith("manual")) {
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
            }
          }

          // If still no owner, fallback to "Escritório" consultor
          if (!resolvedOwnerId) {
            try {
              const { id, created } = await resolveOrCreateConsultor("Escritório");
              resolvedOwnerId = id;
              ownerAutoCreated = ownerAutoCreated || created;
              ownerSource = "fallback_escritorio";
              (report as any).owner_resolved = { name: "Escritório", id, created, source: "fallback_escritorio" };
            } catch (e) {
              report.aborted = true;
              report.steps.deal = { status: "ERROR", reason: (e as Error).message || "Falha ao resolver consultor 'Não Definido'" };
              summary.ERROR++;
              reports.push(report);
              await logItem(adminClient, tenantId, smProp.sm_proposal_id, smClient.name, "ERROR", report, dry_run);
              continue;
            }
          }

          // ── C. Deal (idempotent via legacy_key) ──
          const legacyKey = `sm:${smProp.sm_project_id || 0}:${smProp.sm_proposal_id}`;
          let dealId: string | null = existingDeals.get(legacyKey) || null;

          // Resolve pipeline from SM funnels (auto) or fallback to UI selection
          const smProjForPipeline = smProp.sm_project_id ? smProjectMap.get(smProp.sm_project_id) : null;
          const resolved = await resolvePipelinePrincipalDoFunil(
            smProjForPipeline?.all_funnels || null,
            tenantId,
            params.pipeline_id!,
            params.stage_id || null,
            smProjForPipeline?.sm_funnel_name || null,
            smProjForPipeline?.sm_stage_name || null,
          );

          // Fallback: if stage_id is null or source is fallback_ui, resolve from SM proposal status
          // This handles projects that only have "Vendedores" funnel (no LEAD/Engenharia/etc.)
          if (!resolved.stage_id || resolved.source === "fallback_ui") {
            // Map SM proposal status → native Comercial stage
            const smStatus = (smProp.status || "").toLowerCase();
            const statusStageMap: Record<string, string> = {
              // SM status → native stage name for lookup
              "approved": "Ganho",
              "generated": "Proposta Enviada",
              "sent": "Proposta Enviada",
              "viewed": "Proposta Enviada",
              "created": "Qualificação",
            };
            const targetStageName = statusStageMap[smStatus];
            if (targetStageName) {
              // Look up the stage in the resolved pipeline
              const normalizedTarget = normalizeComparableName(targetStageName);
              const cacheKey = `${resolved.pipeline_id}::${normalizedTarget}`;
              let mappedStageId = stageCache.get(cacheKey) || null;
              if (!mappedStageId) {
                const { data: stages } = await adminClient
                  .from("pipeline_stages")
                  .select("id, name")
                  .eq("tenant_id", tenantId)
                  .eq("pipeline_id", resolved.pipeline_id);
                const match = (stages || []).find((s: any) => normalizeComparableName(s.name) === normalizedTarget);
                if (match?.id) {
                  mappedStageId = match.id;
                  stageCache.set(cacheKey, mappedStageId);
                }
              }
              if (mappedStageId) {
                resolved.stage_id = mappedStageId;
                resolved.source = `sm_status:${smStatus}→${targetStageName}`;
              }
            }
            // Final fallback: first stage of the pipeline
            if (!resolved.stage_id) {
              const firstStage = pipelineFirstStage.get(resolved.pipeline_id);
              if (firstStage) {
                resolved.stage_id = firstStage;
              }
            }
          }
          if (dealId) {
            report.steps.deal = { status: "WOULD_SKIP", id: dealId };
            // Ensure deal_pipeline_stages exists for previously migrated deals
            if (!dry_run && resolved.pipeline_id && resolved.stage_id) {
              await adminClient
                .from("deal_pipeline_stages")
                .upsert({
                  deal_id: dealId,
                  pipeline_id: resolved.pipeline_id,
                  stage_id: resolved.stage_id,
                  tenant_id: tenantId,
                }, { onConflict: "deal_id,pipeline_id" })
                .then(({ error }) => { if (error) console.warn(`[SM Migration] Backfill deal_pipeline_stages: ${error.message}`); });
            }
          } else {
            if (dry_run) {
              report.steps.deal = { status: "WOULD_CREATE", reason: `owner: ${ownerSource}${ownerAutoCreated ? " (criar)" : ""}, pipeline: ${resolved.source}` };
            } else {
              // Resolve original SM date for created_at
              const smOriginalDate = smProp.sm_created_at || smProp.generated_at || smProp.send_at || null;
              const dealInsert: Record<string, any> = {
                  origem: "imported",
                  tenant_id: tenantId,
                  pipeline_id: resolved.pipeline_id,
                  stage_id: resolved.stage_id,
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
              report.steps.deal = { status: "WOULD_CREATE", id: dealId, reason: `pipeline: ${resolved.source}` };

              // Insert primary pipeline into deal_pipeline_stages so UI shows it
              if (resolved.pipeline_id && resolved.stage_id) {
                const { error: dpsPrimaryErr } = await adminClient
                  .from("deal_pipeline_stages")
                  .upsert({
                    deal_id: dealId,
                    pipeline_id: resolved.pipeline_id,
                    stage_id: resolved.stage_id,
                    tenant_id: tenantId,
                  }, { onConflict: "deal_id,pipeline_id" });
                if (dpsPrimaryErr) {
                  console.warn(`[SM Migration] Primary deal_pipeline_stages error: ${dpsPrimaryErr.message}`);
                }
              }
            }
          }

          // ── C2. Assign Deal to every REAL SM pipeline membership ──
          if (dealId && smProp.sm_project_id) {
            const smProj = smProjectMap.get(smProp.sm_project_id);
            const funnels: any[] = smProj?.all_funnels || [];
            const validFunnels = funnels.filter((f: any) => {
              const funnelName = String(f.funnelName || "").trim();
              return funnelName && normalizeComparableName(funnelName) !== "vendedores" && f.stageName;
            });

            if (validFunnels.length > 0) {
              const funnelStageGroups = new Map<string, string[]>();
              for (const funnel of validFunnels) {
                const funnelName = String(funnel.funnelName || "").trim();
                const stageName = String(funnel.stageName || "").trim();
                if (!funnelName || !stageName) continue;
                const stages = funnelStageGroups.get(funnelName) || [];
                if (!stages.includes(stageName)) stages.push(stageName);
                funnelStageGroups.set(funnelName, stages);
              }

              const pipelineDetails: Array<{ funnel: string; stage: string; pipeline_id?: string; stage_id?: string }> = [];

              for (const [funnelName, stageNames] of funnelStageGroups) {
                try {
                  const pipeId = await resolveOrCreatePipeline(funnelName, stageNames);
                  const stageName = stageNames[0];
                  const stgId = await resolveOrCreateStage(pipeId, stageName, 0);
                  pipelineDetails.push({ funnel: funnelName, stage: stageName, pipeline_id: pipeId, stage_id: stgId });

                  if (!dry_run && !pipeId.startsWith("AUTO_CREATE") && !stgId.startsWith("AUTO_CREATE")) {
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
                  pipelineDetails.push({ funnel: funnelName, stage: stageNames[0] || "" });
                  console.warn(`[SM Migration] Pipeline resolution error for "${funnelName}/${stageNames[0] || ""}": ${(e as Error).message}`);
                }
              }

              report.steps.pipelines = {
                status: dry_run ? "WOULD_CREATE" : "WOULD_CREATE",
                reason: `${pipelineDetails.length} funis mapeados`,
                details: pipelineDetails,
              };
            } else {
              report.steps.pipelines = { status: "WOULD_SKIP", reason: "Nenhum funil real com etapa encontrado" };
            }
          }

          // ── D. Projeto ──
          let projetoId: string | null = null;
          const projetoCodigo = `PROJ-SM-${smProp.sm_project_id || smProp.sm_proposal_id}`;

          if (dealId && !dry_run) {
            // Priority 1: Check if projeto already exists by codigo (using pre-fetched map)
            const existingByCodigoId = projetoByCodigo.get(projetoCodigo);
            if (existingByCodigoId) {
              projetoId = existingByCodigoId;
              report.steps.projeto = { status: "WOULD_LINK", id: projetoId, reason: "matched by codigo" };
            } else {
              // Priority 2: Check by deal_id (using pre-fetched map)
              const existingByDealId = projetoByDeal.get(dealId);
              if (existingByDealId) {
                projetoId = existingByDealId;
                report.steps.projeto = { status: "WOULD_LINK", id: projetoId, reason: "matched by deal_id" };
              } else {
                const smProjDate = smProp.sm_created_at || smProp.generated_at || null;


                const projInsert: Record<string, any> = {
                    origem: "imported",
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
                    codigo: projetoCodigo,
                    projeto_num: null,
                    is_principal: false, // avoid unique constraint on is_principal per cliente


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
                  // If unique constraint on codigo, fetch existing
                  if (projErr.message.includes("uq_projetos_tenant_codigo")) {
                    const { data: existingByCode } = await adminClient
                      .from("projetos")
                      .select("id")
                      .eq("tenant_id", tenantId)
                      .eq("codigo", projetoCodigo)
                      .maybeSingle();
                    if (existingByCode) {
                      projetoId = existingByCode.id;
                      report.steps.projeto = { status: "WOULD_LINK", id: projetoId, reason: "codigo conflict resolved" };
                    } else {
                      report.steps.projeto = { status: "ERROR", reason: projErr.message };
                    }
                  } else if (projErr.message.includes("idx_projetos_unique_principal_per_cliente")) {
                    // Retry with is_principal = false
                    projInsert.is_principal = false;
                    const { data: retryProj, error: retryErr } = await adminClient
                      .from("projetos")
                      .insert(projInsert)
                      .select("id")
                      .single();
                    if (retryErr) {
                      report.steps.projeto = { status: "ERROR", reason: retryErr.message };
                    } else {
                      projetoId = retryProj!.id;
                      report.steps.projeto = { status: "WOULD_CREATE", id: projetoId };
                    }
                  } else {
                    report.steps.projeto = { status: "ERROR", reason: projErr.message };
                  }
                } else {
                  projetoId = newProj!.id;
                  projetoByCodigo.set(projetoCodigo, projetoId);
                  projetoByDeal.set(dealId, projetoId);
                  report.steps.projeto = { status: "WOULD_CREATE", id: projetoId };
                }
              }
            }

            // Link projeto_id to deal (backfill for new or existing deals)
            if (projetoId && dealId) {
              await adminClient
                .from("deals")
                .update({ projeto_id: projetoId })
                .eq("id", dealId)
                .is("projeto_id", null);
            }
          } else {
            report.steps.projeto = { status: dry_run ? "WOULD_CREATE" : "ERROR", reason: dry_run ? undefined : "no deal_id" };
          }

          // ── E. Proposta Nativa ──
          const smIdKey = `${smProp.sm_project_id || 0}:${smProp.sm_proposal_id}`;
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
                  codigo: `PROP-SM-${smProp.sm_project_id || 0}-${smProp.sm_proposal_id}`,
                  is_principal: report.steps.projeto?.status === "WOULD_CREATE", // only first proposal of a project is principal
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
            // Check if version already exists (using pre-fetched Set)
            if (existingVersoes.has(propostaId)) {
              report.steps.proposta_versao = { status: "WOULD_SKIP" };
            } else {
              const paybackMeses = parsePaybackMonths(smProp.payback);
              const valorTotal = smProp.preco_total || smProp.valor_total || 0;

              // Resolve custo_instalacao with fallbacks
              let custoInstalacao = smProp.installation_cost || 0;
              if (!custoInstalacao && smProp.custom_fields_raw?.values) {
                const cfVals = smProp.custom_fields_raw.values as Record<string, any>;
                for (const [, entry] of Object.entries(cfVals)) {
                  const key = String(entry?.key || entry?.label || "").toLowerCase();
                  if (key.includes("instalac") || key.includes("mão de obra") || key.includes("mao de obra")) {
                    const val = Number(entry?.value ?? entry?.raw_value ?? 0);
                    if (val > 0) { custoInstalacao = val; break; }
                  }
                }
              }

              // FIX 2: Build canonical itens with potencia_w + fabricante extracted from model name
              // Use raw_payload pricingTable for real costs (KIT item has the actual cost when Módulo/Inversor = 0)
              const rawPricingTable = Array.isArray(smProp.raw_payload?.pricingTable) ? smProp.raw_payload.pricingTable : [];
              const kitPricingItem = rawPricingTable.find((i: any) => i.category === "KIT" || i.category === "Kit");
              const custoKitReal = kitPricingItem && Number(kitPricingItem.totalCost || kitPricingItem.salesValue) > 0
                ? Number(kitPricingItem.totalCost || kitPricingItem.salesValue)
                : Number(smProp.equipment_cost ?? 0);

              // Build venda object for snapshot — calculate real margin
              const custoTotal = (smProp.equipment_cost || 0) + custoInstalacao;
              const margemReal = custoTotal > 0
                ? ((valorTotal / custoTotal) - 1) * 100
                : 0;
              const vendaSnapshot = {
                custo_kit: custoKitReal,
                custo_instalacao: custoInstalacao,
                custo_comissao: 0,
                custo_outros: 0,
                margem_percentual: Math.round(margemReal * 100) / 100,
                desconto_percentual: smProp.discount || 0,
                observacoes: "",
              };

              // Build pagamentoOpcoes in canonical schema
              // Infer payment type from SM payment_conditions text
              function inferTipoPagamento(cond: string | null | undefined): "a_vista" | "financiamento" | "entrada" {
                if (!cond) return "a_vista";
                const c = cond.toLowerCase();
                if (/financiamento|parcela|\d+x/.test(c)) return "financiamento";
                if (/entrada/.test(c)) return "entrada";
                return "a_vista";
              }

              const pagamentoOpcoes = [{
                id: crypto.randomUUID(),
                nome: smProp.payment_conditions || "À Vista",
                label: smProp.payment_conditions || "À Vista",
                tipo: inferTipoPagamento(smProp.payment_conditions),
                valor_financiado: valorTotal,
                entrada: 0,
                taxa_mensal: 0,
                carencia_meses: 0,
                num_parcelas: 1,
                parcelas: 1,
                valor_parcela: valorTotal,
                is_default: true,
              }];

              const panelPotencia = extractPotenciaFromModel(smProp.panel_model);
              const inverterPotencia = extractPotenciaFromModel(smProp.inverter_model);

              const itensCanonicos: Record<string, any>[] = [];
              if (smProp.panel_model) {
                const panelQty = Number(smProp.panel_quantity ?? 0);
                itensCanonicos.push({
                  categoria: "modulo",
                  descricao: smProp.panel_model,
                  fabricante: smProp.modulo_fabricante || extractFabricante(smProp.panel_model),
                  modelo: smProp.panel_model,
                  potencia_w: smProp.modulo_potencia_w || panelPotencia,
                  quantidade: panelQty,
                  preco_unitario: panelQty > 0 && custoKitReal > 0
                    ? custoKitReal / panelQty
                    : 0,
                });
              }
              if (smProp.inverter_model) {
                itensCanonicos.push({
                  categoria: "inversor",
                  descricao: smProp.inverter_model,
                  fabricante: smProp.inversor_fabricante || extractFabricante(smProp.inverter_model),
                  modelo: smProp.inverter_model,
                  potencia_w: smProp.inversor_potencia_w || inverterPotencia,
                  quantidade: Number(smProp.inverter_quantity ?? 1),
                  preco_unitario: 0,
                });
              }

              // Build canonical servicos array
              const servicosCanonicos: Record<string, any>[] = [];
              if (custoInstalacao > 0) {
                servicosCanonicos.push({
                  descricao: "Instalação",
                  categoria: "instalacao",
                  valor: custoInstalacao,
                  incluso_no_preco: true,
                });
              }

              // FIX 6: payback as number
              const paybackNumerico = typeof paybackMeses === "number" ? paybackMeses : 0;

              // Build projectAddress for wizard location step
              const projectAddress = {
                cep: (smClient?.zip_code_formatted || smClient?.zip_code) ?? "",
                rua: smClient?.address ?? "",
                numero: smClient?.number ?? "",
                bairro: smClient?.neighborhood ?? "",
                cidade: smClient?.city ?? smProp.cidade ?? "",
                uf: smClient?.state ?? smProp.estado ?? "",
                complemento: smClient?.complement ?? "",
                lat: null as number | null,
                lon: null as number | null,
              };

              // Resolve concessionária ID from SM dis_energia name
              let resolvedConcId: string | null = null;
              let resolvedConcNome = smProp.dis_energia || "";
              if (resolvedConcNome) {
                const disNorm = resolvedConcNome.toLowerCase().trim();
                const exact = concMap.get(disNorm);
                if (exact) {
                  resolvedConcId = exact.id;
                  resolvedConcNome = exact.nome;
                } else {
                  // Fuzzy: check if any concessionária name contains the SM name or vice-versa
                  for (const [key, val] of concMap) {
                    if (key.includes(disNorm) || disNorm.includes(key)) {
                      resolvedConcId = val.id;
                      resolvedConcNome = val.nome;
                      break;
                    }
                  }
                }
              }

              const finalSnapshot: Record<string, any> = {
                source: "legacy_import",
                // Canonical WizardState nodes
                potenciaKwp: Number(smProp.potencia_kwp ?? 0),
                geracaoMensalEstimada: smProp.geracao_anual ? Math.round(Number(smProp.geracao_anual) / 12) : 0,
                locCidade: smProp.cidade || smClient?.city || "",
                locEstado: smProp.estado || smClient?.state || "",
                locTipoTelhado: smProp.roof_type || "",
                locDistribuidoraNome: resolvedConcNome,
                locDistribuidoraId: resolvedConcId,
                // Project address for wizard editing
                projectAddress,
                cliente: {
                  nome: smClient?.name ?? "",
                  cpf_cnpj: smClient?.document ? smClient.document.replace(/\D/g, "") : "",
                  email: smClient?.email ?? "",
                  telefone: (smClient?.phone_formatted || smClient?.phone) ?? "",
                  empresa: smClient?.company ?? "",
                  cidade: smClient?.city ?? smProp.cidade ?? "",
                  estado: smClient?.state ?? smProp.estado ?? "",
                  bairro: smClient?.neighborhood ?? "",
                  rua: smClient?.address ?? "",
                  numero: smClient?.number ?? "",
                  complemento: smClient?.complement ?? "",
                  cep: (smClient?.zip_code_formatted || smClient?.zip_code) ?? "",
                },
                // FIX 3: inputs block for wizard re-editing
                inputs: {
                  projeto_id: projetoId || null,
                  cliente_id: clienteId || null,
                  lead_id: null,
                  template_id: null,
                  sm_import: true,
                },
                tecnico: {
                  potencia_kwp: Number(smProp.potencia_kwp ?? 0),
                  geracao_estimada_kwh: smProp.geracao_anual ? Number(smProp.geracao_anual) : 0,
                  geracao_mensal_media_kwh: smProp.geracao_anual ? Math.round(Number(smProp.geracao_anual) / 12) : 0,
                  consumo_total_kwh: Number(smProp.consumo_mensal ?? 0),
                  numero_modulos: Number(smProp.panel_quantity ?? 0),
                  potencia_modulo_w: smProp.modulo_potencia_w || panelPotencia,
                  area_m2: smProp.area_util ?? 0,
                  irradiacao_media: smProp.irradiacao_media ?? 0,
                },
                itens: itensCanonicos,
                servicos: servicosCanonicos,
                // FIX 5+6: UCs fully compatible with wizard field names
                ucs: [buildWizardUC(smProp, resolvedConcId)],
                // Pre-dimensioning data from SM
                preDimensionamento: {
                  inclinacao: smProp.inclinacao ?? 20,
                  desvio_azimutal: smProp.desvio_azimutal ?? 0,
                  fator_geracao: smProp.fator_geracao ?? 0,
                  taxa_desempenho: smProp.taxa_desempenho ?? 0.75,
                  sobredimensionamento: smProp.sobredimensionamento ?? 0,
                  topologia: smProp.topologia ?? "Tradicional",
                  tipo_telhado: smProp.roof_type ?? "",
                },
                premissas: {
                  inflacao_energetica: Number(smProp.inflacao_energetica ?? 0),
                  perda_eficiencia_anual: Number(smProp.perda_eficiencia_anual ?? 0),
                  sobredimensionamento: Number(smProp.sobredimensionamento ?? 0),
                  custo_disponibilidade: Number(smProp.custo_disponibilidade ?? 0),
                  geracao_anual: Number(smProp.geracao_anual ?? 0),
                },
                // Financial series for charts
                financeiro: {
                  fluxo_caixa_acumulado: smProp.fluxo_caixa_acumulado || [],
                  economia_anual_serie: smProp.economia_anual_serie || [],
                  payback_meses: paybackNumerico,
                  tir: smProp.tir || 0,
                  vpl: smProp.vpl || 0,
                  economia_mensal: smProp.economia_mensal || 0,
                },
                series: {
                  geracao_mensal: smProp.geracao_mensal_serie || [],
                  irradiacao_mensal: smProp.irradiacao_mensal_serie || [],
                },
                demanda: {
                  contratada: smProp.demanda_contratada || null,
                  preco: smProp.demanda_preco || null,
                  adicional: smProp.demanda_adicional || null,
                  outros_encargos: smProp.outros_encargos || null,
                },
                // Legacy flat fields (preserved for backward compat)
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
                payback_meses: paybackNumerico,
                valor_total: smProp.preco_total || smProp.valor_total || 0,
                geracao_mensal: smProp.geracao_anual ? Math.round(Number(smProp.geracao_anual) / 12) : 0,
                economia_mensal: smProp.economia_mensal || 0,
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
                venda: vendaSnapshot,
                pagamentoOpcoes,
              };

              // P1: Inject customFieldValues from custom_fields_raw into snapshot
              if (smProp.custom_fields_raw?.values) {
                const cfVals = smProp.custom_fields_raw.values as Record<string, any>;
                const customFieldValues: Record<string, string> = {};
                for (const [key, entry] of Object.entries(cfVals)) {
                  const bareKey = normalizeCfKey(key);
                  const val = (entry as any)?.value ?? (entry as any)?.raw_value ?? "";
                  if (val !== "" && val != null) {
                    customFieldValues[bareKey] = String(val);
                  }
                }
                if (Object.keys(customFieldValues).length > 0) {
                  finalSnapshot.customFieldValues = customFieldValues;
                }
              }

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
                report.aborted = true;
                summary.ERROR++;
                reports.push(report);
                await logItem(adminClient, tenantId, smProp.sm_proposal_id, report.sm_client_name, "ERROR", report, dry_run);
                continue;
              } else {
                report.steps.proposta_versao = { status: "WOULD_CREATE", id: newVer!.id };
              }
            }
          } else if (dry_run) {
            report.steps.proposta_versao = { status: "WOULD_CREATE" };
          }

          // ── G. Apply Custom Field Mappings to canonical entities ──
          // WHITELIST: only these real columns can be written via target_path
          const CLIENT_COLUMN_WHITELIST = new Set([
            "observacoes", "localizacao", "empresa", "email",
            "bairro", "cidade", "estado", "cep", "rua", "numero", "complemento",
          ]);
          const PROJECT_COLUMN_WHITELIST = new Set([
            "observacoes", "tipo_instalacao", "cidade_instalacao", "uf_instalacao",
            "bairro_instalacao", "rua_instalacao", "cep_instalacao",
          ]);

          if (!dry_run && smProp.custom_fields_raw?.values && cfMappings.size > 0) {
            const cfValues = smProp.custom_fields_raw.values as Record<string, any>;
            const clientUpdates: Record<string, any> = {};
            const projetoUpdates: Record<string, any> = {};
            const mappedCf: Record<string, any> = {};
            const unmappedCf: Record<string, any> = {};
            const transformErrors: Record<string, string> = {};

            for (const [key, entry] of Object.entries(cfValues)) {
              // Normalize key for mapping lookup (bare key without brackets)
              const bareKey = normalizeCfKey(key);
              const mapping = cfMappings.get(bareKey);
              if (!mapping) {
                unmappedCf[bareKey] = entry;
                continue;
              }

              let transformed: any;
              try {
                transformed = applyTransform(entry.value ?? entry.raw_value, mapping.transform);
              } catch (e) {
                transformErrors[bareKey] = (e as Error).message;
                unmappedCf[bareKey] = entry;
                continue;
              }

              const targetCol = mapping.target_path;

              switch (mapping.target_namespace) {
                case "client":
                  if (targetCol && clienteId && CLIENT_COLUMN_WHITELIST.has(targetCol)) {
                    clientUpdates[targetCol] = transformed;
                  }
                  mappedCf[bareKey] = { ...entry, mapped_to: `client.${targetCol}`, transformed_value: transformed };
                  break;
                case "project":
                  if (targetCol && projetoId && PROJECT_COLUMN_WHITELIST.has(targetCol)) {
                    projetoUpdates[targetCol] = transformed;
                  }
                  mappedCf[bareKey] = { ...entry, mapped_to: `project.${targetCol}`, transformed_value: transformed };
                  break;
                case "proposal":
                case "finance":
                case "tags":
                case "metadata":
                  mappedCf[bareKey] = { ...entry, mapped_to: `${mapping.target_namespace}.${targetCol}`, transformed_value: transformed };
                  break;
              }
            }

            // Apply whitelisted client column updates
            if (Object.keys(clientUpdates).length > 0 && clienteId) {
              const { error: cuErr } = await adminClient.from("clientes").update(clientUpdates).eq("id", clienteId);
              if (cuErr) console.warn(`[SM Migration] Client CF update error: ${cuErr.message}`);
            }
            // Apply whitelisted project column updates
            if (Object.keys(projetoUpdates).length > 0 && projetoId) {
              const { error: puErr } = await adminClient.from("projetos").update(projetoUpdates).eq("id", projetoId);
              if (puErr) console.warn(`[SM Migration] Project CF update error: ${puErr.message}`);
            }

            // Persist metadata on propostas_nativas (SAFE: dedicated metadata column)
            if (propostaId && (Object.keys(mappedCf).length > 0 || Object.keys(unmappedCf).length > 0)) {
              const metaPayload: Record<string, any> = {};
              if (Object.keys(mappedCf).length > 0) metaPayload.custom_fields_mapped = mappedCf;
              if (Object.keys(unmappedCf).length > 0) metaPayload.custom_fields_unmapped = unmappedCf;
              if (Object.keys(transformErrors).length > 0) metaPayload.custom_fields_transform_errors = transformErrors;

              // SAFE MERGE: read existing metadata, spread old + new
              const { data: existingProp } = await adminClient
                .from("propostas_nativas")
                .select("metadata")
                .eq("id", propostaId)
                .maybeSingle();
              const existingMeta = (existingProp?.metadata as Record<string, any>) || {};
              const mergedMeta = { ...existingMeta, ...metaPayload };

              await adminClient
                .from("propostas_nativas")
                .update({ metadata: mergedMeta })
                .eq("id", propostaId);

              // SAFE MERGE into final_snapshot (read-then-merge, never overwrite)
              const { data: existingVer } = await adminClient
                .from("proposta_versoes")
                .select("id, final_snapshot")
                .eq("proposta_id", propostaId)
                .eq("versao_numero", 1)
                .maybeSingle();

              if (existingVer) {
                const currentSnapshot = (existingVer.final_snapshot as Record<string, any>) || {};
                const existingCfMeta = (currentSnapshot.custom_field_metadata as Record<string, any>) || {};
                const mergedSnapshot = {
                  ...currentSnapshot,
                  custom_field_metadata: { ...existingCfMeta, ...metaPayload },
                };
                await adminClient
                  .from("proposta_versoes")
                  .update({ final_snapshot: mergedSnapshot })
                  .eq("id", existingVer.id);
              }
            }

            (report as any).custom_fields_applied = {
              mapped: Object.keys(mappedCf).length,
              client_cols_written: Object.keys(clientUpdates).length,
              project_cols_written: Object.keys(projetoUpdates).length,
              unmapped: Object.keys(unmappedCf).length,
              transform_errors: Object.keys(transformErrors).length,
            };
          }

          // Determine overall status for logging
          const allSteps = Object.values(report.steps);
          const hasError = allSteps.some((s) => s.status === "ERROR");
          const allSkip = allSteps.every((s) => s.status === "WOULD_SKIP");
          const overallStatus = hasError ? "ERROR" : allSkip ? "SKIP" : "SUCCESS";

          if (!dry_run) {
            summary[overallStatus === "SKIP" ? "WOULD_SKIP" : overallStatus === "SUCCESS" ? "SUCCESS" : "ERROR"]++;

            const propostaStepOk = ["WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP", "SUCCESS"].includes(report.steps.proposta_nativa?.status || "");
            const versaoStepOk = ["WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP", "SUCCESS"].includes(report.steps.proposta_versao?.status || "");

            // Stamp migrado_em only when canonical proposal + version are actually available
            if (overallStatus === "SUCCESS" && propostaId && propostaStepOk && versaoStepOk) {
              await adminClient
                .from("solar_market_proposals")
                .update({ migrado_em: new Date().toISOString() })
                .eq("id", smProp.id);
            }
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

    // ─── GROUP B: Projects without active proposal ──────────
    // Default to false — Group B is opt-in only. Skip entirely if time budget exceeded.
    const includeProjectsWithoutProposal = params.include_projects_without_proposal === true;
    const groupBReports: any[] = [];
    const timeBudgetAlreadyExceeded = Date.now() - migrationStartTime > MIGRATION_TIMEOUT_MS;

    if (includeProjectsWithoutProposal && !timeBudgetAlreadyExceeded) {
      const { data: projectsWithoutProposal } = await adminClient
        .from("solar_market_projects")
        .select("id, sm_project_id, sm_client_id, name, potencia_kwp, status, valor, city, state, address, neighborhood, zip_code, number, complement, installation_type, sm_funnel_name, sm_stage_name, all_funnels, tenant_id, sm_created_at, responsible")
        .eq("tenant_id", tenantId)
        .eq("has_active_proposal", false);

      const pwp = projectsWithoutProposal || [];
      // console.log(`[SM Migration] Group B: ${pwp.length} projects without active proposal`);

      for (const proj of pwp) {
        // Time budget check inside Group B loop
        if (Date.now() - migrationStartTime > MIGRATION_TIMEOUT_MS) {
          console.warn(`[SM Migration] Group B time budget exceeded, stopping early`);
          break;
        }
        const groupBReport: any = {
          sm_project_id: proj.sm_project_id,
          sm_client_name: null,
          aborted: false,
          steps: {},
          warnings: ["Projeto sem proposta ativa no SolarMarket"],
          group: "B",
        };

        try {
          // Check if project already migrated
          const { data: existingProjCanonical } = await adminClient
            .from("projetos")
            .select("id")
            .eq("tenant_id", tenantId)
            .contains("source_metadata", { sm_project_id: proj.sm_project_id })
            .maybeSingle();

          if (existingProjCanonical) {
            groupBReport.steps.projeto = { status: "WOULD_SKIP", id: existingProjCanonical.id, reason: "já migrado" };
            groupBReports.push(groupBReport);
            summary.WOULD_SKIP = (summary.WOULD_SKIP || 0) + 1;
            continue;
          }

          // Resolve client
          let smClient = proj.sm_client_id ? smClientMap.get(proj.sm_client_id) : null;
          if (!smClient && proj.sm_client_id) {
            const { data: clients } = await adminClient
              .from("solar_market_clients")
              .select("sm_client_id, name, email, phone, phone_formatted, phone_normalized, document, document_formatted, city, state, neighborhood, address, number, complement, zip_code, zip_code_formatted, company")
              .eq("tenant_id", tenantId)
              .eq("sm_client_id", proj.sm_client_id)
              .limit(1);
            if (clients?.[0]) smClient = clients[0];
          }

          groupBReport.sm_client_name = smClient?.name || proj.name || null;

          // Resolve or create canonical client (same logic as Group A)
          let clienteId: string | null = null;

          if (smClient) {
            const phoneNorm = smClient.phone_normalized || normalizePhone(smClient.phone);
            // Match using pre-fetched Maps (same pattern as Group A — no N+1 queries)
            if (phoneNorm) {
              const phoneMatch = clienteByPhone.get(phoneNorm);
              if (phoneMatch && phoneMatch.count === 1) clienteId = phoneMatch.id;
            }
            if (!clienteId && smClient.email) {
              const emailNorm = smClient.email.trim().toLowerCase();
              if (emailNorm) {
                const emailMatch = clienteByEmail.get(emailNorm);
                if (emailMatch) clienteId = emailMatch;
              }
            }
            if (!clienteId && smClient.document) {
              const docNorm = smClient.document.replace(/\D/g, "");
              if (docNorm.length >= 11) {
                const docMatch = clienteByDoc.get(docNorm);
                if (docMatch) clienteId = docMatch;
              }
            }
            if (!clienteId) {
              const resolvedSmClientId = smClient.sm_client_id || 0;
              const codePattern = `SM-${resolvedSmClientId}-`;
              for (const [code, cId] of clienteByCode) {
                if (code.startsWith(codePattern)) {
                  clienteId = cId;
                  break;
                }
              }
            }

            // Create client if needed
            if (!clienteId && !dry_run) {
              const clienteCode = `SM-${smClient.sm_client_id}-${proj.sm_project_id || 0}`;
              const phoneNorm2 = smClient.phone_normalized || normalizePhone(smClient.phone);
              const { data: newClient, error: insErr } = await adminClient
                .from("clientes")
                .insert({
                  origem: "imported",
                  tenant_id: tenantId,
                  nome: smClient.name || "SM Import",
                  telefone: smClient.phone_formatted || smClient.phone || `SM-${smClient.sm_client_id}`,
                  telefone_normalized: phoneNorm2,
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
                  potencia_kwp: proj.potencia_kwp || null,
                })
                .select("id")
                .single();
              if (!insErr && newClient) {
                clienteId = newClient.id;
                groupBReport.steps.cliente = { status: "WOULD_CREATE", id: clienteId };
              } else if (insErr?.message?.includes("uq_clientes_tenant_cliente_code")) {
                const { data: existing } = await adminClient.from("clientes").select("id").eq("tenant_id", tenantId).eq("cliente_code", clienteCode).maybeSingle();
                if (existing) clienteId = existing.id;
                groupBReport.steps.cliente = { status: "WOULD_LINK", id: clienteId || undefined, reason: "cliente_code já existia" };
              } else if (insErr?.message?.includes("uq_clientes_tenant_telefone")) {
                const { data: existing } = await adminClient.from("clientes").select("id").eq("tenant_id", tenantId).eq("telefone_normalized", phoneNorm2).maybeSingle();
                if (existing) clienteId = existing.id;
                groupBReport.steps.cliente = { status: "WOULD_LINK", id: clienteId || undefined, reason: "telefone já existia — vinculado ao cliente existente" };
              } else {
                groupBReport.steps.cliente = { status: "ERROR", reason: insErr?.message || "Erro ao criar cliente" };
              }
            } else if (clienteId) {
              groupBReport.steps.cliente = { status: "WOULD_LINK", id: clienteId };
            } else if (dry_run) {
              groupBReport.steps.cliente = { status: "WOULD_CREATE" };
            }
          }

          // Create project if not dry_run and we have a client
          if (!dry_run && clienteId) {
            const stageKey = (proj.sm_stage_name || "").toLowerCase();
            const canonicalStatus = stageKey.includes("gan") ? "ganho"
              : stageKey.includes("perd") ? "perdido"
              : proj.status === "won" ? "ganho"
              : proj.status === "lost" ? "perdido"
              : "em_andamento";

            const { data: newProj, error: projErr } = await adminClient
              .from("projetos")
              .insert({
                origem: "imported",
                tenant_id: tenantId,
                nome: proj.name || "Projeto SM",
                cliente_id: clienteId,
                potencia_kwp: proj.potencia_kwp,
                status: canonicalStatus === "ganho" ? "concluido" : "criado",
                cidade_instalacao: proj.city,
                uf_instalacao: proj.state,
                bairro_instalacao: proj.neighborhood,
                rua_instalacao: proj.address,
                cep_instalacao: proj.zip_code,
                tipo_instalacao: proj.installation_type,
                valor_total: proj.valor,
                source_metadata: {
                  provider: "solarmarket",
                  sm_project_id: proj.sm_project_id,
                  imported_at: new Date().toISOString(),
                  no_active_proposal: true,
                },
                codigo: `PROJ-SM-NP-${proj.sm_project_id}`,
              })
              .select("id")
              .single();

            if (projErr) {
              groupBReport.steps.projeto = { status: "ERROR", reason: projErr.message };
              summary.ERROR = (summary.ERROR || 0) + 1;
            } else {
              groupBReport.steps.projeto = { status: "WOULD_CREATE", id: newProj!.id };
              summary.SUCCESS = (summary.SUCCESS || 0) + 1;

              // Stamp migrado_em on the SM project after successful migration
              await adminClient
                .from("solar_market_projects")
                .update({ migrado_em: new Date().toISOString() })
                .eq("id", proj.id);
            }
          } else if (dry_run) {
            groupBReport.steps.projeto = { status: "WOULD_CREATE" };
            summary.WOULD_CREATE = (summary.WOULD_CREATE || 0) + 1;
          } else if (!clienteId) {
            groupBReport.steps.projeto = { status: "ERROR", reason: "Sem cliente resolvido" };
            summary.ERROR = (summary.ERROR || 0) + 1;
          }
        } catch (err) {
          groupBReport.aborted = true;
          groupBReport.steps.projeto = { status: "ERROR", reason: (err as Error).message };
          summary.ERROR = (summary.ERROR || 0) + 1;
        }

        groupBReports.push(groupBReport);
      }
    }

    const timeBudgetExceeded = Date.now() - migrationStartTime > MIGRATION_TIMEOUT_MS;
    const result = {
      mode: dry_run ? "dry_run" : "execute",
      total_found: allProposals.length,
      total_processed: reports.length,
      total_projects_without_proposal: groupBReports.length,
      summary,
      details: [...reports.slice(0, 150), ...groupBReports.slice(0, 50)],
      filters_applied: filters,
      has_more: allProposals.length > batch_size,
      time_budget_exceeded: timeBudgetExceeded,
      elapsed_ms: Date.now() - migrationStartTime,
    };

    console.error(`[SM Migration] Done in ${result.elapsed_ms}ms. Summary: ${JSON.stringify(summary)} GroupB: ${groupBReports.length} TimeBudget: ${timeBudgetExceeded}`);

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
