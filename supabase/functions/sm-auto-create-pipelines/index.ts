/**
 * sm-auto-create-pipelines
 * Cria pipelines/stages nativos a partir dos funis únicos em sm_funis_raw.
 *
 * Governança:
 *   - RB-23: sem console.log (usar console.error apenas em falhas reais)
 *   - RB-52: service role
 *   - RB-57: nada de let no escopo de módulo (estado por request)
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DefaultStage {
  name: string;
  position: number;
  probability: number;
  is_won: boolean;
  is_closed: boolean;
}

const DEFAULT_STAGES: DefaultStage[] = [
  { name: "Prospecção",      position: 1, probability: 20,  is_won: false, is_closed: false },
  { name: "Análise Técnica", position: 2, probability: 40,  is_won: false, is_closed: false },
  { name: "Proposta Enviada",position: 3, probability: 60,  is_won: false, is_closed: false },
  { name: "Aprovada",        position: 4, probability: 100, is_won: true,  is_closed: true  },
  { name: "Perdida",         position: 5, probability: 0,   is_won: false, is_closed: true  },
];

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface CreatedPipeline {
  name: string;
  id: string;
  stages: number;
  already_existed: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = (body?.tenantId as string) || "";

    if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
      return new Response(
        JSON.stringify({ error: "tenantId (uuid) é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Coletar nomes únicos de funis (de sm_funis_raw + payloads em sm_propostas_raw)
    const uniqueNames = new Map<string, string>(); // normalized -> original

    const { data: funisRaw, error: funisErr } = await admin
      .from("sm_funis_raw")
      .select("payload")
      .eq("tenant_id", tenantId);
    if (funisErr) throw new Error(`sm_funis_raw: ${funisErr.message}`);

    for (const r of funisRaw ?? []) {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      const name = (p.name as string) || (p.nome as string) || "";
      if (name) uniqueNames.set(normalize(name), name);
    }

    if (uniqueNames.size === 0) {
      const { data: propsRaw, error: propsErr } = await admin
        .from("sm_propostas_raw")
        .select("payload")
        .eq("tenant_id", tenantId)
        .limit(5000);
      if (propsErr) throw new Error(`sm_propostas_raw: ${propsErr.message}`);

      for (const r of propsRaw ?? []) {
        const p = (r.payload ?? {}) as Record<string, unknown>;
        const name = (p.funil as string) || (p.funnel as string) || "";
        if (name) uniqueNames.set(normalize(name), name);
      }
    }

    // 2) Carregar pipelines existentes do tenant
    const { data: existing, error: exErr } = await admin
      .from("pipelines")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    if (exErr) throw new Error(`pipelines: ${exErr.message}`);

    const existingByNorm = new Map<string, { id: string; name: string }>();
    for (const p of existing ?? []) existingByNorm.set(normalize(p.name), p);

    let createdPipelines = 0;
    let createdStages = 0;
    const result: CreatedPipeline[] = [];

    // 3) Processar cada funil único
    for (const [norm, originalName] of uniqueNames) {
      const match = existingByNorm.get(norm);
      if (match) {
        const { count } = await admin
          .from("pipeline_stages")
          .select("id", { count: "exact", head: true })
          .eq("pipeline_id", match.id);
        result.push({
          name: match.name,
          id: match.id,
          stages: count ?? 0,
          already_existed: true,
        });
        continue;
      }

      // Criar pipeline novo
      const { data: pipe, error: pErr } = await admin
        .from("pipelines")
        .insert({ tenant_id: tenantId, name: originalName, is_active: true })
        .select("id, name")
        .single();
      if (pErr) {
        console.error(`[sm-auto-create-pipelines] pipeline "${originalName}":`, pErr.message);
        continue;
      }

      // Criar stages padrão
      const stagesPayload = DEFAULT_STAGES.map((s) => ({
        tenant_id: tenantId,
        pipeline_id: pipe.id,
        name: s.name,
        position: s.position,
        probability: s.probability,
        is_won: s.is_won,
        is_closed: s.is_closed,
      }));

      const { error: sErr } = await admin
        .from("pipeline_stages")
        .insert(stagesPayload);
      if (sErr) {
        console.error(`[sm-auto-create-pipelines] stages "${originalName}":`, sErr.message);
        continue;
      }

      createdPipelines += 1;
      createdStages += stagesPayload.length;
      result.push({
        name: pipe.name,
        id: pipe.id,
        stages: stagesPayload.length,
        already_existed: false,
      });
    }

    return new Response(
      JSON.stringify({
        created_pipelines: createdPipelines,
        created_stages: createdStages,
        pipelines: result,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[sm-auto-create-pipelines] fatal:", (e as Error).message);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
