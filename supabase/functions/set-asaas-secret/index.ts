import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Sessão inválida" }, 401);
    }

    // Admin/gerente only
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "gerente"])
      .limit(1)
      .maybeSingle();

    if (!roleData) {
      return json({ error: "Apenas administradores podem configurar integrações" }, 403);
    }

    const { api_key } = await req.json();
    if (!api_key || typeof api_key !== "string" || api_key.trim().length < 10) {
      return json({ error: "API key inválida" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get tenant
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return json({ error: "Tenant não encontrado" }, 400);
    }

    // Tenant status check
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("status, deleted_at")
      .eq("id", profile.tenant_id)
      .single();

    if (!tenant || tenant.status !== "active" || tenant.deleted_at) {
      return json({ error: "tenant_inactive" }, 403);
    }

    // Store in integration_configs (secured table, accessed only via service role)
    const { error: upsertError } = await supabaseAdmin
      .from("integration_configs")
      .upsert(
        {
          tenant_id: profile.tenant_id,
          service_key: "asaas_api_key",
          api_key: api_key.trim(),
          is_active: true,
          last_validated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: "tenant_id,service_key" }
      );

    if (upsertError) {
      console.error("[set-asaas-secret] Upsert error:", upsertError);
      return json({ error: "Falha ao salvar chave" }, 500);
    }

    // Clear api_key from payment_gateway_config if it exists there
    await supabaseAdmin
      .from("payment_gateway_config")
      .update({ api_key: "" })
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", "asaas");

    console.log(`[set-asaas-secret] Key saved for tenant ${profile.tenant_id}`);

    return json({ success: true, message: "Chave salva com segurança" });
  } catch (err) {
    console.error("[set-asaas-secret] Error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
