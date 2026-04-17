// =============================================================================
// classify-sm-projects (Fase B)
// =============================================================================
// Regra canônica:
//   - Proposta é o ÚNICO critério de elegibilidade.
//   - Classificação define apenas o destino (funil/etapa).
//   - Sem classificação clara → Comercial / Verificar Dados.
//   - telefone_valido é indicador operacional, NUNCA bloqueio.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClassifyRequest {
  tenant_id: string;
  reclassify_all?: boolean; // se true, recalcula mesmo já classificados
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Estado por request (RB-57)
  const state = {
    funilCache: new Map<string, { id: string; nome: string }>(), // lower(nome) -> funil
    etapaCache: new Map<string, { id: string; nome: string; funil_id: string }>(), // funil_id:lower(nome) -> etapa
    consultorNames: new Set<string>(),
  };

  const FINANCE_RE = /(pagamento|financeiro|cobran[çc]a|recebimento|faturamento|financiamento)/i;
  const ENG_RE     = /(engenharia|projeto|t[eé]cnico|homologa[çc][aã]o|instala[çc][aã]o|p[oó]s[- ]?venda)/i;
  const EQUIP_RE   = /(equipamento|kit|log[íi]stica|entrega|expedi[çc][aã]o|estoque)/i;
  // Aceita typo "compesação" (sem N) vindo do SolarMarket
  const COMP_RE    = /(compe?nsa[çc][aã]o|compesa[çc][aã]o|cr[eé]dito|monitoramento|geradora)/i;
  const COMM_RE    = /(comercial|venda|negocia[çc][aã]o|prospec|^lead$)/i;
  const PERDIDO_RE = /(perdido|perda|cancelad)/i;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: ClassifyRequest = await req.json();
    const { tenant_id, reclassify_all = false } = body;
    if (!tenant_id) throw new Error("tenant_id obrigatório");

    // 1) Garantir destino fallback (Comercial / Verificar Dados)
    const { data: fallback, error: fbErr } = await supabase
      .rpc("get_or_create_verificar_dados_stage", { _tenant_id: tenant_id });
    if (fbErr) throw fbErr;
    const fallbackFunilId: string = fallback.funil_id;
    const fallbackEtapaId: string = fallback.etapa_id;

    // 2) Carregar funis do tenant
    const { data: funis, error: funisErr } = await supabase
      .from("projeto_funis")
      .select("id, nome")
      .eq("tenant_id", tenant_id)
      .eq("ativo", true);
    if (funisErr) throw funisErr;

    for (const f of funis ?? []) {
      state.funilCache.set(f.nome.toLowerCase().trim(), { id: f.id, nome: f.nome });
    }

    // 3) Carregar etapas do tenant
    const { data: etapas, error: etapasErr } = await supabase
      .from("projeto_etapas")
      .select("id, nome, funil_id")
      .eq("tenant_id", tenant_id);
    if (etapasErr) throw etapasErr;

    for (const e of etapas ?? []) {
      state.etapaCache.set(`${e.funil_id}:${e.nome.toLowerCase().trim()}`, e);
    }

    // 4) Carregar consultores (para detecção de funil de vendedores)
    const { data: consultores, error: consErr } = await supabase
      .from("consultores")
      .select("nome")
      .eq("tenant_id", tenant_id);
    if (consErr) throw consErr;

    for (const c of consultores ?? []) {
      state.consultorNames.add(c.nome.toLowerCase().trim());
    }

    // 5) Buscar projetos SM elegíveis (têm proposta)
    //    Critério canônico: existe proposta no SM (sm_proposal_id NOT NULL ou tabela de propostas SM)
    //    Aqui usamos a coluna sm_proposal_id como proxy. Sem ela, projetos sem proposta são ignorados.
    let query = supabase
      .from("solar_market_projects")
      .select("id, sm_funnel_name, sm_stage_name, customer_phone, sm_proposal_id, customer_name")
      .eq("tenant_id", tenant_id)
      .not("sm_proposal_id", "is", null);

    const { data: smProjects, error: smErr } = await query;
    if (smErr) throw smErr;

    if (!smProjects || smProjects.length === 0) {
      return new Response(
        JSON.stringify({
          message: "Nenhum projeto SM com proposta para classificar",
          classified: 0,
          skipped: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6) Carregar classificações existentes para evitar reprocessar (idempotência)
    const { data: existing } = await supabase
      .from("sm_project_classification")
      .select("sm_project_id, override_by")
      .eq("tenant_id", tenant_id);

    const existingMap = new Map<string, { override_by: string | null }>();
    for (const e of existing ?? []) {
      existingMap.set(e.sm_project_id, { override_by: e.override_by });
    }

    // 7) Classificar cada projeto
    const isFunilConsultor = (funilNome: string): boolean => {
      // Funil de vendedores: nome do funil bate com consultor OU nome literal "vendedores"
      const lower = funilNome.toLowerCase().trim();
      if (/^vendedor(es)?$/.test(lower)) return true;
      return state.consultorNames.has(lower);
    };

    const classifyKind = (funilNome: string | null, _stageNome: string | null): {
      kind: "comercial" | "engenharia" | "equipamento" | "compensacao" | "verificar_dados";
      funilNomeAlvo: string | null;
    } => {
      if (!funilNome || !funilNome.trim()) {
        return { kind: "verificar_dados", funilNomeAlvo: null };
      }

      // Vendedores → tratar como Comercial (o funil de vendedor é projeção comercial)
      if (isFunilConsultor(funilNome)) return { kind: "comercial", funilNomeAlvo: "Comercial" };

      // Financeiro fora do pipeline principal
      if (FINANCE_RE.test(funilNome)) return { kind: "verificar_dados", funilNomeAlvo: null };

      if (ENG_RE.test(funilNome))   return { kind: "engenharia",   funilNomeAlvo: funilNome };
      if (EQUIP_RE.test(funilNome)) return { kind: "equipamento",  funilNomeAlvo: funilNome };
      if (COMP_RE.test(funilNome))  return { kind: "compensacao",  funilNomeAlvo: funilNome };
      if (COMM_RE.test(funilNome))  return { kind: "comercial",    funilNomeAlvo: funilNome };

      // Sem match claro → fallback
      return { kind: "verificar_dados", funilNomeAlvo: null };
    };

    let classified = 0;
    let skipped = 0;
    let overridden_preserved = 0;

    for (const sm of smProjects) {
      const prev = existingMap.get(sm.id);

      // Preservar overrides manuais
      if (prev?.override_by && !reclassify_all) {
        overridden_preserved++;
        continue;
      }

      // Pular se já classificado e não é reclassify_all
      if (prev && !reclassify_all) {
        skipped++;
        continue;
      }

      const { kind, funilNomeAlvo } = classifyKind(sm.sm_funnel_name, sm.sm_stage_name);
      const telefoneValido = await validatePhone(supabase, sm.customer_phone);

      let funilDestinoId: string | null = null;
      let etapaDestinoId: string | null = null;
      let motivo: string;

      if (kind === "verificar_dados" || !funilNomeAlvo) {
        funilDestinoId = fallbackFunilId;
        etapaDestinoId = fallbackEtapaId;
        motivo = `Fallback: funil_origem="${sm.sm_funnel_name ?? "—"}" não classificável`;
      } else {
        // Resolver funil pelo nome alvo
        const funilHit = state.funilCache.get(funilNomeAlvo.toLowerCase().trim());
        if (funilHit) {
          funilDestinoId = funilHit.id;
          // Resolver etapa pelo nome (case-insensitive)
          if (sm.sm_stage_name) {
            const etapaHit = state.etapaCache.get(
              `${funilHit.id}:${sm.sm_stage_name.toLowerCase().trim()}`
            );
            if (etapaHit) etapaDestinoId = etapaHit.id;
          }
          motivo = `Auto: funil="${funilNomeAlvo}" etapa="${sm.sm_stage_name ?? "—"}"`;
        } else {
          // Funil alvo ainda não existe no nativo → fallback
          funilDestinoId = fallbackFunilId;
          etapaDestinoId = fallbackEtapaId;
          motivo = `Fallback: funil alvo "${funilNomeAlvo}" não existe no nativo`;
        }
      }

      // Upsert (preserva override se reclassify_all=true E há override → não sobrescreve)
      const payload = {
        tenant_id,
        sm_project_id: sm.id,
        pipeline_kind: kind,
        funil_destino_id: funilDestinoId,
        etapa_destino_id: etapaDestinoId,
        telefone_valido: telefoneValido,
        motivo,
      };

      if (prev) {
        const { error: upErr } = await supabase
          .from("sm_project_classification")
          .update(payload)
          .eq("sm_project_id", sm.id);
        if (upErr) {
          console.error(`[classify] update error sm=${sm.id}:`, upErr.message);
          continue;
        }
      } else {
        const { error: insErr } = await supabase
          .from("sm_project_classification")
          .insert(payload);
        if (insErr) {
          console.error(`[classify] insert error sm=${sm.id}:`, insErr.message);
          continue;
        }
      }
      classified++;
    }

    return new Response(
      JSON.stringify({
        total_eligible: smProjects.length,
        classified,
        skipped,
        overridden_preserved,
        fallback_funil_id: fallbackFunilId,
        fallback_etapa_id: fallbackEtapaId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[classify-sm-projects] erro:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function validatePhone(supabase: any, phone: string | null): Promise<boolean> {
  if (!phone) return false;
  const { data, error } = await supabase.rpc("validate_phone_quality", { _phone: phone });
  if (error) return false;
  return data === true;
}
