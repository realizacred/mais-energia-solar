import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, asaas-access-token",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    console.log("[billing-webhook] Event:", event.event, "Payment:", event.payment?.id);

    // ── Webhook token verification ──
    const webhookToken = Deno.env.get("ASAAS_BILLING_WEBHOOK_TOKEN");
    if (webhookToken) {
      const receivedToken = req.headers.get("asaas-access-token");
      if (receivedToken !== webhookToken) {
        console.error("[billing-webhook] Invalid token");
        return jsonResponse({ error: "Invalid token" }, 401);
      }
    }

    const eventType = event.event as string;
    const paymentData = event.payment;

    if (!paymentData?.id) {
      console.warn("[billing-webhook] No payment data in event");
      return jsonResponse({ received: true, matched: false });
    }

    const asaasChargeId = paymentData.id;

    // ── Find our billing charge ──
    const { data: charge } = await supabaseAdmin
      .from("billing_charges")
      .select("id, tenant_id, plan_id, status")
      .eq("asaas_charge_id", asaasChargeId)
      .maybeSingle();

    // ── Log webhook event ──
    await supabaseAdmin.from("billing_webhook_events").insert({
      tenant_id: charge?.tenant_id || null,
      provider: "asaas",
      provider_event_id: `${eventType}_${asaasChargeId}`,
      payload: event,
      status: charge ? "processed" : "unmatched",
      processed_at: charge ? new Date().toISOString() : null,
    });

    if (!charge) {
      console.warn(`[billing-webhook] No billing_charge found for asaas_id: ${asaasChargeId}`);
      return jsonResponse({ received: true, matched: false });
    }

    // ── Idempotency: don't reprocess paid charges ──
    if (charge.status === "paid") {
      console.log(`[billing-webhook] Charge ${charge.id} already paid, skipping`);
      return jsonResponse({ received: true, already_processed: true });
    }

    // ── Map event to action ──
    const paidEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
    const canceledEvents = ["PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"];
    const overdueEvents = ["PAYMENT_OVERDUE"];

    if (paidEvents.includes(eventType)) {
      const now = new Date().toISOString();

      // 1. Update billing_charges → paid
      await supabaseAdmin
        .from("billing_charges")
        .update({ status: "paid", paid_at: now, updated_at: now })
        .eq("id", charge.id);

      // 2. Update subscription → switch plan
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("tenant_id", charge.tenant_id)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        await supabaseAdmin
          .from("subscriptions")
          .update({
            plan_id: charge.plan_id,
            status: "active",
            current_period_start: now,
            current_period_end: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            updated_at: now,
          })
          .eq("id", sub.id);
      } else {
        // Create new subscription
        await supabaseAdmin.from("subscriptions").insert({
          tenant_id: charge.tenant_id,
          plan_id: charge.plan_id,
          status: "active",
          current_period_start: now,
          current_period_end: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });
      }

      // 3. Reset usage counters for the new period
      await supabaseAdmin
        .from("usage_counters")
        .update({ current_value: 0, updated_at: now })
        .eq("tenant_id", charge.tenant_id);

      console.log(`[billing-webhook] ✅ Charge ${charge.id} paid → plan ${charge.plan_id} activated for tenant ${charge.tenant_id}`);
    } else if (canceledEvents.includes(eventType)) {
      await supabaseAdmin
        .from("billing_charges")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", charge.id);

      console.log(`[billing-webhook] Charge ${charge.id} canceled`);
    } else if (overdueEvents.includes(eventType)) {
      await supabaseAdmin
        .from("billing_charges")
        .update({ status: "overdue", updated_at: new Date().toISOString() })
        .eq("id", charge.id);

      console.log(`[billing-webhook] Charge ${charge.id} overdue`);
    }

    return jsonResponse({ received: true, matched: true, event: eventType });
  } catch (err) {
    console.error("[billing-webhook] Error:", err);
    return jsonResponse({ error: "Webhook processing failed" }, 500);
  }
});
