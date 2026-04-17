import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Todo estado dentro do handler — nunca no módulo (RB-57)
  const state = {
    funilCache: new Map<string, string>(),
    etapaCache: new Map<string, string>(),
    consultorCache: new Map<string, string>(),
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[sync-projeto-funis] Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id obrigatório");

    // 1. Carregar consultores do tenant no cache
    const { data: consultores, error: consultoresError } = await supabase
      .from("consultores")
      .select("id, nome")
      .eq("tenant_id", tenant_id);
    if (consultoresError) throw consultoresError;

    for (const c of consultores ?? []) {
      state.consultorCache.set(c.nome.toLowerCase().trim(), c.id);
    }

    // 2. Buscar todos funis/etapas distintos do SM para esse tenant
    const { data: smRows, error: smError } = await supabase
      .from("solar_market_projects")
      .select("sm_funnel_name, sm_stage_name")
      .eq("tenant_id", tenant_id)
      .not("sm_funnel_name", "is", null);
    if (smError) throw smError;

    // 3. Agrupar etapas por funil
    const funilMap = new Map<string, Set<string>>();
    for (const row of smRows ?? []) {
      const f = row.sm_funnel_name?.trim();
      const e = row.sm_stage_name?.trim();
      if (!f) continue;
      if (!funilMap.has(f)) funilMap.set(f, new Set());
      if (e) funilMap.get(f)!.add(e);
    }

    // 4. Detectar funil de consultor — sem hardcode de nomes
    // Regra: se >=50% das etapas batem com consultores cadastrados → é funil de consultor
    const isFunilConsultor = (etapas: Set<string>): boolean => {
      if (etapas.size === 0) return false;
      let matches = 0;
      for (const etapa of etapas) {
        const etapaLower = etapa.toLowerCase().trim();
        if (state.consultorCache.has(etapaLower)) { matches++; continue; }
        for (const [nomeConsultor] of state.consultorCache) {
          if (nomeConsultor.includes(etapaLower) || etapaLower.includes(nomeConsultor)) {
            matches++; break;
          }
        }
      }
      return matches / etapas.size >= 0.5;
    };

    let funisCriados = 0;
    let etapasCriadas = 0;
    let funilOrdem = 1;

    // 5. Criar funis e etapas — só os que não são de consultor
    for (const [funilNome, etapas] of funilMap.entries()) {
      if (isFunilConsultor(etapas)) continue;

      // Buscar ou criar funil
      let funilId = state.funilCache.get(funilNome.toLowerCase());
      if (!funilId) {
        const { data: existing } = await supabase
          .from("projeto_funis")
          .select("id")
          .eq("tenant_id", tenant_id)
          .ilike("nome", funilNome)
          .maybeSingle();

        if (existing) {
          funilId = existing.id;
        } else {
          const { data: novo, error } = await supabase
            .from("projeto_funis")
            .insert({ tenant_id, nome: funilNome, ordem: funilOrdem, ativo: true })
            .select("id")
            .single();
          if (error) throw error;
          funilId = novo.id;
          funisCriados++;
        }
        state.funilCache.set(funilNome.toLowerCase(), funilId!);
        funilOrdem++;
      }

      // Buscar ordem máxima atual
      const { data: ordemData } = await supabase
        .from("projeto_etapas")
        .select("ordem")
        .eq("funil_id", funilId)
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();
      let ordemEtapa = (ordemData?.ordem ?? 0) + 1;

      // Buscar ou criar etapas
      for (const etapaNome of etapas) {
        const cacheKey = `${funilId}:${etapaNome.toLowerCase()}`;
        if (state.etapaCache.has(cacheKey)) continue;

        const { data: existingEtapa } = await supabase
          .from("projeto_etapas")
          .select("id")
          .eq("funil_id", funilId)
          .ilike("nome", etapaNome)
          .maybeSingle();

        if (existingEtapa) {
          state.etapaCache.set(cacheKey, existingEtapa.id);
        } else {
          const { data: novaEtapa, error } = await supabase
            .from("projeto_etapas")
            .insert({
              tenant_id,
              funil_id: funilId,
              nome: etapaNome,
              ordem: ordemEtapa++,
              cor: "#6366f1",
              categoria: "aberto",
            })
            .select("id")
            .single();
          if (error) throw error;
          state.etapaCache.set(cacheKey, novaEtapa.id);
          etapasCriadas++;
        }
      }
    }

    // 6. Rodar backfill após criar funis/etapas
    const { data: backfill } = await supabase
      .rpc("backfill_projetos_funil_etapa", { p_tenant_id: tenant_id });

    const bf = backfill as { total?: number; sm_matched?: number } | null;

    return new Response(
      JSON.stringify({
        funisCriados,
        etapasCriadas,
        projetosAlocados: bf?.total ?? 0,
        smMatched: bf?.sm_matched ?? 0,
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
