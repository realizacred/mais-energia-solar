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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // 1b. Pré-carregar funis e etapas EXISTENTES do tenant (Fase 1)
    // Necessário para resolver classificações em tenants já configurados,
    // onde nenhum funil/etapa novo será criado nesta rodada.
    const { data: funisExistentes } = await supabase
      .from("projeto_funis")
      .select("id, nome")
      .eq("tenant_id", tenant_id);
    for (const f of funisExistentes ?? []) {
      state.funilCache.set(f.nome.toLowerCase().trim(), f.id);
    }

    const funilIds = (funisExistentes ?? []).map((f) => f.id);
    if (funilIds.length) {
      const { data: etapasExistentes } = await supabase
        .from("projeto_etapas")
        .select("id, nome, funil_id")
        .in("funil_id", funilIds);
      for (const e of etapasExistentes ?? []) {
        state.etapaCache.set(`${e.funil_id}:${e.nome.toLowerCase().trim()}`, e.id);
      }
    }

    // 2. Buscar funis/etapas distintos do SM para esse tenant
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
    // Regra validada pelos dados reais: se >=50% das etapas batem
    // com consultores cadastrados (ILIKE) → é funil de consultor, não criar
    const isFunilConsultor = (etapas: Set<string>): boolean => {
      if (etapas.size === 0) return false;
      let matches = 0;
      for (const etapa of etapas) {
        const etapaLower = etapa.toLowerCase().trim();
        if (state.consultorCache.has(etapaLower)) { matches++; continue; }
        for (const [nomeConsultor] of state.consultorCache) {
          if (
            nomeConsultor.includes(etapaLower) ||
            etapaLower.includes(nomeConsultor)
          ) {
            matches++;
            break;
          }
        }
      }
      return matches / etapas.size >= 0.5;
    };

    let funisCriados = 0;
    let etapasCriadas = 0;
    let funilOrdem = (funisExistentes?.length ?? 0) + 1;

    // Funis financeiros: dimensão paralela, não entram no pipeline principal
    const FINANCE_FUNNEL_RE = /(pagamento|financeiro|cobran[çc]a|recebimento|faturamento|financiamento)/i;
    const isFunilFinanceiro = (nome: string): boolean => FINANCE_FUNNEL_RE.test(nome);

    // 5. Criar funis e etapas — só os que não são de consultor nem financeiros
    for (const [funilNome, etapas] of funilMap.entries()) {
      if (isFunilConsultor(etapas)) continue;
      if (isFunilFinanceiro(funilNome)) continue;

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

      // Buscar ordem máxima atual das etapas desse funil
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

    // 6. Backfill — alocar projetos nas etapas criadas
    const { data: backfill } = await supabase
      .rpc("backfill_projetos_funil_etapa", { p_tenant_id: tenant_id });

    // 7. Resolver classificações pendentes (Fase 1)
    // Lê sm_project_classification.pending → preenche target_* (decisão)
    // e resolved_*_id (execução) a partir dos caches.
    let classificacoesResolvidas = 0;
    let classificacoesPuladas = 0;
    let classificacoesComErro = 0;

    const { data: pendentes, error: pendentesError } = await supabase
      .from("sm_project_classification")
      .select("id, sm_project_id, sm:solar_market_projects!inner(sm_funnel_name, sm_stage_name)")
      .eq("tenant_id", tenant_id)
      .eq("resolution_status", "pending")
      .limit(2000);

    if (pendentesError) {
      console.error("[sync-projeto-funis] erro ao buscar pendentes:", pendentesError);
    }

    const nowIso = new Date().toISOString();

    for (const c of pendentes ?? []) {
      const sm = (c as any).sm;
      const funilNome: string | null = sm?.sm_funnel_name?.trim() ?? null;
      const etapaNome: string | null = sm?.sm_stage_name?.trim() ?? null;

      // Caso 1: sem funil de origem → skip (não há decisão a tomar)
      if (!funilNome) {
        await supabase.from("sm_project_classification").update({
          target_funnel_name: null,
          target_stage_name: null,
          resolution_status: "skipped",
          resolution_error: "sm_funnel_name vazio",
          resolved_at: nowIso,
        }).eq("id", c.id);
        classificacoesPuladas++;
        continue;
      }

      // Decisão: por ora target = origem (sem reclassificação semântica nesta fase)
      const targetFunnel = funilNome;
      const targetStage = etapaNome;

      const funilId = state.funilCache.get(targetFunnel.toLowerCase());

      // Caso 2: funil-alvo não existe no nativo (consultor/financeiro/não criado)
      if (!funilId) {
        await supabase.from("sm_project_classification").update({
          target_funnel_name: targetFunnel,
          target_stage_name: targetStage,
          resolved_funil_id: null,
          resolved_etapa_id: null,
          resolution_status: "skipped",
          resolution_error: `funil '${targetFunnel}' não disponível no nativo (consultor/financeiro)`,
          resolved_at: nowIso,
        }).eq("id", c.id);
        classificacoesPuladas++;
        continue;
      }

      const etapaId = targetStage
        ? state.etapaCache.get(`${funilId}:${targetStage.toLowerCase()}`) ?? null
        : null;

      // Caso 3: funil OK, etapa OK → resolved
      // Caso 4: funil OK, etapa ausente/não encontrada → error (auditável)
      const ok = !!etapaId;
      const { error: updErr } = await supabase
        .from("sm_project_classification")
        .update({
          target_funnel_name: targetFunnel,
          target_stage_name: targetStage,
          resolved_funil_id: funilId,
          resolved_etapa_id: etapaId,
          resolution_status: ok ? "resolved" : "error",
          resolution_error: ok
            ? null
            : `etapa '${targetStage ?? "(vazia)"}' não encontrada no funil '${targetFunnel}'`,
          resolved_at: nowIso,
        })
        .eq("id", c.id);

      if (updErr) classificacoesComErro++;
      else if (ok) classificacoesResolvidas++;
      else classificacoesComErro++;
    }

    return new Response(
      JSON.stringify({
        funisCriados,
        etapasCriadas,
        projetosAlocados: (backfill as Record<string, number> | null)?.total ?? 0,
        smMatched: (backfill as Record<string, number> | null)?.sm_matched ?? 0,
        // Fase 1 — métricas de resolução
        classificacoesResolvidas,
        classificacoesPuladas,
        classificacoesComErro,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    console.error("[sync-projeto-funis] erro:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
