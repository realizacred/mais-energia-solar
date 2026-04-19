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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Counters = { migrated: number; skipped: number; failed: number };
const DEFAULT_BATCH_SIZE = 200;
const REQUEUE_BASE_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
type ProcessBatchResult = { counters: Counters; hasMore: boolean; nextOffset: number | null };
type JobStage = "classify_projects" | "migrate_clients" | "migrate_projects" | "migrate_proposals";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "Server config error" }, 500);

    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userErr } = await admin.auth.getUser(
      auth.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const job_id = String(body?.job_id ?? "");
    const requestedOffset = Number(body?.offset ?? 0);
    const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? Math.floor(requestedOffset) : 0;
    const requestedBatchSize = Number(body?.batch_size ?? DEFAULT_BATCH_SIZE);
    const batchSize = Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
      ? Math.min(Math.floor(requestedBatchSize), 500)
      : DEFAULT_BATCH_SIZE;
    const stageFromBody = String(body?.stage ?? jobStageFromMetadata(body?.metadata ?? null, null)) as JobStage | "";
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
    if (job.status === "running" && offset === 0) {
      return json({ error: "Job already running" }, 409);
    }

    if (offset === 0) {
      await admin
        .from("migration_jobs")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
          metadata: {
            ...(job.metadata ?? {}),
            progress: { offset: 0, batch_size: batchSize, has_more: false },
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
          ({ counters: allCounters.projects, hasMore, nextOffset } = await migrateProjects(admin, tenant_id, job_id, offset, batchSize));
          break;
        case "migrate_proposals":
          ({ counters: allCounters.proposals, hasMore, nextOffset } = await migrateProposals(admin, tenant_id, job_id, offset, batchSize));
          break;
        case "full_migration":
          if (currentStage === "classify_projects") {
            ({ counters: allCounters.classify, hasMore, nextOffset } = await classifyProjects(admin, tenant_id, job_id, offset, batchSize));
            nextStage = hasMore ? "classify_projects" : "migrate_clients";
          } else if (currentStage === "migrate_clients") {
            ({ counters: allCounters.clients, hasMore, nextOffset } = await migrateClients(admin, tenant_id, job_id, offset, batchSize));
            nextStage = hasMore ? "migrate_clients" : "migrate_projects";
          } else if (currentStage === "migrate_projects") {
            ({ counters: allCounters.projects, hasMore, nextOffset } = await migrateProjects(admin, tenant_id, job_id, offset, batchSize));
            nextStage = hasMore ? "migrate_projects" : "migrate_proposals";
          } else {
            ({ counters: allCounters.proposals, hasMore, nextOffset } = await migrateProposals(admin, tenant_id, job_id, offset, batchSize));
            nextStage = hasMore ? "migrate_proposals" : null;
          }
          break;
        default:
          throw new Error(`Unsupported job_type: ${job.job_type}`);
      }

      if (hasMore && nextOffset !== null) {
        await admin
          .from("migration_jobs")
          .update({
            metadata: {
              ...(job.metadata ?? {}),
              counters: { ...(job.metadata?.counters ?? {}), ...allCounters },
              progress: { offset: nextOffset, batch_size: batchSize, has_more: true, stage: nextStage },
            },
          })
          .eq("id", job_id);

        EdgeRuntime.waitUntil(requeueJob(job_id, auth, nextOffset, batchSize, nextStage));
        return json({ status: "running", counters: allCounters, next_offset: nextOffset }, 202);
      }

      if (job.job_type === "full_migration" && nextStage) {
        await admin
          .from("migration_jobs")
          .update({
            metadata: {
              ...(job.metadata ?? {}),
              counters: { ...(job.metadata?.counters ?? {}), ...allCounters },
              progress: { offset: 0, batch_size: batchSize, has_more: true, stage: nextStage },
            },
          })
          .eq("id", job_id);

        EdgeRuntime.waitUntil(requeueJob(job_id, auth, 0, batchSize, nextStage));
        return json({ status: "running", counters: allCounters, next_stage: nextStage }, 202);
      }

      await admin
        .from("migration_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          metadata: {
            ...(job.metadata ?? {}),
            counters: { ...(job.metadata?.counters ?? {}), ...allCounters },
            progress: { offset: 0, batch_size: batchSize, has_more: false },
          },
        })
        .eq("id", job_id);

      return json({ status: "completed", counters: allCounters }, 200);
    } catch (e) {
      await admin
        .from("migration_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: (e as Error).message,
        })
        .eq("id", job_id);
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
  // 5) Comercial / vendedor
  if (/comercial|venda|lead|vendedor|consultor/i.test(f)) {
    return { category: "comercial", reason: "funil_comercial_or_consultor", confidence: 0.9 };
  }
  // 6) Funil vazio/LEAD → comercial (governance: funnel-mapping-rules-v4)
  if (!f || f === "lead") {
    return { category: "comercial", reason: "lead_or_empty_default", confidence: 0.7 };
  }
  // 7) Default
  return { category: "verificar_dados", reason: "no_match", confidence: 0.3 };
}

async function ensureCanonicalFunis(admin: SupabaseClient, tenant_id: string) {
  const cats = ["comercial", "engenharia", "equipamento", "compensacao", "verificar_dados"];
  const map: Record<string, { funil_id: string; etapa_id: string }> = {};

  for (const cat of cats) {
    const nome = cat === "verificar_dados" ? "Verificar Dados" : capitalize(cat);
    let { data: funil } = await admin
      .from("projeto_funis")
      .select("id")
      .eq("tenant_id", tenant_id)
      .ilike("nome", nome)
      .maybeSingle();

    if (!funil) {
      const { data: created } = await admin
        .from("projeto_funis")
        .insert({ tenant_id, nome, ativo: true })
        .select("id")
        .single();
      funil = created;
    }

    let { data: etapa } = await admin
      .from("projeto_etapas")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("funil_id", funil!.id)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!etapa) {
      const { data: createdEtapa } = await admin
        .from("projeto_etapas")
        .insert({ tenant_id, funil_id: funil!.id, nome: "Novo", ordem: 1 })
        .select("id")
        .single();
      etapa = createdEtapa;
    }

    map[cat] = { funil_id: funil!.id, etapa_id: etapa!.id };
  }
  return map;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
      const target = canonical[category];

      const { error } = await admin
        .from("sm_classification_v2")
        .upsert(
          {
            tenant_id,
            sm_project_id,
            category,
            target_funil_id: target.funil_id,
            target_etapa_id: target.etapa_id,
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

      // Idempotência: buscar por sm_client_id, CPF/CNPJ, email OU telefone
      let nativeId: string | null = null;
      const orParts = [
        `sm_client_id.eq.${sm_client_id}`,
        cpfCnpj ? `cpf_cnpj.eq.${cpfCnpj}` : null,
        email ? `email.eq.${email}` : null,
        telDigits.length >= 8 ? `telefone_normalized.eq.${telDigits}` : null,
      ].filter(Boolean) as string[];

      const { data: existing } = await admin
        .from("clientes")
        .select("id, sm_client_id")
        .eq("tenant_id", tenant_id)
        .or(orParts.join(","))
        .limit(1)
        .maybeSingle();

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
        // Fallback para corrida/duplicado por telefone (uq_clientes_tenant_telefone) ou cpf/email
        if (isDup) {
          // tenta achar o registro conflitante por telefone, cpf ou email
          const orParts2 = [
            telDigits.length >= 8 ? `telefone_normalized.eq.${telDigits}` : null,
            cpfCnpj ? `cpf_cnpj.eq.${cpfCnpj}` : null,
            email ? `email.eq.${email}` : null,
          ].filter(Boolean) as string[];
          if (orParts2.length > 0) {
            const { data: dup } = await admin
              .from("clientes")
              .select("id, sm_client_id")
              .eq("tenant_id", tenant_id)
              .or(orParts2.join(","))
              .limit(1)
              .maybeSingle();
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
          }
          // não achou o conflitante: registra como skipped com motivo claro
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
// PROJETOS
// ============================================================

async function migrateProjects(
  admin: SupabaseClient,
  tenant_id: string,
  job_id: string,
  offset = 0,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<ProcessBatchResult> {
  const counters: Counters = { migrated: 0, skipped: 0, failed: 0 };

  const { data: projects } = await admin
    .from("solar_market_projects")
    .select("sm_project_id, sm_client_id, name")
    .eq("tenant_id", tenant_id)
    .order("sm_project_id", { ascending: true })
    .range(offset, offset + batchSize - 1);

  for (const p of projects ?? []) {
    const sm_project_id = (p as any).sm_project_id as number;
    try {
      // Classificação obrigatória
      const { data: cls } = await admin
        .from("sm_classification_v2")
        .select("target_funil_id, target_etapa_id")
        .eq("tenant_id", tenant_id)
        .eq("sm_project_id", sm_project_id)
        .maybeSingle();

      if (!cls?.target_funil_id || !cls?.target_etapa_id) {
        await recordSkip(admin, job_id, tenant_id, "project", sm_project_id, "sem classificação resolvida");
        counters.skipped++;
        continue;
      }

      // Cliente nativo via sm_client_id
      const sm_client_id = (p as any).sm_client_id as number | null;
      if (!sm_client_id) {
        await recordSkip(admin, job_id, tenant_id, "project", sm_project_id, "sem sm_client_id");
        counters.skipped++;
        continue;
      }
      const { data: cliente } = await admin
        .from("clientes")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("sm_client_id", sm_client_id)
        .maybeSingle();
      if (!cliente) {
        await recordSkip(admin, job_id, tenant_id, "project", sm_project_id, "cliente nativo não encontrado");
        counters.skipped++;
        continue;
      }

      // Idempotência por sm_project_id
      const { data: existing } = await admin
        .from("projetos")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("sm_project_id", sm_project_id)
        .maybeSingle();

      let nativeId: string | null = null;
      if (existing) {
        nativeId = (existing as any).id;
        counters.skipped++;
      } else {
        const { data: inserted, error } = await admin
          .from("projetos")
          .insert({
            tenant_id,
            cliente_id: (cliente as any).id,
            funil_id: cls.target_funil_id,
            etapa_id: cls.target_etapa_id,
            sm_project_id,
            // `codigo` é NOT NULL sem default na tabela projetos — derivar do sm_project_id
            codigo: `SM-${sm_project_id}`,
            import_source: "solar_market",
          })
          .select("id")
          .single();
        if (error) throw error;
        nativeId = (inserted as any).id;
        counters.migrated++;
      }

      await recordOk(admin, job_id, tenant_id, "project", sm_project_id, nativeId);
    } catch (e) {
      await recordFail(admin, job_id, tenant_id, "project", sm_project_id, (e as Error).message);
      counters.failed++;
    }
  }
  const hasMore = (projects?.length ?? 0) === batchSize;
  return { counters, hasMore, nextOffset: hasMore ? offset + batchSize : null };
}

// ============================================================
// PROPOSTAS
// ============================================================

async function migrateProposals(
  admin: SupabaseClient,
  tenant_id: string,
  job_id: string,
  offset = 0,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<ProcessBatchResult> {
  const counters: Counters = { migrated: 0, skipped: 0, failed: 0 };

  const { data: proposals } = await admin
    .from("solar_market_proposals")
    .select("*")
    .eq("tenant_id", tenant_id)
    .order("sm_proposal_id", { ascending: true })
    .range(offset, offset + batchSize - 1);

  for (const pr of proposals ?? []) {
    const sm_proposal_id = (pr as any).sm_proposal_id ?? (pr as any).id;
    try {
      const sm_project_id = (pr as any).sm_project_id as number | null;
      if (!sm_project_id) {
        await recordSkip(admin, job_id, tenant_id, "proposal", sm_proposal_id, "sem sm_project_id");
        counters.skipped++;
        continue;
      }

      const { data: projeto } = await admin
        .from("projetos")
        .select("id, cliente_id")
        .eq("tenant_id", tenant_id)
        .eq("sm_project_id", sm_project_id)
        .maybeSingle();
      if (!projeto) {
        await recordSkip(admin, job_id, tenant_id, "proposal", sm_proposal_id, "projeto nativo não encontrado");
        counters.skipped++;
        continue;
      }

      // Idempotência por sm_proposal_id
      const { data: existing } = await admin
        .from("propostas_nativas")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("sm_proposal_id", sm_proposal_id)
        .maybeSingle();

      let nativeId: string | null = null;
      if (existing) {
        nativeId = (existing as any).id;
        counters.skipped++;
      } else {
        const { data: inserted, error } = await admin
          .from("propostas_nativas")
          .insert({
            tenant_id,
            projeto_id: (projeto as any).id,
            cliente_id: (projeto as any).cliente_id,
            sm_proposal_id,
            valor_total: (pr as any).valor_total ?? 0,
            source: "legacy_import",
            import_source: "solar_market",
          })
          .select("id")
          .single();
        if (error) throw error;
        nativeId = (inserted as any).id;
        counters.migrated++;
      }

      await recordOk(admin, job_id, tenant_id, "proposal", sm_proposal_id, nativeId);
    } catch (e) {
      await recordFail(admin, job_id, tenant_id, "proposal", sm_proposal_id, (e as Error).message);
      counters.failed++;
    }
  }
  const hasMore = (proposals?.length ?? 0) === batchSize;
  return { counters, hasMore, nextOffset: hasMore ? offset + batchSize : null };
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
