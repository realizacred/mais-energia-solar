import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Deterministic scoring engine (mirrors useLeadScoring.ts calcularScore) ──

interface ScoringConfig {
  peso_consumo: number;
  peso_recencia: number;
  peso_engajamento: number;
  peso_perfil_tecnico: number;
  peso_localizacao: number;
  peso_tempo_resposta: number;
  consumo_alto_min: number;
  consumo_medio_min: number;
  recencia_quente_max: number;
  recencia_morna_max: number;
  threshold_hot: number;
  threshold_warm: number;
  probabilidade_hot: number;
  probabilidade_warm: number;
  probabilidade_cold: number;
  ticket_medio: number;
}

interface LeadRow {
  id: string;
  tenant_id: string;
  media_consumo: number;
  tipo_telhado: string;
  area: string;
  rede_atendimento: string;
  ultimo_contato: string | null;
  created_at: string;
  visto: boolean;
  visto_admin: boolean;
  status_id: string | null;
  deleted_at: string | null;
}

interface ScoreRow {
  lead_id: string;
  tenant_id: string;
  score: number;
  nivel: string;
  probabilidade_fechamento: number;
  fatores: string;
  recomendacao: string;
  score_consumo: number;
  score_recencia: number;
  score_engajamento: number;
  score_perfil_tecnico: number;
  score_localizacao: number;
  score_tempo_resposta: number;
  valor_estimado: number;
  calculado_em: string;
}

function calcularScore(
  lead: LeadRow,
  config: ScoringConfig,
  statusNome?: string
): ScoreRow {
  const fatores: string[] = [];
  const agora = Date.now();
  const criadoEm = new Date(lead.created_at).getTime();
  const diasCriacao = Math.floor((agora - criadoEm) / (1000 * 60 * 60 * 24));

  const ultimoContato = lead.ultimo_contato ? new Date(lead.ultimo_contato).getTime() : null;
  const diasSemContato = ultimoContato
    ? Math.floor((agora - ultimoContato) / (1000 * 60 * 60 * 24))
    : diasCriacao;

  // 1) CONSUMO
  let scoreConsumo = 0;
  if (lead.media_consumo >= config.consumo_alto_min) {
    scoreConsumo = 100;
    fatores.push(`Consumo alto: ${lead.media_consumo}kWh`);
  } else if (lead.media_consumo >= config.consumo_medio_min) {
    scoreConsumo = 60;
    fatores.push(`Consumo médio: ${lead.media_consumo}kWh`);
  } else if (lead.media_consumo > 0) {
    scoreConsumo = 30;
    fatores.push(`Consumo baixo: ${lead.media_consumo}kWh`);
  }

  // 2) RECÊNCIA
  let scoreRecencia = 0;
  if (diasCriacao <= config.recencia_quente_max) {
    scoreRecencia = 100;
    fatores.push(`Lead recente (${diasCriacao}d)`);
  } else if (diasCriacao <= config.recencia_morna_max) {
    scoreRecencia = 60;
    fatores.push(`Lead de ${diasCriacao} dias`);
  } else if (diasCriacao <= 14) {
    scoreRecencia = 30;
  } else {
    scoreRecencia = Math.max(0, 20 - diasCriacao);
    if (diasCriacao > 14) fatores.push(`Lead antigo (${diasCriacao}d)`);
  }

  // 3) ENGAJAMENTO
  let scoreEngajamento = 50;
  if (lead.visto_admin && !lead.ultimo_contato) {
    scoreEngajamento -= 20;
    fatores.push("Visualizado sem contato");
  }
  if (diasSemContato > 5) {
    scoreEngajamento -= 30;
    fatores.push(`${diasSemContato}d sem contato`);
  } else if (lead.ultimo_contato) {
    scoreEngajamento += 30;
    fatores.push("Contato recente");
  }
  if (statusNome && ["Proposta Enviada", "Negociação", "Visita Agendada"].some(s => statusNome.includes(s))) {
    scoreEngajamento += 20;
    fatores.push(`Status: ${statusNome}`);
  }
  scoreEngajamento = Math.max(0, Math.min(100, scoreEngajamento));

  // 4) PERFIL TÉCNICO
  let scorePerfilTecnico = 50;
  const telhadosFavoraveis = ["Cerâmico", "Fibrocimento", "Laje"];
  if (telhadosFavoraveis.some(t => lead.tipo_telhado?.includes(t))) {
    scorePerfilTecnico += 25;
    fatores.push(`Telhado favorável: ${lead.tipo_telhado}`);
  } else if (lead.tipo_telhado?.includes("Metálico")) {
    scorePerfilTecnico += 15;
  }
  if (lead.rede_atendimento?.includes("Trifásic")) {
    scorePerfilTecnico += 25;
    fatores.push("Rede trifásica");
  } else if (lead.rede_atendimento?.includes("Bifásic")) {
    scorePerfilTecnico += 15;
  }
  scorePerfilTecnico = Math.min(100, scorePerfilTecnico);

  // 5) LOCALIZAÇÃO
  let scoreLocalizacao = 50;
  if (lead.area?.includes("Urbana")) {
    scoreLocalizacao = 80;
    fatores.push("Área urbana");
  } else if (lead.area?.includes("Rural")) {
    scoreLocalizacao = 40;
  }

  // 6) TEMPO DE RESPOSTA
  let scoreTempoResposta = 50;
  if (lead.visto && diasCriacao <= 1) {
    scoreTempoResposta = 100;
    fatores.push("Resposta rápida do consultor");
  } else if (!lead.visto && diasCriacao > 2) {
    scoreTempoResposta = 10;
    fatores.push("⚠ Ainda não visualizado");
  }

  // Score final ponderado
  const somaTotal = config.peso_consumo + config.peso_recencia + config.peso_engajamento
    + config.peso_perfil_tecnico + config.peso_localizacao + config.peso_tempo_resposta;

  const scoreFinal = Math.round(
    (scoreConsumo * config.peso_consumo +
     scoreRecencia * config.peso_recencia +
     scoreEngajamento * config.peso_engajamento +
     scorePerfilTecnico * config.peso_perfil_tecnico +
     scoreLocalizacao * config.peso_localizacao +
     scoreTempoResposta * config.peso_tempo_resposta) / somaTotal
  );

  let nivel: "hot" | "warm" | "cold";
  let probabilidade: number;
  if (scoreFinal >= config.threshold_hot) {
    nivel = "hot";
    probabilidade = config.probabilidade_hot;
  } else if (scoreFinal >= config.threshold_warm) {
    nivel = "warm";
    probabilidade = config.probabilidade_warm;
  } else {
    nivel = "cold";
    probabilidade = config.probabilidade_cold;
  }

  if (nivel === "hot") {
    probabilidade += (scoreFinal - config.threshold_hot) * 0.005;
  } else if (nivel === "warm") {
    const range = config.threshold_hot - config.threshold_warm;
    const position = (scoreFinal - config.threshold_warm) / range;
    probabilidade += position * 0.1;
  }
  probabilidade = Math.min(0.95, Math.max(0.05, probabilidade));

  const valorEstimado = config.ticket_medio * probabilidade;

  let recomendacao: string;
  if (nivel === "hot") {
    recomendacao = "🔥 Prioridade máxima! Entrar em contato imediatamente.";
  } else if (nivel === "warm") {
    recomendacao = diasSemContato > 3
      ? "📞 Retomar contato — lead esfriando."
      : "📋 Enviar proposta personalizada e agendar visita.";
  } else {
    recomendacao = lead.media_consumo < config.consumo_medio_min
      ? "📧 Nutrir com conteúdo educativo sobre economia solar."
      : "⏰ Agendar follow-up para próxima semana.";
  }

  return {
    lead_id: lead.id,
    tenant_id: lead.tenant_id,
    score: scoreFinal,
    nivel,
    probabilidade_fechamento: Math.round(probabilidade * 100) / 100,
    fatores: JSON.stringify(fatores),
    recomendacao,
    score_consumo: scoreConsumo,
    score_recencia: scoreRecencia,
    score_engajamento: scoreEngajamento,
    score_perfil_tecnico: scorePerfilTecnico,
    score_localizacao: scoreLocalizacao,
    score_tempo_resposta: scoreTempoResposta,
    valor_estimado: Math.round(valorEstimado),
    calculado_em: new Date().toISOString(),
  };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 1. Fetch all active tenants' scoring configs
    const { data: configs, error: cfgErr } = await adminClient
      .from("lead_scoring_config")
      .select("*");

    if (cfgErr || !configs?.length) {
      console.log("[lead-scoring-cron] No scoring configs found, skipping.");
      return new Response(
        JSON.stringify({ ok: true, scored: 0, message: "No configs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch all active lead statuses for name mapping
    const { data: statuses } = await adminClient
      .from("lead_statuses")
      .select("id, nome");
    const statusMap = new Map((statuses || []).map((s: { id: string; nome: string }) => [s.id, s.nome]));

    let totalScored = 0;

    for (const config of configs) {
      const tenantId = config.tenant_id;

      // 3. Check tenant is active
      const { data: tenant } = await adminClient
        .from("tenants")
        .select("status, deleted_at")
        .eq("id", tenantId)
        .single();

      if (!tenant || tenant.status !== "active" || tenant.deleted_at) {
        console.log(`[lead-scoring-cron] Tenant ${tenantId} inactive, skipping.`);
        continue;
      }

      // 4. Fetch leads for this tenant (non-deleted only)
      const { data: leads, error: leadsErr } = await adminClient
        .from("leads")
        .select("id, tenant_id, media_consumo, tipo_telhado, area, rede_atendimento, ultimo_contato, created_at, visto, visto_admin, status_id, deleted_at")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);

      if (leadsErr || !leads?.length) {
        console.log(`[lead-scoring-cron] No leads for tenant ${tenantId}.`);
        continue;
      }

      console.log(`[lead-scoring-cron] Scoring ${leads.length} leads for tenant ${tenantId}`);

      // 5. Score all leads
      const scores = leads.map((lead: LeadRow) => {
        const statusNome = lead.status_id ? statusMap.get(lead.status_id) : undefined;
        return calcularScore(lead, config as ScoringConfig, statusNome);
      });

      // 6. Upsert in chunks of 50
      const CHUNK = 50;
      for (let i = 0; i < scores.length; i += CHUNK) {
        const chunk = scores.slice(i, i + CHUNK);
        const { error: upsertErr } = await adminClient
          .from("lead_scores")
          .upsert(chunk, { onConflict: "lead_id" });

        if (upsertErr) {
          console.error(`[lead-scoring-cron] Upsert error for tenant ${tenantId}:`, upsertErr.message);
        }
      }

      totalScored += scores.length;
    }

    console.log(`[lead-scoring-cron] Done. Total scored: ${totalScored}`);

    return new Response(
      JSON.stringify({ ok: true, scored: totalScored }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[lead-scoring-cron] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
