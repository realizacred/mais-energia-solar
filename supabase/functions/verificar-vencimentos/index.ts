import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const in3days = new Date(today);
    in3days.setDate(in3days.getDate() + 3);
    const in3daysStr = in3days.toISOString().slice(0, 10);

    // Fetch recebimentos with data_vencimento set and status pendente/parcial
    const { data: recebimentos, error: recErr } = await sb
      .from("recebimentos")
      .select("id, valor_total, total_pago, descricao, data_vencimento, cliente_id, tenant_id")
      .in("status", ["pendente", "parcial"])
      .not("data_vencimento", "is", null);

    if (recErr) throw recErr;
    if (!recebimentos?.length) {
      return new Response(
        JSON.stringify({ ok: true, notified: 0, reason: "no_matching_recebimentos" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Batch: collect unique tenant_ids and cliente_ids
    const tenantIds = [...new Set(recebimentos.map((r: any) => r.tenant_id))];
    const clienteIds = [
      ...new Set(recebimentos.map((r: any) => r.cliente_id).filter(Boolean)),
    ];

    // Batch fetch WA instances per tenant
    const { data: instances } = await sb
      .from("wa_instances")
      .select("id, tenant_id, phone_number")
      .in("tenant_id", tenantIds)
      .eq("status", "connected");

    const instanceMap = new Map<string, { id: string; phone: string }>();
    (instances || []).forEach((inst: any) => {
      if (!instanceMap.has(inst.tenant_id)) {
        instanceMap.set(inst.tenant_id, { id: inst.id, phone: inst.phone_number });
      }
    });

    // Batch fetch tenant_premises for wa_notif_numero
    const { data: premisesList } = await sb
      .from("tenant_premises")
      .select("tenant_id, wa_notif_numero")
      .in("tenant_id", tenantIds);

    const premisesMap = new Map<string, string | null>();
    (premisesList || []).forEach((p: any) => {
      premisesMap.set(p.tenant_id, p.wa_notif_numero);
    });

    // Batch fetch client names
    const clienteMap = new Map<string, string>();
    if (clienteIds.length > 0) {
      const { data: clientes } = await sb
        .from("clientes")
        .select("id, nome")
        .in("id", clienteIds);
      (clientes || []).forEach((c: any) => clienteMap.set(c.id, c.nome));
    }

    const fmtBRL = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const fmtDate = (d: string) => {
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y}`;
    };

    let notified = 0;
    let skipped = 0;
    const outboxRows: any[] = [];

    for (const rec of recebimentos as any[]) {
      const venc = rec.data_vencimento;
      if (!venc) { skipped++; continue; }

      const inst = instanceMap.get(rec.tenant_id);
      if (!inst) { skipped++; continue; }

      // Determine target phone: premises config > instance phone
      const targetPhone = premisesMap.get(rec.tenant_id) || inst.phone;
      if (!targetPhone) { skipped++; continue; }

      const nomeCliente = rec.cliente_id
        ? (clienteMap.get(rec.cliente_id) || "Avulso")
        : "Avulso";

      const saldo = (rec.valor_total || 0) - (rec.total_pago || 0);

      let tipo: string | null = null;
      let mensagem: string | null = null;

      if (venc === in3daysStr) {
        tipo = "lembrete_3dias";
        mensagem = [
          "⏰ *Vencimento em 3 dias*",
          `Cliente: ${nomeCliente}`,
          `Valor total: ${fmtBRL(rec.valor_total || 0)}`,
          `Pago: ${fmtBRL(rec.total_pago || 0)}`,
          `Saldo: ${fmtBRL(Math.max(saldo, 0))}`,
          `Vence: ${fmtDate(venc)}`,
          `_${rec.descricao || "Sem descrição"}_`,
        ].join("\n");
      } else if (venc === todayStr) {
        tipo = "lembrete_hoje";
        mensagem = [
          "🔔 *Vencimento HOJE*",
          `Cliente: ${nomeCliente}`,
          `Saldo: ${fmtBRL(Math.max(saldo, 0))}`,
          `Vence: ${fmtDate(venc)}`,
          `_${rec.descricao || "Sem descrição"}_`,
        ].join("\n");
      } else if (venc < todayStr) {
        tipo = "atrasado";
        mensagem = [
          "🚨 *Recebimento Atrasado*",
          `Cliente: ${nomeCliente}`,
          `Venceu em: ${fmtDate(venc)}`,
          `Saldo: ${fmtBRL(Math.max(saldo, 0))}`,
          `_${rec.descricao || "Sem descrição"}_`,
        ].join("\n");
      }

      if (!tipo || !mensagem) { skipped++; continue; }

      const cleanPhone = targetPhone.replace(/\D/g, "");
      const remoteJid = cleanPhone.includes("@")
        ? cleanPhone
        : `${cleanPhone}@s.whatsapp.net`;

      const idempKey = `vencimento:${rec.id}:${tipo}:${todayStr}`;

      outboxRows.push({
        tenant_id: rec.tenant_id,
        instance_id: inst.id,
        remote_jid: remoteJid,
        message_type: "text",
        content: mensagem,
        status: "pending",
        idempotency_key: idempKey,
      });
    }

    // Batch insert — ON CONFLICT on idempotency_key prevents duplicates
    if (outboxRows.length > 0) {
      const { error: insertErr } = await sb
        .from("wa_outbox")
        .insert(outboxRows);

      if (insertErr) {
        // If some are duplicates (23505), that's expected
        if (insertErr.code !== "23505") {
          console.error("[verificar-vencimentos] Batch insert error:", insertErr.message);
        }
      }
      notified = outboxRows.length;
    }

    return new Response(
      JSON.stringify({ ok: true, notified, skipped, total: recebimentos.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[verificar-vencimentos] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
