/**
 * proposal-followup-send (Phase 2)
 *
 * Envia follow-up manual de proposta via WhatsApp com guardrails:
 *  - autenticação obrigatória (JWT)
 *  - tenant resolvido por auth.uid()
 *  - opt-out por cliente+canal
 *  - lock por proposta+canal (cooldown)
 *  - daily_cap por tenant+canal (regra de cadência ativa)
 *  - registro imutável em proposal_followup_attempts
 *  - enfileiramento via RPC enqueue_wa_outbox_item (RB WA Execution)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json(401, { error: "missing_authorization" });

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: auth } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE);

  // --- Auth ----------------------------------------------------------------
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) return json(401, { error: "unauthorized" });
  const userId = userData.user.id;

  const { data: profile, error: profErr } = await userClient
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profErr) return json(500, { error: "profile_lookup_failed" });
  if (!profile?.tenant_id) return json(403, { error: "tenant_missing" });
  const tenantId = profile.tenant_id;

  // --- Input ---------------------------------------------------------------
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  const proposta_id: string | undefined = body?.proposta_id;
  const versao_id: string | null = body?.versao_id ?? null;
  const message: string | undefined = body?.message;
  const channel: string = body?.channel ?? "whatsapp";
  const force: boolean = body?.force === true;

  if (!proposta_id || typeof proposta_id !== "string") return json(400, { error: "proposta_id_required" });
  if (!message || typeof message !== "string" || message.trim().length < 5)
    return json(400, { error: "message_too_short" });
  if (message.length > 2000) return json(400, { error: "message_too_long" });
  if (channel !== "whatsapp") return json(400, { error: "channel_unsupported" });

  // --- Carrega proposta e cliente ------------------------------------------
  const { data: row, error: rowErr } = await userClient
    .from("vw_proposal_followup_inbox")
    .select("proposta_id, cliente_id, telefone_normalized, qtd_followups, classe_followup")
    .eq("proposta_id", proposta_id)
    .maybeSingle();
  if (rowErr) return json(500, { error: "inbox_lookup_failed", detail: rowErr.message });
  if (!row) return json(404, { error: "proposta_not_found_or_no_access" });
  if (!row.cliente_id) return json(400, { error: "cliente_missing" });
  if (!row.telefone_normalized) return json(400, { error: "telefone_missing" });

  // --- Guardrail: opt-out --------------------------------------------------
  const { data: opt } = await admin
    .from("proposal_communication_optout")
    .select("cliente_id")
    .eq("tenant_id", tenantId)
    .eq("cliente_id", row.cliente_id)
    .eq("channel", channel)
    .maybeSingle();
  if (opt) return json(409, { error: "opted_out", reason: "Cliente optou por não receber este canal." });

  // --- Guardrail: lock (cooldown) ------------------------------------------
  const { data: lock } = await admin
    .from("proposal_followup_locks")
    .select("locked_until, reason")
    .eq("tenant_id", tenantId)
    .eq("proposta_id", proposta_id)
    .eq("channel", channel)
    .maybeSingle();
  const now = new Date();
  if (lock && new Date(lock.locked_until) > now && !force) {
    return json(409, {
      error: "cooldown_active",
      locked_until: lock.locked_until,
      reason: lock.reason ?? "Aguarde o cooldown deste follow-up.",
    });
  }

  // --- Cadence rule (daily_cap, cooldown padrão) ---------------------------
  const { data: rule } = await admin
    .from("proposal_followup_cadence_rules")
    .select("cooldown_hours, daily_cap, max_attempts")
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .eq("active", true)
    .order("trigger_after_days", { ascending: true })
    .limit(1)
    .maybeSingle();

  const cooldownHours = Number(rule?.cooldown_hours ?? 24);
  const dailyCap = Number(rule?.daily_cap ?? 50);
  const maxAttempts = Number(rule?.max_attempts ?? 5);

  // --- Guardrail: max_attempts por proposta --------------------------------
  if ((row.qtd_followups ?? 0) >= maxAttempts && !force) {
    return json(409, { error: "max_attempts_reached", max_attempts: maxAttempts });
  }

  // --- Guardrail: daily_cap (tenant+channel) -------------------------------
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count: sentToday } = await admin
    .from("proposal_followup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .in("delivery_status", ["sent", "queued"])
    .gte("created_at", startOfDay.toISOString());
  if ((sentToday ?? 0) >= dailyCap && !force) {
    return json(429, { error: "daily_cap_reached", daily_cap: dailyCap, sent_today: sentToday });
  }

  // --- Resolve consultor (opcional) ----------------------------------------
  const { data: consultor } = await admin
    .from("consultores")
    .select("id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // --- Resolve instância WA conectada --------------------------------------
  const { data: waInstance } = await admin
    .from("wa_instances")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();
  if (!waInstance) return json(400, { error: "no_wa_instance_connected" });

  // --- Registra attempt (queued) -------------------------------------------
  const attemptNumber = (row.qtd_followups ?? 0) + 1;
  const { data: attempt, error: attErr } = await admin
    .from("proposal_followup_attempts")
    .insert({
      tenant_id: tenantId,
      proposta_id,
      versao_id,
      channel,
      mode: "manual",
      message_text: message,
      attempt_number: attemptNumber,
      delivery_status: "queued",
      consultor_id: consultor?.id ?? null,
      approved_by: userId,
      ai_generated: false,
    })
    .select("id")
    .single();
  if (attErr || !attempt) return json(500, { error: "attempt_insert_failed", detail: attErr?.message });

  // --- Enfileira via WA outbox ---------------------------------------------
  const cleanPhone = String(row.telefone_normalized).replace(/\D/g, "");
  const remoteJid = `${cleanPhone}@s.whatsapp.net`;
  const idempKey = `proposal_followup:${proposta_id}:${attempt.id}`;

  const { error: enqErr } = await admin.rpc("enqueue_wa_outbox_item", {
    p_tenant_id: tenantId,
    p_instance_id: waInstance.id,
    p_remote_jid: remoteJid,
    p_message_type: "text",
    p_content: message,
    p_idempotency_key: idempKey,
  });

  if (enqErr) {
    await admin
      .from("proposal_followup_attempts")
      .update({
        delivery_status: "failed",
        delivery_error: enqErr.message?.slice(0, 500) ?? "enqueue_failed",
      })
      .eq("id", attempt.id);
    return json(502, { error: "enqueue_failed", detail: enqErr.message });
  }

  // --- Marca attempt enviado ------------------------------------------------
  await admin
    .from("proposal_followup_attempts")
    .update({ delivery_status: "sent", sent_at: new Date().toISOString() })
    .eq("id", attempt.id);

  // --- Atualiza lock (cooldown) --------------------------------------------
  const lockedUntil = new Date(Date.now() + cooldownHours * 3_600_000).toISOString();
  const messageHash = await hashMessage(message);
  await admin
    .from("proposal_followup_locks")
    .upsert({
      tenant_id: tenantId,
      proposta_id,
      channel,
      locked_until: lockedUntil,
      last_message_hash: messageHash,
      reason: `manual:${userId}`,
    }, { onConflict: "proposta_id,channel" });

  return json(200, {
    success: true,
    attempt_id: attempt.id,
    locked_until: lockedUntil,
    attempt_number: attemptNumber,
    sent_today: (sentToday ?? 0) + 1,
    daily_cap: dailyCap,
  });
});

async function hashMessage(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
