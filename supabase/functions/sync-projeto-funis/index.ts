import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FETCH_LIMIT = 2000;
const UPDATE_CHUNK = 200;

type PendingClassification = {
  id: string;
  funil_destino_id: string | null;
  etapa_destino_id: string | null;
};

async function updateByIds(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  ids: string[],
  patch: Record<string, unknown>,
) {
  let updated = 0;

  for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
    const slice = ids.slice(i, i + UPDATE_CHUNK);
    const { data, error } = await supabase
      .from("sm_project_classification")
      .update(patch)
      .eq("tenant_id", tenantId)
      .in("id", slice)
      .is("resolved_funil_id", null)
      .select("id");

    if (error) throw error;
    updated += data?.length ?? 0;
  }

  return updated;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id obrigatório");

    console.info("[sync-projeto-funis] start", { tenant_id });

    const { count: unresolvedBefore, error: countBeforeError } = await supabase
      .from("sm_project_classification")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .is("resolved_funil_id", null);
    if (countBeforeError) throw countBeforeError;

    const { data: funisExistentes, error: funisError } = await supabase
      .from("projeto_funis")
      .select("id")
      .eq("tenant_id", tenant_id);
    if (funisError) throw funisError;

    const funisValidos = new Set<string>((funisExistentes ?? []).map((f) => String(f.id)));

    const funilIds = (funisExistentes ?? []).map((f) => f.id);
    let etapasValidas = new Set<string>();
    if (funilIds.length > 0) {
      const { data: etapasExistentes, error: etapasError } = await supabase
        .from("projeto_etapas")
        .select("id, funil_id")
        .in("funil_id", funilIds);
      if (etapasError) throw etapasError;
      etapasValidas = new Set<string>((etapasExistentes ?? []).map((e) => String(e.id)));
    }

    const { data: pendentesRaw, error: pendentesError } = await supabase
      .from("sm_project_classification")
      .select("id, funil_destino_id, etapa_destino_id")
      .eq("tenant_id", tenant_id)
      .is("resolved_funil_id", null)
      .limit(FETCH_LIMIT + 1);
    if (pendentesError) throw pendentesError;

    const hasMore = (pendentesRaw?.length ?? 0) > FETCH_LIMIT;
    const pendentes = (pendentesRaw ?? []).slice(0, FETCH_LIMIT) as PendingClassification[];
    const nowIso = new Date().toISOString();

    let classificacoesResolvidas = 0;
    let classificacoesPuladas = 0;
    let classificacoesComErro = 0;

    const missingFunilIds: string[] = [];
    const invalidFunilGroups = new Map<string, string[]>();
    const missingEtapaIds: string[] = [];
    const invalidEtapaGroups = new Map<string, string[]>();
    const resolveGroups = new Map<string, { ids: string[]; funilDest: string; etapaDest: string }>();

    for (const c of pendentes) {
      const funilDest = c.funil_destino_id;
      const etapaDest = c.etapa_destino_id;

      if (!funilDest) {
        missingFunilIds.push(c.id);
        continue;
      }

      if (!funisValidos.has(String(funilDest))) {
        const list = invalidFunilGroups.get(funilDest) ?? [];
        list.push(c.id);
        invalidFunilGroups.set(funilDest, list);
        continue;
      }

      if (!etapaDest) {
        missingEtapaIds.push(c.id);
        continue;
      }

      if (!etapasValidas.has(String(etapaDest))) {
        const list = invalidEtapaGroups.get(etapaDest) ?? [];
        list.push(c.id);
        invalidEtapaGroups.set(etapaDest, list);
        continue;
      }

      const key = `${funilDest}:${etapaDest}`;
      const group = resolveGroups.get(key) ?? { ids: [], funilDest, etapaDest };
      group.ids.push(c.id);
      resolveGroups.set(key, group);
    }

    if (missingFunilIds.length > 0) {
      classificacoesPuladas += await updateByIds(supabase, tenant_id, missingFunilIds, {
        resolution_status: "skipped",
        resolution_error: "funil_destino_id ausente — classificação incompleta",
        resolved_funil_id: null,
        resolved_etapa_id: null,
        resolved_at: nowIso,
      });
    }

    for (const [funilDest, ids] of invalidFunilGroups) {
      classificacoesPuladas += await updateByIds(supabase, tenant_id, ids, {
        resolution_status: "skipped",
        resolution_error: `funil_destino_id '${funilDest}' não existe no nativo`,
        resolved_funil_id: null,
        resolved_etapa_id: null,
        resolved_at: nowIso,
      });
    }

    if (missingEtapaIds.length > 0) {
      classificacoesPuladas += await updateByIds(supabase, tenant_id, missingEtapaIds, {
        resolution_status: "skipped",
        resolution_error: "etapa_destino_id ausente — classificação incompleta",
        resolved_funil_id: null,
        resolved_etapa_id: null,
        resolved_at: nowIso,
      });
    }

    for (const [etapaDest, ids] of invalidEtapaGroups) {
      classificacoesComErro += await updateByIds(supabase, tenant_id, ids, {
        resolution_status: "error",
        resolution_error: `etapa_destino_id '${etapaDest}' inválida ou ausente para o funil`,
        resolved_funil_id: null,
        resolved_etapa_id: null,
        resolved_at: nowIso,
      });
    }

    for (const { ids, funilDest, etapaDest } of resolveGroups.values()) {
      classificacoesResolvidas += await updateByIds(supabase, tenant_id, ids, {
        resolved_funil_id: funilDest,
        resolved_etapa_id: etapaDest,
        resolution_status: "resolved",
        resolution_error: null,
        resolved_at: nowIso,
      });
    }

    const { count: unresolvedAfter, error: countAfterError } = await supabase
      .from("sm_project_classification")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .is("resolved_funil_id", null);
    if (countAfterError) throw countAfterError;

    console.info("[sync-projeto-funis] done", {
      tenant_id,
      unresolvedBefore: unresolvedBefore ?? 0,
      processedBatch: pendentes.length,
      unresolvedAfter: unresolvedAfter ?? 0,
      classificacoesResolvidas,
      classificacoesPuladas,
      classificacoesComErro,
      hasMore,
    });

    return new Response(
      JSON.stringify({
        funisCriados: 0,
        etapasCriadas: 0,
        projetosAlocados: 0,
        smMatched: 0,
        classificacoesResolvidas,
        classificacoesPuladas,
        classificacoesComErro,
        processed_batch: pendentes.length,
        unresolved_before: unresolvedBefore ?? 0,
        remaining_pending: unresolvedAfter ?? 0,
        has_more: (unresolvedAfter ?? 0) > 0 || hasMore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[sync-projeto-funis] erro:", {
      message: e?.message ?? "erro desconhecido",
      detail: e?.detail ?? e?.details ?? null,
      hint: e?.hint ?? null,
      stack: e?.stack ?? null,
    });
    return new Response(
      JSON.stringify({
        error: e?.message ?? "erro desconhecido",
        detail: e?.detail ?? e?.details ?? null,
        hint: e?.hint ?? null,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
