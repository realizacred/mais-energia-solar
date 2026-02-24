import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    console.log("[fiscal-webhook-ingest] Event:", event.event, "Invoice:", event.invoice?.id);

    // Webhook token verification
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    if (webhookToken) {
      const receivedToken = req.headers.get("asaas-access-token");
      if (receivedToken !== webhookToken) {
        console.error("[fiscal-webhook-ingest] Invalid token");
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const eventType = event.event as string;
    const invoiceData = event.invoice;

    if (!invoiceData?.id) {
      // Store raw webhook anyway
      await supabaseAdmin.from("fiscal_provider_webhooks").insert({
        event_type: eventType,
        raw_payload: event,
        signature_valid: true,
        processed: false,
      });
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const asaasInvoiceId = invoiceData.id;

    // Find our invoice
    const { data: invoice } = await supabaseAdmin
      .from("fiscal_invoices")
      .select("id, tenant_id, status")
      .eq("asaas_invoice_id", asaasInvoiceId)
      .maybeSingle();

    // Store webhook
    await supabaseAdmin.from("fiscal_provider_webhooks").insert({
      tenant_id: invoice?.tenant_id || null,
      event_type: eventType,
      raw_payload: event,
      signature_valid: true,
      processed: !!invoice,
      processed_at: invoice ? new Date().toISOString() : null,
      invoice_id: invoice?.id || null,
    });

    if (!invoice) {
      console.warn(`[fiscal-webhook-ingest] No invoice found for asaas_id: ${asaasInvoiceId}`);
      return new Response(JSON.stringify({ received: true, matched: false }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Map status
    const statusMap: Record<string, string> = {
      INVOICE_CREATED: "scheduled",
      INVOICE_UPDATED: "scheduled",
      INVOICE_SYNCHRONIZED: "synchronized",
      INVOICE_AUTHORIZED: "authorized",
      INVOICE_PROCESSING_CANCELLATION: "processing_cancellation",
      INVOICE_CANCELED: "canceled",
      INVOICE_CANCELLATION_DENIED: "cancellation_denied",
      INVOICE_ERROR: "error",
    };

    const newStatus = statusMap[eventType] || invoice.status;

    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      status_asaas: invoiceData.status || eventType,
    };

    // If authorized, lock snapshot + capture PDF/XML
    if (eventType === "INVOICE_AUTHORIZED") {
      updatePayload.snapshot_locked = true;
      updatePayload.pdf_url = invoiceData.pdfUrl || null;
      updatePayload.xml_url = invoiceData.xmlUrl || null;
      updatePayload.invoice_number = invoiceData.number || null;
      updatePayload.validation_code = invoiceData.validationCode || null;
      updatePayload.rps_number = invoiceData.rpsSerie ? `${invoiceData.rpsSerie}-${invoiceData.rpsNumber}` : null;
    }

    if (eventType === "INVOICE_ERROR") {
      updatePayload.error_message = invoiceData.errors?.[0]?.description || "Erro na nota";
      updatePayload.error_details = invoiceData.errors || null;
    }

    await supabaseAdmin.from("fiscal_invoices").update(updatePayload).eq("id", invoice.id);

    // Event log
    await supabaseAdmin.from("fiscal_invoice_events").insert({
      tenant_id: invoice.tenant_id,
      invoice_id: invoice.id,
      event_type: eventType,
      event_source: "webhook",
      old_status: invoice.status,
      new_status: newStatus,
      payload: { asaas_invoice_data: { id: invoiceData.id, status: invoiceData.status, number: invoiceData.number } },
    });

    console.log(`[fiscal-webhook-ingest] Processed: ${eventType} → ${newStatus} for invoice ${invoice.id}`);
    return new Response(JSON.stringify({ received: true, matched: true, status: newStatus }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fiscal-webhook-ingest] Error:", err);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
