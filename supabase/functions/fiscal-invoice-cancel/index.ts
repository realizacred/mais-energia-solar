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

    const { invoice_id } = await req.json();
    if (!invoice_id) return new Response(JSON.stringify({ error: "invoice_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: invoice } = await supabaseAdmin
      .from("fiscal_invoices")
      .select("id, asaas_invoice_id, status, tenant_id")
      .eq("id", invoice_id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (!invoice?.asaas_invoice_id) {
      return new Response(JSON.stringify({ error: "Nota não encontrada ou sem ID Asaas" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotency
    const idempKey = `CANCEL_${invoice_id}`;
    const { data: existing } = await supabaseAdmin
      .from("fiscal_idempotency")
      .select("id, result")
      .eq("tenant_id", profile.tenant_id)
      .eq("operation", "CANCEL")
      .eq("idempotency_key", idempKey)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, message: "Já cancelada (idempotente)" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const response = await fetch(`${baseUrl}/invoices/${invoice.asaas_invoice_id}/cancel`, {
      method: "POST",
      headers: { accept: "application/json", access_token: gwConfig.api_key },
    });

    const responseData = await response.json();

    await supabaseAdmin.from("fiscal_provider_requests").insert({
      tenant_id: profile.tenant_id,
      invoice_id,
      endpoint: `/invoices/${invoice.asaas_invoice_id}/cancel`,
      method: "POST",
      response_status: response.status,
      response_body_redacted: response.ok ? { status: responseData.status } : { errors: responseData.errors },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ success: false, error: responseData.errors?.[0]?.description || "Erro ao cancelar" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("fiscal_invoices").update({
      status: "processing_cancellation",
      status_asaas: responseData.status || "PROCESSING_CANCELLATION",
    }).eq("id", invoice_id);

    await supabaseAdmin.from("fiscal_idempotency").insert({
      tenant_id: profile.tenant_id,
      operation: "CANCEL",
      idempotency_key: idempKey,
      result: { status: responseData.status },
    });

    await supabaseAdmin.from("fiscal_invoice_events").insert({
      tenant_id: profile.tenant_id,
      invoice_id,
      event_type: "CANCEL_REQUESTED",
      event_source: "edge_function",
      old_status: invoice.status,
      new_status: "processing_cancellation",
      user_id: user.id,
    });

    return new Response(JSON.stringify({ success: true, status: responseData.status }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fiscal-invoice-cancel] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
