import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { confirm } = await req.json();

    if (confirm !== "APAGAR TUDO") {
      return new Response(
        JSON.stringify({ error: "Confirmação inválida. Envie { confirm: \"APAGAR TUDO\" }." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Tenant não encontrado para este usuário.", details: profileErr?.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check admin via RPC function
    const { data: isAdmin, error: adminErr } = await admin.rpc("is_admin", { _user_id: user.id });

    if (adminErr || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem executar esta operação.", details: adminErr?.message }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantId = profile.tenant_id;

    // Use SECURITY DEFINER RPC to delete all data atomically
    const { data: counts, error: resetErr } = await admin.rpc("reset_tenant_data", {
      p_tenant_id: tenantId,
    });

    if (resetErr) {
      console.error("[reset-tenant-data] RPC error:", resetErr.message);
      return new Response(
        JSON.stringify({ error: `Erro ao resetar dados: ${resetErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, tenantId, counts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[reset-tenant-data] Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: e.message ?? "Erro inesperado.", step: "reset-tenant-data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
