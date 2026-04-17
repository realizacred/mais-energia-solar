import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id obrigatório");

    console.info("[sync-projeto-funis] start", { tenant_id });

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

    let classificacoesResolvidas = 0;
    let classificacoesPuladas = 0;
    let classificacoesComErro = 0;

    const { data: pendentes, error: pendentesError } = await supabase
      .from("sm_project_classification")
      .select("id, funil_destino_id, etapa_destino_id")
      .eq("tenant_id", tenant_id)
      .eq("resolution_status", "pending")
      .is("resolved_funil_id", null)
      .limit(2000);
    if (pendentesError) throw pendentesError;

    const nowIso = new Date().toISOString();

    for (const c of (pendentes ?? []) as Array<{ id: string; funil_destino_id: string | null; etapa_destino_id: string | null }>) {
      const funilDest = c.funil_destino_id;
      const etapaDest = c.etapa_destino_id;

      if (!funilDest) {
        const { error } = await supabase
          .from("sm_project_classification")
          .update({
            resolution_status: "skipped",
            resolution_error: "funil_destino_id ausente — classificação incompleta",
            resolved_at: nowIso,
          })
          .eq("id", c.id)
          .is("resolved_funil_id", null);

        if (error) classificacoesComErro++;
        else classificacoesPuladas++;
        continue;
      }

      if (!funisValidos.has(String(funilDest))) {
        const { error } = await supabase
          .from("sm_project_classification")
          .update({
            resolution_status: "skipped",
            resolution_error: `funil_destino_id '${funilDest}' não existe no nativo`,
            resolved_at: nowIso,
          })
          .eq("id", c.id)
          .eq("funil_destino_id", funilDest)
          .is("resolved_funil_id", null);

        if (error) classificacoesComErro++;
        else classificacoesPuladas++;
        continue;
      }

      if (!etapaDest) {
        const { error } = await supabase
          .from("sm_project_classification")
          .update({
            resolution_status: "skipped",
            resolution_error: "etapa_destino_id ausente — classificação incompleta",
            resolved_at: nowIso,
          })
          .eq("id", c.id)
          .eq("funil_destino_id", funilDest)
          .is("resolved_funil_id", null);

        if (error) classificacoesComErro++;
        else classificacoesPuladas++;
        continue;
      }

      const etapaValida = etapasValidas.has(String(etapaDest));
      const { error: updErr } = await supabase
        .from("sm_project_classification")
        .update({
          resolved_funil_id: funilDest,
          resolved_etapa_id: etapaValida ? etapaDest : null,
          resolution_status: etapaValida ? "resolved" : "error",
          resolution_error: etapaValida
            ? null
            : `etapa_destino_id '${etapaDest}' inválida ou ausente para o funil`,
          resolved_at: nowIso,
        })
        .eq("id", c.id)
        .eq("funil_destino_id", funilDest)
        .eq("etapa_destino_id", etapaDest)
        .is("resolved_funil_id", null);

      if (updErr) classificacoesComErro++;
      else if (etapaValida) classificacoesResolvidas++;
      else classificacoesComErro++;
    }

    console.info("[sync-projeto-funis] done", {
      tenant_id,
      pendentes: (pendentes ?? []).length,
      classificacoesResolvidas,
      classificacoesPuladas,
      classificacoesComErro,
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
