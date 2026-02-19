import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_ROLES = ["admin", "gerente", "financeiro"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  // ── Auth: JWT validation ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

  if (claimsError || !claimsData?.claims?.sub) {
    console.error("[wa-health-admin] Auth failed:", claimsError?.message);
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers });
  }

  const userId = claimsData.claims.sub as string;

  // ── Role check via user_roles ──
  const { data: roles, error: rolesError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (rolesError) {
    console.error("[wa-health-admin] Roles query error:", rolesError.message);
    return new Response(JSON.stringify({ error: "Failed to check permissions" }), { status: 500, headers });
  }

  const isAdmin = (roles ?? []).some((r: { role: string }) => ADMIN_ROLES.includes(r.role));
  if (!isAdmin) {
    console.warn(`[wa-health-admin] Forbidden: user=${userId} has no admin role`);
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  }

  // ── Service role client for admin queries ──
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // Parallel fetches
    const [instancesRes, backlogRes, opsRes, failuresRes] = await Promise.all([
      adminClient
        .from("wa_instances")
        .select("id, evolution_instance_key, status, tenant_id"),
      adminClient
        .from("wa_outbox")
        .select("instance_id, status")
        .in("status", ["pending", "sending"]),
      adminClient
        .from("wa_ops_events")
        .select("event_type")
        .gte("created_at", now24h),
      adminClient
        .from("wa_outbox")
        .select("id, error_message, instance_id, created_at, retry_count")
        .eq("status", "failed")
        .gte("created_at", now24h)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    // Aggregate backlog by instance
    const backlog: Record<string, { pending: number; sending: number }> = {};
    (backlogRes.data || []).forEach((row: { instance_id: string; status: string }) => {
      if (!backlog[row.instance_id]) backlog[row.instance_id] = { pending: 0, sending: 0 };
      backlog[row.instance_id][row.status as "pending" | "sending"]++;
    });

    // Aggregate ops stats
    const opsStats: Record<string, number> = {};
    (opsRes.data || []).forEach((e: { event_type: string }) => {
      opsStats[e.event_type] = (opsStats[e.event_type] || 0) + 1;
    });

    return new Response(JSON.stringify({
      instances: instancesRes.data || [],
      backlog,
      opsStats24h: opsStats,
      failures24h: failuresRes.data || [],
    }), { status: 200, headers });
  } catch (err) {
    console.error("[wa-health-admin] Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
});
