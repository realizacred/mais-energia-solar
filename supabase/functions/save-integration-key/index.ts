import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user identity
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Admin only
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "gerente"])
      .limit(1)
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { service_key, api_key } = body;

    if (!service_key || !api_key) {
      return new Response(JSON.stringify({ error: "service_key and api_key are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Google Calendar credential validation (NEVER trust the client) ──
    if (service_key === "google_calendar_client_id") {
      const clientIdRegex = /^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;
      if (!clientIdRegex.test(api_key) || api_key.includes("@")) {
        return new Response(
          JSON.stringify({ code: "CONFIG_INVALID", error: "Client ID inválido. Deve estar no formato 123456789-xxx.apps.googleusercontent.com" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    if (service_key === "google_calendar_client_secret") {
      if (api_key.includes("@") || api_key.includes(" ") || api_key.trim().length < 10) {
        return new Response(
          JSON.stringify({ code: "CONFIG_INVALID", error: "Client Secret inválido. Não pode conter espaços ou parecer e-mail." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate the key before saving
    let validation = { valid: false, details: "" };

    if (service_key === "openai") {
      try {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${api_key}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          await res.text();
          validation = { valid: true, details: "API key válida" };
        } else {
          const errText = await res.text();
          validation = { valid: false, details: `HTTP ${res.status}: ${errText.slice(0, 100)}` };
        }
      } catch (err: any) {
        validation = { valid: false, details: err.message || "Timeout ou erro de conexão" };
      }
    } else if (service_key === "google_gemini") {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${api_key}`,
          { method: "GET", signal: AbortSignal.timeout(10000) }
        );
        if (res.ok) {
          await res.text();
          validation = { valid: true, details: "API key válida" };
        } else {
          const errText = await res.text();
          validation = { valid: false, details: `HTTP ${res.status}: ${errText.slice(0, 100)}` };
        }
      } catch (err: any) {
        validation = { valid: false, details: err.message || "Timeout ou erro de conexão" };
      }
    } else {
      // For other services, accept without validation for now
      validation = { valid: true, details: "Salva sem validação" };
    }

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: "Chave inválida", details: validation.details }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant_id
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // G3: Tenant status enforcement
    const { data: tenantRow } = await supabaseAdmin
      .from("tenants")
      .select("status, deleted_at")
      .eq("id", profile.tenant_id)
      .single();
    if (!tenantRow || tenantRow.status !== "active" || tenantRow.deleted_at) {
      return new Response(
        JSON.stringify({ error: "tenant_inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert the key
    const { error: upsertError } = await supabaseAdmin
      .from("integration_configs")
      .upsert(
        {
          tenant_id: profile.tenant_id,
          service_key,
          api_key,
          is_active: true,
          last_validated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: "tenant_id,service_key" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Falha ao salvar", details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Chave salva e validada com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in save-integration-key:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
