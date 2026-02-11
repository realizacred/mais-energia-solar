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

    // ── Step 0: Reconcile pending follow-ups FIRST ──
    const reconciled = await reconcilePendingFollowups(supabase, now);

    // ── Step 1: Fetch all active rules ──
    const { data: rules, error: rulesError } = await supabase
      .from("wa_followup_rules")
      .select("*")
      .eq("ativo", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active rules", processed: 0, reconciled }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalCreated = 0;
    let totalSent = 0;

    for (const rule of rules) {
      const result = await processRule(supabase, rule);
      totalCreated += result.created;
      totalSent += result.sent;
    }

    // ── Trigger outbox if messages were sent ──
    if (totalSent > 0) {
      await supabase.functions.invoke("process-wa-outbox").catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: totalCreated,
        sent: totalSent,
        reconciled,
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

// ─────────────────────────────────────────────────────
// Process a single rule
// ─────────────────────────────────────────────────────
async function processRule(
  supabase: any,
  rule: any
): Promise<{ created: number; sent: number }> {
  const statusFilter = rule.status_conversa || ["open"];
  const cutoffDate = new Date(
    Date.now() - rule.prazo_minutos * 60 * 1000
  ).toISOString();

  // ── Find matching conversations ──
  const { data: conversations, error: convError } = await supabase
    .from("wa_conversations")
    .select("id, last_message_at, assigned_to, cliente_nome, cliente_telefone, remote_jid, instance_id, tenant_id")
    .eq("tenant_id", rule.tenant_id)
    .in("status", statusFilter)
    .lt("last_message_at", cutoffDate);

  if (convError) {
    console.error(`Error fetching convs for rule ${rule.id}:`, convError);
    return { created: 0, sent: 0 };
  }
  if (!conversations || conversations.length === 0) return { created: 0, sent: 0 };

  const convIds = conversations.map((c: any) => c.id);

  // ── Get last message direction (for scenario filtering) ──
  const lastMsgMap = new Map<string, string>();
  if (rule.cenario !== "conversa_parada") {
    const directionPromises = convIds.map(async (convId: string) => {
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

  // ── Get existing follow-ups for dedup ──
  const { data: existingFollowups } = await supabase
    .from("wa_followup_queue")
    .select("conversation_id, tentativa, status")
    .eq("rule_id", rule.id)
    .in("conversation_id", convIds);

  const activeFollowupSet = new Set<string>();
  const attemptCountMap = new Map<string, number>();
  if (existingFollowups) {
    for (const fu of existingFollowups) {
      if (fu.status === "pendente" || fu.status === "enviado") {
        activeFollowupSet.add(fu.conversation_id);
      }
      attemptCountMap.set(
        fu.conversation_id,
        (attemptCountMap.get(fu.conversation_id) || 0) + 1
      );
    }
  }

  // ── Resolve assigned_to from instance when conv has none ──
  const instanceIds = [...new Set(conversations.map((c: any) => c.instance_id).filter(Boolean))];
  const instanceOwnerMap = new Map<string, string>();
  if (instanceIds.length > 0) {
    const { data: instances } = await supabase
      .from("wa_instances")
      .select("id, owner_user_id")
      .in("id", instanceIds);

    // Also fetch junction table links
    const { data: instanceVendedores } = await supabase
      .from("wa_instance_vendedores")
      .select("instance_id, vendedor_id, vendedores:vendedor_id(user_id)")
      .in("instance_id", instanceIds);

    if (instances) {
      for (const inst of instances) {
        // Priority: owner_user_id > first linked vendedor's user_id
        let userId = inst.owner_user_id || null;
        if (!userId && instanceVendedores) {
          const link = instanceVendedores.find((iv: any) => iv.instance_id === inst.id);
          userId = (link?.vendedores as any)?.user_id || null;
        }
        if (userId) instanceOwnerMap.set(inst.id, userId);
      }
    }
  }

  // ── Build insert list ──
  const toInsert: any[] = [];
  const autoSendList: { conv: any; attempt: number }[] = [];

  for (const conv of conversations) {
    // Scenario-specific direction check
    if (rule.cenario === "equipe_sem_resposta") {
      const lastDir = lastMsgMap.get(conv.id);
      if (!lastDir || lastDir !== "in") continue;
    } else if (rule.cenario === "cliente_sem_resposta") {
      const lastDir = lastMsgMap.get(conv.id);
      if (!lastDir || lastDir !== "out") continue;
    }

    if (activeFollowupSet.has(conv.id)) continue;

    const pastAttempts = attemptCountMap.get(conv.id) || 0;
    if (pastAttempts >= rule.max_tentativas) continue;

    // Resolve the responsible user
    const resolvedAssignedTo =
      conv.assigned_to || instanceOwnerMap.get(conv.instance_id) || null;

    const attempt = pastAttempts + 1;
    toInsert.push({
      tenant_id: rule.tenant_id,
      rule_id: rule.id,
      conversation_id: conv.id,
      status: "pendente",
      tentativa: attempt,
      scheduled_at: new Date().toISOString(),
      assigned_to: resolvedAssignedTo,
    });

    if (rule.envio_automatico && rule.mensagem_template) {
      autoSendList.push({ conv, attempt });
    }
  }

  // ── Batch insert ──
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("wa_followup_queue")
      .insert(toInsert);

    if (insertError) {
      console.error(`Error inserting followups for rule ${rule.id}:`, insertError);
      return { created: 0, sent: 0 };
    }
  }

  // ── Auto-send messages ──
  let sent = 0;
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
        tenant_id: rule.tenant_id,
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
        tenant_id: rule.tenant_id,
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

      sent++;
    }
  }

  return { created: toInsert.length, sent };
}

// ─────────────────────────────────────────────────────
// Reconcile: mark follow-ups as "respondido" when
// the conversation has new activity AFTER the follow-up
// ─────────────────────────────────────────────────────
async function reconcilePendingFollowups(
  supabase: any,
  now: string
): Promise<number> {
  // Get all pending/sent follow-ups WITH rule cenario
  const { data: pendingFollowups } = await supabase
    .from("wa_followup_queue")
    .select("id, conversation_id, created_at, rule_id, rule:wa_followup_rules(cenario)")
    .in("status", ["pendente", "enviado"]);

  if (!pendingFollowups || pendingFollowups.length === 0) return 0;

  const pendingConvIds = [...new Set(pendingFollowups.map((fu: any) => fu.conversation_id))];

  // Get recent messages (both directions) for all pending conversations
  const { data: recentMessages } = await supabase
    .from("wa_messages")
    .select("conversation_id, created_at, direction")
    .in("conversation_id", pendingConvIds)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: false });

  if (!recentMessages) return 0;

  // Build maps: conversation_id -> latest message date per direction
  const latestIncoming = new Map<string, string>();
  const latestOutgoing = new Map<string, string>();
  for (const msg of recentMessages) {
    if (msg.direction === "in" && !latestIncoming.has(msg.conversation_id)) {
      latestIncoming.set(msg.conversation_id, msg.created_at);
    }
    if (msg.direction === "out" && !latestOutgoing.has(msg.conversation_id)) {
      latestOutgoing.set(msg.conversation_id, msg.created_at);
    }
  }

  const toMarkResponded: string[] = [];
  for (const fu of pendingFollowups) {
    const cenario = (fu.rule as any)?.cenario;

    // For "equipe_sem_resposta": resolved when team sends a message
    if (cenario === "equipe_sem_resposta") {
      const latestOut = latestOutgoing.get(fu.conversation_id);
      if (latestOut && latestOut > fu.created_at) {
        toMarkResponded.push(fu.id);
        continue;
      }
    }

    // For all scenarios: resolved when client responds
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

  return toMarkResponded.length;
}
