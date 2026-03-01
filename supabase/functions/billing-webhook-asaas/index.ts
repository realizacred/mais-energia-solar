/**
 * billing-webhook-asaas — Processes Asaas payment webhooks for monitor subscriptions.
 * Idempotent via billing_webhook_events.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, asaas-access-token" };

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // Validate webhook token
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    if (webhookToken) {
      const received = req.headers.get("asaas-access-token");
      if (received !== webhookToken) return jsonRes({ error: "Invalid token" }, 401);
    }

    const event = await req.json();
    const eventType = event.event as string;
    const payment = event.payment;
    const eventId = `asaas_${payment?.id || event.id || Date.now()}`;

    // Idempotency check
    const { data: existing } = await sb
      .from("billing_webhook_events")
      .select("id")
      .eq("provider", "asaas")
      .eq("provider_event_id", eventId)
      .maybeSingle();

    if (existing) return jsonRes({ received: true, duplicate: true });

    // Record event
    await sb.from("billing_webhook_events").insert({
      provider: "asaas",
      provider_event_id: eventId,
      payload: event,
      status: "received",
    });

    if (!payment?.id) return jsonRes({ received: true });

    // Map Asaas status
    const statusMap: Record<string, string> = {
      PAYMENT_RECEIVED: "active",
      PAYMENT_CONFIRMED: "active",
      PAYMENT_OVERDUE: "past_due",
      PAYMENT_DELETED: "canceled",
      PAYMENT_REFUNDED: "canceled",
    };

    const newStatus = statusMap[eventType];
    if (!newStatus) {
      await sb.from("billing_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() })
        .eq("provider", "asaas").eq("provider_event_id", eventId);
      return jsonRes({ received: true, ignored: true });
    }

    // Find subscription by provider_subscription_id
    const { data: sub } = await sb
      .from("monitor_subscriptions")
      .select("id, tenant_id, status")
      .eq("provider", "asaas")
      .eq("provider_subscription_id", payment.subscription || payment.id)
      .maybeSingle();

    if (sub) {
      await sb.from("monitor_subscriptions").update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", (sub as any).id);

      // Record billing
      if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
        await sb.from("monitor_billing_records").insert({
          tenant_id: (sub as any).tenant_id,
          subscription_id: (sub as any).id,
          reference_month: new Date().getMonth() + 1,
          reference_year: new Date().getFullYear(),
          amount_brl: payment.value || 0,
          amount_cents: Math.round((payment.value || 0) * 100),
          currency: "BRL",
          status: "paid",
          paid_at: new Date().toISOString(),
          provider: "asaas",
          provider_invoice_id: payment.id,
        });
      }
    }

    await sb.from("billing_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "asaas").eq("provider_event_id", eventId);

    return jsonRes({ received: true, matched: !!sub, status: newStatus });
  } catch (err) {
    console.error("[billing-webhook-asaas] Error:", err);
    return jsonRes({ error: "Processing failed" }, 500);
  }
});
