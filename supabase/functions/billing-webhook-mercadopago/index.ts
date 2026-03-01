/**
 * billing-webhook-mercadopago — Processes MercadoPago payment webhooks for monitor subscriptions.
 * Idempotent via billing_webhook_events.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" };

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const event = await req.json();
    const eventId = `mp_${event.id || event.data?.id || Date.now()}`;

    // Idempotency
    const { data: existing } = await sb
      .from("billing_webhook_events")
      .select("id")
      .eq("provider", "mercadopago")
      .eq("provider_event_id", eventId)
      .maybeSingle();

    if (existing) return jsonRes({ received: true, duplicate: true });

    await sb.from("billing_webhook_events").insert({
      provider: "mercadopago",
      provider_event_id: eventId,
      payload: event,
      status: "received",
    });

    // MercadoPago sends type=payment, action=payment.updated
    if (event.type !== "payment" || !event.data?.id) {
      await sb.from("billing_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() })
        .eq("provider", "mercadopago").eq("provider_event_id", eventId);
      return jsonRes({ received: true, ignored: true });
    }

    // Fetch payment details from MP API
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) {
      console.warn("[billing-webhook-mp] No MERCADOPAGO_ACCESS_TOKEN configured");
      await sb.from("billing_webhook_events").update({ status: "error", error_message: "No MP token", processed_at: new Date().toISOString() })
        .eq("provider", "mercadopago").eq("provider_event_id", eventId);
      return jsonRes({ received: true, error: "No token configured" });
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${event.data.id}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    const payment = await paymentRes.json();

    const statusMap: Record<string, string> = {
      approved: "active",
      rejected: "past_due",
      cancelled: "canceled",
      refunded: "canceled",
    };

    const newStatus = statusMap[payment.status] || null;
    if (!newStatus) {
      await sb.from("billing_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() })
        .eq("provider", "mercadopago").eq("provider_event_id", eventId);
      return jsonRes({ received: true, ignored: true });
    }

    // Find subscription
    const externalRef = payment.external_reference || "";
    const { data: sub } = await sb
      .from("monitor_subscriptions")
      .select("id, tenant_id")
      .eq("provider", "mercadopago")
      .eq("provider_subscription_id", externalRef)
      .maybeSingle();

    if (sub) {
      await sb.from("monitor_subscriptions").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", (sub as any).id);

      if (payment.status === "approved") {
        await sb.from("monitor_billing_records").insert({
          tenant_id: (sub as any).tenant_id,
          subscription_id: (sub as any).id,
          reference_month: new Date().getMonth() + 1,
          reference_year: new Date().getFullYear(),
          amount_brl: (payment.transaction_amount || 0),
          amount_cents: Math.round((payment.transaction_amount || 0) * 100),
          currency: "BRL",
          status: "paid",
          paid_at: new Date().toISOString(),
          provider: "mercadopago",
          provider_invoice_id: String(payment.id),
        });
      }
    }

    await sb.from("billing_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "mercadopago").eq("provider_event_id", eventId);

    return jsonRes({ received: true, matched: !!sub, status: newStatus });
  } catch (err) {
    console.error("[billing-webhook-mp] Error:", err);
    return jsonRes({ error: "Processing failed" }, 500);
  }
});
