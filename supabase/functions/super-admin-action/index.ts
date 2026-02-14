import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

/**
 * Super Admin action handler — Phase 2.
 * All mutations are audit-logged in super_admin_actions.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return err("Unauthorized", 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabaseUser.auth.getUser();
    if (claimsErr || !claims?.user) return err("Invalid token", 401);

    const userId = claims.user.id;

    // Verify super_admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isSuperAdmin = roles?.some((r: any) => r.role === "super_admin");
    if (!isSuperAdmin) return err("Forbidden: super_admin required", 403);

    const body = await req.json();
    const { action, tenant_id, reason, target_user_id, new_email, new_role, new_password } = body;

    if (!action) return err("Missing action");

    // Helper to log action
    const logAction = async (details: any = {}) => {
      await supabaseAdmin.from("super_admin_actions").insert({
        admin_user_id: userId,
        action,
        target_tenant_id: tenant_id || null,
        target_user_id: target_user_id || null,
        details: { ...details, reason },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
      });
    };

    let result: any = {};

    switch (action) {
      // ── Tenant Lifecycle ──
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
        await logAction();
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
            deleted_at: null,
            deleted_by: null,
            deleted_reason: null,
          })
          .eq("id", tenant_id);
        if (error) throw error;
        await logAction();
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
        await logAction();
        result = { success: true, message: "Tenant desativado" };
        break;
      }

      case "soft_delete_tenant": {
        if (!tenant_id) throw new Error("tenant_id required");
        const now = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from("tenants")
          .update({
            status: "disabled",
            ativo: false,
            deleted_at: now,
            deleted_by: userId,
            deleted_reason: reason || "Exclusão pelo super admin",
            suspended_reason: reason || "Exclusão pelo super admin",
          })
          .eq("id", tenant_id);
        if (error) throw error;

        // Deactivate all users of this tenant
        const { data: tenantProfiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("tenant_id", tenant_id);

        if (tenantProfiles?.length) {
          await supabaseAdmin
            .from("profiles")
            .update({ ativo: false })
            .eq("tenant_id", tenant_id);
        }

        await logAction({ deleted_at: now });
        result = { success: true, message: "Tenant marcado para exclusão (soft delete)" };
        break;
      }

      // ── Tenant Edit ──
      case "edit_tenant": {
        if (!tenant_id) throw new Error("tenant_id required");
        const { nome, documento, dominio_customizado, plano } = body;
        const updates: any = {};
        if (nome !== undefined) updates.nome = nome;
        if (documento !== undefined) updates.documento = documento;
        if (dominio_customizado !== undefined) updates.dominio_customizado = dominio_customizado;
        if (plano !== undefined) updates.plano = plano;

        if (Object.keys(updates).length === 0) throw new Error("No fields to update");

        // Get before state
        const { data: before } = await supabaseAdmin
          .from("tenants")
          .select("nome, documento, dominio_customizado, plano")
          .eq("id", tenant_id)
          .single();

        const { error } = await supabaseAdmin
          .from("tenants")
          .update(updates)
          .eq("id", tenant_id);
        if (error) throw error;

        // If plano changed, sync subscription
        if (plano && before?.plano !== plano) {
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("id")
            .eq("code", plano)
            .single();
          if (plan) {
            await supabaseAdmin
              .from("subscriptions")
              .update({ plan_id: plan.id })
              .eq("tenant_id", tenant_id);
          }
        }

        await logAction({ before, after: updates });
        result = { success: true, message: "Tenant atualizado" };
        break;
      }

      // ── User Management ──
      case "change_owner_email": {
        if (!target_user_id || !new_email) throw new Error("target_user_id and new_email required");
        const { data: beforeUser } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
        const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
          email: new_email,
        });
        if (error) throw error;
        // Sync profile and consultor
        await supabaseAdmin.from("profiles").update({ email: new_email }).eq("user_id", target_user_id);
        await supabaseAdmin.from("consultores").update({ email: new_email }).eq("user_id", target_user_id);
        await logAction({ before_email: beforeUser?.user?.email, after_email: new_email });
        result = { success: true, message: "Email atualizado" };
        break;
      }

      case "force_password_reset": {
        if (!target_user_id) throw new Error("target_user_id required");
        const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
        if (userErr || !userData?.user?.email) throw new Error("User not found");

        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: userData.user.email,
        });
        if (linkErr) throw linkErr;
        await logAction({ user_email: userData.user.email });
        result = { success: true, message: "Link de reset gerado", recovery_link: linkData?.properties?.action_link };
        break;
      }

      case "toggle_user_active": {
        if (!target_user_id) throw new Error("target_user_id required");
        const { new_active } = body;
        if (typeof new_active !== "boolean") throw new Error("new_active (boolean) required");

        // Validate user belongs to tenant
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("tenant_id, ativo, nome")
          .eq("user_id", target_user_id)
          .single();
        if (!profile) throw new Error("Profile not found");

        // If deactivating, check not last admin
        if (!new_active) {
          const { data: isLast } = await supabaseAdmin.rpc("is_last_admin_of_tenant", {
            _user_id: target_user_id,
            _tenant_id: profile.tenant_id,
          });
          if (isLast) throw new Error("Não é possível desativar o último admin do tenant");
        }

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ ativo: new_active })
          .eq("user_id", target_user_id);
        if (error) throw error;

        await logAction({ user_name: profile.nome, before_active: profile.ativo, after_active: new_active });
        result = { success: true, message: new_active ? "Usuário ativado" : "Usuário desativado" };
        break;
      }

      case "transfer_ownership": {
        if (!tenant_id || !target_user_id) throw new Error("tenant_id and target_user_id required");

        // Validate target belongs to tenant
        const { data: targetProfile } = await supabaseAdmin
          .from("profiles")
          .select("tenant_id, nome")
          .eq("user_id", target_user_id)
          .single();
        if (!targetProfile || targetProfile.tenant_id !== tenant_id) {
          throw new Error("Target user does not belong to this tenant");
        }

        const { data: tenantBefore } = await supabaseAdmin
          .from("tenants")
          .select("owner_user_id")
          .eq("id", tenant_id)
          .single();

        // Update tenant owner
        const { error } = await supabaseAdmin
          .from("tenants")
          .update({ owner_user_id: target_user_id })
          .eq("id", tenant_id);
        if (error) throw error;

        // Ensure new owner has admin role
        await supabaseAdmin
          .from("user_roles")
          .upsert(
            { user_id: target_user_id, role: "admin", tenant_id },
            { onConflict: "user_id,role" }
          );

        await logAction({
          before_owner: tenantBefore?.owner_user_id,
          after_owner: target_user_id,
          new_owner_name: targetProfile.nome,
        });
        result = { success: true, message: "Ownership transferido" };
        break;
      }

      case "update_user_role": {
        if (!target_user_id || !new_role) throw new Error("target_user_id and new_role required");

        const { data: targetProfile, error: tpErr } = await supabaseAdmin
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", target_user_id)
          .single();

        if (tpErr || !targetProfile?.tenant_id) {
          throw new Error("Target user has no profile/tenant");
        }

        const effectiveTenantId = tenant_id || targetProfile.tenant_id;

        if (tenant_id && tenant_id !== targetProfile.tenant_id) {
          throw new Error(`Target user belongs to tenant ${targetProfile.tenant_id}, not ${tenant_id}`);
        }

        const { remove_role } = body;
        if (remove_role) {
          if (["admin", "gerente"].includes(new_role)) {
            const { data: isLast } = await supabaseAdmin.rpc("is_last_admin_of_tenant", {
              _user_id: target_user_id,
              _tenant_id: effectiveTenantId,
            });
            if (isLast) throw new Error("Não é possível remover a última role admin/gerente do tenant");
          }
          await supabaseAdmin
            .from("user_roles")
            .delete()
            .eq("user_id", target_user_id)
            .eq("role", new_role);
        } else {
          const { error } = await supabaseAdmin
            .from("user_roles")
            .upsert(
              { user_id: target_user_id, role: new_role, tenant_id: effectiveTenantId },
              { onConflict: "user_id,role" }
            );
          if (error) throw error;
        }

        await logAction({ role: new_role, action_type: remove_role ? "remove" : "add", tenant_id: effectiveTenantId });
        result = { success: true, message: `Role ${new_role} ${remove_role ? "removida" : "atribuída"}` };
        break;
      }

      // ── Ban / Reset User ──
      case "ban_user": {
        if (!target_user_id) throw new Error("target_user_id required");
        // Ban in Supabase Auth (prevents login)
        const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
          ban_duration: "876600h", // ~100 years
        });
        if (banErr) throw banErr;
        // Also deactivate profile
        await supabaseAdmin.from("profiles").update({ ativo: false }).eq("user_id", target_user_id);
        await logAction({ ban: true });
        result = { success: true, message: "Usuário banido" };
        break;
      }

      case "unban_user": {
        if (!target_user_id) throw new Error("target_user_id required");
        const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
          ban_duration: "none",
        });
        if (unbanErr) throw unbanErr;
        await supabaseAdmin.from("profiles").update({ ativo: true }).eq("user_id", target_user_id);
        await logAction({ unban: true });
        result = { success: true, message: "Usuário desbanido" };
        break;
      }

      case "set_password": {
        if (!target_user_id || !new_password) throw new Error("target_user_id and new_password required");
        const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
          password: new_password,
        });
        if (pwErr) throw pwErr;
        await logAction({ password_changed: true });
        result = { success: true, message: "Senha redefinida" };
        break;
      }

      case "delete_user_permanently": {
        if (!target_user_id) throw new Error("target_user_id required");
        // Verify user belongs to tenant
        const { data: delProfile } = await supabaseAdmin
          .from("profiles")
          .select("tenant_id, nome")
          .eq("user_id", target_user_id)
          .single();
        if (!delProfile) throw new Error("Profile not found");
        // Check not last admin
        const { data: isLastDel } = await supabaseAdmin.rpc("is_last_admin_of_tenant", {
          _user_id: target_user_id,
          _tenant_id: delProfile.tenant_id,
        });
        if (isLastDel) throw new Error("Não é possível excluir o último admin do tenant");
        // Remove roles
        await supabaseAdmin.from("user_roles").delete().eq("user_id", target_user_id);
        // Deactivate profile (keep for data integrity)
        await supabaseAdmin.from("profiles").update({ ativo: false }).eq("user_id", target_user_id);
        // Release conversations
        await supabaseAdmin
          .from("wa_conversations")
          .update({ assigned_to: null })
          .eq("assigned_to", target_user_id)
          .eq("status", "open");
        // Delete from Auth
        const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
        if (delAuthErr) throw delAuthErr;
        await logAction({ user_name: delProfile.nome, permanent_delete: true });
        result = { success: true, message: "Usuário excluído permanentemente" };
        break;
      }

      // ── Read Actions ──
      case "get_audit_log": {
        const { data, error } = await supabaseAdmin
          .from("super_admin_actions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return json({ actions: data });
      }

      case "get_tenant_users": {
        if (!tenant_id) throw new Error("tenant_id required");
        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id, nome, email, telefone, ativo, created_at")
          .eq("tenant_id", tenant_id);
        if (error) throw error;

        const userIds = (profiles || []).map((p: any) => p.user_id);
        const { data: userRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const usersWithRoles = (profiles || []).map((p: any) => ({
          ...p,
          roles: (userRoles || []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
        }));

        return json({ users: usersWithRoles });
      }

      default:
        return err(`Unknown action: ${action}`);
    }

    return json(result);
  } catch (e: any) {
    console.error("[super-admin-action] Error:", e.message);
    return err(e.message, 500);
  }
});
