import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Edge Function gateway for admin-only Google Calendar RPCs.
 *
 * Flow:
 * 1. Validate user JWT via getUser()
 * 2. Check admin role via user-context client
 * 3. Call RPCs via pure service_role client (passing user_id as param)
 *
 * POST body: { action: "config_status" | "connected_users" }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("[google-calendar-admin] Auth failed:", userError?.message);
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = user.id;

    // 2. Admin check
    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "gerente", "financeiro"])
      .limit(1)
      .maybeSingle();

    if (!roleData) {
      console.warn(`[google-calendar-admin] Non-admin attempt user=${userId}`);
      return json({ error: "Admin access required", code: "FORBIDDEN_NOT_ADMIN" }, 403);
    }

    // 3. Parse action
    const body = await req.json();
    const action = body?.action;

    if (!action || !["config_status", "connected_users"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    // 4. Execute via PURE service_role client (no JWT override)
    // RPCs accept p_user_id parameter to derive tenant internally
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let data: unknown;
    let rpcError: unknown;

    if (action === "config_status") {
      const result = await adminClient.rpc("get_google_calendar_config_status", { p_user_id: userId });
      data = result.data;
      rpcError = result.error;
    } else {
      const result = await adminClient.rpc("get_calendar_connected_users", { p_user_id: userId });
      data = result.data;
      rpcError = result.error;
    }

    if (rpcError) {
      console.error(`[google-calendar-admin] RPC error action=${action}:`, rpcError);
      return json({ error: `RPC failed: ${(rpcError as any)?.message || "Unknown"}`, code: "RPC_ERROR" }, 500);
    }

    console.log(`[google-calendar-admin] action=${action} OK user=${userId}`);
    return json({ data });
  } catch (err: unknown) {
    console.error("[google-calendar-admin] Unexpected:", err);
    return json({ error: "Internal error" }, 500);
  }
});
