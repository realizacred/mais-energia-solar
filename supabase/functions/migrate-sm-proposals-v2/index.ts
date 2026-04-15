import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Global helpers ─────────────────────────────────────
const normalizeComparableName = (value: string | null | undefined): string => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

// ─── Types ──────────────────────────────────────────────

interface MigrationParams {
  action?: "sync_pipelines" | "start_background_migration" | "pause_background_migration";
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

type StepStatus = "WOULD_CREATE" | "CREATED" | "WOULD_LINK" | "WOULD_SKIP" | "FALLBACK_USED" | "CONFLICT" | "ERROR";

// ── Fallback IDs — resolved dynamically per tenant from sm_migration_settings + DB lookups ──
// These are populated at runtime in resolveDynamicFallbacks() before any migration logic runs.
let FALLBACK_PIPELINE_ID = '';
let FALLBACK_STAGE_ID    = '';
let FALLBACK_FUNIL_ID    = '';
let FALLBACK_ETAPA_ID    = '';
let CANONICAL_DEFAULT_PIPELINE_ID = '';
let CANONICAL_DEFAULT_STAGE_ID = '';

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
  _error?: string;
  steps: {
    cliente?: StepResult;
    deal?: StepResult;
    pipelines?: StepResult & { details?: Array<{ funnel: string; stage: string; pipeline_id?: string; stage_id?: string }> };
    projeto?: StepResult;
    proposta_nativa?: StepResult;
    proposta_versao?: StepResult;
    _fatal?: StepResult;
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

function inferNumeroParcelas(paymentConditions: string | null | undefined): number {
  if (!paymentConditions) return 1;

  const normalized = paymentConditions.toLowerCase();
  const compactMatch = normalized.match(/(\d{1,3})\s*x/);
  if (compactMatch) return Math.max(1, parseInt(compactMatch[1], 10));

  const parcelasMatch = normalized.match(/(\d{1,3})\s*parcelas?/);
  if (parcelasMatch) return Math.max(1, parseInt(parcelasMatch[1], 10));

  if (normalized.includes("financiamento")) return 12;

  return 1;
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

function dispatchBackgroundMigrationRun(params: {
  supabaseUrl: string;
  serviceKey: string;
  tenantId: string;
  pipelineId: string;
  stageId?: string | null;
  ownerId?: string | null;
  autoResolveOwner: boolean;
  batchSize: number;
}) {
  const payload = {
    dry_run: false,
    pipeline_id: params.pipelineId,
    stage_id: params.stageId ?? null,
    auto_resolve_owner: params.autoResolveOwner,
    auto_resume: true,
    batch_size: params.batchSize,
    include_projects_without_proposal: false,
    ...(params.ownerId ? { owner_id: params.ownerId } : {}),
    _cron_tenant_id: params.tenantId,
  };

  const dispatchPromise = fetch(`${params.supabaseUrl}/functions/v1/migrate-sm-proposals-v2`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[SM Migration] Background dispatch failed: HTTP ${response.status} ${body}`);
    }
  }).catch((error) => {
    console.error(`[SM Migration] Background dispatch error: ${error instanceof Error ? error.message : String(error)}`);
  });

  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(dispatchPromise);
    return;
  }

  void dispatchPromise;
}

async function isBackgroundMigrationEnabled(adminClient: any, tenantId: string): Promise<boolean> {
  const { data, error } = await adminClient
    .from("sm_migration_settings")
    .select("enabled")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error(`[SM Migration] Failed to read sm_migration_settings for tenant ${tenantId}: ${error.message}`);
    return false;
  }

  return data?.enabled === true;
}

async function isOperationRunActive(adminClient: any, runId: string): Promise<boolean> {
  const { data, error } = await adminClient
    .from("sm_operation_runs")
    .select("status")
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    console.error(`[SM Migration] Failed to read sm_operation_runs ${runId}: ${error.message}`);
    return true;
  }

  return data?.status === "queued" || data?.status === "running";
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

  // 3b. Pre-fetch ordered stages from solar_market_funnel_stages (SSOT for SM stage order)
  const smOrderedMap = new Map<string, Array<{ stage_name: string; stage_order: number }>>();
  {
    const { data: smFunnelStages } = await adminClient
      .from("solar_market_funnel_stages")
      .select("funnel_name, stage_name, stage_order")
      .eq("tenant_id", tenantId)
      .order("stage_order", { ascending: true });
    for (const row of smFunnelStages || []) {
      const fName = (row.funnel_name || "").trim();
      const sName = (row.stage_name || "").trim();
      if (!fName || !sName) continue;
      if (!smOrderedMap.has(fName)) smOrderedMap.set(fName, []);
      const arr = smOrderedMap.get(fName)!;
      if (!arr.some(s => s.stage_name === sName)) {
        arr.push({ stage_name: sName, stage_order: row.stage_order ?? arr.length });
      }
    }
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
      .select("id, name, position")
      .eq("tenant_id", tenantId)
      .eq("pipeline_id", pipelineId);

    const existingStageMap = new Map<string, { id: string; position: number }>();
    for (const s of existingStages || []) {
      existingStageMap.set(normalizeNameForCompare(s.name), { id: s.id, position: s.position });
    }

    // Use solar_market_funnel_stages order when available (SSOT)
    const orderedStages = smOrderedMap.get(funnelName);
    if (orderedStages && orderedStages.length > 0) {
      // Ordered path: use stage_order from SM as position
      const orderedNamesSet = new Set(orderedStages.map(s => normalizeNameForCompare(s.stage_name)));

      for (const s of orderedStages) {
        const normalizedStageName = normalizeNameForCompare(s.stage_name);
        const existing = existingStageMap.get(normalizedStageName);
        if (existing) {
          // Fix position if divergent
          if (existing.position !== s.stage_order) {
            const { error: updErr } = await adminClient
              .from("pipeline_stages")
              .update({ position: s.stage_order })
              .eq("id", existing.id);
            if (!updErr) {
              console.error(`[SM Sync] Fixed stage "${s.stage_name}" position: ${existing.position} → ${s.stage_order}`);
            }
          }
          report.stages.existing++;
          continue;
        }

        const { error: stageErr } = await adminClient
          .from("pipeline_stages")
          .insert({
            tenant_id: tenantId,
            pipeline_id: pipelineId,
            name: s.stage_name.trim(),
            position: s.stage_order,
            probability: 50,
            is_closed: false,
            is_won: false,
          });

        if (stageErr) {
          console.error(`[SM Sync] Failed to create stage "${s.stage_name}": ${stageErr.message}`);
        } else {
          report.stages.created++;
          existingStageMap.set(normalizedStageName, { id: "created", position: s.stage_order });
        }
      }

      // Append extras from project data not in SM ordered list
      let nextPos = Math.max(...orderedStages.map(s => s.stage_order), 0) + 1;
      for (const stageName of stageNames) {
        const normalizedStageName = normalizeNameForCompare(stageName);
        if (orderedNamesSet.has(normalizedStageName) || existingStageMap.has(normalizedStageName)) continue;
        console.error(`[SM Sync] Appending extra stage "${stageName}" not in SM order at position ${nextPos}`);

        const { error: stageErr } = await adminClient
          .from("pipeline_stages")
          .insert({
            tenant_id: tenantId,
            pipeline_id: pipelineId,
            name: stageName.trim(),
            position: nextPos++,
            probability: 50,
            is_closed: false,
            is_won: false,
          });

        if (!stageErr) {
          report.stages.created++;
          existingStageMap.set(normalizedStageName, { id: "created", position: nextPos - 1 });
        }
      }
    } else {
      // Fallback: no SM ordered data — use Set iteration (WARN: unordered)
      console.warn(`[SM Sync] No ordered stages from solar_market_funnel_stages for funnel "${funnelName}" — using unordered fallback`);
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
          existingStageMap.set(normalizedStageName, { id: "created", position: position - 1 });
        }
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

  // 7. Activate operational projeto_funis (exclude "Vendedor" — not a real process funil)
  const funisActivated: string[] = [];
  {
    const { data: inactiveFunis } = await adminClient
      .from("projeto_funis")
      .select("id, nome")
      .eq("tenant_id", tenantId)
      .eq("ativo", false);

    const toActivate = (inactiveFunis || []).filter(
      (f: any) => normalizeNameForCompare(f.nome) !== "vendedor"
    );

    for (const f of toActivate) {
      const { error: activateErr } = await adminClient
        .from("projeto_funis")
        .update({ ativo: true })
        .eq("id", f.id);
      if (!activateErr) funisActivated.push(f.nome);
    }
  }

  return new Response(
    JSON.stringify({
      action: "sync_pipelines",
      success: true,
      report: { ...report, funis_activated: funisActivated },
      total_projects_scanned: allProjects.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ─── Main Handler ───────────────────────────────────────

Deno.serve(async (req) => {
  console.error("[SM Migration] HANDLER ENTRY", req.method);

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
    // Auth — supports JWT (user) or x-cron-secret (pg_cron auto-resume)
    const authHeader = req.headers.get("authorization") || "";
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    console.error("[SM Migration] AUTH CHECK", {
      hasCron: !!cronSecretHeader,
      hasAuth: !!authHeader,
      authLen: authHeader.length,
    });

    let tenantId: string;
    let rawBody: any;

    // ── CRON MODE: auto-resume for all enabled tenants ──
    if (cronSecretHeader) {
      const expectedCronSecret = Deno.env.get("CRON_SECRET");
      if (!expectedCronSecret || cronSecretHeader !== expectedCronSecret) {
        return new Response(JSON.stringify({ error: "Invalid cron secret" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch all tenants with enabled migration settings AND pending proposals
      const { data: settings } = await adminClient
        .from("sm_migration_settings")
        .select("tenant_id, pipeline_id, stage_id, owner_id, auto_resolve_owner, batch_size")
        .eq("enabled", true);

      if (!settings || settings.length === 0) {
        return new Response(JSON.stringify({ cron: true, message: "No tenants with enabled migration" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cronResults: any[] = [];
      for (const s of settings) {
        // Check if there are pending proposals for this tenant
        const { count: pendingCount } = await adminClient
          .from("solar_market_proposals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", s.tenant_id)
          .is("migrado_em", null);

        if (!pendingCount || pendingCount === 0) {
          // Auto-disable when done
          await adminClient
            .from("sm_migration_settings")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("tenant_id", s.tenant_id);
          cronResults.push({ tenant_id: s.tenant_id, status: "completed", pending: 0 });
          continue;
        }

        // Call self recursively via internal fetch with service_role auth
        // Build payload matching user-mode params
        const payload = {
          dry_run: false,
          pipeline_id: s.pipeline_id,
          stage_id: s.stage_id || null,
          auto_resolve_owner: s.auto_resolve_owner ?? true,
          auto_resume: true,
          batch_size: s.batch_size || 10,
          include_projects_without_proposal: false,
          ...(s.owner_id ? { owner_id: s.owner_id } : {}),
          _cron_tenant_id: s.tenant_id, // internal: tenant override for cron
        };

        try {
          const fetchUrl = `${supabaseUrl}/functions/v1/migrate-sm-proposals-v2`;
          console.error("[SM Migration] CRON FETCH ANTES", { tenant: s.tenant_id, url: fetchUrl, svcKeyLen: serviceKey?.length });
          const innerResp = await fetch(fetchUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          const innerBody = await innerResp.text().catch(() => "");
          console.error("[SM Migration] CRON FETCH DEPOIS", { tenant: s.tenant_id, status: innerResp.status, bodyPreview: innerBody.substring(0, 300) });
          let parsed: any = {};
          try { parsed = JSON.parse(innerBody); } catch { parsed = { raw: innerBody.substring(0, 200) }; }
          cronResults.push({ tenant_id: s.tenant_id, status: innerResp.ok ? "ok" : "error", pending: pendingCount, response: parsed });
        } catch (e) {
          console.error("[SM Migration] CRON FETCH ERROR", { tenant: s.tenant_id, error: (e as Error).message, stack: (e as Error).stack?.substring(0, 300) });
          cronResults.push({ tenant_id: s.tenant_id, status: "error", error: (e as Error).message });
        }
      }

      return new Response(JSON.stringify({ cron: true, results: cronResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── USER / SERVICE_ROLE MODE ──
    rawBody = await req.json();

    // ── CRON DISPATCH MODE: service_role + _cron_dispatch ──
    // pg_cron calls with service_role key and _cron_dispatch flag
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized", step: "token_extract" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId: string | null = null;

    if (token === serviceKey && rawBody?._cron_dispatch) {
      // Cron dispatch: iterate all enabled tenants with pending proposals
      const { data: settings } = await adminClient
        .from("sm_migration_settings")
        .select("tenant_id, pipeline_id, stage_id, owner_id, auto_resolve_owner, batch_size")
        .eq("enabled", true);

      if (!settings || settings.length === 0) {
        return new Response(JSON.stringify({ cron: true, message: "No tenants with enabled migration" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cronResults: any[] = [];
      for (const s of settings) {
        const { count: pendingCount } = await adminClient
          .from("solar_market_proposals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", s.tenant_id)
          .is("migrado_em", null);

        if (!pendingCount || pendingCount === 0) {
          await adminClient
            .from("sm_migration_settings")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("tenant_id", s.tenant_id);
          cronResults.push({ tenant_id: s.tenant_id, status: "completed", pending: 0 });
          continue;
        }

        // Call self with service_role + _cron_tenant_id for single-tenant processing
        const payload = {
          dry_run: false,
          pipeline_id: s.pipeline_id,
          stage_id: s.stage_id || null,
          auto_resolve_owner: s.auto_resolve_owner ?? true,
          auto_resume: true,
          batch_size: s.batch_size || 10,
          include_projects_without_proposal: false,
          ...(s.owner_id ? { owner_id: s.owner_id } : {}),
          _cron_tenant_id: s.tenant_id,
        };

        try {
          const fetchUrl2 = `${supabaseUrl}/functions/v1/migrate-sm-proposals-v2`;
          console.error("[SM Migration] DISPATCH FETCH ANTES", { tenant: s.tenant_id, url: fetchUrl2, svcKeyLen: serviceKey?.length });
          const innerResp = await fetch(fetchUrl2, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          const innerBody = await innerResp.text().catch(() => "");
          console.error("[SM Migration] DISPATCH FETCH DEPOIS", { tenant: s.tenant_id, status: innerResp.status, bodyPreview: innerBody.substring(0, 300) });
          let parsed2: any = {};
          try { parsed2 = JSON.parse(innerBody); } catch { parsed2 = { raw: innerBody.substring(0, 200) }; }
          cronResults.push({ tenant_id: s.tenant_id, status: innerResp.ok ? "ok" : "error", pending: pendingCount, response: parsed2 });
        } catch (e) {
          console.error("[SM Migration] DISPATCH FETCH ERROR", { tenant: s.tenant_id, error: (e as Error).message, stack: (e as Error).stack?.substring(0, 300) });
          cronResults.push({ tenant_id: s.tenant_id, status: "error", error: (e as Error).message });
        }
      }

      return new Response(JSON.stringify({ cron: true, results: cronResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If called with service_role key + _cron_tenant_id, skip user auth (internal call from dispatch)
    if (token === serviceKey && rawBody?._cron_tenant_id) {
      tenantId = rawBody._cron_tenant_id;
      console.error(`[SM Migration] Cron mode: tenant=${tenantId}`);
    } else {
      // Standard user JWT auth
      const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
      if (authErr || !user) {
        console.error("ERR", { step: "user_auth", err: authErr?.message });
        return new Response(JSON.stringify({ error: "Unauthorized", step: "user_auth" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;

      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("tenant_id, status, ativo")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        return new Response(JSON.stringify({ error: "No tenant/profile", step: "profile_lookup" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (profile.status !== "aprovado" || !profile.ativo) {
        return new Response(JSON.stringify({ error: "User not approved/active", step: "profile_check" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      tenantId = profile.tenant_id;
    }

    const params: MigrationParams = rawBody as MigrationParams;
    const { dry_run = false, batch_size = 50 } = params;
    let { filters = {} } = params;
    const autoResolveOwner = params.auto_resolve_owner !== false;

    // ─── PASSO 0: actions ───────────────────────────────
    if (rawBody?.action === "sync_pipelines") {
      return await handleSyncPipelines(adminClient, tenantId);
    }

    // ─── fix_existing_projects: Re-migrate already-migrated projects with correct funil/etapa/consultor ──
    if (rawBody?.action === "fix_existing_projects") {
      const fixReport = { total: 0, updated: 0, skipped: 0, errors: [] as string[] };

      // 1. Load all projeto_funis and projeto_etapas for this tenant (cache)
      const { data: fixFunis } = await adminClient
        .from("projeto_funis")
        .select("id, nome")
        .eq("tenant_id", tenantId);
      const fixFunisMap = new Map<string, string>();
      for (const f of fixFunis || []) {
        fixFunisMap.set(normalizeNameForCompare(f.nome), f.id);
      }

      const { data: fixEtapas } = await adminClient
        .from("projeto_etapas")
        .select("id, funil_id, nome, ordem")
        .eq("tenant_id", tenantId)
        .order("ordem", { ascending: true });
      const fixEtapaFirstMap = new Map<string, string>();
      const fixEtapaByNameMap = new Map<string, string>();
      for (const e of fixEtapas || []) {
        if (!fixEtapaFirstMap.has(e.funil_id)) fixEtapaFirstMap.set(e.funil_id, e.id);
        if (e.nome) {
          const key = `${e.funil_id}::${normalizeNameForCompare(e.nome)}`;
          if (!fixEtapaByNameMap.has(key)) fixEtapaByNameMap.set(key, e.id);
        }
      }

      // 2. Load consultores
      const { data: fixConsultores } = await adminClient
        .from("consultores")
        .select("id, nome")
        .eq("tenant_id", tenantId);
      const fixConsultorMap = new Map<string, string>();
      for (const c of fixConsultores || []) {
        fixConsultorMap.set(normalizeNameForCompare(c.nome), c.id);
      }

      // Ensure Escritório exists
      let fixEscritorioId = fixConsultorMap.get(normalizeNameForCompare("escritório")) || null;
      if (!fixEscritorioId) {
        const { data: newEscritorio } = await adminClient
          .from("consultores")
          .upsert({ tenant_id: tenantId, nome: "Escritório", telefone: "N/A", codigo: "escritorio", ativo: true, user_id: null }, { onConflict: "tenant_id,codigo", ignoreDuplicates: false })
          .select("id")
          .single();
        fixEscritorioId = newEscritorio?.id || null;
        if (fixEscritorioId) fixConsultorMap.set(normalizeNameForCompare("escritório"), fixEscritorioId);
      }

      const fixEngenhariaFunilId = fixFunisMap.get(normalizeNameForCompare("Engenharia")) || null;
      const fixEngenhariaFirstEtapa = fixEngenhariaFunilId ? fixEtapaFirstMap.get(fixEngenhariaFunilId) || null : null;

      // 3. Load all migrated projects (import_source = solar_market)
      const { data: migratedProjects } = await adminClient
        .from("projetos")
        .select("id, codigo, funil_id, etapa_id, consultor_id")
        .eq("tenant_id", tenantId)
        .eq("import_source", "solar_market");

      fixReport.total = (migratedProjects || []).length;

      const EX_FUNC_FIX = ['rogerio', 'rogério', 'ricardo'];

      for (const proj of migratedProjects || []) {
        try {
          const codeMatch = proj.codigo?.match(/PROJ-SM-(?:NP-)?(\d+)/);
          if (!codeMatch) { fixReport.skipped++; continue; }
          const smProjectId = parseInt(codeMatch[1], 10);

          const { data: smProj } = await adminClient
            .from("solar_market_projects")
            .select("sm_project_id, sm_funnel_name, sm_stage_name, all_funnels")
            .eq("tenant_id", tenantId)
            .eq("sm_project_id", smProjectId)
            .maybeSingle();

          if (!smProj) { fixReport.skipped++; continue; }

          // Resolve funil_id
          const normalizedFunnel = normalizeNameForCompare(smProj.sm_funnel_name);
          let targetFunilId: string | null = null;

          if (!normalizedFunnel || normalizedFunnel === 'vendedores' || normalizedFunnel === 'lead') {
            targetFunilId = fixEngenhariaFunilId;
          } else if (normalizedFunnel.includes('compesa') || normalizedFunnel.includes('compensa')) {
            targetFunilId = fixFunisMap.get(normalizeNameForCompare('Compensação'))
              || fixFunisMap.get(normalizeNameForCompare('Compesação'))
              || fixEngenhariaFunilId;
          } else {
            targetFunilId = fixFunisMap.get(normalizedFunnel) || null;
            if (!targetFunilId) {
              for (const [k, v] of fixFunisMap) {
                if (k.includes(normalizedFunnel) || normalizedFunnel.includes(k)) { targetFunilId = v; break; }
              }
            }
          }
          if (!targetFunilId) targetFunilId = fixEngenhariaFunilId;

          // Resolve etapa_id
          let targetEtapaId: string | null = null;
          if (targetFunilId) {
            if (!normalizedFunnel || normalizedFunnel === 'vendedores' || normalizedFunnel === 'lead') {
              targetEtapaId = fixEtapaFirstMap.get(targetFunilId) || null;
            } else {
              if (smProj.sm_stage_name) {
                const nameKey = `${targetFunilId}::${normalizeNameForCompare(smProj.sm_stage_name)}`;
                targetEtapaId = fixEtapaByNameMap.get(nameKey) || null;
              }
              if (!targetEtapaId && Array.isArray(smProj.all_funnels)) {
                for (const f of smProj.all_funnels) {
                  const fName = normalizeNameForCompare(String(f.funnelName || "").trim());
                  if (!fName || fName === "vendedores") continue;
                  const fStageName = String(f.stageName || "").trim();
                  if (fStageName) {
                    const nameKey = `${targetFunilId}::${normalizeNameForCompare(fStageName)}`;
                    targetEtapaId = fixEtapaByNameMap.get(nameKey) || null;
                    if (targetEtapaId) break;
                  }
                }
              }
              if (!targetEtapaId) targetEtapaId = fixEtapaFirstMap.get(targetFunilId) || null;
            }
          }
          if (!targetEtapaId) targetEtapaId = fixEngenhariaFirstEtapa;

          // Resolve consultor from Vendedores funnel
          let targetConsultorId: string | null = null;
          if (Array.isArray(smProj.all_funnels)) {
            for (const f of smProj.all_funnels) {
              const fName = normalizeNameForCompare(String(f.funnelName || "").trim());
              if (fName === "vendedores") {
                const sName = normalizeNameForCompare(String(f.stageName || "").trim());
                if (sName) {
                  if (EX_FUNC_FIX.includes(sName)) {
                    targetConsultorId = fixEscritorioId;
                  } else {
                    targetConsultorId = fixConsultorMap.get(sName) || null;
                    if (!targetConsultorId) {
                      for (const [k, v] of fixConsultorMap) {
                        if (k.startsWith(sName) || sName.startsWith(k)) { targetConsultorId = v; break; }
                      }
                    }
                    if (!targetConsultorId) targetConsultorId = fixEscritorioId;
                  }
                }
                break;
              }
            }
          }
          if (!targetConsultorId && smProj.sm_funnel_name?.toLowerCase().trim() === "vendedores" && smProj.sm_stage_name) {
            const sName = normalizeNameForCompare(smProj.sm_stage_name);
            if (EX_FUNC_FIX.includes(sName)) {
              targetConsultorId = fixEscritorioId;
            } else {
              targetConsultorId = fixConsultorMap.get(sName) || null;
              if (!targetConsultorId) {
                for (const [k, v] of fixConsultorMap) {
                  if (k.startsWith(sName) || sName.startsWith(k)) { targetConsultorId = v; break; }
                }
              }
              if (!targetConsultorId) targetConsultorId = fixEscritorioId;
            }
          }
          if (!targetConsultorId) targetConsultorId = fixEscritorioId;

          const needsUpdate =
            proj.funil_id !== targetFunilId ||
            proj.etapa_id !== targetEtapaId ||
            proj.consultor_id !== targetConsultorId;

          if (!needsUpdate) { fixReport.skipped++; continue; }

          const updateFields: Record<string, any> = {};
          if (targetFunilId) updateFields.funil_id = targetFunilId;
          if (targetEtapaId) updateFields.etapa_id = targetEtapaId;
          if (targetConsultorId) updateFields.consultor_id = targetConsultorId;
          updateFields.updated_at = new Date().toISOString();

          const { error: updErr } = await adminClient
            .from("projetos")
            .update(updateFields)
            .eq("id", proj.id)
            .eq("tenant_id", tenantId);

          if (updErr) {
            fixReport.errors.push(`${proj.codigo}: ${updErr.message}`);
          } else {
            fixReport.updated++;
          }
        } catch (e) {
          fixReport.errors.push(`${proj.codigo}: ${(e as Error).message}`);
        }
      }

      return new Response(
        JSON.stringify({ action: "fix_existing_projects", success: true, report: fixReport }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    if (rawBody?.action === "pause_background_migration") {
      // 1. Disable future runs
      await adminClient
        .from("sm_migration_settings")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);

      // 2. Cancel any active sm_operation_runs for this tenant
      const { data: activeRuns } = await adminClient
        .from("sm_operation_runs")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("status", ["running", "queued"]);

      if (activeRuns && activeRuns.length > 0) {
        const runIds = activeRuns.map((r: any) => r.id);
        await adminClient
          .from("sm_operation_runs")
          .update({ status: "cancelled", finished_at: new Date().toISOString() })
          .in("id", runIds);
      }

      return new Response(JSON.stringify({ paused: true, message: "Migração pausada e operações ativas canceladas." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rawBody?.action === "start_background_migration") {
      if (!params.pipeline_id) {
        return new Response(JSON.stringify({ error: "pipeline_id is required", step: "params_validation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!params.owner_id && !autoResolveOwner) {
        return new Response(JSON.stringify({ error: "owner_id is required (or enable auto_resolve_owner)", step: "params_validation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const effectiveBatchSize = Math.max(1, Math.min(Number(params.batch_size || 25), 100));

      await adminClient
        .from("sm_migration_settings")
        .upsert({
          tenant_id: tenantId,
          pipeline_id: params.pipeline_id,
          stage_id: params.stage_id || null,
          owner_id: params.owner_id || null,
          auto_resolve_owner: autoResolveOwner,
          batch_size: effectiveBatchSize,
          enabled: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" });

      const { count: pendingCount } = await adminClient
        .from("solar_market_proposals")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("migrado_em", null);

      if (!pendingCount || pendingCount === 0) {
        await adminClient
          .from("sm_migration_settings")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId);

        return new Response(JSON.stringify({
          accepted: false,
          completed: true,
          pending: 0,
          message: "Nenhuma proposta pendente para migrar.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      dispatchBackgroundMigrationRun({
        supabaseUrl,
        serviceKey,
        tenantId,
        pipelineId: params.pipeline_id,
        stageId: params.stage_id || null,
        ownerId: params.owner_id || null,
        autoResolveOwner,
        batchSize: effectiveBatchSize,
      });

      return new Response(JSON.stringify({
        accepted: true,
        pending: pendingCount,
        batch_size: effectiveBatchSize,
        message: "Migração enviada para execução no servidor. Ela continuará mesmo se você fechar a tela.",
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Formal Lock: prevent concurrent SM operations ─────
    let smOpRunId: string | null = null;
    if (!dry_run) {
      const { data: lockResult, error: lockErr } = await adminClient.rpc(
        "acquire_sm_operation_lock",
        {
          p_tenant_id: tenantId,
          p_operation_type: "migrate_to_native",
          p_created_by: userId,
          p_context: { batch_size, auto_resume: params.auto_resume ?? false },
        }
      );

      if (lockErr || !lockResult?.acquired) {
        const reason = lockResult?.reason || lockErr?.message || "Lock acquisition failed";
        return new Response(JSON.stringify({
          error: reason,
          blocked: true,
          blocked_by: lockResult?.blocked_by_type,
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      smOpRunId = lockResult.run_id;
    }

    // ─── AUTO_RESUME: fetch next pending batch automatically ─────
    if (params.auto_resume && !dry_run) {
      const backgroundMigrationEnabled = await isBackgroundMigrationEnabled(adminClient, tenantId);
      if (!backgroundMigrationEnabled) {
        if (smOpRunId) {
          await adminClient
            .from("sm_operation_runs")
            .update({
              status: "cancelled",
              finished_at: new Date().toISOString(),
              heartbeat_at: new Date().toISOString(),
              error_summary: "Migração em background pausada para este tenant.",
            })
            .eq("id", smOpRunId);
        }
        return new Response(JSON.stringify({
          paused: true,
          completed: false,
          message: "Migração em background está pausada para este tenant.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

        if (smOpRunId) {
          await adminClient
            .from("sm_operation_runs")
            .update({
              status: "completed",
              finished_at: new Date().toISOString(),
              heartbeat_at: new Date().toISOString(),
              error_summary: null,
            })
            .eq("id", smOpRunId);
        }

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

    // ─── 0b. Resolve dynamic fallback IDs — is_default first, sm_migration_settings as override ──
    // Declare maps outside block scope so they're accessible in projeto creation (section D)
    let projetoFunisMap = new Map<string, string>(); // normalized name → funil_id
    let funilFirstEtapaMap = new Map<string, string>(); // funil_id → first etapa_id
    let funilEtapaByNameMap = new Map<string, string>(); // "funil_id::normalizedName" → etapa_id
    {
      CANONICAL_DEFAULT_PIPELINE_ID = '';
      CANONICAL_DEFAULT_STAGE_ID = '';

      // 1) Always resolve the canonical default pipeline dynamically (UUID-independent)
      const { data: defPipeline } = await adminClient
        .from("pipelines")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_default", true)
        .maybeSingle();

      let canonicalPipelineId = defPipeline?.id || '';
      let canonicalStageId = '';

      if (canonicalPipelineId) {
        const { data: firstStage } = await adminClient
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_id", canonicalPipelineId)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstStage) canonicalStageId = firstStage.id;
      }

      CANONICAL_DEFAULT_PIPELINE_ID = canonicalPipelineId;
      CANONICAL_DEFAULT_STAGE_ID = canonicalStageId;

      // 2) Optional overrides: params > sm_migration_settings > canonical default
      const settingsPipelineId = params.pipeline_id || null;
      const settingsStageId = params.stage_id || null;

      if (settingsPipelineId) {
        // Validate that the override UUID actually exists
        const { data: checkPipe } = await adminClient
          .from("pipelines")
          .select("id")
          .eq("id", settingsPipelineId)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (checkPipe) {
          FALLBACK_PIPELINE_ID = settingsPipelineId;
          FALLBACK_STAGE_ID = settingsStageId || '';
        }
      }

      if (!FALLBACK_PIPELINE_ID) {
        const { data: mSettings } = await adminClient
          .from("sm_migration_settings")
          .select("pipeline_id, stage_id")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (mSettings?.pipeline_id) {
          // Validate that the settings UUID actually exists
          const { data: checkPipe } = await adminClient
            .from("pipelines")
            .select("id")
            .eq("id", mSettings.pipeline_id)
            .eq("tenant_id", tenantId)
            .maybeSingle();
          if (checkPipe) {
            FALLBACK_PIPELINE_ID = mSettings.pipeline_id;
            FALLBACK_STAGE_ID = mSettings.stage_id || '';
          }
        }
      }

      // 3) Final fallback: always the canonical default (UUID-independent)
      if (!FALLBACK_PIPELINE_ID) {
        FALLBACK_PIPELINE_ID = canonicalPipelineId;
        FALLBACK_STAGE_ID = canonicalStageId;
      }

      // Resolve first stage if pipeline resolved but stage still empty
      if (FALLBACK_PIPELINE_ID && !FALLBACK_STAGE_ID) {
        const { data: firstStage } = await adminClient
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_id", FALLBACK_PIPELINE_ID)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstStage) FALLBACK_STAGE_ID = firstStage.id;
      }

      // Funil + Etapa: resolve "Engenharia" funil from projeto_funis (used as final fallback)
      // FIX: "Vendedor" is NOT a real process funil — it's a SM-specific consultor grouping.
      // Default fallback must be Engenharia (the most common operational funil).
      const { data: engenhariaFunil } = await adminClient
        .from("projeto_funis")
        .select("id")
        .eq("tenant_id", tenantId)
        .ilike("nome", "%engenharia%")
        .maybeSingle();
      if (engenhariaFunil) {
        FALLBACK_FUNIL_ID = engenhariaFunil.id;
        const { data: firstEtapa } = await adminClient
          .from("projeto_etapas")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("funil_id", engenhariaFunil.id)
          .order("ordem", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstEtapa) FALLBACK_ETAPA_ID = firstEtapa.id;
      }
      // Pre-fetch ALL projeto_funis for dynamic funil resolution
      const { data: allProjetoFunis } = await adminClient
        .from("projeto_funis")
        .select("id, nome")
        .eq("tenant_id", tenantId);
      const projetoFunisMap = new Map<string, string>(); // normalized name → funil_id
      for (const f of allProjetoFunis || []) {
        projetoFunisMap.set(normalizeComparableName(f.nome), f.id);
      }

      // Pre-fetch first etapa per funil for quick fallback + name-based lookup
      const funilFirstEtapaMap = new Map<string, string>(); // funil_id → first etapa_id
      const funilEtapaByNameMap = new Map<string, string>(); // "funil_id::normalizedName" → etapa_id
      {
        const { data: allEtapas } = await adminClient
          .from("projeto_etapas")
          .select("id, funil_id, nome, ordem")
          .eq("tenant_id", tenantId)
          .order("ordem", { ascending: true });
        for (const e of allEtapas || []) {
          if (!funilFirstEtapaMap.has(e.funil_id)) {
            funilFirstEtapaMap.set(e.funil_id, e.id);
          }
          // Build name-based lookup for SM stage name matching
          if (e.nome) {
            const nameKey = `${e.funil_id}::${normalizeComparableName(e.nome)}`;
            if (!funilEtapaByNameMap.has(nameKey)) {
              funilEtapaByNameMap.set(nameKey, e.id);
            }
          }
        }
      }

      console.error(`[SM Migration] Dynamic fallbacks resolved: pipeline=${FALLBACK_PIPELINE_ID}, stage=${FALLBACK_STAGE_ID}, funil=${FALLBACK_FUNIL_ID}, etapa=${FALLBACK_ETAPA_ID}`);

      if (!FALLBACK_PIPELINE_ID || !FALLBACK_STAGE_ID) {
        const errMsg = "Não foi possível resolver pipeline/stage de fallback. Configure sm_migration_settings ou crie um pipeline padrão.";
        console.error(`[SM Migration] ${errMsg}`);
        if (!dry_run) {
          return new Response(JSON.stringify({ error: errMsg, step: "fallback_resolution" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
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

    console.error("START MIGRATION");
    let preLoadStep = "inicializando pre-load";
    let inPreLoad = true;

    try {
    // Paginate SM proposals (max 1000 per page)
    preLoadStep = "carregando propostas";
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
    console.error("propostas OK");

    // console.log(`[SM Migration] Found ${allProposals.length} proposals matching filters`);

    if (allProposals.length === 0) {
      return new Response(
        JSON.stringify({ mode: dry_run ? "dry_run" : "execute", total_processed: 0, summary: {}, details: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── 2. Pre-fetch SM clients for these proposals ─────

    preLoadStep = "carregando clientes";
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
    console.error("clientes OK");

    // console.log(`[SM Migration] Loaded ${smClientMap.size} SM clients`);

    // ─── 2b. Pre-fetch SM projects to resolve responsible (vendedor) & funnels ─
    preLoadStep = "carregando sm_projects";
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
    console.error("sm_projects OK");
    // console.log(`[SM Migration] Loaded ${smProjectMap.size} SM projects for responsible resolution`);


    // ─── 2c. Pre-fetch consultores for owner auto-resolution ─

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
    // ─── Global Field Key Normalizer ───────────────────────
    // Handles: camelCase→snake_case, accents, spaces, special chars, prefix stripping
    // Ensures "Valor Total", "valorTotal", "cap_valor_total" all become "valor_total"

    /** Remove brackets from SM key notation */
    const normalizeCfKey = (key: string): string => {
      return key.replace(/^\[|\]$/g, "").trim();
    };

    /** Detect field_context area from original key prefix (BEFORE stripping) */
    const detectCfArea = (key: string): string => {
      const lk = key.toLowerCase().trim();
      if (lk.startsWith("cape_") || lk.startsWith("cape ")) return "pre_dimensionamento";
      if (lk.startsWith("capo_") || lk.startsWith("capo ")) return "pos_dimensionamento";
      if (lk.startsWith("cap_") || lk.startsWith("cap ")) return "projeto";
      return "outros";
    };

    /** Strip cap_/cape_/capo_ prefix to get the base key */
    const stripCfPrefix = (key: string): string => {
      return key.replace(/^(cape_|capo_|cap_)/i, "").trim();
    };

    /**
     * Global normalizer: produces a canonical snake_case key from any format.
     * Steps:
     * 1. Remove brackets
     * 2. Strip prefix (cap_/cape_/capo_) — prefix is used only for area routing
     * 3. Remove accents (NFD decomposition)
     * 4. Convert camelCase to snake_case (e.g. "valorTotal" → "valor_total")
     * 5. Replace spaces and special chars with _
     * 6. Collapse multiple underscores
     * 7. Lowercase
     */
    const normalizeFieldKey = (rawKey: string): string => {
      let k = normalizeCfKey(rawKey);
      k = stripCfPrefix(k);
      // Remove accents
      k = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // camelCase → snake_case: insert _ before uppercase letters
      k = k.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
      // Replace spaces and non-alphanumeric with _
      k = k.replace(/[^a-zA-Z0-9_]/g, "_");
      // Collapse multiple underscores and trim
      k = k.replace(/_+/g, "_").replace(/^_|_$/g, "");
      return k.toLowerCase();
    };
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
        const mappingEntry = {
          target_namespace: m.target_namespace,
          target_path: m.target_path,
          transform: m.transform,
          priority: m.priority,
        };
        cfMappings.set(bareKey, mappingEntry);
        // Also index by normalized key for consistent lookup
        const normKey = normalizeFieldKey(bareKey);
        if (normKey !== bareKey) {
          cfMappings.set(normKey, mappingEntry);
        }
      }
    }
    // console.log(`[SM Migration] Loaded ${cfMappings.size} custom field mappings`);

    /** Apply transform to a raw value */
    const applyTransform = (rawValue: any, transform: string): any => {
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
    };



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

    // M02 fix: pre-load all stages per pipeline in a single query, stored in stageCache.
    // Eliminates the double-query pattern (exact match + full scan) per stage call.
    const stageCacheLoaded = new Set<string>(); // tracks which pipelineIds were already loaded
    const stagePositionCache = new Map<string, number>(); // cacheKey → current position

    async function preloadStagesForPipeline(pipelineId: string): Promise<void> {
      if (stageCacheLoaded.has(pipelineId)) return;
      stageCacheLoaded.add(pipelineId);
      const { data: allStages } = await adminClient
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("tenant_id", tenantId)
        .eq("pipeline_id", pipelineId);
      for (const s of allStages || []) {
        const normalizedName = normalizeComparableName(s.name);
        const key = `${pipelineId}::${normalizedName}`;
        if (!stageCache.has(key)) stageCache.set(key, s.id);
        stagePositionCache.set(key, s.position ?? 0);
      }
    }

    async function resolveOrCreateStage(pipelineId: string, stageName: string, position: number): Promise<string> {
      const normalizedStageName = normalizeComparableName(stageName);
      const cacheKey = `${pipelineId}::${normalizedStageName}`;

      // Pre-load all stages for this pipeline in one query (M02 fix)
      await preloadStagesForPipeline(pipelineId);

      if (stageCache.has(cacheKey)) {
        const existingId = stageCache.get(cacheKey)!;
        // Fix position if divergent and not dry_run
        const currentPos = stagePositionCache.get(cacheKey);
        if (!dry_run && currentPos !== undefined && currentPos !== position) {
          const { error: updErr } = await adminClient
            .from("pipeline_stages")
            .update({ position })
            .eq("id", existingId)
            .eq("tenant_id", tenantId);
          if (!updErr) {
            stagePositionCache.set(cacheKey, position);
            console.error(`[SM Migration] Retrofix stage "${stageName}" position: ${currentPos} → ${position}`);
          }
        }
        return existingId;
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
      // console.log(`[SM Migration] Created stage "${stageName}" in pipeline ${pipelineId} → ${newStage!.id}`);
      return newStage!.id;
    }


    // ─── Helper: resolve principal pipeline from SM funnels ──
    // FIX: The deal's principal pipeline MUST always be Comercial (default).
    // SM funnels (Engenharia, Equipamento, etc.) are secondary memberships only,
    // written to deal_pipeline_stages in step C2.
    // The stage within Comercial is determined by SM proposal status (step C, line ~2381).

    async function resolvePipelinePrincipalDoFunil(
      _allFunnels: any[] | null,
      _tId: string,
      fallbackPipelineId: string,
      fallbackStageId: string | null,
      _smFunnelName?: string | null,
      _smStageName?: string | null,
    ): Promise<{ pipeline_id: string; stage_id: string | null; source: string }> {
      // Always return the canonical default pipeline as principal.
      // Stage is resolved later from SM proposal status (approved→Fechado, sent→Proposta enviada, etc.)
      const canonicalPipelineId = CANONICAL_DEFAULT_PIPELINE_ID || FALLBACK_PIPELINE_ID || fallbackPipelineId;
      const canonicalStageId = CANONICAL_DEFAULT_STAGE_ID || fallbackStageId;

      return {
        pipeline_id: canonicalPipelineId,
        stage_id: canonicalStageId,
        source: CANONICAL_DEFAULT_PIPELINE_ID ? "comercial_default" : "fallback_default",
      };
    }

    preLoadStep = "carregando deals";
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
    console.error("deals OK");

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
    // Uses solar_market_funnel_stages (stage_order) for correct ordering when available.
    preLoadStep = "carregando pipelines";
    if (!dry_run) {
      // 1) Fetch ordered stages from solar_market_funnel_stages (SSOT for SM stage order)
      const smOrderedStagesMap = new Map<string, Array<{ stage_name: string; stage_order: number }>>();
      {
        const { data: smFunnelStages } = await adminClient
          .from("solar_market_funnel_stages")
          .select("funnel_name, stage_name, stage_order")
          .eq("tenant_id", tenantId)
          .order("stage_order", { ascending: true });
        for (const row of smFunnelStages || []) {
          const fName = (row.funnel_name || "").trim();
          const sName = (row.stage_name || "").trim();
          if (!fName || !sName) continue;
          if (!smOrderedStagesMap.has(fName)) smOrderedStagesMap.set(fName, []);
          // Avoid duplicates
          const arr = smOrderedStagesMap.get(fName)!;
          if (!arr.some(s => s.stage_name === sName)) {
            arr.push({ stage_name: sName, stage_order: row.stage_order ?? arr.length });
          }
        }
      }

      // 2) Collect funnel names from project data (as before) but use ordered stages when available
      const allFunnelStages = new Map<string, Set<string>>(); // funnelName → Set<stageName> (fallback only)
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

      // 3) Merge: for each funnel, prefer ordered list from solar_market_funnel_stages
      let pipelinesCreated = 0;
      let stagesCreated = 0;
      const allFunnelNames = new Set([...allFunnelStages.keys(), ...smOrderedStagesMap.keys()]);
      for (const funnelName of allFunnelNames) {
        if (normalizeComparableName(funnelName) === "vendedores") continue;
        try {
          const pipeId = await resolveOrCreatePipeline(funnelName);
          if (!pipeId.startsWith("AUTO_CREATE")) {
            pipelinesCreated++;

            // Use ordered stages from solar_market_funnel_stages if available
            const orderedStages = smOrderedStagesMap.get(funnelName);
            if (orderedStages && orderedStages.length > 0) {
              // Also include any stages from project data not in the ordered list
              const fallbackSet = allFunnelStages.get(funnelName) || new Set<string>();
              const orderedNames = new Set(orderedStages.map(s => s.stage_name));
              const extraStages = [...fallbackSet].filter(s => !orderedNames.has(s));

              for (const s of orderedStages) {
                try {
                  await resolveOrCreateStage(pipeId, s.stage_name, s.stage_order);
                  stagesCreated++;
                } catch (e) {
                  console.warn(`[SM Migration] Pre-create stage "${s.stage_name}" error: ${(e as Error).message}`);
                }
              }
              // Append extras at the end
              let nextPos = Math.max(...orderedStages.map(s => s.stage_order), 0) + 1;
              for (const stageName of extraStages) {
                try {
                  await resolveOrCreateStage(pipeId, stageName, nextPos++);
                  stagesCreated++;
                } catch (e) {
                  console.warn(`[SM Migration] Pre-create extra stage "${stageName}" error: ${(e as Error).message}`);
                }
              }
            } else {
              // Fallback: no ordered data, use Set iteration (legacy behavior)
              console.warn(`[SM Migration] WARN: No ordered stages in solar_market_funnel_stages for funnel "${funnelName}" — using unordered fallback. Run sync funnels first for correct ordering.`);
              const stages = allFunnelStages.get(funnelName) || new Set<string>();
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
          }
        } catch (e) {
          console.warn(`[SM Migration] Pre-create pipeline "${funnelName}" error: ${(e as Error).message}`);
        }
      }
      console.error(`[SM Migration] Pre-created ${pipelinesCreated} pipelines, ${stagesCreated} stages from SM funnels (ordered)`);

      // 4) Fix position of existing stages that were created with wrong order
      let positionsFixed = 0;
      for (const [funnelName, orderedStages] of smOrderedStagesMap) {
        if (normalizeComparableName(funnelName) === "vendedores") continue;
        const mappedName = funnelName.trim() === "LEAD" ? "Comercial" : funnelName.trim();
        const pipeId = pipelineCache.get(mappedName);
        if (!pipeId || pipeId.startsWith("AUTO_CREATE")) continue;

        for (const s of orderedStages) {
          const normalizedName = normalizeComparableName(s.stage_name);
          const cacheKey = `${pipeId}::${normalizedName}`;
          const stageId = stageCache.get(cacheKey);
          const currentPos = stagePositionCache.get(cacheKey);
          if (!stageId || currentPos === undefined || currentPos === s.stage_order) continue;

          const { error: updErr } = await adminClient
            .from("pipeline_stages")
            .update({ position: s.stage_order })
            .eq("id", stageId)
            .eq("tenant_id", tenantId);
          if (!updErr) {
            stagePositionCache.set(cacheKey, s.stage_order);
            positionsFixed++;
          }
        }
      }
      if (positionsFixed > 0) {
        console.error(`[SM Migration] Fixed position of ${positionsFixed} existing stages using SM order`);
      }
    }
    console.error("pipelines OK");

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

    console.error("INICIANDO LOOP");
    inPreLoad = false;

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

    let heartbeatCounter = 0;
    let cancelledExternally = false;
    for (const smProp of proposalsToProcess) {
        // Check time budget before each proposal
        if (Date.now() - migrationStartTime > MIGRATION_TIMEOUT_MS) {
          console.error(`[SM Migration] Time budget exceeded (${MIGRATION_TIMEOUT_MS}ms). Stopping with partial results.`);
          break;
        }

        // ─── Heartbeat every 5 proposals ─────────────────────
        heartbeatCounter++;
        if (smOpRunId && (heartbeatCounter === 1 || heartbeatCounter % 3 === 0)) {
          const runStillActive = await isOperationRunActive(adminClient, smOpRunId);
          if (!runStillActive) {
            cancelledExternally = true;
            console.warn(`[SM Migration] Run ${smOpRunId} cancelled externally. Stopping current batch early.`);
            break;
          }
        }

        if (smOpRunId && heartbeatCounter % 5 === 0) {
          try {
            const successCount = (summary as any).SUCCESS || 0;
            const errorCount = (summary as any).ERROR || 0;
            await adminClient.rpc("update_sm_operation_heartbeat", {
              p_run_id: smOpRunId,
              p_processed_items: reports.length,
              p_success_items: successCount,
              p_error_items: errorCount,
              p_checkpoint: { last_sm_proposal_id: smProp.sm_proposal_id, batch_index: heartbeatCounter },
            });
          } catch (_) { /* best-effort heartbeat */ }
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
                  import_source: "solar_market",
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
                report.steps.cliente = { status: "CREATED", id: clienteId };
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
              // Check all_funnels first (richer data than sm_funnel_name)
              if (smProj?.all_funnels && Array.isArray(smProj.all_funnels)) {
                for (const f of smProj.all_funnels) {
                  const fName = String(f.funnelName || f.funnel_name || "").toLowerCase().trim();
                  const sName = String(f.stageName || f.stage_name || "").trim();
                  if (fName === "vendedores" && sName) {
                    try {
                      const { id, created } = await resolveOrCreateConsultor(sName);
                      resolvedOwnerId = id;
                      ownerAutoCreated = created;
                      ownerSource = `db_all_funnels:${sName}`;
                      (report as any).owner_resolved = { name: sName, id, created, source: "db_all_funnels" };
                    } catch (e) { /* fallthrough */ }
                    break;
                  }
                }
              }
              // Fallback: sm_funnel_name/sm_stage_name
              if ((!resolvedOwnerId || ownerSource.startsWith("manual")) && smProj?.sm_funnel_name?.toLowerCase() === "vendedores" && smProj.sm_stage_name) {
                try {
                  const { id, created } = await resolveOrCreateConsultor(smProj.sm_stage_name);
                  resolvedOwnerId = id;
                  ownerAutoCreated = created;
                  ownerSource = `db_funnel:${smProj.sm_stage_name}`;
                  (report as any).owner_resolved = { name: smProj.sm_stage_name, id, created, source: "db_vendedores" };
                } catch (e) { /* fallthrough */ }
              }
            }

            // Priority 2: Live fetch from SM API — only if DB has NO vendedor data at all
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

          if (dealId) {
            const { data: existingDealRow } = await adminClient
              .from("deals")
              .select("id")
              .eq("id", dealId)
              .maybeSingle();

            if (!existingDealRow?.id) {
              existingDeals.delete(legacyKey);
              dealId = null;
            }
          }

          // Resolve pipeline from SM funnels (auto) or fallback to UI selection
          const smProjForPipeline = smProp.sm_project_id ? smProjectMap.get(smProp.sm_project_id) : null;
          let resolved: { pipeline_id: string; stage_id: string | null; source: string };
          try {
            resolved = await resolvePipelinePrincipalDoFunil(
              smProjForPipeline?.all_funnels || null,
              tenantId,
              params.pipeline_id!,
              params.stage_id || null,
              smProjForPipeline?.sm_funnel_name || null,
              smProjForPipeline?.sm_stage_name || null,
            );
          } catch (pipeErr) {
            console.warn(`[SM Migration] Pipeline resolution error (non-fatal): ${(pipeErr as Error).message}`);
            report.steps.pipelines = { status: "ERROR", reason: `Pipeline resolution: ${(pipeErr as Error).message}` };
            resolved = { pipeline_id: FALLBACK_PIPELINE_ID, stage_id: FALLBACK_STAGE_ID, source: "fallback_after_error" };
          }

          // ALWAYS resolve stage from SM proposal status when using default/fallback pipeline.
          // FIX: Use resolveSmLifecycle (date-based) instead of raw smProp.status for accurate mapping.
          // FIX: Use semantic keyword matching instead of exact name match (SaaS — each tenant has different stage names).
          // Wrapped in try/catch to prevent stage resolution errors from aborting the entire proposal flow.
          try {
            if (!resolved.stage_id || resolved.source === "fallback_ui" || resolved.source === "comercial_default" || resolved.source === "fallback_default") {
              const smLifecycle = resolveSmLifecycle(smProp);

              // Semantic map: SM lifecycle → keywords to search in stage names (case-insensitive, normalized)
              const semanticStageMap: Record<string, string[]> = {
                "approved": ["ganho", "won", "fechado ganho", "aprovado", "fechado"],
                "generated": ["proposta enviada", "enviada", "envio", "proposta"],
                "sent":      ["proposta enviada", "enviada", "envio", "proposta"],
                "viewed":    ["negociacao", "negociação", "proposta enviada", "enviada", "visualizada"],
                "draft":     ["qualificado", "recebido", "novo", "lead", "entrada", "qualificacao"],
                "rejected":  ["perdido", "lost", "recusado", "cancelado"],
                "expired":   ["perdido", "lost", "expirado", "cancelado"],
                "cancelled": ["perdido", "cancelado", "lost"],
              };

              const keywords = semanticStageMap[smLifecycle] ?? [];

              // Pre-load stages for this pipeline (uses cache — no extra query if already loaded)
              await preloadStagesForPipeline(resolved.pipeline_id);

              // Collect all stages for this pipeline from the cache
              const pipelinePrefix = `${resolved.pipeline_id}::`;
              const pipelineStagesFromCache: Array<{ key: string; name: string; id: string }> = [];
              for (const [cKey, sId] of stageCache) {
                if (cKey.startsWith(pipelinePrefix)) {
                  pipelineStagesFromCache.push({ key: cKey, name: cKey.slice(pipelinePrefix.length), id: sId });
                }
              }

              let mappedStageId: string | null = null;

              // 1. Keyword-based search in normalized stage names
              for (const keyword of keywords) {
                const normalizedKeyword = normalizeComparableName(keyword);
                const match = pipelineStagesFromCache.find(s => s.name.includes(normalizedKeyword));
                if (match) {
                  mappedStageId = match.id;
                  break;
                }
              }

              // 2. Fallback: use is_won flag for approved/won statuses
              if (!mappedStageId && ["approved"].includes(smLifecycle)) {
                const { data: wonStages } = await adminClient
                  .from("pipeline_stages")
                  .select("id")
                  .eq("pipeline_id", resolved.pipeline_id)
                  .eq("tenant_id", tenantId)
                  .eq("is_won", true)
                  .limit(1);
                if (wonStages?.[0]) mappedStageId = wonStages[0].id;
              }

              // 3. Fallback: use is_closed flag for rejected/lost/cancelled statuses
              if (!mappedStageId && ["rejected", "expired", "cancelled"].includes(smLifecycle)) {
                const { data: closedStages } = await adminClient
                  .from("pipeline_stages")
                  .select("id")
                  .eq("pipeline_id", resolved.pipeline_id)
                  .eq("tenant_id", tenantId)
                  .eq("is_closed", true)
                  .eq("is_won", false)
                  .limit(1);
                if (closedStages?.[0]) mappedStageId = closedStages[0].id;
              }

              if (mappedStageId) {
                resolved.stage_id = mappedStageId;
                resolved.source = `sm_lifecycle:${smLifecycle}→semantic_match`;
              }

              // 4. Final fallback: first stage of the pipeline (lowest position)
              if (!resolved.stage_id) {
                const firstStage = pipelineFirstStage.get(resolved.pipeline_id);
                if (firstStage) {
                  resolved.stage_id = firstStage;
                }
              }
            }
          } catch (stageResErr) {
            console.warn(`[SM Migration] Stage resolution error (non-fatal): ${(stageResErr as Error).message}`);
            report.steps.pipelines = { status: "ERROR", reason: `Stage resolution: ${(stageResErr as Error).message}` };
          }

          // ── MANDATORY FALLBACK: Never create a deal without pipeline_id + stage_id ──
          if (!resolved.pipeline_id) {
            resolved.pipeline_id = FALLBACK_PIPELINE_ID;
            resolved.source = resolved.source || "fallback_mandatory";
          }
          if (!resolved.stage_id) {
            resolved.stage_id = FALLBACK_STAGE_ID;
            resolved.source = `fallback_mandatory:Comercial/Proposta enviada (original: ${resolved.source || "none"})`;
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
                  import_source: "solar_market",
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
              report.steps.deal = { status: "CREATED", id: dealId, reason: `pipeline: ${resolved.source}` };

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
                  const cacheKey = `${pipeId}::${normalizeComparableName(stageName)}`;
                  if (!pipeId.startsWith("AUTO_CREATE")) {
                    await preloadStagesForPipeline(pipeId);
                  }
                  const existingPosition = stagePositionCache.get(cacheKey);
                  const stgId = await resolveOrCreateStage(pipeId, stageName, existingPosition ?? 0);
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
                status: dry_run ? "WOULD_CREATE" : "CREATED",
                reason: `${pipelineDetails.length} funis mapeados`,
                details: pipelineDetails,
              };
            } else {
              report.steps.pipelines = { status: "FALLBACK_USED", reason: "Nenhum funil real com etapa encontrado — usando Comercial/Proposta enviada como padrão" };
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
                    import_source: "solar_market",
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
                    funil_id: (() => {
                      // FIX: Correct SM funnel → projeto_funis mapping.
                      // "Vendedores" is NOT a process funil — it identifies the consultor.
                      // "LEAD" maps to Engenharia (first operational step after commercial).
                      // NULL/unknown → Engenharia (default operational funil).
                      const smProj = smProp.sm_project_id ? smProjectMap.get(smProp.sm_project_id) : null;
                      const smFunnelName = smProj?.sm_funnel_name || null;
                      const normalizedFunnel = normalizeComparableName(smFunnelName);

                      // Vendedores, NULL, LEAD → Engenharia
                      if (!normalizedFunnel || normalizedFunnel === 'vendedores' || normalizedFunnel === 'lead') {
                        return projetoFunisMap.get(normalizeComparableName('Engenharia')) || FALLBACK_FUNIL_ID;
                      }

                      // Compesação (typo in SM) → Compensação
                      if (normalizedFunnel.includes('compesa') || normalizedFunnel.includes('compensa')) {
                        return projetoFunisMap.get(normalizeComparableName('Compensação'))
                          || projetoFunisMap.get(normalizeComparableName('Compesação'))
                          || FALLBACK_FUNIL_ID;
                      }

                      // Direct match (Engenharia, Equipamento, Pagamento)
                      const directMatch = projetoFunisMap.get(normalizedFunnel);
                      if (directMatch) return directMatch;

                      // Partial match
                      for (const [k, v] of projetoFunisMap) {
                        if (k.includes(normalizedFunnel) || normalizedFunnel.includes(k)) return v;
                      }

                      return FALLBACK_FUNIL_ID;
                    })(),
                    etapa_id: (() => {
                      // FIX: Correct SM stage → projeto_etapas mapping.
                      const smProj = smProp.sm_project_id ? smProjectMap.get(smProp.sm_project_id) : null;
                      const smFunnelName = smProj?.sm_funnel_name || null;
                      const normalizedFunnel = normalizeComparableName(smFunnelName);
                      const smStageName = smProj?.sm_stage_name || null;

                      // Helper: try to match SM stage name within a funil
                      const matchEtapaByName = (funilId: string, stageName: string | null): string | null => {
                        if (!stageName) return null;
                        const nameKey = `${funilId}::${normalizeComparableName(stageName)}`;
                        return funilEtapaByNameMap.get(nameKey) || null;
                      };

                      // Determine target funil
                      let targetFunilId: string | null = null;
                      if (!normalizedFunnel || normalizedFunnel === 'vendedores' || normalizedFunnel === 'lead') {
                        targetFunilId = projetoFunisMap.get(normalizeComparableName('Engenharia')) || FALLBACK_FUNIL_ID;
                        // For Vendedores/NULL/LEAD → always first etapa (Falta Documentos)
                        return funilFirstEtapaMap.get(targetFunilId) || FALLBACK_ETAPA_ID;
                      }

                      if (normalizedFunnel.includes('compesa') || normalizedFunnel.includes('compensa')) {
                        targetFunilId = projetoFunisMap.get(normalizeComparableName('Compensação'))
                          || projetoFunisMap.get(normalizeComparableName('Compesação'))
                          || FALLBACK_FUNIL_ID;
                      } else {
                        targetFunilId = projetoFunisMap.get(normalizedFunnel) || null;
                        if (!targetFunilId) {
                          for (const [k, v] of projetoFunisMap) {
                            if (k.includes(normalizedFunnel) || normalizedFunnel.includes(k)) { targetFunilId = v; break; }
                          }
                        }
                      }
                      if (!targetFunilId) return FALLBACK_ETAPA_ID;

                      // Try matching sm_stage_name by name in the target funil
                      if (smStageName) {
                        const matched = matchEtapaByName(targetFunilId, smStageName);
                        if (matched) return matched;
                      }

                      // Also try all_funnels for stage name matching
                      const funnels: any[] = smProj?.all_funnels || [];
                      for (const f of funnels) {
                        const fName = normalizeComparableName(String(f.funnelName || "").trim());
                        if (!fName || fName === "vendedores") continue;
                        const fStageName = String(f.stageName || "").trim();
                        if (fStageName) {
                          const matched = matchEtapaByName(targetFunilId, fStageName);
                          if (matched) return matched;
                        }
                      }

                      return funilFirstEtapaMap.get(targetFunilId) || FALLBACK_ETAPA_ID;
                    })(),
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
                      report.steps.projeto = { status: "CREATED", id: projetoId };
                    }
                  } else {
                    report.steps.projeto = { status: "ERROR", reason: projErr.message };
                  }
                } else {
                  projetoId = newProj!.id;
                  projetoByCodigo.set(projetoCodigo, projetoId);
                  projetoByDeal.set(dealId, projetoId);
                  report.steps.projeto = { status: "CREATED", id: projetoId };
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
                  import_source: "solar_market",
                  versao_atual: 1,
                  sm_id: smIdKey,
                  sm_project_id: smProp.sm_project_id ? String(smProp.sm_project_id) : null,
                  sm_raw_payload: null,
                  aceita_at: smProp.acceptance_date || null,
                  recusada_at: smProp.rejection_date || null,
                  enviada_at: smProp.send_at || null,
                  proposta_num: null,
                  codigo: `PROP-SM-${smProp.sm_project_id || 0}-${smProp.sm_proposal_id}`,
                  is_principal: report.steps.projeto?.status === "WOULD_CREATE" || report.steps.projeto?.status === "CREATED", // only first proposal of a project is principal
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
              report.steps.proposta_nativa = { status: "CREATED", id: propostaId };
            }
          }

          // ── F. Proposta Versão ──
          // FIX: Always attempt version creation if propostaId exists and version is missing,
          // even when proposta_nativa was WOULD_SKIP (re-run after partial migration).
          const propostaNativaSkipped = report.steps.proposta_nativa?.status === "WOULD_SKIP";
          if (propostaId && !dry_run) {
            // Check if version already exists (using pre-fetched Set)
            if (existingVersoes.has(propostaId)) {
              report.steps.proposta_versao = { status: "WOULD_SKIP" };
            } else {
              try {
              const paybackMeses = parsePaybackMonths(smProp.payback);
              const valorTotal = smProp.preco_total || smProp.valor_total || 0;
              const numParcelas = inferNumeroParcelas(smProp.payment_conditions);

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
              const inferTipoPagamento = (cond: string | null | undefined): "a_vista" | "financiamento" | "entrada" => {
                if (!cond) return "a_vista";
                const c = cond.toLowerCase();
                if (/financiamento|parcela|\d+x/.test(c)) return "financiamento";
                if (/entrada/.test(c)) return "entrada";
                return "a_vista";
              };

              const pagamentoOpcoes = [{
                id: crypto.randomUUID(),
                nome: smProp.payment_conditions || "À Vista",
                label: smProp.payment_conditions || "À Vista",
                tipo: inferTipoPagamento(smProp.payment_conditions),
                valor_financiado: valorTotal,
                entrada: 0,
                taxa_mensal: 0,
                carencia_meses: 0,
                num_parcelas: numParcelas,
                parcelas: numParcelas,
                valor_parcela: numParcelas > 1 ? Math.round(valorTotal / numParcelas * 100) / 100 : valorTotal,
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
              // Classify by prefix: cap_ → projeto, cape_ → pré-dimensionamento, capo_ → pós-dimensionamento
              // Use BASE KEY (without prefix) for dedup — cap_valor_total and cape_valor_total → same base "valor_total"
              if (smProp.custom_fields_raw?.values) {
                const cfVals = smProp.custom_fields_raw.values as Record<string, any>;
                const customFieldValues: Record<string, string> = {};
                const customFieldsByArea: Record<string, Record<string, string>> = {
                  projeto: {},
                  pre_dimensionamento: {},
                  pos_dimensionamento: {},
                  outros: {},
                };
                for (const [key, entry] of Object.entries(cfVals)) {
                  const bareKey = normalizeCfKey(key);
                  const val = (entry as any)?.value ?? (entry as any)?.raw_value ?? "";
                  if (val !== "" && val != null) {
                    const strVal = String(val);
                    const area = detectCfArea(bareKey);
                    const normalizedKey = normalizeFieldKey(bareKey);
                    // Use normalized key for snapshot dedup
                    customFieldValues[normalizedKey] = strVal;
                    customFieldsByArea[area][normalizedKey] = strVal;
                  }
                }
                if (Object.keys(customFieldValues).length > 0) {
                  finalSnapshot.customFieldValues = customFieldValues;
                }
                // Persist classified custom fields in snapshot for downstream use
                const areaEntries = Object.entries(customFieldsByArea).filter(([, v]) => Object.keys(v).length > 0);
                if (areaEntries.length > 0) {
                  finalSnapshot.customFieldsByArea = Object.fromEntries(areaEntries);
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
                // C03 fix: abort the proposal flow when version insert fails.
                // Without this, migrado_em could be stamped even though no valid version exists,
                // creating a semi-migrated "ghost" proposal invisible in the pending queue.
                report.steps.proposta_versao = { status: "ERROR", reason: verErr.message };
                report.aborted = true;
                summary.ERROR++;
                reports.push(report);
                await logItem(adminClient, tenantId, smProp.sm_proposal_id, report.sm_client_name, "ERROR", report, dry_run);
                continue;
              } else {
                report.steps.proposta_versao = { status: "CREATED", id: newVer!.id };
                existingVersoes.add(propostaId);
              }
              } catch (versionBuildErr) {
                report.steps.proposta_versao = { status: "ERROR", reason: (versionBuildErr as Error).message };
                report.aborted = true;
                summary.ERROR++;
                reports.push(report);
                await logItem(adminClient, tenantId, smProp.sm_proposal_id, report.sm_client_name, "ERROR", report, dry_run);
                continue;
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
              // Normalize key for mapping lookup: try bare key first, then normalized
              const bareKey = normalizeCfKey(key);
              const normalizedKey = normalizeFieldKey(bareKey);
              const mapping = cfMappings.get(bareKey) || cfMappings.get(normalizedKey);
              if (!mapping) {
                unmappedCf[normalizedKey] = entry;
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

          // ── G2. Persist prefix-classified custom fields to deal_custom_field_values ──
          // cap_ → projeto, cape_ → pré-dimensionamento, capo_ → pós-dimensionamento
          if (!dry_run && dealId && smProp.custom_fields_raw?.values) {
            try {
              const cfVals = smProp.custom_fields_raw.values as Record<string, any>;
              // Dedup by NORMALIZED key: "Valor Total", "valorTotal", "cap_valor_total" all → "valor_total"
              // Last-write-wins per normalized key, area from the prefix that wrote last
              const cfDeduped = new Map<string, { normalizedKey: string; value: string; area: string }>();

              for (const [key, entry] of Object.entries(cfVals)) {
                const bareKey = normalizeCfKey(key);
                const val = (entry as any)?.value ?? (entry as any)?.raw_value ?? "";
                if (val === "" || val == null) continue;
                const area = detectCfArea(bareKey);
                const normalizedKey = normalizeFieldKey(bareKey);
                // Dedup: same normalized key across prefixes → use the most specific area
                // Priority: pre/pos > projeto > outros (more specific wins)
                const existing = cfDeduped.get(normalizedKey);
                if (!existing || area !== "outros") {
                  cfDeduped.set(normalizedKey, { normalizedKey, value: String(val), area });
                }
              }

              const cfByPrefix = Array.from(cfDeduped.values());

              if (cfByPrefix.length > 0) {
                // Check existing deal_custom_fields for this tenant to find matches by NORMALIZED KEY
                const { data: existingFields } = await adminClient
                  .from("deal_custom_fields")
                  .select("id, field_key, title, field_context")
                  .eq("tenant_id", tenantId);

                const fieldByKey = new Map<string, { id: string; context: string }>();
                for (const f of existingFields || []) {
                  // Index by normalized key for consistent matching across formats
                  const existingNormKey = normalizeFieldKey(f.field_key || "");
                  fieldByKey.set(existingNormKey, { id: f.id, context: f.field_context || "outros" });
                  // Also index by raw lowercase for exact legacy matches
                  fieldByKey.set((f.field_key || "").toLowerCase(), { id: f.id, context: f.field_context || "outros" });
                }

                const valuesToInsert: Array<Record<string, any>> = [];

                for (const cf of cfByPrefix) {
                  // Try to find existing field by normalized key (deduped)
                  const existingField = fieldByKey.get(cf.normalizedKey);
                  let fieldId: string;

                  if (existingField) {
                    fieldId = existingField.id;
                  } else {
                    // Create the custom field definition using NORMALIZED KEY (no prefix, snake_case)
                    const fieldInsert = {
                      tenant_id: tenantId,
                      field_key: cf.normalizedKey,
                      title: cf.normalizedKey.replace(/_/g, " "),
                      field_type: "text",
                      field_context: cf.area,
                      is_active: true,
                    };
                    const { data: newField, error: fieldErr } = await adminClient
                      .from("deal_custom_fields")
                      .upsert(fieldInsert, { onConflict: "tenant_id,field_key" })
                      .select("id")
                      .single();

                    if (fieldErr || !newField) {
                      console.warn(`[SM Migration] Custom field create error for ${cf.normalizedKey}: ${fieldErr?.message}`);
                      continue;
                    }
                    fieldId = newField.id;
                    fieldByKey.set(cf.normalizedKey, { id: fieldId, context: cf.area });
                  }

                  valuesToInsert.push({
                    tenant_id: tenantId,
                    deal_id: dealId,
                    field_id: fieldId,
                    value_text: cf.value,
                  });
                }

                // Batch upsert values (idempotent via deal_id + field_id)
                if (valuesToInsert.length > 0) {
                  const { error: valErr } = await adminClient
                    .from("deal_custom_field_values")
                    .upsert(valuesToInsert, { onConflict: "deal_id,field_id" });
                  if (valErr) {
                    console.warn(`[SM Migration] Custom field values upsert error: ${valErr.message}`);
                  }
                }

                (report as any).custom_fields_by_prefix = {
                  projeto: cfByPrefix.filter(c => c.area === "projeto").length,
                  pre_dimensionamento: cfByPrefix.filter(c => c.area === "pre_dimensionamento").length,
                  pos_dimensionamento: cfByPrefix.filter(c => c.area === "pos_dimensionamento").length,
                  outros: cfByPrefix.filter(c => c.area === "outros").length,
                };
              }
            } catch (cfPrefixErr) {
              console.warn(`[SM Migration] Custom field prefix classification error: ${(cfPrefixErr as Error).message}`);
            }
          }

          // Determine overall status for logging
          const allSteps = Object.values(report.steps);
          const hasError = allSteps.some((s) => s.status === "ERROR");
          const allSkip = allSteps.every((s) => s.status === "WOULD_SKIP" || s.status === "FALLBACK_USED");
          const overallStatus = hasError ? "ERROR" : allSkip ? "SKIP" : "SUCCESS";

          if (!dry_run) {
            summary[overallStatus === "SKIP" ? "WOULD_SKIP" : overallStatus === "SUCCESS" ? "SUCCESS" : "ERROR"]++;

            const propostaStepOk = ["CREATED", "WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP", "FALLBACK_USED", "SUCCESS"].includes(report.steps.proposta_nativa?.status || "");
            const versaoStepOk = ["CREATED", "WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP", "FALLBACK_USED", "SUCCESS"].includes(report.steps.proposta_versao?.status || "");

            // Stamp migrado_em when migration succeeded OR everything was already migrated (all SKIP)
            const shouldStamp = (overallStatus === "SUCCESS" && propostaId && propostaStepOk && versaoStepOk) || overallStatus === "SKIP";
            if (shouldStamp) {
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
          const errMsg = (err as Error).message || String(err);
          report._error = errMsg;
          report.steps._fatal = { status: "ERROR", reason: errMsg };
          if (!report.steps.cliente) {
            report.steps.cliente = { status: "ERROR", reason: errMsg };
          }
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
          console.error(`[SM Migration] Group B time budget exceeded, stopping early`);
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

          // Resolve client from pre-loaded smClientMap
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

          // C01 fix: Resolve canonical client using pre-loaded Maps (same O(1) pattern as Group A).
          // Eliminates 4 direct DB queries per project in the Group B loop.
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
                  import_source: "solar_market",
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
                groupBReport.steps.cliente = { status: "CREATED", id: clienteId };
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
                import_source: "solar_market",
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
              groupBReport.steps.projeto = { status: "CREATED", id: newProj!.id };
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

    const successCount = (summary as any).SUCCESS || 0;
    const errorCount = (summary as any).ERROR || 0;
    const skipCount = (summary as any).SKIP || (summary as any).WOULD_SKIP || 0;
    let pendingAfter: number | null = null;
    let backgroundMigrationEnabled = false;

    if (!dry_run && params.auto_resume) {
      const { count } = await adminClient
        .from("solar_market_proposals")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("migrado_em", null);
      pendingAfter = count || 0;
      (result as Record<string, unknown>).pending_after = pendingAfter;
      (result as Record<string, unknown>).completed = pendingAfter === 0;
      backgroundMigrationEnabled = await isBackgroundMigrationEnabled(adminClient, tenantId);
      (result as Record<string, unknown>).background_migration_enabled = backgroundMigrationEnabled;
      (result as Record<string, unknown>).cancelled = cancelledExternally;
    }

    // ─── SSOT: Release lock with final counts ─────────────
    if (smOpRunId && !cancelledExternally) {
      try {
        await adminClient.rpc("release_sm_operation_lock", {
          p_run_id: smOpRunId,
          p_status: errorCount > 0 && successCount === 0 ? "failed" : "completed",
          p_total_items: allProposals.length,
          p_processed_items: reports.length,
          p_success_items: successCount,
          p_error_items: errorCount,
          p_skipped_items: skipCount,
          p_checkpoint: { last_batch_size: reports.length, time_budget_exceeded: timeBudgetExceeded },
        });
      } catch (_) { /* best-effort */ }
    }

    if (!dry_run && params.auto_resume) {
      if (pendingAfter === 0) {
        await adminClient
          .from("sm_migration_settings")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId);
      } else if (!backgroundMigrationEnabled) {
        console.warn(`[SM Migration] Auto-resume stopped by user for tenant ${tenantId}; skipping next dispatch.`);
      } else if ((successCount > 0 || skipCount > 0) && params.pipeline_id) {
        dispatchBackgroundMigrationRun({
          supabaseUrl,
          serviceKey,
          tenantId,
          pipelineId: params.pipeline_id,
          stageId: params.stage_id || null,
          ownerId: params.owner_id || null,
          autoResolveOwner,
          batchSize: Math.max(1, Math.min(Number(batch_size || 25), 100)),
        });
      } else {
        await adminClient
          .from("sm_migration_settings")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId);
        console.warn("[SM Migration] Auto-resume paused after a batch with no progress.");
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    } catch (error) {
      if (inPreLoad) {
        const preLoadError = error instanceof Error ? error : new Error(String(error));
        console.error("PRELOAD ERROR:", {
          step: preLoadStep,
          error: preLoadError.message,
          stack: preLoadError.stack,
        });
        const wrappedPreLoadError = new Error(`ERRO PRE-LOAD [${preLoadStep}]: ${preLoadError.message}`);
        wrappedPreLoadError.stack = preLoadError.stack;
        throw wrappedPreLoadError;
      }
      throw error;
    }
  } catch (err) {
    console.error("ERR", { step: "fatal", err: (err as Error).message, stack: (err as Error).stack });
    // ─── SSOT: Release lock as failed on fatal error ────
    if (typeof smOpRunId !== "undefined" && smOpRunId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const fallbackClient = createClient(supabaseUrl, serviceKey);
        await fallbackClient.rpc("release_sm_operation_lock", {
          p_run_id: smOpRunId,
          p_status: "failed",
          p_error_summary: ((err as Error).message || "Fatal error").slice(0, 1000),
        });
      } catch (_) { /* best-effort */ }
    }
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
    const validStatuses = ["SUCCESS", "SKIP", "CONFLICT", "ERROR", "WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP", "FALLBACK_USED"];
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
