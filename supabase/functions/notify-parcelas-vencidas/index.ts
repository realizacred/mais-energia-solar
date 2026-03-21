import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function phoneToJid(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (!clean.startsWith("55")) clean = `55${clean}`;
  return `${clean}@s.whatsapp.net`;
}

function getIsoWeek(d: Date): string {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Fetch overdue parcelas (1-31 days) with client info
    const { data: parcelas, error: pErr } = await sb
      .from("parcelas")
      .select(`
        id, valor, data_vencimento, numero_parcela, tenant_id,
        recebimentos!inner(
          id, cliente_id, descricao, tenant_id,
          clientes!inner(nome, telefone)
        )
      `)
      .eq("status", "pendente")
      .lt("data_vencimento", new Date().toISOString().slice(0, 10))
      .gt("data_vencimento", new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10));

    if (pErr) throw pErr;
    if (!parcelas?.length) {
      return new Response(JSON.stringify({ ok: true, notified: 0, reason: "no_overdue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get connected WA instances per tenant
    const tenantIds = [...new Set(parcelas.map((p: any) => p.tenant_id))];
    const { data: instances } = await sb
      .from("wa_instances")
      .select("id, tenant_id")
      .in("tenant_id", tenantIds)
      .eq("status", "connected");

    const instanceMap = new Map<string, string>();
    (instances || []).forEach((inst: any) => {
      if (!instanceMap.has(inst.tenant_id)) {
        instanceMap.set(inst.tenant_id, inst.id);
      }
    });

    const isoWeek = getIsoWeek(new Date());
    let notified = 0;
    let skipped = 0;

    for (const parcela of parcelas as any[]) {
      const rec = parcela.recebimentos;
      const cliente = rec?.clientes;
      if (!cliente?.telefone) { skipped++; continue; }

      const instanceId = instanceMap.get(parcela.tenant_id);
      if (!instanceId) { skipped++; continue; }

      const vencimento = new Date(parcela.data_vencimento);
      const diasVencidos = Math.floor((Date.now() - vencimento.getTime()) / 86400000);
      if (diasVencidos < 1) { skipped++; continue; }

      // Idempotency: one notification per parcela per week
      const idempKey = `parcela:${parcela.id}:semana:${isoWeek}`;

      const valor = Number(parcela.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

      let mensagem: string;
      if (diasVencidos <= 7) {
        mensagem = [
          `Olá ${cliente.nome}! 📋`,
          "",
          `Sua parcela ${parcela.numero_parcela} venceu há ${diasVencidos} dia(s).`,
          `Valor: ${valor}`,
          "",
          "Por favor, regularize o pagamento.",
          "",
          "Mais Energia Solar 🌞",
        ].join("\n");
      } else {
        mensagem = [
          `⚠️ ${cliente.nome}, atenção!`,
          "",
          `Sua parcela ${parcela.numero_parcela} está em atraso há ${diasVencidos} dias.`,
          `Valor: ${valor}`,
          "",
          "Entre em contato conosco para regularizar.",
          "",
          "Mais Energia Solar 🌞",
        ].join("\n");
      }

      const remoteJid = phoneToJid(cliente.telefone);

      try {
        // Use direct insert (same as notify-plant-offline pattern)
        // ON CONFLICT on idempotency_key prevents duplicates
        await sb.from("wa_outbox").insert({
          tenant_id: parcela.tenant_id,
          instance_id: instanceId,
          remote_jid: remoteJid,
          message_type: "text",
          content: mensagem,
          status: "pending",
          idempotency_key: idempKey,
        });
        notified++;
      } catch (insertErr: any) {
        // Duplicate idempotency_key = already notified this week
        if (insertErr?.code === "23505") {
          skipped++;
        } else {
          console.error(`[notify-parcelas] Insert error for parcela ${parcela.id}:`, insertErr);
          skipped++;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, notified, skipped, total: parcelas.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[notify-parcelas-vencidas] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
