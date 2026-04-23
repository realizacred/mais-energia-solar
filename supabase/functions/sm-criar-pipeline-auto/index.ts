/**
 * sm-criar-pipeline-auto
 * Cria um pipeline nativo a partir de um funil do staging do SolarMarket,
 * replicando exatamente as etapas (stages) e gerando os mapeamentos
 * etapa_sm → stage_novo em sm_etapa_stage_map. Também vincula o funil
 * ao pipeline criado em sm_funil_pipeline_map.
 *
 * Governança:
 *  - RB-23: sem console.log
 *  - RB-52: service role
 *  - RB-57: sem let no escopo de módulo
 *  - Rollback manual: se qualquer passo após criar o pipeline falhar,
 *    desfaz pipeline_stages + pipelines para evitar estado inconsistente.
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Stage {
  id?: number | string;
  name?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Estado por request (RB-57)
  const state: { pipelineId: string | null } = { pipelineId: null };

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = (body?.tenantId as string) || "";
    const smFunilName = (body?.smFunilName as string) || "";

    if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
      return new Response(
        JSON.stringify({ ok: false, error: "tenantId (uuid) é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!smFunilName.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: "smFunilName é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Buscar o funil pelo nome no staging
    const { data: funis, error: funisErr } = await admin
      .from("sm_funis_raw")
      .select("payload")
      .eq("tenant_id", tenantId);
    if (funisErr) throw new Error(`sm_funis_raw: ${funisErr.message}`);

    const funil = (funis ?? []).find(
      (f) => String((f.payload as Record<string, unknown>)?.name ?? "").trim() === smFunilName.trim(),
    );
    if (!funil) throw new Error(`Funil "${smFunilName}" não encontrado no staging`);

    const stages = Array.isArray((funil.payload as Record<string, unknown>)?.stages)
      ? ((funil.payload as Record<string, unknown>).stages as Stage[])
      : [];
    if (stages.length === 0) throw new Error(`Funil "${smFunilName}" não tem etapas`);

    // 2) Verificar se já existe pipeline com mesmo nome (constraint uq_pipeline_tenant_name_version)
    const { data: existente } = await admin
      .from("pipelines")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("name", smFunilName.trim())
      .maybeSingle();
    if (existente) {
      throw new Error(
        `Já existe um pipeline com o nome "${smFunilName}". Renomeie o funil ou use outro pipeline.`,
      );
    }

    // 3) Criar pipeline (RB-58: confirmar com .select())
    const { data: pipeline, error: pipeErr } = await admin
      .from("pipelines")
      .insert({
        tenant_id: tenantId,
        name: smFunilName.trim(),
        is_active: true,
      })
      .select("id, name")
      .single();
    if (pipeErr) throw new Error(`pipelines: ${pipeErr.message}`);
    if (!pipeline) throw new Error("Falha ao criar pipeline (sem retorno)");
    state.pipelineId = pipeline.id;

    // 4) Criar pipeline_stages na mesma ordem
    const stageRows = stages.map((s, idx) => ({
      tenant_id: tenantId,
      pipeline_id: pipeline.id,
      name: String(s?.name ?? "").trim() || `Etapa ${idx + 1}`,
      position: idx,
      is_closed: false,
      is_won: false,
      probability: 50,
    }));

    const { data: stagesCriadas, error: stagesErr } = await admin
      .from("pipeline_stages")
      .insert(stageRows)
      .select("id, name, position");
    if (stagesErr) throw new Error(`pipeline_stages: ${stagesErr.message}`);
    if (!stagesCriadas || stagesCriadas.length !== stages.length) {
      throw new Error("Falha ao criar todas as etapas do pipeline");
    }

    // 5) Criar mapeamentos sm_etapa_name → stage_id
    // Schema real: (tenant_id, sm_funil_name, sm_etapa_name, stage_id)
    const mapRows = stages.map((s, idx) => ({
      tenant_id: tenantId,
      sm_funil_name: smFunilName.trim(),
      sm_etapa_name: String(s?.name ?? "").trim() || `Etapa ${idx + 1}`,
      stage_id: stagesCriadas[idx].id,
    }));

    const { error: mapErr } = await admin
      .from("sm_etapa_stage_map")
      .upsert(mapRows, { onConflict: "tenant_id,sm_funil_name,sm_etapa_name" });
    if (mapErr) throw new Error(`sm_etapa_stage_map: ${mapErr.message}`);

    // 6) Vincular funil ao pipeline em sm_funil_pipeline_map
    const { error: funilMapErr } = await admin
      .from("sm_funil_pipeline_map")
      .upsert(
        {
          tenant_id: tenantId,
          sm_funil_name: smFunilName.trim(),
          role: "pipeline",
          pipeline_id: pipeline.id,
        },
        { onConflict: "tenant_id,sm_funil_name" },
      );
    if (funilMapErr) throw new Error(`sm_funil_pipeline_map: ${funilMapErr.message}`);

    return new Response(
      JSON.stringify({
        ok: true,
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        qtdStages: stagesCriadas.length,
        qtdMapeamentos: mapRows.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[sm-criar-pipeline-auto] fatal:", msg);

    // Rollback manual se já havia criado pipeline
    if (state.pipelineId) {
      try {
        await admin.from("sm_etapa_stage_map")
          .delete()
          .eq("tenant_id", (await req.json().catch(() => ({})))?.tenantId ?? "")
          .in("stage_id", []); // best-effort, não crítico
      } catch { /* ignore */ }
      try {
        await admin.from("pipeline_stages").delete().eq("pipeline_id", state.pipelineId);
        await admin.from("pipelines").delete().eq("id", state.pipelineId);
        console.error("[sm-criar-pipeline-auto] rollback do pipeline", state.pipelineId);
      } catch (rb) {
        console.error("[sm-criar-pipeline-auto] rollback falhou:", (rb as Error).message);
      }
    }

    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
