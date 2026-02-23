import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
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

  // Webhook must be POST
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    console.log("[asaas-webhook] Event received:", event.event, "Payment:", event.payment?.id);

    // ── Webhook token verification (optional but recommended) ──
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    if (webhookToken) {
      const receivedToken = req.headers.get("asaas-access-token");
      if (receivedToken !== webhookToken) {
        console.error("[asaas-webhook] Invalid webhook token");
        return jsonResponse({ error: "Invalid token" }, 401);
      }
    }

    const eventType = event.event;
    const payment = event.payment;

    if (!payment?.id) {
      console.warn("[asaas-webhook] No payment.id in event");
      return jsonResponse({ received: true });
    }

    const gatewayChargeId = payment.id;

    // ── Find corresponding charge in our system ──
    const { data: charge, error: chargeErr } = await supabase
      .from("payment_gateway_charges")
      .select("id, parcela_id, recebimento_id, tenant_id")
      .eq("gateway_charge_id", gatewayChargeId)
      .maybeSingle();

    if (chargeErr) {
      console.error("[asaas-webhook] DB error finding charge:", chargeErr);
      return jsonResponse({ error: "DB error" }, 500);
    }

    if (!charge) {
      console.warn(`[asaas-webhook] No charge found for gateway_id: ${gatewayChargeId}`);
      // Return 200 to prevent Asaas retries for charges not in our system
      return jsonResponse({ received: true, matched: false });
    }

    // ── Map Asaas status to our status ──
    const statusMap: Record<string, string> = {
      PAYMENT_RECEIVED: "confirmed",
      PAYMENT_CONFIRMED: "confirmed",
      PAYMENT_OVERDUE: "overdue",
      PAYMENT_DELETED: "cancelled",
      PAYMENT_REFUNDED: "refunded",
      PAYMENT_RECEIVED_IN_CASH_UNDONE: "pending",
      PAYMENT_CHARGEBACK_REQUESTED: "chargeback",
      PAYMENT_CHARGEBACK_DISPUTE: "chargeback",
      PAYMENT_AWAITING_CHARGEBACK_REVERSAL: "chargeback",
      PAYMENT_DUNNING_RECEIVED: "confirmed",
      PAYMENT_DUNNING_REQUESTED: "pending",
      PAYMENT_BANK_SLIP_VIEWED: "pending", // Just a view event
      PAYMENT_CHECKOUT_VIEWED: "pending",
    };

    const newGatewayStatus = statusMap[eventType] || "unknown";

    // ── Update charge record ──
    const updatePayload: Record<string, unknown> = {
      gateway_status: newGatewayStatus,
      webhook_last_event: eventType,
      webhook_last_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
      updatePayload.paid_at = payment.paymentDate || payment.confirmedDate || new Date().toISOString();
      updatePayload.net_value = payment.netValue ?? null;
      updatePayload.fee = payment.fee ?? null;
    }

    const { error: updateChargeErr } = await supabase
      .from("payment_gateway_charges")
      .update(updatePayload)
      .eq("id", charge.id);

    if (updateChargeErr) {
      console.error("[asaas-webhook] Error updating charge:", updateChargeErr);
    }

    // ── Update parcela status based on event ──
    if (charge.parcela_id) {
      if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
        // Mark parcela as paid
        const { error: parcErr } = await supabase
          .from("parcelas")
          .update({
            status: "paga",
            updated_at: new Date().toISOString(),
          })
          .eq("id", charge.parcela_id);

        if (parcErr) {
          console.error("[asaas-webhook] Error updating parcela to paga:", parcErr);
        } else {
          console.log(`[asaas-webhook] Parcela ${charge.parcela_id} marked as PAGA`);
        }

        // Create pagamento record for reconciliation
        try {
          await supabase
            .from("pagamentos")
            .insert({
              tenant_id: charge.tenant_id,
              recebimento_id: charge.recebimento_id,
              valor_pago: payment.value,
              forma_pagamento: payment.billingType === "PIX" ? "pix" : "boleto",
              data_pagamento: payment.paymentDate || new Date().toISOString().split("T")[0],
              observacoes: `Baixa automática via Asaas (${gatewayChargeId})`,
            });
        } catch (e) {
          console.warn("[asaas-webhook] Non-critical: failed to create pagamento record:", e);
        }
      } else if (eventType === "PAYMENT_OVERDUE") {
        await supabase
          .from("parcelas")
          .update({ status: "atrasada", updated_at: new Date().toISOString() })
          .eq("id", charge.parcela_id);
      } else if (eventType === "PAYMENT_DELETED") {
        await supabase
          .from("parcelas")
          .update({ status: "cancelada", updated_at: new Date().toISOString() })
          .eq("id", charge.parcela_id);
      }
    }

    console.log(`[asaas-webhook] Processed: ${eventType} → ${newGatewayStatus} for charge ${charge.id}`);
    return jsonResponse({ received: true, matched: true, status: newGatewayStatus });
  } catch (err: any) {
    console.error("[asaas-webhook] Error:", err);
    return jsonResponse({ error: "Webhook processing failed" }, 500);
  }
});
