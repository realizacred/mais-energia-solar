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

    // Get API key from payment_gateway_config
    const { data: gwConfig } = await supabaseAdmin
      .from("payment_gateway_config")
      .select("api_key, environment")
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", "asaas")
      .eq("is_active", true)
      .maybeSingle();

    if (!gwConfig?.api_key) {
      return new Response(JSON.stringify({ error: "Asaas não configurado ou desativado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const baseUrl = gwConfig.environment === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

    // Fetch municipal services from Asaas
    let allServices: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${baseUrl}/invoices/municipalServices?offset=${offset}&limit=100`, {
        headers: { accept: "application/json", access_token: gwConfig.api_key },
      });

      // Log request (redacted)
      await supabaseAdmin.from("fiscal_provider_requests").insert({
        tenant_id: profile.tenant_id,
        endpoint: "/invoices/municipalServices",
        method: "GET",
        request_body_redacted: { offset, limit: 100 },
        response_status: response.status,
        response_body_redacted: response.ok ? { message: "success" } : { message: "error" },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[fiscal-municipal-services-sync] Asaas error:", response.status, errText);
        return new Response(JSON.stringify({ 
          error: "Erro ao buscar serviços municipais. Se usa Portal Nacional, cadastre manualmente.",
          asaas_status: response.status
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      const services = data.data || [];
      allServices = allServices.concat(services);
      hasMore = data.hasMore === true;
      offset += 100;
    }

    // Upsert services in DB
    if (allServices.length > 0) {
      // Delete old synced services for this tenant
      await supabaseAdmin
        .from("fiscal_municipal_services")
        .delete()
        .eq("tenant_id", profile.tenant_id)
        .eq("is_manual", false);

      const rows = allServices.map((s: any) => ({
        tenant_id: profile.tenant_id,
        asaas_service_id: s.id || null,
        service_code: s.code || null,
        service_name: s.description || s.name || "Sem descrição",
        description: s.description || null,
        is_manual: false,
        is_active: true,
        synced_at: new Date().toISOString(),
      }));

      const { error: insertErr } = await supabaseAdmin.from("fiscal_municipal_services").insert(rows);
      if (insertErr) {
        console.error("[fiscal-municipal-services-sync] Insert error:", insertErr);
        return new Response(JSON.stringify({ error: "Erro ao salvar serviços" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      total_synced: allServices.length,
      message: allServices.length > 0 
        ? `${allServices.length} serviço(s) sincronizado(s)` 
        : "Nenhum serviço encontrado. Se usa Portal Nacional, cadastre manualmente."
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[fiscal-municipal-services-sync] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
