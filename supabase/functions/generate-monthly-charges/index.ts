import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const brNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mes = brNow.getMonth() + 1;
    const ano = brNow.getFullYear();
    const mesLabel = brNow.toLocaleString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });

    // Fetch UCs with active billing
    const { data: ucs, error: ucErr } = await supabase
      .from("units_consumidoras")
      .select("id, tenant_id, cliente_id, nome, plano_servico_id, valor_mensalidade, dia_vencimento, servico_cobranca_ativo")
      .eq("servico_cobranca_ativo", true)
      .eq("is_archived", false)
      .gt("valor_mensalidade", 0);

    if (ucErr) throw ucErr;

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const uc of ucs || []) {
      try {
        // Dedup: check if charge already exists for this UC + month
        const { data: existing } = await supabase
          .from("recebimentos")
          .select("id")
          .eq("unit_id", uc.id)
          .gte("data_acordo", `${ano}-${String(mes).padStart(2, "0")}-01`)
          .lt("data_acordo", mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        const diaVenc = Math.min(uc.dia_vencimento || 10, 28);
        const dueDate = `${ano}-${String(mes).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;

        // Create recebimento
        const { data: rec, error: recErr } = await supabase
          .from("recebimentos")
          .insert({
            tenant_id: uc.tenant_id,
            cliente_id: uc.cliente_id,
            unit_id: uc.id,
            valor_total: uc.valor_mensalidade,
            numero_parcelas: 1,
            forma_pagamento_acordada: "boleto",
            data_acordo: now.toISOString(),
            status: "pendente",
            descricao: `Mensalidade ${uc.nome} — ${mesLabel}/${ano}`,
          })
          .select("id")
          .single();

        if (recErr) throw recErr;

        // Create parcela
        const { error: parErr } = await supabase
          .from("parcelas")
          .insert({
            recebimento_id: rec.id,
            tenant_id: uc.tenant_id,
            numero_parcela: 1,
            valor: uc.valor_mensalidade,
            data_vencimento: dueDate,
            status: "pendente",
          });

        if (parErr) throw parErr;
        created++;
      } catch (e: any) {
        errors.push(`UC ${uc.id}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created,
        skipped,
        errors: errors.length,
        errorDetails: errors.slice(0, 10),
        total_ucs: (ucs || []).length,
        mes: `${mesLabel}/${ano}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
