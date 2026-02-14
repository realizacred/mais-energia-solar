import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Super Admin action handler.
 * All actions are audit-logged in super_admin_actions.
 * 
 * Actions: suspend_tenant, reactivate_tenant, disable_tenant, update_owner
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate user via JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabaseUser.auth.getUser();
    if (claimsErr || !claims?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.user.id;

    // Verify super_admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isSuperAdmin = roles?.some((r: any) => r.role === "super_admin");
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, tenant_id, reason, target_user_id, new_email, new_role } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = {};

    switch (action) {
      case "suspend_tenant": {
        if (!tenant_id) throw new Error("tenant_id required");
        const { error } = await supabaseAdmin
          .from("tenants")
          .update({
            status: "suspended",
            ativo: false,
            suspended_at: new Date().toISOString(),
            suspended_reason: reason || "Suspensão administrativa",
          })
          .eq("id", tenant_id);
        if (error) throw error;
        result = { success: true, message: "Tenant suspenso" };
        break;
      }

      case "reactivate_tenant": {
        if (!tenant_id) throw new Error("tenant_id required");
        const { error } = await supabaseAdmin
          .from("tenants")
          .update({
            status: "active",
            ativo: true,
            suspended_at: null,
            suspended_reason: null,
          })
          .eq("id", tenant_id);
        if (error) throw error;
        result = { success: true, message: "Tenant reativado" };
        break;
      }

      case "disable_tenant": {
        if (!tenant_id) throw new Error("tenant_id required");
        const { error } = await supabaseAdmin
          .from("tenants")
          .update({
            status: "disabled",
            ativo: false,
            suspended_reason: reason || "Desativação administrativa",
          })
          .eq("id", tenant_id);
        if (error) throw error;
        result = { success: true, message: "Tenant desativado" };
        break;
      }

      case "change_owner_email": {
        if (!target_user_id || !new_email) throw new Error("target_user_id and new_email required");
        const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
          email: new_email,
        });
        if (error) throw error;
        result = { success: true, message: "Email do owner atualizado" };
        break;
      }

      case "force_password_reset": {
        if (!target_user_id) throw new Error("target_user_id required");
        // Get user email first
        const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
        if (userErr || !userData?.user?.email) throw new Error("User not found");
        
        // Generate password reset link
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: userData.user.email,
        });
        if (linkErr) throw linkErr;
        result = { success: true, message: "Link de reset gerado", recovery_link: linkData?.properties?.action_link };
        break;
      }

      case "update_user_role": {
        if (!target_user_id || !new_role) throw new Error("target_user_id and new_role required");
        
        // G25 FIX: Resolve tenant_id from target user's profile
        const { data: targetProfile, error: tpErr } = await supabaseAdmin
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", target_user_id)
          .single();
        
        if (tpErr || !targetProfile?.tenant_id) {
          throw new Error("Target user has no profile/tenant. Cannot assign role without tenant_id.");
        }
        
        // If caller specifies tenant_id, validate it matches (super_admin can cross-tenant)
        const effectiveTenantId = tenant_id || targetProfile.tenant_id;
        
        // Validate target user belongs to the specified tenant
        if (tenant_id && tenant_id !== targetProfile.tenant_id) {
          throw new Error(`Target user belongs to tenant ${targetProfile.tenant_id}, not ${tenant_id}`);
        }
        
        // Upsert role WITH tenant_id
        const { error } = await supabaseAdmin
          .from("user_roles")
          .upsert(
            { user_id: target_user_id, role: new_role, tenant_id: effectiveTenantId },
            { onConflict: "user_id,role" }
          );
        if (error) throw error;
        result = { success: true, message: `Role ${new_role} atribuída (tenant: ${effectiveTenantId})` };
        break;
      }

      case "get_audit_log": {
        const { data, error } = await supabaseAdmin
          .from("super_admin_actions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return new Response(JSON.stringify({ actions: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_tenant_users": {
        if (!tenant_id) throw new Error("tenant_id required");
        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id, nome, email, telefone, ativo, created_at")
          .eq("tenant_id", tenant_id);
        if (error) throw error;

        // Get roles for these users
        const userIds = (profiles || []).map((p: any) => p.user_id);
        const { data: userRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const usersWithRoles = (profiles || []).map((p: any) => ({
          ...p,
          roles: (userRoles || []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
        }));

        return new Response(JSON.stringify({ users: usersWithRoles }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Log the action (except reads)
    if (!action.startsWith("get_")) {
      await supabaseAdmin.from("super_admin_actions").insert({
        admin_user_id: userId,
        action,
        target_tenant_id: tenant_id || null,
        target_user_id: target_user_id || null,
        details: { reason, new_email, new_role },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[super-admin-action] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
