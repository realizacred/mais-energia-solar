import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { lead_id, tenant_id } = await req.json();
    if (!lead_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "lead_id and tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch lead data
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*, wa_conversations(id, last_message_at, message_count)")
      .eq("id", lead_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found", details: leadErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tenant config
    const { data: config } = await supabase
      .from("intelligence_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const thresholdQuente = config?.threshold_quente ?? 80;
    const thresholdMorno = config?.threshold_morno ?? 50;
    const thresholdFrio = config?.threshold_frio ?? 20;

    // Calculate urgency score based on available data
    let urgenciaScore = 50; // baseline

    // Factor: value of project
    if (lead.valor_projeto) {
      if (lead.valor_projeto > 80000) urgenciaScore += 15;
      else if (lead.valor_projeto > 40000) urgenciaScore += 10;
      else if (lead.valor_projeto > 20000) urgenciaScore += 5;
    }

    // Factor: conversation activity
    const conv = lead.wa_conversations?.[0];
    if (conv) {
      const daysSinceMessage = conv.last_message_at
        ? Math.floor((Date.now() - new Date(conv.last_message_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceMessage <= 1) urgenciaScore += 20;
      else if (daysSinceMessage <= 3) urgenciaScore += 10;
      else if (daysSinceMessage <= 7) urgenciaScore += 5;
      else if (daysSinceMessage > 30) urgenciaScore -= 15;

      if (conv.message_count > 10) urgenciaScore += 10;
      else if (conv.message_count > 5) urgenciaScore += 5;
    }

    // Factor: days since creation
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceCreation <= 3) urgenciaScore += 10;
    else if (daysSinceCreation > 90) urgenciaScore -= 10;

    // Clamp score
    urgenciaScore = Math.max(0, Math.min(100, urgenciaScore));

    // Determine temperamento
    let temperamento: string;
    if (urgenciaScore >= thresholdQuente) temperamento = "quente";
    else if (urgenciaScore >= thresholdMorno) temperamento = "morno";
    else if (urgenciaScore >= thresholdFrio) temperamento = "frio";
    else temperamento = "congelado";

    // Determine dor_principal (basic heuristic — real implementation would use AI)
    let dorPrincipal = "desconhecimento"; // default
    if (lead.observacoes) {
      const obs = lead.observacoes.toLowerCase();
      const precoWords = config?.alerta_preco_palavras ?? ["caro", "dinheiro", "pagar"];
      const tempoWords = config?.alerta_tempo_palavras ?? ["demora", "rápido", "urgente"];
      const concWords = config?.alerta_concorrencia_palavras ?? ["outro", "concorrente", "empresa"];

      if (precoWords.some((w: string) => obs.includes(w))) dorPrincipal = "preco";
      else if (tempoWords.some((w: string) => obs.includes(w))) dorPrincipal = "tempo";
      else if (concWords.some((w: string) => obs.includes(w))) dorPrincipal = "concorrencia";
    }

    const diasInativo = conv?.last_message_at
      ? Math.floor((Date.now() - new Date(conv.last_message_at).getTime()) / (1000 * 60 * 60 * 24))
      : daysSinceCreation;

    // Upsert intelligence profile
    const profilePayload = {
      tenant_id,
      lead_id,
      temperamento,
      dor_principal: dorPrincipal,
      urgencia_score: urgenciaScore,
      dias_inativo: diasInativo,
      mensagens_troca: conv?.message_count || 0,
      primeiro_contato: lead.created_at,
      ultimo_contato: conv?.last_message_at || lead.updated_at,
      analisado_por: "sistema" as const,
      updated_at: new Date().toISOString(),
    };

    // Check existing
    const { data: existing } = await supabase
      .from("lead_intelligence_profiles")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("lead_id", lead_id)
      .maybeSingle();

    let profileId: string;
    if (existing) {
      const { error: upErr } = await supabase
        .from("lead_intelligence_profiles")
        .update(profilePayload)
        .eq("id", existing.id);
      if (upErr) throw upErr;
      profileId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("lead_intelligence_profiles")
        .insert(profilePayload)
        .select("id")
        .single();
      if (insErr) throw insErr;
      profileId = inserted.id;
    }

    // Create alert if applicable
    let alertCreated = false;
    if (config?.alertas_habilitados !== false && urgenciaScore >= thresholdMorno) {
      const tipoAlerta = dorPrincipal === "preco" ? "preco_detectado" :
        dorPrincipal === "tempo" ? "tempo_urgente" :
        dorPrincipal === "concorrencia" ? "concorrencia" : "reaquecimento_oportunidade";

      const severidade = urgenciaScore >= thresholdQuente ? "alta" :
        urgenciaScore >= thresholdMorno ? "media" : "baixa";

      const { error: alertErr } = await supabase
        .from("intelligence_alerts")
        .insert({
          tenant_id,
          lead_intelligence_id: profileId,
          lead_id,
          tipo_alerta: tipoAlerta,
          severidade,
          direcionado_para: "consultor",
          contexto_json: {
            urgencia_score: urgenciaScore,
            temperamento,
            dor_principal: dorPrincipal,
            valor_projeto: lead.valor_projeto,
          },
        });

      if (!alertErr) alertCreated = true;
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile_id: profileId,
        temperamento,
        urgencia_score: urgenciaScore,
        dor_principal: dorPrincipal,
        alert_created: alertCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[analyze-lead-intelligence] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
