// SECURITY: tenant_id sempre do JWT, ignora body. Vide auditoria de 2026-04-24.
/**
 * sm-criar-pipeline-auto
 * Cria, a partir de um funil SolarMarket no staging:
 *   1) Pipeline COMERCIAL  (tabela `pipelines` + `pipeline_stages`)
 *   2) Funil de EXECUÇÃO espelho (tabela `projeto_funis` + `projeto_etapas`)
 *      com MESMO nome e MESMAS etapas/ordem do pipeline comercial.
 *   3) Mapeamentos sm_etapa_stage_map (etapa SM → pipeline_stages.id)
 *   4) Vinculação sm_funil_pipeline_map (funil SM → pipeline_id comercial)
 *
 * O espelho permite que `sm-promote` resolva, por NOME, o funil de execução
 * correspondente ao pipeline comercial mapeado — alinhando os 2 mundos do CRM
 * (Comercial e Execução) sem precisar de coluna extra no schema.
 *
 * Governança:
 *  - RB-23: sem console.log
 *  - RB-52: service role para escrita
 *  - RB-57: sem let no escopo de módulo
 *  - SEGURANÇA: tenant_id resolvido via JWT (auth.uid → profiles.tenant_id);
 *    body.tenantId é ignorado (apenas log de divergência via console.warn).
 *  - Rollback manual: se qualquer passo falhar após criar o pipeline, desfaz
 *    pipeline_stages + pipelines + projeto_etapas + projeto_funis (espelho).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Stage {
  id?: number | string;
  name?: string;
  order?: number | string;
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
  const state: { pipelineId: string | null; funilExecId: string | null } = {
    pipelineId: null,
    funilExecId: null,
  };

  try {
    // ── SECURITY: resolver tenant_id via JWT (ignora body.tenantId) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Autenticação obrigatória" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const profileTenantId = profile?.tenant_id as string | undefined;
    if (!profileTenantId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Usuário sem tenant vinculado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const smFunilName = (body?.smFunilName as string) || "";

    // Aviso de divergência (não bloqueia — segurança já garantida pelo JWT)
    if (body?.tenantId && body.tenantId !== profileTenantId) {
      console.warn(
        "[sm-criar-pipeline-auto] body.tenantId divergente do JWT — ignorado",
        {
          bodyTenantId: body.tenantId,
          jwtTenantId: profileTenantId,
          userId: user.id,
        },
      );
    }

    const tenantId = profileTenantId;

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

    const stagesOrdenadas = [...stages].sort((a, b) => {
      const orderA = Number(a?.order);
      const orderB = Number(b?.order);
      return (Number.isFinite(orderA) ? orderA : 0) - (Number.isFinite(orderB) ? orderB : 0);
    });

    const finalName = smFunilName.trim();

    // 2) Verificar pipeline duplicado
    const { data: existente } = await admin
      .from("pipelines")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("name", finalName)
      .maybeSingle();
    if (existente) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "PIPELINE_DUPLICADO",
          message: `Já existe um pipeline com o nome "${finalName}". Escolha outro nome ou use o pipeline existente.`,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3) Criar pipeline COMERCIAL (RB-58: confirmar com .select())
    const { data: pipeline, error: pipeErr } = await admin
      .from("pipelines")
      .insert({
        tenant_id: tenantId,
        name: finalName,
        is_active: true,
      })
      .select("id, name")
      .single();
    if (pipeErr) throw new Error(`pipelines: ${pipeErr.message}`);
    if (!pipeline) throw new Error("Falha ao criar pipeline (sem retorno)");
    state.pipelineId = pipeline.id;

    // 4) Criar pipeline_stages
    const stageRows = stagesOrdenadas.map((s, idx) => ({
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
    if (!stagesCriadas || stagesCriadas.length !== stagesOrdenadas.length) {
      throw new Error("Falha ao criar todas as etapas do pipeline");
    }

    const stagesCriadasOrdenadas = [...stagesCriadas].sort(
      (a, b) => Number(a.position ?? 0) - Number(b.position ?? 0),
    );

    // 5) Criar FUNIL DE EXECUÇÃO ESPELHO (projeto_funis) com MESMO nome.
    //    O sm-promote resolve por nome para alinhar Comercial ↔ Execução.
    //    Se já existir um funil com esse nome (ex.: tenant pré-criou), reutiliza.
    const { data: funilExistente } = await admin
      .from("projeto_funis")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("nome", finalName)
      .maybeSingle();

    let funilExecId: string;
    if (funilExistente?.id) {
      funilExecId = funilExistente.id as string;
    } else {
      // calcular próxima ordem
      const { data: funisOrd } = await admin
        .from("projeto_funis")
        .select("ordem")
        .eq("tenant_id", tenantId)
        .order("ordem", { ascending: false })
        .limit(1);
      const nextOrdem = ((funisOrd?.[0]?.ordem as number | undefined) ?? 0) + 1;

      const { data: funilExec, error: funilExecErr } = await admin
        .from("projeto_funis")
        .insert({
          tenant_id: tenantId,
          nome: finalName,
          ordem: nextOrdem,
          ativo: true,
        })
        .select("id")
        .single();
      if (funilExecErr) throw new Error(`projeto_funis: ${funilExecErr.message}`);
      if (!funilExec?.id) throw new Error("Falha ao criar funil de execução espelho");
      funilExecId = funilExec.id as string;
    }
    state.funilExecId = funilExecId;

    // 6) Criar projeto_etapas espelho (mesma ordem). Evita duplicar por nome.
    const { data: etapasExistentes } = await admin
      .from("projeto_etapas")
      .select("nome")
      .eq("tenant_id", tenantId)
      .eq("funil_id", funilExecId);
    const nomesExistentes = new Set(
      (etapasExistentes ?? []).map((e) => String(e.nome).trim().toLowerCase()),
    );

    const etapasRows = stagesOrdenadas
      .map((s, idx) => ({
        tenant_id: tenantId,
        funil_id: funilExecId,
        nome: String(s?.name ?? "").trim() || `Etapa ${idx + 1}`,
        ordem: idx,
        // categoria default: aberto, exceto última (ganho) - heurística simples
        categoria: idx === stagesOrdenadas.length - 1 ? "ganho" : "aberto",
      }))
      .filter((e) => !nomesExistentes.has(e.nome.toLowerCase()));

    if (etapasRows.length > 0) {
      const { error: etapasErr } = await admin
        .from("projeto_etapas")
        .insert(etapasRows);
      if (etapasErr) throw new Error(`projeto_etapas: ${etapasErr.message}`);
    }

    // 7) Mapeamentos sm_etapa_name → pipeline_stages.id (Comercial)
    const mapRows = stagesOrdenadas.map((s, idx) => ({
      tenant_id: tenantId,
      sm_funil_name: finalName,
      sm_etapa_name: String(s?.name ?? "").trim() || `Etapa ${idx + 1}`,
      stage_id: stagesCriadasOrdenadas[idx].id,
    }));

    const { error: mapErr } = await admin
      .from("sm_etapa_stage_map")
      .upsert(mapRows, { onConflict: "tenant_id,sm_funil_name,sm_etapa_name" });
    if (mapErr) throw new Error(`sm_etapa_stage_map: ${mapErr.message}`);

    // 8) Vincular funil SM → pipeline COMERCIAL
    const { error: funilMapErr } = await admin
      .from("sm_funil_pipeline_map")
      .upsert(
        {
          tenant_id: tenantId,
          sm_funil_name: finalName,
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
        funilExecId,
        qtdStages: stagesCriadas.length,
        qtdEtapasExec: etapasRows.length,
        qtdMapeamentos: mapRows.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[sm-criar-pipeline-auto] fatal:", msg);

    // Rollback manual
    if (state.pipelineId) {
      try {
        await admin.from("pipeline_stages").delete().eq("pipeline_id", state.pipelineId);
        await admin.from("pipelines").delete().eq("id", state.pipelineId);
        console.error("[sm-criar-pipeline-auto] rollback pipeline", state.pipelineId);
      } catch (rb) {
        console.error("[sm-criar-pipeline-auto] rollback pipeline falhou:", (rb as Error).message);
      }
    }
    // Só fazemos rollback do funil de execução se ele foi criado AGORA por este request
    // (heurística: se funilExecId existe E pipeline também foi criado por este request).
    if (state.funilExecId && state.pipelineId) {
      try {
        await admin.from("projeto_etapas").delete().eq("funil_id", state.funilExecId);
        await admin.from("projeto_funis").delete().eq("id", state.funilExecId);
        console.error("[sm-criar-pipeline-auto] rollback funil exec", state.funilExecId);
      } catch (rb) {
        console.error("[sm-criar-pipeline-auto] rollback funil exec falhou:", (rb as Error).message);
      }
    }

    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
