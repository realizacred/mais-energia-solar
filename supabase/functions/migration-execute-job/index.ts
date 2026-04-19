/**
 * migration-execute-job — Executa um job de migração SolarMarket conforme job_type.
 *
 * Body: { job_id: string }
 *
 * job_types suportados:
 *   - classify_projects   → classifica projetos SM em sm_classification_v2
 *   - migrate_clients     → migra solar_market_clients → clientes
 *   - migrate_projects    → migra solar_market_projects → projetos (requer cliente + classificação)
 *   - migrate_proposals   → migra solar_market_proposals → propostas_nativas (requer projeto)
 *   - full_migration      → executa as 4 etapas em ordem
 *
 * Idempotência: clientes por CPF/CNPJ ou email; projetos por sm_project_id; propostas por sm_proposal_id.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

declare const EdgeRuntime:
  | {
      waitUntil?: (promise: Promise<unknown>) => void;
    }
  | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Counters = { migrated: number; skipped: number; failed: number; ignored?: number };
const DEFAULT_BATCH_SIZE = 200;
const REQUEUE_BASE_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
type ProcessBatchResult = { counters: Counters; hasMore: boolean; nextOffset: number | null };
type JobStage = "classify_projects" | "migrate_clients" | "migrate_projects" | "migrate_proposals";

const STALL_THRESHOLD_MS = 2 * 60 * 1000; // 2 min sem heartbeat → travado

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const CRON_SECRET = Deno.env.get("CRON_SECRET");
    if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "Server config error" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const auth = req.headers.get("Authorization") ?? "";
    const cronHeader = req.headers.get("x-cron-secret") ?? "";
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode ?? "execute");

    // ---------- WATCHDOG MODE ----------
    // Autenticação: CRON_SECRET (header) OU bearer service_role
    if (mode === "watchdog") {
      const isCron = CRON_SECRET && cronHeader === CRON_SECRET;
      const isService = auth === `Bearer ${SERVICE_ROLE}`;
      if (!isCron && !isService) return json({ error: "Unauthorized (watchdog)" }, 401);

      const cutoff = new Date(Date.now() - STALL_THRESHOLD_MS).toISOString();
      const { data: stalled } = await admin
        .from("migration_jobs")
        .select("id, metadata, started_at")
        .eq("status", "running")
        .order("started_at", { ascending: true })
        .limit(20);

      const resumed: string[] = [];
      for (const j of stalled ?? []) {
        const hb = (j as any)?.metadata?.last_heartbeat_at as string | undefined;
        const last = hb ?? (j as any)?.started_at ?? null;
        if (!last || new Date(last).getTime() < new Date(cutoff).getTime()) {
          // dispara retomada via service_role (bypassa Job already running pois passa offset/stage)
          const prog = (j as any)?.metadata?.progress ?? {};
          const off = Number(prog?.offset ?? 0);
          const bs = Number(prog?.batch_size ?? DEFAULT_BATCH_SIZE);
          const st = (prog?.stage ?? null) as JobStage | null;
          runInBackground(
            fetch(`${REQUEUE_BASE_URL}/migration-execute-job`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
              body: JSON.stringify({ job_id: (j as any).id, offset: off > 0 ? off : 0, batch_size: bs, stage: st, resume: true }),
            }).then((r) => r.text()),
          );
          resumed.push((j as any).id);
        }
      }
      return json({ ok: true, resumed_count: resumed.length, resumed }, 200);
    }

    // ---------- EXECUTE MODE ----------
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const isService = auth === `Bearer ${SERVICE_ROLE}`;
    if (!isService) {
      const { data: userData, error: userErr } = await admin.auth.getUser(auth.replace("Bearer ", ""));
      if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
    }

    const job_id = String(body?.job_id ?? "");
    const requestedOffset = Number(body?.offset ?? 0);
    const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? Math.floor(requestedOffset) : 0;
    const requestedBatchSize = Number(body?.batch_size ?? DEFAULT_BATCH_SIZE);
    const batchSize = Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
      ? Math.min(Math.floor(requestedBatchSize), 500)
      : DEFAULT_BATCH_SIZE;
    const stageFromBody = String(body?.stage ?? jobStageFromMetadata(body?.metadata ?? null, null)) as JobStage | "";
    const isResume = Boolean(body?.resume);
    if (!job_id) return json({ error: "job_id required" }, 400);

    const { data: job } = await admin
      .from("migration_jobs")
      .select("*")
      .eq("id", job_id)
      .single();
    if (!job) return json({ error: "Job not found" }, 404);
    if (offset > 0 && job.status !== "running") {
      return json({ status: job.status, skipped: true }, 200);
    }
    // Permite retomada por watchdog/manual mesmo quando running
    if (job.status === "running" && offset === 0 && !isResume) {
      return json({ error: "Job already running" }, 409);
    }

    // ---------- LOCK IDEMPOTENTE NO RESUME ----------
    // Evita que watchdog (cron) + clique manual disparem 2x simultaneamente.
    // Compare-and-swap: só permite o resume se o heartbeat atual ainda é o que lemos
    // E está realmente travado (>STALL_THRESHOLD). Caso contrário, abortamos silenciosamente.
    if (isResume && job.status === "running") {
      const currentHb = (job.metadata as any)?.last_heartbeat_at ?? job.started_at ?? null;
      const ageMs = currentHb ? Date.now() - new Date(currentHb).getTime() : Infinity;
      if (ageMs < STALL_THRESHOLD_MS) {
        return json({ status: "running", skipped: true, reason: "not_stalled" }, 200);
      }
      // Tenta adquirir o lock atualizando heartbeat APENAS se ainda for o mesmo valor lido.
      const newHb = new Date().toISOString();
      const lockQuery = admin
        .from("migration_jobs")
        .update({ metadata: { ...(job.metadata ?? {}), last_heartbeat_at: newHb } })
        .eq("id", job_id);
      const { data: locked, error: lockErr } = currentHb
        ? await lockQuery.eq("metadata->>last_heartbeat_at", currentHb).select("id")
        : await lockQuery.select("id");
      if (lockErr || !locked || locked.length === 0) {
        return json({ status: "running", skipped: true, reason: "lock_lost" }, 200);
      }
    }

    if (offset === 0 && !isResume) {
      await admin
        .from("migration_jobs")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
          metadata: {
            ...(job.metadata ?? {}),
            last_heartbeat_at: new Date().toISOString(),
            progress: { offset: 0, batch_size: batchSize, has_more: false, stage: stageFromBody || null },
          },
        })
        .eq("id", job_id);
    } else {
      await admin
        .from("migration_jobs")
        .update({
          metadata: {
            ...(job.metadata ?? {}),
            last_heartbeat_at: new Date().toISOString(),
          },
        })
        .eq("id", job_id);
    }

    const tenant_id = job.tenant_id as string;
    const currentStage = job.job_type === "full_migration"
      ? jobStageFromMetadata(job.metadata ?? null, stageFromBody || "classify_projects")
      : null;
    const allCounters: Record<string, Counters> = {};
    let hasMore = false;
    let nextOffset: number | null = null;
    let nextStage: JobStage | null = currentStage;

    try {
      switch (job.job_type) {
        case "classify_projects":
          ({ counters: allCounters.classify, hasMore, nextOffset } = await classifyProjects(admin, tenant_id, job_id, offset, batchSize));
          break;
        case "migrate_clients":
          ({ counters: allCounters.clients, hasMore, nextOffset } = await migrateClients(admin, tenant_id, job_id, offset, batchSize));
          break;
        case "migrate_projects":
          // Auxiliar: migra apenas projetos SM sem proposta (órfãos).
          ({ counters: allCounters.projects, hasMore, nextOffset } = await migrateProjects(admin, tenant_id, job_id, offset, batchSize));
          break;
        case "migrate_proposals":
          // Proposal-first: resolve/cria cliente e projeto on-demand a partir da proposta.
          ({ counters: allCounters.proposals, hasMore, nextOffset } = await migrateProposals(admin, tenant_id, job_id, offset, batchSize));
          break;
        case "full_migration":
          // Novo fluxo: classify → clients → proposals (cria projetos on-demand) → projects (órfãos)
          if (currentStage === "classify_projects") {
            ({ counters: allCounters.classify, hasMore, nextOffset } = await classifyProjects(admin, tenant_id, job_id, offset, batchSize));
            nextStage = hasMore ? "classify_projects" : "migrate_clients";
          } else if (currentStage === "migrate_clients") {
            ({ counters: allCounters.clients, hasMore, nextOffset } = await migrateClients(admin, tenant_id, job_id, offset, batchSize));
            nextStage = hasMore ? "migrate_clients" : "migrate_proposals";
          } else if (currentStage === "migrate_proposals") {
            ({ counters: allCounters.proposals, hasMore, nextOffset } = await migrateProposals(admin, tenant_id, job_id, offset, batchSize));
            nextStage = hasMore ? "migrate_proposals" : "migrate_projects";
          } else {
            ({ counters: allCounters.projects, hasMore, nextOffset } = await migrateProjects(admin, tenant_id, job_id, offset, batchSize));
            nextStage = hasMore ? "migrate_projects" : null;
          }
          break;
        default:
          throw new Error(`Unsupported job_type: ${job.job_type}`);
      }

      // Requeue interno usa service_role (não depende do JWT do usuário)
      const requeueAuth = `Bearer ${SERVICE_ROLE}`;

      if (hasMore && nextOffset !== null) {
        await admin
          .from("migration_jobs")
          .update({
            metadata: {
              ...(job.metadata ?? {}),
              last_heartbeat_at: new Date().toISOString(),
              counters: { ...(job.metadata?.counters ?? {}), ...allCounters },
              progress: { offset: nextOffset, batch_size: batchSize, has_more: true, stage: nextStage },
            },
          })
          .eq("id", job_id);

        runInBackground(requeueJob(job_id, requeueAuth, nextOffset, batchSize, nextStage));
        return json({ status: "running", counters: allCounters, next_offset: nextOffset }, 202);
      }

      if (job.job_type === "full_migration" && nextStage) {
        await admin
          .from("migration_jobs")
          .update({
            metadata: {
              ...(job.metadata ?? {}),
              last_heartbeat_at: new Date().toISOString(),
              counters: { ...(job.metadata?.counters ?? {}), ...allCounters },
              progress: { offset: 0, batch_size: batchSize, has_more: true, stage: nextStage },
            },
          })
          .eq("id", job_id);

        runInBackground(requeueJob(job_id, requeueAuth, 0, batchSize, nextStage));
        return json({ status: "running", counters: allCounters, next_stage: nextStage }, 202);
      }

      const { error: completeError } = await admin
        .from("migration_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          metadata: {
            ...(job.metadata ?? {}),
            last_heartbeat_at: new Date().toISOString(),
            counters: { ...(job.metadata?.counters ?? {}), ...allCounters },
            progress: { offset: 0, batch_size: batchSize, has_more: false },
          },
        })
        .eq("id", job_id);

      if (completeError) throw completeError;

      return json({ status: "completed", counters: allCounters }, 200);
    } catch (e) {
      const { error: failError } = await admin
        .from("migration_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: (e as Error).message,
        })
        .eq("id", job_id);
      if (failError) {
        return json({ status: "failed", error: `${(e as Error).message} | status_update_failed: ${failError.message}`, counters: allCounters }, 500);
      }
      return json({ status: "failed", error: (e as Error).message, counters: allCounters }, 500);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

// ============================================================
// CLASSIFICAÇÃO
// ============================================================

function classifyByText(funilName: string | null, stageName: string | null): {
  category: string;
  reason: string;
  confidence: number;
} {
  const f = (funilName ?? "").toLowerCase().trim();
  const s = (stageName ?? "").toLowerCase().trim();

  // 0) LEAD → não migra (Item 2 — Regras Lead/Vendedor)
  //    Funil "Lead"/"Leads" no SM é pré-comercial; não vira deal/projeto.
  if (/^lead(s)?$/i.test(f)) {
    return { category: "lead_ignored", reason: "funil_lead_nao_migra", confidence: 1 };
  }

  // 1) Perda em qualquer funil → comercial/perdido
  if (/perdido|perda|cancelad/i.test(f) || /perdido|perda|cancelad/i.test(s)) {
    return { category: "comercial", reason: "lost_or_cancelled", confidence: 0.95 };
  }
  // 2) Compensação (com variação ortográfica)
  if (/compensa[cç][aã]o|compesa[cç][aã]o/i.test(f)) {
    return { category: "compensacao", reason: "funil_compensacao", confidence: 0.95 };
  }
  // 3) Engenharia
  if (/engenharia|t[eé]cnico|homologa[cç][aã]o/i.test(f)) {
    return { category: "engenharia", reason: "funil_engenharia", confidence: 0.95 };
  }
  // 4) Equipamento
  if (/equipamento|log[ií]stica|kit/i.test(f)) {
    return { category: "equipamento", reason: "funil_equipamento", confidence: 0.95 };
  }
  // 5) Vendedor / Comercial → Pipeline Comercial padrão (Item 2)
  //    Vendedor vira Consultor responsável; deal vai para Comercial na etapa
  //    equivalente por nome (resolvida em resolveComercialEtapaByName).
  if (/comercial|venda|vendedor|consultor/i.test(f)) {
    return { category: "comercial", reason: "funil_vendedor_ou_comercial", confidence: 0.9 };
  }
  // 6) Funil vazio → comercial default (sem fallback silencioso: motivo registrado)
  if (!f) {
    return { category: "comercial", reason: "funil_vazio_default_comercial", confidence: 0.6 };
  }
  // 7) Default
  return { category: "verificar_dados", reason: "no_match", confidence: 0.3 };
}

/**
 * Garante que existem os pipelines canônicos (Comercial, Engenharia, Equipamento,
 * Compensação, Verificar Dados) na tabela NATIVA `pipelines` (name/kind=process)
 * com pelo menos uma etapa em `pipeline_stages` (name/position/pipeline_id).
 *
 * Mantém o shape `{ funil_id, etapa_id }` para preservar todos os callers existentes.
 * funil_id  = pipelines.id
 * etapa_id  = pipeline_stages.id (primeira etapa por position)
 */
async function ensureCanonicalFunis(admin: SupabaseClient, tenant_id: string) {
  const cats = ["comercial", "engenharia", "equipamento", "compensacao", "verificar_dados"];
  const map: Record<string, { funil_id: string; etapa_id: string }> = {};

  for (const cat of cats) {
    const nome = cat === "verificar_dados" ? "Verificar Dados" : capitalize(cat);

    let { data: pipe } = await admin
      .from("pipelines")
      .select("id")
      .eq("tenant_id", tenant_id)
      .ilike("name", nome)
      .maybeSingle();

    if (!pipe) {
      const { data: created, error } = await admin
        .from("pipelines")
        .insert({ tenant_id, name: nome, kind: "process", is_active: true })
        .select("id")
        .single();
      if (error) throw error;
      pipe = created;
    }

    let { data: stage } = await admin
      .from("pipeline_stages")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("pipeline_id", pipe!.id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!stage) {
      const { data: createdStage, error } = await admin
        .from("pipeline_stages")
        .insert({ tenant_id, pipeline_id: pipe!.id, name: "Novo", position: 0 })
        .select("id")
        .single();
      if (error) throw error;
      stage = createdStage;
    }

    map[cat] = { funil_id: pipe!.id, etapa_id: stage!.id };
  }
  return map;
}

/**
 * Item 2 — Etapa equivalente por nome no pipeline Comercial.
 * Procura etapa com mesmo nome (case-insensitive) dentro do pipeline Comercial.
 * Se não existir, cria preservando o nome do SM.
 * Retorna null se stageName for vazio (caller usa etapa default do canonical).
 */
async function resolveComercialEtapaByName(
  admin: SupabaseClient,
  tenant_id: string,
  comercialPipelineId: string,
  stageName: string | null,
): Promise<string | null> {
  const nome = (stageName ?? "").trim();
  if (!nome) return null;

  const { data: existing } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("pipeline_id", comercialPipelineId)
    .ilike("name", nome)
    .maybeSingle();

  if (existing) return (existing as any).id;

  // Cria etapa equivalente — preserva nome do SM
  const { data: maxPos } = await admin
    .from("pipeline_stages")
    .select("position")
    .eq("tenant_id", tenant_id)
    .eq("pipeline_id", comercialPipelineId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = ((maxPos as any)?.position ?? -1) + 1;

  const { data: created, error } = await admin
    .from("pipeline_stages")
    .insert({ tenant_id, pipeline_id: comercialPipelineId, name: nome, position: nextPos })
    .select("id")
    .single();
  if (error) throw error;
  return (created as any).id;
}

/**
 * Mapa canônico SM proposal.status → nome da etapa no pipeline Comercial nativo.
 * Os 5 status reais do SolarMarket; outros viram null (caller mantém etapa default).
 */
const STATUS_TO_COMERCIAL_STAGE: Record<string, string> = {
  created:   "Recebido",
  generated: "Enviar Proposta",
  sent:      "Proposta enviada",
  viewed:    "Negociação",
  approved:  "Fechado",
};

function comercialStageNameFromStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  return STATUS_TO_COMERCIAL_STAGE[String(status).trim().toLowerCase()] ?? null;
}

/**
 * Resolve consultor_id nativo a partir do nome do "vendedor" no SM
 * (sm_stage_name quando sm_funnel_name = "Vendedores").
 *
 * Lê de sm_consultor_mapping (tenant-scoped). Match case-insensitive por sm_name
 * exato OU por prefixo (ex: "Bruno Bandeira" casa com sm_name="Bruno").
 * Retorna null se não houver mapeamento — caller decide se grava ou deixa nulo.
 */
async function resolveConsultorIdFromSmStage(
  admin: SupabaseClient,
  tenant_id: string,
  smStageName: string | null,
): Promise<string | null> {
  const raw = (smStageName ?? "").trim();
  if (!raw) return null;

  const { data: mappings } = await admin
    .from("sm_consultor_mapping")
    .select("sm_name, consultor_id")
    .eq("tenant_id", tenant_id);

  if (!mappings || mappings.length === 0) return null;

  const lower = raw.toLowerCase();
  // 1) match exato (case-insensitive)
  const exact = (mappings as any[]).find((m) => String(m.sm_name).trim().toLowerCase() === lower);
  if (exact?.consultor_id) return exact.consultor_id as string;
  // 2) prefixo (sm_name é prefixo de smStageName ou vice-versa)
  const prefix = (mappings as any[]).find((m) => {
    const name = String(m.sm_name).trim().toLowerCase();
    return lower.startsWith(name) || name.startsWith(lower);
  });
  return prefix?.consultor_id ?? null;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Hash determinístico simples para tracking_id numérico estável a partir de UUID. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function jobStageFromMetadata(metadata: any, fallback: JobStage | null): JobStage | null {
  const stage = metadata?.progress?.stage ?? fallback;
  return stage === "classify_projects" || stage === "migrate_clients" || stage === "migrate_projects" || stage === "migrate_proposals"
    ? stage
    : fallback;
}

async function requeueJob(
  job_id: string,
  authHeader: string,
  offset: number,
  batch_size: number,
  stage: JobStage | null,
) {
  await fetch(`${REQUEUE_BASE_URL}/migration-execute-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ job_id, offset, batch_size, stage }),
  });
}

function runInBackground(task: Promise<unknown>) {
  const runtime = typeof EdgeRuntime !== "undefined" ? EdgeRuntime : undefined;
  if (runtime?.waitUntil) {
    runtime.waitUntil(task);
    return;
  }
  task.catch(console.error);
}

async function classifyProjects(
  admin: SupabaseClient,
  tenant_id: string,
  job_id: string,
  offset = 0,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<ProcessBatchResult> {
  const counters: Counters = { migrated: 0, skipped: 0, failed: 0 };
  const canonical = await ensureCanonicalFunis(admin, tenant_id);

  const { data: projects } = await admin
    .from("solar_market_projects")
    .select("sm_project_id, sm_funnel_name, sm_stage_name")
    .eq("tenant_id", tenant_id)
    .order("sm_project_id", { ascending: true })
    .range(offset, offset + batchSize - 1);

  for (const p of projects ?? []) {
    const sm_project_id = (p as any).sm_project_id as number;
    try {
      const { category, reason, confidence } = classifyByText(
        (p as any).sm_funnel_name,
        (p as any).sm_stage_name,
      );

      // Item 2 — Lead não migra: registra classificação especial e segue
      if (category === "lead_ignored") {
        const { error } = await admin
          .from("sm_classification_v2")
          .upsert(
            {
              tenant_id,
              sm_project_id,
              category,
              target_funil_id: null,
              target_etapa_id: null,
              confidence_score: confidence,
              classification_reason: reason,
            },
            { onConflict: "tenant_id,sm_project_id" },
          );
        if (error) throw error;
        await recordSkip(admin, job_id, tenant_id, "project", sm_project_id, "lead_nao_migra");
        counters.ignored = (counters.ignored ?? 0) + 1;
        continue;
      }

      const target = canonical[category];

      // Item 2 — Comercial: usar etapa equivalente por nome do SM
      let target_etapa_id = target.etapa_id;
      if (category === "comercial") {
        const resolved = await resolveComercialEtapaByName(
          admin,
          tenant_id,
          target.funil_id,
          (p as any).sm_stage_name ?? null,
        );
        if (resolved) target_etapa_id = resolved;
      }

      const { error } = await admin
        .from("sm_classification_v2")
        .upsert(
          {
            tenant_id,
            sm_project_id,
            category,
            target_funil_id: target.funil_id,
            target_etapa_id,
            confidence_score: confidence,
            classification_reason: reason,
          },
          { onConflict: "tenant_id,sm_project_id" },
        );
      if (error) throw error;

      await recordOk(admin, job_id, tenant_id, "project", sm_project_id);
      counters.migrated++;
    } catch (e) {
      await recordFail(admin, job_id, tenant_id, "project", sm_project_id, (e as Error).message);
      counters.failed++;
    }
  }
  const hasMore = (projects?.length ?? 0) === batchSize;
  return { counters, hasMore, nextOffset: hasMore ? offset + batchSize : null };
}

// ============================================================
// CLIENTES
// ============================================================

async function migrateClients(
  admin: SupabaseClient,
  tenant_id: string,
  job_id: string,
  offset = 0,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<ProcessBatchResult> {
  const counters: Counters = { migrated: 0, skipped: 0, failed: 0 };

  const { data: clients } = await admin
    .from("solar_market_clients")
    .select("*")
    .eq("tenant_id", tenant_id)
    .order("sm_client_id", { ascending: true })
    .range(offset, offset + batchSize - 1);

  for (const c of clients ?? []) {
    const sm_client_id = (c as any).sm_client_id as number;
    try {
      // Mapeamento: solar_market_clients usa colunas em inglês (name/phone/document)
      const nome = String((c as any).name ?? "").trim();
      if (nome.length < 3) {
        await recordSkip(admin, job_id, tenant_id, "client", sm_client_id, `nome inválido (name="${(c as any).name ?? ""}")`);
        counters.skipped++;
        continue;
      }

      const cpfCnpj = (c as any).document ?? null;
      const email = (c as any).email ?? null;
      const telefone = String((c as any).phone ?? "").trim() || "—";

      // Normaliza telefone (apenas dígitos) para casar com uq_clientes_tenant_telefone
      const telDigits = telefone.replace(/\D/g, "");

      // Endereço: prioriza colunas planas; cai no jsonb `address` se necessário
      const addr = ((c as any).address ?? {}) as Record<string, any>;
      const rua = (c as any).address && typeof addr === "object" ? (addr.street ?? addr.rua ?? null) : null;
      const fullPayload: Record<string, any> = {
        empresa: (c as any).company ?? null,
        cep: (c as any).zip_code ?? addr.zip_code ?? addr.cep ?? null,
        rua: rua,
        numero: (c as any).number ?? addr.number ?? addr.numero ?? null,
        complemento: (c as any).complement ?? addr.complement ?? addr.complemento ?? null,
        bairro: (c as any).neighborhood ?? addr.neighborhood ?? addr.bairro ?? null,
        cidade: (c as any).city ?? addr.city ?? addr.cidade ?? null,
        estado: (c as any).state ?? addr.state ?? addr.estado ?? null,
      };
      // Remove chaves nulas para não sobrescrever dados existentes em UPDATE
      const enrich = Object.fromEntries(
        Object.entries(fullPayload).filter(([, v]) => v !== null && v !== undefined && v !== ""),
      );

      // Idempotência em ordem de força do identificador (RB-50, DA-40):
      //   1) sm_client_id (vínculo canônico SM↔nativo)
      //   2) cpf_cnpj      (identificador legal forte)
      //   3) email         (identificador médio)
      //   4) telefone      (último recurso — pode haver homônimos)
      // Buscar separadamente evita merge incorreto via OR amplo.
      let nativeId: string | null = null;
      const findExisting = async () => {
        const tries: Array<[string, any]> = [
          ["sm_client_id", sm_client_id],
          cpfCnpj ? ["cpf_cnpj", cpfCnpj] : null,
          email ? ["email", email] : null,
          telDigits.length >= 8 ? ["telefone_normalized", telDigits] : null,
        ].filter(Boolean) as Array<[string, any]>;
        for (const [col, val] of tries) {
          const { data } = await admin
            .from("clientes")
            .select("id, sm_client_id")
            .eq("tenant_id", tenant_id)
            .eq(col, val)
            .limit(1)
            .maybeSingle();
          if (data) return data;
        }
        return null;
      };
      const existing = await findExisting();

      if (existing) {
        nativeId = (existing as any).id;
        // Vínculo + enriquecimento não-destrutivo (só preenche campos vazios)
        const updates: Record<string, any> = { ...enrich };
        if (!(existing as any).sm_client_id) {
          updates.sm_client_id = sm_client_id;
          updates.import_source = "solar_market";
        }
        if (Object.keys(updates).length > 0) {
          await admin.from("clientes").update(updates).eq("id", nativeId);
        }
        await recordSkip(
          admin,
          job_id,
          tenant_id,
          "client",
          sm_client_id,
          `cliente já existe no destino (id=${nativeId}; enriquecido com ${Object.keys(updates).length} campos)`,
          nativeId,
        );
        counters.skipped++;
        continue;
      }

      const cliente_code = `SM-${sm_client_id}`;
      const { data: inserted, error } = await admin
        .from("clientes")
        .insert({
          tenant_id,
          cliente_code,
          nome,
          telefone,
          cpf_cnpj: cpfCnpj,
          email,
          sm_client_id,
          import_source: "solar_market",
          ativo: true,
          ...enrich,
        })
        .select("id")
        .single();

      if (error) {
        const errAny = error as any;
        const errMsg = String(errAny?.message ?? "");
        const isDup =
          errAny?.code === "23505" ||
          /duplicate key|unique constraint/i.test(errMsg);
        // Fallback de corrida: re-procura usando os mesmos identificadores em ordem.
        if (isDup) {
          const dup = await findExisting();
          if (dup) {
            nativeId = (dup as any).id;
            if (!(dup as any).sm_client_id) {
              await admin
                .from("clientes")
                .update({ sm_client_id, import_source: "solar_market" })
                .eq("id", nativeId);
            }
            await recordSkip(
              admin, job_id, tenant_id, "client", sm_client_id,
              `cliente já existe no destino (id=${nativeId}; match após conflito)`,
              nativeId,
            );
            counters.skipped++;
            continue;
          }
          await recordSkip(
            admin, job_id, tenant_id, "client", sm_client_id,
            `duplicado no destino mas sem match recuperável (telefone="${telefone}")`,
          );
          counters.skipped++;
          continue;
        }
        throw error;
      }
      nativeId = (inserted as any).id;

      await recordOk(admin, job_id, tenant_id, "client", sm_client_id, nativeId);
      counters.migrated++;
    } catch (e) {
      await recordFail(admin, job_id, tenant_id, "client", sm_client_id, (e as Error).message);
      counters.failed++;
    }
  }
  const hasMore = (clients?.length ?? 0) === batchSize;
  return { counters, hasMore, nextOffset: hasMore ? offset + batchSize : null };
}

// ============================================================
// PROJETOS (modo auxiliar — apenas órfãos sem proposta)
// ============================================================

/**
 * migrateProjects (auxiliar/órfãos)
 *
 * No fluxo proposal-first, a maior parte dos projetos é criada por
 * `migrateProposals` sob demanda. Esta função processa apenas projetos
 * SM que NÃO têm proposta associada — para não deixá-los órfãos.
 */
async function migrateProjects(
  admin: SupabaseClient,
  tenant_id: string,
  job_id: string,
  offset = 0,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<ProcessBatchResult> {
  const counters: Counters = { migrated: 0, skipped: 0, failed: 0 };
  const canonical = await ensureCanonicalFunis(admin, tenant_id);

  const { data: projects } = await admin
    .from("solar_market_projects")
    .select("sm_project_id, sm_client_id, name, sm_funnel_name, sm_stage_name")
    .eq("tenant_id", tenant_id)
    .order("sm_project_id", { ascending: true })
    .range(offset, offset + batchSize - 1);

  for (const p of projects ?? []) {
    const sm_project_id = (p as any).sm_project_id as number;
    try {
      // Pula se já existe projeto nativo vinculado (criado por proposals ou run anterior)
      const { data: existingByLink } = await admin
        .from("projetos")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("sm_project_id", sm_project_id)
        .maybeSingle();
      if (existingByLink) {
        await recordSkip(admin, job_id, tenant_id, "project", sm_project_id, "ja_vinculado", (existingByLink as any).id);
        counters.skipped++;
        continue;
      }

      // Pula se há proposta SM para este projeto — proposal-first cuida dele
      const { count: hasProposal } = await admin
        .from("solar_market_proposals")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("sm_project_id", sm_project_id);
      if ((hasProposal ?? 0) > 0) {
        await recordSkip(admin, job_id, tenant_id, "project", sm_project_id, "tem_proposta_via_proposal_first");
        counters.skipped++;
        continue;
      }

      // Órfão real → resolve classificação + cliente + cria projeto
      const cls = await ensureClassification(
        admin, tenant_id, sm_project_id, canonical,
        (p as any).sm_funnel_name ?? null, (p as any).sm_stage_name ?? null,
      );
      if (!cls) {
        await recordSkip(admin, job_id, tenant_id, "project", sm_project_id, "lead_ignorado");
        counters.ignored = (counters.ignored ?? 0) + 1;
        continue;
      }

      const sm_client_id = (p as any).sm_client_id as number | null;
      if (!sm_client_id) {
        await recordSkip(admin, job_id, tenant_id, "project", sm_project_id, "orphan_sem_sm_client_id");
        counters.skipped++;
        continue;
      }
      const { data: cliente } = await admin
        .from("clientes").select("id")
        .eq("tenant_id", tenant_id).eq("sm_client_id", sm_client_id).maybeSingle();
      if (!cliente) {
        await recordSkip(admin, job_id, tenant_id, "project", sm_project_id, "orphan_cliente_nativo_nao_encontrado");
        counters.skipped++;
        continue;
      }

      const nativeId = await insertProjeto(admin, tenant_id, {
        cliente_id: (cliente as any).id,
        funil_id: cls.funil_id,
        etapa_id: cls.etapa_id,
        sm_project_id,
        codigo: `SM-${sm_project_id}`,
      });
      await recordOk(admin, job_id, tenant_id, "project", sm_project_id, nativeId);
      counters.migrated++;
    } catch (e) {
      await recordFail(admin, job_id, tenant_id, "project", sm_project_id, (e as Error).message);
      counters.failed++;
    }
  }
  const hasMore = (projects?.length ?? 0) === batchSize;
  return { counters, hasMore, nextOffset: hasMore ? offset + batchSize : null };
}

// ============================================================
// HELPERS PROPOSAL-FIRST (compartilhados)
// ============================================================

/** Garante classificação para um sm_project_id; retorna null se for lead_ignored. */
async function ensureClassification(
  admin: SupabaseClient,
  tenant_id: string,
  sm_project_id: number,
  canonical: Record<string, { funil_id: string; etapa_id: string }>,
  funil_name: string | null,
  stage_name: string | null,
): Promise<{ funil_id: string; etapa_id: string } | null> {
  const { data: existing } = await admin
    .from("sm_classification_v2")
    .select("category, target_funil_id, target_etapa_id")
    .eq("tenant_id", tenant_id)
    .eq("sm_project_id", sm_project_id)
    .maybeSingle();

  if (existing && (existing as any).category === "lead_ignored") return null;
  if (existing?.target_funil_id && existing?.target_etapa_id) {
    return { funil_id: (existing as any).target_funil_id, etapa_id: (existing as any).target_etapa_id };
  }

  const { category, reason, confidence } = classifyByText(funil_name, stage_name);
  if (category === "lead_ignored") {
    await admin.from("sm_classification_v2").upsert(
      { tenant_id, sm_project_id, category, target_funil_id: null, target_etapa_id: null, confidence_score: confidence, classification_reason: `auto:${reason}` },
      { onConflict: "tenant_id,sm_project_id" },
    );
    return null;
  }

  const target = canonical[category] ?? canonical["comercial"];
  let target_etapa_id = target.etapa_id;
  if (category === "comercial") {
    const resolved = await resolveComercialEtapaByName(admin, tenant_id, target.funil_id, stage_name);
    if (resolved) target_etapa_id = resolved;
  }
  await admin.from("sm_classification_v2").upsert(
    { tenant_id, sm_project_id, category, target_funil_id: target.funil_id, target_etapa_id, confidence_score: confidence, classification_reason: `auto:${reason}` },
    { onConflict: "tenant_id,sm_project_id" },
  );
  return { funil_id: target.funil_id, etapa_id: target_etapa_id };
}

/** Resolve cliente nativo para uma proposta SM. Cria se necessário. */
async function resolveOrCreateClienteFromProposal(
  admin: SupabaseClient,
  tenant_id: string,
  pr: any,
): Promise<string> {
  const sm_client_id = pr.sm_client_id as number | null;

  // 1) por sm_client_id (vínculo canônico)
  if (sm_client_id) {
    const { data } = await admin
      .from("clientes").select("id")
      .eq("tenant_id", tenant_id).eq("sm_client_id", sm_client_id).maybeSingle();
    if (data) return (data as any).id;
  }

  // 2) busca cliente em solar_market_clients para enriquecer
  let smClient: any = null;
  if (sm_client_id) {
    const { data } = await admin
      .from("solar_market_clients").select("*")
      .eq("tenant_id", tenant_id).eq("sm_client_id", sm_client_id).maybeSingle();
    smClient = data;
  }

  const nome = String(smClient?.name ?? pr.titulo ?? "").trim() || `Cliente SM ${sm_client_id ?? pr.sm_proposal_id ?? ""}`;
  const cpfCnpj = smClient?.document ?? null;
  const email = smClient?.email ?? null;
  const telefone = String(smClient?.phone ?? "").trim() || "—";
  const telDigits = telefone.replace(/\D/g, "");

  // 3) matching por cpf → email → telefone
  const tries: Array<[string, any]> = [
    cpfCnpj ? ["cpf_cnpj", cpfCnpj] : null,
    email ? ["email", email] : null,
    telDigits.length >= 8 ? ["telefone_normalized", telDigits] : null,
  ].filter(Boolean) as Array<[string, any]>;
  for (const [col, val] of tries) {
    const { data } = await admin
      .from("clientes").select("id, sm_client_id")
      .eq("tenant_id", tenant_id).eq(col, val).limit(1).maybeSingle();
    if (data) {
      if (sm_client_id && !(data as any).sm_client_id) {
        await admin.from("clientes").update({ sm_client_id, import_source: "solar_market" }).eq("id", (data as any).id);
      }
      return (data as any).id;
    }
  }

  // 4) cria
  const cliente_code = sm_client_id ? `SM-${sm_client_id}` : `SM-PROP-${pr.sm_proposal_id ?? pr.id}`;
  const addr = (smClient?.address ?? {}) as Record<string, any>;
  const insertPayload: Record<string, any> = {
    tenant_id, cliente_code, nome, telefone,
    cpf_cnpj: cpfCnpj, email,
    sm_client_id: sm_client_id ?? null,
    import_source: "solar_market", ativo: true,
    empresa: smClient?.company ?? null,
    cep: smClient?.zip_code ?? addr.zip_code ?? addr.cep ?? null,
    rua: addr.street ?? addr.rua ?? null,
    numero: smClient?.number ?? addr.number ?? addr.numero ?? null,
    bairro: smClient?.neighborhood ?? addr.neighborhood ?? addr.bairro ?? null,
    cidade: smClient?.city ?? addr.city ?? addr.cidade ?? pr.cidade ?? null,
    estado: smClient?.state ?? addr.state ?? addr.estado ?? pr.estado ?? null,
  };

  // CR#1: retry-loop defensivo contra race em next_tenant_number / uq_clientes_tenant_cliente_code
  let inserted: { id: string } | null = null;
  let lastError: any = null;
  for (let attempt = 0; attempt < 4 && !inserted; attempt++) {
    const payloadAttempt = attempt === 0
      ? insertPayload
      : { ...insertPayload, cliente_code: `${insertPayload.cliente_code}-R${attempt}` };
    const { data, error } = await admin
      .from("clientes").insert(payloadAttempt).select("id").single();
    if (!error && data) { inserted = data as { id: string }; break; }
    lastError = error;
    const errAny = error as any;
    const isDup = errAny?.code === "23505" || /duplicate key|unique constraint/i.test(String(errAny?.message ?? ""));
    if (!isDup) break;
    // Procura registro já existente antes de tentar de novo
    for (const [col, val] of tries) {
      const { data: found } = await admin.from("clientes").select("id")
        .eq("tenant_id", tenant_id).eq(col, val).limit(1).maybeSingle();
      if (found) return (found as any).id;
    }
    if (sm_client_id) {
      const { data: found } = await admin.from("clientes").select("id")
        .eq("tenant_id", tenant_id).eq("sm_client_id", sm_client_id).maybeSingle();
      if (found) return (found as any).id;
    }
    // Se a duplicata foi em cliente_code (race do next_tenant_number), próxima iteração regera com sufixo
  }
  if (!inserted) throw lastError ?? new Error("Falha ao criar cliente");
  return inserted.id;
}

/**
 * Resolve projeto nativo para uma proposta SM. Cria se necessário.
 *
 * Ordem de matching (anti-duplicação):
 *   (1) sm_project_id em projetos.sm_project_id
 *   (2) migration_records com native_entity_id para o mesmo sm_project_id
 *   (3) chave sintética estável em projetos.codigo
 *   (4) cria novo
 */
async function resolveOrCreateProjetoFromProposal(
  admin: SupabaseClient,
  tenant_id: string,
  pr: any,
  cliente_id: string,
  canonical: Record<string, { funil_id: string; etapa_id: string }>,
): Promise<string> {
  const sm_project_id = pr.sm_project_id as number | null;
  const sm_proposal_id = pr.sm_proposal_id ?? null;
  const stagingId = String(pr.id ?? "");

  // (1) por sm_project_id
  if (sm_project_id) {
    const { data } = await admin
      .from("projetos").select("id")
      .eq("tenant_id", tenant_id).eq("sm_project_id", sm_project_id).maybeSingle();
    if (data) return (data as any).id;
  }

  // (2) por migration_records (rerun seguro entre jobs)
  if (sm_project_id) {
    const { data } = await admin
      .from("migration_records")
      .select("native_entity_id")
      .eq("tenant_id", tenant_id)
      .eq("entity_type", "project")
      .eq("sm_entity_id", sm_project_id)
      .not("native_entity_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (data && (data as any).native_entity_id) {
      const nativeId = (data as any).native_entity_id as string;
      const { data: proj } = await admin
        .from("projetos").select("id")
        .eq("tenant_id", tenant_id).eq("id", nativeId).maybeSingle();
      if (proj) return (proj as any).id;
    }
  }

  // (3) chave sintética estável (rerun seguro mesmo sem sm_project_id)
  const syntheticCode = sm_project_id
    ? `SM-${sm_project_id}`
    : `SM-PROP-${sm_proposal_id ?? stagingId}`;
  const { data: bySyntheticCode } = await admin
    .from("projetos").select("id")
    .eq("tenant_id", tenant_id).eq("codigo", syntheticCode).maybeSingle();
  if (bySyntheticCode) return (bySyntheticCode as any).id;

  // (4) classificação + insert
  // Lê dados do projeto SM para descobrir funil/vendedor de origem
  let smFunnelName: string | null = null;
  let smStageName: string | null = null;
  if (sm_project_id) {
    const { data: smProj } = await admin
      .from("solar_market_projects")
      .select("sm_funnel_name, sm_stage_name")
      .eq("tenant_id", tenant_id).eq("sm_project_id", sm_project_id).maybeSingle();
    smFunnelName = (smProj as any)?.sm_funnel_name ?? null;
    smStageName  = (smProj as any)?.sm_stage_name ?? null;
  }

  let cls: { funil_id: string; etapa_id: string } | null = null;
  if (sm_project_id) {
    cls = await ensureClassification(
      admin, tenant_id, sm_project_id, canonical, smFunnelName, smStageName,
    );
  }
  // Sem sm_project_id ou lead_ignored → Comercial default
  if (!cls) {
    const target = canonical["comercial"];
    cls = { funil_id: target.funil_id, etapa_id: target.etapa_id };
  }

  // REGRA CANÔNICA: funil "Vendedores" no SM → pipeline Comercial nativo,
  // etapa determinada pelo STATUS da proposta (não pelo nome do vendedor),
  // e o "vendedor" (sm_stage_name) vira o consultor responsável.
  let consultor_id: string | null = null;
  const isVendedoresFunnel = /vended/i.test(String(smFunnelName ?? ""));
  if (isVendedoresFunnel) {
    const comercial = canonical["comercial"];
    cls = { funil_id: comercial.funil_id, etapa_id: comercial.etapa_id };

    const stageNameByStatus = comercialStageNameFromStatus(pr.status);
    if (stageNameByStatus) {
      const resolved = await resolveComercialEtapaByName(
        admin, tenant_id, comercial.funil_id, stageNameByStatus,
      );
      if (resolved) cls.etapa_id = resolved;
    }
    consultor_id = await resolveConsultorIdFromSmStage(admin, tenant_id, smStageName);
  }

  return await insertProjeto(admin, tenant_id, {
    cliente_id,
    funil_id: cls.funil_id,
    etapa_id: cls.etapa_id,
    sm_project_id: sm_project_id ?? null,
    codigo: syntheticCode,
    consultor_id,
  });
}

/** Insert defensivo de projeto com fallback de race em codigo/sm_project_id. */
async function insertProjeto(
  admin: SupabaseClient,
  tenant_id: string,
  payload: { cliente_id: string; funil_id: string; etapa_id: string; sm_project_id: number | null; codigo: string; consultor_id?: string | null },
): Promise<string> {
  const insertRow: Record<string, any> = {
    tenant_id,
    cliente_id: payload.cliente_id,
    funil_id: payload.funil_id,
    etapa_id: payload.etapa_id,
    sm_project_id: payload.sm_project_id,
    codigo: payload.codigo,
    import_source: "solar_market",
  };
  if (payload.consultor_id) insertRow.consultor_id = payload.consultor_id;

  const { data: inserted, error } = await admin
    .from("projetos")
    .insert(insertRow)
    .select("id").single();
  if (error) {
    const errAny = error as any;
    const isDup = errAny?.code === "23505" || /duplicate key|unique constraint/i.test(String(errAny?.message ?? ""));
    if (isDup) {
      const orParts: string[] = [`codigo.eq.${payload.codigo}`];
      if (payload.sm_project_id) orParts.push(`sm_project_id.eq.${payload.sm_project_id}`);
      const { data: dup } = await admin
        .from("projetos").select("id")
        .eq("tenant_id", tenant_id)
        .or(orParts.join(","))
        .limit(1).maybeSingle();
      if (dup) return (dup as any).id;
    }
    throw error;
  }
  return (inserted as any).id;
}

// ============================================================
// PROPOSTAS (proposal-first)
// ============================================================

async function migrateProposals(
  admin: SupabaseClient,
  tenant_id: string,
  job_id: string,
  offset = 0,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<ProcessBatchResult> {
  const counters: Counters = { migrated: 0, skipped: 0, failed: 0 };
  const canonical = await ensureCanonicalFunis(admin, tenant_id);

  const { data: proposals } = await admin
    .from("solar_market_proposals")
    .select("id, sm_proposal_id, sm_project_id, sm_client_id, titulo, description, raw_payload, valor_total, link_pdf, status, cidade, estado")
    .eq("tenant_id", tenant_id)
    .order("id", { ascending: true })
    .range(offset, offset + batchSize - 1);

  for (const pr of proposals ?? []) {
    const stagingId = String((pr as any).id ?? "");
    const sm_proposal_id = (pr as any).sm_proposal_id ?? null;
    const sm_project_id = (pr as any).sm_project_id as number | null;
    // tracking_id estável: prefere sm_proposal_id (chave da proposta), depois sm_project_id
    const trackingId = (typeof sm_proposal_id === "number" ? sm_proposal_id : null)
      ?? sm_project_id
      ?? Math.abs(hashString(stagingId));
    try {
      // 1) Resolve/cria cliente (proposal-first)
      const cliente_id = await resolveOrCreateClienteFromProposal(admin, tenant_id, pr);
      if (!cliente_id) {
        await recordSkip(admin, job_id, tenant_id, "proposal", trackingId, `cliente_nao_resolvido (proposal_row=${stagingId})`);
        counters.skipped++;
        continue;
      }

      // 2) Resolve/cria projeto (matching: sm_project_id → migration_records → codigo sintético → create)
      const projeto_id = await resolveOrCreateProjetoFromProposal(admin, tenant_id, pr, cliente_id, canonical);
      if (!projeto_id) {
        await recordSkip(admin, job_id, tenant_id, "proposal", trackingId, `projeto_nao_resolvido (proposal_row=${stagingId})`);
        counters.skipped++;
        continue;
      }
      const projeto = { id: projeto_id, cliente_id };

      // Idempotência pela linha canônica do staging (UUID em sm_id)
      const { data: existing } = await admin
        .from("propostas_nativas")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("sm_id", stagingId)
        .maybeSingle();

      let nativeId: string | null = null;
      if (existing) {
        nativeId = (existing as any).id;
        await recordSkip(
          admin,
          job_id,
          tenant_id,
          "proposal",
          trackingId,
          `proposta já existe no destino (id=${nativeId})`,
          nativeId,
        );
        counters.skipped++;
      } else {
        // Retry-loop pequeno para race em proposta_num
        // (uq_propostas_tenant_projeto_proposta_num) e em codigo (uq_propostas_tenant_codigo).
        const titulo = String((pr as any).titulo ?? (pr as any).description ?? "").trim() || `Proposta Migrada SM #${sm_project_id}`;
        const baseInsert = {
          tenant_id,
          projeto_id: (projeto as any).id,
          cliente_id: (projeto as any).cliente_id,
          titulo,
          origem: "imported",
          import_source: "solar_market",
          sm_id: stagingId,
          sm_project_id: sm_project_id ?? null,
          sm_raw_payload: (pr as any).raw_payload ?? pr,
          status: "gerada",
          metadata: {
            source: "solar_market",
            sm_proposal_id,
            sm_project_id,
            link_pdf: (pr as any).link_pdf ?? null,
            valor_total: (pr as any).valor_total ?? null,
            source_status: (pr as any).status ?? null,
          },
        } as Record<string, any>;

        let inserted: { id: string } | null = null;
        let lastError: any = null;
        for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
          const proposalNumber = await nextProposalNumberForProject(admin, tenant_id, (projeto as any).id);
          const codigo = `SM-PROP-${sm_project_id}-${proposalNumber}`;
          const { data, error } = await admin
            .from("propostas_nativas")
            .insert({
              ...baseInsert,
              codigo,
              proposta_num: proposalNumber,
              is_principal: proposalNumber === 1,
            })
            .select("id")
            .single();
          if (!error) { inserted = data as any; break; }
          lastError = error;
          const isDup = (error as any)?.code === "23505" || /duplicate key|unique constraint/i.test(String((error as any)?.message ?? ""));
          if (!isDup) throw error;
          // Se duplicou em sm_id → outro batch já criou, recupera e sai
          const { data: dupBySmId } = await admin
            .from("propostas_nativas")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("sm_id", stagingId)
            .maybeSingle();
          if (dupBySmId) {
            nativeId = (dupBySmId as any).id;
            counters.skipped++;
            break;
          }
          // Senão é colisão de proposta_num/codigo → retry com novo número
        }
        if (inserted) {
          nativeId = inserted.id;
          counters.migrated++;
        } else if (!nativeId) {
          throw lastError ?? new Error("Falha ao inserir proposta após retries");
        }
      }

      if (nativeId) {
        await recordOk(admin, job_id, tenant_id, "proposal", trackingId, nativeId);
      }
    } catch (e) {
      await recordFail(admin, job_id, tenant_id, "proposal", trackingId, (e as Error).message);
      counters.failed++;
    }
  }
  const hasMore = (proposals?.length ?? 0) === batchSize;
  return { counters, hasMore, nextOffset: hasMore ? offset + batchSize : null };
}

async function nextProposalNumberForProject(
  admin: SupabaseClient,
  tenant_id: string,
  projeto_id: string,
) {
  const { data: latest } = await admin
    .from("propostas_nativas")
    .select("proposta_num")
    .eq("tenant_id", tenant_id)
    .eq("projeto_id", projeto_id)
    .order("proposta_num", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Number((latest as any)?.proposta_num ?? 0) + 1;
}

// ============================================================
// HELPERS DE RECORD
// ============================================================

async function recordOk(
  admin: SupabaseClient,
  job_id: string,
  tenant_id: string,
  entity_type: "client" | "project" | "proposal",
  sm_entity_id: number,
  native_entity_id: string | null = null,
) {
  await admin
    .from("migration_records")
    .upsert(
      {
        job_id,
        tenant_id,
        entity_type,
        sm_entity_id,
        native_entity_id,
        status: "migrated",
        migrated_at: new Date().toISOString(),
      },
      { onConflict: "job_id,entity_type,sm_entity_id" },
    );
}

async function recordSkip(
  admin: SupabaseClient,
  job_id: string,
  tenant_id: string,
  entity_type: "client" | "project" | "proposal",
  sm_entity_id: number,
  reason: string,
  native_entity_id: string | null = null,
) {
  await admin
    .from("migration_records")
    .upsert(
      {
        job_id,
        tenant_id,
        entity_type,
        sm_entity_id,
        native_entity_id,
        status: "skipped",
        error_message: reason,
      },
      { onConflict: "job_id,entity_type,sm_entity_id" },
    );
}

async function recordFail(
  admin: SupabaseClient,
  job_id: string,
  tenant_id: string,
  entity_type: "client" | "project" | "proposal",
  sm_entity_id: number,
  error_message: string,
) {
  await admin
    .from("migration_records")
    .upsert(
      {
        job_id,
        tenant_id,
        entity_type,
        sm_entity_id,
        status: "failed",
        error_message,
      },
      { onConflict: "job_id,entity_type,sm_entity_id" },
    );
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
