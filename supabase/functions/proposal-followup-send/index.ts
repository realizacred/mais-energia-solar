/**
 * proposal-followup-send (Phase 2 — hardened)
 *
 * Envia follow-up manual de proposta via WhatsApp com guardrails:
 *  - autenticação obrigatória (JWT) + RBAC (admin/gerente/consultor)
 *  - tenant resolvido por auth.uid() (isolation)
 *  - opt-out por cliente+canal (LGPD — NUNCA overridável)
 *  - lock por proposta+canal (cooldown — overridável com motivo)
 *  - max_attempts (override apenas admin/gerente, com motivo)
 *  - daily_cap por tenant+canal (override apenas admin, com motivo)
 *  - resolução de instância WA: consultor → owner → tenant default
 *  - status 'queued' permanece até confirmação do worker (não força 'sent')
 *  - registro imutável + metadata de auditoria de force
 *  - guarda de concorrência via UNIQUE(tenant,proposta,channel,attempt_number)
 *  - enfileiramento via RPC enqueue_wa_outbox_item (RB WA Execution)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  if (!auth.startsWith("Bearer ")) return json(401, { error: "missing_authorization" });

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: auth } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE);

  // --- Auth ---------------------------------------------------------------
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

  // --- RBAC ---------------------------------------------------------------
  const { data: rolesRows } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = new Set((rolesRows ?? []).map((r: any) => String(r.role)));
  const isAdmin = roles.has("admin") || roles.has("super_admin");
  const isManager = isAdmin || roles.has("gerente");
  const canSend = isManager || roles.has("consultor");
  if (!canSend) return json(403, { error: "forbidden_role" });

  // --- Input --------------------------------------------------------------
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  const proposta_id: string | undefined = body?.proposta_id;
  const versao_id: string | null = body?.versao_id ?? null;
  const message: string | undefined = body?.message;
  const channel: string = body?.channel ?? "whatsapp";
  const force: boolean = body?.force === true;
  const force_reason: string = String(body?.force_reason ?? "").trim();

  if (!proposta_id || typeof proposta_id !== "string") return json(400, { error: "proposta_id_required" });
  if (!message || typeof message !== "string" || message.trim().length < 5)
    return json(400, { error: "message_too_short" });
  if (message.length > 2000) return json(400, { error: "message_too_long" });
  if (channel !== "whatsapp") return json(400, { error: "channel_unsupported" });
  if (force && force_reason.length < 5)
    return json(400, { error: "force_reason_required", reason: "Justificativa (mín. 5 caracteres) é obrigatória para envio forçado." });

  // --- Carrega proposta + cliente (RLS valida acesso/tenant) ---------------
  const { data: row, error: rowErr } = await userClient
    .from("vw_proposal_followup_inbox")
    .select("proposta_id, tenant_id, cliente_id, telefone_normalized, qtd_followups, classe_followup, consultor_id")
    .eq("proposta_id", proposta_id)
    .maybeSingle();
  if (rowErr) return json(500, { error: "inbox_lookup_failed", detail: rowErr.message });
  if (!row) return json(404, { error: "proposta_not_found_or_no_access" });
  if (row.tenant_id && row.tenant_id !== tenantId) return json(403, { error: "tenant_mismatch" });
  if (!row.cliente_id) return json(400, { error: "cliente_missing" });
  if (!row.telefone_normalized) return json(400, { error: "telefone_missing" });

  const bypassed: string[] = [];

  // --- Guardrail: opt-out (NUNCA overridável — LGPD) ----------------------
  const { data: opt } = await admin
    .from("proposal_communication_optout")
    .select("cliente_id")
    .eq("tenant_id", tenantId)
    .eq("cliente_id", row.cliente_id)
    .eq("channel", channel)
    .maybeSingle();
  if (opt) return json(409, { error: "opted_out", reason: "Cliente optou por não receber este canal (LGPD). Não pode ser forçado." });

  // --- Carrega regra de cadência ------------------------------------------
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

  // --- Guardrail: cooldown (override permitido a qualquer role com motivo)
  const { data: lock } = await admin
    .from("proposal_followup_locks")
    .select("locked_until, reason")
    .eq("tenant_id", tenantId)
    .eq("proposta_id", proposta_id)
    .eq("channel", channel)
    .maybeSingle();
  const now = new Date();
  if (lock && new Date(lock.locked_until) > now) {
    if (!force) {
      return json(409, {
        error: "cooldown_active",
        locked_until: lock.locked_until,
        reason: lock.reason ?? "Aguarde o cooldown deste follow-up.",
      });
    }
    bypassed.push("cooldown");
  }

  // --- Guardrail: max_attempts (override apenas admin/gerente) ------------
  if ((row.qtd_followups ?? 0) >= maxAttempts) {
    if (!force) return json(409, { error: "max_attempts_reached", max_attempts: maxAttempts });
    if (!isManager) return json(403, { error: "force_max_attempts_requires_manager", max_attempts: maxAttempts });
    bypassed.push("max_attempts");
  }

  // --- Guardrail: daily_cap (override apenas admin) -----------------------
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count: sentToday } = await admin
    .from("proposal_followup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .in("delivery_status", ["sent", "queued"])
    .gte("created_at", startOfDay.toISOString());
  if ((sentToday ?? 0) >= dailyCap) {
    if (!force) return json(429, { error: "daily_cap_reached", daily_cap: dailyCap, sent_today: sentToday });
    if (!isAdmin) return json(403, { error: "force_daily_cap_requires_admin", daily_cap: dailyCap });
    bypassed.push("daily_cap");
  }

  // --- Resolve consultor (opcional) ---------------------------------------
  const { data: consultor } = await admin
    .from("consultores")
    .select("id, user_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // --- Resolve instância WA conectada (consultor → owner → tenant) --------
  const { data: instances } = await admin
    .from("wa_instances")
    .select("id, consultor_id, owner_user_id, last_seen_at")
    .eq("tenant_id", tenantId)
    .eq("status", "connected");
  const list = instances ?? [];
  if (list.length === 0) return json(400, { error: "no_wa_instance_connected" });

  const targetConsultor = row.consultor_id ?? consultor?.id ?? null;
  const pickByConsultor = targetConsultor ? list.find((i: any) => i.consultor_id === targetConsultor) : null;
  const pickByOwner = list.find((i: any) => i.owner_user_id === userId);
  const pickDeterministic = [...list].sort((a: any, b: any) => {
    const ta = a.last_seen_at ? Date.parse(a.last_seen_at) : 0;
    const tb = b.last_seen_at ? Date.parse(b.last_seen_at) : 0;
    return tb - ta;
  })[0];
  const waInstance = pickByConsultor ?? pickByOwner ?? pickDeterministic;

  // --- Última tentativa (auditoria de override) ---------------------------
  const { data: prev } = await admin
    .from("proposal_followup_attempts")
    .select("id, attempt_number, sent_at, delivery_status")
    .eq("tenant_id", tenantId)
    .eq("proposta_id", proposta_id)
    .eq("channel", channel)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const attemptNumber = (row.qtd_followups ?? 0) + 1;
  const auditMetadata = force
    ? {
        force: true,
        force_reason,
        bypassed_guardrails: bypassed,
        forced_by_user_id: userId,
        forced_at: new Date().toISOString(),
        previous_attempt_id: prev?.id ?? null,
        previous_attempt_number: prev?.attempt_number ?? null,
      }
    : { force: false };

  // --- Insere attempt (queued) — UNIQUE bloqueia duplo-clique -------------
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
      metadata: auditMetadata,
    })
    .select("id")
    .single();
  if (attErr || !attempt) {
    if ((attErr as any)?.code === "23505") {
      return json(409, { error: "duplicate_attempt", reason: "Outro envio para esta proposta já está em andamento." });
    }
    return json(500, { error: "attempt_insert_failed", detail: attErr?.message });
  }

  // --- Enfileira via WA outbox -------------------------------------------
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

  // --- IMPORTANTE: NÃO marcar 'sent' aqui.
  // delivery_status permanece 'queued'. O worker WA atualiza para 'sent' / 'failed'
  // quando o Evolution API confirma. Isso garante consistência operacional.

  // --- Atualiza lock (cooldown) ------------------------------------------
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
      reason: force ? `manual:${userId}:forced(${bypassed.join(",")})` : `manual:${userId}`,
    }, { onConflict: "proposta_id,channel" });

  return json(200, {
    success: true,
    attempt_id: attempt.id,
    delivery_status: "queued",
    locked_until: lockedUntil,
    attempt_number: attemptNumber,
    sent_today: (sentToday ?? 0) + 1,
    daily_cap: dailyCap,
    instance_id: waInstance.id,
    bypassed_guardrails: bypassed,
  });
});

async function hashMessage(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
