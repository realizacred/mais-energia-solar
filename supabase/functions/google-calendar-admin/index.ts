import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Edge Function gateway for admin-only Google Calendar RPCs.
 * 
 * The underlying RPCs (get_google_calendar_config_status, get_calendar_connected_users)
 * are REVOKED from `authenticated` — only `service_role` can execute them.
 * This function validates admin status and proxies via service_role.
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = claimsData.claims.sub;

    // 2. Admin check (using user-context client which respects RLS on user_roles)
    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "gerente", "financeiro"])
      .limit(1)
      .maybeSingle();

    if (!roleData) {
      return json({ error: "Admin access required" }, 403);
    }

    // 3. Parse action
    const body = await req.json();
    const action = body?.action;

    if (!action || !["config_status", "connected_users"].includes(action)) {
      return json({ error: "Invalid action. Use 'config_status' or 'connected_users'" }, 400);
    }

    // 4. Execute via service_role (only role with GRANT on these RPCs)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // We need to impersonate the user context for the RPC to derive tenant_id
    // The RPCs use auth.uid() internally, so we call them with the user's JWT
    // but via a client that has service_role permissions
    const serviceClientWithUserContext = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    let data: unknown;
    let error: unknown;

    if (action === "config_status") {
      const result = await serviceClientWithUserContext.rpc("get_google_calendar_config_status");
      data = result.data;
      error = result.error;
    } else {
      const result = await serviceClientWithUserContext.rpc("get_calendar_connected_users");
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error(`[google-calendar-admin] RPC error for action=${action}:`, error);
      return json({ error: "Internal error" }, 500);
    }

    return json({ data });
  } catch (err: unknown) {
    console.error("[google-calendar-admin] Unexpected error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
