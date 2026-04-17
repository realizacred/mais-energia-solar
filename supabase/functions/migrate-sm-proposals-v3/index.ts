/**
 * migrate-sm-proposals-v3
 *
 * Contrato novo (Fase B):
 *  - NUNCA recebe pipeline_id / stage_id / funil_id / etapa_id global
 *  - Lê classificação por registro em sm_project_classification
 *  - Aplica funil_destino_id / etapa_destino_id de cada projeto
 *  - Idempotente: vincula por (tenant_id, sm_project_id) — usa projetos.sm_project_id (bigint)
 *  - Elegibilidade: somente projetos com proposta em solar_market_proposals
 *  - Por padrão é DRY-RUN. Apply real exige { confirm_apply: true } no body.
 *
 * RB-57: estado por request, sem let no escopo de módulo.
 * RB-58: UPDATEs críticos verificam linhas afetadas via .select().
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  tenant_id: string;
  confirm_apply?: boolean;     // default false → dry-run
  limit?: number;              // opcional para testes pontuais
  sm_project_ids?: number[];   // opcional: subset
}

interface Counters {
  scanned: number;
  eligible: number;
  classified: number;
  skipped_no_classification: number;
  skipped_no_destination: number;
  would_update: number;
  would_insert: number;
  updated: number;
  inserted: number;
  failed: number;
  errors: Array<{ sm_project_id: number; error: string }>;
}

function newCounters(): Counters {
  return {
    scanned: 0, eligible: 0, classified: 0,
    skipped_no_classification: 0, skipped_no_destination: 0,
    would_update: 0, would_insert: 0,
    updated: 0, inserted: 0, failed: 0, errors: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const counters = newCounters();

  try {
    const body = (await req.json()) as Body;
    if (!body?.tenant_id) throw new Error("tenant_id obrigatório");

    const dryRun = body.confirm_apply !== true;

    const supabase: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Carregar classificações resolvidas (com destino completo) do tenant
    let q = supabase
      .from("sm_project_classification")
      .select("sm_project_id, funil_destino_id, etapa_destino_id, pipeline_kind, motivo")
      .eq("tenant_id", body.tenant_id)
      .not("funil_destino_id", "is", null)
      .not("etapa_destino_id", "is", null);

    if (body.limit) q = q.limit(body.limit);

    const { data: classifications, error: cErr } = await q;
    if (cErr) throw cErr;

    if (!classifications?.length) {
      return json({ dry_run: dryRun, message: "Nenhuma classificação resolvida.", counters });
    }

    // 2. Buscar staging projects correspondentes (id interno → sm_project_id externo).
    // Paginar em chunks para não estourar o limite de URL do PostgREST (~2KB).
    const stagingIds = classifications.map((c) => c.sm_project_id);
    const stagingRows: Array<{ id: string; sm_project_id: number | null; tenant_id: string; name: string | null; sm_funnel_name: string | null; sm_stage_name: string | null }> = [];
    const CHUNK = 200;
    for (let i = 0; i < stagingIds.length; i += CHUNK) {
      const slice = stagingIds.slice(i, i + CHUNK);
      const { data, error: sErr } = await supabase
        .from("solar_market_projects")
        .select("id, sm_project_id, tenant_id, name, sm_funnel_name, sm_stage_name")
        .in("id", slice);
      if (sErr) throw sErr;
      if (data) stagingRows.push(...data);
    }

    const stagingById = new Map<string, (typeof stagingRows)[number]>();
    for (const r of stagingRows) stagingById.set(r.id, r);

    // 3. Filtrar elegíveis (com proposta) — chave externa sm_project_id (paginado)
    const externalIds = stagingRows.map((r) => r.sm_project_id).filter((v): v is number => v != null);
    const eligibleSet = new Set<number>();
    for (let i = 0; i < externalIds.length; i += CHUNK) {
      const slice = externalIds.slice(i, i + CHUNK);
      const { data: propRows, error: pErr } = await supabase
        .from("solar_market_proposals")
        .select("sm_project_id")
        .eq("tenant_id", body.tenant_id)
        .in("sm_project_id", slice);
      if (pErr) throw pErr;
      for (const p of propRows ?? []) if (p.sm_project_id != null) eligibleSet.add(Number(p.sm_project_id));
    }

    // 4. Filtros opcionais por subset
    const subset = body.sm_project_ids?.length ? new Set(body.sm_project_ids) : null;

    // 5. Pré-carregar projetos nativos já vinculados por sm_project_id (paginado)
    const targetExternalIds = stagingRows
      .map((r) => r.sm_project_id)
      .filter((id): id is number => id != null && eligibleSet.has(id) && (!subset || subset.has(id)));

    const projByExt = new Map<number, { id: string; sm_project_id: number | null; funil_id: string | null; etapa_id: string | null }>();
    for (let i = 0; i < targetExternalIds.length; i += CHUNK) {
      const slice = targetExternalIds.slice(i, i + CHUNK);
      const { data: existingProjetos, error: epErr } = await supabase
        .from("projetos")
        .select("id, sm_project_id, funil_id, etapa_id")
        .eq("tenant_id", body.tenant_id)
        .in("sm_project_id", slice);
      if (epErr) throw epErr;
      for (const p of existingProjetos ?? []) {
        if (p.sm_project_id != null) projByExt.set(Number(p.sm_project_id), p);
      }
    }

    // 6. Iterar classificações
    for (const c of classifications) {
      counters.scanned++;
      const staging = stagingById.get(c.sm_project_id);
      if (!staging || staging.sm_project_id == null) {
        counters.skipped_no_classification++;
        continue;
      }
      const extId = Number(staging.sm_project_id);
      if (!eligibleSet.has(extId)) continue; // sem proposta → não elegível
      if (subset && !subset.has(extId)) continue;

      counters.eligible++;
      counters.classified++;

      const existing = projByExt.get(extId);

      if (existing) {
        // UPDATE de funil/etapa
        if (existing.funil_id === c.funil_destino_id && existing.etapa_id === c.etapa_destino_id) {
          continue; // já está no destino
        }
        if (dryRun) {
          counters.would_update++;
          continue;
        }
        const { data: upd, error: uErr } = await supabase
          .from("projetos")
          .update({
            funil_id: c.funil_destino_id,
            etapa_id: c.etapa_destino_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("tenant_id", body.tenant_id)
          .select("id");
        if (uErr || !upd?.length) {
          counters.failed++;
          counters.errors.push({ sm_project_id: extId, error: uErr?.message ?? "0 linhas afetadas" });
          continue;
        }
        counters.updated++;
      } else {
        // INSERT — apply real cria projeto vinculado.
        // Nesta v3, INSERT real é stub: a criação completa exige resolver cliente_id,
        // codigo, projeto_num, etc. Mantemos contagem para a próxima onda.
        if (dryRun) {
          counters.would_insert++;
          continue;
        }
        // Apply real de INSERT está intencionalmente DESABILITADO nesta versão.
        counters.skipped_no_classification++;
        counters.errors.push({
          sm_project_id: extId,
          error: "INSERT não implementado em v3 — projeto nativo não existe para esse sm_project_id",
        });
        counters.failed++;
      }
    }

    return json({
      dry_run: dryRun,
      tenant_id: body.tenant_id,
      counters,
    });
  } catch (e: any) {
    console.error("[migrate-sm-proposals-v3] erro:", JSON.stringify({
      message: e?.message, code: e?.code, details: e?.details, hint: e?.hint, stack: e?.stack,
    }));
    return json({
      error: e?.message ?? "erro desconhecido",
      code: e?.code, details: e?.details, hint: e?.hint,
      counters,
    }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
