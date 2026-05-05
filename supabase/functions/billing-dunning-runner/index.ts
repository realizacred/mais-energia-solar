/**
 * billing-dunning-runner — Scans past_due subscriptions, logs dunning_attempts, suspends after N retries.
 * Designed for pg_cron daily invocation. Idempotent: 1 attempt per subscription per day.
 * AGENTS RB-76: usa subscriptions/dunning_attempts/billing_charges (sem duplicar tabelas).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const json = (b: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_ATTEMPTS = 4; // após 4 tentativas → suspended

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Find past_due subscriptions
    const { data: subs, error } = await supa
      .from("subscriptions")
      .select("id, tenant_id, status, current_period_end")
      .in("status", ["past_due", "trialing"]);

    if (error) throw error;

    const now = Date.now();
    let processed = 0;
    let suspended = 0;
    let attempted = 0;

    for (const sub of subs || []) {
      // Trial expired but still trialing → flip to past_due
      if (sub.status === "trialing" && new Date(sub.current_period_end).getTime() < now) {
        await supa.from("subscriptions").update({
          status: "past_due", updated_at: new Date().toISOString(),
        }).eq("id", sub.id);
      }

      if (sub.status !== "past_due") continue;

      // Skip if already attempted today
      const today = new Date().toISOString().split("T")[0];
      const { data: todayAttempt } = await supa
        .from("dunning_attempts")
        .select("id")
        .eq("subscription_id", sub.id)
        .gte("attempted_at", `${today}T00:00:00Z`)
        .maybeSingle();
      if (todayAttempt) continue;

      // Count prior attempts
      const { count } = await supa
        .from("dunning_attempts")
        .select("id", { count: "exact", head: true })
        .eq("subscription_id", sub.id);

      const attemptNum = (count || 0) + 1;

      if (attemptNum > MAX_ATTEMPTS) {
        // Suspend
        await supa.from("subscriptions").update({
          status: "suspended", updated_at: new Date().toISOString(),
        }).eq("id", sub.id);
        await supa.from("dunning_attempts").insert({
          tenant_id: sub.tenant_id,
          subscription_id: sub.id,
          attempt_number: attemptNum,
          channel: "suspend",
          status: "suspended",
        });
        suspended++;
      } else {
        // Log notification attempt (real email/wa dispatch lives elsewhere)
        await supa.from("dunning_attempts").insert({
          tenant_id: sub.tenant_id,
          subscription_id: sub.id,
          attempt_number: attemptNum,
          channel: attemptNum === 1 ? "email" : (attemptNum === 2 ? "email" : "whatsapp"),
          status: "sent",
        });
        attempted++;
      }
      processed++;
    }

    return json({ success: true, processed, attempted, suspended });
  } catch (e) {
    console.error("[billing-dunning-runner]", e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
