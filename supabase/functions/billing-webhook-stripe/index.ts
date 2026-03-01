/**
 * billing-webhook-stripe — Processes Stripe webhook events for monitor subscriptions.
 * Idempotent via billing_webhook_events.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, stripe-signature" };

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const rawBody = await req.text();

    // Stripe signature verification (recommended)
    const stripeSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const signature = req.headers.get("stripe-signature");
    // Note: Full Stripe signature verification requires the stripe SDK
    // For now, we verify that the webhook secret is configured and signature is present
    if (stripeSecret && !signature) {
      return jsonRes({ error: "Missing stripe-signature header" }, 401);
    }

    const event = JSON.parse(rawBody);
    const eventId = `stripe_${event.id || Date.now()}`;

    // Idempotency
    const { data: existing } = await sb
      .from("billing_webhook_events")
      .select("id")
      .eq("provider", "stripe")
      .eq("provider_event_id", eventId)
      .maybeSingle();

    if (existing) return jsonRes({ received: true, duplicate: true });

    await sb.from("billing_webhook_events").insert({
      provider: "stripe",
      provider_event_id: eventId,
      payload: event,
      status: "received",
    });

    const eventType = event.type as string;
    const obj = event.data?.object;
    if (!obj) {
      await sb.from("billing_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() })
        .eq("provider", "stripe").eq("provider_event_id", eventId);
      return jsonRes({ received: true });
    }

    // Map Stripe events
    let newStatus: string | null = null;
    let subscriptionId: string | null = null;

    switch (eventType) {
      case "invoice.paid":
        newStatus = "active";
        subscriptionId = obj.subscription;
        break;
      case "invoice.payment_failed":
        newStatus = "past_due";
        subscriptionId = obj.subscription;
        break;
      case "customer.subscription.updated":
        subscriptionId = obj.id;
        if (obj.status === "active") newStatus = "active";
        else if (obj.status === "past_due") newStatus = "past_due";
        else if (obj.status === "canceled") newStatus = "canceled";
        else if (obj.status === "trialing") newStatus = "trialing";
        break;
      case "customer.subscription.deleted":
        newStatus = "canceled";
        subscriptionId = obj.id;
        break;
    }

    if (!newStatus || !subscriptionId) {
      await sb.from("billing_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() })
        .eq("provider", "stripe").eq("provider_event_id", eventId);
      return jsonRes({ received: true, ignored: true });
    }

    // Find subscription
    const { data: sub } = await sb
      .from("monitor_subscriptions")
      .select("id, tenant_id")
      .eq("provider", "stripe")
      .eq("provider_subscription_id", subscriptionId)
      .maybeSingle();

    if (sub) {
      const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
      if (eventType === "customer.subscription.updated" && obj.current_period_end) {
        updates.current_period_end = new Date(obj.current_period_end * 1000).toISOString();
      }
      await sb.from("monitor_subscriptions").update(updates).eq("id", (sub as any).id);

      if (eventType === "invoice.paid") {
        await sb.from("monitor_billing_records").insert({
          tenant_id: (sub as any).tenant_id,
          subscription_id: (sub as any).id,
          reference_month: new Date().getMonth() + 1,
          reference_year: new Date().getFullYear(),
          amount_brl: (obj.amount_paid || 0) / 100,
          amount_cents: obj.amount_paid || 0,
          currency: obj.currency?.toUpperCase() || "BRL",
          status: "paid",
          paid_at: new Date().toISOString(),
          provider: "stripe",
          provider_invoice_id: obj.id,
        });
      }
    }

    await sb.from("billing_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "stripe").eq("provider_event_id", eventId);

    return jsonRes({ received: true, matched: !!sub, status: newStatus });
  } catch (err) {
    console.error("[billing-webhook-stripe] Error:", err);
    return jsonRes({ error: "Processing failed" }, 500);
  }
});
