import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Returns email + last_sign_in_at for users that belong to the caller's tenant ONLY.
 * Prevents cross-tenant email leakage.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    // Check admin role
    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) return json({ error: "Forbidden: admin role required" }, 403);

    // Resolve caller's tenant_id
    const { data: callerProfile } = await userClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!callerProfile?.tenant_id) {
      return json({ error: "No tenant found for caller" }, 403);
    }

    const tenantId = callerProfile.tenant_id;

    // Get user_ids that belong to this tenant (service_role to bypass RLS for complete list)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: tenantProfiles, error: profilesErr } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("tenant_id", tenantId);

    if (profilesErr) throw profilesErr;

    const tenantUserIds = new Set((tenantProfiles || []).map((p: { user_id: string }) => p.user_id));

    if (tenantUserIds.size === 0) {
      return json({ emails: {}, last_sign_in: {} });
    }

    // Fetch auth.users — paginated to handle large user bases
    const emailMap: Record<string, string> = {};
    const lastSignInMap: Record<string, string | null> = {};
    let page = 1;
    const perPage = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) throw listError;

      for (const u of users) {
        if (tenantUserIds.has(u.id)) {
          if (u.email) emailMap[u.id] = u.email;
          lastSignInMap[u.id] = u.last_sign_in_at || null;
        }
      }

      hasMore = users.length === perPage;
      page++;
    }

    return json({ emails: emailMap, last_sign_in: lastSignInMap });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("[list-users-emails] Error:", msg);
    return json({ error: msg }, 500);
  }
});
