import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "APAGAR TUDO") {
      return jsonResponse(400, { error: "Confirmação inválida." });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Não autenticado." });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !userData?.user) {
      console.error("[reset-tenant-data] auth error:", authErr?.message);
      return jsonResponse(401, { error: "Usuário não autenticado." });
    }

    const admin = createClient(url, serviceKey);

    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (profErr) {
      console.error("[reset-tenant-data] profile error:", profErr.message);
      return jsonResponse(500, { error: `Erro ao buscar profile: ${profErr.message}` });
    }
    if (!profile?.tenant_id) {
      return jsonResponse(400, { error: "Tenant não encontrado para o usuário." });
    }

    const tenantId = profile.tenant_id as string;
    console.log(`[reset-tenant-data] tenant=${tenantId} user=${userData.user.id}`);

    // RPC handles canonical data + SM raw truncates + external_entity_links
    const { data: rpcResult, error: rpcErr } = await admin.rpc(
      "reset_migrated_data",
      { p_tenant_id: tenantId }
    );

    if (rpcErr) {
      console.error("[reset-tenant-data] RPC error:", rpcErr.message, rpcErr.details, rpcErr.hint);
      return jsonResponse(500, {
        error: rpcErr.message,
        details: rpcErr.details,
        hint: rpcErr.hint,
      });
    }

    // RPC returns { success, message, counts } or { success:false, error }
    const result = rpcResult as { success?: boolean; error?: string; counts?: Record<string, number>; message?: string } | null;
    if (result && result.success === false) {
      return jsonResponse(409, { error: result.error ?? "Reset bloqueado." });
    }

    // Cleanup sm_consultor_mapping (not handled by RPC)
    const { error: consultErr } = await admin
      .from("sm_consultor_mapping")
      .delete()
      .eq("tenant_id", tenantId);
    if (consultErr) {
      console.warn("[reset-tenant-data] consultor_mapping cleanup warn:", consultErr.message);
    }

    return jsonResponse(200, {
      success: true,
      tenantId,
      counts: result?.counts ?? {},
      message: result?.message,
    });
  } catch (e: any) {
    console.error("[reset-tenant-data] FATAL:", e?.message, e?.stack);
    return jsonResponse(500, {
      error: e?.message ?? "Erro inesperado.",
      stack: e?.stack,
    });
  }
});
