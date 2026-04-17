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

    // 1. Buscar funis/etapas distintos do SM — excluir 'Vendedores' (consultor, não funil)
    const { data: smData, error: smError } = await supabase
      .from("solar_market_projects")
      .select("sm_funnel_name, sm_stage_name")
      .eq("tenant_id", tenant_id)
      .not("sm_funnel_name", "is", null)
      .neq("sm_funnel_name", "Vendedores");

    if (smError) throw smError;

    // 2. Agrupar etapas por funil mantendo ordem de aparição
    const funilMap = new Map<string, Set<string>>();
    for (const row of smData ?? []) {
      const fn = row.sm_funnel_name as string | null;
      if (!fn) continue;
      if (!funilMap.has(fn)) funilMap.set(fn, new Set());
      const sn = row.sm_stage_name as string | null;
      if (sn) funilMap.get(fn)!.add(sn);
    }

    const counters = { funisCriados: 0, etapasCriadas: 0, funilOrdem: 1 };

    for (const [funilNome, etapasSet] of funilMap.entries()) {
      const { data: existingFunil } = await supabase
        .from("projeto_funis")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("nome", funilNome)
        .maybeSingle();

      const funilId = await (async () => {
        if (existingFunil) return existingFunil.id as string;
        const { data: novo, error: fErr } = await supabase
          .from("projeto_funis")
          .insert({ tenant_id, nome: funilNome, ordem: counters.funilOrdem, ativo: true })
          .select("id")
          .single();
        if (fErr) throw fErr;
        counters.funisCriados++;
        return novo.id as string;
      })();

      counters.funilOrdem++;

      const etapasArr = Array.from(etapasSet);
      for (let i = 0; i < etapasArr.length; i++) {
        const etapaNome = etapasArr[i];
        const { data: existingEtapa } = await supabase
          .from("projeto_etapas")
          .select("id")
          .eq("funil_id", funilId)
          .eq("nome", etapaNome)
          .maybeSingle();

        if (!existingEtapa) {
          const { error: eErr } = await supabase
            .from("projeto_etapas")
            .insert({
              tenant_id,
              funil_id: funilId,
              nome: etapaNome,
              ordem: i + 1,
              cor: "#6366f1",
              categoria: "aberto",
            });
          if (eErr) throw eErr;
          counters.etapasCriadas++;
        }
      }
    }

    // 3. Após criar funis/etapas, rodar o backfill
    const { data: backfill, error: bfErr } = await supabase
      .rpc("backfill_projetos_funil_etapa", { p_tenant_id: tenant_id });
    if (bfErr) throw bfErr;

    const bf = (backfill ?? {}) as Record<string, number>;

    return new Response(
      JSON.stringify({
        funisCriados: counters.funisCriados,
        etapasCriadas: counters.etapasCriadas,
        projetosAlocados: bf.total ?? 0,
        smMatched: bf.sm_matched ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    console.error("[sync-projeto-funis] erro:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
