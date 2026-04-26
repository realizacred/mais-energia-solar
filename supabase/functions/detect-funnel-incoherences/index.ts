/**
 * detect-funnel-incoherences — Worker determinístico de detecção de incoerências entre funis.
 *
 * Lê ai_funnel_rules ativas, varre projetos+deals do tenant e popula ai_funnel_alerts
 * com os casos onde o funil alvo NÃO está na categoria esperada dada a categoria do funil origem.
 *
 * Idempotente: não cria alerta duplicado quando já existe um aberto para o mesmo
 * (rule_id, projeto_id|deal_id).
 *
 * Governança:
 *  - RB-71: chunks pequenos (lê tudo por tenant, mas só uma vez)
 *  - RB-75: logs estruturados (resumo por tenant, não por projeto)
 *  - RB-04 / DA-47: respeita arquitetura dual (projeto_funis vs pipelines)
 *  - SECURITY: usa SERVICE_ROLE para bypass de RLS (worker de sistema)
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Categoria = "aberto" | "ganho" | "perdido" | "excluido";
type Papel =
  | "comercial"
  | "engenharia"
  | "suprimentos"
  | "instalacao"
  | "concessionaria"
  | "pos_venda"
  | "outro";

interface Rule {
  id: string;
  tenant_id: string;
  funil_origem_papel: Papel;
  etapa_origem_categoria: Categoria;
  funil_alvo_papel: Papel;
  etapa_alvo_categoria_esperada: Categoria;
  acao: string;
  prioridade: number;
}

const CAT_ORDER: Record<Categoria, number> = {
  aberto: 0,
  ganho: 1,
  perdido: 2,
  excluido: 3,
};

/** "Está pelo menos em" — usado para regras como "alvo deve estar (no mínimo) em ganho". */
function meetsExpectation(actual: Categoria | null, expected: Categoria): boolean {
  if (!actual) return false;
  // Se esperado é "aberto", qualquer coisa serve (qualquer atividade conta).
  if (expected === "aberto") return true;
  // Caso contrário, exige igualdade ou avanço (ganho/perdido/excluido).
  return CAT_ORDER[actual] >= CAT_ORDER[expected];
}

function deriveDealCategoria(stage: {
  is_closed: boolean | null;
  is_won: boolean | null;
} | null): Categoria | null {
  if (!stage) return null;
  if (!stage.is_closed) return "aberto";
  return stage.is_won ? "ganho" : "perdido";
}

interface DetectionSummary {
  tenant_id: string;
  rules: number;
  projects_scanned: number;
  alerts_created: number;
  alerts_skipped_existing: number;
  errors: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function detectForTenant(
  supabase: any,
  tenantId: string,
): Promise<DetectionSummary> {
  const summary: DetectionSummary = {
    tenant_id: tenantId,
    rules: 0,
    projects_scanned: 0,
    alerts_created: 0,
    alerts_skipped_existing: 0,
    errors: 0,
  };

  // 1) Carrega regras ativas
  const { data: rules, error: rulesErr } = await supabase
    .from("ai_funnel_rules")
    .select(
      "id, tenant_id, funil_origem_papel, etapa_origem_categoria, funil_alvo_papel, etapa_alvo_categoria_esperada, acao, prioridade",
    )
    .eq("tenant_id", tenantId)
    .eq("ativo", true);
  if (rulesErr) {
    console.error(`[detect] rules load failed tenant=${tenantId}`, rulesErr.message);
    summary.errors++;
    return summary;
  }
  summary.rules = (rules ?? []).length;
  if (summary.rules === 0) return summary;

  // 2) Mapas auxiliares: papel→categoria do funil para cada projeto/deal
  // 2a) Funis de execução (projeto_funis) com etapas+categorias
  const { data: pfEtapas, error: pfEtapasErr } = await supabase
    .from("projeto_etapas")
    .select("id, funil_id, categoria, nome")
    .eq("tenant_id", tenantId);
  if (pfEtapasErr) {
    console.error(`[detect] projeto_etapas failed tenant=${tenantId}`, pfEtapasErr.message);
    summary.errors++;
    return summary;
  }
  const etapaById = new Map<string, { funil_id: string; categoria: Categoria; nome: string }>();
  for (const e of pfEtapas ?? []) {
    etapaById.set(e.id as string, {
      funil_id: e.funil_id as string,
      categoria: (e.categoria as Categoria) ?? "aberto",
      nome: (e.nome as string) ?? "",
    });
  }

  const { data: pFunis, error: pFunisErr } = await supabase
    .from("projeto_funis")
    .select("id, papel, ativo, nome")
    .eq("tenant_id", tenantId);
  if (pFunisErr) {
    console.error(`[detect] projeto_funis failed tenant=${tenantId}`, pFunisErr.message);
    summary.errors++;
    return summary;
  }
  const projetoFunilPapelById = new Map<string, Papel>();
  for (const f of pFunis ?? []) {
    projetoFunilPapelById.set(f.id as string, ((f.papel as Papel) ?? "outro"));
  }

  // 2b) Pipelines (mundo deals) com stages
  const { data: pStages, error: pStagesErr } = await supabase
    .from("pipeline_stages")
    .select("id, pipeline_id, name, is_closed, is_won")
    .eq("tenant_id", tenantId);
  if (pStagesErr) {
    console.error(`[detect] pipeline_stages failed tenant=${tenantId}`, pStagesErr.message);
    summary.errors++;
    return summary;
  }
  const stageById = new Map<
    string,
    { pipeline_id: string; name: string; is_closed: boolean | null; is_won: boolean | null }
  >();
  for (const s of pStages ?? []) {
    stageById.set(s.id as string, {
      pipeline_id: s.pipeline_id as string,
      name: (s.name as string) ?? "",
      is_closed: s.is_closed as boolean | null,
      is_won: s.is_won as boolean | null,
    });
  }

  const { data: pipelines, error: pipelinesErr } = await supabase
    .from("pipelines")
    .select("id, papel")
    .eq("tenant_id", tenantId);
  if (pipelinesErr) {
    console.error(`[detect] pipelines failed tenant=${tenantId}`, pipelinesErr.message);
    summary.errors++;
    return summary;
  }
  const pipelinePapelById = new Map<string, Papel>();
  for (const p of pipelines ?? []) {
    pipelinePapelById.set(p.id as string, ((p.papel as Papel) ?? "outro"));
  }

  // 3) Carrega projetos ativos do tenant (com etapa atual e deal vinculado)
  // status != 'cancelado' / 'concluido' para focar no operacional.
  const { data: projetos, error: projErr } = await supabase
    .from("projetos")
    .select("id, funil_id, etapa_id, status")
    .eq("tenant_id", tenantId);
  if (projErr) {
    console.error(`[detect] projetos failed tenant=${tenantId}`, projErr.message);
    summary.errors++;
    return summary;
  }

  const projetoIds = (projetos ?? []).map((p) => p.id as string);
  summary.projects_scanned = projetoIds.length;
  if (projetoIds.length === 0) return summary;

  // Deals desses projetos
  const dealsByProjeto = new Map<string, { id: string; stage_id: string | null }>();
  if (projetoIds.length > 0) {
    const { data: deals, error: dealsErr } = await supabase
      .from("deals")
      .select("id, projeto_id, stage_id")
      .eq("tenant_id", tenantId)
      .in("projeto_id", projetoIds);
    if (dealsErr) {
      console.error(`[detect] deals failed tenant=${tenantId}`, dealsErr.message);
      summary.errors++;
    } else {
      for (const d of deals ?? []) {
        const pid = d.projeto_id as string | null;
        if (pid && !dealsByProjeto.has(pid)) {
          dealsByProjeto.set(pid, { id: d.id as string, stage_id: d.stage_id as string | null });
        }
      }
    }
  }

  // 4) Para cada projeto, monta o "estado por papel"
  // Cada projeto pode ter múltiplos papéis preenchidos: o funil de execução do próprio projeto
  // e o papel do pipeline do deal vinculado.
  // (Mais adiante: projeto_funis_extra para projetos em vários funis simultâneos.)

  const existingAlerts = new Set<string>();
  {
    const { data: openAlerts } = await supabase
      .from("ai_funnel_alerts")
      .select("rule_id, projeto_id, deal_id")
      .eq("tenant_id", tenantId)
      .eq("estado", "aberto");
    for (const a of openAlerts ?? []) {
      existingAlerts.add(`${a.rule_id}|${a.projeto_id ?? ""}|${a.deal_id ?? ""}`);
    }
  }

  type AlertInsert = {
    tenant_id: string;
    rule_id: string;
    projeto_id: string | null;
    deal_id: string | null;
    funil_origem_papel: Papel;
    funil_alvo_papel: Papel;
    etapa_atual_alvo: string | null;
    etapa_esperada_alvo: string | null;
    severidade: string;
    estado: string;
    mensagem: string;
  };
  const toInsert: AlertInsert[] = [];

  for (const proj of projetos ?? []) {
    const projId = proj.id as string;
    const stateByPapel = new Map<Papel, { categoria: Categoria; etapa_nome: string | null }>();

    // Estado vindo do funil de execução do projeto
    const projEtapa = proj.etapa_id ? etapaById.get(proj.etapa_id as string) : null;
    if (projEtapa && proj.funil_id) {
      const papel = projetoFunilPapelById.get(proj.funil_id as string) ?? "outro";
      stateByPapel.set(papel, { categoria: projEtapa.categoria, etapa_nome: projEtapa.nome });
    }

    // Estado vindo do deal vinculado
    const deal = dealsByProjeto.get(projId);
    if (deal && deal.stage_id) {
      const stage = stageById.get(deal.stage_id);
      if (stage) {
        const papel = pipelinePapelById.get(stage.pipeline_id) ?? "outro";
        const categoria = deriveDealCategoria(stage);
        if (categoria) {
          // Não sobrescreve se já temos algo daquele papel pelo projeto (preferência execução).
          if (!stateByPapel.has(papel)) {
            stateByPapel.set(papel, { categoria, etapa_nome: stage.name });
          }
        }
      }
    }

    // Aplica cada regra
    for (const rule of rules as Rule[]) {
      const origem = stateByPapel.get(rule.funil_origem_papel);
      if (!origem) continue; // Projeto não passa por esse papel — regra não se aplica.
      if (origem.categoria !== rule.etapa_origem_categoria) continue;

      const alvo = stateByPapel.get(rule.funil_alvo_papel);
      const alvoCategoria = alvo?.categoria ?? null;
      if (meetsExpectation(alvoCategoria, rule.etapa_alvo_categoria_esperada)) continue;

      // Incoerência detectada
      const dealId = deal?.id ?? null;
      const dedupKey = `${rule.id}|${projId}|${dealId ?? ""}`;
      if (existingAlerts.has(dedupKey)) {
        summary.alerts_skipped_existing++;
        continue;
      }
      existingAlerts.add(dedupKey);

      toInsert.push({
        tenant_id: tenantId,
        rule_id: rule.id,
        projeto_id: projId,
        deal_id: dealId,
        funil_origem_papel: rule.funil_origem_papel,
        funil_alvo_papel: rule.funil_alvo_papel,
        etapa_atual_alvo: alvo?.etapa_nome ?? null,
        etapa_esperada_alvo: rule.etapa_alvo_categoria_esperada,
        severidade: rule.acao === "auto_corrigir" ? "alta" : rule.acao === "sugerir" ? "media" : "baixa",
        estado: "aberto",
        mensagem: `Funil ${rule.funil_alvo_papel} deveria estar em '${rule.etapa_alvo_categoria_esperada}' porque ${rule.funil_origem_papel} está em '${rule.etapa_origem_categoria}'.`,
      });
    }
  }

  // 5) Insert em lote (chunks de 100 para segurança)
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100);
      const { error: insErr } = await supabase.from("ai_funnel_alerts").insert(chunk);
      if (insErr) {
        console.error(`[detect] insert failed tenant=${tenantId}`, insErr.message);
        summary.errors++;
      } else {
        summary.alerts_created += chunk.length;
      }
    }
  }

  return summary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let tenantIds: string[] = [];
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (Array.isArray(body?.tenant_ids)) {
          tenantIds = body.tenant_ids.filter((x: unknown) => typeof x === "string");
        } else if (typeof body?.tenant_id === "string") {
          tenantIds = [body.tenant_id];
        }
      } catch {
        // sem body ⇒ varre todos os tenants
      }
    }

    if (tenantIds.length === 0) {
      // Pega tenants que tenham PELO MENOS uma regra ativa (otimização).
      const { data: tRules, error: tErr } = await supabase
        .from("ai_funnel_rules")
        .select("tenant_id")
        .eq("ativo", true);
      if (tErr) throw new Error(tErr.message);
      tenantIds = Array.from(new Set((tRules ?? []).map((r) => r.tenant_id as string)));
    }

    const summaries: DetectionSummary[] = [];
    for (const tid of tenantIds) {
      const s = await detectForTenant(supabase, tid);
      summaries.push(s);
    }

    const totals = summaries.reduce(
      (acc, s) => {
        acc.tenants++;
        acc.rules += s.rules;
        acc.projects_scanned += s.projects_scanned;
        acc.alerts_created += s.alerts_created;
        acc.alerts_skipped_existing += s.alerts_skipped_existing;
        acc.errors += s.errors;
        return acc;
      },
      {
        tenants: 0,
        rules: 0,
        projects_scanned: 0,
        alerts_created: 0,
        alerts_skipped_existing: 0,
        errors: 0,
      },
    );

    console.log(`[detect-funnel-incoherences] summary`, JSON.stringify(totals));

    return new Response(
      JSON.stringify({ ok: true, totals, summaries }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[detect-funnel-incoherences] fatal`, msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
