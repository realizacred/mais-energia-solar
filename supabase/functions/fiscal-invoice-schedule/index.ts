import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).single();
    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "No tenant" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get invoice
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from("fiscal_invoices")
      .select("*")
      .eq("id", invoice_id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Nota não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (invoice.snapshot_locked) {
      return new Response(JSON.stringify({ error: "Nota já autorizada — snapshot travado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotency check
    const idempKey = `ISSUE_${invoice_id}`;
    const { data: existing } = await supabaseAdmin
      .from("fiscal_idempotency")
      .select("id, result")
      .eq("tenant_id", profile.tenant_id)
      .eq("operation", "ISSUE")
      .eq("idempotency_key", idempKey)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, message: "Já agendada (idempotente)", result: existing.result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API key
    const { data: gwConfig } = await supabaseAdmin
      .from("payment_gateway_config")
      .select("api_key, environment")
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", "asaas")
      .eq("is_active", true)
      .maybeSingle();

    if (!gwConfig?.api_key) {
      return new Response(JSON.stringify({ error: "Asaas não configurado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const baseUrl = gwConfig.environment === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

    // Build Asaas payload
    const asaasPayload: Record<string, unknown> = {
      serviceDescription: invoice.service_description,
      observations: invoice.observations || undefined,
      value: Number(invoice.value),
      deductions: invoice.deductions ? Number(invoice.deductions) : undefined,
      effectiveDate: invoice.effective_date,
      municipalServiceId: invoice.municipal_service_id || undefined,
      municipalServiceCode: invoice.municipal_service_code || undefined,
      municipalServiceName: invoice.municipal_service_name || undefined,
    };

    // Add payment or customer link
    if (invoice.payment_id) {
      asaasPayload.payment = invoice.payment_id;
    } else if (invoice.customer_id) {
      asaasPayload.customer = invoice.customer_id;
    }

    // Add taxes
    if (invoice.taxes && typeof invoice.taxes === "object") {
      asaasPayload.taxes = invoice.taxes;
    }

    const startTime = Date.now();
    const response = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        access_token: gwConfig.api_key,
      },
      body: JSON.stringify(asaasPayload),
    });

    const duration = Date.now() - startTime;
    const responseData = await response.json();

    // Log request (redacted — no api_key)
    await supabaseAdmin.from("fiscal_provider_requests").insert({
      tenant_id: profile.tenant_id,
      invoice_id: invoice_id,
      endpoint: "/invoices",
      method: "POST",
      request_body_redacted: { ...asaasPayload, _note: "api_key redacted" },
      response_status: response.status,
      response_body_redacted: response.ok ? { id: responseData.id, status: responseData.status } : { errors: responseData.errors },
      duration_ms: duration,
    });

    if (!response.ok) {
      // Update invoice with error
      await supabaseAdmin.from("fiscal_invoices").update({
        status: "error",
        error_message: responseData.errors?.[0]?.description || "Erro Asaas",
        error_details: responseData,
      }).eq("id", invoice_id);

      // Log event
      await supabaseAdmin.from("fiscal_invoice_events").insert({
        tenant_id: profile.tenant_id,
        invoice_id,
        event_type: "SCHEDULE_ERROR",
        event_source: "edge_function",
        old_status: invoice.status,
        new_status: "error",
        payload: { asaas_errors: responseData.errors },
        user_id: user.id,
      });

      return new Response(JSON.stringify({ 
        success: false, 
        error: responseData.errors?.[0]?.description || "Erro ao agendar nota",
        details: responseData 
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Success — update invoice
    const snapshot = {
      service_description: invoice.service_description,
      value: invoice.value,
      deductions: invoice.deductions,
      taxes: invoice.taxes,
      municipal_service_id: invoice.municipal_service_id,
      municipal_service_code: invoice.municipal_service_code,
      municipal_service_name: invoice.municipal_service_name,
      effective_date: invoice.effective_date,
      scheduled_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("fiscal_invoices").update({
      asaas_invoice_id: responseData.id,
      status: "scheduled",
      status_asaas: responseData.status,
      snapshot_json: snapshot,
      error_message: null,
      error_details: null,
      idempotency_key: idempKey,
    }).eq("id", invoice_id);

    // Idempotency record
    await supabaseAdmin.from("fiscal_idempotency").insert({
      tenant_id: profile.tenant_id,
      operation: "ISSUE",
      idempotency_key: idempKey,
      result: { asaas_invoice_id: responseData.id, status: responseData.status },
    });

    // Event log
    await supabaseAdmin.from("fiscal_invoice_events").insert({
      tenant_id: profile.tenant_id,
      invoice_id,
      event_type: "SCHEDULED",
      event_source: "edge_function",
      old_status: invoice.status,
      new_status: "scheduled",
      payload: { asaas_id: responseData.id },
      user_id: user.id,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      asaas_invoice_id: responseData.id,
      status: responseData.status 
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[fiscal-invoice-schedule] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
