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
        Date.now() - rule.prazo_minutos * 60 * 1000
      ).toISOString();

      // 2. Find conversations matching this rule's criteria
      const { data: conversations, error: convError } = await supabase
        .from("wa_conversations")
        .select("id, last_message_at, assigned_to, cliente_nome, cliente_telefone, remote_jid, instance_id, tenant_id")
        .eq("tenant_id", rule.tenant_id)
        .in("status", statusFilter)
        .lt("last_message_at", cutoffDate);

      if (convError) {
        console.error(`Error fetching convs for rule ${rule.id}:`, convError);
        continue;
      }

      if (!conversations || conversations.length === 0) continue;

      const convIds = conversations.map(c => c.id);

      // 3. Get last message direction per conversation (individually — reliable, single-row each)
      const lastMsgMap = new Map<string, string>();
      if (rule.cenario !== "conversa_parada") {
        // Only need direction check for specific scenarios
        const directionPromises = convIds.map(async (convId) => {
          const { data: lastMsg } = await supabase
            .from("wa_messages")
            .select("direction")
            .eq("conversation_id", convId)
            .eq("is_internal_note", false)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastMsg) lastMsgMap.set(convId, lastMsg.direction);
        });
        await Promise.all(directionPromises);
      }

      // 4. BATCH: Get existing follow-ups for all conversations + this rule
      const { data: existingFollowups } = await supabase
        .from("wa_followup_queue")
        .select("conversation_id, tentativa, status")
        .eq("rule_id", rule.id)
        .in("conversation_id", convIds);

      // Build maps for existing active follow-ups and attempt counts
      const activeFollowupSet = new Set<string>();
      const attemptCountMap = new Map<string, number>();
      if (existingFollowups) {
        for (const fu of existingFollowups) {
          if (fu.status === "pendente" || fu.status === "enviado") {
            activeFollowupSet.add(fu.conversation_id);
          }
          attemptCountMap.set(fu.conversation_id, (attemptCountMap.get(fu.conversation_id) || 0) + 1);
        }
      }

      // 5. Process each conversation
      const toInsert: any[] = [];
      const autoSendList: { conv: typeof conversations[0]; attempt: number }[] = [];

      for (const conv of conversations) {
        // Check scenario-specific conditions
        if (rule.cenario === "equipe_sem_resposta") {
          const lastDir = lastMsgMap.get(conv.id);
          if (!lastDir || lastDir !== "in") continue;
        } else if (rule.cenario === "cliente_sem_resposta") {
          const lastDir = lastMsgMap.get(conv.id);
          if (!lastDir || lastDir !== "out") continue;
        }

        // Skip if already queued
        if (activeFollowupSet.has(conv.id)) continue;

        // Check max attempts
        const pastAttempts = attemptCountMap.get(conv.id) || 0;
        if (pastAttempts >= rule.max_tentativas) continue;

        const attempt = pastAttempts + 1;
        toInsert.push({
          tenant_id: rule.tenant_id,
          rule_id: rule.id,
          conversation_id: conv.id,
          status: "pendente",
          tentativa: attempt,
          scheduled_at: new Date().toISOString(),
          assigned_to: conv.assigned_to,
        });

        if (rule.envio_automatico && rule.mensagem_template) {
          autoSendList.push({ conv, attempt });
        }
      }

      // 6. Batch insert follow-up queue entries
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("wa_followup_queue")
          .insert(toInsert);

        if (insertError) {
          console.error(`Error batch inserting followups for rule ${rule.id}:`, insertError);
          continue;
        }
        totalCreated += toInsert.length;
      }

      // 7. Auto-send messages if configured
      for (const { conv } of autoSendList) {
        const message = rule.mensagem_template!
          .replace(/\{nome\}/g, conv.cliente_nome || "")
          .replace(/\{vendedor\}/g, "");

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

    // 8. Trigger outbox processing if messages were sent
    if (totalSent > 0) {
      await supabase.functions.invoke("process-wa-outbox").catch(() => {});
    }

    // 9. Mark follow-ups as responded when conversation has new activity
    const { data: pendingFollowups } = await supabase
      .from("wa_followup_queue")
      .select("id, conversation_id, created_at")
      .in("status", ["pendente", "enviado"]);

    if (pendingFollowups && pendingFollowups.length > 0) {
      const pendingConvIds = [...new Set(pendingFollowups.map(fu => fu.conversation_id))];
      
      // Batch: get recent incoming messages for all pending conversations
      const { data: recentMessages } = await supabase
        .from("wa_messages")
        .select("conversation_id, created_at")
        .in("conversation_id", pendingConvIds)
        .eq("direction", "in")
        .order("created_at", { ascending: false });

      // Build map: conversation_id -> latest incoming message date
      const latestIncoming = new Map<string, string>();
      if (recentMessages) {
        for (const msg of recentMessages) {
          if (!latestIncoming.has(msg.conversation_id)) {
            latestIncoming.set(msg.conversation_id, msg.created_at);
          }
        }
      }

      const toMarkResponded: string[] = [];
      for (const fu of pendingFollowups) {
        const latestIn = latestIncoming.get(fu.conversation_id);
        if (latestIn && latestIn > fu.created_at) {
          toMarkResponded.push(fu.id);
        }
      }

      if (toMarkResponded.length > 0) {
        await supabase
          .from("wa_followup_queue")
          .update({ status: "respondido", responded_at: now })
          .in("id", toMarkResponded);
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
