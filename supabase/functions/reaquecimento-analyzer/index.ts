import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing env vars:", { hasUrl: !!supabaseUrl, hasKey: !!serviceKey });
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse body — cron calls may have empty body
    let tenantId: string | null = null;
    let isCron = false;
    try {
      const body = await req.json();
      tenantId = body.tenant_id || null;
    } catch {
      isCron = true;
    }

    // Fetch all tenants with reaquecimento enabled
    const { data: configs } = await supabase
      .from("intelligence_config")
      .select("*")
      .eq("reaquecimento_habilitado", true);

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum tenant com reaquecimento habilitado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados: Array<{ tenant_id: string; processados: number }> = [];

    for (const config of configs) {
      if (tenantId && config.tenant_id !== tenantId) continue;

      const diasInativo = config.reaquecimento_dias_inativo || 180;
      const dataCorte = new Date();
      dataCorte.setDate(dataCorte.getDate() - diasInativo);

      const { data: leadsInativos } = await supabase
        .from("leads")
        .select("*, propostas_nativas(id, valor_total, potencia_kwp, created_at)")
        .eq("tenant_id", config.tenant_id)
        .lt("updated_at", dataCorte.toISOString())
        .not("status", "in", '("convertido","desqualificado")')
        .limit(config.reaquecimento_batch_size || 50);

      if (!leadsInativos || leadsInativos.length === 0) {
        resultados.push({ tenant_id: config.tenant_id, processados: 0 });
        continue;
      }

      for (const lead of leadsInativos) {
        try {
          await processarLead(lead, config, supabase);
        } catch (err) {
          console.error(`[reaquecimento] Erro lead ${lead.id}:`, err);
        }
      }

      resultados.push({ tenant_id: config.tenant_id, processados: leadsInativos.length });
    }

    return new Response(
      JSON.stringify({ success: true, is_cron: isCron, resultados, tempo_total_ms: Date.now() - startTime }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[reaquecimento-analyzer] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processarLead(lead: any, config: any, supabase: any) {
  const propostaAntiga = lead.propostas_nativas?.[0];

  const mesesInativos = Math.max(
    1,
    Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
  );

  // Lookup tariff
  const { data: tarifaRow } = await supabase.rpc("get_tarifa_atual_concessionaria", {
    p_cidade: lead.cidade || null,
    p_estado: lead.estado || null,
  });
  const tarifaAtual = Array.isArray(tarifaRow) ? tarifaRow[0]?.valor ?? 0.8 : 0.8;

  const consumo = lead.media_consumo || 300;
  const economiaMensal = consumo * tarifaAtual * 0.9; // ~90% de economia
  const valorPerdido = economiaMensal * mesesInativos;

  const novoValorProjeto = propostaAntiga ? propostaAntiga.valor_total * 0.85 : null;
  const novaPotencia = propostaAntiga?.potencia_kwp || 0;

  // Build personalized message
  const template =
    config.reaquecimento_template_mensagem ||
    "Olá {{nome}}, desde nossa conversa você deixou de economizar {{valor_perdido}}. Posso rever seu projeto de {{potencia}}kWp?";

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const { resolveWaTemplate } = await import("../_shared/resolveWaTemplate.ts");
  const mensagem = resolveWaTemplate(template, {
    nome: lead.nome || "",
    valor_perdido: fmt(valorPerdido),
    potencia: String(novaPotencia),
    novo_valor: novoValorProjeto ? fmt(novoValorProjeto) : "R$ 0,00",
    data_primeiro_contato: new Date(lead.created_at).toLocaleDateString("pt-BR"),
  });

  // Insert opportunity
  const { data: oportunidade } = await supabase
    .from("reaquecimento_oportunidades")
    .insert({
      tenant_id: lead.tenant_id,
      lead_id: lead.id,
      meses_inativos: mesesInativos,
      valor_perdido_acumulado: valorPerdido,
      novo_valor_projeto: novoValorProjeto,
      economia_potencial_12m: economiaMensal * 12,
      mensagem_sugerida: mensagem,
      temperamento_detectado: "congelado",
      dor_principal: "preco",
      urgencia_score: Math.min(100, Math.round(valorPerdido / 100)),
      contexto_json: {
        tarifa_atual: tarifaAtual,
        economia_mensal: economiaMensal,
        potencia_kwp: novaPotencia,
      },
      status: "pendente",
    })
    .select("id")
    .single();

  if (!oportunidade) return;

  // Create alert for consultant
  await supabase.from("intelligence_alerts").insert({
    tenant_id: lead.tenant_id,
    lead_id: lead.id,
    tipo_alerta: "reaquecimento_oportunidade",
    severidade: valorPerdido > 5000 ? "alta" : "media",
    direcionado_para: "consultor",
    contexto_json: {
      oportunidade_id: oportunidade.id,
      valor_perdido: valorPerdido,
      novo_valor: novoValorProjeto,
      mensagem_sugerida: mensagem,
      meses_inativos: mesesInativos,
    },
    margem_disponivel: 18,
  });

  // Upsert intelligence profile
  await supabase.from("lead_intelligence_profiles").upsert(
    {
      tenant_id: lead.tenant_id,
      lead_id: lead.id,
      temperamento: "congelado",
      dor_principal: "preco",
      urgencia_score: Math.min(100, Math.round(valorPerdido / 100)),
      contexto_json: {
        reaquecimento_detectado: true,
        valor_perdido: valorPerdido,
        oportunidade_id: oportunidade.id,
      },
      analisado_por: "cron",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,lead_id" }
  );
}
