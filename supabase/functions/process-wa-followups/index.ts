import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();

    // 1. Fetch all active rules across all tenants
    const { data: rules, error: rulesError } = await supabase
      .from("wa_followup_rules")
      .select("*")
      .eq("ativo", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active rules", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalCreated = 0;
    let totalSent = 0;

    for (const rule of rules) {
      const statusFilter = rule.status_conversa || ["open"];
      const cutoffDate = new Date(
        Date.now() - rule.prazo_horas * 60 * 60 * 1000
      ).toISOString();

      // 2. Find conversations matching this rule's criteria
      let query = supabase
        .from("wa_conversations")
        .select("id, last_message_at, assigned_to, cliente_nome, cliente_telefone, remote_jid, instance_id, tenant_id")
        .eq("tenant_id", rule.tenant_id)
        .in("status", statusFilter)
        .lt("last_message_at", cutoffDate);

      const { data: conversations, error: convError } = await query;
      if (convError) {
        console.error(`Error fetching convs for rule ${rule.id}:`, convError);
        continue;
      }

      if (!conversations || conversations.length === 0) continue;

      for (const conv of conversations) {
        // 3. Check scenario-specific conditions
        if (rule.cenario === "equipe_sem_resposta") {
          // Last message must be from client (direction = 'in')
          const { data: lastMsg } = await supabase
            .from("wa_messages")
            .select("direction")
            .eq("conversation_id", conv.id)
            .eq("is_internal_note", false)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!lastMsg || lastMsg.direction !== "in") continue;
        } else if (rule.cenario === "cliente_sem_resposta") {
          // Last message must be from us (direction = 'out')
          const { data: lastMsg } = await supabase
            .from("wa_messages")
            .select("direction")
            .eq("conversation_id", conv.id)
            .eq("is_internal_note", false)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!lastMsg || lastMsg.direction !== "out") continue;
        }
        // 'conversa_parada' = any direction, just stale

        // 4. Check if follow-up already exists for this conversation+rule
        const { data: existing } = await supabase
          .from("wa_followup_queue")
          .select("id, tentativa, status")
          .eq("conversation_id", conv.id)
          .eq("rule_id", rule.id)
          .in("status", ["pendente", "enviado"])
          .maybeSingle();

        if (existing) continue; // Already queued

        // Check max attempts
        const { count: pastAttempts } = await supabase
          .from("wa_followup_queue")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("rule_id", rule.id);

        if ((pastAttempts || 0) >= rule.max_tentativas) continue;

        // 5. Create follow-up queue entry
        const scheduledAt = new Date().toISOString();
        const { error: insertError } = await supabase
          .from("wa_followup_queue")
          .insert({
            tenant_id: rule.tenant_id,
            rule_id: rule.id,
            conversation_id: conv.id,
            status: "pendente",
            tentativa: (pastAttempts || 0) + 1,
            scheduled_at: scheduledAt,
            assigned_to: conv.assigned_to,
          });

        if (insertError) {
          console.error(`Error creating followup:`, insertError);
          continue;
        }

        totalCreated++;

        // 6. Auto-send if configured
        if (rule.envio_automatico && rule.mensagem_template) {
          const message = rule.mensagem_template
            .replace(/\{nome\}/g, conv.cliente_nome || "")
            .replace(/\{vendedor\}/g, "");

          // Insert message
          const { data: msg } = await supabase
            .from("wa_messages")
            .insert({
              conversation_id: conv.id,
              direction: "out",
              message_type: "text",
              content: message,
              is_internal_note: false,
              status: "pending",
            })
            .select()
            .single();

          if (msg && conv.remote_jid && conv.instance_id) {
            await supabase.from("wa_outbox").insert({
              instance_id: conv.instance_id,
              conversation_id: conv.id,
              message_id: msg.id,
              remote_jid: conv.remote_jid,
              message_type: "text",
              content: message,
              status: "pending",
            });

            // Update queue entry
            await supabase
              .from("wa_followup_queue")
              .update({
                status: "enviado",
                sent_at: new Date().toISOString(),
                mensagem_enviada: message,
              })
              .eq("conversation_id", conv.id)
              .eq("rule_id", rule.id)
              .eq("status", "pendente");

            totalSent++;
          }
        }
      }
    }

    // 7. Trigger outbox processing if messages were sent
    if (totalSent > 0) {
      await supabase.functions.invoke("process-wa-outbox").catch(() => {});
    }

    // 8. Mark follow-ups as responded when conversation has new activity
    const { data: pendingFollowups } = await supabase
      .from("wa_followup_queue")
      .select("id, conversation_id, created_at")
      .in("status", ["pendente", "enviado"]);

    if (pendingFollowups) {
      for (const fu of pendingFollowups) {
        const { data: recentMsg } = await supabase
          .from("wa_messages")
          .select("id")
          .eq("conversation_id", fu.conversation_id)
          .eq("direction", "in")
          .gt("created_at", fu.created_at)
          .limit(1)
          .maybeSingle();

        if (recentMsg) {
          await supabase
            .from("wa_followup_queue")
            .update({ status: "respondido", responded_at: now })
            .eq("id", fu.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: totalCreated,
        sent: totalSent,
        rules_processed: rules.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("process-wa-followups error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
